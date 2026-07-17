# 10. 실습 과제와 디버깅 가이드 — 이제 여러분 차례 🛠️

> 읽기만 한 지식은 일주일이면 증발합니다. 이 문서의 과제를 하나라도
> 직접 해보세요. `npm run dev`를 켜 두면 저장할 때마다 바로 반영되니,
> 부담 없이 부수고 고치면서 놀면 됩니다. (망가지면 `git checkout -- 파일명`!)

---

## 1. 준비운동: 튜닝판 가지고 놀기 (5분)

`app/play/joops-game.tsx` 맨 위의 `TUNE` 객체가 여러분의 실험실입니다:

| 바꿀 것 | 이렇게 해보세요 | 관찰 포인트 |
|---|---|---|
| `followSpeed: 7` | 2로, 그리고 30으로 | 조작감이 게임의 인상을 통째로 바꿈 |
| `magnetRange: 70` | 0으로, 그리고 200으로 | 0이면 감질나고, 200이면 진공청소기 |
| `invulTime: 1.4` | 0으로 | 가시 하나에 하트가 증발하는 걸 직접 목격 |
| `growPerEat: 0.45` | 3으로 | 몸이 커지는 게 왜 "리스크"인지 체감 |
| `starScore: 40` | 500으로 | 밸런스가 왜 중요한지 체감 |

다른 파일의 놀이터:

- `lib/constants.ts` — `EAT_WORDS`에 새로운 말 추가, `MASCOT.body` 색 바꾸기
- `joops-game.tsx`의 `draw()` — `d.setPhase(Math.floor(t * 7))`의 7을
  0, 3, 30으로 ([08 문서](./08-doodle-rendering.md)의 그 실험!)
- `lib/backdrop.ts` — 별 개수(`seedStars(w, h, 46)`의 46), 격자 간격(48)

---

## 2. 과제 목록 (난이도순)

### ⭐ 초급 — 한두 줄 수정

**과제 1. 나만의 대사**
`constants.ts`의 `EAT_WORDS`/`OUCH_WORDS`에 항목을 추가하세요.
<details><summary>힌트</summary>배열에 문자열만 추가하면 끝. 뽑는 코드는 이미 랜덤입니다.</details>

**과제 2. 4번째 목숨**
하트 4개로 시작하게 만드세요.
<details><summary>힌트</summary>`TUNE.startLives`만 바꾸면 될까요? `game-ui.tsx`의 `[0, 1, 2].map`도
보세요. 하트를 그리는 개수가 하드코딩되어 있죠? `TUNE.startLives`를 props로
내려서 `Array.from({ length: lives총개수 })`로 그리게 바꿔보면 완벽합니다.</details>

**과제 3. 밤하늘 색 바꾸기**
우주를 보라색 밤으로 바꿔 보세요.
<details><summary>힌트</summary>`constants.ts`의 `SPACE_BG` + `globals.css`의 `--background` +
`page.tsx`/`joops-game.tsx`의 `bg-[#141838]` + `layout.tsx`/`play/page.tsx`의
`themeColor`. 같은 색이 여러 곳에 있죠? 이걸 한 곳으로 모으는 것도 좋은 리팩토링 연습!</details>

### ⭐⭐ 중급 — 함수 하나 추가/수정

**과제 4. 새로운 쓰레기: 우주 양말 🧦**
먹을 수 있는 5번째 쓰레기 종류를 추가하세요.
<details><summary>힌트</summary>순서: ① `constants.ts`의 `JunkKind`에 `"sock"` 추가 →
② `JUNK_COLORS`에 색 추가(빼먹으면 컴파일 에러가 알려줘요! Record의 힘) →
③ `EDIBLE_KINDS`에 추가 → ④ `debris.ts`의 `drawJunkShape` switch에
`case "sock"` 추가. 양말은 `rectPts` 두 개(발목+발)면 그럴듯합니다.</details>

