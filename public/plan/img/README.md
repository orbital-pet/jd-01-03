# plan/img — 조종 미니게임 SVG 자산

`/play`(수동 조종 미니게임)에서 캔버스에 `drawImage`로 그리는 SVG들입니다.
아트는 **`satellite_pet_svg_pack`** 을 통째로 `pack/` 아래에 두고, 브라우저가
`/plan/img/pack/...` 경로로 서빙합니다. 경로 헬퍼·이미지 캐시는
`app/lib/pilot-sprites.ts`, 게임 로직은 `app/play/joops-game.tsx`에 있습니다.

로드에 실패하면 게임은 멈추지 않고 임시 도형(폴백)을 대신 그립니다.

## 게임에서 쓰는 매핑

| 게임 요소 | 팩 자산 |
|---|---|
| 우주선(펫) · 진화 3단계 | `characters/pet_stage1_baby` → `pet_stage2_junior` → `pet_stage3_magnet` |
| 펫 표정(상태별) | `characters/emotions/<펫>__{happy,low_battery,sulky,hibernate,data_full}` |
| 보조 드론(동행) | `characters/support_drone` (+ emotions) |
| 작은 잔해 | `debris/{chip,nut,antenna_piece}` |
| 중간 잔해 | `debris/{bolt,gear}` |
| 큰 잔해(고 kg) | `debris/solar_fragment` |
| 연료 셀 | `debris/fuel_tank` |
| 위험물 | `effects/fx_alert` (⚠) |
| 획득·피격·자기장·Zzz·진화 이펙트 | `effects/{fx_collect_ring,fx_sparkle,fx_heart_pop,fx_magnet_field,fx_zzz}`, `ui/evo_crystal` |
| HUD 아이콘 | `ui/{stat_battery,coin_scrap}` |
| 타이틀 제스처 힌트 | `ui/gesture_drag` |
| 배경(cover) | `background/bg_space_portrait` |

## 상태 → 표정

- 표류(연료 0): `hibernate` · 피격 무적: `sulky` · 저연료(<25%): `low_battery`
- 방금 획득: `data_full` · 분사 중: `happy` · 그 외: 기본 포즈

## 진화

kg 60 → 2단계, kg 150 → 3단계(자석형). 진화하면 펫이 커지고 자석 범위가 넓어집니다.

> 팩에는 `pet_stage3_net/laser`, `risk_*`, `logbook` 등 이 게임 모드에 안 쓰는 자산도
> 있습니다(스킨/모드 확장 여지). 크기·판정은 `joops-game.tsx`의 `KIND_STAT`/`STAGE_*`에서 조절.
