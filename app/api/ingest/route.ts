import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { parsePdf } from '@/lib/parsers/pdf';
import { parseDocx } from '@/lib/parsers/docx';
import { parseCsv } from '@/lib/parsers/csv';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
// NOTE: If deploying to Vercel free tier, lower this to 4718592 (4.5MB)
// as Vercel enforces a hard limit that cannot be overridden.

export async function POST(request: NextRequest) {
  const contentLength = request.headers.get('content-length');
  
  if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File too large. Maximum size is 50MB.' },
      { status: 413 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const filename = file.name;
    const ext = filename.split('.').pop()?.toLowerCase();
    
    if (!ext || !['pdf', 'docx', 'csv'].includes(ext)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Use .pdf, .docx, or .csv' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const supabase = await createSupabaseServerClient();

    // Insert placeholder record first
    const { data: resumeRecord, error: insertError } = await supabase
      .from('rm_source_resumes')
      .insert({
        filename,
        file_type: ext,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

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
      
      if (!parsed) {
        throw new Error('Failed to parse file');
      }
      
      rawText = parsed.rawText;
    } catch (parseError) {
      await supabase
        .from('rm_source_resumes')
        .update({ status: 'failed' })
        .eq('id', resumeRecord.id);

      return NextResponse.json(
        { error: `Parse error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}` },
        { status: 422 }
      );
    }

    // Update with parsed content
    await supabase
      .from('rm_source_resumes')
      .update({ raw_text: rawText })
      .eq('id', resumeRecord.id);

    return NextResponse.json({
      resumeId: resumeRecord.id,
      sectionCounts: {
        experience: parsed.sections.experience.length,
        skills: parsed.sections.skills.length,
        intro: parsed.sections.intro.length,
        other: parsed.sections.other.length,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
