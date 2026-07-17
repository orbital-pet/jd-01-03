# 09. 브라우저 API — 저장, 소리, 터치, 진동, 배려 🧰

> 브라우저는 생각보다 많은 것을 해줍니다. 이 문서는 이 게임이 쓰는
> 브라우저 내장 기능(Web API)을 하나씩 설명해요. 전부 라이브러리 없이
> 브라우저에 원래 들어 있는 기능들입니다.

---

## 1. localStorage — 새로고침해도 남는 저장소

**어디서**: `lib/storage.ts`, `components/best-score.tsx`

```ts
localStorage.setItem("sjs-best", "1230");   // 저장 (문자열만!)
localStorage.getItem("sjs-best");           // 읽기 → "1230" 또는 null
```

특징:

- 탭을 닫아도, 컴퓨터를 껐다 켜도 남습니다 (같은 사이트에서만 접근 가능).
- **문자열만** 저장됩니다. 그래서 `String(best)`로 넣고 `Number(...)`로 꺼내요.
- 용량은 사이트당 약 5MB. 최고 기록 하나엔 차고 넘칩니다.

### 주의사항 두 가지 (이 코드가 지키는 것)

**① 서버에는 없다** — Next.js가 서버에서 HTML을 만들 때 `localStorage`를
만지면 `localStorage is not defined` 에러로 죽습니다. 그래서 반드시
클라이언트 컴포넌트의 effect/이벤트/스냅샷 함수 안에서만 접근해요.

**② 실패할 수 있다** — 시크릿 모드나 보안 설정에 따라 접근 자체가
예외를 던질 수 있습니다. 그래서 `storage.ts`는 전부 `try...catch`로 감싸고,
실패하면 0을 돌려줍니다. **저장이 안 돼도 게임은 돌아가야 하니까요.**

### 덤: 다른 탭과의 동기화

`best-score.tsx`는 `storage` 이벤트를 구독합니다. 이 이벤트는
**다른 탭**이 localStorage를 바꿀 때 발생해요. 게임 탭에서 신기록을 세우면
첫 화면을 열어둔 탭의 기록도 자동으로 갱신됩니다.
([03 문서](./03-react-basics.md)의 `useSyncExternalStore` 절 참고)

---

## 2. Web Audio API — 오디오 파일 0개짜리 신시사이저

**어디서**: `lib/sound.ts`

mp3 하나 없이 소리를 **수학으로 직접 만들어** 냅니다. 부품은 딱 두 개:

```
OscillatorNode (발진기)  →  GainNode (볼륨)  →  destination (스피커)
"순수한 파형을 만든다"      "크기를 조절한다"      "출력"
```

```ts
const o = ac.createOscillator();
o.type = "triangle";                     // 파형: sine(부드러움) triangle(말랑) sawtooth(거침)
o.frequency.setValueAtTime(430, t0);     // 시작 주파수 430Hz
o.frequency.exponentialRampToValueAtTime(900, t0 + 0.09);  // 0.09초에 걸쳐 900Hz로
```

### 소리 디자인의 문법 🎵

| 효과음 | 설계 | 왜 그렇게 들리나 |
|---|---|---|
| 먹기 | 430→900Hz 상승, triangle | **올라가는 음 = 좋은 일** |
| 피격 | 220→65Hz 하강, sawtooth | **내려가는 음 + 거친 파형 = 나쁜 일** |
| 별 | 660→880→1320Hz 세 음 연쇄 | 아르페지오(분산화음) = 화려한 보상 |
| 게임오버 | 392→330→262→130Hz | 하강 음계 = 낙담 |

마리오의 코인 소리(상승)와 죽는 소리(하강)를 떠올려 보세요.
문화권을 타지 않는 인간의 보편 감각이라 그대로 써먹을 수 있습니다.

### 왜 exponential(지수) 램프인가

