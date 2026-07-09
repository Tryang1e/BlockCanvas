import { spawn } from "child_process";
import path from "path";

// .schem ↔ .bp(Axiom 블루프린트) 변환 — 오픈소스 SchemConvert(GPL-3.0, PiTheGuy) jar 를 별도 프로세스로 호출.
// 독자 .bp 포맷을 웹에서 재구현하지 않고 같은 머신의 Java 로 변환기를 실행한다(itemsadder-pack 의 "같은 머신 도구" 패턴).
// jar 는 별도 프로세스 호출이라 GPL 이 웹앱에 전염되지 않는다. 경로/Java 는 env 로 덮어쓸 수 있음.
const SCHEMCONVERT_JAR = process.env.SCHEMCONVERT_JAR || path.join(process.cwd(), "tools", "SchemConvert.jar");
const JAVA_BIN = process.env.JAVA_BIN || "java";
const CONVERT_TIMEOUT_MS = 60_000;

/** inputPath → outputPath 변환(확장자로 포맷 추론: .schem/.bp/.litematic/.nbt). 성공 시 {ok:true}. */
export function runSchemConvert(inputPath: string, outputPath: string): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn(JAVA_BIN, ["-jar", SCHEMCONVERT_JAR, "--input", inputPath, "--output", outputPath], { windowsHide: true });
    } catch (e) {
      resolve({ ok: false, error: `변환기 실행 실패: ${e instanceof Error ? e.message : String(e)}` });
      return;
    }
    let stderr = "";
    let stdout = "";
    proc.stdout?.on("data", (d) => { stdout += d.toString(); });
    proc.stderr?.on("data", (d) => { stderr += d.toString(); });
    const timer = setTimeout(() => { proc.kill(); resolve({ ok: false, error: "변환 시간 초과(60초)." }); }, CONVERT_TIMEOUT_MS);
    proc.on("error", (e) => { clearTimeout(timer); resolve({ ok: false, error: `변환기를 실행할 수 없습니다(Java/jar 확인): ${e.message}` }); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, error: (stderr || stdout).trim().split("\n").pop() || `변환 실패 (코드 ${code}).` });
    });
  });
}

/** 변환 대상 확장자(상대 포맷). .schem/.schematic → .bp, .bp → .schem. 그 외 null. */
export function targetConvertExt(name: string): ".schem" | ".bp" | null {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".schem" || ext === ".schematic") return ".bp";
  if (ext === ".bp") return ".schem";
  return null;
}
