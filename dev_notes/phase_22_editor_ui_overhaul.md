# Phase 22: Editor UI Overhaul & HTMLRenderer Integration

## 목적 (Objective)
기존 `dangerouslySetInnerHTML`을 사용하던 렌더링 방식을 개선하여, Tiptap 에디터에서 작성한 커스텀 노드(AnimatedTextGroup 등)가 퍼블릭 뷰어에서도 완벽하게 동일한 애니메이션 효과(Framer Motion)로 렌더링되도록 `HTMLRenderer`를 도입하고, 에디터 내 UI/UX(폰트 크기, 드래그 기능, 메뉴 안정성)를 전면 개편합니다.

## 주요 변경 사항

### 1. `HTMLRenderer` 도입
- 기존 `dangerouslySetInnerHTML`로 렌더링하던 `SectionContainer.tsx` 및 `ProjectDetailsViewer.tsx`에 `HTMLRenderer` 컴포넌트를 교체 투입.
- `html-react-parser`를 사용하여 DOM 트리를 순회하고, `data-animated-group` 속성이 있는 노드를 찾아 실제 React 컴포넌트(Framer Motion 기반 애니메이션 텍스트)로 치환(Hydration)하도록 구현.

### 2. AnimatedTextGroup 스타일 내재화
- Tailwind CSS의 `prose` 플러그인 등 외부 스타일링에 의해 애니메이션 블록이 깨지는 현상 방지.
- `NodeViewWrapper` 자체에 인라인 스타일로 폰트 크기, 정렬, 폰트 패밀리를 직접 주입하여 에디터와 퍼블릭 뷰어 간 100% 동일한 시각적 렌더링 보장.

### 3. 에디터 UI 개선 및 버그 수정
- **폰트 크기 선택 개선:** H1, H2, H3 같은 추상적 단위에서 12px ~ 96px까지 수치(Numerical) 단위로 직관적 조절 기능 추가.
- **블록 드래그 앤 드롭 추가:** 텍스트 애니메이션 그룹 좌측에 그립(Grip) 아이콘을 추가하여 드래그 앤 드롭으로 블록 순서를 변경할 수 있도록 `draggable: true` 및 `data-drag-handle` 속성 구현.
- **테두리 가시성 강화:** 편집 중인 텍스트 블록의 테두리를 훨씬 두껍고 진하게 만들어(검은색) 사용자가 블록 영역을 명확히 인지하도록 디자인 개선.

### 4. 고질적인 `flushSync` 렌더링 에러 차단
- Tiptap의 ReactNodeView 컴포넌트가 드래그될 때 내부적으로 발생하는 트랜잭션과 React 18의 렌더링 사이클이 충돌하면서 화면이 하얗게 뜨는 에러(flushSync error) 완벽 해결.
- **조치 1:** 에디터의 올가미(Lasso) 툴이 드래그 핸들 클릭 시 작동하지 않도록 예외 처리하여 드래그 중 초당 수십~수백 번의 불필요한 상태 렌더링 차단.
- **조치 2:** `FloatingMenu` 및 `BubbleMenu`에 `updateDelay={250}` 속성을 강제 주입하여, 드래그 트랜잭션 도중 발생하는 동기적 DOM 측정 시도를 디바운싱(Throttling)함.
- **조치 3:** 플로팅 메뉴의 `shouldShow` 조건에 `editor.view.dragging` 방어 코드를 추가하여 드래그 도중 메뉴가 불필요하게 렌더링 위치를 잡지 않도록 차단.

## 개발 노트
모든 애니메이션(Typing, Splitting, Morphing 등) 컴포넌트는 `animate-ui.tsx`의 래핑된 형태와 1:1로 매핑되었으며, 에디터에서 생성된 HTML 데이터 속성(`data-texts`, `data-animation-type`)을 읽어들여 클라이언트 환경에서도 동일한 프레이머 모션 애니메이션이 실행됩니다. React 18 Concurrent Mode 환경 하에서 Tiptap의 드래그 핸들과 관련된 고질적인 React flushSync 에러는 렌더링 지연과 이벤트 전파 차단 기법을 결합하여 근본적으로 해결되었습니다.

