-- 포트폴리오 섹션 테이블에 제목 표시 여부를 저장하는 컬럼 추가
-- 기본값은 true (보임) 입니다.
ALTER TABLE portfolio_sections
ADD COLUMN IF NOT EXISTS show_title BOOLEAN DEFAULT true;
