import { AIProvider, Message } from '@/lib/ai'

export interface ParsedResume {
  experience: {
    company: string
    raw_text: string
  }[]
  skills: string[]
  education_credentials: {
    type: 'degree' | 'training' | 'certification'
    title: string
    institution: string | null
    year: string | null
  }[]
}

const SYSTEM_PROMPT = `You are an expert resume parser. Your task is to extract structured information from resume text.

Extract EXACTLY four categories from the resume:

1. **experience** — entries from the experience/work section. Each entry is an object with:
   - "company": string (the company name)
   - "raw_text": string (the full sentence(s) describing the responsibility or accomplishment)
   One entry per bullet/responsibility, NOT per job.

2. **skills** — individual skills, technologies, or soft skills as an array of strings.

3. **education_credentials** — degrees, trainings, and certifications. Each entry:
   - "type": "degree" | "training" | "certification"
   - "title": string (the degree name, certification name, or training name)
   - "institution": string | null (the school or organization)
   - "year": string | null (graduation year or certification year)

Respond with ONLY a valid JSON object matching this schema — no markdown, no explanation, no code fences.

Schema:
{
  "experience": [{ "company": string, "raw_text": string }],
  "skills": string[],
  "education_credentials": [{ "type": "degree"|"training"|"certification", "title": string, "institution": string|null, "year": string|null }]
}`

export async function parseResume(
  rawText: string,
  ai: AIProvider
): Promise<ParsedResume> {
  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: rawText },
  ]

  const response = await ai.chat(messages)
  const parsed = parseResumeResponse(response)
  
  if (!parsed) {
    throw new Error('Failed to parse resume response')
  }
  
  return parsed
}

export function parseResumeResponse(raw: string): ParsedResume | null {
  try {
    const cleaned = raw.trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    
    if (!jsonMatch) {
      return null
    }
    
    const parsed = JSON.parse(jsonMatch[0])
    
    return {
      experience: Array.isArray(parsed.experience) ? parsed.experience : [],
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      education_credentials: Array.isArray(parsed.education_credentials) 
        ? parsed.education_credentials 
        : [],
    }
  } catch (error) {
    console.error('Failed to parse resume response:', error)
    return null
  }
}
