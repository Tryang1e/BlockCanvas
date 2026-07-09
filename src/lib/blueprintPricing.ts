// 유료 블루프린트 최소 판매가(코인).
// 판매/구매 수수료(합 20%)를 반올림해도 판매 수익이 0이 되지 않는 최소값 — 극단적인 저가 판매를 막는다.
// 서버(createBlueprintPost)와 클라이언트(업로드 모달)가 같은 임계값으로 검증하도록 공유하는 단일 상수.
// (server-only 의존이 없어 "use client" 모듈에서도 안전하게 import 가능.)
export const BLUEPRINT_MIN_PAID_PRICE = 10;
