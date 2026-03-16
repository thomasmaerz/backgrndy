import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { extractPdfText } from '@/lib/parsers/pdf';
import { extractDocxText } from '@/lib/parsers/docx';
import { extractCsvText } from '@/lib/parsers/csv';
import { contentHash } from '@/lib/dedup/hash';
import { detectSectionsFromText } from '@/lib/parsers/sections';

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
  const supabase = createServerClient();

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

  let rawText = '';

  try {
    if (ext === 'pdf') {
      rawText = await extractPdfText(buffer);
    } else if (ext === 'docx') {
      rawText = await extractDocxText(buffer);
    } else if (ext === 'csv') {
      rawText = await extractCsvText(buffer);
    }
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

  const sections = detectSectionsFromText(rawText);

  return {
    resumeId: resumeRecord.id,
    sections,
  };
}

async function handleStage(resumeId: string, sections: any, supabase: any) {
  let staged = 0;
  let duplicates = 0;

  for (const bullet of sections.experience) {
    const hash = contentHash(bullet);

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
  const introContentHash = require('crypto')
    .createHash('sha256')
    .update(sections.intro.join(' '))
    .digest('hex');

  for (const intro of sections.intro) {
    const introTrimmed = intro.trim();
    if (!introTrimmed) continue;

    const { data: existingIntro } = await supabase
      .from('rm_intros')
      .select('id')
      .eq('content_hash', introContentHash)
      .single();

    let introId = existingIntro?.id;

    if (!introId) {
      const { data: newIntro } = await supabase
        .from('rm_intros')
        .insert({ content: introTrimmed, content_hash: introContentHash })
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
    
  const supabase = createServerClient();
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
