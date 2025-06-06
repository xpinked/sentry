import {Fragment} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {IconMegaphone} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {Divider} from 'sentry/views/issueDetails/divider';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

export function UserFeedbackBadge({group, project}: {group: Group; project: Project}) {
  const {baseUrl} = useGroupDetailsRoute();

  const issueTypeConfig = getConfigForIssueType(group, project);

  if (!issueTypeConfig.pages.userFeedback.enabled || group.userReportCount <= 0) {
    return null;
  }

  return (
    <Fragment>
      <Divider />
      <UserFeedbackButton
        type="button"
        priority="link"
        icon={<IconMegaphone size="xs" />}
        to={{
          pathname: `${baseUrl}${TabPaths[Tab.USER_FEEDBACK]}`,
        }}
        replace
        aria-label={t("View this issue's feedback")}
      >
        {tn('%s User Report', '%s User Reports', group.userReportCount)}
      </UserFeedbackButton>
    </Fragment>
  );
}

const UserFeedbackButton = styled(LinkButton)`
  color: ${p => p.theme.subText};
  text-decoration: underline;
  text-decoration-style: dotted;
`;
