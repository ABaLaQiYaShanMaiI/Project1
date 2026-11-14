import { useSyncExternalStore } from 'react';
import { store } from './store';

export function useStore(): number {
  return useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
}

export { store };
