import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import 'jspdf-autotable'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface OS {
  id: number
  equipamento_nome: string
  equipamento_tag: string | null
  status_os: string
  prioridade: string | null
  tipo_manutencao: string | null
  data_abertura: string
  data_fechamento: string | null
  descricao_problema: string | null
  diagnostico_solucao: string | null
  notas_finais: string | null
  tecnico_id: number
  localizacao: string | null
  categoria_parada_id?: string | null
  subcategoria_parada_id?: string | null
  categoria_problema_id?: string | null
  subcategoria_problema_id?: string | null
}

interface Tecnico {
  id_telegram: number
  nome_completo: string
}

interface CategoryNames {
  categoriaParada?: string | null
  subcategoriaParada?: string | null
  categoriaProblema?: string | null
  subcategoriaProblema?: string | null
}

export function exportOSToPDF(
  os: OS,
  tecnicos: Tecnico[],
  categoryNames?: CategoryNames
) {
  const doc = new jsPDF()

  const tecnico = tecnicos.find((t) => t.id_telegram === os.tecnico_id)
  const tecnicoName = tecnico?.nome_completo || 'Desconhecido'

  // Colors
  const primaryColor: [number, number, number] = [245, 158, 11] // Orange
  const darkColor: [number, number, number] = [30, 41, 59]
  const grayColor: [number, number, number] = [100, 116, 139]

  // Header
  doc.setFillColor(...primaryColor)
  doc.rect(0, 0, 220, 35, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text('KRAFLO', 14, 20)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Sistema de Manutenção Industrial', 14, 28)

  // OS Number Badge
  doc.setFillColor(...darkColor)
  doc.roundedRect(150, 10, 45, 15, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(`OS #${os.id}`, 155, 20)

  // Status and Priority badges
  let yPos = 45

  // Status badge
  const statusColors: Record<string, [number, number, number]> = {
    Aberta: [59, 130, 246],
    'Em manutenção': [234, 179, 8],
    'Não liberado': [239, 68, 68],
    Fechada: [34, 197, 94],
    'Liberado para produção': [34, 197, 94],
  }
  const statusColor = statusColors[os.status_os] || [100, 116, 139]
  doc.setFillColor(...statusColor)
  doc.roundedRect(14, yPos, 40, 8, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.text(os.status_os, 17, yPos + 5.5)

  // Priority badge
  if (os.prioridade) {
    const prioridadeColors: Record<string, [number, number, number]> = {
      Urgente: [239, 68, 68],
      Alta: [249, 115, 22],
      Média: [234, 179, 8],
      Baixa: [34, 197, 94],
    }
    const prioridadeColor = prioridadeColors[os.prioridade] || [100, 116, 139]
    doc.setFillColor(...prioridadeColor)
    doc.roundedRect(58, yPos, 30, 8, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.text(os.prioridade, 61, yPos + 5.5)
  }

  // Maintenance type badge
  if (os.tipo_manutencao) {
    doc.setFillColor(...grayColor)
    doc.roundedRect(92, yPos, 30, 8, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.text(os.tipo_manutencao, 95, yPos + 5.5)
  }

  yPos = 62

  // Equipment Info Section
  doc.setTextColor(...darkColor)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Informações do Equipamento', 14, yPos)

  doc.setDrawColor(...primaryColor)
  doc.setLineWidth(0.5)
  doc.line(14, yPos + 2, 196, yPos + 2)

  yPos += 12

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: [
      ['Equipamento:', os.equipamento_nome],
      ['TAG:', os.equipamento_tag || 'N/A'],
      ['Localização:', os.localizacao || 'N/A'],
      ['Técnico Responsável:', tecnicoName],
    ],
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: 3,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50, textColor: grayColor },
      1: { textColor: darkColor },
    },
    margin: { left: 14 },
  })

  yPos =
    ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? yPos) + 10

  // Dates Section
  doc.setTextColor(...darkColor)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Datas', 14, yPos)

  doc.setDrawColor(...primaryColor)
  doc.line(14, yPos + 2, 196, yPos + 2)

  yPos += 12

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: [
      [
        'Data de Abertura:',
        format(
          new Date(os.data_abertura),
          "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
          { locale: ptBR }
        ),
      ],
      [
        'Data de Fechamento:',
        os.data_fechamento
          ? format(
              new Date(os.data_fechamento),
              "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
              { locale: ptBR }
            )
          : 'Em aberto',
      ],
    ],
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: 3,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50, textColor: grayColor },
      1: { textColor: darkColor },
    },
    margin: { left: 14 },
  })

  yPos =
    ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? yPos) + 10

  // Categories Section (if available)
  if (categoryNames?.categoriaParada || categoryNames?.categoriaProblema) {
    doc.setTextColor(...darkColor)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Classificação', 14, yPos)

    doc.setDrawColor(...primaryColor)
    doc.line(14, yPos + 2, 196, yPos + 2)

    yPos += 12

    const categoryRows: string[][] = []
    if (categoryNames.categoriaParada) {
      categoryRows.push(['Categoria de Parada:', categoryNames.categoriaParada])
      if (categoryNames.subcategoriaParada) {
        categoryRows.push(['Subcategoria:', categoryNames.subcategoriaParada])
      }
    }
    if (categoryNames.categoriaProblema) {
      categoryRows.push(['Causa Raiz:', categoryNames.categoriaProblema])
      if (categoryNames.subcategoriaProblema) {
        categoryRows.push(['Subcategoria:', categoryNames.subcategoriaProblema])
      }
    }

    if (categoryRows.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [],
        body: categoryRows,
        theme: 'plain',
        styles: {
          fontSize: 10,
          cellPadding: 3,
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50, textColor: grayColor },
          1: { textColor: darkColor },
        },
        margin: { left: 14 },
      })

      yPos =
        ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
          ?.finalY ?? yPos) + 10
    }
  }

  // Problem Description Section
  doc.setTextColor(...darkColor)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Descrição do Problema', 14, yPos)

  doc.setDrawColor(...primaryColor)
  doc.line(14, yPos + 2, 196, yPos + 2)

  yPos += 10

  doc.setFillColor(241, 245, 249)
  const problemText = os.descricao_problema || 'Não informado'
  const problemLines = doc.splitTextToSize(problemText, 175)
  const problemHeight = problemLines.length * 6 + 10
  doc.roundedRect(14, yPos, 182, problemHeight, 3, 3, 'F')

  doc.setTextColor(...darkColor)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(problemLines, 18, yPos + 8)

  yPos += problemHeight + 10

  // Check if we need a new page
  if (yPos > 240) {
    doc.addPage()
    yPos = 20
  }

  // Diagnosis/Solution Section
  doc.setTextColor(...darkColor)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Diagnóstico / Solução', 14, yPos)

  doc.setDrawColor(...primaryColor)
  doc.line(14, yPos + 2, 196, yPos + 2)

  yPos += 10

  doc.setFillColor(241, 245, 249)
  const solutionText = os.diagnostico_solucao || 'Não informado'
  const solutionLines = doc.splitTextToSize(solutionText, 175)
  const solutionHeight = solutionLines.length * 6 + 10
  doc.roundedRect(14, yPos, 182, solutionHeight, 3, 3, 'F')

  doc.setTextColor(...darkColor)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(solutionLines, 18, yPos + 8)

  yPos += solutionHeight + 10

  // Final Notes (if any)
  if (os.notas_finais) {
    if (yPos > 240) {
      doc.addPage()
      yPos = 20
    }

    doc.setTextColor(...darkColor)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Notas Finais', 14, yPos)

    doc.setDrawColor(...primaryColor)
    doc.line(14, yPos + 2, 196, yPos + 2)

    yPos += 10

    doc.setFillColor(241, 245, 249)
    const notesLines = doc.splitTextToSize(os.notas_finais, 175)
    const notesHeight = notesLines.length * 6 + 10
    doc.roundedRect(14, yPos, 182, notesHeight, 3, 3, 'F')

    doc.setTextColor(...darkColor)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(notesLines, 18, yPos + 8)
  }

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)

    doc.setDrawColor(...grayColor)
    doc.setLineWidth(0.3)
    doc.line(14, 280, 196, 280)

    doc.setTextColor(...grayColor)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", {
        locale: ptBR,
      })}`,
      14,
      287
    )
    doc.text(`Página ${i} de ${pageCount}`, 180, 287)
    doc.text('KRAFLO - Sistema de Manutenção Industrial', 85, 287)
  }

  // Save
  doc.save(`OS_${os.id}_${os.equipamento_nome.replace(/\s+/g, '_')}.pdf`)
}
