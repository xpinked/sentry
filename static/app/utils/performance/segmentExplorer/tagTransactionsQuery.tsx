import type {MetaType} from 'sentry/utils/discover/eventView';
import type {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {GenericDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';

type TableDataRow = {
  [key: string]: string | number;
  id: string;
};

type TableData = {
  data: TableDataRow[];
  meta?: MetaType;
};

type QueryProps = DiscoverQueryProps & {
  children: (props: GenericChildrenProps<TableData>) => React.ReactNode;
  query: string;
};

function shouldRefetchData(prevProps: QueryProps, nextProps: QueryProps) {
  return prevProps.query !== nextProps.query;
}

function TagTransactionsQuery(props: QueryProps) {
  return (
    <GenericDiscoverQuery<TableData, QueryProps>
      route="events"
      shouldRefetchData={shouldRefetchData}
      {...props}
    />
  );
}

export default TagTransactionsQuery;