### 5. Animate UI 버튼 컴포넌트 연동
- Animate UI의 Button, Flip Button, Ripple Button, Liquid Button 컴포넌트를 nimate-ui.tsx에 실제 React(Framer Motion) 컴포넌트로 내재화.
- HTMLRenderer.tsx에서 에디터의 버튼 노드(data-button-link)를 감지하여 해당 React 컴포넌트로 직접 치환하도록 구현하여, 퍼블릭 뷰에서 완벽한 인터랙티브 버튼 지원.
- 에디터 내 구형 하단 프롬프트(PromptModal) 입력 바를 제거하고, 삽입 즉시 기본 버튼을 생성한 뒤 버튼 클릭 시 버블 탭(Bubble Menu) 모달에서 즉각적으로 스타일 및 색상을 변경하도록 UX 개편.

### 6. 버튼 컴포넌트 커스터마이징 및 UI 고도화
- 에디터 버블 탭에 버튼 크기(SM, MD, LG, XL) 및 텍스트 크기(수치 직접 입력) 조절 기능 추가.
- 기존 배경색 변경 외에 텍스트 색상(Text Color) 변경 기능 추가 및 UI 라벨링(배경, 글자, 여백, 크기) 직관성 개선.
- Animate UI의 표준 디자인(둥근 모서리 ounded-md, 패딩 등)을 정확히 계승하여 이질감 제거.
- Flip Button의 뒷면(Back) 스타일을 투명 배경 + 테두리 아웃라인 형태로 자동 변환되게 하여 화면 배경(Background)과 자연스럽게 어우러지도록 최적화.

### 7. 버튼 가로/세로 직접 지정 및 텍스트 색상 버그 수정
- 에디터 버블 탭에서 [여백] 드롭다운을 제거하고 [가로], [세로] 픽셀을 직접 입력할 수 있는 필드로 교체하여 디테일한 버튼 크기 커스터마이징을 지원함.
- 사용하지 않는 IconButton import 에러로 인해 Next.js 빌드가 중단되어 발생했던 텍스트 색상 미적용(HMR 실패) 버그를 수정함.
- FlipButton의 뒷면 span이 Wrapper의 커스텀 Width/Height 픽셀 사이즈를 정상적으로 상속(100%)받도록 수정함.

### 8. Flip 버튼 렌더링 수정 및 텍스트 스타일 세부 커스텀 추가
- Flip Button 사용 시 Wrapper 엘리먼트가 버튼 색상을 그대로 상속받아 정작 돌아가는 3D 카드가 보이지 않던 렌더링 버그(투명도 처리 누락)를 해결함.
- 사용자가 폰트(주아체, 나눔명조 등), 볼드체(B), 이탤릭체(I)를 직접 지정할 수 있도록 텍스트 세부 스타일링 옵션을 에디터 버블 메뉴에 추가함.

### 9. 버튼 스타일 즉시 적용 패치 및 폰트 오버라이드 수정
- 에디터 버블 탭에서 [적용] 버튼을 누르지 않으면 폰트나 볼드/이탤릭이 업데이트되지 않던 UX 문제를 개선하여, **값을 바꾸거나 토글을 누를 때마다 즉시 적용(Auto-Apply)** 되도록 로직을 전면 수정함.
- FlipButton 내부 span 엘리먼트가 가진 기본 ont-medium 유틸리티 클래스 때문에 부모로부터 상속받은 Bold/Font-Family 값이 무시되던 현상을 해결하기 위해, 인라인 스타일로 폰트 속성들을 직접 주입함.

