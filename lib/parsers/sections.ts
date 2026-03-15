import { parse, HTMLElement } from 'node-html-parser';

export interface ParsedResume {
  rawText: string;
  sections: {
    experience: string[];
    skills: string[];
    intro: string[];
    other: string[];
  };
}

const headingPatterns = {
  skills: /skills/i,
  experience: /experience|work|employment/i,
  intro: /summary|intro|profile/i,
};

export function detectSectionsFromText(rawText: string): ParsedResume['sections'] {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  
  const sections: ParsedResume['sections'] = {
    experience: [],
    skills: [],
    intro: [],
    other: [],
  };

  const bulletPatterns = /^([•\-\*]|\d+\.)\s*/;
  
  let currentSection: keyof ParsedResume['sections'] | null = null;
  let introFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBullet = bulletPatterns.test(line);
    const isHeading = Object.entries(headingPatterns).some(
      ([, pattern]) => pattern.test(line) && line.length < 60
    ) && !isBullet;

    if (isHeading) {
      if (headingPatterns.skills.test(line)) {
        currentSection = 'skills';
      } else if (headingPatterns.experience.test(line)) {
        currentSection = 'experience';
      } else if (headingPatterns.intro.test(line)) {
        currentSection = 'intro';
      }
      continue;
    }

    if (!introFound && !currentSection && !isBullet && line.length > 20) {
      sections.intro.push(line);
      introFound = true;
      continue;
    }

    if (currentSection === 'experience' && isBullet) {
      sections.experience.push(line.replace(bulletPatterns, ''));
    } else if (currentSection === 'skills' && line.length > 0) {
      sections.skills.push(line);
    } else if (currentSection === 'intro' && line.length > 0) {
      sections.intro.push(line);
    } else if (line.length > 0) {
      sections.other.push(line);
    }
  }

  return sections;
}

function isHeadingTag(tagName: string): boolean {
  return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName.toLowerCase());
}

function getSectionFromHeading(text: string): keyof ParsedResume['sections'] | null {
  if (headingPatterns.skills.test(text)) return 'skills';
  if (headingPatterns.experience.test(text)) return 'experience';
  if (headingPatterns.intro.test(text)) return 'intro';
  return null;
}

function getTextContent(node: HTMLElement | string): string {
  if (typeof node === 'string') return node;
  return node.text || '';
}

function getAllText(node: HTMLElement | string): string {
  if (typeof node === 'string') return node;
  return node.textContent || '';
}

export function detectSectionsFromHtml(html: string): ParsedResume['sections'] {
  const root = parse(html);
  
  const sections: ParsedResume['sections'] = {
    experience: [],
    skills: [],
    intro: [],
    other: [],
  };

  let currentSection: keyof ParsedResume['sections'] | null = null;
  let introFound = false;

  function processNode(node: HTMLElement | string): void {
    if (typeof node === 'string') {
      const text = (node as string).trim();
      if (!text) return;
      
      if (!currentSection && !introFound && text.length > 20) {
        sections.intro.push(text);
        introFound = true;
        return;
      }

      if (currentSection === 'experience') {
        sections.experience.push(text);
      } else if (currentSection === 'skills') {
        sections.skills.push(text);
      } else if (currentSection === 'intro') {
        sections.intro.push(text);
      } else if (text.length > 0) {
        sections.other.push(text);
      }
      return;
    }

    const tagName = node.tagName?.toLowerCase();

    if (isHeadingTag(tagName)) {
      const text = getTextContent(node).trim();
      const section = getSectionFromHeading(text);
      if (section) {
        currentSection = section;
      }
      return;
    }

    if (tagName === 'li' || tagName === 'p') {
      const text = getAllText(node).trim();
      if (!text) return;

      if (!currentSection && !introFound && text.length > 20) {
        sections.intro.push(text);
        introFound = true;
        return;
      }

      if (currentSection === 'experience') {
        sections.experience.push(text);
      } else if (currentSection === 'skills') {
        sections.skills.push(text);
      } else if (currentSection === 'intro') {
        sections.intro.push(text);
      } else if (text.length > 0) {
        sections.other.push(text);
      }
      return;
    }

    if (tagName === 'table') {
      const rows = node.querySelectorAll('tr');
      for (const row of rows) {
        const cells = row.querySelectorAll('td, th');
        if (cells.length === 0) continue;

        const firstCellText = getTextContent(cells[0]).trim();
        
        const potentialSection = getSectionFromHeading(firstCellText);
        if (potentialSection) {
          currentSection = potentialSection;
          for (let i = 1; i < cells.length; i++) {
            const cellText = getAllText(cells[i]).trim();
            if (cellText && currentSection) {
              if (currentSection === 'experience') {
                sections.experience.push(cellText);
              } else if (currentSection === 'skills') {
                sections.skills.push(cellText);
              } else if (currentSection === 'intro') {
                sections.intro.push(cellText);
              } else {
                sections.other.push(cellText);
              }
            }
          }
        } else {
          for (const cell of cells) {
            const cellText = getAllText(cell).trim();
            if (cellText && currentSection) {
              if (currentSection === 'experience') {
                sections.experience.push(cellText);
              } else if (currentSection === 'skills') {
                sections.skills.push(cellText);
              } else if (currentSection === 'intro') {
                sections.intro.push(cellText);
              } else {
                sections.other.push(cellText);
              }
            }
          }
        }
      }
      return;
    }

    // Recurse into children
    const children = node.childNodes;
    if (children && children.length > 0) {
      for (const child of children) {
        processNode(child as HTMLElement | string);
      }
    }
  }

  for (const node of root.childNodes) {
    processNode(node as HTMLElement | string);
  }

  return sections;
}
