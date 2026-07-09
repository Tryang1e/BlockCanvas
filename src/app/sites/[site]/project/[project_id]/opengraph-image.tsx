// ── 프로젝트 상세 OG 카드 ───────────────────────────────────────────────
// 썸네일(로컬 /uploads 만 data URI 임베드)을 하단 크림 스크림으로 딤 처리한 배경 위에
// [ PROJECT ] 라벨 + 제목 + 크리에이터명. 비공개 글/숨긴 섹션/크리에이터 불일치는
// page.tsx 의 generateMetadata 게이트와 동일하게 브랜드 카드로 폴백(임베드 누수 방지).
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
} from "@/lib/ogCard";

export const runtime = "nodejs";
export const alt = "BlockCanvas 프로젝트";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ site: string; project_id: string }>;
}) {
  return ogResponse(async () => {
    const { site, project_id } = await params;
    let creatorName = site;
    try {
      creatorName = decodeURIComponent(site);
    } catch {
      // 원본 그대로 비교
    }

    const project = await prisma.project.findUnique({
      where: { id: project_id },
      select: {
        title: true,
        thumbnail_url: true,
        is_published: true,
        section: { select: { is_visible: true } },
        creator: { select: { creator_name: true, display_name: true, role: true } },
      },
    });

    // page.tsx generateMetadata 와 동일 게이트 — 비공개/숨김/불일치 글은 브랜드 카드.
    if (
      !project ||
      project.creator.role === "user" ||
      project.creator.creator_name.toLowerCase() !== creatorName.toLowerCase() ||
      project.is_published !== true ||
      project.section?.is_visible === false
    ) {
      return <BrandCard />;
    }

    // 에디터 내부 태그([SIZE:800x600] 류) 제거 — page.tsx 와 동일 규칙.
    const sizeRegex = /\s*\[SIZE:\s*\d+x\d+\s*\]/gi;
    const title = clip(project.title.replace(sizeRegex, ""), 36);
    const titleSize = title.length > 16 ? 56 : 72;
    const byName = clip(project.creator.display_name || project.creator.creator_name, 24);

    const thumb = await loadUploadImage(project.thumbnail_url, 1000);

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
        {thumb && (
          <img
            src={thumb}
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
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            backgroundImage: thumb
              ? "linear-gradient(to top, rgba(250,249,245,0.97) 0%, rgba(250,249,245,0.82) 42%, rgba(250,249,245,0.18) 100%)"
              : "linear-gradient(to top, rgba(250,249,245,1) 0%, rgba(250,249,245,1) 100%)",
          }}
        />
        {!thumb && <GridOverlay />}
        <CropMarks />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            width: "100%",
            height: "100%",
            padding: "72px 84px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <MonoLabel text="[ PROJECT ]" size={20} color={OG.inkSoft} />
            <div style={{ display: "flex", marginLeft: 12 }}>
              <RedDot size={14} />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontWeight: 900,
              fontSize: titleSize,
              color: OG.ink,
              letterSpacing: -2,
              lineHeight: 1.12,
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 22,
            }}
          >
            <div
              style={{
                display: "flex",
                fontWeight: 700,
                fontSize: 30,
                color: OG.inkSoft,
              }}
            >
              {"by " + byName}
            </div>
            <MonoLabel text="BLOCKCANVAS" />
          </div>
        </div>
      </div>
    );
  });
}
