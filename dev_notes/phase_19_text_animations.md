# Phase 19: Text Animations Implementation

## 개요
- 사용자가 에디터 내에서 드래그한 텍스트에 다양한 애니메이션 효과를 부여할 수 있는 인라인 텍스트 애니메이션 기능 추가
- 다수의 텍스트가 순환하거나 변하는 블록 수준의 그룹 애니메이션 기능 추가

## 작업 상세 내용

### 1. 신규 컴포넌트 구조
- **AnimatedText (Inline Node):** 
  - Tiptap의 인라인 노드 확장으로 구현.
  - 선택된 텍스트 영역을 노드로 변환하고, 속성으로 `text`와 `animationType`을 저장.
  - 지원 효과: `gradient` (그라데이션), `highlight` (형광펜), `rolling` (롤링), `shimmering` (반짝임), `splitting` (단어별 페이드인), `typing` (타이핑 효과).
- **AnimatedTextGroup (Block Node):** 
  - 다수의 단어나 문장을 쉼표(,)로 구분해 입력받아 자동으로 전환되는 애니메이션 효과 블록.
  - 지원 효과: `rotating` (회전형 루프), `morphing` (모핑/페이드 루프).
  - 에디터 안에서 마우스로 클릭하여 텍스트를 실시간으로 수정(Edit)할 수 있는 인라인 UI 기능 구현.

### 2. Tailwind CSS 및 Keyframes 연동
- 순수 CSS 및 Tailwind 플러그인만으로 애니메이션을 구동하여 외부 의존성(framer-motion 등) 설치 최소화.
- `tailwind.config.ts`의 `extend.keyframes` 및 `extend.animation` 업데이트:
  - `shimmer`, `slideUp`, `fadeIn`, `typing`, `blink`, `slideUpGroup`, `fadeLoop` 키프레임 추가.

### 3. Editor UI 및 로직 연동
- **에디터 툴바:** `RichTextEditor.tsx` 상단 툴바에 "텍스트 애니메이션" 드롭다운 추가.
- **예외 처리:** "드래그한 텍스트 전용" 애니메이션을 선택할 때, 선택된 텍스트가 없으면 경고(Alert) 발생.
- **TypeScript 타입 수정:** Tiptap 코어의 `Commands` 인터페이스를 확장(`declare module '@tiptap/core'`)하여 `setAnimatedText`와 `insertAnimatedTextGroup` 명령어가 Type Error를 일으키지 않도록 타입 단언(`as any`) 추가 처리.
