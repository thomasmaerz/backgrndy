declare module 'pdf-parse' {
  interface PDFData {
    numpages: number
    numrender: number
    info: Record<string, unknown>
    metadata: Record<string, unknown>
    text: string
    version: string
  }

  interface PDFParseOptions {
    max?: number
    min?: number
    pagerender?: (pageData: unknown) => string
    normalizeWhitespace?: boolean
    disableCombineTextItems?: boolean
  }

  function pdfParse(
    dataBuffer: Buffer,
    options?: PDFParseOptions
  ): Promise<PDFData>

  export default pdfParse
}
