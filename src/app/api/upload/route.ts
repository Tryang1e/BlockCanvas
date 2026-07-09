import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { validateUploadedFile } from '@/lib/upload-validator';
import { sessionProfile } from '@/lib/server-auth';
import { rateLimit } from '@/lib/rate-limit';
import { optimizeImage, toWebpName } from '@/lib/image-optimize';

export async function POST(request: Request) {
  try {
    // 로그인한 크리에이터만 업로드 허용 (익명 업로드 / 디스크 채우기 DoS 방지)
    // 🔒 M-3: verifySession → sessionProfile(=verifySessionFull + token_version 대조)로 승격.
    //    정지/영구차단은 token_version 을 올리므로, 제재된 유저의 구 세션이 계속 업로드하던 문제를 차단한다.
    const profile = await sessionProfile();
    if (!profile) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    const session = profile.creator_name;

    // 업로드 남용(디스크 채우기 DoS) 완화: 사용자당 분당 40회. (정상 대량 업로드엔 넉넉)
    if (!rateLimit('upload:' + session, 40, 60 * 1000)) {
      return NextResponse.json({ error: '업로드 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' }, { status: 429 });
    }

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
    
    const rawBuffer = Buffer.from(await file.arrayBuffer());

    // 이미지 자동 최적화(리사이즈 + WebP). 비대상/실패 시 원본 그대로.
    const opt = await optimizeImage(rawBuffer, file.type);
    const buffer = opt.buffer;

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

    // WebP로 변환된 경우 확장자 교체
    if (opt.optimized) {
      safeName = toWebpName(safeName);
    }
    const filename = `${uniqueSuffix}-${safeName}`;

    // Path maps to Next.js 'public' directory
    const uploadDir = path.join(process.cwd(), 'public/uploads/projects');

    // Ensure directory exists
    await fs.mkdir(uploadDir, { recursive: true });

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