**과제 5. 콤보 시스템**
2초 안에 연속으로 먹으면 점수가 ×2, ×3… 커지게 하세요.
<details><summary>힌트</summary>게임 상태에 `let combo = 0; let lastEatAt = 0;` 추가.
`swallow()`에서 `t - lastEatAt < 2`면 combo++, 아니면 combo = 1.
점수는 `TUNE.junkScore * combo`. 콤보를 `makePopup`으로 보여주면 완성.
"x3!" 팝업은 이미 있는 부품으로 공짜입니다.</details>

**과제 6. 스파크에 중력**
반짝이 입자가 아래로 떨어지며 사라지게 하세요.
<details><summary>힌트</summary>`effects.ts`의 `updateSparks`에 한 줄: `s.vy += 400 * dt;`
(속도의 변화가 가속도! [07 문서](./07-game-loop-and-math.md)의 dt 절 복습)</details>

**과제 7. 일시정지**
P 키(또는 버튼)로 게임을 멈추게 하세요.
<details><summary>힌트</summary>`Phase`에 `"paused"`를 추가하는 방법과, `let paused = false`
깃발을 두고 `update(dt)`를 건너뛰는 방법이 있어요. 어느 쪽이든
`draw()`는 계속 돌게 하면 "정지 화면"이 자연스럽습니다.
keydown 리스너는 useEffect에서 등록하고 — 그렇죠, cleanup에서 해제!</details>

### ⭐⭐⭐ 고급 — 설계가 필요한 과제

**과제 8. 시간제한 모드**
60초 카운트다운, 시간이 다 되면 게임오버. HUD에 남은 시간 표시.
<details><summary>힌트</summary>게임 세계에 `let timeLeft = 60`, update에서 `timeLeft -= dt`.
HUD에 보여야 하니 `ui`에 필드를 추가하고 `pushUi`를 확장해야 하는데 —
매 프레임 pushUi를 부르면 안 됩니다! (왜인지는 01 문서 4절)
`Math.ceil(timeLeft)`가 바뀔 때만 부르세요. 이 과제의 진짜 배움이 그거예요.</details>

**과제 9. 보스: 거대 가시 행성**
300점마다 화면 절반 크기의 가시가 천천히 지나갑니다.
<details><summary>힌트</summary>`spawn()`에서 특별 조건으로 생성하고, `makeDebris` 대신 직접
큰 size의 Debris를 만들어 push. `swaySpeed: 0`, 느린 `vy`.
기존 hazard 충돌 판정을 그대로 재사용할 수 있는지 확인해 보세요 — 될 겁니다.
그게 "데이터와 로직을 분리"한 설계의 보상이에요.</details>

**과제 10. 사운드 토글**
🔇/🔊 버튼으로 소리를 끄고 켜기. 설정은 localStorage에 저장.
<details><summary>힌트</summary>`sound.ts`에 `let muted = false`와 `setMuted()` 추가, `blip` 첫 줄에서
`if (muted) return;`. 버튼은 `game-ui.tsx`에 두되 클릭이 게임 탭으로
안 새게 `pointer-events-auto` + `e.stopPropagation()`.
저장은 `storage.ts`에 함수를 추가하면 패턴이 이미 있죠.</details>

---

## 3. 디버깅 가이드 — 게임이 이상할 때 보는 곳

### 증상별 처방전

