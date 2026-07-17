/**
 * 💾 storage.ts — 최고 기록을 브라우저에 저장하고 불러오는 파일
 *
 * localStorage는 브라우저가 제공하는 작은 저장 공간입니다.
 * 여기 저장한 값은 탭을 닫거나 컴퓨터를 껐다 켜도 남아 있어요.
 * (단, 같은 사이트에서만 읽을 수 있고, 문자열만 저장할 수 있습니다.)
 *
 * ⚠️ localStorage는 "브라우저"에만 있습니다. Next.js가 서버에서 HTML을
 * 미리 만들 때는 존재하지 않아서, 아무 데서나 부르면 에러가 납니다.
 * 그래서 읽기/쓰기를 전부 try-catch로 감싸 "실패해도 조용히 넘어가게" 했습니다.
 * (시크릿 모드 등 localStorage 사용이 막힌 브라우저 대비이기도 합니다.)
 */

/** localStorage에 저장할 때 쓰는 열쇠(key) 이름. */
export const BEST_KEY = "sjs-best";

/**
 * 저장된 최고 기록을 불러옵니다. 없거나 읽기에 실패하면 0을 돌려줍니다.
 * localStorage에는 문자열만 들어가므로 Number(...)로 숫자로 바꿔줍니다.
 * `|| 0`은 "숫자로 못 바꾸면(NaN) 0으로 해줘"라는 안전장치예요.
 */
export function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** 새 최고 기록을 저장합니다. 숫자를 문자열로 바꿔서 넣습니다. */
export function saveBest(best: number) {
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // 저장에 실패해도 게임은 계속되어야 하니 조용히 무시합니다.
  }
}
