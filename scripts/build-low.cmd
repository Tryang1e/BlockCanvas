@echo off
REM ============================================================
REM  build-low.cmd — 라이브 사이트(next start)와 같은 머신에서 빌드할 때
REM  CPU/RAM 포화로 머신·사이트가 렉 걸리는 걸 줄이는 "저자원" 빌드.
REM
REM   /belownormal : 우선순위를 낮춰 라이브 사이트(Normal)에 CPU 를 양보 → 머신 응답성 유지
REM   /affinity FF : 12 코어 중 8 개(하위 8비트)만 사용 → 4 코어는 사이트/OS 몫으로 남김
REM                  (더 양보하려면 3F=6코어, 더 빠르게는 FFF=12코어 로 조정)
REM
REM  사용: npm run build:low   (또는 이 파일을 직접 실행)
REM  ⚠ 빌드 자체는 코어를 덜 써서 다소 느려질 수 있으나, 그 대신 머신이 안 멈춘다.
REM
REM  RAM 이 여전히 부족하면 아래 줄의 REM 을 떼서 Node 힙 상한을 건다(숫자는 RAM 에 맞게).
REM  ⚠ 너무 낮으면 정적 생성에서 "JavaScript heap out of memory" 크래시 — 4096~8192 권장.
REM  set "NODE_OPTIONS=--max-old-space-size=6144"
REM ============================================================
start "blockcanvas-build" /belownormal /affinity FF /b /wait cmd /c "npm run build"
