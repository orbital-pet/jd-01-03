# 02. JavaScript & TypeScript 문법 사전 📖

> 이 프로젝트의 코드에 실제로 나오는 문법을 **전부** 모았습니다.
> 처음부터 끝까지 읽어도 좋고, 코드를 읽다가 모르는 기호가 나올 때
> 사전처럼 찾아봐도 좋아요. 예제는 모두 이 프로젝트의 실제 코드입니다.

---

## 1. 변수 선언: `const`와 `let`

```ts
const SPACE_BG = "#141838";  // 다시 대입할 수 없음 (상수)
let score = 0;               // 다시 대입할 수 있음 (변수)
score += 10;                 // OK
// SPACE_BG = "#000";        // ❌ 에러!
```

- **기본은 `const`.** 대입을 다시 해야 할 때만 `let`을 쓰세요.
  "이 값은 안 바뀌어요"라는 정보 자체가 코드를 읽기 쉽게 만듭니다.
- 옛날 책에 나오는 `var`는 쓰지 않습니다. (스코프 규칙이 함정투성이라서요.)

⚠️ 헷갈리는 포인트: `const`는 "재대입 금지"지 "냉동 보관"이 아닙니다.

```ts
const player = { x: 0, y: 0 };
player.x = 100;   // ✅ OK! 객체의 속성은 바꿀 수 있어요
// player = {};   // ❌ 이것만 안 됨 (다른 객체로 통째로 교체)
```

이 게임의 `player`가 `const`인데도 매 프레임 움직일 수 있는 이유입니다.

---

## 2. 화살표 함수 `=>`

함수를 짧게 쓰는 문법입니다. 이 프로젝트에서 가장 많이 나오는 기호예요.

```ts
// 전통적인 함수 선언
function loadBest(): number {
  return Number(localStorage.getItem(BEST_KEY)) || 0;
}

// 화살표 함수 — 같은 일을 하는 다른 표기
const loadBest = (): number => {
  return Number(localStorage.getItem(BEST_KEY)) || 0;
};

// 본문이 "값 하나를 돌려주는 식" 하나뿐이면 중괄호와 return 생략 가능
const serverBest = () => 0;                    // "부르면 0을 주는 함수"
const buzz = (ms: number) => navigator.vibrate?.(ms);
```

읽는 법: `(재료들) => 결과`. "재료를 받아 결과를 내놓는다"로 읽으세요.

실전 예 — `constants.ts`:

```ts
export const pickEdible = (): JunkKind =>
  EDIBLE_KINDS[Math.floor(Math.random() * EDIBLE_KINDS.length)];
```

⚠️ 함정 하나: `=>` 뒤에서 **객체**를 바로 돌려주려면 괄호로 감싸야 합니다.
중괄호가 "함수 본문"으로 해석되기 때문이에요.

```ts
const makePoint = (x, y) => ({ x, y });   // 괄호 필수!
```

`effects.ts`의 `makePopup`이 정확히 이 모양입니다.

---

## 3. 객체(Object) — 이 게임의 모든 "것"

관련된 값들을 한 꾸러미로 묶는 자료형. 이 게임의 주인공도, 쓰레기도,
별도 전부 객체입니다.

```ts
// joops-game.tsx — 주인공
const player = {
  x: 0,            // "x라는 이름의 칸에 0이 들어 있다"
  y: 0,
  r: 24,
  look: { x: 0, y: 1 },   // 객체 안에 객체도 OK
};

player.x            // 읽기: 점(.)으로 접근
player.x = 100;     // 쓰기
player.look.y       // 중첩된 것도 점을 이어서
```

### 속성 이름 = 변수 이름이면 줄여 쓸 수 있어요 (단축 속성)

```ts
const x = 10, y = 20;
const p = { x, y };        // { x: x, y: y } 와 완전히 같음
```

`debris.ts`의 `makeDebris`가 `{ kind, x0, ... }`처럼 반환하는 게 이 문법입니다.

### 구조 분해(destructuring) — 꾸러미 풀기

```ts
// mascot.ts
const { x, y, r, t } = p;   // p.x를 x로, p.y를 y로... 한 번에 꺼냄

// 배열도 됩니다
const [x1, y1] = pts[i];    // pts[i]가 [3, 5]라면 x1=3, y1=5

// 함수 반환값을 기존 변수에 받을 때는 괄호로 감쌉니다 (joops-game.tsx의 resize)
({ w, h } = fitCanvas(canvas, ctx));
// 괄호가 없으면 { 가 "코드 블록의 시작"으로 오해받아 문법 오류가 나요.
```

---

## 4. 배열(Array)과 단골 메서드

```ts
let junks: Debris[] = [];        // Debris 객체들이 들어가는 배열
junks.push(makeDebris(...));     // 끝에 추가
junks.splice(i, 1);              // i번째부터 1개 삭제
junks.length                     // 개수
```

