import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { canUseBuildDashboard } from "@/lib/roles";
import { getModerationState } from "@/lib/moderation";
import { getGalleryPost } from "@/app/actions/gallery";
import { Boxes, ArrowLeft, ArrowRight, Lock, LogIn } from "lucide-react";
import GalleryDetailClient from "./GalleryDetailClient";

export const dynamic = "force-dynamic";

// 회원 전용 안내(게스트/미인증) — 둘러보기(목록)는 공개지만 상세 "읽기"·다운로드는 인증 회원만.
function MembersOnlyGate({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF9F5] text-center p-6">
      <div className="w-16 h-16 mb-5 rounded-2xl bg-[#F1EFE8] flex items-center justify-center">
        <Lock className="text-neutral-400" size={28} />
      </div>
      <h1 className="text-2xl font-black text-neutral-900 mb-2">회원 전용 블루프린트</h1>
      <p className="text-neutral-500 font-medium mb-6 max-w-md">
        갤러리 목록은 누구나 볼 수 있지만, 블루프린트 <b className="text-neutral-700">상세 보기·다운로드</b>는{" "}
        {loggedIn ? "3종 인증을 완료한 회원만" : "로그인한 인증 회원만"} 이용할 수 있습니다.
      </p>
      <div className="flex items-center gap-3">
        {loggedIn ? (
          <Link href="/dashboard/connections" className="inline-flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-neutral-800 text-white text-sm font-bold rounded-xl transition-colors">
            인증 완료하러 가기 <ArrowRight size={16} />
          </Link>
        ) : (
          <Link href="/login" className="inline-flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-neutral-800 text-white text-sm font-bold rounded-xl transition-colors">
            <LogIn size={16} /> 로그인
          </Link>
        )}
        <Link href="/gallery" className="text-sm font-bold text-neutral-500 hover:text-neutral-900 transition-colors">갤러리 둘러보기</Link>
      </div>
    </div>
  );
}

export default async function GalleryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = verifySession((await cookies()).get("session")?.value);

  // 회원 판별. 게스트/미인증은 회원 전용 안내(상세=읽기 회원 전용).
  let isMember = false;
  if (session === "admin") {
    isMember = true;
  } else if (session) {
    const profile = await prisma.profile.findUnique({ where: { creator_name: session } });
    if (profile) {
      if (getModerationState(profile).isBlocked) redirect("/suspended");
      isMember = canUseBuildDashboard(profile);
    }
  }
  if (!isMember) return <MembersOnlyGate loggedIn={!!session} />;

  const res = await getGalleryPost(id);
  if (!res.success || !res.post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF9F5] text-center p-6">
        <div className="w-16 h-16 mb-5 rounded-2xl bg-[#F1EFE8] flex items-center justify-center">
          <Boxes className="text-neutral-400" size={30} />
        </div>
        <h1 className="text-xl font-black text-neutral-900 mb-2">게시물을 찾을 수 없습니다</h1>
        <p className="text-neutral-500 font-medium mb-6 max-w-md">{res.error || "삭제되었거나 존재하지 않는 블루프린트입니다."}</p>
        <Link href="/gallery" className="inline-flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-neutral-800 text-white text-sm font-bold rounded-xl transition-colors">
          <ArrowLeft size={16} /> 갤러리로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <GalleryDetailClient
      post={res.post}
      isOwner={res.isOwner}
      isStaff={res.isStaff}
      hasMinecraft={res.hasMinecraft}
      alreadyDownloaded={res.alreadyDownloaded}
      alreadyReported={res.alreadyReported}
      bookmarked={res.bookmarked}
      purchased={res.purchased}
      canDownload={res.canDownload}
    />
  );
}
