"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";

/**
 * 프로젝트(전시 게시글) 좋아요 토글. 로그인 필요.
 *  - 좋아요 기록과 like_count 는 트랜잭션으로 함께 갱신(원자적).
 */
export async function toggleProjectLike(projectId: string) {
  try {
    const session = verifySession((await cookies()).get("session")?.value);
    if (!session) return { success: false, error: "로그인이 필요합니다." };

    const liker = await prisma.profile.findUnique({
      where: { creator_name: session.toLowerCase() },
      select: { id: true },
    });
    if (!liker) return { success: false, error: "프로필을 찾을 수 없습니다." };

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) return { success: false, error: "프로젝트를 찾을 수 없습니다." };

    const existing = await prisma.projectLike.findUnique({
      where: { project_id_profile_id: { project_id: projectId, profile_id: liker.id } },
      select: { id: true },
    });

    if (existing) {
      // 좋아요 취소
      const [, updated] = await prisma.$transaction([
        prisma.projectLike.delete({ where: { id: existing.id } }),
        prisma.project.update({
          where: { id: projectId },
          data: { like_count: { decrement: 1 } },
          select: { like_count: true },
        }),
      ]);
      return { success: true, liked: false, likeCount: Math.max(0, updated.like_count) };
    }

    // 좋아요 추가
    const [, updated] = await prisma.$transaction([
      prisma.projectLike.create({ data: { project_id: projectId, profile_id: liker.id } }),
      prisma.project.update({
        where: { id: projectId },
        data: { like_count: { increment: 1 } },
        select: { like_count: true },
      }),
    ]);

    return { success: true, liked: true, likeCount: updated.like_count };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
