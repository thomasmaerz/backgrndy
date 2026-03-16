import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAIProvider } from '@/lib/ai'
import { Message } from '@/lib/ai'
import {
  buildAgentSystemPrompt,
  buildExtractionPrompt,
} from '@/lib/gemini-parse/enrich-prompt'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const ai = getAIProvider()

    const body = await request.json()
    const cursor = body.cursor || null
    const batchSize = body.batchSize || 5

    // Get next batch of staging rows that need enrichment
    let query = supabase
      .from('rmc_experience_staging')
      .select('id, raw_text, company_name_raw, company_id')
      .eq('is_duplicate', false)
      .order('id', { ascending: true })
      .limit(batchSize)

    if (cursor) {
      query = query.gt('id', cursor)
    }

    const { data: stagingRows, error } = await query

    if (error || !stagingRows || stagingRows.length === 0) {
      return NextResponse.json({
        processed: 0,
        enriched: 0,
        needsInput: 0,
        nextCursor: null,
      })
    }

    let enriched = 0
    let needsInput = 0

    for (const row of stagingRows) {
      // Check if already has claims
      const { data: existingClaim } = await supabase
        .from('rmc_claims')
        .select('id')
        .eq('staging_id', row.id)
        .single()

      if (existingClaim) {
        continue
      }

      // Single-turn extraction
      const systemPrompt = buildAgentSystemPrompt()
      const userPrompt = `${buildFirstTurnPrompt(row.raw_text)}\n\nRespond with the final JSON extraction directly — no conversation needed.`

      const messages: Message[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]

      try {
        const extractionResponse = await ai.extract(messages)

        let extracted = null
        try {
          const jsonMatch = extractionResponse.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            extracted = JSON.parse(jsonMatch[0])
          }
        } catch (e) {
          console.error('Failed to parse extraction:', e)
        }

        if (extracted && extracted.rewritten_sentence) {
          await supabase.from('rmc_claims').insert({
            staging_id: row.id,
            company_id: row.company_id,
            raw_text: row.raw_text,
            rewritten_sentence: extracted.rewritten_sentence || null,
            tech_stack: extracted.tech_stack || [],
            metric_type: extracted.metric_type || null,
            metric_value: extracted.metric_value || null,
            scope: extracted.scope || null,
            enrichment_status: 'enriched',
            promoted_at: new Date().toISOString(),
          })
          enriched++
        } else {
          needsInput++
        }
      } catch (e) {
        console.error('Batch extraction error:', e)
        needsInput++
      }

      // 200ms delay between calls
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    const lastRow = stagingRows[stagingRows.length - 1]

    return NextResponse.json({
      processed: stagingRows.length,
      enriched,
      needsInput,
      nextCursor: lastRow?.id || null,
    })
  } catch (error) {
    console.error('Batch enrich error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function buildFirstTurnPrompt(rawText: string): string {
  return `Here is the raw experience text to enrich:

"${rawText}"

Please provide a theoretical example of what a fully enriched version of this sentence might look like.`
}