### `map` — 배열의 각 요소를 다른 것으로 변환

React에서 "목록 그리기"의 표준 도구입니다.

```tsx
// page.tsx — 규칙 데이터를 <li> 목록으로 변환
{RULES.map((r) => (
  <li key={r.text}> ... {r.text} ... </li>
))}

// game-ui.tsx — 숫자 3개를 하트 3개로
{[0, 1, 2].map((i) => (
  <span key={i} className={i < lives ? "text-[#ff8fab]" : "text-white/20"}>♥</span>
))}
```

### `Array.from({ length: n }, 함수)` — n개짜리 배열 만들기

```ts
// backdrop.ts — 별 n개 만들기
Array.from({ length: n }, () => ({ x: Math.random() * w, ... }))

// doodle.ts — 정n각형 꼭짓점. 두 번째 인수 함수는 (요소, 인덱스)를 받아요
Array.from({ length: n }, (_, i) => { ... });
// `_`는 "이 인수는 안 쓸 거야"라는 관례적 이름입니다.
```

### `for...of` — 요소를 하나씩

```ts
for (const j of junks) drawDebris(ctx, d, j, t);   // 각 쓰레기를 그린다
for (const dir of [-1, 1] as const) { ... }        // 왼쪽(-1), 오른쪽(+1) 두 번 반복
```

`[-1, 1]` 루프는 이 코드의 애용 패턴이에요. 눈 2개, 볼터치 2개, 태양전지판 2개…
**좌우 대칭인 것은 복붙 대신 루프로** 그립니다.

### 역순 for 루프 — 삭제하면서 돌 때의 철칙

```ts
// effects.ts, joops-game.tsx
for (let i = junks.length - 1; i >= 0; i--) {
  if (조건) junks.splice(i, 1);   // 삭제!
}
```

**왜 뒤에서부터?** 앞에서부터 돌면서 `splice`로 삭제하면 뒤의 요소들이
한 칸씩 당겨져서, 다음 요소를 건너뛰는 버그가 생깁니다:

```
junks = [A, B, C, D]
i=0: A 삭제 → [B, C, D]  (B가 0번으로 당겨짐)
i=1: junks[1]은 C.  ← B를 건너뛰었다!! 🐛
```

뒤에서부터 돌면 삭제해도 "아직 검사 안 한 앞쪽"의 번호는 그대로라 안전합니다.

---

## 5. 조건과 논리 연산자

### 삼항 연산자 `조건 ? A : B`

```ts
// debris.ts — 종류에 따라 크기 결정 (중첩도 가능)
const size = kind === "star" ? 15
           : kind === "hazard" ? 16 + Math.random() * 8
           : 13 + Math.random() * 6;
```

읽는 법: "star면 15, 아니고 hazard면 16~24, 그도 아니면 13~19."

### `&&` — "왼쪽이 참일 때만 오른쪽"

```tsx
// game-ui.tsx — 기록이 있을 때만 표시
{best > 0 && <p>최고 기록 {best}점</p>}
```

JSX에서 "조건부로 그리기"의 표준 문법입니다. `best > 0`이 거짓이면
전체가 거짓이 되어 React가 아무것도 안 그려요.

### `||` — "왼쪽이 가짜값이면 오른쪽으로 대체"

```ts
Number(localStorage.getItem(BEST_KEY)) || 0   // 숫자 변환 실패(NaN)하면 0
const dd = Math.hypot(dx, dy) || 1;           // 거리가 0이면 1 (0으로 나누기 방지!)
```

### `??` — "왼쪽이 null/undefined일 때만 오른쪽"

```ts
// doodle-sky.tsx — 먹이가 없으면(null) 가시라도 쳐다봄
const gaze = prey ?? spike;
```

`||`와의 차이: `||`는 `0`, `""`, `false`도 "가짜"로 취급해 대체하지만,
`??`는 오직 `null`과 `undefined`만 대체합니다. **숫자 0이 정상 값인 곳에서
`||`를 쓰면 버그**가 되니 이 구분은 꼭 알아두세요.

### `?.` — "있으면 불러줘" (옵셔널 체이닝)

```ts
// sound.ts — vibrate 기능이 없는 브라우저(아이폰 등)에서도 에러 없음
navigator.vibrate?.(ms);
```

`vibrate`가 `undefined`면 호출하지 않고 조용히 넘어갑니다.

---

## 6. 클로저(Closure) — 이 게임이 동작하는 원리

**함수는 자기가 태어난 곳의 변수를 기억합니다.** 이게 클로저입니다.

```ts
function createSound() {
  let ac: AudioContext | null = null;   // ← 이 변수는

  const ensure = () => {
    if (!ac) ac = new AudioContext();   // ← 이 함수가 기억하고
  };
  const blip = (...) => {
    if (!ac) return;                    // ← 이 함수도 기억한다
    ...
  };
  return { ensure, blip, ... };
}
```

