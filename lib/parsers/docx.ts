import mammoth from 'mammoth';
import { ParsedResume, detectSectionsFromHtml } from './sections';

export type { ParsedResume };

export async function parseDocx(buffer: Buffer): Promise<ParsedResume> {
  const result = await mammoth.convertToHtml({ buffer });
  const rawText = result.value; // This is HTML, not plain text
  
  return {
    rawText,
    sections: detectSectionsFromHtml(rawText),
  };
}
