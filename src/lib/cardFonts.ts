import fs from "fs";
import os from "os";
import path from "path";

// 상태창 카드(statusCard.ts)는 sharp(librsvg+pango+fontconfig)로 SVG 텍스트를 렌더한다.
// librsvg 는 SVG 의 @font-face(data-uri) 를 무시하고 오직 fontconfig 가 찾은 폰트만 쓴다.
// → 렌더 전에 FONTCONFIG_FILE 을 "프로젝트 fonts/ + 윈도우 Fonts" 를 가리키는 임시 conf 로 지정한다.
//
// 번들 폰트(둘 다 fonts/):
//   · Minecraft.ttf      — 영문/숫자(진짜 마인크래프트 폰트, family="Minecraft")
//   · NeoDunggeunmo.ttf  — 한글 둥근모 픽셀폰트(family="Neo둥근모", OFL)
// 윈도우 Fonts 도 포함해야 둘 다에 없는 글리프가 'Malgun Gothic' 으로 폴백된다.
// fontconfig 는 첫 텍스트 렌더 때 lazy 초기화되므로 sharp 텍스트 렌더 이전에 1회 호출하면 된다.

let configured = false;

export function ensureCardFonts(): void {
  if (configured) return;
  configured = true;
  // 이미 외부에서 fontconfig 를 설정해 둔 경우 존중한다.
  if (process.env.FONTCONFIG_FILE) return;
  try {
    const fontsDir = path.join(process.cwd(), "fonts");
    // ※ fs 경로 인자에 turbopackIgnore — 번들러가 폰트 디렉터리(특히 C:/Windows/Fonts, 수십만 파일)를
    //   의존성으로 정적 추적해 "overly broad" 경고/과대번들을 내는 것을 막는다(런타임 동작은 동일).
    if (!fs.existsSync(/* turbopackIgnore: true */ path.join(fontsDir, "Minecraft.ttf"))) return; // 폰트 미존재 → 기본 fontconfig 유지
    const winFonts = path.join(process.env.WINDIR || process.env.SystemRoot || "C:\\Windows", "Fonts");
    const cacheDir = path.join(os.tmpdir(), "bc-fontconfig-cache-mc");
    const confPath = path.join(os.tmpdir(), "bc-fontconfig-mc.conf");
    const uri = (p: string) => p.replace(/\\/g, "/");

    const dirs = [fontsDir, winFonts].filter((d) => fs.existsSync(/* turbopackIgnore: true */ d));
    // ⚠ DOCTYPE(<!DOCTYPE fontconfig SYSTEM "fonts.dtd">) 를 넣으면 안 된다 — sharp 0.34 의 번들 fontconfig 가
    //   fonts.dtd 를 못 찾아 conf 파싱에 실패하고 조용히 "기본 config"(= C:\Windows\Fonts 만)로 폴백한다.
    //   그 결과 이 fonts/ 디렉터리가 통째로 무시되어(Minecraft/NeoDunggeunmo 미로딩) 전부 맑은 고딕으로 렌더됐었다.
    //   DOCTYPE 없이 두면 conf 가 정상 적용되어 fonts/ 가 스캔된다(검증 완료).
    const conf = `<?xml version="1.0"?>
<fontconfig>
${dirs.map((d) => `  <dir>${uri(d)}</dir>`).join("\n")}
  <cachedir>${uri(cacheDir)}</cachedir>
</fontconfig>`;
    fs.mkdirSync(/* turbopackIgnore: true */ cacheDir, { recursive: true });
    fs.writeFileSync(/* turbopackIgnore: true */ confPath, conf, "utf8");
    process.env.FONTCONFIG_FILE = confPath;
  } catch {
    // 실패해도 치명적이지 않다 — 기본 fontconfig(맑은 고딕) 로 폴백된다.
  }
}

// SVG font-family 폴백 체인(글리프 단위 폴백):
//   Minecraft(영문/숫자) → NeoDunggeunmo(한글 픽셀) → 맑은 고딕(누락 글리프) → sans-serif.
// 한 체인이면 충분하다: Minecraft 엔 한글이 없으므로 한글은 NeoDunggeunmo 로, 둘 다 없는 글리프는
// 맑은 고딕으로 자동 폴백된다.
// ⚠ 한글 폰트 family 명은 파일의 실제 name table 기준 "NeoDunggeunmo"(파일명 같음) — "Neo둥근모"가 아님.
//   (잘못된 family 명이면 매칭 실패 → 맑은 고딕으로 폴백된다.)
export const FONT_MC = "'Minecraft','NeoDunggeunmo','Malgun Gothic',sans-serif";

// 하위 호환 — 기존 호출부가 두 상수를 참조하므로 동일 체인으로 유지한다.
export const FONT_PIXEL_11 = FONT_MC;
export const FONT_PIXEL_9 = FONT_MC;
