import { run, STORE_MEDIA } from '../storage/db'

/** Blob storage, keyed by content hash. */
export async function putBlob(hash: string, blob: Blob): Promise<void> {
  await run(STORE_MEDIA, 'readwrite', (store) => store.put(blob, hash))
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
