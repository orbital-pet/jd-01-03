# 03. React 기초 — 이 프로젝트에서 쓰는 만큼만, 제대로 ⚛️

> React는 "화면을 부품(컴포넌트)으로 조립하는 라이브러리"입니다.
> 이 문서는 React 교과서 전체가 아니라, **이 프로젝트에 실제로 나오는
> React 개념**을 실제 코드로 설명합니다. 이만큼만 알아도 이 코드는 다 읽혀요.

---

## 1. 컴포넌트 — 화면을 만드는 레고 블록

컴포넌트는 **"화면 조각을 돌려주는 함수"**입니다. 그게 전부예요.

```tsx
// components/best-score.tsx (단순화)
export default function BestScore() {
  return <p>최고 기록 ...</p>;   // ← HTML처럼 생긴 것을 반환
}
```

규칙 세 가지:

1. **이름은 대문자로 시작** (`BestScore`, `JoopsGame`). 소문자면 React가
   일반 HTML 태그로 오해합니다.
2. 사용할 때는 태그처럼: `<BestScore />`
3. 조각 하나(엘리먼트 하나)를 반환해야 합니다. 여러 개면 `<div>`로 감싸세요.

이 프로젝트의 컴포넌트 지도:

```
RootLayout (layout.tsx)
 ├─ Home (page.tsx)
 │   ├─ DoodleSky      ← 배경 캔버스
 │   └─ BestScore      ← 최고 기록 문구
 └─ Play (play/page.tsx)
     └─ JoopsGame      ← 게임 본체
         ├─ Hud            ← 점수판 (playing/over일 때)
         ├─ TitleScreen    ← 시작 화면 (title일 때)
         └─ GameOverScreen ← 결과 화면 (over일 때)
```

---

## 2. JSX — HTML처럼 생긴 JavaScript

`.tsx` 파일 안의 `<div>...</div>` 같은 문법을 JSX라고 합니다.
HTML과 거의 같지만 중요한 차이가 있어요:

| HTML | JSX | 이유 |
|---|---|---|
| `class="btn"` | `className="btn"` | `class`는 JS의 예약어라서 |
| `onclick="..."` | `onClick={함수}` | 문자열이 아니라 진짜 함수를 넘김 |
| `style="color:red"` | `style={{ color: "red" }}` | 객체로 전달 (중괄호 2겹!) |
| 주석 `<!-- -->` | `{/* 이렇게 */}` | JSX 안에서는 JS 주석을 중괄호로 |

**중괄호 `{}` = "여기부터 JavaScript"**. JSX의 핵심 문법입니다.

```tsx
// game-ui.tsx에서
<span className="text-[#ffd166]">{score}</span>     // 변수 값 끼워넣기
{best > 0 && <p>최고 기록 {best}점</p>}              // 조건부 그리기
{[0, 1, 2].map((i) => <span key={i}>♥</span>)}      // 목록 그리기
```

### `key` — 목록의 이름표

`map`으로 목록을 그릴 때는 각 항목에 `key`를 꼭 줘야 합니다.
React가 "지난번의 그 항목이 이번엔 어느 것인지"를 추적하는 이름표예요.
없으면 콘솔 경고가 뜨고, 목록이 바뀔 때 화면이 이상하게 재활용될 수 있습니다.

```tsx
{RULES.map((r) => <li key={r.text}>...</li>)}   // page.tsx
```

---

## 3. Props — 부모가 자식에게 주는 재료

컴포넌트 함수의 **매개변수**입니다. 부모가 태그의 속성으로 값을 내려보내요.

```tsx
// 부모 (joops-game.tsx)
<Hud score={ui.score} lives={ui.lives} />

// 자식 (game-ui.tsx) — 구조 분해로 받습니다
export function Hud({ score, lives }: { score: number; lives: number }) {
  return <div>점수 {score} ...</div>;
}
```

중요한 규칙: **props는 아래로만 흐릅니다** (부모 → 자식).
자식이 부모의 값을 직접 바꿀 수 없어요. 그래서 데이터가 어디서 와서
어디로 가는지 추적하기 쉬운 겁니다.

`Hud`, `TitleScreen`, `GameOverScreen`처럼 **props만 받아서 그리기만 하는**
컴포넌트를 "표현 컴포넌트"라고 부릅니다. 로직이 없으니 테스트도 이해도 쉽죠.

