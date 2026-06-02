import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { validateUploadedFile } from '@/lib/upload-validator';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file received." }, { status: 400 });
    }

    // Call the cryptographic & size validation helper
    const validation = await validateUploadedFile(file);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    
    // Generate safe distinct filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    let safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // If the file extension was normalized/corrected (e.g., clipboard pasted files with 'blob' or no extensions),
    // we safely append the corrected extension so it retains proper headers and loads correctly!
    if (validation.correctedExtension) {
      const hasValidExtension = /\.(png|jpg|jpeg|gif|webp|mp4)$/i.test(safeName);
      if (!hasValidExtension) {
        safeName = `${safeName}.${validation.correctedExtension}`;
      }
    }
    const filename = `${uniqueSuffix}-${safeName}`;
    
    // Path maps to Next.js 'public' directory
    const uploadDir = path.join(process.cwd(), 'public/uploads/projects');
    
    // Ensure directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const filepath = path.join(uploadDir, filename);
    await fs.writeFile(filepath, buffer);

    // Relative URL for Next Image component & src tags
    const publicUrl = `/uploads/projects/${filename}`;

    return NextResponse.json({ url: publicUrl });
  } catch (error: any) {
    console.error("Upload API Error:", error);
    return NextResponse.json({ error: `Server Error: ${error.message || String(error)}` }, { status: 500 });
  }
}
