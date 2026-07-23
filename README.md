# 근상 · 수민 모바일 청첩장

Canva로 제작된 모바일 청첩장을 정적 사이트로 미러링해 GitHub Pages로 서비스합니다.

- **라이브**: https://lyg2798.github.io/kmong-7500711/
- 페이지: `/`(커버) → `/main-page`(본문) → `/address-collection`(참석여부)

## 구조

| 파일/폴더 | 역할 |
|---|---|
| `index.html`, `main-page.html`, `address-collection.html` | 페이지 문서 (Pages의 `.html` 자동 매칭으로 `/main-page` 같은 확장자 없는 주소 서빙) |
| `_assets/` | 원본 자산 전체 (JS/CSS/폰트/이미지/영상/BGM) — 수정 금지 |
| `_footer.html`, `_online.html` | 런타임이 fetch하는 `_footer`, `_online` 엔드포인트의 정적 스텁 |
| `.nojekyll` | Jekyll이 `_assets` 등 언더스코어 경로를 제외하는 것 방지 (삭제 금지) |

## 원본 대비 수정 사항 (HTML 3개 문서만, 자산은 무수정)

1. `<base href="/kmong-7500711/">` — 서브패스 배포에서 자산 로딩·SPA 라우팅이 동작하기 위한 필수 수정
2. `og:image` URL을 이 도메인으로 교체 (카카오톡 등 공유 미리보기)
3. 문서 끝 폴백 스크립트 — 참석여부(RSVP) 폼 위젯은 Canva 백엔드가 자기 도메인 외 임베드를 CSP로 차단하므로, 위젯 iframe을 무력화(`about:blank` + 숨김)하고 같은 자리에 "참석여부 입력하기" 패널(원본 Canva 사이트의 참석여부 페이지를 새 창으로 엶)을 표시. 응답은 기존처럼 Canva 응답함에 수집됨.

## 업데이트 방법

파일 수정 → `main`에 push → GitHub Pages가 자동 재배포 (1~2분).
푸시 권한: `lyg2798` 계정 (`gh auth switch --user lyg2798`).

## 알려진 동작 (무해)

- 콘솔의 `Embed fetcher is not set` 경고, `/_online` 404, iframe sandbox 정보성 경고 — Canva 익스포트/폴백 구조상 나타나는 무해 항목
- 참석여부 폼의 실제 제출은 원본 Canva 사이트가 게시 상태여야 동작함