### 10. Flip 버튼 뒷면 스타일 변경
- 사용자 요청에 따라 테두리(Border)를 제거하고 하얀색 배경(ackgroundColor: #ffffff)에 그림자(shadow-md)를 주어 명암을 살림.
- 뒷면 텍스트 색상은 기존 앞면의 배경색을 따라가되, 앞면 배경색이 하얀색 계열인 경우 글자가 안 보이는 현상을 방지하기 위해 어두운 색(#171717)으로 자동 폴백(Fallback)되도록 예외 처리함.

### 11. 메인 포트폴리오 배경색(Theme Color) 커스텀 기능 추가
- Portfolio 데이터베이스 모델에 	heme_bg_color 필드를 기본값 #222222로 추가함.
- /creator/[id]/settings 설정 페이지에 [테마 설정] 섹션을 신설하여 사용자가 자유롭게 컬러 피커를 통해 배경색을 지정할 수 있도록 폼을 연동함.
- 실제 포트폴리오 메인 페이지(/creator/[id]) 렌더링 시 하드코딩 되어있던 g-neutral-800 대신 인라인 스타일로 	heme_bg_color 값을 주입하고, 그라데이션 오버레이 또한 동적으로 색상이 이어지도록 수정함.

### 12. 메인 페이지 인라인 테마 색상 에디터 구현 및 Prisma 오류 픽스
- Prisma DB 스키마 업데이트 이후 Next.js 서버가 재시작되지 않아 구형 Prisma Client를 참조하면서 발생한 PrismaClientValidationError 버그를 서버 재시작 및 prisma generate를 통해 해결함.
- 사용자가 매번 설정 페이지로 이동할 필요 없이, 포트폴리오 메인 창에서 직관적으로 배경색을 바꾸고 즉시(실시간) 미리 볼 수 있도록 ThemeColorEditor 클라이언트 컴포넌트를 구현하여 [creator_name]/page.tsx의 우측 상단(설정 버튼 아래)에 배치함.

### 13. 메인 테마 인라인 에디터에 색상 초기화(Reset) 버튼 추가
- ThemeColorEditor 우측에 색상 초기화 버튼(↺ 아이콘)을 배치하여, 클릭 시 기본 배경색인 #222222로 단번에 원상복구 되도록 UX를 개선함.

### 14. 에디터 이미지 크기/높이 커스텀 기능 추가
- CustomImage Tiptap 익스텐션에 width 및 height 속성을 추가하고 HTML 렌더링 시 인라인 스타일(style=" width: 300px\)이 포함되도록 수정하여 Tailwind CSS의 기본 height: auto를 덮어쓰도록 처리함.
- 이미지 클릭 시 뜨는 버블 탭(Bubble Menu)에 가로(Width) 및 세로(Height) 입력란을 신설하여, 유저가 숫자를 입력하면 즉시 크기가 반영되도록 연동함. (기존에 설정된 크기가 있으면 그대로 불러오고, 비어있으면 자동으로 처리됨).

### 15. 버튼 및 이미지 크기 조절 입력란 placeholder 고도화
- 버튼(Button)과 이미지(Image) 노드의 가로/세로 입력란이 기본적으로 자동 텍스트만 보여주던 것을 개선함.
- DOM에 렌더링된 실제 크기(clientWidth, clientHeight)를 동적으로 계산하여 입력란의 placeholder로 수치를 바로 보여주게 됨으로써, 유저가 현재 사이즈(예: 200, 350 등)를 직관적으로 파악하고 더 쉽게 크기를 변경할 수 있도록 편의성을 크게 개선함.

### 16. 추가 기능 개선 (분할 비율 및 이미지 링크)
- 다단 구성(ColumnBlock)에 4:6 및 6:4 비율을 새로 추가하여 더욱 다양한 레이아웃 설정이 가능해짐.
- CustomImage Tiptap 익스텐션에 href 속성을 추가하고 enderHTML 시에 해당 이미지를 앵커 태그(<a>)로 감싸도록 구조를 수정하여, 유저가 이미지 클릭 시 링크 팝업을 통해 이미지에 하이퍼링크를 부여할 수 있게 기능 추가됨.

### 17. 리액트 렌더링 충돌(flushSync) 오류 해결
- Tiptap의 selectionUpdate 이벤트 내부에서 동기적으로 React 상태(setState)를 업데이트할 때, React 18과 @tiptap/react의 FloatingMenu 내부 lushSync 호출이 충돌하여 발생하는 버그를 수정함.
- ImageSizeInputs의 DOM 크기 계산 및 상태 업데이트 로직을 setTimeout(..., 0)으로 감싸 렌더링 틱(tick)을 지연시킴으로써 충돌 에러가 발생하지 않도록 안정화함.

### 18. 이미지 링크 입력 UI 개선
- 상단 프롬프트 바 대신, 이미지 클릭 시 나타나는 버블 메뉴(Bubble Menu) 내부에 직접 URL을 입력할 수 있는 인라인 입력란(ImageLinkInput)을 추가하여 UX를 더욱 직관적으로 개선함.
- 링크 입력 후 포커스를 잃거나 Enter를 누르면 자동으로 https://가 누락된 경우 보정되어 이미지에 하이퍼링크가 즉시 적용되도록 연동함.
