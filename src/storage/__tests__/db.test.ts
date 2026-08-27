/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Workout } from '../../engine'
import { SCHEMA_VERSION } from '../../engine'

/**
 * A hand-rolled sliver of IndexedDB: open with scripted outcomes, one-request
 * transactions, and a connection that can be killed behind the caller's back.
 * Enough to prove the self-healing paths, which real browsers only exercise
 * under memory pressure or on iOS.
 */
type FakeRequest = {
  result: unknown
  error: Error | null
  onsuccess: (() => void) | null
  onerror: (() => void) | null
  onupgradeneeded: (() => void) | null
}

function fakeRequest(result: unknown, error: Error | null = null): FakeRequest {
  const request: FakeRequest = { result, error, onsuccess: null, onerror: null, onupgradeneeded: null }
  queueMicrotask(() => {
    if (error) request.onerror?.()
    else request.onsuccess?.()
  })
  return request
}

function named(name: string): Error {
  const error = new Error(name)
  error.name = name
  return error
}

type FakeDb = {
  dead: boolean
  rows: Map<string, unknown>
  onclose: (() => void) | null
  onversionchange: (() => void) | null
  close: () => void
  transaction: (
    store: string,
    mode: string,
  ) => { objectStore: (name: string) => unknown; oncomplete: (() => void) | null }
  objectStoreNames: { contains: (name: string) => boolean }
}

function makeDb(): FakeDb {
  const rows = new Map<string, unknown>()
  const db: FakeDb = {
    dead: false,
    rows,
    onclose: null,
    onversionchange: null,
    close: () => {},
    objectStoreNames: { contains: () => true },
    transaction: () => {
      // iOS kills idle connections without firing onclose; the corpse only
      // shows itself here, as an InvalidStateError.
      if (db.dead) throw named('InvalidStateError')
      // A write's transaction completes a tick after its request succeeds, as
      // the real one does; `run` waits for that on a readwrite.
      const tx: { objectStore: (name: string) => unknown; oncomplete: (() => void) | null } = {
        oncomplete: null,
        objectStore: () => ({
          put: (value: unknown, key?: string) => {
            const id = key ?? (value as { id: string }).id
            rows.set(id, value)
            return commit(fakeRequest(id))
          },
          add: (value: unknown) => {
            const id = (value as { id: string }).id
            if (rows.has(id)) return fakeRequest(undefined, named('ConstraintError'))
            rows.set(id, value)
            return commit(fakeRequest(id))
          },
          get: (key: string) => fakeRequest(rows.get(key)),
          getAll: () => fakeRequest([...rows.values()]),
        }),
      }
      const commit = (request: FakeRequest): FakeRequest => {
        queueMicrotask(() => queueMicrotask(() => tx.oncomplete?.()))
        return request
      }
      return tx
    },
  }
  return db
}

/** Scripted opens: each entry is a fresh connection, an open failure, or a synchronous throw. */
let opens: Array<FakeDb | 'fail' | 'throw'>
let opened: FakeDb[]

function stubIndexedDb() {
  opened = []
  vi.stubGlobal('indexedDB', {
    open: () => {
      const plan = opens.shift()
      if (plan === undefined) throw new Error('test opened the database more often than scripted')
      if (plan === 'fail') return fakeRequest(undefined, named('UnknownError'))
      // What a browser does with site data blocked, or in a sandboxed frame.
      if (plan === 'throw') throw named('SecurityError')
      opened.push(plan)
      return fakeRequest(plan)
    },
  })
}

const routine = (id: string, name: string): Workout => ({
  id,
  name,
  blocks: [],
  schemaVersion: SCHEMA_VERSION,
  createdAt: 1,
  updatedAt: 1,
})

