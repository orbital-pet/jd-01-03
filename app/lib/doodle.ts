/**
 * ✏️ doodle.ts — "삐뚤빼뚤 손그림 선"을 그려주는 도구 상자
 *
 * 이 게임의 그림이 전부 손으로 그린 낙서처럼 보이는 비밀이 이 파일에 있습니다.
 * 핵심 아이디어는 두 가지예요:
 *
 *   1. 선을 그릴 때 각 점을 조금씩 "흔들어서"(wobble) 삐뚤빼뚤하게 만든다.
 *   2. 그 흔들림을 진짜 난수(Math.random)가 아니라 "결정론적 가짜 난수"로 만든다.
 *      → 같은 입력이면 항상 같은 흔들림이 나와서, 매 프레임 다시 그려도
 *        그림이 부들부들 떨지 않고 형체를 유지합니다.
 *
 * 흔들림의 "위상(phase)"을 초당 7번씩만 계단식으로 바꿔주면 (setPhase 참고)
 * 선이 부글부글 끓는 듯한 손그림 애니메이션(boiling line) 효과가 납니다.
 */

/** 점 하나 = [x, y] 숫자 두 개짜리 배열. (튜플 타입) */
export type Pt = [number, number];

/**
 * 캔버스 컨텍스트(ctx)에 손그림 선을 그리는 함수 묶음을 만들어 돌려줍니다.
 *
 * 반환된 함수들은 "경로(path)를 만들기만" 하고 색칠은 하지 않습니다.
 * 그리기는 fillStroke()나 strokeOnly()를 이어서 불러 마무리하세요.
 */
