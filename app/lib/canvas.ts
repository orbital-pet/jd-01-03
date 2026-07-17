/**
 * 🖼️ canvas.ts — 캔버스 크기를 화면에 딱 맞추는 파일
 *
 * 캔버스에는 사실 크기가 "두 개" 있습니다:
 *
 *   ① CSS 크기   : 화면에서 차지하는 넓이 (예: 폭 390px)
 *   ② 버퍼 크기  : 실제 픽셀 격자의 해상도 (canvas.width / height)
 *
 * 요즘 폰은 CSS 1px 안에 하드웨어 픽셀이 2~3개씩 들어 있습니다
 * (이 배율이 devicePixelRatio, 줄여서 DPR). 버퍼를 CSS 크기 그대로 두면
 * 적은 픽셀을 억지로 늘려 그리는 셈이라 선이 뿌옇게 번져 보여요.
 * 그래서 버퍼를 DPR배로 키우고, 좌표계도 DPR배로 확대해 둡니다.
 * 그러면 게임 코드는 DPR을 완전히 잊고 CSS 좌표로만 그려도 선명합니다.
 */

/**
 * 캔버스의 픽셀 버퍼를 화면 밀도에 맞게 키우고, CSS 기준 크기(w, h)를 돌려줍니다.
 * 화면 크기가 바뀔 때(리사이즈)마다 다시 불러야 합니다.
 */
export function fitCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  // DPR을 최대 2로 제한: DPR 3이면 픽셀 수가 9배(3²)라 그리기 비용도 9배인데,
  // 2와 3의 화질 차이는 눈으로 거의 구분이 안 됩니다. 성능을 위한 실용적 타협!
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const w = canvas.clientWidth; // CSS 크기 (화면에서 보이는 폭)
  const h = canvas.clientHeight;

  canvas.width = w * dpr; // 실제 픽셀 버퍼는 DPR배로 크게
  canvas.height = h * dpr;

  // "앞으로 그리는 모든 좌표에 dpr을 곱해라"라고 좌표계를 설정.
  // 이 한 줄 덕분에 게임 코드는 (0 ~ w, 0 ~ h) CSS 좌표만 생각하면 됩니다.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 선 끝과 꺾이는 모서리를 둥글게 → 딱딱한 기계 선이 아니라 펜 선 느낌이 납니다.
  // (canvas.width에 값을 넣으면 컨텍스트 설정이 초기화되므로 여기서 다시 지정)
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  return { w, h };
}
