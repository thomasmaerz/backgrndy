import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { bulletHash } from '@/lib/dedup/hash';
import { ParsedResume } from '@/lib/parsers/sections';

export async function POST(request: NextRequest) {
  try {
    const { resumeId, sections } = await request.json() as {
      resumeId: string;
      sections: ParsedResume['sections'];
    };

    if (!resumeId || !sections) {
      return NextResponse.json(
        { error: 'Missing resumeId or sections' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    let staged = 0;
    let duplicates = 0;

    // Process experience bullets with dedup
    for (const bullet of sections.experience) {
      const hash = bulletHash(bullet);

      const { data: existing } = await supabase
        .from('rm_bullets_staging')
        .select('id')
        .eq('bullet_hash', hash)
        .single();

      if (existing) {
        // Mark as duplicate
        await supabase
          .from('rm_bullets_staging')
          .update({ 
            is_duplicate: true, 
            canonical_id: existing.id 
          })
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

        if (!error) {
          staged++;
        }
      }
    }

    // Process skills with junction table
    let skills = 0;
    for (const skill of sections.skills) {
      const skillTrimmed = skill.trim();
      if (!skillTrimmed) continue;

      // Upsert skill
      const { data: skillRecord, error: skillError } = await supabase
        .from('rm_skills')
        .upsert(
          { skill: skillTrimmed },
          { onConflict: 'skill', ignoreDuplicates: true }
        )
        .select()
        .single();

      if (skillError && !skillError.message.includes('duplicate')) {
        console.error('Skill upsert error:', skillError);
        continue;
      }

      // Get the skill ID (either newly created or existing)
      const { data: existingSkill } = await supabase
        .from('rm_skills')
        .select('id')
        .eq('skill', skillTrimmed)
        .single();

      if (existingSkill) {
        // Insert junction record (ignore if already exists)
        const { error: junctionError } = await supabase
          .from('rm_skills_sources')
          .upsert({
            skill_id: existingSkill.id,
            source_resume_id: resumeId,
          }, {
            onConflict: 'skill_id,source_resume_id',
            ignoreDuplicates: true
          });

        if (!junctionError || junctionError.code === '23505') {
          skills++;
        }
      }
    }

    // Process intros with junction table
    let intros = 0;
    const contentHash = require('crypto')
      .createHash('sha256')
      .update(sections.intro.join(' '))
      .digest('hex');

    for (const intro of sections.intro) {
      const introTrimmed = intro.trim();
      if (!introTrimmed) continue;

      // Upsert intro
      const { data: introRecord, error: introError } = await supabase
        .from('rm_intros')
        .upsert(
          { content: introTrimmed, content_hash: contentHash },
          { onConflict: 'content_hash', ignoreDuplicates: true }
        )
        .select()
        .single();

      if (introError && !introError.message.includes('duplicate')) {
        console.error('Intro upsert error:', introError);
        continue;
      }

      // Get the intro ID
      const { data: existingIntro } = await supabase
        .from('rm_intros')
        .select('id')
        .eq('content_hash', contentHash)
        .single();

      if (existingIntro) {
        // Insert junction record
        const { error: junctionError } = await supabase
          .from('rm_intros_sources')
          .upsert({
            intro_id: existingIntro.id,
            source_resume_id: resumeId,
          }, {
            onConflict: 'intro_id,source_resume_id',
            ignoreDuplicates: true
          });

        if (!junctionError || junctionError.code === '23505') {
          intros++;
        }
      }
    }

    return NextResponse.json({
      staged,
      duplicates,
      skills,
      intros,
    });
  } catch (error) {
    console.error('Staging error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
