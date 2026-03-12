/**
 * Categories for OS opening (stop reasons) and closing (root causes)
 * These speed up the workflow by providing quick selection options
 */

// Categorias de Paradas (Motivo do Chamado) - Para abertura da OS
export const STOP_CATEGORIES = [
  {
    id: 'parada_trama',
    label: '🧵 Parada de Trama',
    description: 'Falhas em acumuladores, bicos, pinças, ruptura de trama',
  },
  {
    id: 'parada_urdume',
    label: '📏 Parada de Urdume',
    description: 'Problemas com fios do rolo, lamelas, tensão',
  },
  {
    id: 'falha_mecanica',
    label: '⚙️ Falha Mecânica',
    description: 'Quebra física ou travamento de componentes',
  },
  {
    id: 'qualidade_tecido',
    label: '🔍 Qualidade/Tecido',
    description: 'Máquina rodando mas gerando defeito',
  },
  {
    id: 'eletrica_eletronica',
    label: '⚡ Elétrica/Eletrônica',
    description: 'Erros de painel, sensores ou módulos',
  },
  {
    id: 'utilidades',
    label: '🔧 Utilidades',
    description: 'Infraestrutura: ar comprimido, óleo, etc',
  },
] as const;

// Categorias de Problemas (Causa Raiz) - Para fechamento da OS
export const ROOT_CAUSE_CATEGORIES = [
  {
    id: 'ajuste_regulagem',
    label: '🔧 Ajuste/Regulagem',
    description: 'Máquina desregulada, sem troca de peça',
  },
  {
    id: 'desgaste_quebra',
    label: '💔 Desgaste/Quebra',
    description: 'Peça danificada que foi trocada ou reparada',
  },
  {
    id: 'limpeza_higiene',
    label: '🧹 Limpeza/Higiene',
    description: 'Parou por sujeira, borra ou resíduos',
  },
  {
    id: 'falha_operacional',
    label: '👤 Falha Operacional',
    description: 'Erro humano, procedimento incorreto',
  },
  {
    id: 'eletrico_sensor',
    label: '⚡ Elétrico/Sensor',
    description: 'Cabos, conectores, sensores, placas',
  },
  {
    id: 'materia_prima',
    label: '🧶 Matéria-Prima',
    description: 'Problema no fio ou bobina, não na máquina',
  },
] as const;

// Helper para construir teclado inline de categorias de parada
export function buildStopCategoryKeyboard() {
  return {
    inline_keyboard: [
      ...STOP_CATEGORIES.map((cat) => [
        { text: cat.label, callback_data: `stop_cat_${cat.id}` },
      ]),
      [{ text: '❌ Cancelar', callback_data: 'cancel' }],
    ],
  };
}

// Helper para construir teclado inline de causa raiz
export function buildRootCauseKeyboard() {
  return {
    inline_keyboard: [
      ...ROOT_CAUSE_CATEGORIES.map((cat) => [
        { text: cat.label, callback_data: `cause_cat_${cat.id}` },
      ]),
      [{ text: '❌ Cancelar', callback_data: 'cancel' }],
    ],
  };
}

// Obter label da categoria de parada pelo ID
export function getStopCategoryLabel(id: string): string {
  const cat = STOP_CATEGORIES.find((c) => c.id === id);
  return cat?.label.replace(/^[^\s]+\s/, '') || id; // Remove emoji prefix
}

// Obter label da causa raiz pelo ID
export function getRootCauseLabel(id: string): string {
  const cat = ROOT_CAUSE_CATEGORIES.find((c) => c.id === id);
  return cat?.label.replace(/^[^\s]+\s/, '') || id; // Remove emoji prefix
}
