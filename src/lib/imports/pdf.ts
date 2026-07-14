import { extractText, getDocumentProxy } from "unpdf"

import { StatementParseError } from "@/lib/imports/types"

/**
 * Extract a PDF's whole text layer as one flattened string. The extracted layer
 * carries no reliable line breaks, so every PDF parser works off this merged
 * stream anchored on labels/tokens, never on positions. Extraction lives here so
 * the dispatcher can pull text once and sniff the format before choosing a
 * parser (a 94-page GPay statement shouldn't be extracted twice).
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    return (await extractText(pdf, { mergePages: true })).text
  } catch {
    throw new StatementParseError("PDF: file is not a readable PDF")
  }
}
