"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import Image from "next/image";
import {
  Plus,
  HardDrive,
  Globe,
  Users,
  Download,
  Map as MapIcon,
  Clock,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  Boxes,
  Calendar,
  Layers,
  Trash2,
  Power,
  PowerOff,
  LogOut,
  Archive,
  Pencil,
  Check,
  X,
  UserPlus,
  ChevronDown,
  ShoppingCart,
  Coins,
  FileBox,
  Send,
  Ban,
  BookOpen,
} from "lucide-react";
import { getMyWorlds, getInvitedWorlds, getWorldLive, setWorldGamerule, setWorldSetting, backupWorld, deleteWorld, leaveWorld, restoreWorld, renameWorld, setWorldIcon, deactivateWorld, inviteWorldMember, kickWorldMember, setMemberPermission, transferWorld, acceptWorldTransfer, cancelWorldTransfer, getIncomingTransfers, setWorldExploreShare } from "@/app/actions/worlds";
import { getMyPlots, getInvitedPlots, getMyClaimInfo, getMyBalance, transferCoinsAction, setInviteBlock } from "@/app/actions/minecraft";
import { formatBytes } from "@/lib/worldQuota";
import DynmapPlayerContextMenu, { type DynmapPlayerAction } from "./DynmapPlayerContextMenu";
import { worldIconSrc, WORLD_ICONS } from "@/lib/worldIcons";
import { PERM_KEYS, type MemberPerms } from "@/lib/worldPerms";
import UserSidebar from "@/components/layout/UserSidebar";
import PlotsView from "./PlotsView";
import SchematicsView from "./SchematicsView";
import WorldCreateModal from "./WorldCreateModal";
import McAvatar, { McMemberChip } from "./McAvatar";
import { ConfirmModal, DownloadModal, ExploreShareWarningModal, type ConfirmType } from "./WorldActionModals";
import { transferMultiplier } from "@/lib/transferEta";

// Dynmap 임베드(PlotsView 와 동일한 /dynmap-proxy 규약). 월드는 보더 중심이 (0,0) 이라 0,0 기준.
const MAP_URL = (process.env.NEXT_PUBLIC_MINECRAFT_MAP_URL || "").replace(/\/$/, "");
const MAP_NAME = process.env.NEXT_PUBLIC_MINECRAFT_MAP_NAME || "flat";
const MAP_CB = Date.now(); // 캐시 버스터(base 없는 예전 프록시 응답 무시)
function buildWorldMapSrc(world: string) {
  return `${MAP_URL}?worldname=${encodeURIComponent(world)}&mapname=${encodeURIComponent(MAP_NAME)}&zoom=5&x=0&y=64&z=0&_cb=${MAP_CB}`;
}

interface Member {
  uuid?: string;
  name: string;
  perms?: MemberPerms;
}
const PERM_LABELS: Record<string, string> = { edit: "편집", gamerule: "게임룰", backup: "백업", download: "다운로드", invite: "초대", kick: "추방" };
const PERM_DESC: Record<string, string> = { edit: "인게임 빌드", gamerule: "게임룰 변경", backup: "백업 생성", download: "월드 다운로드", invite: "멤버 초대", kick: "멤버 추방" };
interface World {
  id: string;
  name: string;
  icon: string | null;
  mvWorld: string | null;
  source: string;
  ownerName: string;
  generator: string;
  version: string | null;
  sizeBytes: number;
  border: number;
  flags: Record<string, unknown>;
  trusted: Member[];
  myPerms?: MemberPerms;
  status: string;
  lastSaved: string | null;
  lastBackupAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  backups: { ts: number; bytes: number }[];
  owned: boolean;
  pendingTransfer?: { name: string } | null; // 소유권 양도 대기(받는 사람 닉)
  exploreShared?: boolean;    // 탐방 공유 ON 여부(소유자 토글)
  exploreSuspended?: boolean; // 관리자 정지 여부
}
interface IncomingTransfer {
  id: string;
  name: string;
  icon: string | null;
  version: string | null;
  sizeBytes: number;
  fromName: string; // 양도해준 사람
}
interface Quota {
  usedBytes: number;
  totalBytes: number | null;
  worldCount: number;
  worldBytes?: number; // 월드/스키매틱 공동 풀 분해 표시용
  schemBytes?: number;
}
interface PlotLite {
  id: string;
  alias: string | null;
  world: string;
  ownerName?: string;
}

