import { jsPDF } from 'jspdf'
import { paymentPlanLabel } from './paymentPlans'
import techspireLogo from './assets/techspire-logo.png?inline'
import {
  DEFAULT_CALL_RATES,
  DEFAULT_ORDERING_TERMS,
  calculateOfferPayments,
  calculateQuotePricing,
  clientDisplayName,
  quotePaymentOptions,
  quoteOptions,
  dateLabel,
  money,
  type CompanySettings,
  type Quote,
  type QuoteLine,
} from './domain'

const RED = '#d71920'
const BLACK = '#161616'
const LIGHT = '#f3f3f3'
const INK = '#22242d'
const MUTED = '#555b68'
const BORDER = '#dce0e6'
const ACCENT_BACKGROUND = '#fdf1f1'

const PROPOSAL_INTRODUCTION = [
  "We would like to thank you for the interest you have shown in Techspire IT's products and services. We hope that this proposal represents the first step in a long and meaningful business relationship with you.",
  'In this document we would like to introduce you to your tailor-made business solution, which we are proposing based on your unique needs. In addition to detailing the products we feel are best suited to your requirements, the objective of this document is to provide a point of comparison between your current solution and the one we are proposing. We are confident that you will find better value, more effective and more efficient solutions in the pages that follow.',
  'In all our proposals, our objective is to balance cost and quality, giving you reliable service with minimum downtime and real savings. Nevertheless, if this proposal falls short for any reason, we will happily work with you to amend it in order to ensure that all your business objectives are met.',
  'I look forward to discussing the contents at your earliest convenience.',
]

type DetailRow = [label: string, value: string]

interface PaymentCard {
  title: string
  headline?: DetailRow
  rows: DetailRow[]
  note?: string
}

function addCompanyLogo(doc: jsPDF, settings: CompanySettings, x: number, y: number, maxWidth: number, maxHeight: number) {
  const imageData = settings.logoDataUrl || techspireLogo
  const format = imageData.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG'
  const { width, height } = doc.getImageProperties(imageData)
  const scale = Math.min(maxWidth / width, maxHeight / height)
  const imageWidth = width * scale
  const imageHeight = height * scale
  doc.addImage(imageData, format, x, y + (maxHeight - imageHeight) / 2, imageWidth, imageHeight)
}

function pageHeader(doc: jsPDF, settings: CompanySettings, subtitle: string) {
  addCompanyLogo(doc, settings, 20, 4, 34, 23)
  doc.setFontSize(7)
  doc.setTextColor(RED)
  doc.text('TECHNOLOGY  |  SECURITY  |  CONNECTIVITY', 190, 15, { align: 'right' })
  doc.setTextColor(BLACK)
  doc.text('PROFESSIONAL SOLUTIONS', 190, 20, { align: 'right' })
  doc.setDrawColor(RED)
  doc.setLineWidth(0.8)
  doc.line(20, 28, 190, 28)
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text(subtitle.toUpperCase(), 20, 40)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text(settings.name, 190, 40, { align: 'right' })
}

function pageFooter(doc: jsPDF, settings: CompanySettings, page: number, total: number) {
  doc.setDrawColor(220, 220, 220)
  doc.line(20, 278, 190, 278)
  doc.setFontSize(7)
  doc.setTextColor(100)
  const contact = [settings.phone, settings.email, settings.website].filter(Boolean).join('  |  ')
  if (contact) doc.text(contact, 105, 283, { align: 'center' })
  doc.text(`${page} / ${total}`, 190, 283, { align: 'right' })
  doc.setTextColor(BLACK)
}

