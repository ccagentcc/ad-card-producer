# 큐레이션 클럽 — 광고 카드뉴스 프로덕션 툴

## 프로젝트 개요
인스타그램 큐레이션 채널 "큐레이션 클럽"의 광고 카드뉴스 제작 자동화 도구.
광고주 가이드 파일(텍스트/이미지/영상) 입력 → AI 캡션 생성 → Figma 템플릿 자동 채우기.

## 핵심 워크플로우
1. 에디터가 광고주 브리프 파일 + 미디어 에셋을 드롭
2. Claude API가 채널톤 캡션 자동 생성 (아이즈매거진 스타일)
3. Figma Plugin API로 템플릿 프레임 복제 + 텍스트/이미지 자동 교체
4. 에디터 검수 → Export → 게시

## 기술 스택
- React (Vite)
- Anthropic Claude API (claude-sonnet-4-20250514)
- Figma Plugin API (use_figma MCP 또는 REST API)
- 스타일: Pretendard 폰트 + DM Mono, 다크 테마 (#0c0c0b 베이스, #c8ff00 액센트)

## 캡션 생성 규칙
- 짧고 감각적. 3~5문장. 쉬운 어휘.
- 문장 종결 혼용 (~입니다/~인데요/~죠)
- 이모지 최소한, 과도한 감탄사 배제
- 광고주 원문 그대로 쓰지 않음. 큐레이터가 직접 고른 톤.
- 슬라이드 3~6장 (hook → info → emotion → cta)

## Figma 템플릿 레이어 네이밍
자동 교체 대상 레이어는 #prefix 사용:
- `#title` / `#제목` — 슬라이드 제목
- `#body` / `#본문` — 본문 카피
- `#cta` — CTA 텍스트
- `#subtitle` / `#서브` — 일시/장소
- `#brand` / `#브랜드` — 브랜드명
- `#slide-number` / `#번호` — "1/5" 형태
- `#image-main` — 메인 이미지 교체

## 미디어 파일 지원
이미지: jpg, png, avif, heic, heif, webp, svg, tiff, bmp, gif
영상: mp4, mov, avi, mkv, wmv, flv, m4v, webm

## 코딩 규칙
- 한국어 UI, 코드 주석은 영어 가능
- 컴포넌트는 함수형, hooks 사용
- CSS-in-JS (인라인 스타일) 유지
- 외부 의존성 최소화

## 커맨드
- `npm run dev` — 개발 서버
- `npm run build` — 빌드

## 관련 파일
- 현재 React 앱 소스: `src/App.jsx`
- Figma 스크립트 생성 로직: `src/figma-script.js`
- 캡션 생성 프롬프트: `src/prompts.js`
