import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  const filePathArray = resolvedParams.path;
  
  if (!filePathArray || filePathArray.length === 0) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // 조립할 로컬 디스크 물리 경로: C:\Github\BlockCanvas\public\uploads\...
  const physicalPath = path.join(
    process.cwd(),
    'public',
    'uploads',
    ...filePathArray
  );

  try {
    // 파일이 물리적으로 디스크에 실제로 존재하는지 확인
    await fs.access(physicalPath);
    
    // 파일 읽기
    const fileBuffer = await fs.readFile(physicalPath);
    
    // 확장자에 따른 Content-Type 유추
    const ext = path.extname(physicalPath).toLowerCase();
    let contentType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === '.gif') {
      contentType = 'image/gif';
    } else if (ext === '.webp') {
      contentType = 'image/webp';
    } else if (ext === '.svg') {
      contentType = 'image/svg+xml';
    }

    // 캐싱 방지 헤더(실시간성 반영용) 및 Content-Type 반환
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('API Static file serving error:', error);
    return new NextResponse('File Not Found', { status: 404 });
  }
}
