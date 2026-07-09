// ── 사이트 전역 OG 이미지(브랜드 카드) ──────────────────────────────────
// 기존 http://craftopia.work:9000 로고(mixed content, 일부 플랫폼 거부)를 대체하는
// 파일 컨벤션 라우트 — metadataBase(https) 기준의 절대 URL 로 자동 배선된다.
import { ogResponse, BrandCard } from "@/lib/ogCard";

export const runtime = "nodejs";
export const alt = "BlockCanvas — 블록을 쌓아 만드는 나만의 포트폴리오";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return ogResponse(() => <BrandCard />);
}
