# 06. Canvas 2D — 브라우저 위의 도화지 🖌️

> `<canvas>`는 "픽셀을 직접 찍을 수 있는 도화지"입니다. HTML이 "문서"를
> 만든다면 캔버스는 "그림"을 만들어요. 게임, 차트, 그림판이 모두 이걸로
> 만들어집니다. 이 문서는 이 게임에 나오는 캔버스 기능을 전부 다룹니다.

---

## 1. 시작: 캔버스와 컨텍스트

```tsx
// JSX에 도화지를 놓고
<canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

// useEffect에서 "그리기 도구(컨텍스트)"를 꺼냅니다
const canvas = canvasRef.current;
const ctx = canvas.getContext("2d");   // 이제 모든 그리기는 ctx로!
```

`ctx`(context)가 우리의 붓입니다. 앞으로 나오는 모든 명령이 `ctx.무엇`이에요.

### 좌표계 — 수학이랑 다릅니다!

```
(0,0) ─────────→ x 증가
  │
  │      캔버스의 y는 "아래로" 증가합니다.
  ↓      그래서 쓰레기가 떨어지는 코드가 j.y += ... (더하기)예요.
y 증가
```

---

## 2. 두 개의 크기와 DPR — 선명한 그림의 비밀

캔버스에는 크기가 **두 개** 있습니다. 이걸 모르면 그림이 뿌옇게 나와요.

| | 무엇 | 어디서 정하나 |
|---|---|---|
| CSS 크기 | 화면에서 차지하는 넓이 | `className="h-full w-full"` |
| 버퍼 크기 | 실제 픽셀 격자 수 | `canvas.width`, `canvas.height` |

요즘 휴대폰은 CSS 1px 안에 실제 픽셀이 2~3개 들어 있습니다
(그 배율이 `devicePixelRatio`, DPR). 버퍼를 CSS 크기 그대로 두면
적은 픽셀을 늘려 그리는 셈이라 선이 번져 보입니다.

해결책이 `lib/canvas.ts`의 `fitCanvas`입니다:

```ts
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = w * dpr;               // 버퍼를 DPR배로 크게
canvas.height = h * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);  // "모든 좌표에 dpr을 곱해라"
```

마지막 줄이 핵심입니다. 좌표계 자체를 DPR배로 확대해 두면, **게임 코드는
DPR의 존재를 완전히 잊고 CSS 좌표로만** 그려도 선명하게 나옵니다.

`Math.min(..., 2)`로 자르는 이유: DPR 3이면 픽셀 수가 9배(3²)라 그리기
비용도 9배인데, 2와 3의 화질 차이는 눈으로 거의 구분이 안 됩니다.
**화질 대비 성능의 실용적인 타협점**이에요.

---

## 3. 기본 그리기 3종 세트

### ① 사각형 — 유일하게 경로 없이 바로 그려짐

```ts
ctx.fillStyle = SPACE_BG;              // 채우기 색 설정
ctx.fillRect(-12, -12, w + 24, h + 24); // (x, y, 폭, 높이) 즉시 채움
```

`backdrop.ts`가 배경을 이렇게 칠합니다. 화면보다 12px 크게 칠하는 이유:
화면 흔들기 효과로 좌표계가 밀렸을 때 가장자리에 빈 틈이 보이지 않게요.

### ② 경로(Path) — 나머지 모든 도형의 기본

캔버스 그리기는 "펜을 들고 → 이동하고 → 선을 긋고 → 마지막에 잉크를
칠하는" 순서입니다:

```ts
ctx.beginPath();          // 새 경로 시작 (이전 경로 버리기 — 잊으면 대참사!)
ctx.moveTo(x1, y1);       // 펜을 들어 이동
ctx.lineTo(x2, y2);       // 선을 그으며 이동 (아직 화면엔 안 보임!)
ctx.closePath();          // (선택) 시작점까지 닫기
ctx.stroke();             // 외곽선에 잉크 칠하기 ← 이제 보임
ctx.fill();               // 속 채우기
```

⚠️ 초보 실수 1위: **`beginPath()`를 빼먹는 것.** 이전에 그리던 경로에
계속 선이 이어져서 화면이 거미줄이 됩니다. "새 도형 = 새 beginPath"!

### ③ 원과 호 — `arc`

