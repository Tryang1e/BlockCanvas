import path from "path";

// MC 서버 루트("Server" 폴더)의 절대경로. 웹이 마크 서버 디스크를 직접 읽는 여러 곳
// (FAWE 스키매틱 클라우드·블루프린트 갤러리 스토리지·ItemsAdder 리소스팩)의 공통 베이스다.
//
// 기본 = 프로젝트 안 `MC_SER/Server`(자체호스팅에서 웹과 마크 서버가 같은 머신·같은 프로젝트 아래일 때).
// 마크 서버 폴더를 **다른 경로로 옮기면** env `MC_SERVER_DIR` 하나만 새 "Server" 폴더 절대경로로 지정하면
// 위 세 참조가 전부 따라온다. (더 세밀하게는 SCHEMATICS_DIR / BLUEPRINT_GALLERY_DIR / ITEMSADDER_PACK_PATH
// 개별 env 가 각각 이 값보다 우선한다.)
//
// ⚠ 이 값은 "파일 경로" 참조에만 쓰인다. 웹↔플러그인 통신(MINECRAFT_API_URL, 기본 localhost:25580)과
//   Dynmap(localhost:8123)은 네트워크라 무관하고, DB 에 절대경로로 저장된 "기존 백업"은 이 값과 별개로
//   경로가 고정돼 있어 서버를 옮기면 옛 백업 다운로드가 깨진다(신규 백업은 정상). 자세한 건 이동 안내 참조.
export const MC_SERVER_DIR = process.env.MC_SERVER_DIR || path.join(process.cwd(), "MC_SER", "Server");
