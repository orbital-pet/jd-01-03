# 04. Next.js App Router — 파일이 곧 웹사이트 🗺️

> Next.js는 React로 "완성된 웹사이트"를 만들게 해주는 프레임워크입니다.
> 라우팅(주소), 서버 렌더링, 폰트/이미지 최적화 같은 궂은일을 대신 해줘요.
> 이 프로젝트는 **Next.js 16의 App Router** 방식을 씁니다.
>
> ⚠️ 이 프로젝트의 최상위 `AGENTS.md`에도 적혀 있듯, Next.js는 버전마다
> 규칙이 꽤 달라집니다. 인터넷의 옛날 튜토리얼(특히 `pages/` 폴더를 쓰는
> Pages Router 자료)과 헷갈리지 마세요. 정확한 문서가 궁금하면
> `node_modules/next/dist/docs/` 안에 이 버전의 공식 문서가 통째로 들어 있습니다.

---

## 1. 파일 규칙(File Convention) — 약속된 이름들

App Router의 핵심 아이디어: **정해진 이름의 파일을 정해진 위치에 두면,
Next.js가 알아서 연결해 준다.**

| 파일 이름 | 역할 | 이 프로젝트에서 |
|---|---|---|
| `page.tsx` | 그 폴더 주소의 **페이지** | `app/page.tsx`(/) , `app/play/page.tsx`(/play) |
| `layout.tsx` | 하위 페이지들을 감싸는 **공통 껍데기** | `app/layout.tsx` (전체 공통) |
| `globals.css` | (관례) 전역 스타일 | `app/globals.css` |
| `favicon.ico` | 브라우저 탭 아이콘 | `app/favicon.ico` |

주소 만들기는 폴더로:

```
app/page.tsx           →  /
app/play/page.tsx      →  /play
app/shop/list/page.tsx →  /shop/list   (예시 — 이 프로젝트엔 없음)
```

`joops-game.tsx`, `game-ui.tsx`, `components/`, `lib/` 처럼 약속된 이름이
아닌 파일은 주소가 되지 않습니다. 페이지들이 import해서 쓰는 부품일 뿐이에요.

### layout.tsx는 어떻게 동작하나

`app/layout.tsx`는 **루트 레이아웃**입니다. 모든 페이지가 이 컴포넌트의
`children` 자리에 끼워져요. `<html>`과 `<body>` 태그는 여기서만 씁니다.

```tsx
export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={...글꼴 변수들...}>
      <body>{children}</body>   {/* ← 여기에 각 페이지가 들어감 */}
    </html>
  );
}
```

사이트 전체에 적용할 것(글꼴, 전역 CSS, 기본 메타데이터)을 이곳에 모읍니다.
페이지를 이동해도 레이아웃은 다시 그려지지 않고 유지돼요.

---

## 2. 서버 컴포넌트 vs 클라이언트 컴포넌트 ⭐ 제일 중요

App Router의 컴포넌트는 **기본이 서버 컴포넌트**입니다.

| | 서버 컴포넌트 (기본) | 클라이언트 컴포넌트 |
|---|---|---|
| 실행 장소 | 서버 (빌드 때 또는 요청 때) | 브라우저 |
| 만드는 법 | 아무것도 안 붙임 | 파일 첫 줄에 `"use client"` |
| 할 수 있는 것 | 데이터 읽기, HTML 생성 | `useState`, `useEffect`, 이벤트, 브라우저 API |
| 할 수 없는 것 | 상태, 이벤트, `window` | (서버 비밀키 사용 등) |
| 보내는 JS 양 | **0** (HTML만 감) | 컴포넌트 코드가 브라우저로 감 |

**구분법은 간단합니다: 상호작용이 필요하면 클라이언트, 아니면 서버.**

이 프로젝트의 분류를 보세요:

```
서버 컴포넌트 (JS를 안 보내니 가볍다)
├── app/layout.tsx        — 껍데기만
├── app/page.tsx          — 정적인 소개 화면
└── app/play/page.tsx     — 메타데이터 + 게임을 올려놓기만

클라이언트 컴포넌트 ("use client" — 브라우저 기능이 필요하다)
├── app/play/joops-game.tsx    — 캔버스, 이벤트, 게임 루프
├── app/play/game-ui.tsx       — (게임에서 쓰는 UI 부품)
├── app/components/doodle-sky.tsx — 캔버스 애니메이션
└── app/components/best-score.tsx — localStorage 읽기
```

패턴이 보이나요? **"페이지 껍데기는 서버, 움직이는 속만 클라이언트."**
`app/page.tsx`(서버)가 `<DoodleSky />`(클라이언트)를 품는 것처럼,
서버 컴포넌트 안에 클라이언트 컴포넌트를 끼우는 건 자유입니다.
이렇게 하면 브라우저로 보내는 JS가 꼭 필요한 만큼으로 줄어요.

> `"use client"`는 파일 **첫 줄**에 문자열 그대로 씁니다. 그 파일과
> 거기서 import되는 모듈들이 "클라이언트 묶음"이 됩니다.

---

## 3. metadata와 viewport — `<head>`를 채우는 공식 창구

HTML의 `<head>`(탭 제목, 설명, 모바일 설정)를 직접 쓰는 대신,
서버 컴포넌트에서 **약속된 이름으로 export**하면 Next.js가 넣어줍니다.

