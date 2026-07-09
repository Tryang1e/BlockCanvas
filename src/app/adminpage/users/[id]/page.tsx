import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getEconomyBalance, getPlaytimeMinutes } from '@/lib/minecraft'
import { playerSchematicsBytes, countSchematics } from '@/lib/schematics'
import { effectiveQuotaBytes, formatBytes } from '@/lib/worldQuota'
import { subscriptionQuotaBonus } from '@/lib/subscription'
import { getModerationState } from '@/lib/moderation'
import { currentAdminRole } from '@/lib/admin-auth'
import { isSuperAdmin } from '@/lib/roles'
import UserManageClient from './UserManageClient'

export const dynamic = 'force-dynamic'

// 유저별 관리 허브 — 신원/연동·제재·건축서버 데이터·웹 콘텐츠를 한 곳에서 열람/관리.
export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const profile = await prisma.profile.findUnique({
    where: { id },
    include: { portfolios: { select: { is_published: true } } },
  })
  if (!profile) notFound()

  const viewerRole = await currentAdminRole()
  const canSuper = isSuperAdmin(viewerRole)

  const [projectCount, plots, worlds, modLogs] = await Promise.all([
    prisma.project.count({ where: { creator_id: id } }),
    prisma.minecraftPlot.findMany({ where: { owner_id: id }, orderBy: { updated_at: 'desc' } }),
    prisma.minecraftWorld.findMany({ where: { owner_id: id }, orderBy: { created_at: 'desc' } }),
    prisma.moderationAction.findMany({ where: { target_id: id }, orderBy: { created_at: 'desc' }, take: 30 }),
  ])

  // 마크 연동 시 인게임 데이터(코인·스키매틱)는 best-effort — 서버 오프라인이어도 페이지는 렌더.
  let coinBalance: number | null = null
  let playtimeMinutes: number | null = null
  let schemBytes = 0
  let schemCount = 0
  let mcOnline = true
  if (profile.minecraft_uuid) {
    const [bal, pt, sb, sc] = await Promise.allSettled([
      getEconomyBalance(profile.minecraft_uuid),
      getPlaytimeMinutes(profile.minecraft_uuid),
      playerSchematicsBytes(profile.minecraft_uuid),
      countSchematics(profile.minecraft_uuid),
    ])
    if (bal.status === 'fulfilled' && bal.value.success) coinBalance = bal.value.balance
    else mcOnline = false
    if (pt.status === 'fulfilled' && pt.value.success) playtimeMinutes = pt.value.minutes
    if (sb.status === 'fulfilled') schemBytes = sb.value
    if (sc.status === 'fulfilled') schemCount = sc.value
  }

  // 분 → "Xh Ym" / "Ym" 표기. null = 미연동/오프라인.
  const playtimeLabel = playtimeMinutes == null
    ? (profile.minecraft_uuid ? (mcOnline ? '0분' : '서버 오프라인') : '미연동')
    : (playtimeMinutes >= 60 ? `${Math.floor(playtimeMinutes / 60)}시간 ${playtimeMinutes % 60}분` : `${playtimeMinutes}분`)

  const worldBytes = worlds.reduce((s, w) => s + Number(w.size_bytes), 0)
  const usedBytes = worldBytes + schemBytes
  const quotaTotal = effectiveQuotaBytes(profile.role, subscriptionQuotaBonus(profile.subscription_until))
  const unlimited = !Number.isFinite(quotaTotal)

  const st = getModerationState(profile)

  // 클라이언트로 넘길 직렬화 데이터(BigInt→Number, Date→ISO).
  const data = {
    id: profile.id,
    creator_name: profile.creator_name,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    email: profile.email,
    role: profile.role,
    discord_id: profile.discord_id,
    discord_username: profile.discord_username,
    minecraft_uuid: profile.minecraft_uuid,
    minecraft_username: profile.minecraft_username,
    two_factor_enabled: profile.two_factor_enabled,
    privacy_consent_version: profile.privacy_consent_version,
    created_at: profile.created_at.toISOString(),
    last_seen_at: profile.last_seen_at ? profile.last_seen_at.toISOString() : null,
    portfolio_published: profile.portfolios?.is_published ?? false,
    status: profile.status,
    suspended_until: profile.suspended_until ? profile.suspended_until.toISOString() : null,
    muted_until: profile.muted_until ? profile.muted_until.toISOString() : null,
    moderation_reason: profile.moderation_reason,
    subscription_until: profile.subscription_until ? profile.subscription_until.toISOString() : null,
    plot_slot_bonus: profile.plot_slot_bonus ?? 0,
    isBanned: st.isBanned,
    isSuspended: st.isSuspended,
    isMuted: st.isMuted,
  }

  const serverData = {
    coinBalance,
    playtimeLabel,
    mcOnline,
    plotCount: plots.length,
    plots: plots.map((p) => ({ id: p.plot_id || p.id, alias: p.alias, world: p.world, auction_price: p.auction_price })),
    worldCount: worlds.length,
    worldActive: worlds.filter((w) => w.status !== 'archived').length,
    worlds: worlds.map((w) => ({ id: w.id, name: w.name, status: w.status, size: Number(w.size_bytes), exploreShared: w.explore_shared, exploreSuspended: w.explore_suspended })),
    schemCount,
    usedBytesLabel: formatBytes(usedBytes),
    quotaLabel: unlimited ? '무제한' : formatBytes(quotaTotal),
    quotaPct: unlimited ? 0 : Math.min(100, Math.round((usedBytes / quotaTotal) * 100)),
    worldQuotaState: profile.world_quota_state,
  }

  const history = modLogs.map((m) => ({
    id: m.id,
    type: m.type,
    severity: m.severity,
    reason: m.reason,
    moderator_name: m.moderator_name,
    mute_until: m.mute_until ? m.mute_until.toISOString() : null,
    suspend_until: m.suspend_until ? m.suspend_until.toISOString() : null,
    permanent: m.permanent,
    created_at: m.created_at.toISOString(),
  }))

  return (
    <div>
      <Link href="/adminpage" className="inline-flex items-center gap-1.5 text-sm font-bold text-neutral-500 hover:text-neutral-900 mb-4">
        <ArrowLeft className="size-4" /> 회원 목록으로
      </Link>
      <UserManageClient
        data={data}
        serverData={serverData}
        history={history}
        projectCount={projectCount}
        canSuper={canSuper}
      />
    </div>
  )
}
