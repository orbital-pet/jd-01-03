# 05. CSS & Tailwind — `className`이라는 암호 해독하기 🎨

> 이 프로젝트의 화면 꾸미기는 두 가지로 이루어집니다:
> ① **Tailwind CSS** — `className`에 유틸리티 클래스를 나열하는 방식 (대부분)
> ② **globals.css** — 직접 쓴 소량의 전역 CSS (손그림 상자, 흔들기 애니메이션)

---

## 1. CSS 30초 복습

CSS는 "어떤 요소를(선택자) 어떻게 보이게 할지(속성)"를 정하는 언어입니다.

```css
.doodle-box {                 /* class가 doodle-box인 요소를 */
  border-radius: 255px ...;   /* 이렇게 꾸며라 */
}
```

전통적으로는 CSS 파일에 클래스를 정의하고 HTML에서 갖다 썼는데,
클래스 이름 짓기와 파일 왕복이 은근히 피곤합니다. 그래서 등장한 것이…

---

## 2. Tailwind CSS — 이미 만들어진 초소형 클래스 조립하기

Tailwind는 **아주 작은 일 하나만 하는 클래스**를 잔뜩 제공합니다.
스타일을 CSS 파일이 아니라 `className`에서 직접 조립해요.

```tsx
<div className="flex items-center gap-2 px-5 py-3 text-base text-zinc-500">
```

해독하면:

| 클래스 | 뜻하는 CSS |
|---|---|
| `flex` | `display: flex` (가로 배치 시작) |
| `items-center` | 세로 방향 가운데 정렬 |
| `gap-2` | 자식들 사이 간격 0.5rem (8px) |
| `px-5` | 좌우(padding-x) 1.25rem |
| `py-3` | 상하(padding-y) 0.75rem |
| `text-base` | 글자 크기 1rem |
| `text-zinc-500` | 글자색 회색 계열 500 단계 |

처음엔 암호 같지만 규칙만 알면 금방 읽힙니다. 숫자는 대부분
**4 = 1rem = 16px** 기준 배율이에요 (`p-4` = 16px, `p-2` = 8px).

> 📖 클래스 이름이 궁금할 때: https://tailwindcss.com/docs 에서 검색하면
> 1초 만에 나옵니다. 외우지 말고 검색하세요. 다들 그렇게 씁니다.

### 이 프로젝트에 자주 나오는 클래스 사전

**레이아웃(배치)**

| 클래스 | 뜻 |
|---|---|
| `flex` / `flex-col` | 가로 / 세로 방향 flex 배치 |
| `flex-1` | 남는 공간을 차지해 늘어남 |
| `items-center` / `justify-center` | 교차축 / 주축 가운데 정렬 |
| `justify-between` | 양 끝으로 밀어 배치 (header의 좌우 텍스트) |
| `gap-3` / `gap-x-4` | 자식 간 간격 (전체/가로만) |
| `mx-auto` | 좌우 여백 자동 = 가운데 정렬 |
| `max-w-md` | 최대 폭 28rem (모바일 카드 폭) |

**위치 잡기 (겹치기)**

| 클래스 | 뜻 |
|---|---|
| `relative` | 자식 absolute의 기준점이 됨 |
| `absolute inset-0` | 부모에 딱 붙여 꽉 채움 (top/right/bottom/left: 0) |
| `fixed inset-0` | 화면 전체에 고정 (게임 화면!) |
| `inset-x-0 top-0` | 좌우 꽉, 위에 붙임 (점수판) |
| `z-10` | 쌓임 순서 (클수록 위) — 글자가 캔버스 위에 뜨는 이유 |

**꾸미기**

| 클래스 | 뜻 |
|---|---|
| `bg-[#141838]` | 배경색. **대괄호 = 임의 값** 문법! 아무 색이나 직접 지정 |
| `text-[#7ee8b2]` | 글자색 직접 지정 |
| `bg-[#7ee8b2]/15` | 색 뒤의 `/15` = 불투명도 15% |
| `border-[3px]` | 테두리 두께 3px |
| `rounded-full` | 완전히 둥글게 (원/알약) |
| `font-bold` | 굵은 글씨 |
| `text-6xl` | 아주 큰 글자 (3.75rem) |
| `leading-none` / `leading-8` | 줄 간격 |
| `underline underline-offset-4` | 밑줄 + 밑줄 간격 |

**반응형 & 상태**

| 클래스 | 뜻 |
|---|---|
| `hidden sm:inline` | 평소 숨김, 화면폭 640px 이상에서만 표시 |
| `sm:text-7xl` | 640px 이상에서 글자 더 크게 |
| `hover:scale-105` | 마우스 올리면 5% 확대 |
| `active:scale-95` | 누르는 동안 5% 축소 (눌리는 손맛!) |
| `focus-visible:outline-2 ...` | 키보드 포커스 시 외곽선 (접근성) |

**게임 특화 (중요!)**

