import type {SessionApiResponse} from 'sentry/types/organization';

export const getSessionStatusSeries = (
  status: string,
  groups: SessionApiResponse['groups']
) =>
  groups.find(group => group.by['session.status'] === status)?.series['sum(session)'] ??
  [];

export const getCountStatusSeries = (
  status: string,
  groups: SessionApiResponse['groups']
) =>
  groups.find(group => group.by['session.status'] === status)?.series[
    'count_unique(user)'
  ] ?? [];

export const SESSION_HEALTH_CHART_HEIGHT = 322;
