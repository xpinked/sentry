import type React from 'react';
import {useState} from 'react';

import {
  FeatureBadge,
  type FeatureBadgeProps,
} from 'sentry/components/core/badge/featureBadge';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {ScreenSummaryContentPage as AppStartPage} from 'sentry/views/insights/mobile/appStarts/views/screenSummaryPage';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {PlatformSelector} from 'sentry/views/insights/mobile/screenload/components/platformSelector';
import {ScreenLoadSpansContent as ScreenLoadPage} from 'sentry/views/insights/mobile/screenload/views/screenLoadSpansPage';
import {ScreenSummaryContent as UiPage} from 'sentry/views/insights/mobile/ui/views/screenSummaryPage';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {ModuleName} from 'sentry/views/insights/types';

type Query = {
  project: string;
  tab: string | undefined;
  transaction: string;
};

export type TabKey = 'app_start' | 'screen_load' | 'screen_rendering';

type Tab = {
  content: () => React.ReactNode;
  key: TabKey;
  label: string;
  feature?: string;
  featureBadge?: FeatureBadgeProps['type'];
};

function ScreenDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation<Query>();
  const organization = useOrganization();
  const {isProjectCrossPlatform} = useCrossPlatformProject();

  const {transaction: transactionName} = location.query;
  const moduleName = ModuleName.MOBILE_VITALS;

  const tabs: Tab[] = [
    {
      key: 'app_start',
      label: t('App Start'),
      content: () => {
        return <AppStartPage key={'app_start'} />;
      },
    },
    {
      key: 'screen_load',
      label: t('Screen Load'),
      content: () => {
        return <ScreenLoadPage key={'screen_load'} />;
      },
    },
    {
      key: 'screen_rendering',
      label: t('Screen Rendering'),
      featureBadge: 'experimental',
      content: () => {
        return <UiPage key={'screen_rendering'} />;
      },
    },
  ];

  const getTabKeyFromQuery = () => {
    const queryTab = decodeScalar(location?.query?.tab);
    const selectedTab = tabs.find((tab: Tab) => tab.key === queryTab);
    return selectedTab?.key ?? tabs[0]!.key;
  };

  const [selectedTabKey, setSelectedTabKey] = useState(getTabKeyFromQuery());
  const moduleURL = useModuleURL(moduleName);

  function handleTabChange(tabKey: string) {
    setSelectedTabKey(tabKey as TabKey);

    const newQuery = {...location.query, tab: tabKey};

    navigate({
      pathname: location.pathname,
      query: newQuery,
    });
  }

  const tabList = (
    <TabList hideBorder>
      {tabs.map(tab => {
        const visible =
          tab.feature === undefined || organization.features.includes(tab.feature);
        return (
          <TabList.Item key={tab.key} hidden={!visible} textValue={tab.label}>
            {tab.label}
            {tab.featureBadge && <FeatureBadge type={tab.featureBadge} />}
          </TabList.Item>
        );
      })}
    </TabList>
  );

  return (
    <PageFiltersContainer>
      <SentryDocumentTitle title={t('Mobile Vitals')} orgSlug={organization.slug} />
      <Layout.Page>
        <PageAlertProvider>
          <Tabs value={selectedTabKey} onChange={tabKey => handleTabChange(tabKey)}>
            <MobileHeader
              module={moduleName}
              hideDefaultTabs
              tabs={{tabList, value: selectedTabKey, onTabChange: handleTabChange}}
              headerActions={isProjectCrossPlatform && <PlatformSelector />}
              headerTitle={transactionName}
              breadcrumbs={[
                {
                  label: t('Mobile Vitals'),
                  to: moduleURL,
                },
                {
                  label: t('Screen Summary'),
                },
              ]}
            />
            <Layout.Body>
              <Layout.Main fullWidth>
                <PageAlert />
                {tabs.filter(tab => tab.key === selectedTabKey).map(tab => tab.content())}
              </Layout.Main>
            </Layout.Body>
          </Tabs>
        </PageAlertProvider>
      </Layout.Page>
    </PageFiltersContainer>
  );
}

export default ScreenDetailsPage;
