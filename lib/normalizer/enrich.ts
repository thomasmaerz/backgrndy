export interface Claim {
  role_type?: string;
  function?: string;
  tech_stack?: string[];
  metric_type?: string;
  metric_value?: string;
  scope?: string;
  leadership?: boolean;
  domain?: string;
}

export function buildEnrichmentPrompt(bullet: string, existingFields?: Partial<Claim>): string {
  let context = '';
  
  if (existingFields && Object.keys(existingFields).length > 0) {
    const filledFields = Object.entries(existingFields)
      .filter(([_, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `  - ${k}: ${JSON.stringify(v)}`)
      .join('\n');
    if (filledFields) {
      context = `\n\nThe following fields have already been extracted:\n${filledFields}`;
    }
  }

  return `You are a resume enrichment assistant. Analyze the following resume bullet point and extract structured data.

Resume bullet: "${bullet}"

Extract these fields:
- role_type: The job title or role (e.g., "Software Engineer", "Product Manager")
- function: The primary function or area (e.g., "Engineering", "Sales", "Marketing")
- tech_stack: Array of technologies, tools, or skills mentioned
- metric_type: The type of metric if applicable (e.g., "revenue", "users", "time", "percentage", "count", "cost_savings", "growth")
- metric_value: The numerical value if applicable (e.g., "25%", "$1M", "50 users")
- scope: The scope/scale of the achievement (e.g., "team", "company", "region", "product")
- leadership: Whether this describes a leadership/management role (true/false)
- domain: The industry or domain (e.g., "fintech", "healthcare", "e-commerce")

IMPORTANT: First assess whether this bullet is the kind that CAN have quantified metrics. A soft skill bullet (e.g., "excellent communication skills") or a process description (e.g., "followed agile methodologies") typically cannot have meaningful metrics.

If no metric is applicable, return the JSON with:
- metricsApplicable: false
- All other fields as null

If metrics ARE applicable, return:
- metricsApplicable: true
- All the fields above with actual values

Respond with ONLY valid JSON, no markdown, no explanation.
${context}

Example output:
{"role_type": "Software Engineer", "function": "Engineering", "tech_stack": ["Python", "AWS", "React"], "metric_type": "users", "metric_value": "1M+", "scope": "company", "leadership": false, "domain": "fintech", "metricsApplicable": true}`;
}

export function parseEnrichmentResponse(raw: string): Partial<Claim> & { metricsApplicable?: boolean } {
  try {
    // Try to extract JSON from the response (in case AI adds markdown wrappers)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {};
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Remove metricsApplicable from the returned fields (it's a signal, not a claim field)
    const { metricsApplicable, ...claim } = parsed;
    
    return {
      ...claim,
      metricsApplicable,
    };
  } catch {
    return {};
  }
}
