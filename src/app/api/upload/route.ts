import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file received." }, { status: 400 });
    }

    if (file.size > 1024 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds 1GB limit." }, { status: 413 });
    }
    
    // Generate safe distinct filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
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
