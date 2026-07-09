// ── 크리에이터 포트폴리오 OG 카드 ───────────────────────────────────────
// 배너(로컬 /uploads 만 data URI 임베드)를 크림 스크림으로 딤 처리한 배경 위에
// 아바타 서클 + 이름 + PORTFOLIO 텔레메트리 라벨. 프로필이 없거나 조회가 실패하면
// 브랜드 카드로 폴백(ogResponse 가 보장 — OG 라우트는 절대 500 금지).
import { prisma } from "@/lib/prisma";
import {
  ogResponse,
  BrandCard,
  CropMarks,
  MonoLabel,
  RedDot,
  GridOverlay,
  loadUploadImage,
  clip,
  OG,
  PIXEL_FAMILY,
} from "@/lib/ogCard";

export const runtime = "nodejs";
export const alt = "BlockCanvas 크리에이터 포트폴리오";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  return ogResponse(async () => {
    const { site } = await params;
    let creatorName = site;
    try {
      creatorName = decodeURIComponent(site);
    } catch {
      // 원본 그대로 조회
    }

    const profile = await prisma.profile.findUnique({
      where: { creator_name: creatorName },
      include: { portfolios: true },
    });
    // 페이지(page.tsx)와 동일한 공개 게이트 — role 'user'(공개 페이지 없음)·root·미공개 포트폴리오는
    // OG 라우트로도 이름/아바타/배너를 수집할 수 없게 브랜드 카드로 차단한다
    if (!profile || profile.role === "user" || profile.creator_name === "root") {
      return <BrandCard />;
    }
    const isPublished = profile.portfolios ? (profile.portfolios.is_published ?? true) : false;
    if (!isPublished) return <BrandCard />;

    const name = clip(profile.display_name || profile.creator_name, 24);
    const nameSize = name.length > 12 ? 64 : 84;
    const initial = (name[0] || "B").toUpperCase();

    const [banner, avatar] = await Promise.all([
      loadUploadImage(profile.portfolios?.banner_url, 1000),
      loadUploadImage(profile.avatar_url, 320),
    ]);

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: OG.cream,
          fontFamily: "Pretendard",
        }}
      >
        {banner && (
          <img
            src={banner}
            width={1200}
            height={630}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 1200,
              height: 630,
              objectFit: "cover",
            }}
          />
        )}
        {banner && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              backgroundImage:
                "linear-gradient(100deg, rgba(250,249,245,0.97) 0%, rgba(250,249,245,0.90) 52%, rgba(250,249,245,0.58) 100%)",
            }}
          />
        )}
        <GridOverlay />
        <CropMarks />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            height: "100%",
            padding: "0 84px",
          }}
        >
          {avatar ? (
            <img
              src={avatar}
              width={200}
              height={200}
              style={{
                width: 200,
                height: 200,
                borderRadius: 200,
                objectFit: "cover",
                border: `5px solid ${OG.ink}`,
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                width: 200,
                height: 200,
                borderRadius: 200,
                border: `5px solid ${OG.ink}`,
                backgroundColor: "#FFFFFF",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 84,
                color: OG.ink,
              }}
            >
              {initial}
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginLeft: 56,
              flexGrow: 1,
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <MonoLabel text="[ PORTFOLIO ]" size={20} color={OG.inkSoft} />
              <div style={{ display: "flex", marginLeft: 12 }}>
                <RedDot size={14} />
              </div>
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 14,
                fontWeight: 900,
                fontSize: nameSize,
                color: OG.ink,
                letterSpacing: -2,
                lineHeight: 1.1,
              }}
            >
              {name}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 16,
                fontFamily: PIXEL_FAMILY,
                fontSize: 26,
                letterSpacing: 2,
                color: OG.inkFaint,
              }}
            >
              {"@" + profile.creator_name}
            </div>
          </div>
        </div>

        <div style={{ position: "absolute", bottom: 54, left: 84, display: "flex" }}>
          <MonoLabel text="BLOCKCANVAS // CRAFTOPIA.WORK" />
        </div>
      </div>
    );
  });
}
