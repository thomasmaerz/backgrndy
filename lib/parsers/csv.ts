import Papa from 'papaparse';
import { ParsedResume } from './sections';

export type { ParsedResume };

export async function parseCsv(buffer: Buffer): Promise<ParsedResume> {
  const text = buffer.toString('utf-8');
  
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const sections: ParsedResume['sections'] = {
          experience: [],
          skills: [],
          intro: [],
          other: [],
        };

        if (!results.meta.fields || results.meta.fields.length === 0) {
          resolve({ rawText: text, sections });
          return;
        }

        const fields = results.meta.fields.map(f => f.toLowerCase());
        
        const experienceCols = fields.filter(f => 
          ['bullet', 'experience', 'description', 'achievement'].includes(f)
        );
        const skillsCols = fields.filter(f => 
          ['skill', 'skills'].includes(f)
        );
        const introCols = fields.filter(f => 
          ['intro', 'summary'].includes(f)
        );

        for (const row of results.data as Record<string, string>[]) {
          for (const col of experienceCols) {
            const originalCol = results.meta.fields!.find(
              f => f.toLowerCase() === col
            );
            if (originalCol && row[originalCol]) {
              sections.experience.push(row[originalCol]);
            }
          }

          for (const col of skillsCols) {
            const originalCol = results.meta.fields!.find(
              f => f.toLowerCase() === col
            );
            if (originalCol && row[originalCol]) {
              sections.skills.push(row[originalCol]);
            }
          }

          for (const col of introCols) {
            const originalCol = results.meta.fields!.find(
              f => f.toLowerCase() === col
            );
            if (originalCol && row[originalCol]) {
              sections.intro.push(row[originalCol]);
            }
          }

          // Remaining columns go to other
          const mappedCols = new Set([...experienceCols, ...skillsCols, ...introCols]);
          for (const col of fields) {
            if (!mappedCols.has(col)) {
              const originalCol = results.meta.fields!.find(
                f => f.toLowerCase() === col
              );
              if (originalCol && row[originalCol]) {
                sections.other.push(row[originalCol]);
              }
            }
          }
        }

        resolve({ rawText: text, sections });
      },
      error: (error: Error) => {
        reject(error);
      },
    });
  });
}
