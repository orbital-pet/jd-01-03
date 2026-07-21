# plan/img — 조종 미니게임 SVG 자산

`/play`(수동 조종 미니게임)에서 캔버스에 `drawImage`로 그리는 SVG들입니다.
브라우저는 이 폴더를 `/plan/img/<파일명>` 경로로 서빙합니다.

현재 아트는 **`satellite_pet_svg_pack`** (카와이 스티커 스타일, 외곽선 `#3E4A63`)에서
가져왔습니다. 파일명만 유지하면 자유롭게 교체할 수 있고, 로드에 실패하면 게임은
멈추지 않고 임시 도형(폴백)을 대신 그립니다. (경로 매핑: `app/lib/pilot-sprites.ts`)

| 파일 | 역할 | 원본(팩) |
|---|---|---|
| `ship.svg` | 조종하는 우주선(펫) | `characters/pet_stage1_baby.svg` (256×256) |
| `debris-chip.svg` | 작은 잔해 (2~4kg) | `debris/chip.svg` (96×96) |
| `debris-bolt.svg` | 중간 잔해 (5~9kg) | `debris/bolt.svg` |
| `debris-tank.svg` | 큰 잔해 (15~25kg) | `debris/solar_fragment.svg` |
| `hazard.svg` | 위험물 — 닿으면 연료 감소 | `effects/fx_alert.svg` (⚠ 경고 삼각형) |
| `fuel.svg` | 연료 셀 — 연료 리필/재점화 | `debris/fuel_tank.svg` |
| `bg.svg` | 배경 (cover로 화면 채움) | `background/bg_space_portrait.svg` (1080×1920) |

> 그림 크기(px)와 충돌 반지름은 `app/play/joops-game.tsx`의 `KIND_STAT`에서 조절합니다.
> 팩에는 감정 변형·이펙트·UI 아이콘 등 더 많은 자산이 있어, 스킨/이펙트로 확장 가능합니다.
