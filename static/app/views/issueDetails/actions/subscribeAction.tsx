import {Button} from 'sentry/components/core/button';
import {IconSubscribed} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {getSubscriptionReason} from 'sentry/views/issueDetails/utils';

type Props = {
  group: Group;
  onClick: (event: React.MouseEvent) => void;
  className?: string;
  /**
   * Disables the primary color scheme when subscribed
   */
  disablePriority?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  size?: 'xs' | 'sm';
};

function SubscribeAction({
  className,
  disabled,
  group,
  icon,
  onClick,
  disablePriority,
  size = 'xs',
}: Props) {
  const disabledNotifications = group.subscriptionDetails?.disabled ?? false;

  return (
    <Button
      className={className}
      disabled={disabled || disabledNotifications}
      title={getSubscriptionReason(group)}
      tooltipProps={{delay: 300}}
      priority={!disablePriority && group.isSubscribed ? 'primary' : 'default'}
      size={size}
      aria-label={t('Subscribe')}
      onClick={onClick}
      icon={icon ?? <IconSubscribed size={size} />}
    />
  );
}

export default SubscribeAction;