```tsx
// app/play/page.tsx
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "SPACE JOOPS // 우주 냠냠",       // 탭 제목
  description: "손가락으로 우주쓰레기를...",  // 검색엔진/공유용 설명
};

export const viewport: Viewport = {
  width: "device-width",
  userScalable: false,   // 게임 중 핀치 줌 방지
  themeColor: "#141838", // 모바일 브라우저 상단 바 색
  // ...
};
```

⚠️ **Next.js 16 주의점**: 옛날 버전에서는 `metadata` 안에 `viewport`를
넣었지만, 지금은 **별도의 `viewport` export로 분리**되었습니다.
`metadata.viewport`에 넣으면 무시돼요. (구버전 튜토리얼 함정 1순위!)

우선순위: 레이아웃의 metadata가 기본값, 페이지의 metadata가 그걸 덮어씁니다.

---

## 4. `<Link>` — 새로고침 없는 페이지 이동

```tsx
import Link from "next/link";

<Link href="/play">게임 시작!</Link>
```

일반 `<a href>`는 페이지 전체를 새로 불러오지만, `<Link>`는
**필요한 부분만 갈아끼워서** 훨씬 빠르고 부드럽게 이동합니다.
게다가 링크가 화면에 보이면 다음 페이지를 **미리 내려받아(prefetch)** 둬요.
"게임 시작!"을 누르는 순간 이미 게임 코드가 도착해 있는 이유입니다.

내부 이동은 `<Link>`, 외부 사이트로 갈 때만 `<a>`를 쓰세요.

---

## 5. 폰트 — `next/font`와 직접 로드

### 방법 1: `next/font/google` (기본 추천)

```tsx
// layout.tsx
import { Geist } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",   // CSS 변수로 등록
  subsets: ["latin"],
});

<html className={geistSans.variable}>   // 변수 적용
```

`next/font`는 **빌드할 때 폰트 파일을 미리 내려받아 우리 서버에서 직접**
서빙합니다. 구글 서버에 요청을 안 보내니 빠르고 사생활도 보호되고,
폰트가 늦게 도착해서 글자가 덜컹 바뀌는 현상(레이아웃 시프트)도 없앱니다.

### 방법 2: `<link>`로 직접 (이 프로젝트의 예외 사례)

손글씨 폰트 "Gaegu"(개구쟁이체)는 **한글** 폰트인데, `next/font`는 이 폰트의
라틴 글자 묶음만 등록할 수 있어서 정작 한글이 빠집니다. 그래서 `layout.tsx`에서
구글 폰트 CSS를 `<link>`로 직접 불러요:

```tsx
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link rel="stylesheet" precedence="default"
      href="https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&display=swap" />
```

- React 19는 컴포넌트 안의 `<link>`를 자동으로 `<head>`로 올리고 중복도 제거합니다.
- `precedence`: React 19가 스타일시트 순서를 관리할 때 쓰는 속성.
- `preconnect`: "곧 이 서버에서 뭔가 받을 거야, 미리 악수해 둬" — 로딩 단축.

**교훈**: 도구의 기본 방법이 안 통하는 경우(한글 폰트)를 만나면,
왜 안 되는지 이해하고 표준 웹 기술로 돌아가면 됩니다.

---

## 6. 렌더링은 언제 일어나나 — 이 프로젝트는 "전부 정적"

`npm run build`의 출력을 보면:

```
Route (app)
┌ ○ /
├ ○ /_not-found
└ ○ /play

○  (Static)  prerendered as static content
```

`○ (Static)` = 두 페이지 모두 **빌드 시점에 HTML로 미리 구워졌다**는 뜻입니다.
서버는 요청이 오면 구워둔 HTML을 그냥 건네주기만 해요. 그래서 아주 빠릅니다.

게임의 움직임은? HTML이 도착한 뒤 브라우저에서 클라이언트 컴포넌트가
하이드레이션되며 시작됩니다. ([03 문서](./03-react-basics.md) 8절)

> 데이터베이스에서 매번 다른 내용을 읽어오는 페이지라면 동적 렌더링이
> 되지만, 이 프로젝트에는 아직 그런 페이지가 없습니다. 나중에 서버
> 데이터를 다루고 싶으면 `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md`를 읽어보세요.

---

## 7. 설정 파일들 훑어보기

| 파일 | 무엇 |
|---|---|
| `next.config.ts` | Next.js 동작 설정. 지금은 기본값 그대로 (비어 있음) |
| `tsconfig.json` | TypeScript 설정. Next.js가 관리하는 항목이 많으니 함부로 안 만져도 됨 |
| `postcss.config.mjs` | Tailwind CSS를 빌드에 연결 ([05 문서](./05-css-tailwind.md)) |
| `eslint.config.mjs` | 코드 검사 규칙. `eslint-config-next`가 Next.js 전용 실수를 잡아줌 |
| `package.json` | 의존성 목록과 `npm run ...` 명령어 정의 |

---

## 8. 자주 겪는 실수 모음

**"use client"를 빼먹음** → `useState`를 쓰는 순간
`You're importing a component that needs useState...` 에러.
파일 첫 줄에 `"use client"`를 추가하세요.

**서버 컴포넌트에서 `window`/`localStorage` 사용** →
`window is not defined` 에러. 브라우저 API는 클라이언트 컴포넌트의
`useEffect` 안(또는 이벤트 핸들러 안)에서만 만지세요.

**viewport를 metadata 안에 넣음** → 조용히 무시됨(에러도 안 남!).
`export const viewport`로 분리해야 합니다.

**`<a href="/play">` 사용** → 동작은 하지만 전체 새로고침이 일어나
느립니다. 내부 이동은 `<Link>`로.
