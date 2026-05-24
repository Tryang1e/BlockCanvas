# 프로필 및 배경화면 업로드 이미지의 프로덕션 실시간 서빙 버그 수정 완료

## 1. 문제 정의
* **상황**: 로컬 개발 모드(`npm run dev`)가 아닌, 외부 공개 배포 모드(`npm run start` - 프로덕션) 환경에서 사이트를 서빙 중입니다.
* **현상**: 사용자가 "이미지 바꾸기(배경화면)" 또는 "프로필 사진 바꾸기"를 통해 이미지를 성공적으로 업로드해도, Next.js의 빌드타임 static asset 캐싱 한계로 인해 새로고침 시 이미지가 **404 Not Found** 또는 **received null** 에러를 유발하며 엑스박스(깨진 그림) 상태로 렌더링되는 치명적인 제약이 있었습니다.

---

## 2. 근본적인 원인

### 원인 A: Next.js 프로덕션 서버(`next start`)의 런타임 정적 자원 감지 제약
* Next.js 프로덕션 서버는 빌드 당시에 존재하던 `/public` 디렉토리 내 정적 파일 정보만 캐싱합니다. 
* 런타임 도중에 추가된 파일은 정적 서빙 필터에 등록되지 않아 404 Not Found를 뿜으며 엑스박스 오류를 만듭니다.

### 원인 B: SQLite 데이터베이스의 상대 경로 `./dev.db` 유실 오류 (NEW ⭐)
* `src/lib/prisma.ts` 내부에서 SQLite 파일 경로를 `url: 'file:./dev.db'` 와 같이 상대 경로로 명시하고 있었습니다.
* **문제점**: Next.js가 `npm run start`로 구동되거나 `next build` 빌드 타임에 서버 컴포넌트 및 빌드 워커를 수행할 때, 실행되는 프로세스의 작업 기준 폴더가 달라져서 엉뚱한 위치(예: `.next/server/dev.db`)를 빈 데이터베이스로 새로 만들어 조회하게 됩니다.
* **결과**: 이에 따라 실제 프로젝트 루트의 `dev.db` 데이터가 아닌 빈 DB를 읽게 되어 `--- DEBUG PROFILE DATA --- null` 에러가 발생하고 강제로 404 페이지로 리다이렉트되는 데이터 유실 문제가 유발되었습니다.

---

## 3. 해결 조치 사항 (프로덕션 완전 해결)

### A. SQLite 데이터베이스 경로의 '절대 경로화' (데이터 유실 차단)
* **수정 파일**: `src/lib/prisma.ts` ([prisma.ts](file:///c:/Github/BlockCanvas/src/lib/prisma.ts))
* **조치**: 어떤 빌더나 컴포넌트 런타임 환경에서도 항상 루트 디렉토리의 진짜 `dev.db` 데이터를 조회할 수 있도록 절대 경로 조립 방식을 적용했습니다.
  ```typescript
  import path from 'path'
  
  const adapter = new PrismaLibSql({
    url: 'file:' + path.join(process.cwd(), 'dev.db'),
  })
  ```

### B. 동적 미디어 서빙 라우트 추가 (런타임 업로드 404 차단)
* **경로**: `src/app/uploads/[...path]/route.ts` ([route.ts](file:///c:/Github/BlockCanvas/src/app/uploads/[...path]/route.ts))
* **역할**: 브라우저가 `/uploads/projects/[filename]`과 같은 런타임 업로드 정적 경로를 요청할 때, Next.js의 Dynamic App Router가 요청을 낚아채어 서버 물리 디스크에 실시간 저장된 미디어 바이트를 디스크에서 직접 읽어(I/O Stream) 브라우저로 쏴줍니다.

### C. 프로필 아바타 렌더링에 최적화 우회 적용
* **수정 파일**: 
  1. `UserSidebar.tsx` ([UserSidebar.tsx](file:///c:/Github/BlockCanvas/src/components/layout/UserSidebar.tsx))
  2. `BusinessCardContact.tsx` ([BusinessCardContact.tsx](file:///c:/Github/BlockCanvas/src/components/creator/BusinessCardContact.tsx))
* **조치**: Next.js의 `<Image>` 컴포넌트 최적화 서버에서 발생하는 캐싱 지연을 방지하기 위해 `unoptimized` 속성을 완벽하게 부여했습니다.

### D. 프로덕션 재빌드 완료
* 절대 경로 DB 맵과 미디어 서빙 라우터가 온전히 반영되도록 **`npm run build`를 방금 백그라운드 터미널에서 에러 없이 정상적으로 재수행 완료**했습니다!

---

## 4. 기대 효과
* 이제 프로덕션 배포 모드(`npm run start`)로 사이트를 가동해 두어도, 데이터베이스 조회가 유실되어 `null`을 뿜거나 페이지가 404로 도망가는 오류가 완전히 해결되었으며, 이미지 변경 시에도 즉시 깨짐 없이 선명하게 실시간 반영이 완료되는 견고한 배포 서버가 완성되었습니다.
