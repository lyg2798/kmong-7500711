# 근상 · 수민 모바일 청첩장

Canva로 제작된 모바일 청첩장을 정적 사이트로 미러링해 GitHub Pages로 서비스합니다.

- **라이브**: https://lyg2798.github.io/kmong-7500711/
- 페이지: `/`(커버) → `/main-page`(본문) → `/address-collection`(참석여부)

## 구조

| 파일/폴더 | 역할 |
|---|---|
| `index.html`, `main-page.html`, `address-collection.html` | 페이지 문서 (Pages의 `.html` 자동 매칭으로 `/main-page` 같은 확장자 없는 주소 서빙) |
| `_assets/` | 원본 자산 전체 (JS/CSS/폰트/이미지/영상/BGM) — 수정 금지 |
| `custom/` | 이 프로젝트에서 추가한 커스터마이즈 (아래 참고) |
| `_footer.html`, `_online.html` | 런타임이 fetch하는 `_footer`, `_online` 엔드포인트의 정적 스텁 |
| `.nojekyll` | Jekyll이 `_assets` 등 언더스코어 경로를 제외하는 것 방지 (삭제 금지) |

**원칙**: `_assets/`는 절대 건드리지 않습니다. 모든 변경은 `custom/`에 새 파일을 만들고
HTML 3개 문서에 태그 한 줄을 더하는 방식으로만 합니다. 원본 충실도를 지키고, 언제든
태그만 빼면 원본 그대로 돌아갈 수 있게 하기 위해서입니다.

## 원본 대비 수정 사항

### HTML 3개 문서 (`index` / `main-page` / `address-collection` 전부 동일하게)

1. `<base href="/kmong-7500711/">` — 서브패스 배포에서 자산 로딩·SPA 라우팅이 동작하기 위한 필수 수정
2. `og:image` URL을 이 도메인으로 교체 (카카오톡 등 공유 미리보기)
3. 문서 끝 폴백 스크립트 — 참석여부(RSVP) 폼 위젯은 Canva 백엔드가 자기 도메인 외 임베드를 CSP로 차단하므로, 위젯 iframe을 무력화(`about:blank` + 숨김)하고 같은 자리에 "참석여부 입력하기" 패널(원본 Canva 사이트의 참석여부 페이지를 새 창으로 엶)을 표시. 응답은 기존처럼 Canva 응답함에 수집됨.
4. 스크롤바 숨김 `<style>` (`scrollbar-width: none` + `::-webkit-scrollbar`) — 스크롤 자체는 그대로 동작
5. `custom/` 모듈을 불러오는 `<link>` / `<script defer>` 태그
6. BGM 노드의 `files[0].url`을 `custom/bgm.mp4`로 교체 (bootstrap JSON 안 2곳, 같은 노드가 두 번 등장)

> ⚠️ **BGM — 아이폰 미검증 항목** — 6번에서 바꾼 것은 `files[0].url` 하나뿐입니다. 같은 노드의
> `dashAudioFiles[0]`, `hlsManifestUrl`, `dashVideoFiles`는 **여전히 원본 음원**(`_assets/video/…`)을
> 가리킵니다. Chrome에서는 라이브 기준으로 새 곡이 실제 재생되는 것까지 확인했지만
> (오디오 디코딩 바이트 측정), **Safari는 HLS를 네이티브로 선호하는 유일한 브라우저라
> 검증에서 빠져 있습니다.** Safari가 HLS 경로를 타면 **아이폰에서만 원본 음악이 재생**됩니다.
> 하객 상당수가 아이폰 + 카카오톡 인앱 브라우저이므로, 아이폰에서 "소리가 나는가"뿐 아니라
> **"어느 곡이 나오는가"**를 직접 들어봐야 합니다. 옛 음악이 들리면 `hlsManifestUrl`과
> `dashAudioFiles`를 비우거나 제거해 런타임이 `files[0]`로 떨어지게 하고 다시 확인하세요.

### 그 외

- `_footer.html`을 **0바이트로 비움** — 런타임이 이 파일 내용을 그대로 주입하므로,
  비우면 하단의 Canva 배너("Terms & Support / Privacy Policy / Designed with Canva")가 사라짐

### `custom/` 모듈

