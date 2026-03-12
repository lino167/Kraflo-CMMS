/**
 * AI Assistant service for maintenance queries
 */

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '../infra/config.ts';
import { logger } from '../infra/logger.ts';

export interface IAResponse {
  resposta: string;
  fontes?: {
    manuais_consultados: number;
    os_similares: number;
  };
  error?: string;
}

/**
 * Query the AI maintenance assistant
 */
export async function queryAssistant(
  question: string,
  tecnicoId: number,
  empresaId: string
): Promise<IAResponse> {
  const url = `${SUPABASE_URL}/functions/v1/assistente-ia`;
  
  logger.iaQuery(tecnicoId, question);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mensagem: question,
        tecnico_id: tecnicoId,
        empresa_id: empresaId,
      }),
    });

    logger.info('IA response received', { 
      status: response.status, 
      userId: tecnicoId 
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const errorMsg = data.error || `HTTP ${response.status}`;
      logger.error('IA error response', null, { errorMsg, userId: tecnicoId });
      return { resposta: '', error: errorMsg };
    }

    return {
      resposta: data.resposta,
      fontes: data.fontes,
    };
  } catch (error) {
    logger.error('IA exception', error, { userId: tecnicoId });
    return { resposta: '', error: 'Erro ao consultar o assistente' };
  }
}
