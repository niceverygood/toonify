# Toonify

> Bottle Inc. / 한승수 — 1인 빌더용 AI 웹툰 자동 생성 도구
>
> 코드 저장소·내부 디렉토리 이름은 초기 코드네임 `webtoon-studio` 그대로 유지됩니다 (브랜딩만 Toonify로 변경).

캐릭터 사진 1-3장을 등록하면 단편 스토리를 입력했을 때 캐릭터 일관성을 유지한 세로 스크롤 웹툰을 자동으로 생성하는 풀-프론트엔드 웹앱입니다. 모든 AI 호출은 사용자 본인의 Gemini API 키로 브라우저에서 직접 이루어집니다.

## 주요 기능

- 🎭 **캐릭터 등록**: 이름·설명·참조 이미지 1-3장 → IndexedDB 보관, 모든 컷에서 동일 인물로 인식
- 📝 **스토리 → 컷 자동 분할**: Gemini 2.5 Flash가 한국어 스토리를 N개의 컷별 영문 프롬프트로 변환
- 🎨 **컷 이미지 생성**: Gemini 2.5 Flash Image가 9:16 세로 비율 컷을 동시 3개씩 병렬 생성
- ♻️ **개별 재생성/편집**: 마음에 안 드는 컷은 그 컷만 재생성, 또는 프롬프트 직접 편집 후 재생성
- 🖼️ **합치기**: Canvas로 모든 컷을 세로로 이어붙여 PNG 한 장으로 출력
- 💾 **자동 저장**: IndexedDB에 5초 debounce로 자동 저장, 새로고침/탭 종료 후에도 복원
- 📁 **프로젝트 관리**: 헤더 드롭다운에서 새 프로젝트 / 불러오기 / 이름 변경 / 삭제

## 기술 스택

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript strict**
- **Tailwind CSS v4** + **shadcn/ui**
- **Zustand** 상태 관리, **Dexie** (IndexedDB 래퍼)
- **@google/genai** SDK (Gemini 2.5 Flash + 2.5 Flash Image)

## 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. Gemini API 키 발급

