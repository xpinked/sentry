from __future__ import annotations

from dataclasses import dataclass

from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.ratelimits.sliding_windows import Quota
from sentry.types.group import PriorityLevel
from sentry.uptime.types import (
    GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE,
    ProjectUptimeSubscriptionMode,
)
from sentry.workflow_engine.types import DetectorSettings


@dataclass(frozen=True)
class UptimeDomainCheckFailure(GroupType):
    type_id = 7001
    slug = GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE
    description = "Uptime Domain Monitor Failure"
    category = GroupCategory.UPTIME.value
    category_v2 = GroupCategory.OUTAGE.value
    creation_quota = Quota(3600, 60, 1000)  # 1000 per hour, sliding window of 60 seconds
    default_priority = PriorityLevel.HIGH
    enable_auto_resolve = False
    enable_escalation_detection = False
    detector_settings = DetectorSettings(
        config_schema={
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "description": "A representation of an uptime alert",
            "type": "object",
            "required": ["mode", "environment"],
            "properties": {
                "mode": {
                    "type": ["integer"],
                    "enum": [mode.value for mode in ProjectUptimeSubscriptionMode],
                },
                "environment": {"type": ["string", "null"]},
            },
            "additionalProperties": False,
        },
    )
