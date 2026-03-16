import Papa from 'papaparse'

export async function extractCsvText(buffer: Buffer): Promise<string> {
  const text = buffer.toString('utf-8')
  const parsed = Papa.parse(text, { header: true })
  
  const lines: string[] = []
  
  for (const row of parsed.data as Record<string, string>[]) {
    const rowLines: string[] = []
    for (const [key, value] of Object.entries(row)) {
      if (value && value.trim()) {
        rowLines.push(`${key}: ${value}`)
      }
    }
    if (rowLines.length > 0) {
      lines.push(rowLines.join('\n'))
    }
  }
  
  return lines.join('\n\n')
}
