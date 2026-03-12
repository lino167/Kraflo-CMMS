import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OS {
  id: number;
  equipamento_nome: string;
  equipamento_tag: string | null;
  status_os: string;
  prioridade: string | null;
  tipo_manutencao: string | null;
  data_abertura: string;
  data_fechamento: string | null;
  descricao_problema: string | null;
  diagnostico_solucao: string | null;
  notas_finais: string | null;
  tecnico_id: number;
  localizacao: string | null;
  categoria_parada_id?: string | null;
  subcategoria_parada_id?: string | null;
  categoria_problema_id?: string | null;
  subcategoria_problema_id?: string | null;
}

interface Tecnico {
  id_telegram: number;
  nome_completo: string;
}

interface DateRange {
  from: Date;
  to: Date;
}

interface CategoryMaps {
  getCategoriaParadaNome: (id: string | null | undefined) => string | null;
  getCategoriaProblemaName: (id: string | null | undefined) => string | null;
  getSubcategoriaName: (id: string | null | undefined) => string | null;
}

export function exportOSListToPDF(
  osList: OS[],
  tecnicos: Tecnico[],
  dateRange: DateRange,
  categoryMaps?: CategoryMaps
) {
  const doc = new jsPDF();

  // Colors
  const primaryColor: [number, number, number] = [245, 158, 11];
  const darkColor: [number, number, number] = [30, 41, 59];
  const grayColor: [number, number, number] = [100, 116, 139];

  // Helper function
  const getTecnicoName = (tecnicoId: number) => {
    const tecnico = tecnicos.find((t) => t.id_telegram === tecnicoId);
    return tecnico?.nome_completo || 'Desconhecido';
  };

  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 220, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('KRAFLO', 14, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Relatório de Ordens de Serviço', 14, 28);

  // Date range badge
  doc.setFillColor(...darkColor);
  doc.roundedRect(120, 10, 75, 15, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(
    `${format(dateRange.from, 'dd/MM/yy')} - ${format(dateRange.to, 'dd/MM/yy')}`,
    125,
    20
  );

  let yPos = 45;

  // Summary Section
  doc.setTextColor(...darkColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo', 14, yPos);

  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.line(14, yPos + 2, 196, yPos + 2);

  yPos += 10;

  // Calculate statistics
  const totalOS = osList.length;
  const osAbertas = osList.filter((os) => os.status_os === 'Aberta').length;
  const osEmManutencao = osList.filter((os) => os.status_os === 'Em manutenção').length;
  const osFechadas = osList.filter(
    (os) => os.status_os === 'Fechada' || os.status_os === 'Liberado para produção'
  ).length;
  const osNaoLiberado = osList.filter((os) => os.status_os === 'Não liberado').length;

  // Priority counts
  const urgentes = osList.filter((os) => os.prioridade === 'Urgente').length;
  const altas = osList.filter((os) => os.prioridade === 'Alta').length;
  const medias = osList.filter((os) => os.prioridade === 'Média').length;
  const baixas = osList.filter((os) => os.prioridade === 'Baixa').length;

  // Type counts
  const typeCounts: Record<string, number> = {};
  osList.forEach((os) => {
    const tipo = os.tipo_manutencao || 'Não especificado';
    typeCounts[tipo] = (typeCounts[tipo] || 0) + 1;
  });

  // Summary table
  autoTable(doc, {
    startY: yPos,
    head: [['Indicador', 'Quantidade']],
    body: [
      ['Total de OS', totalOS.toString()],
      ['Abertas', osAbertas.toString()],
      ['Em Manutenção', osEmManutencao.toString()],
      ['Fechadas/Liberadas', osFechadas.toString()],
      ['Não Liberadas', osNaoLiberado.toString()],
    ],
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 30, halign: 'center' },
    },
    margin: { left: 14 },
    tableWidth: 90,
  });

  // Priority table (side by side)
  const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yPos;

  autoTable(doc, {
    startY: yPos,
    head: [['Prioridade', 'Qtd']],
    body: [
      ['Urgente', urgentes.toString()],
      ['Alta', altas.toString()],
      ['Média', medias.toString()],
      ['Baixa', baixas.toString()],
    ],
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 25, halign: 'center' },
    },
    margin: { left: 110 },
    tableWidth: 65,
  });

  yPos = Math.max(
    lastY,
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yPos
  ) + 10;

  // Type breakdown
  if (Object.keys(typeCounts).length > 0) {
    doc.setTextColor(...darkColor);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Por Tipo de Manutenção', 14, yPos);
    yPos += 5;

    autoTable(doc, {
      startY: yPos,
      head: [['Tipo', 'Quantidade', '%']],
      body: Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([tipo, qtd]) => [
          tipo,
          qtd.toString(),
          `${((qtd / totalOS) * 100).toFixed(1)}%`,
        ]),
      theme: 'striped',
      headStyles: {
        fillColor: grayColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      styles: { fontSize: 9, cellPadding: 3 },
      margin: { left: 14 },
    });

    yPos = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yPos;
    yPos += 10;
  }

  // Detailed OS Section
  doc.addPage();
  yPos = 20;

  doc.setTextColor(...darkColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalhes das Ordens de Serviço', 14, yPos);

  doc.setDrawColor(...primaryColor);
  doc.line(14, yPos + 2, 196, yPos + 2);

  yPos += 10;

  // Iterate through each OS with full details
  osList.forEach((os, index) => {
    // Check if we need a new page
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    // Calculate repair time
    let repairTime = '-';
    if (os.data_fechamento) {
      const hours = (new Date(os.data_fechamento).getTime() - new Date(os.data_abertura).getTime()) / (1000 * 60 * 60);
      if (hours < 1) {
        repairTime = `${Math.round(hours * 60)} min`;
      } else {
        repairTime = `${hours.toFixed(1)}h`;
      }
    }

    // OS Header with colored status
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, yPos, 182, 12, 2, 2, 'F');
    
    doc.setTextColor(...darkColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`#${os.id} - ${os.equipamento_nome}`, 18, yPos + 8);
    
    // Status badge color
    const statusColors: Record<string, [number, number, number]> = {
      'Aberta': [59, 130, 246],
      'Em manutenção': [234, 179, 8],
      'Não liberado': [239, 68, 68],
      'Fechada': [34, 197, 94],
      'Liberado para produção': [34, 197, 94],
    };
    const statusColor = statusColors[os.status_os] || grayColor;
    
    doc.setFillColor(...statusColor);
    doc.roundedRect(150, yPos + 2, 40, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    const statusText = os.status_os === 'Liberado para produção' ? 'Liberado' : os.status_os;
    doc.text(statusText, 152, yPos + 7.5);
    
    yPos += 16;

    // Info row
    doc.setTextColor(...grayColor);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    const infoLine = [
      os.equipamento_tag ? `TAG: ${os.equipamento_tag}` : null,
      `Técnico: ${getTecnicoName(os.tecnico_id)}`,
      os.prioridade ? `Prioridade: ${os.prioridade}` : null,
      os.tipo_manutencao ? `Tipo: ${os.tipo_manutencao}` : null,
    ].filter(Boolean).join(' | ');
    
    doc.text(infoLine, 18, yPos);
    yPos += 6;

    // Dates and time row
    const dateInfo = `Abertura: ${format(new Date(os.data_abertura), 'dd/MM/yy HH:mm')} | ` +
      `Fechamento: ${os.data_fechamento ? format(new Date(os.data_fechamento), 'dd/MM/yy HH:mm') : 'Em aberto'} | ` +
      `Tempo: ${repairTime}`;
    doc.text(dateInfo, 18, yPos);
    yPos += 6;

    // Categories row (if available)
    if (categoryMaps && (os.categoria_parada_id || os.categoria_problema_id)) {
      const catParts: string[] = [];
      if (os.categoria_parada_id) {
        const catName = categoryMaps.getCategoriaParadaNome(os.categoria_parada_id);
        if (catName) {
          let catText = `Parada: ${catName}`;
          const subName = categoryMaps.getSubcategoriaName(os.subcategoria_parada_id);
          if (subName) catText += ` > ${subName}`;
          catParts.push(catText);
        }
      }
      if (os.categoria_problema_id) {
        const causeName = categoryMaps.getCategoriaProblemaName(os.categoria_problema_id);
        if (causeName) {
          let causeText = `Causa: ${causeName}`;
          const subName = categoryMaps.getSubcategoriaName(os.subcategoria_problema_id);
          if (subName) causeText += ` > ${subName}`;
          catParts.push(causeText);
        }
      }
      if (catParts.length > 0) {
        doc.setTextColor(139, 92, 246); // Purple color for categories
        doc.text(catParts.join(' | '), 18, yPos);
        yPos += 6;
      }
    }

    // Problem description
    if (os.descricao_problema) {
      doc.setTextColor(...darkColor);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Problema:', 18, yPos);
      yPos += 4;
      
      doc.setFont('helvetica', 'normal');
      const problemLines = doc.splitTextToSize(os.descricao_problema, 170);
      const maxProblemLines = Math.min(problemLines.length, 3);
      doc.text(problemLines.slice(0, maxProblemLines), 18, yPos);
      yPos += maxProblemLines * 4 + 2;
    }

    // Solution/diagnosis
    if (os.diagnostico_solucao) {
      doc.setTextColor(...darkColor);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Solução:', 18, yPos);
      yPos += 4;
      
      doc.setFont('helvetica', 'normal');
      const solutionLines = doc.splitTextToSize(os.diagnostico_solucao, 170);
      const maxSolutionLines = Math.min(solutionLines.length, 4);
      doc.text(solutionLines.slice(0, maxSolutionLines), 18, yPos);
      if (solutionLines.length > maxSolutionLines) {
        doc.text('...', 18, yPos + maxSolutionLines * 4);
        yPos += 4;
      }
      yPos += maxSolutionLines * 4 + 2;
    }

    // Final notes (if any)
    if (os.notas_finais && os.notas_finais.trim()) {
      doc.setTextColor(...darkColor);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Notas:', 18, yPos);
      yPos += 4;
      
      doc.setFont('helvetica', 'normal');
      const notesLines = doc.splitTextToSize(os.notas_finais, 170);
      const maxNotesLines = Math.min(notesLines.length, 2);
      doc.text(notesLines.slice(0, maxNotesLines), 18, yPos);
      yPos += maxNotesLines * 4 + 2;
    }

    // Separator line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(14, yPos + 2, 196, yPos + 2);
    yPos += 8;
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    doc.setDrawColor(...grayColor);
    doc.setLineWidth(0.3);
    doc.line(14, 280, 196, 280);

    doc.setTextColor(...grayColor);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      14,
      287
    );
    doc.text(`Página ${i} de ${pageCount}`, 180, 287);
  }

  // Save
  const fileName = `Relatorio_OS_${format(dateRange.from, 'ddMMyy')}_${format(dateRange.to, 'ddMMyy')}.pdf`;
  doc.save(fileName);
}
