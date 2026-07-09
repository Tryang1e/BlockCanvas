import { prisma } from "@/lib/prisma";
import { chargeCoins, awardCoins } from "@/lib/minecraft";
import { getEconomyConfig, logCoinSpend } from "@/lib/economyConfig";

/**
 * 유료 블루프린트 판매(고정가) 코어 — 웹 세션 액션(actions/gallery.purchaseBlueprintAction)이 사용.
 *
 * 경제 모델(사용자 확정):
 *  - 고정가 판매: 판매자가 가격을 정하고 여러 구매자가 각자 그 가격에 구매·다운로드(경매 아님).
 *  - 수수료 20% 소각: 구매자는 가격 + 구매수수료(기본 10%)를 지불하고, 판매자는 가격 − 판매수수료(기본 10%)를 받는다.
 *    두 수수료 합(= gross − net)은 어디에도 지급되지 않고 사라진다(소각) → 통화량 감소 = 서버 인플레이션·쌀먹 억제.
 *  - 무료 공존: price=0 은 기존처럼 무료 다운로드 + 작성자 다운로드 마일스톤 보상. 유료글은 판매수익만(마일스톤 없음).
 *
 * 코인 이동은 CMI 가 진실원본이다(웹 원장은 분석용). chargeCoins(구매자 gross 차감)로 결제하고, awardCoins(판매자 net 지급)로
 * 대금을 지급한다. 소각분(net 을 제외한 나머지)은 재지급하지 않으므로 자연히 소멸한다.
 */

export interface BlueprintFees {
  buyerFee: number; // 구매자가 가격에 더해 내는 수수료
  sellerFee: number; // 판매자가 받는 금액에서 빠지는 수수료
  gross: number; // 구매자 총지불 = price + buyerFee
  net: number; // 판매자 실수령 = price − sellerFee
  burned: number; // 소각 합 = buyerFee + sellerFee = gross − net
}

/** 판매가 + 수수료율(%)로 결제/수령/소각 금액을 계산. 퍼센트는 0~100 으로 클램프, 정수 코인(수수료는 올림). */
export function computeBlueprintFees(price: number, buyerPct: number, sellerPct: number): BlueprintFees {
  const p = Math.max(0, Math.floor(price));
  const bp = Math.min(100, Math.max(0, buyerPct));
  const sp = Math.min(100, Math.max(0, sellerPct));
  const buyerFee = Math.ceil((p * bp) / 100);
  const sellerFee = Math.min(p, Math.ceil((p * sp) / 100)); // 판매수수료가 가격을 넘지 않도록(net 음수 방지)
  const gross = p + buyerFee;
  const net = p - sellerFee;
  return { buyerFee, sellerFee, gross, net, burned: gross - net };
}

type PurchaseResult =
  | { success: true; message: string; balance?: number | null; alreadyOwned?: boolean }
  | { success: false; error: string };

/**
 * 유료 블루프린트 1건 구매. 이중결제 방지 설계(reserve-first):
 *  - 먼저 BlueprintPurchase(post_id, buyer_id unique)를 예약 생성 → 이 unique 제약이 "결제"를 게이트한다.
 *    동시 클릭/여러 탭이 와도 예약은 정확히 1건만 성공하므로 chargeCoins 는 (게시물, 구매자)당 최대 1회만 실행된다.
 *  - 그 다음에 결제(chargeCoins). 결제 실패 시 예약 row 를 지운다(돈이 움직이지 않았으므로 환불 불필요) → 환불 유실 위험 제거.
 *  - 이미 예약(=구매)돼 있으면 결제 없이 alreadyOwned 반환.
 */
