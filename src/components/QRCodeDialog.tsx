import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Download, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export interface QRCodeItem {
  /** Rótulo da aba, ex.: "Histórico" */
  label: string
  /** Texto de apoio exibido sob o QR */
  hint: string
  url: string
}

interface QRCodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  items: QRCodeItem[]
}

function useQRDataUrl(url: string) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setDataUrl(null)
    QRCode.toDataURL(url, { width: 512, margin: 2, errorCorrectionLevel: 'M' })
      .then((d) => {
        if (!cancelled) setDataUrl(d)
      })
      .catch(() => {
        if (!cancelled) toast.error('Não foi possível gerar o QR code')
      })
    return () => {
      cancelled = true
    }
  }, [url])

  return dataUrl
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

function QRPanel({ item, title, subtitle }: { item: QRCodeItem; title: string; subtitle?: string }) {
  const dataUrl = useQRDataUrl(item.url)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(item.url)
      toast.success('Link copiado')
    } catch {
      toast.error('Não foi possível copiar o link')
    }
  }

  const handleDownload = () => {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `qr-${title.replace(/[^\w-]+/g, '_')}-${item.label.toLowerCase()}.png`
    a.click()
  }

  const handlePrint = () => {
    if (!dataUrl) return
    const w = window.open('', '_blank', 'width=420,height=560')
    if (!w) {
      toast.error('Permita pop-ups para imprimir a etiqueta')
      return
    }
    w.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title>
      <style>
        body{font-family:system-ui,sans-serif;text-align:center;margin:24px;color:#000}
        img{width:260px;height:260px}
        h1{font-size:20px;margin:8px 0 2px}
        p{margin:2px 0;font-size:12px}
      </style></head><body>
      <img src="${dataUrl}" alt="QR code" />
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
      <p>${escapeHtml(item.hint)}</p>
      </body></html>`)
    w.document.close()
    w.onload = () => w.print()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center rounded-xl bg-white p-4">
        {dataUrl ? (
          <img src={dataUrl} alt={`QR code: ${item.hint}`} className="h-56 w-56" />
        ) : (
          <div className="h-56 w-56 animate-pulse rounded bg-neutral-200" />
        )}
      </div>
      <p className="text-center text-sm text-muted-foreground">{item.hint}</p>
      <p className="break-all rounded-lg bg-secondary/30 p-2 text-center font-mono text-[11px] text-muted-foreground">
        {item.url}
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          <Copy className="mr-1.5 h-4 w-4" /> Copiar
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload} disabled={!dataUrl}>
          <Download className="mr-1.5 h-4 w-4" /> PNG
        </Button>
        <Button size="sm" onClick={handlePrint} disabled={!dataUrl}>
          <Printer className="mr-1.5 h-4 w-4" /> Imprimir
        </Button>
      </div>
    </div>
  )
}

export function QRCodeDialog({ open, onOpenChange, title, subtitle, items }: QRCodeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel border-white/10 sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle || 'Imprima e fixe a etiqueta no local.'}</DialogDescription>
        </DialogHeader>
        {items.length === 1 ? (
          <QRPanel item={items[0]} title={title} subtitle={subtitle} />
        ) : (
          <Tabs defaultValue={items[0]?.label}>
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
              {items.map((item) => (
                <TabsTrigger key={item.label} value={item.label}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {items.map((item) => (
              <TabsContent key={item.label} value={item.label} className="mt-4">
                <QRPanel item={item} title={title} subtitle={subtitle} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
