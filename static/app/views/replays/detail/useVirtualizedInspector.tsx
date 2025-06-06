import type {RefObject} from 'react';
import {useCallback} from 'react';
import type {CellMeasurerCache, List} from 'react-virtualized';

import useVirtualListDimensionChange from 'sentry/views/replays/detail/useVirtualListDimensionChange';

type Opts = {
  cache: CellMeasurerCache;
  expandPathsRef: RefObject<Map<number, Set<string>>>;
  listRef: RefObject<List | null>;
};

export type OnExpandCallback = (
  path: string,
  expandedState: Record<string, boolean>
) => void;

export default function useVirtualizedInspector({cache, listRef, expandPathsRef}: Opts) {
  const {handleDimensionChange} = useVirtualListDimensionChange({cache, listRef});

  return {
    expandPaths: expandPathsRef.current,
    handleDimensionChange: useCallback(
      (index: number, path: string, expandedState: Record<string, boolean>) => {
        const rowState = expandPathsRef.current?.get(index) || new Set();
        if (expandedState[path]) {
          rowState.add(path);
        } else {
          // Collapsed, i.e. its default state, so no need to store state
          rowState.delete(path);
        }
        expandPathsRef.current?.set(index, rowState);
        handleDimensionChange(index);
      },
      [expandPathsRef, handleDimensionChange]
    ),
  };
}
