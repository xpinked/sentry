import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type {NewQuery, SavedQuery} from 'sentry/types/organization';

export function fetchSavedQuery(
  api: Client,
  orgId: string,
  queryId: string
): Promise<SavedQuery> {
  const promise: Promise<SavedQuery> = api.requestPromise(
    `/organizations/${orgId}/discover/saved/${queryId}/`,
    {
      method: 'GET',
    }
  );

  promise.catch(() => {
    addErrorMessage(t('Unable to load saved query'));
  });
  return promise;
}

export function createSavedQuery(
  api: Client,
  orgId: string,
  query: NewQuery
): Promise<SavedQuery> {
  const promise: Promise<SavedQuery> = api.requestPromise(
    `/organizations/${orgId}/discover/saved/`,
    {
      method: 'POST',
      data: query,
    }
  );

  promise.catch(() => {
    addErrorMessage(t('Unable to create your saved query'));
  });
  return promise;
}

export function updateSavedQuery(
  api: Client,
  orgId: string,
  query: NewQuery
): Promise<SavedQuery> {
  const promise: Promise<SavedQuery> = api.requestPromise(
    `/organizations/${orgId}/discover/saved/${query.id}/`,
    {
      method: 'PUT',
      data: query,
    }
  );

  promise.catch(() => {
    addErrorMessage(t('Unable to update your saved query'));
  });
  return promise;
}

export function updateSavedQueryVisit(
  orgId: string,
  queryId: string | string[]
): Promise<void> {
  // Create a new client so the request is not cancelled
  const api = new Client();
  const promise = api.requestPromise(
    `/organizations/${orgId}/discover/saved/${queryId}/visit/`,
    {
      method: 'POST',
    }
  );

  return promise;
}

export function deleteSavedQuery(
  api: Client,
  orgId: string,
  queryId: string
): Promise<void> {
  const promise: Promise<void> = api.requestPromise(
    `/organizations/${orgId}/discover/saved/${queryId}/`,
    {method: 'DELETE'}
  );

  promise.catch(() => {
    addErrorMessage(t('Unable to delete the saved query'));
  });
  return promise;
}
