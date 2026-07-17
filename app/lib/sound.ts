/**
 * 🔊 sound.ts — mp3 파일 하나 없이 소리를 "직접 만드는" 미니 신시사이저
 *
 * Web Audio API의 두 부품만 씁니다:
 *   - OscillatorNode(발진기): 지정한 주파수의 순수한 파형(소리의 원료)을 만듦
 *   - GainNode(볼륨 조절기): 소리 크기를 조절함
 * 연결 순서는 항상   발진기 → 볼륨 → 스피커(destination)   입니다.
 *
 * 🎵 소리 디자인의 문법:
 *   - 음이 올라가면(430→900Hz) "좋은 일" 느낌  → 먹었을 때
 *   - 음이 내려가고 거친 파형이면 "나쁜 일" 느낌 → 부딪혔을 때
 *   (마리오의 코인 소리와 죽는 소리를 떠올려 보세요!)
 *
 * ⚠️ 브라우저 자동재생 정책:
 *   사용자가 화면을 한 번이라도 클릭/탭하기 전에는 브라우저가 소리를 막습니다.
 *   그래서 ensure()를 반드시 "탭 이벤트 핸들러 안에서" 불러야 소리가 풀립니다.
 */

/** 게임에서 쓰는 효과음 세트를 만들어 돌려줍니다. (게임 시작 시 한 번만 호출) */
export function createSound() {
  // AudioContext = 오디오 작업실. 무거운 객체라 하나만 만들어 계속 재사용합니다.
  let ac: AudioContext | null = null;

  /**
   * 오디오를 사용할 준비를 합니다.
   * 반드시 사용자 제스처(pointerdown 등) 핸들러 안에서 불러야 합니다 —
   * 그 안에서 resume()을 불러야만 브라우저가 "suspended"(잠김)를 풀어줘요.
   */
  const ensure = () => {
    try {
      if (!ac) ac = new AudioContext();
      if (ac.state === "suspended") void ac.resume();
    } catch {
      // 오디오가 안 되는 환경이어도 게임은 계속되어야 하니 조용히 넘어갑니다.
    }
  };

  /**
   * "삑" 소리 한 개를 만드는 기본 부품.
   * @param f0    시작 주파수(Hz). 높을수록 높은 음.
   * @param f1    끝 주파수(Hz). f0→f1로 음정이 미끄러집니다.
   * @param dur   길이(초)
   * @param type  파형. sine=부드러움, triangle=말랑함, sawtooth=거침
   * @param vol   볼륨 (0~1)
   * @param delay 몇 초 뒤에 재생할지 (여러 음을 이어 붙일 때 사용)
   */
  const blip = (
    f0: number,
    f1: number,
    dur: number,
    type: OscillatorType = "triangle",
    vol = 0.1,
    delay = 0,
  ) => {
    // 아직 오디오가 잠겨 있으면 조용히 포기 — 소리는 "있으면 좋은" 부가 기능!
    if (!ac || ac.state !== "running") return;
    const t0 = ac.currentTime + delay; // 오디오 시계 기준의 시작 시각
    const o = ac.createOscillator(); // 발진기 (파형 생성)
    const g = ac.createGain(); // 볼륨 조절기
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    // 음정을 "지수 곡선"으로 미끄러뜨림. 사람 귀는 로그 스케일이라
    // 직선(linear)보다 지수(exponential)로 변해야 자연스럽게 들립니다.
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    // 볼륨 페이드아웃. 지수 곡선은 0에 도달할 수 없어서(0을 넣으면 에러!)
    // 0 대신 아주 작은 값 0.0001을 목표로 합니다.
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); //  발진기 → 볼륨
    g.connect(ac.destination); //  볼륨 → 스피커
    o.start(t0);
    o.stop(t0 + dur + 0.05); // 다 쓴 발진기는 꼭 stop — 안 하면 계속 쌓입니다
  };

  return {
    ensure,

    /** 냠! — 음이 쭉 올라가는 밝은 소리 (올라감 = 긍정) */
    eat: () => blip(430, 900, 0.09, "triangle", 0.12),

    /** 별 획득 — 도미솔처럼 세 음을 0.08초 간격으로 쌓는 아르페지오 */
    star: () => {
      blip(660, 660, 0.08, "sine");
      blip(880, 880, 0.08, "sine", 0.1, 0.08);
      blip(1320, 1320, 0.14, "sine", 0.1, 0.16);
    },

    /** 아야! — 음이 떨어지는 거친 톱니파 (내려감 + 거침 = 부정) */
    hit: () => blip(220, 65, 0.28, "sawtooth", 0.12),

    /** 게임 오버 — 한 음씩 내려가는 낙담의 하강 음계 */
    over: () => {
      blip(392, 392, 0.16, "triangle");
      blip(330, 330, 0.16, "triangle", 0.1, 0.18);
      blip(262, 130, 0.5, "triangle", 0.1, 0.36);
    },

    /** 게임 화면을 떠날 때 오디오 작업실을 정리합니다. */
    dispose: () => {
      if (ac) void ac.close().catch(() => {});
    },
  };
}

/**
 * 📳 폰을 살짝 진동시킵니다 (지원하는 기기에서만).
 * `navigator.vibrate?.()`의 `?.`는 "이 기능이 있으면 불러줘"라는 뜻 —
 * 아이폰처럼 vibrate가 없는 브라우저에서도 에러가 나지 않습니다.
 */
export function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {}
}
