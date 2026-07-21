// ============================================================================
// pilot-sound — Web Audio 신시사이저 (수동 조종 미니게임용)
//
// 오디오 파일 0개: 모든 소리는 오실레이터로 즉석에서 합성한다.
// 사운드 문법: 음이 올라가면 긍정, 내려가면 부정. 부드러운 파형은 좋은 일,
// 거친 톱니파는 나쁜 일. (jd-03 sound.ts 참조)
//
// 브라우저 자동재생 정책상 AudioContext는 반드시 사용자 제스처 안에서
// ensureAudio()로 깨운다. 실패하면 조용히 무음 — 게임을 절대 막지 않는다.
// ============================================================================

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

let audio: AudioContext | null = null;

/** 사용자 제스처 핸들러 안에서 호출: 오디오를 켜거나 잠든 컨텍스트를 깨운다. */
export function ensureAudio() {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext!)();
    if (audio.state === "suspended") void audio.resume();
  } catch {
    audio = null; // 미지원 환경 — 이후 재생 함수들이 전부 조용히 빠져나간다
  }
}

export function closeAudio() {
  updateThrustSound(0);
  if (audio) void audio.close().catch(() => {});
  audio = null;
  thrustNode = null;
  thrustGain = null;
}

/** 짧은 "삐" 하나. 주파수를 from→to로 지수 곡선으로 미끄러뜨리고 음량도 지수 감쇠. */
function chirp(type: OscillatorType, from: number, to: number, dur: number, gain = 0.06, delay = 0) {
  if (!audio || audio.state !== "running") return;
  try {
    const t0 = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); // 지수 램프는 0에 못 닿는다
    osc.connect(g).connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    // 실패하면 그냥 무음
  }
}

/** 잔해 획득: 코인 사운드 (올라가는 두 음) */
export function playEat() {
  chirp("square", 988, 988, 0.05, 0.04);
  chirp("square", 1318, 1318, 0.13, 0.04, 0.05);
}

/** 위험물 피격: 빠르게 곤두박질치는 두 파형 믹스 */
export function playHit() {
  chirp("sawtooth", 150, 40, 0.2, 0.09);
  chirp("square", 200, 50, 0.25, 0.07);
}

/** 연료 셀 획득: 파워업 아르페지오 */
export function playFuelUp() {
  const notes = [261, 329, 392, 523, 659, 783];
  notes.forEach((f, i) => chirp("square", f, f, 0.1, 0.035, i * 0.04));
}

/** 연료 소진: 시동 꺼지는 하강음 */
export function playFuelEmpty() {
  chirp("sawtooth", 330, 110, 0.35, 0.06);
  chirp("square", 392, 130, 0.4, 0.04, 0.05);
}

/** 출격: 상승 휘리릭 */
export function playStart() {
  chirp("sawtooth", 180, 620, 0.35, 0.05);
  chirp("square", 360, 900, 0.3, 0.03, 0.08);
}

/** 종료: 하강 음계 (낙담) */
export function playEnd() {
  chirp("triangle", 392, 392, 0.16, 0.06);
  chirp("triangle", 330, 330, 0.16, 0.06, 0.18);
  chirp("triangle", 262, 130, 0.5, 0.06, 0.36);
}

let thrustNode: OscillatorNode | null = null;
let thrustGain: GainNode | null = null;

/** 추진 엔진음: 낮은 사각파 루프 — level 0 정지, 1~3 분사 단계 */
export function updateThrustSound(level: number) {
  if (!audio) return;
  try {
    if (!thrustNode || !thrustGain) {
      if (level === 0) return;
      thrustGain = audio.createGain();
      thrustGain.gain.value = 0;
      thrustGain.connect(audio.destination);
      thrustNode = audio.createOscillator();
      thrustNode.type = "square";
      thrustNode.frequency.value = 50;
      thrustNode.connect(thrustGain);
      thrustNode.start();
    }
    const on = level > 0;
    thrustGain.gain.setTargetAtTime(on ? 0.012 + level * 0.012 : 0, audio.currentTime, 0.1);
    thrustNode.frequency.setTargetAtTime(40 + level * 20, audio.currentTime, 0.1);
  } catch {
    // 무음
  }
}
