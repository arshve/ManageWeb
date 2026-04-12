import { getSessionUserId } from '@/lib/session';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { supabase, supabaseAdmin } from '@/lib/supabase';

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
  // Optional folder param — defaults to 'livestock'
  // Usage: POST /api/upload?folder=transfers
  const folder = request.nextUrl.searchParams.get('folder') ?? 'livestock';

  const ext = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  // 3. ROUTE BASED ON ENVIRONMENT
  if (process.env.NODE_ENV === 'development') {
    // ==========================================
    // DEVELOPMENT: Save internally to local disk
    // ==========================================
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder);
    await mkdir(uploadDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, fileName), buffer);
    return NextResponse.json({ url: `/uploads/${folder}/${fileName}` });
  } else {
    // ==========================================
    // PRODUCTION: Upload live to Supabase
    // ==========================================
    // Use the folder param — not hardcoded 'livestock'
    const filePath = `${folder}/${fileName}`;

    const { error } = await supabase.storage
      .from('uploads')
      .upload(filePath, file, { contentType: file.type, upsert: false });

    if (error) {
      console.error('Supabase upload error:', error);
      return NextResponse.json(
        { error: 'Failed to upload to cloud storage' },
        { status: 500 },
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('uploads').getPublicUrl(filePath);

    return NextResponse.json({ url: publicUrl });
  }
}

export async function DELETE(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { url } = await request.json();
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
  }

  if (process.env.NODE_ENV === 'development') {
    // In dev, url looks like /uploads/transfers/filename.jpg
    // Map it to the actual file path on disk
    try {
      const filePath = path.join(process.cwd(), 'public', url);
      await unlink(filePath);
    } catch {
      // File may already not exist — not a fatal error
    }
    return NextResponse.json({ success: true });
  } else {
    // In prod, extract the storage path from the Supabase public URL
    // URL format: https://xxx.supabase.co/storage/v1/object/public/uploads/folder/filename.jpg
    // We need: folder/filename.jpg
    const match = url.match(/\/object\/public\/uploads\/(.+)$/);
    if (!match) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 },
      );
    }

    const filePath = match[1]; // e.g. "transfers/filename.jpg"
    const { error } = await supabaseAdmin.storage.from('uploads').remove([filePath]);

    if (error) {
      console.error('Supabase delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete from cloud storage' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  }
}
