import type {DataConditionGroup} from 'sentry/types/workflowEngine/dataConditions';

interface NewAutomation {
  actionFilters: DataConditionGroup[];
  detectorIds: string[];
  name: string;
  triggers: DataConditionGroup;
  disabled?: boolean;
}

export interface Automation extends Readonly<NewAutomation> {
  readonly id: string;
  readonly lastTriggered: string;
}
