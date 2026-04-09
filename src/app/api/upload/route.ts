import { getSessionUserId } from '@/lib/session';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  // 1. Auth check — only logged-in users can upload
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // 2. Generate a unique filename
  const ext = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  // 3. ROUTE BASED ON ENVIRONMENT
  if (process.env.NODE_ENV === 'development') {
    // ==========================================
    // DEVELOPMENT: Save internally to local disk
    // ==========================================
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, fileName), buffer);

    return NextResponse.json({ url: `/uploads/${fileName}` });
  } else {
    // ==========================================
    // PRODUCTION: Upload live to Supabase
    // ==========================================
    const filePath = `livestock/${fileName}`;

    const { error } = await supabase.storage
      .from('uploads')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return NextResponse.json(
        { error: 'Failed to upload to cloud storage' },
        { status: 500 },
      );
    }

    // Get the public URL from Supabase
    const {
      data: { publicUrl },
    } = supabase.storage.from('uploads').getPublicUrl(filePath);

    return NextResponse.json({ url: publicUrl });
  }
}
