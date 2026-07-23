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
6. BGM 노드를 **재생 경로가 하나만 남도록** 정리 (bootstrap JSON 안 2곳, 같은 노드가 두 번 등장)
   - `files[0].url` → `custom/bgm.mp4`
   - `hlsManifestUrl` **키 자체를 삭제**, `dashVideoFiles`·`dashAudioFiles` → 빈 배열
   - `durationSeconds` → 실제 음원 길이(255.894). 원래 값은 이 노드가 예전에 담고 있던 102초 영상의 길이였음

> **왜 대체 소스를 전부 지웠나 — 아이폰에서 음악이 안 나오던 원인**
> Safari는 HLS를 네이티브로 우선하는 유일한 엔진입니다. 부모 매니페스트
> (`_assets/video/7eb447….m3u`)는 미러링됐지만 **그 안이 참조하는 하위 매니페스트 5개는
> 애초에 캡처되지 않아 전부 404**입니다. 그래서 Safari는 부모를 받고 → 하위에서 실패 →
> `MEDIA_ERR_SRC_NOT_SUPPORTED` → 플레이어가 재생 버튼 대신 **다시하기 아이콘**을 띄웠습니다.
> `bgm.mp4`는 요청조차 하지 않습니다. Chrome은 HLS를 쓰지 않으므로 이 문제를 영영 잡을 수
> 없었습니다 — **미디어 관련 변경은 반드시 WebKit으로도 확인할 것**
> (`npx playwright install webkit` 후 headless로 실행하면 창이 뜨지 않습니다).
> 대체 소스를 지우면 원본 음원이 재생될 여지도 함께 사라집니다.

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
| `scroll.css` | 스크롤 컨테이너가 위·아래 끝을 넘어 튕기는(rubber-band) 것 차단 (`overscroll-behavior: none`). iOS 16 미만은 이 속성을 무시함. 데스크톱 Chrome은 애초에 rubber-band가 없어 **계산된 스타일만 확인**했고 실기기(아이폰) 검증은 아직 못 함 |
| `bgm.js` | 스크롤로 섹션이 화면 밖에 나가면 런타임이 영상을 일시정지하는데, 이 영상이 곧 BGM이라 음악이 끊깁니다. 그 일시정지만 되돌립니다. **사용자가 컨트롤을 눌러 멈춘 경우**(직전 700ms 안의 신뢰된 탭)와 **페이지가 백그라운드로 간 경우**(`visibilityState`)는 그대로 둡니다. 이미 `play`된 요소에만 적용되므로 자동재생을 만들지 않습니다 |
| `bgm.mp4` | 교체된 배경음악. Canva가 이 노드를 **비디오로 모델링**해서 순수 오디오를 받지 않기 때문에 mp3가 아닌 mp4여야 하고, 그래서 비디오 트랙이 붙어 있습니다(화면에는 절대 그려지지 않음). 인코딩은 **Canva가 직접 내보내는 렌디션과 같은 형태**로 맞춥니다 — 360×640 H.264 High@3.1, 30fps, 정기 키프레임, AAC 192kbps 44.1kHz, `+faststart`. iOS는 특이한 비디오 트랙에 Chrome보다 훨씬 까다로우므로 1fps 같은 변칙 인코딩은 피할 것 |

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
