import { useCallback, useEffect, useState } from 'react'
import { idbStore } from '@/lib/offline/store'
import { OfflineQueue, type OfflineOp, type SyncReport } from '@/lib/offline/queue'
import { sendOp } from '@/lib/offline/remote'

/** Fila única do aparelho, compartilhada por todas as telas. */
export const offlineQueue = new OfflineQueue(idbStore)

const SYNC_INTERVAL_MS = 30_000

/**
 * Estado da conexão e da fila de envio. Envia automaticamente quando a conexão volta,
 * quando o app volta a ficar visível e a cada 30 s enquanto estiver aberto.
 */
export function useOfflineSync() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [ops, setOps] = useState<OfflineOp[]>([])
  const [syncing, setSyncing] = useState(false)
  const [lastReport, setLastReport] = useState<SyncReport | null>(null)

  const refresh = useCallback(async () => {
    setOps(await offlineQueue.list())
  }, [])

  const sync = useCallback(async (): Promise<SyncReport | null> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return null
    setSyncing(true)
    try {
      const report = await offlineQueue.sync(sendOp)
      setLastReport(report)
      return report
    } finally {
      setSyncing(false)
      await refresh()
    }
  }, [refresh])

  useEffect(() => {
    void refresh()

    const handleOnline = () => {
      setOnline(true)
      void sync()
    }
    const handleOffline = () => setOnline(false)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void sync()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibility)
    const timer = window.setInterval(() => void sync(), SYNC_INTERVAL_MS)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.clearInterval(timer)
    }
  }, [refresh, sync])

  return { online, ops, syncing, lastReport, sync, refresh }
}
