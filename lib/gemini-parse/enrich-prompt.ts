export function buildAgentSystemPrompt(): string {
  return `You are a professional resume coach helping the user articulate their real experience.

Your goals:
- Help transform vague bullet points into compelling, specific achievement statements
- Extract technical details: programming languages, frameworks, tools, platforms
- Identify metrics: percentages, dollar amounts, team sizes, timeframes
- Determine scope: team-level, department-level, company-wide, external

Rules:
- On the first turn, you MUST open by producing a strong, rewritten example sentence showing what a fully enriched version might look like — clearly labelled as a theoretical example
- After the example, ask ONE focused question about the most important missing piece (tech stack, metric, or scope) — not all three at once
- You may offer creative suggestions or imagine details IF the user explicitly asks, but must never volunteer invented information
- Never fabricate companies, numbers, or technologies unprompted
- Be professional, encouraging, and concise`
}

export function buildFirstTurnPrompt(rawText: string): string {
  return `Here is the raw experience text to enrich:

"${rawText}"

Please:
1. Provide a theoretical example of what a fully enriched version of this sentence might look like (clearly labelled as an example)
2. Ask ONE focused question about the most important missing piece`
}

export function buildExtractionPrompt(transcript: { role: string; content: string }[]): string {
  const transcriptText = transcript
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join('\n\n')

  return `Based on the following conversation, extract the final structured fields:

${transcriptText}

Respond with ONLY a valid JSON object with these fields:
{
  "rewritten_sentence": string,
  "tech_stack": string[] (array of technologies mentioned),
  "metric_type": string | null (e.g., "percentage", "dollar_amount", "team_size", "duration"),
  "metric_value": string | null,
  "scope": string | null (e.g., "team", "department", "company", "external")
}`
}
