# 특정 회원 이메일 변경 가이드

프로젝트는 **SQLite** 데이터베이스를 사용하고 있으며, `prisma/schema.prisma` 스키마 기준 사용자 테이블은 `Profile` 모델입니다. 회원의 이메일은 `Profile` 모델의 `email` 필드에 저장되어 있습니다.

특정 회원의 이메일을 변경하는 데는 크게 **세 가지 방법**이 있습니다.

---

## 방법 1: Prisma Studio 활용 (가장 추천)

현재 백그라운드 터미널에서 `npx prisma studio`가 이미 실행 중이므로 가장 쉽고 안전하게 GUI로 변경할 수 있습니다.

1. **Prisma Studio 접속**
   * 웹 브라우저를 열고 다음 주소로 접속합니다:
     ```
     http://localhost:5555
     ```
2. **Profile 테이블 선택**
   * 화면에 표시되는 모델 목록에서 **Profile** 모델을 선택합니다.
3. **이메일 변경**
   * 변경하고자 하는 회원의 행(Row)을 찾습니다 (`creator_name` 또는 `id` 등으로 검색 가능).
   * `email` 컬럼의 값을 더블클릭한 후, 새로운 이메일 주소로 수정합니다.
4. **저장**
   * 상단에 표시되는 **"Save 1 change"** (초록색 버튼)를 클릭하여 데이터베이스에 최종 반영합니다.

---

## 방법 2: 일회성 Node.js 스크립트 실행

Prisma Client를 이용해 터미널에서 스크립트 하나로 빠르게 변경할 수도 있습니다.

1. 프로젝트 루트 디렉토리에 임시 스크립트 파일(예: `change_email.js`)을 만듭니다.
2. 아래 코드를 복사하여 넣습니다:
   ```javascript
   const { PrismaClient } = require('@prisma/client');
   const prisma = new PrismaClient();

   async function main() {
     // 여기에 변경하려는 회원의 식별 값(예: creator_name)과 새 이메일을 적어주세요.
     const targetCreatorName = '변경할_회원_아이디'; 
     const newEmail = 'new_email@example.com';

     const updated = await prisma.profile.update({
       where: { creator_name: targetCreatorName },
       data: { email: newEmail }
     });

     console.log('이메일 변경 성공:', updated);
   }

   main()
     .catch((e) => {
       console.error('변경 중 에러 발생:', e);
     })
     .finally(async () => {
       await prisma.$disconnect();
     });
   ```
3. 터미널에서 아래 명령을 실행합니다:
   ```bash
   node change_email.js
   ```
4. 변경이 성공적으로 완료되면 임시 작성했던 `change_email.js` 파일을 삭제합니다.

---

## 방법 3: SQLite GUI 도구 직접 사용

프로젝트 루트에 있는 로컬 SQLite 파일(`dev.db`)을 DB 관리 툴로 직접 수정하는 방법입니다.

1. **SQLite 뷰어/에디터 다운로드**
   * [DB Browser for SQLite](https://sqlitebrowser.org/) 또는 [DBeaver](https://dbeaver.io/) 같은 툴을 켭니다.
2. **데이터베이스 연결**
   * `c:\Github\BlockCanvas\dev.db` 경로에 있는 SQLite 파일을 엽니다.
3. **SQL 또는 데이터 테이블 편집**
   * `Profile` 테이블의 데이터를 직접 수정하거나, 아래 SQL 쿼리를 실행합니다.
   ```sql
   UPDATE "Profile" 
   SET "email" = 'new_email@example.com' 
   WHERE "creator_name" = '변경할_회원_아이디';
   ```
4. **변경 사항 저장 (Write Changes / Commit)**
   * 변경 내용을 저장(Write Changes)하여 데이터베이스 파일에 반영합니다.
