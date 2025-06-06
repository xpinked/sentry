from django.utils import timezone

from sentry.issues.escalating.escalating import manage_issue_states
from sentry.models.group import Group, GroupStatus
from sentry.models.groupinbox import GroupInboxReason
from sentry.models.groupsnooze import GroupSnooze
from sentry.signals import issue_unignored
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import issues_tasks


@instrumented_task(
    name="sentry.tasks.clear_expired_snoozes",
    time_limit=65,
    soft_time_limit=60,
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=issues_tasks,
        processing_deadline_duration=65,
    ),
)
def clear_expired_snoozes():
    groupsnooze_list = list(
        GroupSnooze.objects.filter(until__lte=timezone.now()).values_list("id", "group", "until")[
            :1000
        ]
    )
    group_snooze_ids = [gs[0] for gs in groupsnooze_list]
    groups_with_snoozes = {gs[1]: {"id": gs[0], "until": gs[2]} for gs in groupsnooze_list}

    ignored_groups = list(
        Group.objects.filter(id__in=groups_with_snoozes.keys(), status=GroupStatus.IGNORED)
    )

    GroupSnooze.objects.filter(id__in=group_snooze_ids).delete()

    for group in ignored_groups:
        manage_issue_states(group, GroupInboxReason.ONGOING)

        issue_unignored.send_robust(
            project=group.project,
            user_id=None,
            group=group,
            transition_type="automatic",
            sender="clear_expired_snoozes",
        )