| 증상 | 유력 용의자 |
|---|---|
| 화면이 하얗다/에러 | 브라우저 콘솔(F12)부터! 에러 메시지가 답의 90% |
| `window is not defined` | 브라우저 API를 서버 컴포넌트에서 사용. `"use client"` + useEffect 안으로 |
| 그림이 뿌옇다 | `fitCanvas`를 안 거침. DPR 설정 확인 ([06 문서](./06-canvas-2d.md) 2절) |
| 도형들이 선으로 이어져 거미줄 | `ctx.beginPath()` 누락 |
| 화면 전체가 돌거나 밀림 | `ctx.save()`/`restore()` 짝 안 맞음 |
| 어떤 것만 반투명해짐 | `globalAlpha`를 1로 복구 안 함 (또는 대입 대신 곱셈 필요) |
| 물체가 안 움직임 | 파생값을 고치고 있지 않은지 — `x`가 아니라 `x0`! ([07 문서](./07-game-loop-and-math.md) 5절) |
| 목록에서 가끔 하나가 안 지워짐 | 배열을 앞에서부터 돌며 splice — 역순으로! |
| 이동 속도가 기기마다 다름 | 어딘가에 `* dt` 누락 |
| 렉 걸리면 물체가 벽을 통과 | dt 클램프 확인 (`Math.min(0.05, ...)`) |
| 터치 드래그가 뚝뚝 끊김 | 캔버스에 `touch-none` 클래스 있는지 |
| 소리가 안 남 | 첫 탭 전이라 정상일 수도. `sound.ensure()`가 제스처 핸들러 안에 있는지 |
| 페이지를 떠나도 뭔가 계속 돎 | useEffect cleanup에서 rAF/리스너 해제 확인 |
| 점수판이 안 바뀜 | 상태는 바뀌는데 `pushUi()`를 안 불렀는지 |

### 만능 무기: console.log

```ts
// update 안에서 (매 프레임 찍으면 콘솔이 폭발하니 조건을 걸어서)
if (junks.length > 20) console.log("쓰레기 개수:", junks.length);

// 충돌 순간만
console.log("충돌!", { dist, r: player.r, size: j.size });
```

### 만능 무기 2: 히트박스 그려보기

판정이 이상하면 **판정을 눈에 보이게** 만드세요. `draw()` 끝에:

```ts
// 디버그: 주인공의 실제 판정 원 그리기
ctx.beginPath();
ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
ctx.strokeStyle = "lime";
ctx.lineWidth = 1;
ctx.stroke();
```

그림과 판정이 다르다는 게(그리고 그게 의도라는 게) 한눈에 보입니다.
프로 게임 개발자들도 전부 이렇게 합니다 ("디버그 드로잉").

### 디버깅의 절반은 "어느 쪽인가"

이 게임의 구조 덕분에 문제를 반으로 자를 수 있습니다:

- **숫자/동작이 이상하다** → `update`와 그 부하들(step류, 충돌)만 보면 됨
- **모양/색이 이상하다** → `draw`와 그 부하들(draw류)만 보면 됨
- **점수판/화면 전환이 이상하다** → `pushUi`와 React 쪽(`game-ui.tsx`)만 보면 됨

---

## 4. 더 공부하고 싶다면

- **이 프로젝트의 Next.js 공식 문서 (버전이 정확히 일치!)**:
  `node_modules/next/dist/docs/` — 특히 `01-app/01-getting-started/`
- **MDN Web Docs** (https://developer.mozilla.org/ko/) — Canvas, Web Audio,
  Pointer Events의 한국어 표준 문서. "MDN canvas"처럼 검색하세요.
- **React 공식 문서** (https://ko.react.dev/) — 한국어로 아주 잘 되어 있습니다.
  특히 "Escape Hatches" 장이 이 게임의 useEffect/useRef 패턴과 직결돼요.
- **Tailwind CSS 문서** (https://tailwindcss.com/docs) — 클래스 검색용.

### 다음 프로젝트 아이디어

이 코드를 다 이해했다면 이런 걸 만들 수 있습니다:

1. **벽돌깨기** — 공 반사(vx 부호 뒤집기)만 새로 배우면 됨
2. **플래피 버드** — 중력(과제 6)과 점프만 있으면 됨
3. **그림판** — `doodle.ts`의 중점 기법이 그대로 핵심 기술
4. **타이핑 게임** — 떨어지는 것을 keydown으로 잡기. 이 게임의 90% 재활용

전부 이 프로젝트에서 배운 부품의 재조합입니다. 게임 하나를 제대로
이해하면 다음 게임은 절반의 노력으로 만들어져요.

**즐겁게 부수고, 고치고, 만드세요! 🚀**
