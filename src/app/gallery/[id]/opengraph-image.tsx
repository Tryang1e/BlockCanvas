// ── 블루프린트 갤러리 OG 카드 ───────────────────────────────────────────
// 좌: [ AXIOM_BP | SCHEM ] 배지 + 제목 + 가격 칩(코인은 satori 이모지 리스크 때문에
// 레드 픽셀 스퀘어 + 'COIN {n}' 텍스트). 우: 표지(로컬 webp → data URI) 또는
// 픽셀 블록 플레이스홀더. 비공개(hidden/removed)·미존재는 브랜드 카드로 폴백.
import { prisma } from "@/lib/prisma";
import {
  ogResponse,
  BrandCard,
  CropMarks,
  MonoLabel,
  loadUploadImage,
  clip,
  OG,
  PIXEL_FAMILY,
  gridBackground,
} from "@/lib/ogCard";

export const runtime = "nodejs";
export const alt = "BlockCanvas 블루프린트 갤러리";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return ogResponse(async () => {
    const { id } = await params;
    const post = await prisma.blueprintPost.findUnique({
      where: { id },
      select: { title: true, ext: true, price: true, cover_path: true, status: true },
    });
    // 숨김/제거 게시물의 표지·제목은 외부에 노출하지 않는다(신고 자동숨김 누수 방지).
    if (!post || post.status !== "published") return <BrandCard />;

    const badge = post.ext === ".bp" ? "AXIOM_BP" : "SCHEM";
    // 사이트 전역 코인 표기와 동일한 천 단위 콤마(콤마는 라틴 구두점이라 satori 폰트 폴백 안전)
    const priceText = post.price > 0 ? `COIN ${post.price.toLocaleString("en-US")}` : "FREE";
    const title = clip(post.title, 44);
    const titleSize = title.length > 20 ? 52 : 64;
    const cover = await loadUploadImage(post.cover_path, 700);

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          fontFamily: "Pretendard",
          ...gridBackground,
        }}
      >
        <CropMarks />

        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            alignItems: "center",
            padding: "72px 84px",
          }}
        >
          {/* 좌측: 배지 · 제목 · 가격 */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "100%",
              flexGrow: 1,
              paddingRight: 48,
            }}
          >
            <MonoLabel text="[ BLUEPRINT GALLERY ]" size={20} color={OG.inkSoft} />

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex" }}>
                <div
                  style={{
                    display: "flex",
                    border: `3px solid ${OG.ink}`,
                    padding: "8px 16px",
                    fontFamily: PIXEL_FAMILY,
                    fontSize: 22,
                    letterSpacing: 3,
                    color: OG.ink,
                  }}
                >
                  {badge}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 26,
                  fontWeight: 900,
                  fontSize: titleSize,
                  color: OG.ink,
                  letterSpacing: -1,
                  lineHeight: 1.15,
                }}
              >
                {title}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: post.price > 0 ? OG.ink : OG.red,
                  color: OG.cream,
                  padding: "12px 22px",
                  borderRadius: 14,
                  fontFamily: PIXEL_FAMILY,
                  fontSize: 26,
                  letterSpacing: 2,
                }}
              >
                {post.price > 0 && (
                  <div
                    style={{
                      display: "flex",
                      width: 14,
                      height: 14,
                      backgroundColor: OG.red,
                      marginRight: 12,
                    }}
                  />
                )}
                {priceText}
              </div>
              <div style={{ display: "flex", marginLeft: 24 }}>
                <MonoLabel text="CRAFTOPIA.WORK/GALLERY" />
              </div>
            </div>
          </div>

          {/* 우측: 표지 or 픽셀 블록 플레이스홀더 */}
          <div
            style={{
              display: "flex",
              width: 440,
              height: 440,
              flexShrink: 0,
              border: `4px solid ${OG.ink}`,
              borderRadius: 24,
              backgroundColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {cover ? (
              <img
                src={cover}
                width={432}
                height={432}
                style={{ width: 432, height: 432, objectFit: "cover", borderRadius: 20 }}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex" }}>
                  <div style={{ display: "flex", width: 44, height: 44, backgroundColor: OG.grid, margin: 5 }} />
                  <div style={{ display: "flex", width: 44, height: 44, backgroundColor: OG.ink, margin: 5 }} />
                  <div style={{ display: "flex", width: 44, height: 44, backgroundColor: OG.grid, margin: 5 }} />
                </div>
                <div style={{ display: "flex" }}>
                  <div style={{ display: "flex", width: 44, height: 44, backgroundColor: OG.ink, margin: 5 }} />
                  <div style={{ display: "flex", width: 44, height: 44, backgroundColor: OG.red, margin: 5 }} />
                  <div style={{ display: "flex", width: 44, height: 44, backgroundColor: OG.ink, margin: 5 }} />
                </div>
                <div style={{ display: "flex" }}>
                  <div style={{ display: "flex", width: 44, height: 44, backgroundColor: OG.grid, margin: 5 }} />
                  <div style={{ display: "flex", width: 44, height: 44, backgroundColor: OG.ink, margin: 5 }} />
                  <div style={{ display: "flex", width: 44, height: 44, backgroundColor: OG.grid, margin: 5 }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  });
}