[Google AI Studio](https://aistudio.google.com/apikey)에서 API 키를 발급받습니다. 무료 티어로도 시작할 수 있습니다 (분당 호출 수 제한 있음).

### 3. 개발 서버 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) 접속 → 첫 진입 시 API 키 입력 모달이 강제로 표시됩니다.

### 4. 사용 흐름

1. API 키 입력 → 키 검증 (`gemini-2.5-flash`로 1토큰 핑 테스트)
2. 좌측 사이드바 [+ 추가]로 캐릭터 2-5명 등록 (각 1-3장 참조 이미지, 1024px로 자동 리사이즈)
3. 메인 영역에 한국어 스토리 입력, 컷 수(10-60)·스타일 선택
4. [✨ 생성 시작] → 컷별 영문 프롬프트 자동 생성 → 즉시 동시 3개씩 이미지 생성 시작
5. 갤러리에서 각 컷 [다운로드] / [재생성] / [편집] 가능
6. [🖼️ 합치기] → 미리보기 → PNG 다운로드 (`webtoon_{title}_{YYYYMMDD-HHmm}.png`)

## 비용 가이드

| 항목 | 비용 |
|---|---|
| 텍스트 호출 1회 (스토리 → N컷 프롬프트) | 무시 가능 |
| 이미지 1컷 (9:16) | 약 $0.04 / ₩55 |
| 30컷 1회 생성 | 약 ₩1,650 |

UI에서 컷 수를 선택할 때 예상 비용이 실시간으로 표시됩니다.

## 환경 변수

이 프로젝트는 사용자 본인의 API 키를 브라우저 localStorage에만 저장하므로, **환경 변수 없이 그대로 Vercel에 배포할 수 있습니다.**

개발용 옵션 (`.env.local.example` 참고):

```
# 더미 이미지로 무료 테스트 (개발 비용 절감용)
NEXT_PUBLIC_MOCK_IMAGES=true
```

`NEXT_PUBLIC_MOCK_IMAGES=true` 일 때는 실제 Gemini를 호출하지 않고 캔버스로 만든 컬러 그라디언트 placeholder 이미지를 반환합니다. 갤러리·재생성·합치기 UX를 무료로 검증할 때 사용하세요.

## Vercel 배포

```bash
# Vercel CLI 사용 시
npx vercel
```

또는 Vercel 대시보드에서 GitHub 저장소를 import하면 끝입니다. 빌드 명령은 기본값(`next build`)으로 충분하며, **기본 기능은 환경변수 없이도 동작**합니다.

배포 후에도 사용자별 API 키가 각자 브라우저에 저장되므로 본인 키로 즉시 사용 가능합니다.

### 공유 링크 기능 (선택)

[🔗 공유 링크 만들기] 버튼이 작동하려면 **Vercel Blob 스토리지**가 필요합니다.

1. Vercel 대시보드 → 프로젝트 → Storage → Create Database → **Blob**
2. 자동으로 `BLOB_READ_WRITE_TOKEN` 환경변수가 등록됨 → 다음 배포부터 적용
3. 로컬 dev에서 테스트하려면:
   ```bash
   vercel link        # 프로젝트 연결
   vercel env pull    # .env.local로 환경변수 가져오기
   npm run dev
   ```

Blob을 활성화하지 않아도 **다른 모든 기능은 정상 동작**합니다 (공유 링크 버튼만 클릭 시 친절한 에러 메시지).

#### 비용

Vercel Blob 무료 티어: 1GB 저장 + 1GB egress / 월. 30컷 webtoon 한 번 공유 시 ~30-50MB. 클라이언트 검토용으로 한 달에 수십 번 공유해도 무료 티어로 충분.

## 프로젝트 구조

```
webtoon-studio/
├── app/
│   ├── layout.tsx              # html lang="ko", Toaster, 폰트
│   ├── page.tsx                # AppShell 단일 진입점
│   └── globals.css             # Tailwind + BoBi 블루(#1a56db) primary
├── components/
│   ├── app-shell.tsx           # 클라이언트 셸 (헤더+사이드바+메인+모달)
│   ├── app-header.tsx          # BoBi 블루 헤더, 프로젝트 스위처, 설정
│   ├── api-key-modal.tsx       # 첫 진입/설정에서 사용
│   ├── project-switcher.tsx    # 새/불러오기/이름변경/삭제
│   ├── character/              # 사이드바 캐릭터 목록
│   ├── story/                  # 스토리 입력 + 디버그 패널
│   ├── gallery/                # 컷 카드 + 진행률 + 편집 다이얼로그
│   └── stitch/                 # 합치기 버튼 + 미리보기
├── lib/
│   ├── gemini/
│   │   ├── client.ts           # GoogleGenAI 초기화 + verifyApiKey
│   │   ├── models.ts           # 모델명 + 9:16 + 비용 상수
│   │   ├── story-to-panels.ts  # responseSchema 강제 JSON 출력
│   │   └── generate-image.ts   # 9:16 + Modality.IMAGE + 429 재시도 + mock
│   ├── generation-runner.ts    # pLimit(3) 병렬 오케스트레이션
│   ├── stitch.ts               # Canvas 세로 합성
│   ├── storage/
│   │   ├── db.ts               # Dexie schema
│   │   └── api-key.ts          # localStorage 래퍼
│   ├── hooks/
│   │   └── use-project-autosave.ts # 5초 debounce
│   ├── store.ts                # Zustand 스토어
│   ├── types.ts                # Character/PanelPrompt/Panel/Project
│   └── utils.ts                # cn, pLimit, blob/base64, resize, sleep
└── public/
```

## 알려진 제약사항

1. **다중 캐릭터 한 컷**: 같은 컷에 김지영 + 박 부장처럼 두 명 이상이 등장하면 일관성이 떨어질 수 있습니다. 시스템 프롬프트에서 "Prefer single-character panels with shot variety over crowded multi-character panels"를 통해 모델이 가능한 한 시점 변환으로 분리하도록 유도합니다.
2. **이미지 텍스트**: Gemini가 한국어 텍스트를 이미지에 그릴 때 깨짐이 잦습니다. 모든 컷 프롬프트에 "No text, no speech bubbles, no written language"를 강제합니다. 말풍선 오버레이는 V2에서 다룹니다.
3. **합치기 한계**: 800 × 30,000 같은 매우 긴 PNG는 일부 브라우저의 `canvas.toBlob`이 실패할 수 있습니다. 50컷 초과 시 UI에 경고가 표시됩니다.
4. **무료 티어 rate limit**: Gemini 무료 티어는 분당 호출 수 제한이 있습니다. 동시 3개로 제한 + 429 발생 시 5초 대기 후 자동 재시도(최대 3회).
5. **API 키 보안**: 키는 브라우저 localStorage에만 저장되며 어떤 서버로도 전송되지 않습니다. 공용 PC에서 사용 후에는 헤더 ⚙️ → [API 키 삭제]를 눌러 제거하세요.

## V2 후보

스펙 Section 14 참고. 우선순위:

1. 말풍선 자동 배치 (SVG/Canvas 오버레이, 드래그로 위치 조정)
2. 컷별 마스크 + inpaint 재생성
3. 캐릭터 라이브러리 (프로젝트 간 공유)
4. PSD 출력 (작가 후작업용 레이어 분리)
5. TTS 더빙 + Shorts/Reels용 모션그래픽

## 라이선스

내부용 프로토타입입니다.

— Bottle Inc. © 2026