function addIntroductionPage(doc: jsPDF, client: Quote['clientSnapshot'], settings: CompanySettings) {
  doc.addPage()
  pageHeader(doc, settings, 'Proposal Introduction')
  let y = 55

  function write(text: string, size = 11, bold = false, color = INK, gap = 5) {
    if (!text) return
    const style = bold ? 'bold' : 'normal'
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    const lines: string[] = doc.splitTextToSize(text, 170)
    const lineHeight = size * 0.46
    doc.setTextColor(color)
    for (const line of lines) {
      if (y > 269) {
        doc.addPage()
        pageHeader(doc, settings, 'Proposal Introduction — Continued')
        doc.setFont('helvetica', style)
        doc.setFontSize(size)
        doc.setTextColor(color)
        y = 55
      }
      doc.text(line, 20, y)
      y += lineHeight
    }
    y += gap
  }

  const company = client.name.trim()
  const contact = client.contact.trim()
  write(company, 11, true, INK, 0)
  write([client.address, [client.city, client.postalCode].filter(Boolean).join(' ')].filter(Boolean).join('\n').trim())
  if (contact) write(`FOR ATTENTION: ${contact.toUpperCase()}`, 16, true, RED, 8)
  write(`Dear ${contact || company || 'customer'},`)
  for (const paragraph of PROPOSAL_INTRODUCTION) write(paragraph)
  const sender = settings.preparedBy.trim()
  if (sender) {
    write('Kind regards,', 11, false, INK, 0)
    write(sender, 11, true, INK, 0)
    write(settings.name)
  }
}

