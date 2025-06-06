import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Flex} from 'sentry/components/container/flex';
import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Checkbox} from 'sentry/components/core/checkbox';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import Placeholder from 'sentry/components/placeholder';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {
  makeDetailedProjectQueryKey,
  useDetailedProject,
} from 'sentry/utils/useDetailedProject';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {formatSeerValue, SEER_THRESHOLD_MAP} from 'sentry/views/settings/projectSeer';

const PROJECTS_PER_PAGE = 20;

function ProjectSeerSetting({project, orgSlug}: {orgSlug: string; project: Project}) {
  const detailedProject = useDetailedProject({
    orgSlug,
    projectSlug: project.slug,
  });

  if (detailedProject.isPending) {
    return (
      <div>
        <Placeholder height="12px" width="50px" />
      </div>
    );
  }

  if (detailedProject.isError) {
    return <div>Error</div>;
  }

  return (
    <SeerValue>{formatSeerValue(detailedProject.data.autofixAutomationTuning)}</SeerValue>
  );
}

export function SeerAutomationProjectList() {
  const organization = useOrganization();
  const api = useApi({persistInFlight: true});
  const {projects, fetching, fetchError} = useProjects();
  const projectsWithWriteAccess = projects.filter(p =>
    hasEveryAccess(['project:write'], {organization, project: p})
  );
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const queryClient = useQueryClient();

  if (fetching) {
    return <LoadingIndicator />;
  }

  if (fetchError) {
    return <LoadingError />;
  }

  const totalProjects = projects.length;
  const pageStart = (page - 1) * PROJECTS_PER_PAGE;
  const pageEnd = page * PROJECTS_PER_PAGE;
  const paginatedProjects = projects.slice(pageStart, pageEnd);

  const previousDisabled = page <= 1;
  const nextDisabled = pageEnd >= totalProjects;

  const goToPrevPage = () => {
    setPage(p => p - 1);
  };

  const goToNextPage = () => {
    setPage(p => p + 1);
  };

  const allSelected = selected.size === projects.length && projects.length > 0;
  const toggleSelectAll = () => {
    if (allSelected) {
      // Unselect all projects
      setSelected(new Set());
    } else {
      // Select all projects
      setSelected(new Set(projects.map(project => project.id)));
    }
  };

  const toggleProject = (projectId: string) => {
    setSelected(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  async function updateProjectsSeerValue(value: string) {
    addLoadingMessage('Updating projects...', {duration: 30000});
    try {
      await Promise.all(
        Array.from(selected).map(projectId => {
          const project = projects.find(p => p.id === projectId);
          if (!project) return Promise.resolve();
          return api.requestPromise(`/projects/${organization.slug}/${project.slug}/`, {
            method: 'PUT',
            data: {autofixAutomationTuning: value},
          });
        })
      );
      addSuccessMessage('Projects updated successfully');
    } catch (err) {
      addErrorMessage('Failed to update some projects');
    } finally {
      Array.from(selected).forEach(projectId => {
        const project = projects.find(p => p.id === projectId);
        if (!project) return;
        queryClient.invalidateQueries({
          queryKey: makeDetailedProjectQueryKey({
            orgSlug: organization.slug,
            projectSlug: project.slug,
          }),
        });
      });
    }
  }

  const actionMenuItems = SEER_THRESHOLD_MAP.map(key => ({
    key,
    label: formatSeerValue(key),
    onAction: () => updateProjectsSeerValue(key),
  }));

  return (
    <Fragment>
      <Panel>
        <PanelHeader>
          {selected.size > 0 ? (
            <ActionDropdownMenu
              items={actionMenuItems}
              triggerLabel={t('Set to')}
              size="sm"
            />
          ) : (
            <div>{t('Current Project Settings')}</div>
          )}
          <div style={{marginLeft: 'auto'}}>
            <Button size="sm" onClick={toggleSelectAll}>
              {allSelected ? t('Unselect All') : t('Select All')}
            </Button>
          </div>
        </PanelHeader>
        <PanelBody>
          {paginatedProjects.map(project => (
            <PanelItem key={project.id}>
              <Flex justify="space-between" gap={space(2)} flex={1}>
                <Flex gap={space(1)} align="center">
                  <Tooltip
                    title={t('You do not have permission to edit this project')}
                    disabled={projectsWithWriteAccess.includes(project)}
                  >
                    <Checkbox
                      checked={selected.has(project.id)}
                      onChange={() => toggleProject(project.id)}
                      aria-label={t('Toggle project')}
                      disabled={!projectsWithWriteAccess.includes(project)}
                    />
                  </Tooltip>
                  <ProjectAvatar project={project} title={project.slug} />
                  <Link
                    to={`/settings/${organization.slug}/projects/${project.slug}/seer/`}
                  >
                    {project.slug}
                  </Link>
                </Flex>
                <ProjectSeerSetting project={project} orgSlug={organization.slug} />
              </Flex>
            </PanelItem>
          ))}
        </PanelBody>
      </Panel>
      {totalProjects > PROJECTS_PER_PAGE && (
        <Flex justify="flex-end">
          <ButtonBar merged>
            <Button
              icon={<IconChevron direction="left" />}
              aria-label={t('Previous')}
              size="sm"
              disabled={previousDisabled}
              onClick={goToPrevPage}
            />
            <Button
              icon={<IconChevron direction="right" />}
              aria-label={t('Next')}
              size="sm"
              disabled={nextDisabled}
              onClick={goToNextPage}
            />
          </ButtonBar>
        </Flex>
      )}
    </Fragment>
  );
}

const SeerValue = styled('div')`
  color: ${p => p.theme.subText};
`;

const ActionDropdownMenu = styled(DropdownMenu)`
  [data-test-id='menu-list-item-label'] {
    font-weight: normal;
    text-transform: none;
  }
`;
