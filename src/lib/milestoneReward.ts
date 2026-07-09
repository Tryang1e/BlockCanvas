/**
 * 마일스톤 지급 계산 (2트랙 보상 공용). 고유 이벤트(다운로드/반응) 1건당 최대 1마일스톤을 지급한다.
 *
 * count 는 이 이벤트의 원자 증가(+1) 직후 값. floor(count/step) 가 floor((count-1)/step) 보다 크면
 * "이 이벤트가 새 경계를 넘음"이고, 그때만 guardAdvance(newMs) 로 고수위(paid)를 newMs 로 끌어올린다.
 * guardAdvance 는 `paid < newMs 일 때만` 갱신하는 conditional updateMany 의 영향 행수(0/1)를 반환한다.
 *
 * 두 가지 어뷰징을 이 고수위 게이트가 동시에 막는다:
 *  - 반응 취소→재-반응(또는 다운로드 원장 재생성)으로 같은 경계를 반복 통과해도 paid 가 이미 그 이상이라 재지급 0.
 *  - 같은 게시물에 대한 동시 이벤트: 각자 자신의 원자 count 를 갖고, 고수위 갱신에 성공한 쪽만 1마일스톤 지급.
 *    (동시 경합 시 최대 1마일스톤만큼 "과소" 지급될 수 있으나 절대 과다 지급/파밍은 없다 — 안전한 방향.)
 *
 * step=1 이면 매 이벤트가 경계(개당 지급), step=10 이면 10·20·… 누적마다 1회(보너스). 두 트랙을 각자의 paid 컬럼으로 호출.
 * 반환값 = 이번에 지급할 코인(0 또는 coin). 실제 CMI 지급/원장은 호출부의 deliverCoins.
 *
 * ⚠ 설계상 트레이드오프(claim-first): 고수위(paid) 갱신을 deliverCoins '전에' 원자적으로 확정한다. 이는 동시성/재-반응
 *   경합에서 절대 과다지급(파밍)이 없도록 하는 대신, dailyEarnCap 이 켜져 초과분이 잘리면 그 마일스톤 보상이 소멸할 수
 *   있다(안전한 방향=과소지급). 상한은 기본 0(무제한)이라 평시엔 발생하지 않는다. '지급 우선(deliver-first)'으로 바꾸면
 *   소멸은 막지만 재-반응 경합에서 드물게 이중지급(과다=인플레)이 생기므로 채택하지 않는다. 재farm 불가·상한 소각이
 *   허용되는 파밍성 보상엔 이 트레이드오프가 맞고, 소멸이 곤란한 비-파밍성 1회 보상(forum_weekly)만 상한을 면제한다.
 */
export async function computeMilestoneCoins(
  count: number,
  step: number,
  coin: number,
  guardAdvance: (newMilestones: number) => Promise<number>,
): Promise<number> {
  if (step <= 0 || coin <= 0 || count <= 0) return 0;
  const newMilestones = Math.floor(count / step);
  if (newMilestones <= Math.floor((count - 1) / step)) return 0; // 이 이벤트는 새 경계 미도달 → DB 접근 없이 스킵
  const advanced = await guardAdvance(newMilestones); // paid<newMs 일 때만 갱신, 영향 행수 반환
  return advanced > 0 ? coin : 0; // 이벤트당 1마일스톤(고수위 갱신 성공 시에만)
}