사람의 청각은 **로그 스케일**입니다. 볼륨을 직선으로 줄이면 "뚝" 끊기는
느낌이 나고, 지수 곡선으로 줄여야 자연스럽게 잦아들어요.
단, 지수 곡선은 수학적으로 0에 도달할 수 없어서 **목표값에 0을 넣으면
에러**가 납니다. 그래서 코드가 `0.0001`을 목표로 하는 거예요.

### ⚠️ 자동재생 정책 — 반드시 알아야 할 규칙

모든 모던 브라우저는 **사용자가 클릭/탭하기 전에는 소리를 막습니다**
(광고가 제멋대로 소리 지르는 것을 막으려고 도입됨).

- `AudioContext`는 만들어질 때 `"suspended"`(잠김) 상태일 수 있고,
- **사용자 제스처 이벤트 핸들러 안에서 `resume()`을 불러야만** 풀립니다.

그래서 `joops-game.tsx`의 `onDown`(탭 핸들러)이 `sound.ensure()`를
부릅니다. 게임 시작 탭이 곧 오디오 해금 탭인 거죠. 그리고 `blip`은
`ac.state !== "running"`이면 조용히 아무것도 안 합니다 —
**소리가 안 나도 게임이 죽으면 안 되니까요.**

---

## 3. 포인터 이벤트 — 마우스와 터치를 한 번에

**어디서**: `joops-game.tsx`, `doodle-sky.tsx`

옛날에는 마우스(`mousedown`)와 터치(`touchstart`)를 따로 처리했지만,
지금은 **Pointer Events**가 둘을 통합합니다:

```ts
canvas.addEventListener("pointerdown", onDown);   // 누름 (클릭이든 터치든)
canvas.addEventListener("pointermove", onMove);   // 움직임
```

이벤트 객체에서 쓰는 것들:

```ts
e.clientX, e.clientY      // 화면(뷰포트) 기준 좌표
e.pointerType             // "mouse" | "touch" | "pen" — 입력 종류 구분!
e.preventDefault()        // 브라우저의 기본 동작(스크롤 등) 막기
```

### 좌표 변환 — 화면 좌표를 캔버스 좌표로

```ts
const rect = canvas.getBoundingClientRect();   // 캔버스가 화면 어디에 있는지
const px = e.clientX - rect.left;              // 빼면 캔버스 기준 좌표!
```

### 손가락 보정 — 작지만 결정적인 디테일

```ts
const py = e.clientY - rect.top - (e.pointerType === "touch" ? 72 : 0);
```

터치일 때만 목표를 72px 위로 올립니다. **손가락이 주인공을 가리면
게임이 안 보이거든요.** 마우스 커서는 작으니 보정이 없고요.
`e.pointerType` 하나로 이런 배려가 가능합니다.

### `touch-action: none` — 캔버스 게임의 필수품

`<canvas className="... touch-none" />` (Tailwind의 `touch-none`).
이게 없으면 브라우저가 드래그를 "화면 스크롤"로 가져가 버려서
`pointermove`가 도중에 끊깁니다. 게임 조작이 뚝뚝 끊긴다면 1순위로
의심할 항목이에요.

---

## 4. 진동 — `navigator.vibrate`

**어디서**: `lib/sound.ts`의 `buzz`

```ts
navigator.vibrate?.(12);   // 12ms 진동 (지원 기기에서만)
```

먹으면 12ms, 맞으면 90ms. 아주 짧은 진동이지만 손맛이 확 달라집니다.
`?.`(옵셔널 체이닝) 덕분에 진동이 없는 기기(아이폰 사파리 등)에서도
에러 없이 조용히 넘어가요. **"있으면 좋고 없어도 그만"인 기능의 모범 처리.**

---

## 5. requestAnimationFrame과 performance.now

**어디서**: 게임 루프

```ts
raf = requestAnimationFrame(loop);   // "다음 화면 그릴 때 불러줘" 예약
cancelAnimationFrame(raf);           // 예약 취소 (정리할 때!)
```