| 클래스 | 뜻 | 왜 필요한가 |
|---|---|---|
| `touch-none` | `touch-action: none` | **이게 없으면 브라우저가 드래그를 스크롤로 가로채서 게임 조작이 끊깁니다.** 캔버스 게임의 필수품 |
| `select-none` | 글자 드래그 선택 금지 | 게임 중 파란 선택 박스 방지 |
| `pointer-events-none` | 클릭/터치를 통과시킴 | 글자층이 게임 입력을 안 막게 |
| `pointer-events-auto` | 다시 클릭 가능하게 | 글자층 안의 링크만 예외로 |
| `overflow-hidden` | 넘치는 내용 자르기 | 스크롤바 방지 |
| `animate-bounce` | 통통 튀는 내장 애니메이션 | "👆 탭해서 시작!" |
| `-rotate-2` / `rotate-1` | 살짝 회전 | 손글씨 낙서 느낌의 비법 ✨ |

### 기울인 글자 이야기

이 프로젝트 곳곳의 `-rotate-3`, `rotate-1`, `-rotate-2`…
제목과 문구가 전부 미묘하게 삐딱합니다. 완벽하게 수평인 글자는 "인쇄물"
느낌이지만, 1~3도 기울면 "손으로 쓴 것" 느낌이 나거든요. 각도를 제각각
주는 것까지가 디자인입니다. (전부 같은 각도면 그냥 기울어진 인쇄물이 돼요.)

---

## 3. Tailwind v4의 설정 방식 — globals.css 읽기

Tailwind 4는 설정을 JS 파일이 아니라 **CSS 안에서** 합니다.
`app/globals.css`를 뜯어보죠.

```css
@import "tailwindcss";          /* ① Tailwind 전체 불러오기 (v4는 이 한 줄!) */

:root {                         /* ② 우리만의 CSS 변수 정의 */
  --background: #141838;
  --foreground: #e8ecf7;
}

@theme inline {                 /* ③ 그 변수를 Tailwind에 등록 */
  --color-background: var(--background);   /* → bg-background 클래스 생성 */
  --font-doodle: "Gaegu", ...;
}

body {                          /* ④ 평범한 전역 CSS */
  background: var(--background);
  font-family: var(--font-doodle);   /* 사이트 전체가 손글씨 글꼴 */
}
```

- **CSS 변수** (`--이름`): 값에 이름을 붙여 재사용. `var(--이름)`으로 꺼냅니다.
- **`@theme`**: Tailwind 4의 신문법. 여기 등록한 변수는 Tailwind 클래스가 됩니다.
- 구버전 Tailwind(v3)의 `tailwind.config.js`는 이 프로젝트에 **없습니다.**
  v3 자료를 보고 그 파일을 찾지 마세요!

---

## 4. 직접 쓴 CSS 두 가지 — 이 프로젝트의 시그니처

### ① 손으로 그린 상자 `.doodle-box`

```css
.doodle-box {
  border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
}
```

`border-radius`에 슬래시(`/`)를 쓰면 **가로 반지름들 / 세로 반지름들**을
따로 정할 수 있습니다. 네 모서리를 전부 제각각의 큰/작은 값으로 뒤섞으면
모서리가 비대칭으로 휘어서 **펜으로 슥 그린 상자**처럼 보여요.
속성 하나로 손그림을 만드는 유명한 CSS 트릭입니다. "게임 시작!" 버튼이 이거예요.

### ② 갸우뚱갸우뚱 `.animate-wiggle`

```css
@keyframes doodle-wiggle {          /* 애니메이션의 "장면표" */
  0%, 100% { transform: rotate(-1.6deg); }   /* 처음과 끝: 왼쪽으로 */
  50%      { transform: rotate(1.6deg); }    /* 중간: 오른쪽으로 */
}
.animate-wiggle {
  animation: doodle-wiggle 2.4s ease-in-out infinite;
  /*         이름           한바퀴  가감속       무한반복 */
}
```

`@keyframes`는 "몇 % 시점에 어떤 모습일지"를 정하는 장면표입니다.
브라우저가 그 사이를 부드럽게 보간해 줘요.

### ③ 접근성 배려 — 움직임 줄이기

```css
@media (prefers-reduced-motion: reduce) {
  .animate-wiggle { animation: none; }
}
```

OS 설정에서 "움직임 줄이기"를 켠 사용자(움직임에 어지러움을 느끼는 분들)에게는
흔들림을 끕니다. `doodle-sky.tsx`도 같은 설정을 JS로 읽어서
(`window.matchMedia`) 배경 애니메이션 전체를 정지 화면으로 바꿔요.
**멋과 배려는 공존할 수 있습니다.** 여러분의 프로젝트에도 꼭 넣으세요.

---

## 5. inline style은 언제 쓰나

Tailwind로 다 하는 게 원칙이지만, 이 프로젝트에서 `style={{...}}`을 쓴 곳이 있어요:

```tsx
style={{ textShadow: "0 2px 10px rgba(10,12,30,0.95)" }}   // 글자 그림자
style={{ background: r.color }}                             // 데이터에서 온 색
style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}  // 노치 회피
```

기준: **값이 데이터에서 오거나(규칙 색), Tailwind에 마땅한 클래스가 없을 때**
inline style을 씁니다. 그 외에는 className이 우선이에요.

> `env(safe-area-inset-top)`은 아이폰 노치(카메라 영역)의 높이를 알려주는
> CSS 환경 변수입니다. 점수판이 노치에 가려지지 않는 이유. ([09 문서](./09-web-apis.md))
