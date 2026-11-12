import { useCallback, useEffect, useState } from 'react'
import { offlineQueue } from '@/lib/offline/local'
import type { OfflineOp, SyncReport } from '@/lib/offline/queue'
import { sendOp } from '@/lib/offline/remote'

export { offlineQueue }

const SYNC_INTERVAL_MS = 30_000

/**
 * Estado da conexão e da fila de envio. Envia automaticamente quando a conexão volta,
 * quando o app volta a ficar visível e a cada 30 s enquanto estiver aberto.
 * `unlocked`: os dados offline só ficam acessíveis depois do PIN.
 */
export function useOfflineSync(ownerId: string | null, unlocked: boolean) {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [ops, setOps] = useState<OfflineOp[]>([])
  const [syncing, setSyncing] = useState(false)
  const [lastReport, setLastReport] = useState<SyncReport | null>(null)

  const refresh = useCallback(async () => {
    if (!unlocked) {
      setOps([])
      return
    }
    setOps(await offlineQueue.list())
  }, [unlocked])

  const sync = useCallback(async (): Promise<SyncReport | null> => {
    if (!ownerId || !unlocked) return null
    if (typeof navigator !== 'undefined' && !navigator.onLine) return null
    setSyncing(true)
    try {
      const report = await offlineQueue.sync(sendOp, ownerId)
      setLastReport(report)
      return report
    } finally {
      setSyncing(false)
      await refresh()
    }
  }, [refresh, ownerId, unlocked])

  useEffect(() => {
    void refresh()
    void sync()

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
