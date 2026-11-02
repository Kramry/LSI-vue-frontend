export interface QueuedScan {
  id: string
  qr_code: string
  scan_action: 'in' | 'out'
  class_id: number
  schedule_id: number | null
  queued_at: string
}

const DATABASE_NAME = 'lsi-smarttrack'
const STORE_NAME = 'attendance-scans'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Unable to open the offline scan queue.'))
  })
}

export async function listQueuedScans(): Promise<QueuedScan[]> {
  const database = await openDatabase()
  return new Promise<QueuedScan[]>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve((request.result as QueuedScan[]).sort((a, b) => a.queued_at.localeCompare(b.queued_at)))
    request.onerror = () => reject(request.error || new Error('Unable to read pending scans.'))
  }).finally(() => database.close())
}

export async function enqueueScan(scan: Omit<QueuedScan, 'id' | 'queued_at'>): Promise<void> {
  const database = await openDatabase()
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).add({
      ...scan,
      id: crypto.randomUUID(),
      queued_at: new Date().toISOString()
    } satisfies QueuedScan)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error('Unable to save the scan for syncing.'))
    transaction.onabort = () => reject(transaction.error || new Error('The offline scan could not be saved.'))
  }).finally(() => database.close())
}

export async function removeQueuedScan(id: string): Promise<void> {
  const database = await openDatabase()
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error('Unable to remove the synced scan.'))
    transaction.onabort = () => reject(transaction.error || new Error('Unable to remove the synced scan.'))
  }).finally(() => database.close())
}