```ts
ctx.arc(x, y, 반지름, 시작각, 끝각);

// 완전한 원 (시작 0, 끝 2π)
ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);       // backdrop.ts의 별

// 호(부채꼴 곡선) = 웃는 입!
ctx.arc(x, my - r * 0.08, r * 0.24, Math.PI * 0.2, Math.PI * 0.8);  // mascot.ts
```

각도는 도(degree)가 아니라 **라디안**입니다: 180도 = π, 360도 = 2π.
시계 3시 방향이 0이고 시계방향으로 증가해요.

재미있는 활용: 호의 각도 범위만 바꾸면 **웃는 입**(아래로 볼록),
**자는 눈**(작은 호), **시무룩한 입**(위로 볼록, `hazard`의 입)이 다 됩니다.

### 타원 — `ellipse`

```ts
// mascot.ts — 눈 흰자 (가로세로 반지름이 다른 원)
ctx.ellipse(cx, cy, 가로반지름, 세로반지름, 회전, 0, Math.PI * 2);
```

### 곡선 — `quadraticCurveTo`

```ts
ctx.quadraticCurveTo(제어점x, 제어점y, 끝점x, 끝점y);
```

현재 위치에서 끝점까지, **제어점 방향으로 당겨지는** 곡선을 그립니다.
곡선은 제어점을 통과하지 않고 스쳐 지나가요. `doodle.ts`의 `wobblyBlob`이
이걸로 몽글몽글한 원을 만듭니다. (자세한 원리는 [08 문서](./08-doodle-rendering.md))

---

## 4. 스타일 속성들

```ts
ctx.fillStyle = "#ffd166";     // 채우기 색
ctx.strokeStyle = "#ff8080";   // 선 색
ctx.lineWidth = 3;             // 선 두께
ctx.lineCap = "round";         // 선 끝 모양 (round = 둥글게)
ctx.lineJoin = "round";        // 선 꺾임 모양
ctx.globalAlpha = 0.4;         // 전체 투명도 (이후 그리는 모든 것에 적용!)
```

- `lineCap/lineJoin = "round"`는 `fitCanvas`에서 설정합니다.
  딱딱한 기계 선 대신 **펜으로 그린 느낌**의 일등 공신이에요.
- ⚠️ `globalAlpha`는 되돌리기 전까지 계속 적용됩니다. 이 프로젝트는
  쓰고 나면 반드시 `ctx.globalAlpha = 1`로 복구하거나, 기존 값에
  곱했다가(`ga * 0.4`) 되돌립니다. `doodle.ts`의 `fillStroke` 주석 참고.

---

## 5. 변환(Transform) — 좌표계를 통째로 옮기기 ⭐

회전한 물체를 그리려면 꼭짓점마다 삼각함수를 계산해야 할까요? 아니요.
**물체가 아니라 "종이(좌표계)를" 움직이면 됩니다.**

```ts
// debris.ts의 drawDebris — 캔버스의 핵심 패턴
ctx.save();                  // ① 현재 좌표계+스타일을 스택에 백업
ctx.translate(j.x, j.y);     // ② 원점(0,0)을 물체 위치로 이동
ctx.rotate(j.rot);           // ③ 원점 기준 회전
ctx.scale(sc, sc);           // ④ 원점 기준 확대/축소
drawJunkShape(...);          // ⑤ 이제 (0,0) 중심으로 그리면 끝!
ctx.restore();               // ⑥ 백업 복원
```

⑤ 덕분에 `drawJunkShape`는 "지금 어디에, 몇 도 돌아가 있는지"를 전혀
모른 채 원점 주변에 그리기만 하면 됩니다. 코드가 극적으로 단순해져요.

⚠️ **`save()`와 `restore()`는 괄호처럼 반드시 짝을 맞추세요.**
`restore`를 빼먹으면 다음에 그리는 모든 것이 같이 회전/이동합니다.
"화면이 통째로 돌기 시작했다?" → 십중팔구 `restore` 누락입니다.

### 응용 1: 화면 흔들기 (joops-game.tsx의 draw)

```ts
ctx.save();
if (shake > 0) {
  ctx.translate(랜덤, 랜덤);   // 좌표계 전체를 살짝 밀어버림 = 화면이 흔들림!
}
// ... 모든 그리기 ...
ctx.restore();
```

물체 하나하나가 아니라 **세계 전체**를 흔드는 것. 맞았을 때의 타격감이
이 몇 줄에서 나옵니다.

### 응용 2: 원을 타원으로 (mascot.ts의 입)

