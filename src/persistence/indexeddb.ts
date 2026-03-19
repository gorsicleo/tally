const DB_NAME = 'tally-db'
const STORE_NAME = 'app-state'
const DB_VERSION = 1

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to open IndexedDB.'))
    }

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }
  })
}

export async function readIndexedDbValue<T>(key: string): Promise<T | null> {
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(key)

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to read IndexedDB value.'))
    }

    request.onsuccess = () => {
      resolve((request.result as T | undefined) ?? null)
    }
  })
}

export async function writeIndexedDbValue<T>(
  key: string,
  value: T,
): Promise<void> {
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    transaction.onerror = () => {
      reject(transaction.error ?? new Error('Failed to write IndexedDB value.'))
    }

    transaction.oncomplete = () => {
      resolve()
    }

    store.put(value, key)
  })
}
