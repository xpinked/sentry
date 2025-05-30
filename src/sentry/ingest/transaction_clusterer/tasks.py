import logging
from collections.abc import Sequence
from itertools import islice
from typing import Any

import sentry_sdk

from sentry.models.project import Project
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import performance_tasks
from sentry.taskworker.retry import Retry
from sentry.utils import metrics

from . import ClustererNamespace, rules
from .datasource import redis
from .meta import track_clusterer_run
from .tree import TreeClusterer

logger_transactions = logging.getLogger("sentry.ingest.transaction_clusterer.tasks")

#: Minimum number of children in the URL tree which triggers a merge.
#: See ``TreeClusterer`` for more information.
#: NOTE: We could make this configurable through django settings or even per-project in the future.
#: Minimum number of children in the URL tree which triggers a merge.
#: See TreeClusterer for more information.
#: NOTE: We could make this configurable through django settings or even per-project in the future.
MERGE_THRESHOLD = 200

#: We're only using span clustering for resource spans right now, where we expect path segments to be either
#: very low-cardinality or very high-cardinality, so we can use a more aggressive threshold.
MERGE_THRESHOLD_SPANS = 50

#: Number of projects to process in one celery task
#: The number 100 was chosen at random and might still need tweaking.
PROJECTS_PER_TASK = 100

#: Estimated limit for a clusterer run per project, in seconds.
#: NOTE: using this in a per-project basis may not be enough. Consider using
#: this estimation for project batches instead.
CLUSTERING_TIMEOUT_PER_PROJECT = 0.3


@instrumented_task(
    name="sentry.ingest.transaction_clusterer.tasks.spawn_clusterers",
    queue="transactions.name_clusterer",
    default_retry_delay=5,  # copied from release monitor
    max_retries=5,  # copied from release monitor
    taskworker_config=TaskworkerConfig(
        namespace=performance_tasks,
        retry=Retry(
            times=5,
            delay=5,
        ),
    ),
)
def spawn_clusterers(**kwargs: Any) -> None:
    """Look for existing transaction name sets in redis and spawn clusterers for each"""
    with sentry_sdk.start_span(op="txcluster_spawn"):
        project_count = 0
        project_iter = redis.get_active_project_ids(ClustererNamespace.TRANSACTIONS)
        while batch := list(islice(project_iter, PROJECTS_PER_TASK)):
            project_count += len(batch)
            cluster_projects.delay(project_ids=batch)

        metrics.incr("txcluster.spawned_projects", amount=project_count, sample_rate=1.0)


@instrumented_task(
    name="sentry.ingest.transaction_clusterer.tasks.cluster_projects",
    queue="transactions.name_clusterer",
    default_retry_delay=5,  # copied from release monitor
    max_retries=5,  # copied from release monitor
    soft_time_limit=PROJECTS_PER_TASK * CLUSTERING_TIMEOUT_PER_PROJECT,
    time_limit=PROJECTS_PER_TASK * CLUSTERING_TIMEOUT_PER_PROJECT + 2,  # extra 2s to emit metrics
    taskworker_config=TaskworkerConfig(
        namespace=performance_tasks,
        processing_deadline_duration=int(PROJECTS_PER_TASK * CLUSTERING_TIMEOUT_PER_PROJECT + 2),
        retry=Retry(
            times=5,
            delay=5,
        ),
    ),
)
def cluster_projects(project_ids: Sequence[int]) -> None:
    projects = Project.objects.get_many_from_cache(project_ids)
    pending = set(projects)
    num_clustered = 0
    try:
        for project in projects:
            with sentry_sdk.start_span(op="txcluster_project") as span:
                span.set_data("project_id", project.id)
                tx_names = list(redis.get_transaction_names(project))
                new_rules = []
                if len(tx_names) >= MERGE_THRESHOLD:
                    clusterer = TreeClusterer(merge_threshold=MERGE_THRESHOLD)
                    clusterer.add_input(tx_names)
                    new_rules = clusterer.get_rules()

                track_clusterer_run(ClustererNamespace.TRANSACTIONS, project)

                # The Redis store may have more up-to-date last_seen values,
                # so we must update the stores to bring these values to
                # project options, even if there aren't any new rules.
                num_rules_added = rules.update_rules(
                    ClustererNamespace.TRANSACTIONS, project, new_rules
                )

                # Track a global counter of new rules:
                metrics.incr("txcluster.new_rules_discovered", num_rules_added)

                # Clear transaction names to prevent the set from picking up
                # noise over a long time range.
                redis.clear_samples(ClustererNamespace.TRANSACTIONS, project)
            pending.remove(project)
            num_clustered += 1
    finally:
        metrics.incr(
            "txcluster.cluster_projects",
            amount=num_clustered,
            tags={"clustered": True},
            sample_rate=1.0,
        )
        unclustered = len(projects) - num_clustered
        if unclustered > 0:
            metrics.incr(
                "txcluster.cluster_projects",
                amount=unclustered,
                tags={"clustered": False},
                sample_rate=1.0,
            )
            logger_transactions.error(
                "Transaction clusterer missed projects",
                extra={
                    "projects.total": len(projects),
                    "projects.unclustered.number": unclustered,
                    "projects.unclustered.ids": [p.id for p in pending],
                },
            )