`createSound()`가 반환된 뒤에도 `ensure`와 `blip`은 **같은 `ac`를 계속
공유합니다.** 바깥에서는 `ac`를 볼 수도 만질 수도 없어요. 마치 자기들만의
비밀 금고를 가진 것처럼요.

이 프로젝트에서 클로저가 활약하는 곳:

| 어디 | 무엇을 가둬두나 |
|---|---|
| `joops-game.tsx`의 `useEffect` | 게임 상태 전부 (`score`, `junks`, `player`…) |
| `lib/sound.ts`의 `createSound` | AudioContext (`ac`) |
| `lib/doodle.ts`의 `createDoodle` | 흔들림 위상 (`phase`) |

특히 게임 본체가 핵심입니다: `useEffect(() => {...}, [])`의 콜백은 딱 한 번
실행되고, 그 안에서 정의된 `update`, `draw`, `loop` 함수들이 지역 변수
`score`, `junks` 등을 클로저로 공유하며 게임이 끝날 때까지 읽고 씁니다.
**클래스 없이도 "상태 + 그 상태를 다루는 함수들"의 묶음**이 만들어지는 거예요.

---

## 7. 모듈: `import`와 `export`

파일 하나가 모듈 하나입니다. 다른 파일에 내보내려면 `export`,
가져오려면 `import`.

```ts
// lib/constants.ts — 내보내기
export const SPACE_BG = "#141838";
export type JunkKind = "satellite" | ...;

// lib/debris.ts — 가져오기 (중괄호 = "이름을 골라서" 가져오기)
import { JUNK_COLORS, type JunkKind } from "./constants";
//                    ^^^^ 타입만 가져올 때는 type을 붙입니다 (빌드 시 지워짐)

// 기본(default) 내보내기 — 파일당 하나, 중괄호 없이 가져옵니다
export default function JoopsGame() { ... }
import JoopsGame from "./joops-game";       // 이름도 마음대로 지을 수 있음
```

경로 규칙: `./`는 같은 폴더, `../`는 한 폴더 위. `"next/link"`처럼
경로가 아닌 이름은 `node_modules`에서 찾습니다.

> Next.js 규칙: 페이지/레이아웃/컴포넌트는 `export default`로 내보내는 게 관례입니다.

---

## 8. TypeScript — JS에 "타입"이라는 안전벨트 달기

TypeScript는 JavaScript에 **"이 변수엔 어떤 종류의 값이 들어가는지"**를
표시하는 언어입니다. 브라우저에서 실행되기 전에 타입 표시는 전부 지워져요.
즉, **실행을 바꾸지 않고 실수만 잡아주는** 안전장치입니다.

### 기본 표기

```ts
let score: number = 0;              // 숫자만
const word: string = "냠!";         // 문자열만
let over: boolean = false;          // 참/거짓만
let junks: Debris[] = [];           // Debris들의 배열
function buzz(ms: number): void {}  // void = 반환값 없음
//          ^^^^^^^^^^ 매개변수 타입   ^^^^ 반환 타입
```

### `type` — 나만의 타입 이름 짓기

```ts
// debris.ts — 객체의 "설계도"
export type Debris = {
  kind: JunkKind;
  x0: number;
  x: number;
  // ...
  eatT: number;
};
```

이제 `Debris`라고 쓰면 "이 모양의 객체"라는 뜻이 됩니다. 필드를 빼먹거나
오타를 내면 에디터가 즉시 빨간 줄을 그어줘요.

### 유니온 타입 `|` — "이것들 중 하나"

```ts
// game-ui.tsx
export type Phase = "title" | "playing" | "over";

let phase: Phase = "title";
phase = "playing";   // ✅
phase = "paused";    // ❌ 컴파일 에러! 오타·실수를 실행 전에 잡아줌
```

문자열 몇 개로 상태를 표현할 때 최고의 도구입니다. `JunkKind`도 같은 방식이에요.

### 튜플 — 길이와 순서가 정해진 배열

```ts
// doodle.ts
export type Pt = [number, number];   // 정확히 숫자 2개짜리 배열 = 점(x, y)
```

### `Record<K, V>` — "K마다 V가 하나씩 있는 사전"

```ts
// constants.ts
export const JUNK_COLORS: Record<JunkKind, string> = {
  satellite: "#8ecbff", bolt: "#cfd8e6", can: "#f9a8d4",
  spring: "#c4b5fd", star: "#ffd166", hazard: "#ff8080",
};
```

6가지 종류 중 하나라도 색을 빼먹으면 컴파일 에러. 나중에 `JunkKind`에
새 종류를 추가하면 "여기 색도 정해!"라고 자동으로 알려줍니다. 👍