- 콜백의 인자 `now`는 `performance.now()`와 같은 고정밀 시계(밀리초)입니다.
  프레임 간 시간(dt) 계산에 씁니다.
- 탭이 백그라운드로 가면 rAF는 자동으로 쉬어요. 다시 돌아왔을 때 dt가
  거대해지는 문제와 그 해결(클램프)은 [07 문서](./07-game-loop-and-math.md) 2절.

---

## 6. matchMedia — CSS 미디어 쿼리를 JS에서

**어디서**: `doodle-sky.tsx`

```ts
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  // 사용자가 OS에서 "움직임 줄이기"를 켜 둠
  // → 애니메이션 루프를 아예 돌리지 않고 정지 화면 한 장만 그림
}
```

`prefers-reduced-motion`은 움직임에 어지러움을 느끼는 사용자를 위한
OS 설정입니다. 이 게임은 두 곳에서 존중해요:

- CSS: `globals.css`에서 버튼 흔들기 애니메이션 끄기
- JS: `doodle-sky.tsx`에서 배경 애니메이션을 정지 낙서로 대체

### 관련: 접근성 속성들

```tsx
aria-hidden="true"    // 장식용 요소를 스크린 리더가 건너뛰게 (배경 캔버스, 색 점)
focus-visible:...     // 키보드 사용자를 위한 포커스 표시 (게임 시작 버튼)
```

---

## 7. 모바일 화면 다루기 — viewport와 safe-area

**어디서**: `app/play/page.tsx`, `game-ui.tsx`

### viewport 설정 (Next.js의 `export const viewport`)

```ts
export const viewport: Viewport = {
  width: "device-width",   // 기기 폭에 맞추기
  maximumScale: 1,
  userScalable: false,     // 핀치 줌 금지 — 게임 중 두 손가락 확대는 재앙!
  viewportFit: "cover",    // 노치 영역까지 화면 채우기
  themeColor: "#141838",   // 모바일 브라우저 상단 바 색 → 몰입감
};
```

### safe-area — 노치를 피해서

`viewportFit: "cover"`로 노치 영역까지 채우면, 이번엔 UI가 노치에
가려질 수 있습니다. 그래서 CSS 환경 변수로 안전 여백을 받아요:

```tsx
// game-ui.tsx의 Hud
style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
// "노치 높이 + 10px"만큼 아래에서 시작 → 점수판이 카메라에 안 가림
```

### 그 밖의 모바일 방어막들

| 코드 | 막는 것 |
|---|---|
| `select-none` (CSS) | 드래그하다 글자가 파랗게 선택되는 것 |
| `WebkitTouchCallout: "none"` | iOS 길게 누르면 뜨는 메뉴 |
| `onContextMenu={(e) => e.preventDefault()}` | 우클릭/길게 누르기 메뉴 |
| `overflow-hidden` + `fixed inset-0` | 화면 스크롤/바운스 |

게임이 폰에서 "제대로 되는" 것은 이런 방어막 예닐곱 개의 합입니다.
하나라도 빠지면 어딘가에서 조작이 어긋나요.

---

## 8. 요약표 — 기능별 파일 찾아가기

| 하고 싶은 것 | 보면 되는 파일 | 핵심 API |
|---|---|---|
| 값을 영구 저장 | `lib/storage.ts` | localStorage |
| 효과음 만들기 | `lib/sound.ts` | AudioContext, Oscillator, Gain |
| 진동 | `lib/sound.ts` | navigator.vibrate |
| 터치/마우스 입력 | `play/joops-game.tsx` | Pointer Events |
| 애니메이션 루프 | 〃 | requestAnimationFrame |
| 선명한 캔버스 | `lib/canvas.ts` | devicePixelRatio, setTransform |
| 움직임 줄이기 존중 | `components/doodle-sky.tsx` | matchMedia |
| 노치 대응 | `play/game-ui.tsx` | env(safe-area-inset-*) |
| 다른 탭과 동기화 | `components/best-score.tsx` | storage 이벤트 |