특별한 prop `children`: 태그 사이에 끼운 내용물이 통째로 전달됩니다.

```tsx
// layout.tsx — 모든 페이지가 children으로 끼워집니다
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}</body></html>;
}
```

---

## 4. `useState` — React가 기억하는 값

일반 지역 변수는 함수가 다시 실행되면 초기화됩니다. 렌더링 사이에도
살아남고, **바뀌면 화면을 다시 그리게 만드는** 값이 필요할 때 `useState`를 씁니다.

```tsx
// joops-game.tsx
const [ui, setUi] = useState({ phase: "title" as Phase, score: 0, lives: 3, best: 0, eaten: 0 });
//     ^현재 값  ^바꾸는 함수                ^처음 값
```

- 읽기: `ui.score`
- 바꾸기: `setUi({ ... })` — **직접 대입(`ui.score = 5`)은 절대 금지!**
  React는 `setUi`가 불릴 때만 "아, 다시 그려야겠구나"를 알 수 있어요.
- `setUi`를 부르면 컴포넌트 함수가 **처음부터 다시 실행**되고(리렌더),
  JSX의 달라진 부분만 실제 화면에 반영됩니다.

### 이 게임의 특별한 선택: state를 "하나만" 쓴다

게임 상태(쓰레기 위치, 주인공 좌표…)는 초당 60번 바뀝니다. 그걸 전부
`useState`에 넣으면 초당 60번 리렌더 — 폰이 견디지 못해요. 그래서:

- **자주 바뀌는 것** → `useEffect` 안의 평범한 지역 변수 + 캔버스에 직접 그림
- **가끔 바뀌는 것**(점수판에 보일 것들) → `ui` state 하나에 몰아넣고,
  실제로 바뀌는 순간에만 `pushUi()`로 갱신

이 구분이 이 프로젝트 아키텍처의 핵심입니다. ([01 문서](./01-project-tour.md) 4절)

---

## 5. `useRef` — 렌더링과 무관한 "이름표"

`useRef`는 `.current` 칸이 하나 있는 상자를 줍니다. 특징:

- 렌더링 사이에도 살아남는다 (state와 같음)
- **바뀌어도 화면을 다시 그리지 않는다** (state와 다름!)

이 프로젝트에서는 **DOM 요소를 붙잡는 용도**로 씁니다:

```tsx
const canvasRef = useRef<HTMLCanvasElement>(null);
// ...
<canvas ref={canvasRef} ... />
```

React가 `<canvas>`를 실제 화면에 만들고 나면 `canvasRef.current`에
그 DOM 요소를 넣어줍니다. 그래서 `useEffect` 안에서
`canvasRef.current.getContext("2d")`로 그림 도구를 꺼낼 수 있는 거예요.

> 순서가 중요합니다: 렌더링 "중"에는 아직 `canvasRef.current`가 없을 수
> 있어요(null). 그래서 캔버스를 만지는 코드는 전부 `useEffect` 안에 있습니다 —
> effect는 화면이 실제로 만들어진 "뒤에" 실행되거든요.

---

## 6. `useEffect` — "렌더링 바깥 세계"와 만나는 곳

컴포넌트 함수 본문은 "화면 조각 계산"만 해야 합니다. 그런데 우리는
이벤트 등록, 애니메이션 루프, 오디오 같은 **바깥 세계의 일**도 해야 하죠.
그런 일을 하는 공식 장소가 `useEffect`입니다.

```tsx
useEffect(() => {
  // ① 여기 코드는 화면이 실제로 만들어진 "직후"에 실행됩니다.
  const canvas = canvasRef.current;
  // ... 게임 초기화, 이벤트 등록, 루프 시작 ...

  return () => {
    // ② 여기(정리 함수)는 컴포넌트가 화면에서 "사라질 때" 실행됩니다.
    cancelAnimationFrame(raf);
    canvas.removeEventListener(...);
  };
}, []);   // ③ 의존성 배열
```

### 의존성 배열 `[]`의 의미

| 표기 | 실행 시점 |
|---|---|
| `useEffect(f)` | 매 렌더 후마다 (거의 안 씀) |
| `useEffect(f, [])` | **처음 등장할 때 딱 한 번** ← 이 게임 |
| `useEffect(f, [a, b])` | 처음 + `a`나 `b`가 바뀔 때마다 |

이 게임은 `[]`를 씁니다. 게임 세계는 한 번만 만들어지면 되니까요.

