import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { aiProvider } from '@/lib/ai';
import { buildEnrichmentPrompt, parseEnrichmentResponse, Claim } from '@/lib/normalizer/enrich';

async function enrichSingleBullet(stagingRow: any, supabase: any): Promise<{
  status: 'enriched' | 'needs_input' | 'error';
  claimId?: string;
  partialClaim?: Partial<Claim>;
  question?: string;
}> {
  try {
    const messages = [{ role: 'user' as const, content: buildEnrichmentPrompt(stagingRow.raw_bullet) }];
    
    const aiResponse = await aiProvider.chat(messages);
    const parsed = parseEnrichmentResponse(aiResponse);

    // Check if metrics are applicable
    if (parsed.metricsApplicable === false) {
      const { data: claim } = await supabase
        .from('rm_claims')
        .insert({
          staging_id: stagingRow.id,
          raw_bullet: stagingRow.raw_bullet,
          role_type: parsed.role_type,
          function: parsed.function,
          tech_stack: parsed.tech_stack,
          metric_type: parsed.metric_type,
          metric_value: parsed.metric_value,
          scope: parsed.scope,
          leadership: parsed.leadership,
          domain: parsed.domain,
          enrichment_status: 'enriched',
          promoted_at: new Date().toISOString(),
        })
        .select()
        .single();

      return { status: 'enriched', claimId: claim?.id };
    }

    // Check if we have required fields
    const hasRequiredFields = parsed.metric_type && parsed.metric_value && parsed.scope;

    if (hasRequiredFields) {
      const { data: claim } = await supabase
        .from('rm_claims')
        .insert({
          staging_id: stagingRow.id,
          raw_bullet: stagingRow.raw_bullet,
          role_type: parsed.role_type,
          function: parsed.function,
          tech_stack: parsed.tech_stack,
          metric_type: parsed.metric_type,
          metric_value: parsed.metric_value,
          scope: parsed.scope,
          leadership: parsed.leadership,
          domain: parsed.domain,
          enrichment_status: 'enriched',
          promoted_at: new Date().toISOString(),
        })
        .select()
        .single();

      return { status: 'enriched', claimId: claim?.id };
    }

    // Need input - create pending claim
    const partialClaim: Partial<Claim> = {
      role_type: parsed.role_type,
      function: parsed.function,
      tech_stack: parsed.tech_stack,
      metric_type: parsed.metric_type,
      metric_value: parsed.metric_value,
      scope: parsed.scope,
      leadership: parsed.leadership,
      domain: parsed.domain,
    };

    const { data: claim } = await supabase
      .from('rm_claims')
      .insert({
        staging_id: stagingRow.id,
        raw_bullet: stagingRow.raw_bullet,
        role_type: parsed.role_type,
        function: parsed.function,
        tech_stack: parsed.tech_stack,
        metric_type: parsed.metric_type,
        metric_value: parsed.metric_value,
        scope: parsed.scope,
        leadership: parsed.leadership,
        domain: parsed.domain,
        enrichment_status: 'pending',
        enrichment_notes: JSON.stringify(partialClaim),
      })
      .select()
      .single();

    const missingFields: string[] = [];
    if (!parsed.metric_type) missingFields.push('metric type');
    if (!parsed.metric_value) missingFields.push('metric value');
    if (!parsed.scope) missingFields.push('scope');

    const question = `To complete this entry, please provide: ${missingFields.join(', ')}.`;

    return {
      status: 'needs_input',
      claimId: claim?.id,
      partialClaim,
      question,
    };
  } catch (error) {
    console.error('Batch enrich error for bullet:', stagingRow.id, error);
    return { status: 'error' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { cursor, batchSize = 5 } = await request.json() as {
      cursor?: string;
      batchSize?: number;
    };

    const supabase = await createSupabaseServerClient();

    // Fetch bullets that need enrichment
    let query = supabase
      .from('rm_bullets_staging')
      .select(`
        id,
        raw_bullet,
        section,
        is_duplicate
      `)
      .eq('is_duplicate', false)
      .order('id', { ascending: true })
      .limit(batchSize);

    if (cursor) {
      query = query.gt('id', cursor);
    }

    const { data: stagingRows, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    if (!stagingRows || stagingRows.length === 0) {
      return NextResponse.json({
        processed: 0,
        enriched: 0,
        needsInput: 0,
        nextCursor: null,
      });
    }

    let enriched = 0;
    let needsInput = 0;
    let lastId = cursor || '';

    for (const row of stagingRows) {
      // Skip if already has a claim
      const { data: existingClaim } = await supabase
        .from('rm_claims')
        .select('id')
        .eq('staging_id', row.id)
        .single();

      if (existingClaim) {
        lastId = row.id;
        continue;
      }

      const result = await enrichSingleBullet(row, supabase);

      if (result.status === 'enriched') {
        enriched++;
      } else if (result.status === 'needs_input') {
        needsInput++;
      }

      lastId = row.id;

      // Rate limiting - 200ms delay
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Check if there are more rows
    const { count } = await supabase
      .from('rm_bullets_staging')
      .select('id', { count: 'exact', head: true })
      .eq('is_duplicate', false)
      .gt('id', lastId);

    return NextResponse.json({
      processed: stagingRows.length,
      enriched,
      needsInput,
      nextCursor: count && count > 0 ? lastId : null,
    });
  } catch (error) {
    console.error('Batch enrich error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
