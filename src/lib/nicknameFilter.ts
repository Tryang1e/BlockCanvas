// 닉네임 변경권 유효성 검사 — 길이·문자셋·운영 사칭·정치/논란/혐오/비속어 차단.
//  - 웹에서 1차 검증(여기) → 통과한 nick 만 플러그인(/api/cmi/nick)이 CMI 로 적용한다.
//  - 매칭은 정규화(소문자) 후 부분일치 + 숫자 끼워넣기 우회(시1발→시발)도 함께 검사한다.
//    (허용 문자셋이 한글/영문/숫자뿐이라 초성 ㅅㅂ·특수문자 우회는 애초에 입력 단계에서 막힌다.)
//  - 목록은 대표 예시이며 운영하며 RESERVED / BANNED_TERMS 에 한 줄씩 추가해 확장한다.

export const NICK_MIN_LEN = 2;
export const NICK_MAX_LEN = 5; // 사용자 요청: 5자 이하

// 운영/시스템 사칭성 닉(부분일치 차단). 일반어 오탐을 피하려고 구체형으로(예: '주인'(→주인공) 대신 '주인장').
const RESERVED = [
  "관리자", "운영자", "운영팀", "운영진", "어드민", "주인장", "서버지기", "스태프", "매니저", "모더레이터", "지엠",
  "admin", "administrator", "owner", "console", "staff", "moderator", "system",
  "블록캔버스", "blockcanvas", "크래프토피아", "craftopia",
];

// 정치/논란/혐오/비속어(부분일치 차단). 대표 예시 — 운영 중 확장.
const BANNED_TERMS = [
  // 정치인(국내)
  "윤석열", "이재명", "문재인", "박근혜", "이명박", "노무현", "김영삼", "김대중",
  "전두환", "노태우", "박정희", "이승만", "조국", "한동훈", "추미애", "홍준표", "이준석", "안철수",
  // 정치인(국외)·지도자
  "트럼프", "바이든", "오바마", "푸틴", "시진핑", "마오쩌둥", "모택동",
  // 북한
  "김정은", "김일성", "김정일", "김여정",
  // 정파·이념(논란)
  "국민의힘", "더불어민주당", "민주당", "정의당", "새누리당", "자유한국당", "공산당", "공산주의", "주사파", "종북", "빨갱이",
  // 혐오·극단주의 상징
  "히틀러", "hitler", "나치", "nazi", "파시스트", "isis", "탈레반", "kkk", "욱일기", "전범기",
  "일베", "일간베스트", "메갈", "메갈리아", "워마드",
  // 혐오·비하 표현
  "한남충", "한녀", "김치녀", "된장녀", "맘충", "급식충", "틀딱", "짱깨", "짱개", "쪽바리", "떼놈",
  // 욕설(한국)
  "씨발", "시발", "씌발", "시벌", "십새끼", "십새", "씹새", "좆", "존나", "병신", "빙신",
  "개새끼", "개색끼", "개색기", "지랄", "닥쳐", "엠창", "니애미", "느금마",
  "보지", "자지", "자위", "창녀", "창년", "걸레년", "썅놈", "썅년", "등신", "머저리",
  "호로새끼", "호로자식", "쌍놈", "쌍년", "강간", "섹스", "야동",
  // 욕설·비속어(영어, 일부 leet 변형 포함)
  "fuck", "fuk", "fck", "shit", "sh1t", "bitch", "b1tch", "asshole", "bastard",
  "dick", "pussy", "cunt", "nigger", "nigga", "faggot", "retard",
];

// 정규화: 소문자 + (영숫자·한글) 외 제거
function norm(s: string): string {
  return s.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

// 원형(숫자 유지) + 숫자 제거형(시1발→시발) 양쪽에서 부분일치 검사 → 숫자 끼워넣기 우회 차단.
function containsAny(value: string, terms: string[]): boolean {
  const kept = norm(value);
  const stripped = kept.replace(/[0-9]/g, "");
  return terms.some((t) => {
    const nt = norm(t);
    return nt.length > 0 && (kept.includes(nt) || stripped.includes(nt));
  });
}

export interface NickCheck {
  ok: boolean;
  reason?: string;
  nick?: string; // 통과 시 정제(trim)된 닉네임
}

/** 새 닉네임 유효성 검사 — 길이/문자셋/예약어/금지어. 통과 시 { ok:true, nick }. */
export function validateNickname(raw: string): NickCheck {
  const nick = (raw ?? "").trim();
  if (!nick) return { ok: false, reason: "닉네임을 입력해주세요." };
  if (!/^[가-힣A-Za-z0-9]+$/.test(nick)) {
    return { ok: false, reason: "한글·영문·숫자만 사용할 수 있어요. (공백·특수문자·색상코드 불가)" };
  }
  // 길이는 코드포인트 단위 — 한글 1글자=1자
  const len = [...nick].length;
  if (len < NICK_MIN_LEN) return { ok: false, reason: `닉네임은 최소 ${NICK_MIN_LEN}자 이상이어야 해요.` };
  if (len > NICK_MAX_LEN) return { ok: false, reason: `닉네임은 ${NICK_MAX_LEN}자 이하만 가능해요.` };

  if (containsAny(nick, RESERVED)) {
    return { ok: false, reason: "운영진 사칭 등으로 사용할 수 없는 닉네임이에요." };
  }
  if (containsAny(nick, BANNED_TERMS)) {
    return { ok: false, reason: "정치·논란·부적절한 표현이 포함된 닉네임은 사용할 수 없어요." };
  }
  return { ok: true, nick };
}
