/**
 * POST /api/upload
 *
 * Handles file uploads (livestock photos).
 * Saves files to the local filesystem at public/uploads/ so they can
 * be served as static files by Next.js (e.g., /uploads/12345-abc.jpg).
 *
 * Flow:
 * 1. Verifies the user is logged in (via session cookie)
 * 2. Reads the file from the multipart form data
 * 3. Generates a unique filename using timestamp + random string
 * 4. Creates the uploads directory if it doesn't exist
 * 5. Writes the file to disk
 * 6. Returns the public URL path
 *
 * Note: In production, you'd want to use cloud storage (S3, etc.) instead.
 */

import { getSessionUserId } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  // Auth check — only logged-in users can upload
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Generate a unique filename: timestamp-randomstring.extension
  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  // Ensure the uploads directory exists
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });

  // Write the file to disk
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, fileName), buffer);

  // Return the public URL path (served by Next.js static file serving)
  return NextResponse.json({ url: `/uploads/${fileName}` });
}