describe('db self-healing', () => {
  beforeEach(() => {
    vi.resetModules()
    stubIndexedDb()
  })

  it('retries after a failed open instead of caching the rejection forever', async () => {
    opens = ['fail', makeDb()]
    const { run, STORE_WORKOUTS } = await import('../db')

    // The transient failure surfaces once. Before the fix it was memoized and
    // every later call for the whole session failed with this same error.
    await expect(
      run(STORE_WORKOUTS, 'readonly', (store) => (store as { getAll: () => IDBRequest }).getAll()),
    ).rejects.toThrow('UnknownError')

    await expect(
      run(STORE_WORKOUTS, 'readonly', (store) => (store as { getAll: () => IDBRequest }).getAll()),
    ).resolves.toEqual([])
  })

  it('retries after open threw synchronously, the same as after it failed', async () => {
    opens = ['throw', makeDb()]
    const { run, STORE_WORKOUTS } = await import('../db')
    const read = () =>
      run(STORE_WORKOUTS, 'readonly', (store) => (store as { getAll: () => IDBRequest }).getAll())

    // The throw rejects the promise inside the executor, where `onerror` never
    // runs. Before the fix that rejection stayed cached for the session.
    await expect(read()).rejects.toThrow('SecurityError')
    await expect(read()).resolves.toEqual([])
  })

  it('reopens and retries when the connection died without warning', async () => {
    const first = makeDb()
    const second = makeDb()
    opens = [first, second]
    const { run, STORE_WORKOUTS } = await import('../db')

    await run(STORE_WORKOUTS, 'readwrite', (store) =>
      (store as { put: (v: unknown) => IDBRequest }).put(routine('w1', 'Kept')),
    )

    first.dead = true

    // The dead handle throws on transaction(); the write must land on a fresh
    // connection rather than silently failing for the rest of the session.
    await run(STORE_WORKOUTS, 'readwrite', (store) =>
      (store as { put: (v: unknown) => IDBRequest }).put(routine('w2', 'Saved after the kill')),
    )
    expect(second.rows.has('w2')).toBe(true)
  })

  it('drops the cached connection when the browser closes it', async () => {
    const first = makeDb()
    const second = makeDb()
    opens = [first, second]
    const { openDb } = await import('../db')

    await openDb()
    expect(first.onclose).not.toBeNull()
    first.onclose?.()

    await openDb()
    expect(opened).toHaveLength(2)
  })
})

describe('readWorkouts', () => {
  beforeEach(() => {
    vi.resetModules()
    stubIndexedDb()
  })

  it('skips a record it cannot read, counts it, and leaves it in the store', async () => {
    const db = makeDb()
    opens = [db]
    const { readWorkouts, saveWorkout } = await import('../workouts')
    await saveWorkout(routine('ok', 'Readable'), 1)
    // A development build's write, or a corrupted row: no block list at all,
    // and a group with no children. Either used to throw out of the list and
    // take every routine down with it.
    db.rows.set('bad-1', { id: 'bad-1', name: 'No blocks', schemaVersion: SCHEMA_VERSION })
    db.rows.set('bad-2', {
      ...routine('bad-2', 'Childless group'),
      blocks: [{ kind: 'repeat', id: 'r', times: 2 }],
    })

    const { workouts, unreadable } = await readWorkouts()
    expect(workouts.map((w) => w.name)).toEqual(['Readable'])
    expect(unreadable).toBe(2)
    expect(db.rows.size).toBe(3)
  })
})

describe('addWorkoutIfMissing', () => {
  beforeEach(() => {
    vi.resetModules()
    stubIndexedDb()
  })

  it('adds a missing routine and refuses to overwrite an existing id', async () => {
    const db = makeDb()
    opens = [db]
    const { addWorkoutIfMissing, saveWorkout } = await import('../workouts')

    expect(await addWorkoutIfMissing(routine('seed-1', 'Pristine seed'), 10)).toBe(true)

    // The user edits the seeded copy; a later lost localStorage marker makes
    // the app try to seed again. The edit must survive.
    await saveWorkout({ ...routine('seed-1', 'Edited by hand') }, 20)
    expect(await addWorkoutIfMissing(routine('seed-1', 'Pristine seed'), 30)).toBe(false)
    expect((db.rows.get('seed-1') as Workout).name).toBe('Edited by hand')
  })
})