export async function purchaseBlueprintForProfile(
  buyer: { id: string; creator_name: string; minecraft_uuid: string | null },
  postId: string
): Promise<PurchaseResult> {
  if (!buyer.minecraft_uuid) return { success: false, error: "먼저 마인크래프트 계정을 연동해주세요." };

  const post = await prisma.blueprintPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      title: true,
      price: true,
      status: true,
      author_id: true,
      author: { select: { minecraft_uuid: true } },
    },
  });
  if (!post || post.status === "removed") return { success: false, error: "게시물을 찾을 수 없습니다." };
  if (post.status !== "published") return { success: false, error: "검토 중인 게시물은 구매할 수 없습니다." };
  if (post.price <= 0) return { success: false, error: "무료 블루프린트입니다. 바로 다운로드하세요." };
  if (post.author_id === buyer.id) return { success: false, error: "본인 게시물은 구매할 수 없습니다." };
  // 판매자가 대금을 받을 UUID 가 없으면(작성 후 연동 해제 등) 판매금(net)이 소각되지 않고 소멸해버리므로 결제 전에 차단.
  const sellerUuid = post.author.minecraft_uuid;
  if (!sellerUuid) return { success: false, error: "판매자가 지금 대금을 받을 수 없는 상태예요. 잠시 후 다시 시도해주세요." };

  const cfg = await getEconomyConfig();
  const { gross, net, burned } = computeBlueprintFees(post.price, cfg.blueprintBuyerFeePercent, cfg.blueprintSellerFeePercent);
  if (gross <= 0) return { success: false, error: "잘못된 판매가입니다." };

  // 1) 소유권 예약(reserve) — unique 가드로 이중결제를 원천 차단(결제 前 예약). 이미 있으면 결제 없이 소유 인정.
  try {
    await prisma.blueprintPurchase.create({
      data: { post_id: postId, buyer_id: buyer.id, price: post.price, fee: burned, seller_amount: net },
    });
  } catch {
    const dup = await prisma.blueprintPurchase.findUnique({
      where: { post_id_buyer_id: { post_id: postId, buyer_id: buyer.id } },
      select: { id: true },
    });
    if (dup) return { success: true, alreadyOwned: true, message: "이미 구매한 블루프린트입니다. 다운로드할 수 있어요." };
    return { success: false, error: "구매 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." };
  }

  // 2) 결제(CMI 차감, gross = price + 구매수수료). 실패 시 예약 취소 — 돈이 움직이지 않았으므로 환불 불필요.
  const charge = await chargeCoins(buyer.minecraft_uuid, gross);
  if (!charge.success) {
    await prisma.blueprintPurchase.deleteMany({ where: { post_id: postId, buyer_id: buyer.id } }).catch(() => {});
    return {
      success: false,
      error:
        charge.status === 402 ? "코인이 부족합니다." :
        charge.status === 503 ? "경제 시스템이 비활성 상태입니다. (관리자 문의)" :
        "결제에 실패했습니다.",
    };
  }

  // 3) 판매수(다운로드 카운트=유료글의 판매 건수) +1 — 인기순 정렬/카드 표시용. best-effort.
  await prisma.blueprintPost.update({ where: { id: postId }, data: { download_count: { increment: 1 } } }).catch(() => {});

  // 4) 판매자 대금 지급(net) — deliverCoins 패턴: 미지급 원장(delivered=false)을 先기록 → 지급 시도 → 성공 시 flip.
  //    판매자가 오프라인/미접속이면 delivered=false 로 남아 접속 시 flushPendingCoins 가 정산한다.
  //    방향=transfer(구매자→판매자 이체, 순통화량 불변).
  //    ⚠ awardCoins 는 멱등이 아니라 CMI 입금 성공 후 응답 유실(→503) 시 flush 가 재지급해 이중지급 여지가 있다
  //      (deliverCoins/flushPendingCoins 등 기존 코인 지급 전반의 한계). 근본해결=플러그인 /api/economy/give 멱등키.
  let sellerPaid = false;
  if (net > 0) {
    let ledgerId: string | null = null;
    try {
      const row = await prisma.coinAward.create({
        data: { profile_id: post.author_id, minecraft_uuid: sellerUuid, amount: net, source: "blueprint_sale", direction: "transfer", reason: post.title, delivered: false },
        select: { id: true },
      });
      ledgerId = row.id;
    } catch { /* 원장 실패는 무시(지급은 진행) */ }
    // 멱등키 = 이 원장 행 id. 응답 유실로 flushPendingCoins 가 재시도해도(같은 id) 판매금이 이중 지급되지 않는다.
    const paid = await awardCoins(sellerUuid, net, `블루프린트 판매: ${post.title}`, ledgerId ?? undefined);
    sellerPaid = paid.success;
    if (sellerPaid && ledgerId) await prisma.coinAward.update({ where: { id: ledgerId }, data: { delivered: true } }).catch(() => {});
  }

  // 5) 소각 원장(수수료 합) — 유출(out). 이미 chargeCoins 로 구매자에게서 빠졌고 판매자에게 재지급되지 않으므로 소멸분.
  await logCoinSpend({ profileId: buyer.id, minecraftUuid: buyer.minecraft_uuid, amount: burned, source: "blueprint_sale_fee", reason: post.title });

  await prisma.creatorLog.create({
    data: { creator_name: buyer.creator_name, action: "BLUEPRINT_BUY", target_id: postId, details: `-${gross}코인 (판매가 ${post.price}·소각 ${burned})` },
  }).catch(() => {});

  await prisma.notification.create({
    data: {
      recipient_id: post.author_id,
      sender_name: "system",
      category: "coin",
      title: "블루프린트 판매",
      body: `'${post.title}' 이(가) 판매되어 ${net} 코인을 받았습니다.${sellerPaid ? "" : " (서버 접속 시 정산됩니다.)"}`,
      meta: JSON.stringify({ coin: net }),
    },
  }).catch(() => {});

  return { success: true, message: `'${post.title}' 을(를) 구매했어요. 이제 다운로드할 수 있습니다.`, balance: charge.balance ?? null };
}

/**
 * 유료 블루프린트 파일 접근(다운로드/내 클라우드 추가) 허용 여부.
 *  - 무료(price<=0): 누구나 허용.
 *  - 유료: 작성자 본인 · 스태프(admin/manager, 검수용) · 구매자만 허용.
 * 다운로드 라우트/클라우드 추가 액션이 스트리밍/복사 전에 이 게이트를 통과해야 한다.
 */
export async function canAccessBlueprint(
  post: { id: string; price: number; author_id: string },
  profile: { id: string; role?: string | null }
): Promise<boolean> {
  if (post.price <= 0) return true;
  if (post.author_id === profile.id) return true;
  const role = (profile.role || "").toLowerCase();
  if (role === "admin" || role === "manager") return true;
  const bought = await prisma.blueprintPurchase.findUnique({
    where: { post_id_buyer_id: { post_id: post.id, buyer_id: profile.id } },
    select: { id: true },
  });
  return !!bought;
}
