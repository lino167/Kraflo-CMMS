/**
 * Serviço de detecção de reincidência para alertar técnicos
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface ReincidenciaCheck {
  encontrou: boolean;
  total_recentes: number;
  dias_limite?: number;
  ultima_os?: {
    id: number;
    descricao_problema: string | null;
    diagnostico_solucao: string | null;
    data_fechamento: string;
    tecnico_id: number;
    tecnico_nome: string | null;
    dias_desde_fechamento: number;
  };
}

/**
 * Verifica se existe histórico recente para a TAG especificada
 */
export async function checkReincidencia(
  supabase: SupabaseClient,
  empresaId: string,
  tag: string,
  diasLimite = 60
): Promise<ReincidenciaCheck> {
  const { data, error } = await supabase.rpc("fn_check_reincidencia", {
    p_empresa_id: empresaId,
    p_tag: tag,
    p_dias_limite: diasLimite,
  });

  if (error) {
    console.error("Erro ao verificar reincidência:", error);
    return { encontrou: false, total_recentes: 0 };
  }

  return data as ReincidenciaCheck;
}

/**
 * Formata mensagem de alerta de reincidência para o Telegram
 */
export function formatReincidenciaAlert(check: ReincidenciaCheck, tag: string): string {
  if (!check.encontrou || !check.ultima_os) {
    return "";
  }

  const os = check.ultima_os;
  const diasDesde = Math.round(os.dias_desde_fechamento);
  
  let alerta = `⚠️ *ATENÇÃO - Histórico Detectado!*\n\n`;
  alerta += `A máquina *${tag}* teve ${check.total_recentes} `;
  alerta += `ocorrência${check.total_recentes > 1 ? "s" : ""} nos últimos ${check.dias_limite} dias.\n\n`;
  
  if (os.diagnostico_solucao) {
    alerta += `📋 *Última solução:* ${os.diagnostico_solucao.substring(0, 150)}${os.diagnostico_solucao.length > 150 ? "..." : ""}\n`;
  }
  
  if (os.tecnico_nome) {
    alerta += `👤 *Técnico:* ${os.tecnico_nome}\n`;
  }
  
  alerta += `⏱️ *Há:* ${diasDesde} dia${diasDesde !== 1 ? "s" : ""}\n\n`;
  
  if (diasDesde < 7) {
    alerta += `🔴 *Reincidência Crítica!* A solução anterior durou apenas ${diasDesde} dias. `;
    alerta += `Verifique se a causa raiz foi tratada.\n\n`;
  } else if (diasDesde < 30) {
    alerta += `🟠 *Reincidência Detectada.* Considere revisar a solução anterior.\n\n`;
  }
  
  alerta += `Deseja prosseguir com a abertura?`;
  
  return alerta;
}
