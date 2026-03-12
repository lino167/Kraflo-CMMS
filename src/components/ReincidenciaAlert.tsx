import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'

interface ReincidenciaData {
  encontrou: boolean
  total_recentes: number
  dias_limite?: number
  ultima_os?: {
    id: number
    descricao_problema: string | null
    diagnostico_solucao: string | null
    data_fechamento: string
    tecnico_id: number
    tecnico_nome: string | null
    dias_desde_fechamento: number
  }
}

interface ReincidenciaAlertProps {
  data: ReincidenciaData
  tag: string
}

export function ReincidenciaAlert({ data, tag }: ReincidenciaAlertProps) {
  if (!data.encontrou || !data.ultima_os) return null

  const dias = Math.round(data.ultima_os.dias_desde_fechamento)
  const isCritica = dias < 7
  const isAlerta = dias < 30

  return (
    <Alert
      className={
        isCritica
          ? 'border-destructive/50 bg-destructive/10'
          : isAlerta
            ? 'border-yellow-500/50 bg-yellow-500/10'
            : 'border-muted'
      }
    >
      <AlertTriangle
        className={`h-4 w-4 ${isCritica ? 'text-destructive' : 'text-yellow-500'}`}
      />
      <AlertTitle className={isCritica ? 'text-destructive' : 'text-yellow-600'}>
        {isCritica ? '🔴 Reincidência Crítica!' : '⚠️ Histórico Detectado'}
      </AlertTitle>
      <AlertDescription className="text-sm space-y-1">
        <p>
          A máquina <strong>{tag}</strong> teve{' '}
          <strong>{data.total_recentes} ocorrência{data.total_recentes > 1 ? 's' : ''}</strong>{' '}
          nos últimos {data.dias_limite} dias.
        </p>
        {data.ultima_os.diagnostico_solucao && (
          <p>
            <strong>Última solução:</strong>{' '}
            {data.ultima_os.diagnostico_solucao.substring(0, 150)}
            {data.ultima_os.diagnostico_solucao.length > 150 ? '...' : ''}
          </p>
        )}
        {data.ultima_os.tecnico_nome && (
          <p>
            <strong>Técnico:</strong> {data.ultima_os.tecnico_nome} — há {dias} dia{dias !== 1 ? 's' : ''}
          </p>
        )}
        {isCritica && (
          <p className="text-destructive font-medium">
            A solução anterior durou apenas {dias} dias. Verifique se a causa raiz foi tratada.
          </p>
        )}
      </AlertDescription>
    </Alert>
  )
}
