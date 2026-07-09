import { opsAlert } from "@/lib/opsAlert";

/**
 * 프로세스 레벨 크래시 관측 — 단일 인스턴스라 미처리 예외/rejection 의 가시성이 없으면 조용히 다운/불안정해진다.
 *
 *  • unhandledRejection: 로그 + 경보. (프로세스를 종료하지 않는다 — 떠도는 rejection 이 사이트 전체를 죽이지 않게.
 *    최신 Node 는 기본적으로 unhandledRejection 을 치명으로 처리하는데, 핸들러 등록으로 그 종료를 막는다.)
 *  • uncaughtExceptionMonitor: 로그 + 경보만 하고 '처리'하지 않는다 → Node 의 기본 크래시 동작(프로세스 종료)은
 *    그대로 유지된다. 즉 크래시 의미를 바꾸지 않고 관측만 추가한다(프로세스 매니저가 있으면 재시작).
 *
 * Node 런타임에서만, 프로세스당 1회 등록한다(edge/브라우저·중복 등록 무시). prisma.ts 가 import 해
 * 서버 부팅 경로에서 확실히 실행된다.
 */
export function installProcessGuards(): void {
  if (typeof process === "undefined" || typeof process.on !== "function") return;
  const g = globalThis as unknown as { __bcProcessGuards?: boolean };
  if (g.__bcProcessGuards) return;
  g.__bcProcessGuards = true;

  process.on("unhandledRejection", (reason: unknown) => {
    const msg = reason instanceof Error ? reason.stack || reason.message : String(reason);
    void opsAlert("unhandledRejection", msg.slice(0, 800), { level: "error", debounceMs: 5 * 60 * 1000 });
  });

  // 모니터는 기본 크래시 동작을 막지 않는다(관측 전용). 프로세스는 이후 종료된다.
  process.on("uncaughtExceptionMonitor", (err: unknown) => {
    const msg = err instanceof Error ? err.stack || err.message : String(err);
    void opsAlert("uncaughtException", msg.slice(0, 800), { level: "critical", debounceMs: 60 * 1000 });
  });
}
