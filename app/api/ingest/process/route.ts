import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { parsePdf } from '@/lib/parsers/pdf';
import { parseDocx } from '@/lib/parsers/docx';
import { parseCsv } from '@/lib/parsers/csv';
import { bulletHash } from '@/lib/dedup/hash';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

async function handleUpload(request: NextRequest) {
  const contentLength = request.headers.get('content-length');
  
  if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
    throw { status: 413, message: 'File too large. Maximum size is 50MB.' };
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  
  if (!file) {
    throw { status: 400, message: 'No file provided' };
  }

  const filename = file.name;
  const ext = filename.split('.').pop()?.toLowerCase();
  
  if (!ext || !['pdf', 'docx', 'csv'].includes(ext)) {
    throw { status: 400, message: 'Unsupported file type. Use .pdf, .docx, or .csv' };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const supabase = await createSupabaseServerClient();

  const { data: resumeRecord, error: insertError } = await supabase
    .from('rm_source_resumes')
    .insert({
      filename,
      file_type: ext,
      status: 'pending',
    })
    .select()
    .single();

  if (insertError) throw insertError;

  let parsed;
  let rawText = '';

  try {
    if (ext === 'pdf') {
      parsed = await parsePdf(buffer);
    } else if (ext === 'docx') {
      parsed = await parseDocx(buffer);
    } else if (ext === 'csv') {
      parsed = await parseCsv(buffer);
    }
    
    rawText = parsed?.rawText || '';
  } catch (parseError) {
    await supabase
      .from('rm_source_resumes')
      .update({ status: 'failed' })
      .eq('id', resumeRecord.id);

    throw { status: 422, message: `Parse error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}` };
  }

  await supabase
    .from('rm_source_resumes')
    .update({ raw_text: rawText })
    .eq('id', resumeRecord.id);

  return {
    resumeId: resumeRecord.id,
    sections: parsed!.sections,
  };
}

async function handleStage(resumeId: string, sections: any, supabase: any) {
  let staged = 0;
  let duplicates = 0;

  for (const bullet of sections.experience) {
    const hash = bulletHash(bullet);

    const { data: existing } = await supabase
      .from('rm_bullets_staging')
      .select('id')
      .eq('bullet_hash', hash)
      .single();

    if (existing) {
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

  let skills = 0;
  for (const skill of sections.skills) {
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
      const { error: junctionError } = await supabase
        .from('rm_skills_sources')
        .upsert({
          skill_id: skillId,
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

  let intros = 0;
  const contentHash = require('crypto')
    .createHash('sha256')
    .update(sections.intro.join(' '))
    .digest('hex');

  for (const intro of sections.intro) {
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
      const { error: junctionError } = await supabase
        .from('rm_intros_sources')
        .upsert({
          intro_id: introId,
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

  return { staged, duplicates, skills, intros };
}

export async function POST(request: NextRequest) {
  try {
    const uploadResult = await handleUpload(request);
    
    const supabase = await createSupabaseServerClient();
    const stageResult = await handleStage(uploadResult.resumeId, uploadResult.sections, supabase);

    await supabase
      .from('rm_source_resumes')
      .update({ status: 'parsed' })
      .eq('id', uploadResult.resumeId);

    return NextResponse.json({
      resumeId: uploadResult.resumeId,
      ...stageResult,
      sectionCounts: {
        experience: uploadResult.sections.experience.length,
        skills: uploadResult.sections.skills.length,
        intro: uploadResult.sections.intro.length,
        other: uploadResult.sections.other.length,
      },
    });
  } catch (error: any) {
    console.error('Ingest error:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: error.status || 500 }
    );
  }
}
