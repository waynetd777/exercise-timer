/**
 * IndexedDB, opened once and shared.
 *
 * Two stores from the start, so phase 4's media work is an addition rather than
 * a migration:
 *   - `workouts` keyed by `Workout.id`
 *   - `media`    keyed by the sha256 of the blob (content-addressed, so an
 *                image reused across routines is stored once)
 *
 * localStorage is not an option here: its ~5MB quota plus base64's 33%
 * inflation cannot hold images.
 */
const DB_NAME = 'exercise-timer'
const DB_VERSION = 1

export const STORE_WORKOUTS = 'workouts'
export const STORE_MEDIA = 'media'

let opening: Promise<IDBDatabase> | null = null

/** Drops the cached connection, so the next call opens a fresh one. */
function forget(): void {
  opening = null
}

export function openDb(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_WORKOUTS)) {
        db.createObjectStore(STORE_WORKOUTS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_MEDIA)) {
        db.createObjectStore(STORE_MEDIA)
      }
    }

    request.onsuccess = () => {
      const db = request.result
      /*
       * The browser can close this connection behind our back: iOS does it to
       * backgrounded pages, and a version change in another tab asks for it.
       * A dead handle must not stay cached, or every write for the rest of the
       * session silently fails.
       */
      db.onclose = forget
      db.onversionchange = () => {
        db.close()
        forget()
      }
      resolve(db)
    }
    request.onerror = () => {
      // A transient failure (locked database, pressure) must not poison every
      // later call. Cleared here so the next call retries the open.
      forget()
      reject(request.error)
    }
  })
  return opening
}

function attempt<T>(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(store, mode)
    const request = action(transaction.objectStore(store))
    request.onsuccess = () => resolve(request.result as T)
    request.onerror = () => reject(request.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

/** What `transaction()` throws when the connection has already been closed. */
function isClosedConnection(cause: unknown): boolean {
  return cause instanceof Error && cause.name === 'InvalidStateError'
}

/** Runs one request in its own transaction and resolves with its result. */
export async function run<T>(
  store: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  try {
    return await attempt<T>(await openDb(), store, mode, action)
  } catch (cause) {
    if (!isClosedConnection(cause)) throw cause
    // iOS can kill the connection without firing onclose, and the corpse only
    // shows itself when a transaction is asked for. Reopen and retry once.
    forget()
    return attempt<T>(await openDb(), store, mode, action)
  }
}

/**
 * Asks the browser not to evict this origin's storage. Without it a routine's
 * saved images can simply disappear under pressure. Best-effort and silent:
 * some browsers grant it automatically, others only after the app is installed.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