export function createDoodle(ctx: CanvasRenderingContext2D) {
  // 흔들림의 "몇 번째 장면인지"를 나타내는 번호. draw()가 매 프레임 갱신합니다.
  let phase = 0;

  const setPhase = (p: number) => {
    phase = p;
  };

  /**
   * 결정론적 가짜 난수: 같은 (seed, i, ph)를 넣으면 항상 같은 -1~1 값이 나옵니다.
   *
   * 원리: sin에 큰 수들을 곱해 마구 헝클어뜨린 뒤 소수 부분만 남기면
   * 사실상 예측 불가능한 값이 됩니다. (127.1, 311.7, 43758.5453 같은
   * 마법의 숫자들은 셰이더 프로그래밍 세계에서 유명한 관용구예요.)
   *
   * 왜 Math.random()을 안 쓸까? → random은 부를 때마다 다른 값이라
   * 매 프레임 그림의 흔들림이 새로 뽑혀서 형체가 유지되지 않습니다.
   */
  const wob = (seed: number, i: number, ph: number = phase) => {
    const v = Math.sin(seed * 127.1 + i * 311.7 + ph * 74.7) * 43758.5453;
    return (v - Math.floor(v)) * 2 - 1; // 소수 부분(0~1)을 -1~1 범위로 변환
  };

  /**
   * 꼭짓점들(pts)을 잇는 "손으로 그은 듯한" 경로를 만듭니다.
   * @param seed  이 도형만의 고유 번호 (도형마다 다른 흔들림을 갖게 함)
   * @param amp   흔들림의 세기 (픽셀). 클수록 더 삐뚤빼뚤
   * @param close true면 마지막 점과 첫 점을 이어 닫힌 도형으로
   */
  const wobblyPath = (pts: Pt[], seed: number, amp: number, close: boolean) => {
    const out: Pt[] = [];
    const n = pts.length;
    const segs = close ? n : n - 1;
    // 각 변을 2등분해 점을 늘립니다. 안 늘리면 꼭짓점만 흔들리고
    // 변은 자로 그은 듯 곧게 남아서 손그림처럼 보이지 않아요.
    for (let i = 0; i < segs; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % n]; // % n: 마지막 점 다음은 첫 점으로 순환
      for (let s = 0; s < 2; s++) {
        const f = s / 2; // 변 위에서의 위치 (0 = 시작점, 0.5 = 중간)
        const k = i * 2 + s; // 이 점의 통번호 → wob에 넣어 점마다 다른 흔들림
        out.push([
          x1 + (x2 - x1) * f + wob(seed, k) * amp,
          y1 + (y2 - y1) * f + wob(seed + 50, k) * amp, // seed+50: x와 y가 따로 흔들리게
        ]);
      }
    }
    if (!close) {
      // 열린 선은 마지막 점도 직접 찍어줘야 끝까지 그려집니다.
      const [lx, ly] = pts[n - 1];
      out.push([lx + wob(seed, segs * 2) * amp, ly + wob(seed + 50, segs * 2) * amp]);
    }
    ctx.beginPath();
    out.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    if (close) ctx.closePath();
  };

  /**
   * 삐뚤빼뚤한 원(감자 모양?)을 만듭니다. 몸통, 달, 입에 쓰여요.
   *
   * 1단계: 원 둘레에 점 12개를 찍되, 반지름을 점마다 조금씩 다르게(wob) 합니다.
   *        cos이 x, sin이 y — "각도 → 좌표" 변환의 기본 공식입니다.
   * 2단계: 점들을 "중점 기법"으로 잇습니다. 곡선의 끝점을 꼭짓점이 아니라
   *        이웃 점과의 중간 지점으로 잡으면, 이어지는 곡선끼리 방향이 자동으로
   *        일치해서 모서리 없이 매끄럽게 이어집니다. (캔버스 곡선의 정석 관용구!)
   */
  const wobblyBlob = (x: number, y: number, r: number, seed: number, amp: number) => {
    const n = 12;
    const pts: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2; // 360도를 12등분한 각도
      const rr = r + wob(seed, i) * amp; // 반지름을 살짝씩 흔든다
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    ctx.beginPath();
    let m = mid(pts[n - 1], pts[0]);
    ctx.moveTo(m[0], m[1]);
    for (let i = 0; i < n; i++) {
      m = mid(pts[i], pts[(i + 1) % n]);
      // 제어점 = 꼭짓점, 끝점 = 다음 중점: 곡선이 꼭짓점 쪽으로 당겨지며 지나갑니다.
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
    }
    ctx.closePath();
  };

  /** 두 점을 잇는 삐뚤빼뚤한 선 하나. (wobblyPath의 간편 버전) */
  const wobblyLine = (x1: number, y1: number, x2: number, y2: number, seed: number, amp: number) =>
    wobblyPath(
      [
        [x1, y1],
        [x2, y2],
      ],
      seed,
      amp,
      false,
    );

  /** 사각형의 네 꼭짓점을 만들어줍니다. (x, y는 왼쪽 위 모서리) */
  const rectPts = (x: number, y: number, rw: number, rh: number): Pt[] => [
    [x, y],
    [x + rw, y],
    [x + rw, y + rh],
    [x, y + rh],
  ];

  /** 정n각형의 꼭짓점들. 볼트(6각형) 등에 사용. rot로 회전 각도 지정. */
  const ngonPts = (n: number, r: number, rot = 0): Pt[] =>
    Array.from({ length: n }, (_, i) => {
      const a = rot + (i / n) * Math.PI * 2;
      return [Math.cos(a) * r, Math.sin(a) * r] as Pt;
    });

  /**
   * 별/가시처럼 뾰족뾰족한 도형의 꼭짓점들.
   * 바깥 반지름(rOut)과 안쪽 반지름(rIn)을 번갈아 찍으면 뾰족해집니다.
   * -Math.PI / 2 에서 시작하는 이유: 첫 꼭짓점이 정확히 위쪽을 향하게 하려고요.
   */
  const spikyPts = (n: number, rIn: number, rOut: number): Pt[] =>
    Array.from({ length: n * 2 }, (_, i) => {
      const a = -Math.PI / 2 + (i / (n * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? rOut : rIn; // 짝수 번째는 바깥, 홀수 번째는 안쪽
      return [Math.cos(a) * r, Math.sin(a) * r] as Pt;
    });

  /**
   * "속은 연하게 + 외곽선은 진하게" 같은 색으로 칠합니다.
   * 채도 높은 단색으로 꽉 채우면 벡터 아이콘처럼 딱딱해 보이는데,
   * 이렇게 하면 색연필로 슥슥 칠한 느낌이 나요.
   */
  const fillStroke = (color: string, fillAlpha = 0.15) => {
    // ⚠️ globalAlpha는 "곱해서" 써야 합니다. 그냥 대입(=)하면 바깥에서 걸어둔
    // 투명도(예: 무적 깜빡임의 0.4)를 무시해 버리는 버그가 생깁니다.
    const ga = ctx.globalAlpha;
    ctx.globalAlpha = ga * fillAlpha; // 속: 연하게
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = ga; // 원래 투명도로 복원
    ctx.strokeStyle = color; // 선: 진하게
    ctx.stroke();
  };

  /** 외곽선만 그립니다. (속을 칠하지 않는 도형용) */
  const strokeOnly = (color: string) => {
    ctx.strokeStyle = color;
    ctx.stroke();
  };

  return {
    setPhase,
    wob,
    wobblyPath,
    wobblyBlob,
    wobblyLine,
    rectPts,
    ngonPts,
    spikyPts,
    fillStroke,
    strokeOnly,
  };
}

/**
 * createDoodle이 돌려주는 도구 상자의 타입.
 * ReturnType<...>은 "저 함수의 반환값 타입을 그대로 가져다 써줘"라는 뜻이라
 * 함수에 도구를 추가하면 이 타입도 자동으로 따라 바뀝니다.
 */
export type Doodle = ReturnType<typeof createDoodle>;