```ts
ctx.save();
ctx.translate(x, my);
ctx.scale(1, mry / mrx);    // 세로만 늘어나는 좌표계로 바꾼 뒤
d.wobblyBlob(0, 0, mrx, ...); // 원을 그리면 → 화면에는 타원!
ctx.restore();
```

`wobblyBlob`은 원만 그릴 줄 아는데, 함수를 고치는 대신 좌표계를
찌그러뜨려서 타원을 얻습니다. **함수 재활용의 좋은 예**예요.

---

## 6. 글자 그리기

```ts
// effects.ts의 drawPopups
ctx.font = `700 ${p.size}px ${DOODLE_FONT}`;  // 굵기 크기 글꼴 (CSS font와 같은 문법)
ctx.textAlign = "center";      // 가로 기준: x가 글자의 가운데
ctx.textBaseline = "middle";   // 세로 기준: y가 글자의 세로 중앙
ctx.strokeText("냠!", 0, 0);   // 외곽선 글자
ctx.fillText("냠!", 0, 0);     // 채운 글자
```

**가독성 트릭**: 배경색으로 두꺼운 `strokeText`를 먼저 긋고 그 위에
`fillText`를 얹으면, 어떤 그림 위에서도 글자가 또렷하게 읽힙니다.
지도 라벨, 영상 자막, 게임 데미지 숫자가 전부 이 기법이에요.

---

## 7. 애니메이션 — 매 프레임 다시 그리기

캔버스에는 "움직임"이 없습니다. **빠르게 다시 그릴 뿐**이에요.

```ts
const loop = (now) => {
  update(dt);                        // 세상을 조금 움직이고
  draw();                            // 전부 다시 그리고
  raf = requestAnimationFrame(loop); // 다음 화면 갱신 때 또 불러달라고 예약
};
raf = requestAnimationFrame(loop);   // 시동!
// ...
cancelAnimationFrame(raf);           // 정리할 때 취소 (useEffect cleanup에서)
```

`requestAnimationFrame`(rAF)은 "브라우저야, 다음에 화면 그릴 준비가 되면
이 함수를 불러줘"입니다. `setInterval`보다 나은 점:

- 모니터 주사율에 정확히 동기화 (60Hz면 60번, 120Hz면 120번)
- 탭이 백그라운드면 자동으로 멈춤 (배터리 절약)

지우기는 어떻게? 이 게임은 `drawBackdrop`이 매 프레임 화면 전체를
배경색으로 덮어 칠하므로 별도의 지우기가 필요 없습니다.

> 프레임 간 시간(dt)을 다루는 법은 [07. 게임 루프](./07-game-loop-and-math.md)에서
> 자세히 다룹니다. 캔버스 애니메이션의 반쪽은 사실 그 문서예요.

---

## 8. 그리는 순서 = 쌓이는 순서

캔버스는 **나중에 그린 것이 위에** 덮입니다. 레이어 개념이 없어요.
그래서 `draw()`의 순서가 곧 화면의 앞뒤입니다:

```ts
drawBackdrop(...)   // 제일 뒤: 배경
drawDebris(...)     // 그 위: 쓰레기들
drawMascot(...)     // 그 위: 주인공
drawSparks(...)     // 그 위: 반짝이
drawPopups(...)     // 제일 앞: 글자
```

주인공을 쓰레기보다 먼저 그리면 쓰레기가 주인공을 가립니다.
순서를 바꿔 보면 바로 체감돼요.

---

## 9. 치트시트

| 하고 싶은 것 | 코드 |
|---|---|
| 사각형 채우기 | `fillRect(x, y, w, h)` |
| 원 | `beginPath(); arc(x, y, r, 0, Math.PI*2); fill()` |
| 선 | `beginPath(); moveTo(...); lineTo(...); stroke()` |
| 부드러운 곡선 | `quadraticCurveTo(cx, cy, x, y)` |
| 글자 | `font = "..."; fillText(텍스트, x, y)` |
| 반투명 | `globalAlpha = 0.5` (쓰고 나서 1로 복구!) |
| 이동/회전/확대 | `save() → translate/rotate/scale → 그리기 → restore()` |
| 선명하게(레티나) | 버퍼를 DPR배로 + `setTransform(dpr, 0, 0, dpr, 0, 0)` |
| 애니메이션 | `requestAnimationFrame` 루프에서 전부 다시 그리기 |