export function createQuotationPdf(quote: Quote, settings: CompanySettings) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' })
  const pageWidth = 210
  const left = 20
  const right = 190

  addCompanyLogo(doc, settings, left + 2, 7, 37, 26)
  doc.setFontSize(8)
  doc.setTextColor(RED)
  doc.text('TECHNOLOGY  |  SECURITY  |  CONNECTIVITY', right, 16, { align: 'right' })
  doc.setTextColor(BLACK)
  doc.text('PROFESSIONAL SOLUTIONS', right, 21, { align: 'right' })
  doc.setDrawColor(RED)
  doc.setLineWidth(1)
  doc.line(left, 36, right, 36)

  doc.setFillColor(BLACK)
  doc.rect(left + 2, 44, 120, 55, 'F')
  doc.setFillColor(RED)
  doc.rect(left + 122, 44, 48, 55, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#ffffff')
  doc.setFontSize(22)
  doc.text(quote.title.toUpperCase(), left + 7, 59, { maxWidth: 110 })
  doc.setTextColor(RED)
  doc.setFontSize(18)
  doc.text('SOLUTION PROPOSAL', left + 7, 73)
  doc.setTextColor('#ffffff')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Secure. Connected. Professionally deployed.', left + 7, 88)
  doc.setTextColor(BLACK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('PRICE', left + 146, 56, { align: 'center' })
  doc.setFontSize(13)
  doc.text('QUOTATION', left + 146, 66, { align: 'center' })
  doc.setFontSize(9)
  doc.setTextColor('#ffffff')
  doc.text(quote.number, left + 146, 81, { align: 'center' })

  const blocks = [
    { x: 22, y: 108, width: 82, label: 'PREPARED FOR', lines: [clientDisplayName(quote.clientSnapshot), quote.clientSnapshot.address, `${quote.clientSnapshot.city} ${quote.clientSnapshot.postalCode}`.trim()] },
    { x: 105, y: 108, width: 85, label: 'PREPARED BY', lines: [settings.preparedBy, settings.name] },
    { x: 22, y: 139, width: 82, label: 'ISSUE DATE', lines: [dateLabel(quote.issueDate)] },
    { x: 105, y: 139, width: 85, label: 'VALID UNTIL', lines: [dateLabel(quote.validUntil)] },
  ]
  blocks.forEach(({ x, y, width, label, lines }, index) => {
    doc.setFillColor(index % 2 ? '#fbe9e9' : LIGHT)
    doc.rect(x, y, width, 28, 'F')
    doc.setTextColor(RED)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.text(label, x + 4, y + 6)
    doc.setTextColor(BLACK)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(lines.filter(Boolean), x + 4, y + 13, { maxWidth: width - 8 })
  })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(settings.name.toUpperCase(), pageWidth / 2, 184, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text([settings.address, [settings.phone, settings.email, settings.website].filter(Boolean).join('  |  ')].filter(Boolean), pageWidth / 2, 190, { align: 'center' })
  addIntroductionPage(doc, quote.clientSnapshot, settings)

  function renderOffer(quote: Quote, optionLabel?: string) {
    const pricing = calculateQuotePricing(quote, settings.vatRate)
    const display = quote.pricing
    const showVat = Boolean(pricing.rate && !display?.excludeVat)
    const payments = calculateOfferPayments(quote, settings.vatRate)
    const showCash = payments.some(({ payment }) => payment === 'cash')
    const showLinePrices = showCash && !display?.hideLinePrices
    const showSettlement = pricing.settlementCents > 0 && !display?.foldSettlement
    const width = right - left
    const pageBottom = 271
    const unitPriceX = 162
    const lineTotalX = 187
    const quantityX = showLinePrices ? 133 : 187
    const offerTitle = optionLabel ?? quote.title

    function startOfferPage(continued = false) {
      doc.addPage()
      pageHeader(doc, settings, continued ? 'Offer Details — Continued' : 'Offer Details')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(continued ? 12 : 20)
      const heading = doc.splitTextToSize(offerTitle, width - 12) as string[]
      const lineHeight = continued ? 5 : 8
      const height = 8 + Math.min(heading.length, 3) * lineHeight
      doc.setFillColor(ACCENT_BACKGROUND)
      doc.roundedRect(left, 47, width, height, 2, 2, 'F')
      doc.setFillColor(RED)
      doc.roundedRect(left, 47, 1, height, 0.5, 0.5, 'F')
      doc.setTextColor(INK)
      heading.slice(0, 3).forEach((part, index) => {
        doc.text(index === 2 && heading.length > 3 ? `${part.trimEnd()}…` : part, left + 5, 51 + lineHeight * (index + 1) - 1)
      })
      return 47 + height + 7
    }

    function sectionHeading(title: string, y: number) {
      doc.setTextColor(INK)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text(title, left, y + 4)
    }

    function startProducts(y: number) {
      sectionHeading('PROPOSED PRODUCTS & SERVICES', y)
      doc.setFontSize(7)
      doc.setTextColor(MUTED)
      doc.text('QTY', quantityX, y + 4, { align: 'right' })
      let dividerY = y + 8
      if (showLinePrices) {
        doc.text('UNIT PRICE / RATE', unitPriceX, y + 4, { align: 'right' })
        doc.text('LINE TOTAL', lineTotalX, y + 4, { align: 'right' })
        if (showVat) {
          doc.setFont('helvetica', 'normal')
          doc.text('Line prices exclude VAT', lineTotalX, y + 8, { align: 'right' })
          dividerY += 4
        }
      }
      doc.setDrawColor(BORDER)
      doc.setLineWidth(0.25)
      doc.line(left, dividerY, right, dividerY)
      return dividerY
    }

    function drawLinePrice(unitCents: number | null, totalCents: number, y: number, unitSuffix = '', totalSuffix = unitSuffix) {
      doc.setFont('helvetica', 'normal')
      if (unitCents !== null) doc.text(`${money(unitCents)}${unitSuffix}`, unitPriceX, y, { align: 'right' })
      doc.setFont('helvetica', 'bold')
      doc.text(`${money(totalCents)}${totalSuffix}`, lineTotalX, y, { align: 'right' })
    }

    let y = startProducts(startOfferPage())
    const parentIds = new Set(quote.lines.map(({ id }) => id))
    const groups = new Map(quote.lines.filter((line) => line.packageFeatures && line.packageInstanceId && line.packageCategory?.split('/')[0].trim() !== 'Office Automation')
      .map((line) => [line.packageInstanceId, [] as Array<{ item: QuoteLine; position: number }>]))
    const groupedIds = new Set<string>()
    quote.lines.forEach((item, position) => {
      const group = groups.get(item.packageInstanceId)
      if (!group || item.packageFeatures || item.accessoryForId || item.imageDataUrl || item.featureChoices?.length
        || quote.lines.some((entry) => entry.accessoryForId === item.id)) return
      group.push({ item, position })
      groupedIds.add(item.id)
    })
    quote.lines.forEach((line, index) => {
      if (groupedIds.has(line.id)) return
      if (line.accessoryForId && (display?.hideAccessories || parentIds.has(line.accessoryForId))) return
      const features = quote.lines.flatMap((item, position) => item.accessoryForId === line.id ? [{ item, position }] : [])
      const members = line.packageFeatures ? groups.get(line.packageInstanceId) ?? [] : []
      const bundledLines = [...features, ...members]
      const onceOffTotal = bundledLines.reduce((sum, { position }) => sum + pricing.lineTotals[position], pricing.lineTotals[index])
      const monthlyTotal = bundledLines.reduce((sum, { position }) => sum + pricing.recurring.lineTotals[position], pricing.recurring.lineTotals[index])
      const monthlyRate = line.quantity ? Math.round(monthlyTotal / line.quantity) : 0
      const showMonthly = monthlyTotal !== 0
      const showOnceOff = !showMonthly || line.unitPriceCents !== 0 || onceOffTotal !== 0
      const hasPrices = showLinePrices && (!line.packageFeatures || members.length > 0)
      const hasTwoPrices = hasPrices && showOnceOff && showMonthly
      let image: { data: string; width: number; height: number } | undefined
      if (line.imageDataUrl?.startsWith('data:image/')) {
        try {
          const { width, height } = doc.getImageProperties(line.imageDataUrl)
          if (width > 0 && height > 0) {
            const scale = Math.min(29 / width, 25 / height)
            image = { data: line.imageDataUrl, width: width * scale, height: height * scale }
          }
        } catch {
          // Older quotes can contain image data the PDF renderer cannot decode.
        }
      }
      const inset = line.accessoryForId ? 7 : 2
      const descriptionX = left + inset + (image ? 37 : 0)
      const descriptionWidth = (showLinePrices ? 123 : 175) - descriptionX
      const content = [
        { text: line.name, font: 'bold', size: line.accessoryForId ? 9.5 : 11, height: 5, color: INK },
        { text: line.description, font: 'normal', size: 9, height: 4.2, color: MUTED },
        { text: line.sku, font: 'normal', size: 7.5, height: 3.8, color: MUTED },
        ...[...members, ...(display?.hideAccessories ? [] : features)].map(({ item }) => ({
          text: `• ${item.name}${item.quantity !== 1 ? ` × ${item.quantity}` : ''}`,
          font: 'normal', size: 8.5, height: 4, color: MUTED,
        })),
      ].filter(({ text }) => text?.trim()).flatMap((style) => {
        doc.setFont('helvetica', style.font)
        doc.setFontSize(style.size)
        return (doc.splitTextToSize(style.text, descriptionWidth) as string[]).map((text) => ({ ...style, text }))
      })
      for (let offset = 0; offset < content.length; offset += 10) {
        const first = offset === 0
        const chunk = content.slice(offset, offset + 10)
        const height = Math.max(image && first ? 35 : 13, hasTwoPrices && first ? 17 : 0, chunk.reduce((sum, row) => sum + row.height, 8))
        if (y + height > pageBottom) y = startProducts(startOfferPage(true))
        if (first && image) {
          const tileX = left + inset
          const tileY = y + (height - 29) / 2
          doc.setDrawColor(BORDER)
          doc.setLineWidth(0.2)
          doc.roundedRect(tileX, tileY, 33, 29, 1.5, 1.5)
          doc.addImage(image.data, tileX + (33 - image.width) / 2, tileY + (29 - image.height) / 2, image.width, image.height)
        }
        let textY = y + 7
        for (const { text, font, size, height, color } of chunk) {
          doc.setFont('helvetica', font)
          doc.setFontSize(size)
          doc.setTextColor(color)
          doc.text(text, descriptionX, textY)
          textY += height
        }
        if (first && (!line.packageFeatures || hasPrices)) {
          doc.setTextColor(INK)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
          if (!line.packageFeatures && line.unit !== 'hour') doc.text(String(line.quantity), quantityX, y + 7, { align: 'right' })
          if (hasPrices) {
            if (showOnceOff) {
              const unitPrice = line.quantity && onceOffTotal !== Math.round(line.quantity * line.unitPriceCents)
                ? Math.round(onceOffTotal / line.quantity)
                : line.unitPriceCents
              drawLinePrice(line.packageFeatures ? null : line.unit === 'hour' && features.length ? line.unitPriceCents : unitPrice,
                onceOffTotal, y + 7, line.unit === 'hour' ? '/hr' : '', '')
            }
            if (showMonthly) {
              drawLinePrice(line.packageFeatures ? null : monthlyRate, monthlyTotal, y + (hasTwoPrices ? 11.5 : 7), '/mo')
            }
          }
        }
        y += height
        if (offset + chunk.length === content.length) {
          doc.setDrawColor(BORDER)
          doc.setLineWidth(0.2)
          doc.line(left, y, right, y)
        }
      }
    })

    function layoutPaymentCard({ title, headline, rows, note }: PaymentCard, cardWidth: number) {
      const innerWidth = cardWidth - 10
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      const titleLines = doc.splitTextToSize(title, innerWidth) as string[]
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      const noteLines = note ? doc.splitTextToSize(note, innerWidth) as string[] : []
      doc.setFontSize(8.5)
      const labelWidth = innerWidth * 0.64 - 2
      const detailRows = rows.map(([label, value]) => {
        const labels = doc.splitTextToSize(label, labelWidth) as string[]
        const values = doc.splitTextToSize(value, innerWidth - labelWidth - 3) as string[]
        return { labels, values, height: 1.5 + Math.max(labels.length, values.length) * 3.8 }
      })
      const headerHeight = titleLines.length * 4.7 + (headline ? 24 : 7)
      const height = headerHeight + detailRows.reduce((sum, detail) => sum + detail.height, 0)
        + (detailRows.length ? 5 : 0) + (noteLines.length ? 3 + noteLines.length * 3.8 : 0)
      return { titleLines, headline, detailRows, noteLines, cardWidth, headerHeight, height }
    }

    function drawPaymentCard(card: ReturnType<typeof layoutPaymentCard>, x: number, top: number, height: number) {
      const { titleLines, headline, detailRows, noteLines, cardWidth, headerHeight } = card
      doc.setDrawColor(BORDER)
      doc.setLineWidth(0.25)
      doc.setFillColor('#ffffff')
      doc.roundedRect(x, top, cardWidth, height, 2, 2, 'FD')
      doc.setFillColor(headline ? ACCENT_BACKGROUND : '#f4f5f7')
      doc.roundedRect(x + 1, top + 1, cardWidth - 2, headerHeight - 1, 1.5, 1.5, 'F')
      doc.setTextColor(INK)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      titleLines.forEach((line, index) => doc.text(line, x + 5, top + 6.5 + index * 4.7))
      if (headline) {
        doc.setTextColor(MUTED)
        doc.setFontSize(8)
        doc.text(headline[0], x + 5, top + headerHeight - 13)
        doc.setTextColor(RED)
        doc.setFontSize(19)
        doc.text(headline[1], x + 5, top + headerHeight - 4.5)
      }
      let detailY = top + headerHeight + 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      for (const { labels, values, height } of detailRows) {
        doc.setTextColor(MUTED)
        labels.forEach((label, index) => doc.text(label, x + 5, detailY + index * 3.8))
        doc.setTextColor(INK)
        values.forEach((value, index) => doc.text(value, x + cardWidth - 5, detailY + index * 3.8, { align: 'right' }))
        detailY += height
      }
      if (noteLines.length) {
        doc.setTextColor(MUTED)
        doc.setFontSize(8)
        noteLines.forEach((line, index) => doc.text(line, x + 5, detailY + (detailRows.length ? 0 : -0.5) + index * 3.8))
      }
    }

    const paymentCards = payments.map(({ payment, totals }): PaymentCard => {
      const cash = payment === 'cash'
      const title = cash ? 'Cash' : paymentPlanLabel(payment)
      if (!cash && totals.factor === null) {
        return { title, rows: [], note: 'No factor available for this value.' }
      }
      const rows: DetailRow[] = []
      if (cash) {
        rows.push(['Subtotal', money(pricing.subtotalCents + (showSettlement ? 0 : pricing.settlementCents))])
        if (pricing.discountCents) rows.push(['Discount', money(-pricing.discountCents)])
        if (showSettlement) rows.push(['Settlement', money(pricing.settlementCents)])
        if (showVat) rows.push([`VAT (${pricing.rate}%)`, money(pricing.vatCents)])
      } else {
        rows.push([showVat ? 'Finance payment ex. VAT' : 'Finance payment', money(totals.financedCents)])
        if (showVat) rows.push(['Finance VAT', money(totals.financeVatCents)])
      }
      if (totals.recurring.totalCents > 0) {
        rows.push([showVat ? 'Recurring services ex. VAT' : 'Recurring services', money(totals.recurring.subtotalCents)])
        if (showVat) rows.push(['Recurring services VAT', money(totals.recurring.vatCents)])
        if (cash) rows.push(['Starting monthly total', money(totals.monthlyCents)])
      }
      if (totals.secondYearMonthlyCents !== null) {
        rows.push(['Monthly total from month 13', money(totals.secondYearMonthlyCents)])
      }
      const note = !cash && payment.escalation > 0 ? 'Annual escalation applies to the finance payment.' : undefined
      return { title, headline: cash ? ['CASH TOTAL', money(pricing.dueCents)] : ['Starting monthly total', money(totals.monthlyCents)], rows, note }
    })

    const gap = 5
    const columns = paymentCards.length > 1 ? 2 : 1
    const cardWidth = (width - (columns - 1) * gap) / columns
    let showPaymentHeading = true
    y += 9
    for (let index = 0; index < paymentCards.length; index += columns) {
      const row = paymentCards.slice(index, index + columns).map((card) => layoutPaymentCard(card, cardWidth))
      const height = Math.max(...row.map((card) => card.height))
      if (y + height + (showPaymentHeading ? 9 : 0) > pageBottom) {
        y = startOfferPage(true)
        showPaymentHeading = true
      }
      if (showPaymentHeading) {
        sectionHeading('PAYMENT OPTIONS', y)
        y += 9
        showPaymentHeading = false
      }
      row.forEach((card, column) => drawPaymentCard(card, left + column * (cardWidth + gap), y, height))
      y += height + gap
    }
    if (display?.showCallRates) {
      const callRates: DetailRow[] = [
        ['Local calls', (display.localCallRate ?? DEFAULT_CALL_RATES.localCallRate).trim()],
        ['Cellular calls', (display.cellularCallRate ?? DEFAULT_CALL_RATES.cellularCallRate).trim()],
      ]
      const quotedRates = callRates.filter(([, rate]) => rate)
      if (quotedRates.length) {
        const card = layoutPaymentCard({ title: 'Call rates', rows: quotedRates }, width)
        if (y + card.height > pageBottom) y = startOfferPage(true)
        drawPaymentCard(card, left, y, card.height)
      }
    }
  }
  const offers = quoteOptions(quote)
  const offerPayments = offers.map((offer) => quotePaymentOptions(offer.pricing))
  const hasCash = offerPayments.some((payments) => payments.includes('cash'))
  const hasFinance = offerPayments.some((payments) => payments.some((payment) => payment !== 'cash'))
  const hasUnpricedOffer = offerPayments.some((payments) => payments.length === 0)
  if (offers.length === 1 && !quote.primaryOptionName) renderOffer(quote)
  else offers.forEach((option, index) => {
    const number = `Option ${index + 1}`
    const label = /^Option \d+$/.test(option.name) ? option.name : option.name ? `${number} - ${option.name}` : number
    renderOffer({ ...quote, ...option }, label)
  })
  doc.addPage()
  pageHeader(doc, settings, 'Ordering Terms & Acceptance')
  const terms = (quote.terms.length ? quote.terms : settings.defaultTerms?.length ? settings.defaultTerms : DEFAULT_ORDERING_TERMS).filter(Boolean)
  let termY = 49
  const startTermsContinuation = () => {
    doc.addPage()
    pageHeader(doc, settings, 'Ordering Terms & Acceptance — Continued')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(BLACK)
    termY = 49
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(BLACK)
  let termNumber = 0
  const writeParagraph = (text: string, index: number) => {
    const [heading, ...bodyParts] = text.split(/\s(?:\||—)\s/)
    const isIntroduction = index === 0 && !bodyParts.length && heading.startsWith('The following terms apply')
    const isPrefixed = /^\d+\.\s/.test(heading)
    const isClosing = heading.startsWith('Thank you for the opportunity') || heading.startsWith('Note:')
    if (!isIntroduction && !isPrefixed && !isClosing) termNumber += 1
    const prefix = isIntroduction || isClosing ? '' : isPrefixed ? '' : `${termNumber}. `
    const paragraph = bodyParts.length ? `${heading}  ${bodyParts.join(' ')}` : heading
    const lines = doc.splitTextToSize(`${prefix}${paragraph}`, 166) as string[]
    const lineHeight = 3.8
    for (let offset = 0; offset < lines.length; offset += 30) {
      const chunk = lines.slice(offset, offset + 30)
      const height = chunk.length * lineHeight + 3
      if (termY + height > 195) startTermsContinuation()
      doc.text(chunk, left + 2, termY)
      termY += height
    }
    if (isPrefixed) termNumber = Math.max(termNumber, Number(heading.match(/^(\d+)\./)?.[1] ?? 0))
  }
  const cashTerms = 'Cash options require a 50% deposit before procurement or scheduling, with the balance due on completion unless agreed otherwise in writing.'
  const financeTerms = 'Finance terms and monthly charges appear under the products and services in each applicable offer.'
  const pendingTerms = 'Payment terms for offers without a payment option will be confirmed separately.'
  const paymentTerms = [hasCash ? cashTerms : '', hasFinance ? financeTerms : '', hasUnpricedOffer ? pendingTerms : '']
    .filter(Boolean).join(' ')
  const defaultPaymentTerm = DEFAULT_ORDERING_TERMS.find((entry) => entry.startsWith('Payment terms|'))
  terms.forEach((term, index) => {
    const defaultDeposit = term.replace(' — ', '|') === defaultPaymentTerm
    writeParagraph(defaultDeposit && (hasFinance || hasUnpricedOffer) ? `Payment terms | ${paymentTerms}` : term, index)
  })
  if (quote.notes) {
    if (termY + 9 > 195) startTermsContinuation()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('PROJECT NOTES', left + 2, termY + 2)
    doc.setFont('helvetica', 'normal')
    termY += 9
    doc.setFontSize(8)
    writeParagraph(quote.notes, terms.length)
  }
  const authorisationFields = [
    'Company name',
    'Authorised representative',
    'Purchase order number',
    ...(offers.length > 1 ? ['Selected offer option'] : []),
    ...(offerPayments.some((payments) => payments.length > 1) ? ['Selected payment option'] : []),
    'Signature and date',
  ]
  const rowHeight = 9.5
  const maxAuthorisationY = 274 - 14 - authorisationFields.length * rowHeight
  if (termY + 12 > maxAuthorisationY) startTermsContinuation()
  const authorisationY = Math.max(termY + 12, Math.min(210, maxAuthorisationY))
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(BLACK)
  doc.setFontSize(10)
  doc.text('CLIENT AUTHORISATION', left, authorisationY + 8)
  const tableX = left + 2
  const tableY = authorisationY + 14
  const labelWidth = 44
  const valueWidth = right - tableX - labelWidth
  doc.setLineWidth(0.2)
  doc.setFontSize(8)
  authorisationFields.forEach((field, index) => {
    const rowY = tableY + index * rowHeight
    doc.setFillColor('#f1f2f4')
    doc.rect(tableX, rowY, labelWidth, rowHeight, 'F')
    doc.setDrawColor(205, 208, 212)
    doc.rect(tableX, rowY, labelWidth, rowHeight)
    doc.rect(tableX + labelWidth, rowY, valueWidth, rowHeight)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(BLACK)
    doc.text(field, tableX + 2, rowY + 5.9)
  })
  const totalPages = doc.getNumberOfPages()
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page)
    pageFooter(doc, settings, page, totalPages)
  }

  return doc
}

export function quotationFilename(quote: Quote) {
  const client = clientDisplayName(quote.clientSnapshot)
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  return `Techspire_${quote.number}_${client}.pdf`
}