### `as const` — "이건 절대 안 변하는 리터럴이야"

```ts
export const EDIBLE_KINDS = ["satellite", "bolt", "can", "spring"] as const;
```

이게 없으면 타입이 그냥 `string[]`(아무 문자열 배열)이 되지만,
붙이면 "정확히 이 네 단어가 이 순서로 있는 읽기 전용 배열"이 됩니다.
그래서 `pickEdible`의 반환 타입이 자동으로 `JunkKind`로 좁혀져요.

`for (const dir of [-1, 1] as const)`도 같은 원리 — `dir`의 타입이
`number`가 아니라 `-1 | 1`이 됩니다.

### `ReturnType<typeof f>` — "저 함수가 돌려주는 것의 타입"

```ts
// doodle.ts
export type Doodle = ReturnType<typeof createDoodle>;
```

`createDoodle`이 돌려주는 도구 상자의 타입을 **자동으로 추적**합니다.
함수에 도구를 추가하면 `Doodle` 타입도 저절로 따라 바뀌어요.
타입을 두 번 쓰지 않기 위한 요령입니다.

### `null`과 그 방어

```ts
let ac: AudioContext | null = null;    // "AudioContext거나, 아직 없거나"
const canvas = canvasRef.current;      // 타입: HTMLCanvasElement | null
if (!canvas) return;                   // null이면 여기서 끝
// 이 줄부터 TypeScript는 canvas가 null이 아님을 "알고" 있습니다 (타입 좁히기)
```

---

## 9. 자주 쓰는 내장 함수들 (Math, 시간)

| 함수 | 뜻 | 이 게임에서의 예 |
|---|---|---|
| `Math.random()` | 0 이상 1 미만 난수 | 스폰 위치, 종류 뽑기 |
| `Math.floor(x)` | 소수점 버림 | 랜덤 인덱스, 깜빡임 박자 |
| `Math.min(a, b)` / `Math.max(a, b)` | 작은/큰 쪽 | 상한·하한 만들기 |
| `Math.hypot(a, b)` | √(a²+b²) | **두 점 사이 거리** (충돌 판정!) |
| `Math.sin(x)` / `Math.cos(x)` | 삼각함수 | 흔들림, 원 그리기 ([07 문서](./07-game-loop-and-math.md)) |
| `Math.PI` | 원주율 π | 각도 (2π = 360도) |
| `performance.now()` | 페이지 로드 후 흐른 밀리초 | dt 계산 |

**clamp(가두기) 관용구** — 이 코드에 여러 번 나옵니다:

```ts
Math.min(Math.max(값, 최솟값), 최댓값)   // 값을 [최솟값, 최댓값] 사이로 강제
// 예: 주인공이 화면 밖으로 못 나가게
player.tx = Math.min(Math.max(px, player.r + 6), w - player.r - 6);
```

**랜덤 범위 관용구**:

```ts
40 + Math.random() * 120    // 40 이상 160 미만의 랜덤 수
                            // 공식: 최소 + Math.random() * (최대 - 최소)
```

---

## 10. `try...catch` — 실패해도 무너지지 않기

```ts
// storage.ts
export function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;    // localStorage가 막혀 있으면(시크릿 모드 등) 그냥 0
  }
}
```

`try` 블록에서 에러가 나면 프로그램이 죽는 대신 `catch`로 점프합니다.
이 프로젝트의 원칙: **부가 기능(저장, 소리, 진동)은 실패해도 게임이
계속되도록** 전부 try-catch나 조용한 return으로 감쌉니다.

---

## 11. 템플릿 리터럴 — 백틱(`) 문자열

```ts
ctx.font = `700 ${p.size}px ${DOODLE_FONT}`;
// p.size가 24라면 → "700 24px \"Gaegu\", ..." 로 조립됨
```

백틱 문자열 안의 `${식}` 자리에 값이 끼워집니다. 문자열 덧셈(`"a" + b + "c"`)보다
훨씬 읽기 좋아요. `layout.tsx`의 `className` 조립에도 쓰입니다.

---

## 12. 기타 등장 문법 모음

```ts
// % (나머지): 순환 인덱스 만들기 — 마지막 다음은 처음으로!
pts[(i + 1) % n]

// % 2 === 0: 짝수 판정 → 깜빡임 (초당 16번 중 절반은 켜고 절반은 끄고)
Math.floor(t * 16) % 2 === 0

// ++, --: 1 더하기/빼기
eaten++;  lives--;

// +=, -=, *=: 복합 대입
j.y += j.vy * dt;      // j.y = j.y + (j.vy * dt) 와 같음

// void 연산자: "이 Promise의 결과는 기다리지 않을게" 표시 (경고 억제)
void ac.resume();

// Number(), String(): 형 변환
Number("42")      // 42
String(42)        // "42" — localStorage에 넣을 때 필요
```
