import { run, STORE_MEDIA } from '../storage/db'

type StoredListener = (hash: string) => void
const storedListeners = new Set<StoredListener>()

/**
 * Fires after a blob lands. `resolveMedia` caches misses as well as hits, and a
 * miss stops being true the moment the blob is stored; without this, an image
 * pinned mid-session stays invisible until the next reload.
 */
export function onBlobStored(listener: StoredListener): void {
  storedListeners.add(listener)
}

/** Blob storage, keyed by content hash. */
export async function putBlob(hash: string, blob: Blob): Promise<void> {
  await run(STORE_MEDIA, 'readwrite', (store) => store.put(blob, hash))
  for (const listener of storedListeners) listener(hash)
}

export async function getBlob(hash: string): Promise<Blob | undefined> {
  return run<Blob | undefined>(STORE_MEDIA, 'readonly', (store) => store.get(hash))
}

export async function hasBlob(hash: string): Promise<boolean> {
  return (await run<number>(STORE_MEDIA, 'readonly', (store) => store.count(hash))) > 0
}

export async function storedHashes(): Promise<string[]> {
  const keys = await run<IDBValidKey[]>(STORE_MEDIA, 'readonly', (store) => store.getAllKeys())
  return keys.map(String)
}

export async function deleteBlob(hash: string): Promise<void> {
  await run(STORE_MEDIA, 'readwrite', (store) => store.delete(hash))
}
