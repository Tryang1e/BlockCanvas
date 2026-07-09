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

  // 숨김파일(.env, .git 등)·점으로 시작하는 세그먼트 차단. 정상 업로드 파일명은 점으로 시작하지 않으므로
  // 스캐너의 시크릿 탐색(/uploads/.env 등)을 조용히 404 처리한다(경로탈출 .. 세그먼트도 함께 막힘).
  if (filePathArray.some((seg) => seg.startsWith('.'))) {
    return new NextResponse('File Not Found', { status: 404 });
  }

  // 조립할 로컬 디스크 물리 경로: C:\Github\BlockCanvas\public\uploads\...
  const uploadsRoot = path.join(process.cwd(), 'public', 'uploads');
  const physicalPath = path.resolve(uploadsRoot, ...filePathArray);

  // 경로 탐색(Path Traversal) 방지: uploads 디렉터리 하위 경로만 허용한다.
  if (physicalPath !== uploadsRoot && !physicalPath.startsWith(uploadsRoot + path.sep)) {
    return new NextResponse('File Not Found', { status: 404 });
  }

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
  } catch (error: unknown) {
    // 파일 없음(ENOENT)은 흔한 정상 404(스캐너 탐색·오타 링크 등) → 로그 소음을 줄이려 에러 로깅 생략.
    // 그 외(권한 등 예기치 못한 오류)만 로깅한다.
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.error('API Static file serving error:', error);
    }
    return new NextResponse('File Not Found', { status: 404 });
  }
}
