'use server'

import { promises as fs } from 'fs';
import path from 'path';
import { validateUploadedFile } from '@/lib/upload-validator';

export async function uploadFileAction(formData: FormData) {
  const file = formData.get('file') as File | null;
  
  if (!file) {
    throw new Error("No file received.");
  }

  const validation = await validateUploadedFile(file);
  if (!validation.success) {
    throw new Error(validation.error);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  
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
  
  const uploadDir = path.join(process.cwd(), 'public/uploads/projects');
  await fs.mkdir(uploadDir, { recursive: true });
  
  const filepath = path.join(uploadDir, filename);
  await fs.writeFile(filepath, buffer);

  return `/uploads/projects/${filename}`;
}
