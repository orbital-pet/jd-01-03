# 🛰️ SPACE JOOPS · 우주 냠냠!

손가락으로 슥슥 움직여서 떠다니는 우주쓰레기를 몽땅 먹어치우는
**손그림 두들 게임**입니다. 그림도 소리도 파일 없이 전부 코드로 만들어요.

- 기술: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Canvas 2D
- 이 저장소는 **프론트엔드 학습용**으로 정리되어 있습니다.
  모든 코드에 한글 주석이 달려 있고, `docs/`에 상세한 학습 문서가 있어요.

## 실행하기

```bash
npm install   # 처음 한 번만
npm run dev   # 개발 서버 → http://localhost:3000
```

| 명령어 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (저장하면 즉시 반영) |
| `npm run build` | 제품용 빌드 + 타입 검사 |
| `npm run start` | 빌드 결과물로 서버 실행 |
| `npm run lint` | 코드 검사 |

## 📚 공부하러 가기

**[`docs/README.md`](./docs/README.md)** 에서 시작하세요. 초급자를 위한
한글 학습 문서 10편이 읽는 순서대로 정리되어 있습니다 — 프로젝트 구조부터
JS/TS 문법, React, Next.js, Canvas, 게임 루프 수학, 손그림 렌더링의 비밀,
그리고 직접 해보는 실습 과제까지.

## 폴더 한눈에 보기

```
app/
├── page.tsx          첫 화면 "/"
├── play/             게임 화면 "/play" (본체: joops-game.tsx)
├── components/       첫 화면 부품 (배경 데모, 최고 기록)
└── lib/              게임 부품 창고 (손그림 펜, 쓰레기, 마스코트, 소리…)
docs/                 한글 학습 문서 시리즈 ← 여기부터!
```
