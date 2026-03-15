import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { aiProvider } from '@/lib/ai';
import { buildEnrichmentPrompt, parseEnrichmentResponse, Claim } from '@/lib/normalizer/enrich';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stagingId, conversationHistory, userMessage, action } = body as {
      stagingId: string;
      conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
      userMessage?: string;
      action?: 'skip';
    };

    if (!stagingId) {
      return NextResponse.json({ error: 'Missing stagingId' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    // Fetch the raw bullet
    const { data: stagingRow, error: fetchError } = await supabase
      .from('rm_bullets_staging')
      .select('*')
      .eq('id', stagingId)
      .single();

    if (fetchError || !stagingRow) {
      return NextResponse.json({ error: 'Staging row not found' }, { status: 404 });
    }

    // Handle skip action
    if (action === 'skip') {
      const { data: claim, error: claimError } = await supabase
        .from('rm_claims')
        .insert({
          staging_id: stagingId,
          raw_bullet: stagingRow.raw_bullet,
          enrichment_status: 'skipped',
        })
        .select()
        .single();

      if (claimError) throw claimError;

      return NextResponse.json({ status: 'skipped', claimId: claim.id });
    }

    // Build messages for AI
    const messages: { role: 'user' | 'assistant' | 'system'; content: string }[] = conversationHistory || [];

    // If no conversation history, start fresh
    if (messages.length === 0) {
      const prompt = buildEnrichmentPrompt(stagingRow.raw_bullet);
      messages.push({ role: 'user', content: prompt });
    } else if (userMessage) {
      // Continue conversation with user's answer
      messages.push({ role: 'user', content: userMessage });
    }

    // Call AI
    const aiResponse = await aiProvider.chat(messages);
    messages.push({ role: 'assistant', content: aiResponse });

    // Parse response
    const parsed = parseEnrichmentResponse(aiResponse);

    // Check if metrics are applicable
    if (parsed.metricsApplicable === false) {
      // Auto-promote with enriched status
      const { data: claim, error: claimError } = await supabase
        .from('rm_claims')
        .insert({
          staging_id: stagingId,
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

      if (claimError) throw claimError;

      return NextResponse.json({ status: 'complete', claimId: claim.id });
    }

    // Check if we have the required fields
    const hasRequiredFields = parsed.metric_type && parsed.metric_value && parsed.scope;

    if (hasRequiredFields) {
      // All required fields present - promote
      const { data: claim, error: claimError } = await supabase
        .from('rm_claims')
        .insert({
          staging_id: stagingId,
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

      if (claimError) throw claimError;

      return NextResponse.json({ status: 'complete', claimId: claim.id });
    }

    // Need more input - create pending claim and ask question
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

    // Check if there's already a pending claim
    const { data: existingClaim } = await supabase
      .from('rm_claims')
      .select('id')
      .eq('staging_id', stagingId)
      .eq('enrichment_status', 'pending')
      .single();

    let claimId = existingClaim?.id;

    if (!claimId) {
      const { data: newClaim } = await supabase
        .from('rm_claims')
        .insert({
          staging_id: stagingId,
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

      claimId = newClaim?.id;
    }

    // Generate a follow-up question
    const missingFields: string[] = [];
    if (!parsed.metric_type) missingFields.push('metric type');
    if (!parsed.metric_value) missingFields.push('metric value');
    if (!parsed.scope) missingFields.push('scope');

    const question = `To complete this entry, please provide: ${missingFields.join(', ')}. For example: "${stagingRow.raw_bullet}" involved [scope] with [metric_value] [metric_type].`;

    return NextResponse.json({
      status: 'needs_input',
      question,
      partialClaim,
      conversationHistory: messages,
      claimId,
    });
  } catch (error) {
    console.error('Enrichment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
