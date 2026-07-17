/**
 * 🎨 constants.ts — 게임 전체에서 함께 쓰는 "약속"들을 모아둔 파일
 *
 * 색깔, 글꼴, 쓰레기 종류처럼 여러 파일이 공유하는 값을 한곳에 모았습니다.
 * 게임의 분위기를 바꾸고 싶다면 (예: 색을 바꾸고 싶다면) 이 파일만 고치면 됩니다.
 */

/** 우주 배경색. 화면을 칠할 때도, 글자 테두리를 그릴 때도 이 색을 씁니다. */
export const SPACE_BG = "#141838";

/**
 * 손글씨 느낌 글꼴.
 * "Gaegu"(개구쟁이체)가 1순위이고, 없으면 뒤에 적힌 글꼴로 차례차례 대체됩니다.
 * (CSS에서 글꼴을 쉼표로 나열하면 "앞엣것이 없을 때 뒤엣것을 쓴다"는 뜻이에요.)
 */
export const DOODLE_FONT = '"Gaegu", "Comic Sans MS", "Chalkboard SE", cursive';

/** 주인공(마스코트)의 색상표. 몸통·먹선·눈·볼터치·안테나 색을 여기서 정합니다. */
export const MASCOT = {
  body: "#7ee8b2", // 몸통 (민트색)
  ink: "#0f2e22", // 눈동자, 입 같은 "먹선" (진한 초록빛 검정)
  eye: "#f4fff9", // 눈 흰자
  blush: "#ff8fab", // 볼터치, 혀 (분홍)
  antenna: "#ffd166", // 안테나 끝의 구슬 (노랑)
};

/**
 * 하늘에서 떨어지는 것들의 종류.
 * "유니온 타입": JunkKind 변수에는 이 6개 문자열 중 하나만 들어갈 수 있습니다.
 * 오타를 내면 TypeScript가 바로 빨간 줄로 알려줘요.
 */
export type JunkKind = "satellite" | "bolt" | "can" | "spring" | "star" | "hazard";

/**
 * 종류별 대표 색.
 * Record<JunkKind, string>은 "6가지 종류 모두에 대해 색(문자열)이 빠짐없이
 * 있어야 한다"는 뜻입니다. 하나라도 빼먹으면 컴파일 에러가 나서 안전해요.
 */
export const JUNK_COLORS: Record<JunkKind, string> = {
  satellite: "#8ecbff", // 인공위성 (하늘색)
  bolt: "#cfd8e6", // 육각 볼트 (은색)
  can: "#f9a8d4", // 음료수 캔 (분홍)
  spring: "#c4b5fd", // 스프링 (보라)
  star: "#ffd166", // 별 = 보너스! (노랑)
  hazard: "#ff8080", // 가시덩어리 = 위험! (빨강)
};

/**
 * 먹어도 되는(점수가 되는) 종류만 골라둔 목록.
 * `as const`를 붙이면 "이 배열은 절대 안 변해요"라고 못박는 것이라서,
 * TypeScript가 내용물 하나하나("satellite" 등)를 정확한 타입으로 기억해 줍니다.
 */
export const EDIBLE_KINDS = ["satellite", "bolt", "can", "spring"] as const;

/** 먹었을 때 머리 위로 뿅 하고 뜨는 말들. 자유롭게 추가해 보세요! */
export const EAT_WORDS = ["냠!", "쩝쩝", "꿀꺽!", "냠냠", "암냠!"];

/** 가시에 찔렸을 때 뜨는 말들. */
export const OUCH_WORDS = ["아야!", "으악!", "따가워!"];

/**
 * 먹을 수 있는 쓰레기 중에서 아무거나 한 종류를 뽑아줍니다.
 * Math.random()은 0 이상 1 미만의 소수 → 길이를 곱하고 소수점을 버리면
 * 0 ~ (길이-1) 사이의 랜덤 인덱스가 됩니다. (랜덤 뽑기의 기본 공식!)
 */
export const pickEdible = (): JunkKind =>
  EDIBLE_KINDS[Math.floor(Math.random() * EDIBLE_KINDS.length)];
