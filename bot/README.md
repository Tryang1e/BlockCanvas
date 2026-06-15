# BlockCanvas Discord 봇

MyIdea의 **MAIN HUB**(디스코드) 역할을 담당하는 봇입니다. 웹 대시보드와 **HMAC 서명된 API**로 통신하며, DB를 직접 만지지 않습니다(웹이 단일 진실 공급원).

## 명령어
| 명령어 | 설명 |
|---|---|
| `/연동 <코드>` | 웹 대시보드(계정 관리 → 디스코드 연동)에서 발급한 6자리 코드로 계정 연동 |
| `/홍보 <플롯ID>` | 본인 소유 영토를 현재 채널에 Rich Embed 로 홍보 |
| `/판매 <플롯ID>` | 본인 소유 영토를 판매글로 현재 채널에 게시 |

`/홍보`·`/판매` 는 웹에서 **소유권(discord_id → 프로필 → 플롯 소유)** 을 검증한 뒤에만 동작합니다.

## 설정
1. [Discord Developer Portal](https://discord.com/developers/applications) 에서 Application 생성 → Bot 추가 → **토큰** 발급.
2. `bot/.env.example` 을 `bot/.env` 로 복사하고 값 채우기:
   - `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`
   - `DISCORD_GUILD_ID` (개발 시 권장: 해당 서버에 즉시 반영)
   - `WEB_API_URL` (운영: `https://craftopia.work`)
   - `DISCORD_API_SECRET` — **웹 `.env` 의 동일 값과 일치**시킬 것
3. 봇을 서버에 초대(OAuth2 URL, `applications.commands` + `bot` 스코프).

## 실행
```bash
cd bot
npm install
npm run register   # 슬래시 명령 등록 (최초 1회 / 명령 변경 시)
npm run start      # 봇 기동
npm run typecheck  # 타입 검사
```

## 주의
- 웹 서버가 HTTPS(터널)면 `WEB_API_URL` 도 HTTPS 여야 합니다.
- `/홍보` 는 웹에 캐시된 플롯이 있어야 동작합니다(웹 대시보드에서 **동기화** 1회 필요).
- 봇은 게이트웨이 인텐트로 `Guilds` 만 사용합니다(메시지 내용 인텐트 불필요).
