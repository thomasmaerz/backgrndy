import { parsePdf, ParsedResume } from '@/lib/parsers/pdf';
import { parseDocx } from '@/lib/parsers/docx';
import { parseCsv } from '@/lib/parsers/csv';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { bulletHash } from '@/lib/dedup/hash';

/**
 * Parse a resume file buffer based on file type
 * @param buffer - The file buffer
 * @param fileType - One of 'pdf', 'docx', 'csv'
 * @returns Parsed resume with raw text and categorized sections
 */
export async function parseResume(buffer: Buffer, fileType: 'pdf' | 'docx' | 'csv'): Promise<ParsedResume> {
  switch (fileType) {
    case 'pdf':
      return parsePdf(buffer);
    case 'docx':
      return parseDocx(buffer);
    case 'csv':
      return parseCsv(buffer);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

/**
 * Stage a parsed resume into the database with deduplication
 * @param parsed - The parsed resume sections
 * @param resumeId - The source resume ID
 * @returns Staging statistics
 */
export async function stageResume(parsed: ParsedResume, resumeId: string) {
  const supabase = await createSupabaseServerClient();

  let staged = 0;
  let duplicates = 0;

  // Process experience bullets
  for (const bullet of parsed.sections.experience) {
    const hash = bulletHash(bullet);

    const { data: existing } = await supabase
      .from('rm_bullets_staging')
      .select('id')
      .eq('bullet_hash', hash)
      .single();

    if (existing) {
      await supabase
        .from('rm_bullets_staging')
        .update({ is_duplicate: true, canonical_id: existing.id })
        .eq('bullet_hash', hash);
      duplicates++;
    } else {
      const { error } = await supabase
        .from('rm_bullets_staging')
        .insert({
          source_resume_id: resumeId,
          raw_bullet: bullet,
          bullet_hash: hash,
          section: 'experience',
        });

      if (!error) staged++;
    }
  }

  // Process skills
  let skills = 0;
  for (const skill of parsed.sections.skills) {
    const skillTrimmed = skill.trim();
    if (!skillTrimmed) continue;

    const { data: existingSkill } = await supabase
      .from('rm_skills')
      .select('id')
      .eq('skill', skillTrimmed)
      .single();

    let skillId = existingSkill?.id;

    if (!skillId) {
      const { data: newSkill } = await supabase
        .from('rm_skills')
        .insert({ skill: skillTrimmed })
        .select()
        .single();
      skillId = newSkill?.id;
    }

    if (skillId) {
      const { error } = await supabase
        .from('rm_skills_sources')
        .upsert({
          skill_id: skillId,
          source_resume_id: resumeId,
        }, {
          onConflict: 'skill_id,source_resume_id',
          ignoreDuplicates: true
        });

      if (!error || error.code === '23505') skills++;
    }
  }

  // Process intros
  let intros = 0;
  const contentHash = require('crypto')
    .createHash('sha256')
    .update(parsed.sections.intro.join(' '))
    .digest('hex');

  for (const intro of parsed.sections.intro) {
    const introTrimmed = intro.trim();
    if (!introTrimmed) continue;

    const { data: existingIntro } = await supabase
      .from('rm_intros')
      .select('id')
      .eq('content_hash', contentHash)
      .single();

    let introId = existingIntro?.id;

    if (!introId) {
      const { data: newIntro } = await supabase
        .from('rm_intros')
        .insert({ content: introTrimmed, content_hash: contentHash })
        .select()
        .single();
      introId = newIntro?.id;
    }

    if (introId) {
      const { error } = await supabase
        .from('rm_intros_sources')
        .upsert({
          intro_id: introId,
          source_resume_id: resumeId,
        }, {
          onConflict: 'intro_id,source_resume_id',
          ignoreDuplicates: true
        });

      if (!error || error.code === '23505') intros++;
    }
  }

  return { staged, duplicates, skills, intros };
}

/**
 * Run one enrichment turn on a bullet
 * @param stagingId - The staging bullet ID
 * @returns Enrichment result
 */
export async function enrichBullet(stagingId: string) {
  const supabase = await createSupabaseServerClient();
  const { aiProvider } = await import('@/lib/ai');
  const { buildEnrichmentPrompt, parseEnrichmentResponse } = await import('@/lib/normalizer/enrich');

  const { data: stagingRow } = await supabase
    .from('rm_bullets_staging')
    .select('*')
    .eq('id', stagingId)
    .single();

  if (!stagingRow) {
    throw new Error('Staging row not found');
  }

  const messages = [{ 
    role: 'user' as const, 
    content: buildEnrichmentPrompt(stagingRow.raw_bullet) 
  }];

  const aiResponse = await aiProvider.chat(messages);
  const parsed = parseEnrichmentResponse(aiResponse);

  const hasRequiredFields = parsed.metric_type && parsed.metric_value && parsed.scope;
  const status = (parsed.metricsApplicable === false || hasRequiredFields) 
    ? 'enriched' 
    : 'pending';

  const { data: claim } = await supabase
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
      enrichment_status: status,
      promoted_at: status === 'enriched' ? new Date().toISOString() : null,
    })
    .select()
    .single();

  return { status, claim };
}

/**
 * Get all promoted atomic claims
 * @returns Array of enriched claims
 */
export async function getAtomicClaims() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('rm_claims')
    .select('*')
    .eq('enrichment_status', 'enriched')
    .order('promoted_at', { ascending: false });

  if (error) throw error;
  return data;
}
