'use server'

import { promises as fs } from 'fs';
import path from 'path';

export async function uploadFileAction(formData: FormData) {
  const file = formData.get('file') as File | null;
  
  if (!file) {
    throw new Error("No file received.");
  }

  if (file.size > 1024 * 1024 * 1024) {
    throw new Error("File exceeds 1GB limit.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filename = `${uniqueSuffix}-${safeName}`;
  
  const uploadDir = path.join(process.cwd(), 'public/uploads/projects');
  await fs.mkdir(uploadDir, { recursive: true });
  
  const filepath = path.join(uploadDir, filename);
  await fs.writeFile(filepath, buffer);

  return `/uploads/projects/${filename}`;
}