const FLAGS: { key: string; label: string }[] = [
  { key: "doMobSpawning", label: "몹 스폰 (Mob Spawn)" },
  { key: "doWeatherCycle", label: "날씨 (Weather)" },
  { key: "doDaylightCycle", label: "낮/밤 순환 (Daylight)" },
  { key: "doFireTick", label: "불 번짐 (Fire Tick)" },
  { key: "mobGriefing", label: "몹 그리핑 (Mob Griefing)" },
  { key: "doTileDrops", label: "블록 드롭 (Tile Drops)" },
  { key: "doTraderSpawning", label: "방랑상인 (Wandering Trader)" },
];
const DIFFICULTIES: { id: string; label: string }[] = [
  { id: "peaceful", label: "평화 (Peaceful)" },
  { id: "easy", label: "쉬움 (Easy)" },
  { id: "normal", label: "보통 (Normal)" },
  { id: "hard", label: "어려움 (Hard)" },
];
const GAMEMODES: { id: string; label: string }[] = [
  { id: "creative", label: "크리에이티브 (Creative)" },
  { id: "survival", label: "서바이벌 (Survival)" },
  { id: "adventure", label: "모험 (Adventure)" },
  { id: "spectator", label: "관전 (Spectator)" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function addDays(iso: string, days: number): string {
  try {
    return new Date(new Date(iso).getTime() + days * 86400000).toISOString();
  } catch {
    return iso;
  }
}

export default function ServerDashboard({
  userName,
  userHandle,
  avatarUrl,
  userRole,
  minecraftUsername,
  minecraftUuid,
  blockInvites,
  viewAs,
  readOnly = false,
}: {
  userName: string;
  userHandle: string;
  avatarUrl: string;
  userRole: string;
  minecraftUsername: string;
  minecraftUuid?: string | null;
  blockInvites: boolean;
  // 어드민이 다른 유저의 건축 대시보드를 읽기 전용으로 조회할 때: 조회 대상 핸들 + 읽기 전용 플래그.
  viewAs?: string;
  readOnly?: boolean;
}) {
  // 등급 전송속도 배수(creator 이상 2배) — 업로드 페이싱·ETA 표시에 반영. 다운로드는 서버 라우트가 재적용(권위).
  const speedMult = transferMultiplier(userRole);
  const [worlds, setWorlds] = useState<World[]>([]);
  const [invited, setInvited] = useState<World[]>([]);
  const [plots, setPlots] = useState<PlotLite[]>([]);
  const [invitedPlots, setInvitedPlots] = useState<PlotLite[]>([]);
  const [incoming, setIncoming] = useState<IncomingTransfer[]>([]); // 나에게 양도 요청된 월드
  const [quota, setQuota] = useState<Quota | null>(null);
  const [quotaState, setQuotaState] = useState<string>("ok");
  const [claimRemaining, setClaimRemaining] = useState<number | null>(null); // 플롯 구매 가능 횟수(남은 한도, -1=무제한)
  const [balance, setBalance] = useState<number | null>(null); // CMI 코인 잔액(null=경제 미연동/미연동계정)
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<"plots" | "world" | "schematic">("plots");
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const [focusPlotId, setFocusPlotId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmType, setConfirmType] = useState<ConfirmType | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [exploreWarnOpen, setExploreWarnOpen] = useState(false); // 탐방 공유 켜기 전 경고 모달
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [inviteBlocked, setInviteBlocked] = useState(blockInvites); // 초대 차단: 켜면 누구도 나를 플롯/월드에 초대 불가
  const [inviteBlockBusy, setInviteBlockBusy] = useState(false);
  const [liveBusy, setLiveBusy] = useState(false);
  const [ruleBusy, setRuleBusy] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false); // 코인 송금 모달
  const [transferTo, setTransferTo] = useState("");
  const [transferAmt, setTransferAmt] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);

  const load = useCallback(async () => {
    const [wRes, iRes, pRes, ipRes, tRes, claimRes, balRes] = await Promise.all([getMyWorlds(viewAs), getInvitedWorlds(viewAs), getMyPlots(viewAs), getInvitedPlots(viewAs), getIncomingTransfers(viewAs), getMyClaimInfo(viewAs), getMyBalance(viewAs)]);
    setClaimRemaining(claimRes.success && typeof claimRes.remaining === "number" ? claimRes.remaining : null);
    setBalance(typeof balRes.balance === "number" ? balRes.balance : null);
    if (wRes.success) {
      setWorlds(wRes.worlds.map((w) => ({ ...w, owned: true })));
      setQuota(wRes.quota);
      setQuotaState(wRes.quotaState || "ok");
    }
    if (iRes.success) {
      setInvited(
        iRes.worlds.map((w) => ({
          id: w.id,
          name: w.name,
          icon: w.icon ?? null,
          mvWorld: w.mvWorld ?? null,
          source: w.source ?? "basic",
          ownerName: w.ownerName,
          generator: w.generator,
          version: w.version ?? null,
          sizeBytes: w.sizeBytes ?? 0,
          border: 3000,
          flags: {},
          trusted: (w.trusted as Member[]) ?? [],
          myPerms: w.myPerms,
          status: w.status,
          lastSaved: null,
          lastBackupAt: null,
          archivedAt: null,
          createdAt: w.createdAt ?? "",
          backups: [],
          owned: false,
        }))
      );
    }
    if (pRes.success) setPlots((pRes.plots as PlotLite[]) || []);
    if (ipRes.success) setInvitedPlots((ipRes.plots as PlotLite[]) || []);
    setIncoming(tRes || []);
    setLoading(false);
  }, [viewAs]);

  useEffect(() => {
    load();
  }, [load]);

  const allWorlds = [...worlds, ...invited];
  const selected = allWorlds.find((w) => w.id === selectedWorldId) || null;

  const selectWorld = (id: string) => {
    setSelectedWorldId(id);
    setView("world");
  };

  // 선택된(활성) 월드의 실시간 정보(크기·게임룰)를 서버에서 가져와 병합 + 30일 수명주기 갱신.
  const refreshLive = useCallback(async (worldId: string) => {
    setLiveBusy(true);
    const res = await getWorldLive(worldId);
    setLiveBusy(false);
    if (!res.success) return;
    const patch = (arr: World[]) =>
      arr.map((w) =>
        w.id === worldId
          ? { ...w, sizeBytes: res.live.sizeBytes, border: res.live.border, flags: res.live.gamerules, version: res.live.version ?? w.version, status: w.status === "provisioning" ? "active" : w.status }
          : w
      );
    setWorlds((a) => patch(a));
    setInvited((a) => patch(a));
  }, []);

  useEffect(() => {
    if (view !== "world" || !selectedWorldId) return;
    const w = [...worlds, ...invited].find((x) => x.id === selectedWorldId);
    if (w?.mvWorld && w.status === "active") refreshLive(selectedWorldId);
    // 선택 변경 시 1회만 호출(patch 로 인한 재실행 방지 위해 worlds/invited 제외)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorldId, view, refreshLive]);

  const patchWorld = (id: string, fn: (w: World) => World) => {
    setWorlds((a) => a.map((w) => (w.id === id ? fn(w) : w)));
    setInvited((a) => a.map((w) => (w.id === id ? fn(w) : w)));
  };

  const handleToggleRule = async (world: World, key: string, next: boolean) => {
    setRuleBusy(key);
    setMessage(null);
    const res = await setWorldGamerule(world.id, key, next);
    setRuleBusy(null);
    if (res.success) {
      patchWorld(world.id, (w) => ({ ...w, flags: res.flags }));
    } else {
      setMessage({ type: "error", text: res.error || "게임룰 변경에 실패했습니다." });
    }
  };

  const handleSetting = async (world: World, key: string, value: string | number | boolean) => {
    setRuleBusy(key);
    setMessage(null);
    const res = await setWorldSetting(world.id, key, value);
    setRuleBusy(null);
    if (res.success) {
      patchWorld(world.id, (w) => ({ ...w, flags: res.flags }));
    } else {
      setMessage({ type: "error", text: res.error || "설정 변경에 실패했습니다." });
    }
  };

  // 백업/비활성화/삭제 확인 모달의 실제 실행기.
  const runConfirm = async () => {
    if (!selected || !confirmType) return;
    const t = confirmType;
    setBusy(true);
    setMessage(null);
    const res =
      t === "backup" ? await backupWorld(selected.id) : t === "deactivate" ? await deactivateWorld(selected.id) : await deleteWorld(selected.id);
    setBusy(false);
    setConfirmType(null);
    if (res.success) {
      if (t === "delete") {
        setSelectedWorldId(null);
        setView("plots");
      }
      setMessage({
        type: "success",
        text: t === "backup" ? "백업을 완료했습니다." : t === "deactivate" ? "월드를 비활성화했습니다." : "월드를 삭제했습니다.",
      });
      await load();
    } else {
      setMessage({ type: "error", text: res.error || "처리에 실패했습니다." });
    }
  };

  // 초대받은 월드에서 나가기(본인 trust 회수). 소유 월드엔 노출 안 됨.
  const handleLeaveWorld = async (world: World) => {
    if (!confirm(`'${world.name}' 월드에서 나가시겠습니까?\n이 월드의 빌드 권한이 사라집니다.`)) return;
    setBusy(true);
    setMessage(null);
    const res = await leaveWorld(world.id);
    setBusy(false);
    if (res.success) {
      setSelectedWorldId(null);
      setView("plots");
      setMessage({ type: "success", text: "월드에서 나갔습니다." });
      await load();
    } else {
      setMessage({ type: "error", text: res.error || "나가기에 실패했습니다." });
    }
  };

  // 비활성(아카이브) 월드를 다시 활성화(복구).
  const handleRestore = async (world: World) => {
    setBusy(true);
    setMessage(null);
    const res = await restoreWorld(world.id);
    setBusy(false);
    if (res.success) {
      setMessage({ type: "success", text: "월드를 활성화했습니다." });
      await load();
    } else {
      setMessage({ type: "error", text: res.error || "활성화에 실패했습니다." });
    }
  };

  const handleRename = async (world: World, newName: string): Promise<boolean> => {
    if (newName.trim() === world.name) return true;
    setBusy(true);
    setMessage(null);
    const res = await renameWorld(world.id, newName);
    setBusy(false);
    if (res.success) {
      patchWorld(world.id, (w) => ({ ...w, name: res.name }));
      return true;
    }
    setMessage({ type: "error", text: res.error || "이름 변경에 실패했습니다." });
    return false;
  };

  const handleSetIcon = async (world: World, icon: string | null) => {
    if (icon === world.icon) return;
    setBusy(true);
    setMessage(null);
    const res = await setWorldIcon(world.id, icon);
    setBusy(false);
    if (res.success) {
      patchWorld(world.id, (w) => ({ ...w, icon: res.icon }));
    } else {
      setMessage({ type: "error", text: res.error || "아이콘 변경에 실패했습니다." });
    }
  };

  const handleExploreShare = async (world: World, shared: boolean) => {
    setBusy(true);
    setMessage(null);
    const res = await setWorldExploreShare(world.id, shared);
    setBusy(false);
    if (res.success) {
      patchWorld(world.id, (w) => ({ ...w, exploreShared: res.shared }));
      setMessage({ type: "success", text: res.shared ? "탐방 공유를 켰습니다. 이제 /탐방 에 노출됩니다." : "탐방 공유를 껐습니다." });
    } else {
      setMessage({ type: "error", text: res.error || "탐방 공유 설정에 실패했습니다." });
    }
  };

  const handleInvite = async (world: World, name: string) => {
    setBusy(true);
    setMessage(null);
    const res = await inviteWorldMember(world.id, name);
    setBusy(false);
    if (res.success) {
      patchWorld(world.id, (w) => ({ ...w, trusted: res.trusted }));
      setMessage({ type: "success", text: res.warning ? `${name} 님 초대됨. ${res.warning}` : `${name} 님을 초대했습니다.` });
    } else {
      setMessage({ type: "error", text: res.error || "초대에 실패했습니다." });
    }
  };

  const handleKick = async (world: World, name: string) => {
    setBusy(true);
    setMessage(null);
    const res = await kickWorldMember(world.id, name);
    setBusy(false);
    if (res.success) {
      patchWorld(world.id, (w) => ({ ...w, trusted: res.trusted }));
    } else {
      setMessage({ type: "error", text: res.error || "제외에 실패했습니다." });
    }
  };

  const handleSetMemberPerm = async (world: World, name: string, perm: string, value: boolean) => {
    setBusy(true);
    setMessage(null);
    const res = await setMemberPermission(world.id, name, perm, value);
    setBusy(false);
    if (res.success) {
      patchWorld(world.id, (w) => ({ ...w, trusted: res.trusted }));
    } else {
      setMessage({ type: "error", text: res.error || "권한 변경에 실패했습니다." });
    }
  };

  const handleTransfer = async (world: World, name: string) => {
    setBusy(true);
    setMessage(null);
    const res = await transferWorld(world.id, name);
    setBusy(false);
    if (res.success) {
      patchWorld(world.id, (w) => ({ ...w, pendingTransfer: { name: res.recipientName } }));
      setMessage({ type: "success", text: `${res.recipientName} 님에게 양도를 요청했습니다. 상대가 수락하면 완료됩니다.` });
    } else {
      setMessage({ type: "error", text: res.error || "양도 요청에 실패했습니다." });
    }
  };

  const handleCancelTransfer = async (world: World) => {
    setBusy(true);
    setMessage(null);
    const res = await cancelWorldTransfer(world.id);
    setBusy(false);
    if (res.success) patchWorld(world.id, (w) => ({ ...w, pendingTransfer: null }));
    else setMessage({ type: "error", text: res.error || "양도 취소에 실패했습니다." });
  };

  const handleAcceptTransfer = async (worldId: string) => {
    setBusy(true);
    setMessage(null);
    const res = await acceptWorldTransfer(worldId);
    setBusy(false);
    if (res.success) {
      setMessage({ type: "success", text: "월드를 양도받았습니다." });
      await load();
    } else {
      setMessage({ type: "error", text: res.error || "양도 수락에 실패했습니다." });
    }
  };

  const handleRejectTransfer = async (worldId: string) => {
    setBusy(true);
    setMessage(null);
    const res = await cancelWorldTransfer(worldId);
    setBusy(false);
    if (res.success) setIncoming((a) => a.filter((t) => t.id !== worldId));
    else setMessage({ type: "error", text: res.error || "거절에 실패했습니다." });
  };

  const pct = quota && quota.totalBytes ? Math.min(100, (quota.usedBytes / quota.totalBytes) * 100) : 0;

  const handleSendCoins = async () => {
    const amt = Math.floor(Number(transferAmt));
    if (!transferTo.trim()) { setMessage({ type: "error", text: "받는 사람 닉네임을 입력해주세요." }); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setMessage({ type: "error", text: "보낼 코인은 1 이상의 정수여야 합니다." }); return; }
    setTransferBusy(true);
    setMessage(null);
    const res = await transferCoinsAction(transferTo.trim(), amt);
    setTransferBusy(false);
    if (res.success) {
      setTransferOpen(false);
      setTransferTo("");
      setTransferAmt("");
      if (typeof res.balance === "number") setBalance(res.balance);
      setMessage({ type: "success", text: res.message || "송금했습니다." });
      load();
    } else {
      setMessage({ type: "error", text: res.error || "송금에 실패했습니다." });
    }
  };

  // 초대 차단 토글 — 켜면 누구도 나(내 마크 닉네임)를 플롯·월드에 초대(trust)할 수 없다(웹+인게임).
  const toggleInviteBlock = async () => {
    if (inviteBlockBusy) return;
    setInviteBlockBusy(true);
    setMessage(null);
    const next = !inviteBlocked;
    const res = await setInviteBlock(next);
    if (res.success) {
      setInviteBlocked(next);
      setMessage({
        type: "success",
        text: next ? "초대 차단을 켰습니다. 이제 누구도 나를 플롯·월드에 초대할 수 없습니다." : "초대 차단을 껐습니다.",
      });
    } else {
      setMessage({ type: "error", text: res.error || "초대 차단 설정에 실패했습니다." });
    }
    setInviteBlockBusy(false);
  };

  return (
    <div className="h-screen flex flex-col bg-neutral-50 text-neutral-900">
      {/* ===== 상단 바 ===== */}
      <header className="h-14 shrink-0 bg-white border-b border-neutral-200 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <a href="/dashboard" className="flex items-center gap-2 shrink-0">
            <Image src="/logo_icon.png" alt="BlockCanvas" width={26} height={26} className="object-contain w-auto h-auto" />
            {/* 타이핑 워드마크 → 브랜드 로고 이미지 */}
            <Image src="/logo_text.png" alt="BLOCK CANVAS" width={133} height={16} className="h-4 w-auto object-contain" />
          </a>
          {/* 플레이어 정보: 마크 닉네임 + 코인(추후 제공) */}
          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-neutral-200 min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-bold text-neutral-800 min-w-0">
              <McAvatar id={minecraftUuid} name={minecraftUsername} size={22} />
              <span className="truncate max-w-[140px]">{minecraftUsername}</span>
            </span>
            <button
              type="button"
              onClick={() => balance !== null && !readOnly && setTransferOpen(true)}
              disabled={balance === null || readOnly}
              className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 bg-gradient-to-br from-amber-50 to-yellow-100 text-amber-800 border border-amber-200/70 rounded-full text-xs font-extrabold shrink-0 shadow-sm enabled:hover:from-amber-100 enabled:hover:to-yellow-200 enabled:cursor-pointer disabled:cursor-default transition-colors"
              title={balance !== null ? "코인 잔액 · 클릭하면 송금" : "코인 (경제 미연동)"}
            >
              <Coins size={13} className="text-amber-500" />
              <span className="tabular-nums">{balance !== null ? balance.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}</span>
              {balance !== null && <Send size={11} className="text-amber-500/70" />}
            </button>
            {claimRemaining !== null && (
              <span
                className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 bg-gradient-to-br from-emerald-50 to-green-100 text-emerald-700 border border-emerald-200/70 rounded-full text-xs font-extrabold shrink-0 shadow-sm"
                title="플롯 구매 가능 횟수 (역할별 한도 − 보유)"
              >
                <ShoppingCart size={12} className="text-emerald-500" />
                <span className="tabular-nums">{claimRemaining < 0 ? "구매 무제한" : `구매 ${claimRemaining}회`}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href={process.env.NEXT_PUBLIC_WIKI_URL || "https://wiki.craftopia.work"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/70 text-xs font-bold transition-colors shrink-0"
            title="위키 — 가이드·문서"
          >
            <BookOpen size={14} className="text-sky-500" />
            <span className="hidden sm:inline">위키</span>
          </a>
          <a
            href="/gallery"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/70 text-xs font-bold transition-colors shrink-0"
            title="블루프린트 갤러리 — .bp/.schem 공유"
          >
            <Boxes size={14} className="text-indigo-500" />
            <span className="hidden sm:inline">블루프린트 갤러리</span>
            <span className="sm:hidden">갤러리</span>
          </a>
          <UserSidebar userName={userName} userHandle={userHandle} avatarUrl={avatarUrl} isOwner userRole={userRole} />
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        {/* ===== 좌측 사이드바 ===== */}
        <aside className="w-72 shrink-0 bg-white border-r border-neutral-200 flex flex-col overflow-y-auto">
          {/* 어드민 읽기 전용 조회 안내 배너 */}
          {readOnly && (
            <div className="m-3 mb-0 px-3 py-2 rounded-xl bg-purple-50 border border-purple-100 text-[11px] font-bold text-purple-700 flex items-center gap-1.5">
              <ShieldAlert size={13} /> 어드민 읽기 전용 조회 — {minecraftUsername} 님의 대시보드
            </div>
          )}
          {/* 초대 차단 — 켜면 누구도 나를 플롯/월드에 초대(trust)할 수 없음 (웹+인게임 enforcement) */}
          <div className="p-3 border-b border-neutral-100">
            <div className="flex items-center justify-between px-2.5 py-1">
              <span className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                <Ban size={16} className={inviteBlocked ? "text-rose-500" : "text-neutral-400"} /> 초대 차단
              </span>
              <button
                type="button"
                onClick={toggleInviteBlock}
                disabled={inviteBlockBusy || readOnly}
                role="switch"
                aria-checked={inviteBlocked}
                title={inviteBlocked ? "초대 차단 켜짐 — 클릭해 비활성화" : "초대 차단 꺼짐 — 클릭해 활성화"}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                  inviteBlocked ? "bg-rose-500" : "bg-neutral-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    inviteBlocked ? "translate-x-[18px]" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
            <p className="px-2.5 mt-1 text-[10px] leading-snug text-neutral-400">
              {inviteBlocked
                ? "활성화됨 · 다른 사람이 나를 플롯·월드에 초대할 수 없습니다."
                : "비활성화됨 · 활성화하면 다른 사람이 나를 초대할 수 없습니다."}
            </p>
          </div>

          {/* 내 플롯 */}
          <div className="p-3 border-b border-neutral-100">
            <button
              onClick={() => setView("plots")}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors ${
                view === "plots" ? "bg-neutral-100" : "hover:bg-neutral-50"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                <Layers size={16} className="text-neutral-500" /> 내 플롯
              </span>
              <span className="text-[11px] text-neutral-400 font-medium">{plots.length}</span>
            </button>
            {plots.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {plots.slice(0, 6).map((p) => (
                  <button
                    key={`${p.world}:${p.id}`}
                    onClick={() => {
                      setFocusPlotId(`${p.world}:${p.id}`);
                      setView("plots");
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-neutral-500 hover:bg-neutral-50 truncate"
                  >
                    {p.alias || `영토 ${p.id}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 초대된 플롯 */}
          {invitedPlots.length > 0 && (
            <div className="p-3 border-b border-neutral-100">
              <div className="px-2.5 mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">초대된 플롯</div>
              <div className="space-y-0.5">
                {invitedPlots.map((p) => (
                  <button
                    key={`${p.world}:${p.id}`}
                    onClick={() => {
                      setFocusPlotId(`${p.world}:${p.id}`);
                      setView("plots");
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-neutral-500 hover:bg-neutral-50 truncate"
                  >
                    {p.alias || `영토 ${p.id}`}
                    {p.ownerName && <span className="text-neutral-400"> · {p.ownerName}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 스키매틱 클라우드 — 어드민 읽기 전용 조회에서는 비활성(개인 .schem 클라우드는 본인 전용). */}
          {!readOnly && (
            <div className="p-3 border-b border-neutral-100">
              <button
                onClick={() => setView("schematic")}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-bold text-neutral-900 transition-colors ${
                  view === "schematic" ? "bg-neutral-100" : "hover:bg-neutral-50"
                }`}
              >
                <FileBox size={16} className="text-neutral-500" /> 스키매틱
              </button>
            </div>
          )}

          {/* 내 월드 */}
          <div className="p-3 border-b border-neutral-100">
            <div className="flex items-center justify-between px-2.5 mb-2">
              <span className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                <Boxes size={16} className="text-neutral-500" /> 내 월드
              </span>
              {!readOnly && (
                <button
                  onClick={() => setModalOpen(true)}
                  className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-black text-white hover:bg-neutral-800 transition-colors"
                >
                  <Plus size={12} /> 생성
                </button>
              )}
            </div>

            {quota && (
              <div className="px-2.5 mb-3">
                <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-1 font-medium">
                  <span>{formatBytes(quota.usedBytes)}</span>
                  <span>{quota.totalBytes === null ? "무제한" : formatBytes(quota.totalBytes)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${pct > 90 ? "bg-rose-500" : "bg-emerald-500"}`}
                    style={{ width: `${quota.totalBytes === null ? 4 : pct}%` }}
                  />
                </div>
                {quota.schemBytes ? (
                  <div className="mt-1 text-[10px] text-neutral-400">
                    월드 {formatBytes(quota.worldBytes ?? 0)} · 스키매틱 {formatBytes(quota.schemBytes)}
                  </div>
                ) : null}
              </div>
            )}

            <div className="space-y-0.5">
              {loading ? (
                <div className="flex items-center gap-2 px-2.5 py-3 text-xs text-neutral-400">
                  <Loader2 size={14} className="animate-spin" /> 불러오는 중...
                </div>
              ) : worlds.length === 0 ? (
                <p className="px-2.5 py-3 text-xs text-neutral-400">아직 월드가 없습니다. 위 생성으로 만드세요.</p>
              ) : (
                worlds.map((w) => <WorldRow key={w.id} world={w} active={view === "world" && selectedWorldId === w.id} onClick={() => selectWorld(w.id)} />)
              )}
            </div>
          </div>

          {/* 초대된 월드 */}
          {invited.length > 0 && (
            <div className="p-3">
              <div className="px-2.5 mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">초대된 월드</div>
              <div className="space-y-0.5">
                {invited.map((w) => (
                  <WorldRow key={w.id} world={w} shared active={view === "world" && selectedWorldId === w.id} onClick={() => selectWorld(w.id)} />
                ))}
              </div>
            </div>
          )}

          {/* 받은 양도 요청 — 읽기 전용 조회에서는 수락/거절 불가(목록 숨김) */}
          {!readOnly && incoming.length > 0 && (
            <div className="p-3">
              <div className="px-2.5 mb-2 text-[11px] font-bold uppercase tracking-wider text-amber-500">받은 양도</div>
              <div className="space-y-1.5">
                {incoming.map((t) => (
                  <div key={t.id} className="px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-100">
                    <div className="text-xs font-medium text-neutral-700 truncate">{t.name}</div>
                    <div className="text-[10px] text-neutral-400 mb-1.5">{t.fromName} 님이 양도 · {formatBytes(t.sizeBytes)}</div>
                    <div className="flex gap-1">
                      <button onClick={() => handleAcceptTransfer(t.id)} disabled={busy} className="flex-1 text-[10px] font-bold py-1 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50">수락</button>
                      <button onClick={() => handleRejectTransfer(t.id)} disabled={busy} className="flex-1 text-[10px] font-bold py-1 rounded-md bg-white border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-50">거절</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ===== 메인 ===== */}
        <main className="flex-1 min-h-0 overflow-y-auto">
          {quotaState !== "ok" && (
            <div
              className={`mx-6 mt-4 p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                quotaState === "locked" ? "bg-rose-50 text-rose-700 border border-rose-100" : "bg-amber-50 text-amber-700 border border-amber-100"
              }`}
            >
              <ShieldAlert size={14} className="mt-px shrink-0" />
              <span>
                {quotaState === "locked"
                  ? "클라우드 용량을 초과해 모든 월드가 비활성화되었습니다. 지금은 다운로드/삭제만 가능합니다. 월드를 삭제해 용량을 확보하면 다시 활성화·사용할 수 있습니다."
                  : "클라우드 용량이 거의 찼습니다(90% 이상). 용량을 초과하면 모든 월드가 자동 비활성화됩니다. 미리 정리해 주세요."}
              </span>
            </div>
          )}
          {message && (
            <div
              className={`mx-6 mt-4 p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                message.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : "bg-rose-50 text-rose-700 border border-rose-100"
              }`}
            >
              {message.type === "success" ? <CheckCircle2 size={14} className="mt-px" /> : <ShieldAlert size={14} className="mt-px" />}
              <span>{message.text}</span>
            </div>
          )}

          {view === "plots" ? (
            <PlotsView focusPlotId={focusPlotId} onClaimed={load} viewAs={viewAs} readOnly={readOnly} />
          ) : view === "schematic" && !readOnly ? (
            <SchematicsView />
          ) : selected ? (
            <WorldDetail
              world={selected}
              busy={busy}
              liveBusy={liveBusy}
              ruleBusy={ruleBusy}
              readOnly={readOnly}
              locked={quotaState === "locked"}
              onToggleRule={(key, next) => handleToggleRule(selected, key, next)}
              onSetting={(key, value) => handleSetting(selected, key, value)}
              onBackup={() => setConfirmType("backup")}
              onDownload={() => setDownloadOpen(true)}
              onDeactivate={() => setConfirmType("deactivate")}
              onDelete={() => setConfirmType("delete")}
              onRestore={() => handleRestore(selected)}
              onRename={(newName) => handleRename(selected, newName)}
              onSetIcon={(icon) => handleSetIcon(selected, icon)}
              onInvite={(name) => handleInvite(selected, name)}
              onKick={(name) => handleKick(selected, name)}
              onSetMemberPerm={(name, perm, value) => handleSetMemberPerm(selected, name, perm, value)}
              onTransfer={(name) => handleTransfer(selected, name)}
              onCancelTransfer={() => handleCancelTransfer(selected)}
              onLeave={() => handleLeaveWorld(selected)}
              onExploreShare={(shared) => (shared ? setExploreWarnOpen(true) : handleExploreShare(selected, false))}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-neutral-300 p-10">
              <Boxes size={40} className="mb-3" />
              <p className="text-sm text-neutral-400">왼쪽에서 월드를 선택하세요.</p>
            </div>
          )}
        </main>
      </div>

      <WorldCreateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onDone={load}
        quota={quota ? { usedBytes: quota.usedBytes, totalBytes: quota.totalBytes } : null}
        speedMultiplier={speedMult}
      />
      <ConfirmModal type={confirmType} worldName={selected?.name || ""} busy={busy} onConfirm={runConfirm} onClose={() => !busy && setConfirmType(null)} />
      <ExploreShareWarningModal
        open={exploreWarnOpen}
        worldName={selected?.name || ""}
        busy={busy}
        onConfirm={async () => {
          if (selected) await handleExploreShare(selected, true);
          setExploreWarnOpen(false);
        }}
        onClose={() => !busy && setExploreWarnOpen(false)}
      />
      {transferOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !transferBusy && setTransferOpen(false)}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-black flex items-center gap-2"><Send size={16} className="text-amber-500" /> 코인 송금</h3>
              <button type="button" onClick={() => !transferBusy && setTransferOpen(false)} className="text-neutral-400 hover:text-neutral-700 disabled:opacity-50" disabled={transferBusy}>
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-neutral-500 mb-4 flex items-center gap-1">
              <Coins size={12} className="text-amber-500" /> 내 잔액 {balance !== null ? balance.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}코인
            </p>
            <label className="block text-xs font-bold text-neutral-600 mb-1">받는 사람 (마인크래프트 닉네임)</label>
            <input
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              disabled={transferBusy}
              placeholder="닉네임"
              className="w-full mb-3 px-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:bg-neutral-50"
            />
            <label className="block text-xs font-bold text-neutral-600 mb-1">보낼 코인</label>
            <input
              type="number"
              min={1}
              step={1}
              value={transferAmt}
              onChange={(e) => setTransferAmt(e.target.value)}
              disabled={transferBusy}
              placeholder="0"
              className="w-full mb-4 px-3 py-2 rounded-lg border border-neutral-200 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:bg-neutral-50"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setTransferOpen(false)} disabled={transferBusy} className="px-3 py-2 rounded-lg text-sm font-bold text-neutral-600 hover:bg-neutral-100 disabled:opacity-50">
                취소
              </button>
              <button type="button" onClick={handleSendCoins} disabled={transferBusy} className="px-4 py-2 rounded-lg text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60 flex items-center gap-1.5">
                <Send size={14} /> {transferBusy ? "보내는 중…" : "보내기"}
              </button>
            </div>
          </div>
        </div>
      )}
      {selected && (
        <DownloadModal
          open={downloadOpen}
          worldId={selected.id}
          worldName={selected.name}
          active={selected.status === "active"}
          backups={selected.backups}
          worldSizeBytes={selected.sizeBytes}
          speedMultiplier={speedMult}
          onClose={() => setDownloadOpen(false)}
          onRefresh={load}
        />
      )}
    </div>
  );
}

function IconImg({ iconKey, size }: { iconKey: string | null; size: number }) {
  const [err, setErr] = useState(false);
  const src = worldIconSrc(iconKey);
  if (src && !err) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        onError={() => setErr(true)}
        style={{ width: size, height: size, imageRendering: "pixelated" }}
        className="object-cover rounded"
      />
    );
  }
  return (
    <span className="rounded bg-neutral-100 flex items-center justify-center" style={{ width: size, height: size }}>
      <Boxes size={Math.round(size * 0.5)} className="text-neutral-400" />
    </span>
  );
}

// 헤더 아이콘 — 소유자는 클릭해 프리셋(또는 기본)으로 변경. 비소유/잠금 시엔 단순 표시.
function IconEditor({ world, editable, onSetIcon }: { world: World; editable: boolean; onSetIcon: (icon: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDoc);
    return () => window.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!editable) return <IconImg iconKey={world.icon} size={48} />;

  const pick = (icon: string | null) => {
    onSetIcon(icon);
    setOpen(false);
  };

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="아이콘 변경"
        className="group relative rounded-lg overflow-hidden focus:outline-none focus:ring-1 focus:ring-black"
      >
        <IconImg iconKey={world.icon} size={48} />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
          <Pencil size={14} className="text-white opacity-0 group-hover:opacity-100" />
        </span>
      </button>
      {open && (
        <div className="absolute z-30 mt-2 left-0 w-64 bg-white border border-neutral-200 rounded-xl shadow-lg p-3">
          <div className="text-[11px] text-neutral-500 font-bold mb-1.5">아이콘 변경</div>
          <div className="grid grid-cols-6 gap-1.5">
            <button
              type="button"
              onClick={() => pick(null)}
              title="기본"
              className={`aspect-square rounded-lg border flex items-center justify-center ${
                world.icon == null ? "border-black ring-1 ring-black" : "border-neutral-200 hover:border-neutral-400"
              }`}
            >
              <Boxes size={16} className="text-neutral-400" />
            </button>
            {WORLD_ICONS.map((ic) => (
              <button
                key={ic.key}
                type="button"
                onClick={() => pick(ic.key)}
                title={ic.label}
                className={`aspect-square rounded-lg border flex items-center justify-center overflow-hidden ${
                  world.icon === ic.key ? "border-black ring-1 ring-black" : "border-neutral-200 hover:border-neutral-400"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ic.src} alt={ic.label} style={{ imageRendering: "pixelated" }} className="w-6 h-6 object-cover rounded" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WorldRow({ world, active, shared, onClick }: { world: World; active: boolean; shared?: boolean; onClick: () => void }) {
  const archived = world.status === "archived";
  // 설명: 내 월드 = 버전 · 용량 · 업로드날짜 / 공유된 월드 = 버전 · 날짜 · 용량 · 소유자
  const desc = shared
    ? `${world.version || "?"} · ${fmtDate(world.createdAt)} · ${formatBytes(world.sizeBytes)} · ${world.ownerName}`
    : `${world.version || "?"} · ${formatBytes(world.sizeBytes)} · ${fmtDate(world.createdAt)}`;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2.5 py-2 rounded-xl transition-colors flex items-center gap-2.5 ${
        active ? "bg-neutral-100" : "hover:bg-neutral-50"
      } ${archived ? "opacity-60" : ""}`}
    >
      <IconImg iconKey={world.icon} size={32} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="block text-sm font-semibold text-neutral-900 truncate">{world.name}</span>
          {world.source === "import" && <span className="text-[9px] font-bold px-1 py-px rounded bg-violet-50 text-violet-700 shrink-0">삽입</span>}
          {archived && <span className="text-[9px] font-bold px-1 py-px rounded bg-neutral-200 text-neutral-500 shrink-0">비활성</span>}
        </span>
        <span className="block text-[11px] text-neutral-400 truncate">{desc}</span>
      </span>
      {world.status === "provisioning" && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="프로비저닝 중" />}
    </button>
  );
}

function WorldDetail({
  world,
  busy,
  liveBusy,
  ruleBusy,
  locked,
  readOnly = false,
  onToggleRule,
  onSetting,
  onBackup,
  onDownload,
  onDeactivate,
  onDelete,
  onRestore,
  onRename,
  onSetIcon,
  onInvite,
  onKick,
  onSetMemberPerm,
  onTransfer,
  onCancelTransfer,
  onLeave,
  onExploreShare,
}: {
  world: World;
  busy: boolean;
  liveBusy: boolean;
  ruleBusy: string | null;
  locked: boolean;
  readOnly?: boolean;
  onToggleRule: (key: string, next: boolean) => void;
  onSetting: (key: string, value: string | number | boolean) => void;
  onBackup: () => void;
  onDownload: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onRename: (newName: string) => Promise<boolean>;
  onSetIcon: (icon: string | null) => void;
  onInvite: (name: string) => void;
  onKick: (name: string) => void;
  onSetMemberPerm: (name: string, perm: string, value: boolean) => void;
  onTransfer: (name: string) => void;
  onCancelTransfer: () => void;
  onLeave: () => void;
  onExploreShare?: (shared: boolean) => void;
}) {
  const flagEntries = FLAGS.map((f) => ({ ...f, v: world.flags?.[f.key] }));
  const archived = world.status === "archived";
  const active = world.status === "active";
  // 읽기 전용(어드민 조회)에서는 모든 소유자/권한 기반 동작을 비활성화한다.
  const canGamerule = !readOnly && (world.owned || !!world.myPerms?.gamerule);
  const editable = canGamerule && active && !locked; // 게임룰/설정 편집 가능
  const canBackup = !readOnly && (world.owned || !!world.myPerms?.backup);
  const canDownload = !readOnly && (world.owned || !!world.myPerms?.download);
  const canInvite = !readOnly && (world.owned || !!world.myPerms?.invite); // 부반장: 멤버 초대
  const canKick = !readOnly && (world.owned || !!world.myPerms?.kick); // 부반장: 멤버 추방
  const ownerControls = world.owned && !readOnly; // 소유자 전용 변경 컨트롤(읽기 전용 조회 시 숨김)
  const difficulty = typeof world.flags?.difficulty === "string" ? (world.flags.difficulty as string) : "";
  const gamemode = typeof world.flags?.gamemode === "string" ? (world.flags.gamemode as string) : "";
  const tick = typeof world.flags?.randomTickSpeed === "number" ? (world.flags.randomTickSpeed as number) : 3;
  const explosionOn = world.flags?.explosionBlocked === true;
  // 개인 월드 보호 오버라이드(기본=서버 보호 ON). allow*=미설정 시 차단, trampleProtect=미설정 시 보호.
  const allowItemDrop = world.flags?.allowItemDrop === true;
  const allowRedstone = world.flags?.allowRedstone === true;
  const allowPhysics = world.flags?.allowPhysics === true;
  const trampleProtect = world.flags?.trampleProtect !== false;
  const settingBusy = ruleBusy !== null || liveBusy;

  const [editingName, setEditingName] = useState(false);
  const [permBubble, setPermBubble] = useState<string | null>(null); // 권한 버블이 열린 멤버 이름
  const [nameDraft, setNameDraft] = useState(world.name);
  const [inviteInput, setInviteInput] = useState("");
  const [transferInput, setTransferInput] = useState("");
  const [protectOpen, setProtectOpen] = useState(false); // 월드 보호 설정 모달
  useEffect(() => {
    setEditingName(false);
    setNameDraft(world.name);
    setInviteInput("");
    setProtectOpen(false);
  }, [world.id]);
  const saveName = async () => {
    if (await onRename(nameDraft)) setEditingName(false);
  };
  const doInvite = () => {
    const n = inviteInput.trim();
    if (n) {
      onInvite(n);
      setInviteInput("");
    }
  };

  const worldMapRef = useRef<HTMLIFrameElement | null>(null);
  const mapMenuActions: DynmapPlayerAction[] = [];
  if (canInvite) mapMenuActions.push({ label: "이 월드에 초대", run: (p) => onInvite(p) });
  if (canKick) mapMenuActions.push({ label: "이 월드에서 추방", run: (p) => onKick(p), danger: true });

  return (
    <div className="p-5 md:p-8 space-y-6">
      {/* 헤더 + 액션 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <IconEditor world={world} editable={world.owned && !locked && !readOnly} onSetIcon={onSetIcon} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {editingName ? (
                <span className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName();
                      if (e.key === "Escape") {
                        setEditingName(false);
                        setNameDraft(world.name);
                      }
                    }}
                    maxLength={32}
                    className="text-lg font-bold border border-neutral-300 rounded-lg px-2 py-1 w-48 focus:outline-none focus:border-black"
                  />
                  <button onClick={saveName} disabled={busy} className="p-1.5 rounded-lg bg-black text-white hover:bg-neutral-800 disabled:opacity-40" title="저장">
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  </button>
                  <button
                    onClick={() => {
                      setEditingName(false);
                      setNameDraft(world.name);
                    }}
                    disabled={busy}
                    className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 disabled:opacity-40"
                    title="취소"
                  >
                    <X size={14} />
                  </button>
                </span>
              ) : (
                <h2 className="text-xl font-bold text-neutral-900 truncate flex items-center gap-1">
                  {world.name}
                  {world.owned && !locked && !readOnly && (
                    <button
                      onClick={() => {
                        setNameDraft(world.name);
                        setEditingName(true);
                      }}
                      className="p-1 rounded text-neutral-300 hover:text-neutral-700 hover:bg-neutral-100"
                      title="이름 변경"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </h2>
              )}
              <StatusPill status={world.status} />
              {world.source === "import" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">삽입</span>}
              {!world.owned && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">초대됨</span>}
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              소유자: {world.ownerName} · {world.version || "?"} · 보더 {world.border}×{world.border}
            </p>
          </div>
        </div>

        {/* 소유자 = 전체 관리. 초대 멤버 = 부여된 권한(백업/다운로드)만 노출. */}
        {(ownerControls || canBackup || canDownload) && (
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {archived ? (
              <>
                {canDownload && <ActionBtn onClick={onDownload} disabled={busy} icon={<Download size={15} />} label="다운로드" />}
                {ownerControls && (
                  <button
                    onClick={onRestore}
                    disabled={busy || locked}
                    title={locked ? "용량 초과 잠금 중에는 활성화할 수 없습니다." : ""}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-colors disabled:opacity-40"
                  >
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />} 활성화
                  </button>
                )}
              </>
            ) : (
              <>
                {canBackup && <ActionBtn onClick={onBackup} disabled={busy || !active || locked} icon={<Archive size={15} />} label="백업" />}
                {canDownload && <ActionBtn onClick={onDownload} disabled={busy || !active} icon={<Download size={15} />} label="다운로드" />}
                {ownerControls && <ActionBtn onClick={onDeactivate} disabled={busy || !active || locked} icon={<PowerOff size={15} />} label="비활성화" />}
              </>
            )}
            {ownerControls && (
              <button
                onClick={onDelete}
                disabled={busy}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors disabled:opacity-40"
              >
                <Trash2 size={15} /> 삭제
              </button>
            )}
          </div>
        )}
      </div>

      {/* 탐방 공유 — 소유자가 켜면 누구나 /탐방 에서 이 월드를 둘러볼 수 있다(빌드는 불가). 유저당 최대 9개. */}
      {ownerControls && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-700">
              🧭 탐방 공유
              {world.exploreSuspended && <span className="text-[9px] font-bold px-1 py-px rounded bg-rose-100 text-rose-600">관리자 정지됨</span>}
            </div>
            <div className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
              {world.exploreSuspended
                ? "관리자가 이 월드의 탐방 공유를 정지했습니다."
                : world.exploreShared
                ? "다른 유저가 인게임 /탐방 에서 이 월드를 둘러볼 수 있어요."
                : "켜면 누구나 인게임 /탐방 에서 이 월드를 둘러볼 수 있어요. (유저당 최대 9개)"}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!world.exploreShared}
            onClick={() => onExploreShare?.(!world.exploreShared)}
            disabled={busy || !!world.exploreSuspended || !active}
            title="탐방 공유 토글"
            className={`relative shrink-0 inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-40 ${
              world.exploreShared ? "bg-emerald-600" : "bg-neutral-300"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                world.exploreShared ? "translate-x-[18px]" : "translate-x-[3px]"
              }`}
            />
          </button>
        </div>
      )}

      {archived && (
        <div className="text-xs text-neutral-500 bg-neutral-100 rounded-xl px-4 py-3 flex items-start gap-2">
          <Archive size={14} className="mt-0.5 shrink-0" />
          <span>
            비활성 상태 — 서버에서 내려가(unload) 아카이브에 보관 중입니다. <b>활성화</b>하면 다시 사용할 수 있습니다.
            {world.archivedAt && (
              <> 아카이브 후 90일이 지나면 영구 삭제됩니다 (삭제 예정: <b>{fmtDate(addDays(world.archivedAt, 90))}</b>).</>
            )}
          </span>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* 월드 정보 */}
        <div>
          <SectionLabel>월드 정보</SectionLabel>
          <div className="grid grid-cols-2 gap-px bg-neutral-200 rounded-xl overflow-hidden border border-neutral-200">
            <Info icon={<HardDrive size={13} />} label="용량" value={formatBytes(world.sizeBytes)} />
            <Info icon={<Globe size={13} />} label="버전" value={world.version || "?"} />
            <Info icon={<Calendar size={13} />} label="업로드" value={fmtDate(world.createdAt)} />
            <Info icon={<Clock size={13} />} label="최근 저장" value={fmtDate(world.lastSaved)} />
            <Info icon={<Archive size={13} />} label="최근 백업" value={fmtDate(world.lastBackupAt)} />
            <Info icon={<Users size={13} />} label="초대 멤버" value={`${world.trusted.length}명`} />
          </div>

          <div className="mt-4">
            <SectionLabel>초대된 멤버</SectionLabel>
            {world.trusted.length === 0 ? (
              <p className="text-xs text-neutral-400">아직 초대된 멤버가 없습니다.</p>
            ) : ownerControls ? (
              <div className="space-y-1.5">
                {world.trusted.map((m) => {
                  const granted = PERM_KEYS.filter((pk) => m.perms?.[pk]).length;
                  const open = permBubble === m.name;
                  return (
                    <div key={m.uuid || m.name} className="relative flex items-center gap-2">
                      <McAvatar id={m.uuid} name={m.name} size={22} />
                      <span className="text-xs font-medium text-neutral-700 truncate max-w-[110px]">{m.name}</span>
                      <div className="ml-auto flex items-center gap-1.5">
                        <button
                          onClick={() => setPermBubble(open ? null : m.name)}
                          disabled={busy || locked}
                          className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md transition-colors disabled:opacity-50 ${
                            granted > 0 ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200"
                          }`}
                        >
                          권한 {granted}/{PERM_KEYS.length}
                          <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                        </button>
                        <button onClick={() => onKick(m.name)} disabled={busy} className="text-neutral-300 hover:text-rose-600 disabled:opacity-40" title="제외">
                          <X size={13} />
                        </button>
                      </div>
                      {open && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setPermBubble(null)} />
                          <div className="absolute right-0 top-full mt-1 z-20 w-56 bg-white border border-neutral-200 rounded-xl shadow-lg p-1.5">
                            <div className="px-2 pt-1 pb-1.5 mb-1 text-[11px] font-bold text-neutral-500 border-b border-neutral-100">{m.name} 님 권한</div>
                            {PERM_KEYS.map((pk) => {
                              const on = !!m.perms?.[pk];
                              return (
                                <button
                                  key={pk}
                                  onClick={() => onSetMemberPerm(m.name, pk, !on)}
                                  disabled={busy || locked}
                                  className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-neutral-50 disabled:opacity-50"
                                >
                                  <span className="text-left">
                                    <span className="block text-xs font-medium text-neutral-700">{PERM_LABELS[pk]}</span>
                                    <span className="block text-[10px] text-neutral-400">{PERM_DESC[pk]}</span>
                                  </span>
                                  <span className={`shrink-0 relative w-9 h-5 rounded-full transition-colors ${on ? "bg-emerald-500" : "bg-neutral-200"}`}>
                                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {world.trusted.map((m) => (
                  <McMemberChip
                    key={m.uuid || m.name}
                    id={m.uuid}
                    name={m.name}
                    onRemove={canKick ? () => onKick(m.name) : undefined}
                    disabled={busy}
                  />
                ))}
              </div>
            )}
            {canInvite && (
              <div className="flex gap-1.5 mt-2">
                <input
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") doInvite();
                  }}
                  placeholder="초대할 닉네임"
                  maxLength={16}
                  className="flex-1 border border-neutral-200 px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:border-black"
                />
                <button
                  onClick={doInvite}
                  disabled={busy || inviteInput.trim().length < 2}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-700 text-white text-[11px] font-bold rounded-lg disabled:opacity-50"
                >
                  <UserPlus size={12} /> 초대
                </button>
              </div>
            )}
            <p className="text-[11px] text-neutral-400 mt-2">
              {world.owned
                ? "권한 버튼으로 멤버별 기능을 켜고 끕니다. 편집=인게임 빌드, 게임룰/백업/다운로드=웹 기능."
                : "내게 부여된 권한만 사용할 수 있습니다."}
            </p>
            {ownerControls && active && (
              <div className="mt-3 pt-3 border-t border-neutral-100">
                <div className="text-[11px] font-bold text-neutral-500 mb-1.5">소유권 양도</div>
                {world.pendingTransfer ? (
                  <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
                    <Clock size={13} className="text-amber-500 shrink-0" />
                    <span className="text-amber-700 truncate">
                      <b>{world.pendingTransfer.name}</b> 님 수락 대기중
                    </span>
                    <button onClick={onCancelTransfer} disabled={busy} className="ml-auto text-[10px] font-bold text-neutral-400 hover:text-rose-600 disabled:opacity-50">
                      취소
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <input
                      value={transferInput}
                      onChange={(e) => setTransferInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && transferInput.trim().length >= 2) {
                          onTransfer(transferInput.trim());
                          setTransferInput("");
                        }
                      }}
                      placeholder="양도할 닉네임"
                      maxLength={16}
                      className="flex-1 border border-neutral-200 px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:border-black"
                    />
                    <button
                      onClick={() => {
                        onTransfer(transferInput.trim());
                        setTransferInput("");
                      }}
                      disabled={busy || transferInput.trim().length < 2}
                      className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-lg disabled:opacity-50"
                    >
                      양도
                    </button>
                  </div>
                )}
                <p className="text-[11px] text-neutral-400 mt-1.5">소유권을 넘기면 상대가 수락 시 이 월드가 상대 것이 됩니다 (용량도 이전).</p>
              </div>
            )}
            {!world.owned && !readOnly && (
              <div className="mt-3 pt-3 border-t border-neutral-100">
                <button
                  onClick={onLeave}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  <LogOut size={12} /> 이 월드에서 나가기
                </button>
                <p className="text-[11px] text-neutral-400 mt-1.5">초대를 해제하고 이 월드 목록·빌드 권한에서 빠집니다.</p>
              </div>
            )}
          </div>
        </div>

        {/* Gamerule */}
        <div>
          <SectionLabel>
            Gamerule 및 월드 설정
            {liveBusy && <Loader2 size={11} className="inline ml-1.5 animate-spin text-neutral-400" />}
          </SectionLabel>
          {/* 토글류(게임룰 + 폭발방지) — 2열 그리드로 높이 절감 */}
          <div className="grid grid-cols-2 gap-px bg-neutral-200 rounded-xl overflow-hidden border border-neutral-200">
            {flagEntries.map((f) => {
              const known = typeof f.v === "boolean";
              const on = f.v === true;
              return (
                <div key={f.key} className="bg-white px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-[13px] text-neutral-700 leading-tight">{f.label}</span>
                  {editable ? (
                    <Toggle on={on} busy={ruleBusy === f.key} disabled={settingBusy} onClick={() => onToggleRule(f.key, !on)} />
                  ) : (
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded shrink-0 ${
                        !known ? "bg-neutral-100 text-neutral-400" : on ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {!known ? "—" : on ? "켜짐" : "꺼짐"}
                    </span>
                  )}
                </div>
              );
            })}
            {/* 폭발 방지 (Explosion) — 토글 그리드의 8번째 칸 */}
            <div className="bg-white px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-[13px] text-neutral-700 leading-tight">폭발 방지 (Explosion)</span>
              {editable ? (
                <Toggle on={explosionOn} busy={ruleBusy === "explosionBlocked"} disabled={settingBusy} onClick={() => onSetting("explosionBlocked", !explosionOn)} />
              ) : (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded shrink-0 ${explosionOn ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                  {explosionOn ? "켜짐" : "꺼짐"}
                </span>
              )}
            </div>
          </div>

          {/* 넓은 설정(게임모드/난이도/랜덤틱) — 풀폭 */}
          <div className="mt-2 rounded-xl border border-neutral-200 divide-y divide-neutral-100">
            {/* 게임모드 (Game Mode) — Multiverse 가 월드별로 관리, 입장 시 적용 */}
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-[13px] text-neutral-700 shrink-0">게임모드 (Game Mode)</span>
              {editable ? (
                <div className="flex flex-wrap gap-1 justify-end">
                  {GAMEMODES.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => onSetting("gamemode", g.id)}
                      disabled={settingBusy}
                      title={g.label}
                      className={`text-[11px] font-bold px-2 py-1 rounded-lg transition-colors disabled:opacity-50 ${
                        gamemode === g.id ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                      }`}
                    >
                      {g.label.split(" ")[0]}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-neutral-100 text-neutral-500">{gamemodeLabel(gamemode)}</span>
              )}
            </div>

            {/* 난이도 (Difficulty) */}
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-[13px] text-neutral-700 shrink-0">난이도 (Difficulty)</span>
              {editable ? (
                <div className="flex flex-wrap gap-1 justify-end">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => onSetting("difficulty", d.id)}
                      disabled={settingBusy}
                      title={d.label}
                      className={`text-[11px] font-bold px-2 py-1 rounded-lg transition-colors disabled:opacity-50 ${
                        difficulty === d.id ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                      }`}
                    >
                      {d.label.split(" ")[0]}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-neutral-100 text-neutral-500">{difficultyLabel(difficulty)}</span>
              )}
            </div>

            {/* 랜덤 틱 속도 (Random Tick Speed) */}
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[13px] text-neutral-700">랜덤 틱 속도 (Random Tick Speed)</span>
              {editable ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSetting("randomTickSpeed", Math.max(0, tick - 1))}
                    disabled={settingBusy || tick <= 0}
                    className="w-6 h-6 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-bold leading-none disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-bold tabular-nums">
                    {ruleBusy === "randomTickSpeed" ? <Loader2 size={12} className="inline animate-spin text-neutral-400" /> : tick}
                  </span>
                  <button
                    onClick={() => onSetting("randomTickSpeed", Math.min(40, tick + 1))}
                    disabled={settingBusy || tick >= 40}
                    className="w-6 h-6 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-bold leading-none disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              ) : (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-neutral-100 text-neutral-500">{tick}</span>
              )}
            </div>
          </div>
          <p className="text-[11px] text-neutral-400 mt-2">
            {editable
              ? "변경은 서버에 즉시 적용됩니다. 게임모드는 Multiverse 가 입장 시 적용합니다."
              : !active
              ? "활성 상태에서만 변경할 수 있습니다."
              : canGamerule
              ? "변경할 수 있습니다."
              : "게임룰 권한이 없어 읽기 전용입니다."}
          </p>

          {/* 월드 보호 설정 (개인 월드 오버라이드) — 모달 */}
          {editable && (
            <button
              onClick={() => setProtectOpen(true)}
              className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-[12px] font-bold text-neutral-700 rounded-xl transition-colors"
            >
              <ShieldAlert size={14} className="text-neutral-500" /> 월드 보호 설정
            </button>
          )}
          {protectOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setProtectOpen(false)}>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-black text-neutral-900">월드 보호 설정</h3>
                  <button onClick={() => setProtectOpen(false)} className="text-neutral-400 hover:text-neutral-600">
                    <X size={18} />
                  </button>
                </div>
                <p className="text-[12px] text-neutral-500 mb-4">이 개인 월드에만 적용됩니다. 기본은 서버 보호가 켜져 있습니다.</p>
                <div className="rounded-xl border border-neutral-200 divide-y divide-neutral-100">
                  {[
                    { key: "allowItemDrop", label: "아이템 버리기 허용", desc: "끄면 Q로 버리기 차단", on: allowItemDrop },
                    { key: "allowRedstone", label: "레드스톤 작동 허용", desc: "끄면 회로 신호 비활성", on: allowRedstone },
                    { key: "allowPhysics", label: "블록 물리·중력 작동", desc: "끄면 공중·비지지 블록 유지(빌드 자유)", on: allowPhysics },
                    { key: "trampleProtect", label: "밟기 파괴 방지", desc: "거북알·경작지 밟아도 안 부서짐", on: trampleProtect },
                  ].map((row) => (
                    <div key={row.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div>
                        <div className="text-[13px] font-bold text-neutral-700">{row.label}</div>
                        <div className="text-[11px] text-neutral-400">{row.desc}</div>
                      </div>
                      <Toggle on={row.on} busy={ruleBusy === row.key} disabled={settingBusy} onClick={() => onSetting(row.key, !row.on)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 다이나믹맵 */}
      <div>
        <SectionLabel>다이나믹맵 (Dynmap)</SectionLabel>
        {MAP_URL && world.mvWorld && active ? (
          <>
            <div className="rounded-xl overflow-hidden border border-neutral-200">
              <iframe ref={worldMapRef} title={`Dynmap ${world.name}`} src={buildWorldMapSrc(world.mvWorld)} className="w-full h-[600px]" loading="lazy" onLoad={() => worldMapRef.current?.contentWindow?.postMessage({ __bc: "dynmap-goto", world: world.mvWorld, x: 0, z: 0 }, "*")} />
            </div>
            <DynmapPlayerContextMenu iframeRef={worldMapRef} title={`월드 ${world.name}`} actions={mapMenuActions} />
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 h-72 flex flex-col items-center justify-center text-neutral-400">
            <MapIcon size={28} className="mb-2" />
            <p className="text-xs">
              {!MAP_URL ? "Dynmap 미설정 (NEXT_PUBLIC_MINECRAFT_MAP_URL)" : !active ? "활성 월드만 지도가 표시됩니다" : "월드 지도를 준비 중입니다"}
            </p>
          </div>
        )}
      </div>

      {world.status === "provisioning" && (
        <div className="text-[11px] text-amber-600 flex items-center gap-1.5">
          <Clock size={12} /> 서버 프로비저닝 대기 중 — 플러그인 연동 후 자동 활성화됩니다.
        </div>
      )}
    </div>
  );
}

function Toggle({ on, busy, disabled, onClick }: { on: boolean; busy?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative w-10 h-6 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-emerald-500" : "bg-neutral-300"}`}
    >
      {busy ? (
        <Loader2 size={12} className="absolute inset-0 m-auto animate-spin text-white" />
      ) : (
        <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all" style={{ left: on ? 18 : 2 }} />
      )}
    </button>
  );
}

function difficultyLabel(id: string): string {
  const d = DIFFICULTIES.find((x) => x.id === id);
  return d ? d.label.split(" ")[0] : "—";
}

function gamemodeLabel(id: string): string {
  const g = GAMEMODES.find((x) => x.id === id);
  return g ? g.label.split(" ")[0] : "—";
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { t: string; c: string }> = {
    active: { t: "활성", c: "bg-emerald-50 text-emerald-700" },
    provisioning: { t: "프로비저닝 중", c: "bg-amber-50 text-amber-700" },
    archived: { t: "비활성", c: "bg-neutral-200 text-neutral-600" },
  };
  const s = map[status] || { t: status, c: "bg-neutral-100 text-neutral-500" };
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.c}`}>{s.t}</span>;
}

function ActionBtn({ icon, label, disabled, onClick }: { icon: ReactNode; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 hover:bg-neutral-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
    >
      {icon} {label}
    </button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">{children}</div>;
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mb-1">
        {icon} {label}
      </div>
      <div className="text-sm font-semibold text-neutral-900 truncate">{value}</div>
    </div>
  );
}
