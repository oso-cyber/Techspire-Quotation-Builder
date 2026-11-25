import { strToU8, zipSync } from 'fflate'
import type { Quote } from './domain'
import { reportRows, type ReportType } from './quotationReports'

const spreadsheet = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const office = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const relationships = 'http://schemas.openxmlformats.org/package/2006/relationships'
const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml'

function escapeXml(text: string) {
  // XML 1.0 forbids these characters in worksheet cells.
  // oxlint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g, '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export function quotationWorkbook(quotes: Quote[], type: ReportType, vatRate: number) {
  const rows = reportRows(quotes, type, vatRate)
  const widths = rows[0].map((heading) => String(heading).length + 6)
  const data = rows.map((row, index) => {
    let lineCount = 1
    const cells = row.map((value, column) => {
      const money = typeof value === 'object'
      const text = money ? (value.cents / 100).toFixed(2) : String(value)
      const lines = text.split(/\r\n|\r|\n/)
      widths[column] = lines.reduce((width, line) => Math.max(width, Math.min(48, line.length + 5)), widths[column])
      lineCount = Math.max(lineCount, lines.reduce((count, line) => count + Math.max(1, Math.ceil(line.length / 40)), 0))
      const style = index === 0 ? 1 : (index % 2 === 0 ? 4 : 2) + Number(money)
      return typeof value === 'string'
        ? `<c s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`
        : `<c s="${style}"><v>${text}</v></c>`
    }).join('')
    return `<row r="${index + 1}" ht="${index === 0 ? 30 : Math.min(400, 8 + 15 * lineCount)}" customHeight="1">${cells}</row>`
  }).join('')
  const columns = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${Math.max(14, width)}" customWidth="1"/>`).join('')
  const styles = [[0, 0, 0], [1, 2, 0], [0, 0, 0], [0, 0, 4], [0, 3, 0], [0, 3, 4]]
    .map(([font, fill, format]) => `<xf fontId="${font}" fillId="${fill}" numFmtId="${format}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" wrapText="1" indent="1"/></xf>`).join('')
  const files = {
    '[Content_Types].xml': `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${contentType}.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="${contentType}.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="${contentType}.styles+xml"/></Types>`,
    '_rels/.rels': `<Relationships xmlns="${relationships}"><Relationship Id="rId1" Type="${office}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${spreadsheet}" xmlns:r="${office}"><bookViews><workbookView/></bookViews><sheets><sheet name="${type}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${relationships}"><Relationship Id="rId1" Type="${office}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${office}/styles" Target="styles.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${spreadsheet}"><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columns}</cols><sheetData>${data}</sheetData></worksheet>`,
    'xl/styles.xml': `<styleSheet xmlns="${spreadsheet}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFA41321"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F4F7"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6">${styles}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  }
  return zipSync(Object.fromEntries(Object.entries(files).map(([path, xml]) => [path, strToU8(xml)])))
}
