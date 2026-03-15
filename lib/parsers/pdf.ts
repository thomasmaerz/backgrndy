import pdf from 'pdf-parse';
import { ParsedResume, detectSectionsFromText } from './sections';

export type { ParsedResume };

export async function parsePdf(buffer: Buffer): Promise<ParsedResume> {
  const data = await pdf(buffer);
  const rawText = data.text;
  
  return {
    rawText,
    sections: detectSectionsFromText(rawText),
  };
}