### 정리(cleanup) 함수 — 빼먹으면 유령이 생깁니다

`useEffect`에서 `return`한 함수는 컴포넌트가 사라질 때 호출됩니다.
등록한 것들을 여기서 **반드시** 해제하세요:

```tsx
// joops-game.tsx의 정리 함수
return () => {
  cancelAnimationFrame(raf);                          // 루프 멈추기
  window.removeEventListener("resize", resize);       // 리스너 떼기
  canvas.removeEventListener("pointerdown", onDown);
  canvas.removeEventListener("pointermove", onMove);
  sound.dispose();                                    // 오디오 닫기
};
```

정리를 안 하면? 게임 페이지를 떠나도 게임 루프가 유령처럼 계속 돌고,
이벤트 리스너가 쌓이고, 메모리가 샙니다. **"등록했으면 해제한다"**는
페어를 항상 맞추세요. (`doodle-sky.tsx`도 같은 패턴입니다.)

---

## 7. `useSyncExternalStore` — React 바깥의 데이터 구독하기

`best-score.tsx`에 나오는 조금 특별한 훅입니다.
"React가 관리하지 않는 외부 데이터(여기서는 localStorage)를 안전하게
읽고 구독하는" 공식 도구예요.

```tsx
const best = useSyncExternalStore(
  subscribe,   // ① 값이 바뀌면 알려달라고 신청하는 방법
  loadBest,    // ② 브라우저에서 지금 값을 읽는 방법
  serverBest,  // ③ 서버에서 HTML을 만들 때 쓸 임시 값 (0)
);
```

왜 필요할까요? 이 페이지의 HTML은 **서버에서 미리** 만들어지는데,
서버에는 localStorage가 없습니다. 그래서:

1. 서버는 ③의 값(0)으로 HTML을 만들어 보내고,
2. 브라우저가 이어받은 뒤(하이드레이션) ②로 진짜 값을 읽어 다시 그리고,
3. ①의 구독 덕분에 **다른 탭에서 기록이 갱신되면** 이 컴포넌트도 자동 갱신됩니다.

`useEffect` + `useState` 조합으로도 흉내 낼 수 있지만, 이 훅이 더 정확하고
코드도 짧습니다. "외부 저장소 구독"이 필요하면 이걸 기억하세요.

---

## 8. 하이드레이션(Hydration) — 서버 HTML에 생명 불어넣기

Next.js는 페이지를 이렇게 보여줍니다:

```
① 서버가 HTML을 미리 만들어 보냄        → 사용자는 즉시 내용을 봄 (빠름!)
② 브라우저가 JS를 내려받음
③ React가 HTML에 이벤트를 연결하고 이어받음   ← 이게 "하이드레이션"
④ 이제부터 버튼도 눌리고 게임도 돌아감
```

주의점 하나만 기억하세요: **①에서 만든 HTML과 ③에서 React가 기대하는
화면이 같아야 합니다.** 다르면 "hydration mismatch" 경고가 떠요.
`best-score.tsx`가 서버 스냅샷(0)을 따로 두는 것도,
게임이 `useEffect` 안에서만 브라우저 API를 만지는 것도 다 이 규칙 때문입니다.

---

## 9. 이 프로젝트에 나오는 React 요약표

| 도구 | 파일 | 한 줄 요약 |
|---|---|---|
| 함수 컴포넌트 | 전부 | 화면 조각을 돌려주는 함수 |
| props | `game-ui.tsx` | 부모 → 자식으로 내려보내는 재료 |
| `useState` | `joops-game.tsx` | 바뀌면 화면을 다시 그리는 값 |
| `useRef` | `joops-game.tsx`, `doodle-sky.tsx` | DOM을 붙잡는 이름표 |
| `useEffect` + cleanup | 〃 | 바깥 세계와 만나고, 떠날 때 정리 |
| `useSyncExternalStore` | `best-score.tsx` | 외부 저장소 구독 |
| 조건부 렌더 `&&` | `game-ui.tsx`, `joops-game.tsx` | 조건에 따라 그리거나 말거나 |
| 목록 렌더 `map` + `key` | `page.tsx`, `game-ui.tsx` | 배열 → 화면 목록 |

> 다음 문서 [04. Next.js App Router](./04-nextjs-app-router.md)에서
> "이 컴포넌트들이 어떻게 페이지가 되는지"를 알아봅니다.