| 파일 | 역할 |
|---|---|
| `gallery.js` + `gallery.css` | GALLERY 섹션의 사진 콜라주를 **프리뷰 + 가로 썸네일 스트립 + 풀스크린 라이트박스**로 교체. 라이트박스에서 좌우 화살표·스와이프로 이동. 줄어든 만큼 섹션 높이도 함께 축소하고, 구분선 아래 20px(디자인이 LOCATION 섹션에서 쓰는 간격)을 띄움 |
| `align.js` + `align.css` | Canva가 중앙에서 어긋나게 배치한 텍스트 3곳(마음 전하실 곳 / INFORMATION 본문 / 지하철·주차 안내) 보정. 지하철·주차만 줄을 **왼쪽 정렬**하고 덩어리 자체는 중앙에 둠 |
| `invitation.js` | Invitation 섹션의 영문 템플릿 문구를 국문 인사말로 교체하고, 늘어난 높이만큼 아래 요소를 밀어냄. 늘어난 높이는 영상 컨트롤 오버레이 레이어에도 같이 반영 (아래 참고) |
| `heading.js` | INVITATION 제목만 프레임이 좁아 다른 제목의 46% 크기로 렌더되던 것을, 형제 제목들이 쓰는 배율을 읽어 같은 크기로 맞추고 섹션 중앙선에 정렬 |
| `scroll.css` | 스크롤 컨테이너가 위·아래 끝을 넘어 튕기는(rubber-band) 것 차단 (`overscroll-behavior: none`) |
| `bgm.mp4` | 교체된 배경음악 (AAC 192kbps + 정지 프레임 비디오 트랙. Canva 런타임이 `<video>`로 재생하므로 mp3가 아닌 mp4여야 함) |

**JS 모듈을 손볼 때 반드시 알아야 할 것** — 전부 어겼을 때 실제로 깨졌던 항목입니다.

- Canva 런타임은 화면 크기가 바뀌면 관련 inline style을 **통째로 다시 씁니다.** 그래서 JS 모듈은
  모두 `MutationObserver`로 상시 재적용합니다. 1회성으로 적용하면 리사이즈 순간 사라집니다.
- "이미 내가 적용한 값인가"를 판정할 때는 **반드시 숫자로 비교**하세요(epsilon 사용).
  `transform`/`height` 문자열을 비교하면 브라우저가 값을 재직렬화하기 때문에 방금 내가 쓴 값도
  "내 것이 아님"으로 판정되어 보정이 무한 누적됩니다 (768px 폭에서 100만px 밀림이 실제로 발생).
- **섹션 높이를 바꾸면 `.QhExXw` 오버레이 높이도 같이 바꿔야 합니다.** Canva는 영상 재생 컨트롤을
  캔버스와 별개인 이 레이어에 그리는데, 이 레이어는 섹션 **아래쪽**에 붙어 있고 높이가 캔버스와
  같을 때만 컨트롤이 제 그림 위에 놓입니다. 캔버스만 N만큼 키우면 그 섹션의 모든 컨트롤이 N만큼
  아래로 밀립니다 (LP의 재생 버튼이 아래 사진 위에 떠 있던 원인).

## 업데이트 방법

파일 수정 → 로컬 확인 → `main`에 push → GitHub Pages가 자동 재배포 (1~2분).
푸시 권한: `lyg2798` 계정 (`gh auth switch --user lyg2798`).

로컬 확인은 그냥 파일을 열면 안 되고, **서브패스(`/kmong-7500711/`)와 확장자 없는 주소**를
GitHub Pages와 똑같이 처리하는 서버로 띄워야 합니다. 이 둘 중 하나라도 다르면 `<base href>`
때문에 로컬에서만 백지가 되거나, 반대로 로컬에서만 멀쩡해 보입니다.
(작업 폴더의 `reference/tools/pages_server.py`가 이 동작을 재현합니다.)

```bash
python3 ../reference/tools/pages_server.py "$(pwd)" /kmong-7500711 8480
# → http://127.0.0.1:8480/kmong-7500711/
```

배포 확인:

```bash
gh api repos/lyg2798/kmong-7500711/pages/builds/latest --jq '{status, commit: .commit[0:7]}'
```

## 알려진 동작 (무해)

- 콘솔의 `Embed fetcher is not set` 경고, `/_online` 404, iframe sandbox 정보성 경고 — Canva 익스포트/폴백 구조상 나타나는 무해 항목
- 참석여부 폼의 실제 제출은 원본 Canva 사이트가 게시 상태여야 동작함

## 커스텀 도메인을 붙이게 되면

지금 설정은 `lyg2798.github.io/kmong-7500711/` 라는 서브패스 전용입니다. 루트 도메인으로 옮길 때는
세 군데를 같이 고쳐야 합니다 — 하나라도 빠뜨리면 사이트가 백지가 되거나 공유 미리보기가 깨집니다.

1. HTML 3개 문서의 `<base href>`를 `/`로 되돌리기
2. `og:image` URL을 새 도메인으로 교체
3. 저장소 Pages 설정에 커스텀 도메인 등록 (`CNAME`)
