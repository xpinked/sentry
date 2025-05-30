import {createContext, useContext} from 'react';

import type {Configuration} from 'sentry/components/devtoolbar/types';

const Context = createContext<Configuration>({
  apiPrefix: '',
  environment: ['production'],
  featureFlags: {},
  organizationSlug: '',
  placement: 'right-edge',
  projectId: 0,
  projectPlatform: '',
  projectSlug: '',
});

export function ConfigurationContextProvider({
  children,
  config,
}: {
  children: React.ReactNode;
  config: Configuration;
}) {
  return <Context value={config}>{children}</Context>;
}

export default function useConfiguration() {
  return useContext(Context);
}
