import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { canUseBuildDashboard, isAdminPanelAccess } from "@/lib/roles";
import { getModerationState } from "@/lib/moderation";
import GalleryClient from "./GalleryClient";

export const dynamic = "force-dynamic";

// 전역(글로벌) 블루프린트 갤러리 — craftopia.work/gallery (proxy 가 서브도메인→루트 canonical 처리).
// 둘러보기("보기")는 비로그인 포함 누구나 가능. 읽기(상세)·다운로드·업로드·수정·신고는 인증 회원만(각 라우트/액션에서 게이트).
export default async function GalleryPage() {
  const session = verifySession((await cookies()).get("session")?.value);

  // 비회원(게스트)도 목록은 볼 수 있다. 회원 여부만 판별해 액션 UI 를 게이트한다.
  let viewer = { isMember: false, handle: null as string | null, isStaff: false };

  if (session === "admin") {
    viewer = { isMember: true, handle: "admin", isStaff: true };
  } else if (session) {
    const profile = await prisma.profile.findUnique({ where: { creator_name: session } });
    if (profile) {
      if (getModerationState(profile).isBlocked) redirect("/suspended");
      if (canUseBuildDashboard(profile)) {
        viewer = { isMember: true, handle: profile.creator_name, isStaff: isAdminPanelAccess(profile.role) };
      }
      // 로그인했지만 미인증 → 게스트처럼 목록만(액션은 잠김).
    }
  }

  // 회원이면 "건축 대시보드" 링크(본인 서브도메인). 갤러리는 루트 도메인이므로 {handle}.<base>/minecraft 로.
  let dashboardUrl: string | null = null;
  if (viewer.isMember && viewer.handle && viewer.handle !== "admin") {
    const h = await headers();
    const rawHost = h.get("x-forwarded-host") || h.get("host") || "";
    const hostNoPort = rawHost.split(":")[0];
    const isLocal = hostNoPort.includes("localhost") || hostNoPort === "127.0.0.1";
    const proto = h.get("x-forwarded-proto") || (isLocal ? "http" : "https");
    if (rawHost) {
      const target = isLocal
        ? `${viewer.handle}.${rawHost}` // 예: tryangle.localhost:3000 (*.localhost → 127.0.0.1)
        : `${viewer.handle}.${hostNoPort.split(".").slice(-2).join(".")}`; // 예: tryangle.craftopia.work
      dashboardUrl = `${proto}://${target}/minecraft`;
    }
  }

  return <GalleryClient viewer={viewer} dashboardUrl={dashboardUrl} />;
}
