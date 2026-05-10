# Toonify — Claude Code 작업 명세서
> **서비스 이름**: Toonify (사용자 페이싱 브랜드)
> **프로젝트 코드네임**: webtoon-studio (디렉토리·DB·npm package id로 그대로 유지)
> **작성자**: 한승수 / Bottle Inc.
> **목적**: 1인 빌더용 AI 웹툰 자동 생성 도구 MVP
> **이 문서**: Claude Code가 처음부터 끝까지 단계별로 실행할 수 있는 구현 명세서

---

## 0. 프로젝트 컨텍스트

Bottle Inc.의 BoBi(보험설계사 AI 비서) 마케팅 콘텐츠 제작을 위해, 단편 스토리를 입력하면 캐릭터 일관성을 유지한 세로 스크롤 웹툰을 자동 생성하는 웹앱을 만든다.

핵심 가치:
- 캐릭터 사진 1-3장만 등록하면 N컷 전체에서 동일 인물로 인식되는 일관성 유지
- 스토리 텍스트 → 컷별 프롬프트 자동 분할
- 개별 컷 다운로드 + 재생성
- "합치기" 버튼 한 번에 세로 스트립 PNG 한 장으로 저장

향후 확장 가능성: Bottle의 별도 B2C 제품 라인업 후보. MVP 단계에서는 한승수 본인이 BoBi 마케팅 자산 생산에 직접 사용.

---

## 1. 사용자 시나리오 (반드시 구현 전 숙지)

```
1) 사용자가 사이트 접속 → 첫 방문 시 API 키 입력 모달
   (Gemini API 키. localStorage 저장. "이 키는 브라우저에만 저장되며 서버로 전송되지 않습니다" 명시)

2) 좌측 사이드바: "캐릭터" 섹션
   [+ 캐릭터 추가] 버튼 클릭 → 모달:
     - 이름 (예: "김지영")
     - 역할 설명 (예: "38세, 보험설계사, 부드러운 미소")
     - 참조 이미지 1-3장 업로드 (드래그&드롭 지원)
   캐릭터를 2-5명 정도 등록 가능

3) 메인 영역:
   - "스토리" 큰 textarea (한국어 가능, 길어도 됨)
   - "컷 수" 슬라이더 (10-60, 기본 30)
   - "스타일" 드롭다운 ("모던 슬라이스 오브 라이프" / "부드러운 일러스트" / "선명한 만화" / "커스텀 입력")
   - [생성 시작] 버튼

4) 생성 시작 클릭 →
   Step A: 스토리 + 캐릭터 정보 → Gemini로 컷별 영문 프롬프트 N개 생성 (병렬 1회)
   Step B: 각 프롬프트 + 등장 캐릭터의 참조 이미지를 Gemini 2.5 Flash Image로 전송
   Step C: 동시 3개씩 병렬 처리, 진행률 표시 (12/30 컷 생성 중...)
   Step D: 완성된 컷이 갤러리에 실시간 추가됨

5) 갤러리: 각 컷 카드
   - 이미지
   - 그 아래 컷 번호 + 프롬프트 (접기 가능)
   - [재생성] [다운로드] [편집] 버튼
   - "편집" 클릭 시 프롬프트 직접 수정 → 재생성

6) 모든 컷 완료 후, 페이지 하단:
   [🎨 웹툰으로 합치기] 버튼
   클릭 → Canvas로 세로 합성 → PNG 다운로드
   파일명: webtoon_{타임스탬프}.png

7) 새로고침해도 작업물 유지 (IndexedDB 자동 저장)
   상단에 "프로젝트" 드롭다운으로 이전 작업 불러오기 가능
```

---

## 2. 기술 스택 (확정 — 변경 금지)

| 영역 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | **Next.js 15** (App Router) | 풀스택, Vercel 배포 무료 |
| 언어 | **TypeScript** (strict) | 타입 안전성 |
| UI 라이브러리 | **React 19** + **Tailwind CSS v4** | 표준 |
| 컴포넌트 | **shadcn/ui** | 빠른 셋업 |
| 아이콘 | **lucide-react** | shadcn 기본 |
| 상태 관리 | **Zustand** | Redux보다 가벼움 |
| 로컬 저장소 | **Dexie** (IndexedDB 래퍼) | 이미지 blob 저장 가능 |
| 이미지 생성 | **Google Gemini 2.5 Flash Image** | 캐릭터 일관성 최강 |
| 텍스트 (스토리→프롬프트) | **Google Gemini 2.5 Flash** | 같은 API 키 재사용 |
| 합성 | **HTML5 Canvas API** (브라우저 네이티브) | 외부 의존성 불필요 |
| 다운로드 | **file-saver** | 크로스브라우저 |
| 배포 | **Vercel** (무료 티어) | Next.js 최적 |

**서버리스 풀프론트엔드 모드**: 모든 API 호출은 브라우저에서 직접 Google AI에 전송. 사용자 본인 API 키 사용. 자체 서버 비용 0원.

---

## 3. 프로젝트 구조

```
webtoon-studio/
├── app/
│   ├── layout.tsx              # 루트 레이아웃 (테마, 폰트)
│   ├── page.tsx                # 메인 페이지 (단일 페이지 앱)
│   └── globals.css             # Tailwind + 커스텀
├── components/
│   ├── ui/                     # shadcn 컴포넌트
│   ├── api-key-modal.tsx       # 첫 진입 시 API 키 입력
│   ├── character/
│   │   ├── character-list.tsx  # 사이드바 캐릭터 목록
│   │   ├── character-card.tsx  # 개별 캐릭터 카드
│   │   └── character-modal.tsx # 추가/편집 모달
│   ├── story/
│   │   ├── story-input.tsx     # 스토리 textarea + 설정
│   │   └── style-selector.tsx
│   ├── gallery/
│   │   ├── panel-gallery.tsx   # 컷 갤러리 그리드
│   │   ├── panel-card.tsx      # 개별 컷 카드
│   │   └── progress-bar.tsx
│   └── stitch/
│       └── stitch-button.tsx
├── lib/
│   ├── gemini/
│   │   ├── client.ts           # Gemini SDK 초기화
│   │   ├── story-to-panels.ts  # 텍스트 모델 호출
│   │   └── generate-image.ts   # 이미지 모델 호출
│   ├── stitch.ts               # Canvas 합성 로직
│   ├── storage/
│   │   ├── db.ts               # Dexie 스키마
│   │   └── api-key.ts          # localStorage 래퍼
│   ├── store.ts                # Zustand 글로벌 상태
│   ├── types.ts                # 공유 TypeScript 타입
│   └── utils.ts                # 헬퍼 (이미지 → base64 등)
├── public/
├── .env.local.example
├── README.md
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

---

## 4. 데이터 모델 (TypeScript)

`lib/types.ts`에 다음 타입 정의:

```typescript
export interface Character {
  id: string;                   // uuid
  name: string;                 // "김지영"
  description: string;          // "38세, 보험설계사..."
  referenceImages: Blob[];      // 1-3장
  createdAt: number;
}

export interface PanelPrompt {
  id: string;
  index: number;                // 컷 번호 (0-base)
  description: string;          // 한국어 장면 설명
  englishPrompt: string;        // 영문 이미지 프롬프트
  characterIds: string[];       // 이 컷에 등장하는 캐릭터
  shotType?: string;            // "와이드샷" "클로즈업" 등
  dialogue?: { speaker: string; text: string }[];
}

export interface Panel {
  id: string;
  promptId: string;
  imageBlob?: Blob;             // 생성 완료된 이미지
  status: 'pending' | 'generating' | 'done' | 'error';
  errorMessage?: string;
  generatedAt?: number;
}

export interface Project {
  id: string;
  title: string;
  story: string;
  panelCount: number;
  style: string;
  characterIds: string[];
  prompts: PanelPrompt[];
  panels: Panel[];
  createdAt: number;
  updatedAt: number;
}
```

---

## 5. UI 와이어프레임

```
┌─────────────────────────────────────────────────────────────┐
│ 🎨 웹툰 스튜디오                          [프로젝트 ▼] [⚙️]    │  ← 헤더
├──────────────┬──────────────────────────────────────────────┤
│              │                                               │
│ 캐릭터        │  📝 스토리                                    │
│              │  ┌──────────────────────────────────────────┐ │
│ [+ 추가]      │  │                                          │ │
│              │  │  (textarea, 한국어)                       │ │
│ ┌──────────┐ │  │                                          │ │
│ │ [사진]    │ │  └──────────────────────────────────────────┘ │
│ │ 김지영    │ │                                               │
│ │ 38세...   │ │  컷 수: [─●──────] 30                         │
│ └──────────┘ │  스타일: [모던 슬라이스 오브 라이프 ▼]            │
│              │                                               │
│ ┌──────────┐ │           [✨ 생성 시작]                       │
│ │ [사진]    │ │                                               │
│ │ 박 부장    │ │  ─────────────────────────────────────────   │
│ │ 47세...   │ │                                               │
│ └──────────┘ │  📦 컷 갤러리 (12/30 생성 중...)               │
│              │                                               │
│              │  ┌──────┐ ┌──────┐ ┌──────┐                   │
│              │  │ 컷 1  │ │ 컷 2  │ │ 컷 3  │                  │
│              │  │ ✅    │ │ ⏳    │ │ ⏳    │                  │
│              │  │ [↓][↻]│ │      │ │      │                  │
│              │  └──────┘ └──────┘ └──────┘                   │
│              │                                               │
│              │  ...                                          │
│              │                                               │
│              │     [🖼️ 웹툰으로 합치기]                       │
└──────────────┴──────────────────────────────────────────────┘

좌측 사이드바: 280px 고정
메인: flex-1
디자인 톤: 깔끔한 흰 배경, 약간의 그레이 보더, 액센트 색상 #1a56db (BoBi 블루)
```

---

## 6. 핵심 기능 명세

### 6.1 캐릭터 관리
- `[+ 캐릭터 추가]` 버튼 → 모달 오픈
- 모달 입력값: 이름 (필수), 설명 (필수), 참조 이미지 1-3장 (필수, 드래그앤드롭 + 클릭)
- 이미지는 클라이언트에서 1024x1024 이내로 리사이즈 후 Blob으로 저장
- IndexedDB에 즉시 저장
- 사이드바에서 클릭 → 편집 모달
- 우클릭/⋮ 메뉴 → 삭제 (확인 팝업)

### 6.2 스토리 → 컷 자동 분할

`lib/gemini/story-to-panels.ts`:
```typescript
async function generatePanelPrompts(input: {
  story: string;
  characters: Character[];
  panelCount: number;
  style: string;
}): Promise<PanelPrompt[]>
```

내부 동작:
1. Gemini 2.5 Flash 텍스트 모델 호출
2. 시스템 프롬프트는 영문, 출력은 JSON 배열 (panelCount개)
3. 각 항목: `{description, englishPrompt, characterIds, shotType, dialogue}`
4. 결과 파싱 → `PanelPrompt[]` 반환

**시스템 프롬프트 (영문, 모델에 그대로 전송):**
```
You are a webtoon storyboard artist. Convert the user's story into exactly {panelCount} panels for a vertical-scroll Korean webtoon.

For each panel, output:
- description: 1-2 sentences in Korean describing the scene
- englishPrompt: A detailed English prompt optimized for Gemini 2.5 Flash Image, including shot type (close-up/medium/wide/POV), lighting, mood, character actions, environment. Style: {style}. Aspect ratio target: 9:16 vertical. Always end with: "modern Korean slice-of-life webtoon style, soft cel-shading, clean line art"
- characterIds: array of character IDs from the provided list that appear in this panel (empty array if no character)
- shotType: one of [extreme close-up, close-up, medium, medium-wide, wide, POV, montage, full panel]
- dialogue: array of {speaker, text} for spoken lines or narration. Use speaker="나레이션" for narration boxes.

Pace the panels: open with establishing context, build emotional beats, end with a memorable closing panel. Distribute key emotional moments as "full panel" shots.

Available characters: {characters JSON}

Output ONLY a JSON array with no markdown wrapper.
```

**중요**: Gemini 응답이 markdown 코드블록으로 감싸진 경우 ` ```json` 제거 처리 필수.

### 6.3 컷별 이미지 생성

`lib/gemini/generate-image.ts`:
```typescript
async function generatePanelImage(input: {
  prompt: PanelPrompt;
  characters: Character[];      // 등장 캐릭터만 필터링해서 전달
  apiKey: string;
}): Promise<Blob>
```

내부 동작:
1. Gemini 2.5 Flash Image 모델 호출
2. 입력 parts:
   - 등장 캐릭터의 참조 이미지를 inline base64로 첨부 (각 캐릭터당 첫 번째 이미지만)
   - 텍스트 파트:
     ```
     [Character reference: {character.name} - {character.description}]
     ...(각 캐릭터별로 반복)

     Generate this webtoon panel maintaining the exact same characters as in the reference images:
     {prompt.englishPrompt}

     CRITICAL: Maintain character facial features, hairstyle, and clothing consistent with the reference images. No text, speech bubbles, or written language in the image.
     ```
3. 응답에서 이미지 파트 추출 → base64 → Blob 변환

**중요 사항**:
- 캐릭터 일관성을 위해 항상 동일한 참조 이미지를 매 컷마다 함께 전송
- "No text in image" 명시 — 말풍선은 후처리(현재 MVP에서는 보류)
- 9:16 종횡비 강제 ("vertical 9:16 aspect ratio" 프롬프트 명시)

**Gemini 2.5 Flash Image API 정확한 호출 형식은 구현 시 반드시 web_search로 최신 docs 확인**:
- https://ai.google.dev/gemini-api/docs/image-generation
- 모델명: `gemini-2.5-flash-image-preview` 또는 후속 버전 (변경 가능성)
- `@google/genai` SDK 사용

### 6.4 갤러리 + 개별 작업

각 PanelCard:
- 이미지 표시 (생성 전: 회색 placeholder + 스피너)
- 컷 번호 + description 텍스트
- 호버 시 actions 표시:
  - **다운로드** (개별 PNG, 파일명: `panel_{index+1}.png`)
  - **재생성** (이 컷만 다시 호출)
  - **편집** (프롬프트 수정 → 재생성)
- 에러 상태: 빨간 보더 + 에러 메시지 + [재시도] 버튼

병렬 처리: 동시 3개까지. `lib/utils.ts`의 `pLimit(3)` 헬퍼 구현.

### 6.5 세로 합성 (웹툰 PNG)

`lib/stitch.ts`:
```typescript
export async function stitchPanels(
  panels: Panel[],
  options?: {
    gap?: number;           // 기본 80px
    background?: string;    // 기본 #FAF8F3
    maxWidth?: number;      // 기본 800px
  }
): Promise<Blob>
```

알고리즘:
1. 모든 panel.imageBlob을 HTMLImageElement로 로드
2. 가장 큰 너비 또는 maxWidth (둘 중 작은 값)을 기준으로 정함
3. 각 이미지를 비율 유지하며 너비 맞춤 → 새 높이 계산
4. 총 높이 = sum(adjustedHeights) + gap * (n-1)
5. Canvas 생성, 배경 채움
6. 각 이미지를 y 좌표 누적하며 그림 (가운데 정렬)
7. `canvas.toBlob('image/png')` → Blob 반환
8. file-saver로 다운로드 트리거

### 6.6 로컬 저장소

`lib/storage/db.ts`:
```typescript
import Dexie, { Table } from 'dexie';

class WebtoonDB extends Dexie {
  characters!: Table<Character, string>;
  projects!: Table<Project, string>;
  panels!: Table<Panel, string>;

  constructor() {
    super('WebtoonStudio');
    this.version(1).stores({
      characters: 'id, name, createdAt',
      projects: 'id, title, createdAt, updatedAt',
      panels: 'id, promptId, status',
    });
  }
}

export const db = new WebtoonDB();
```

자동 저장:
- 캐릭터 추가/수정/삭제 시 즉시
- 프로젝트는 5초마다 debounced 저장
- 컷 생성 완료 시 즉시

복원:
- 페이지 로드 시 마지막 작업 프로젝트 자동 로드
- 헤더 "프로젝트 ▼"에서 과거 프로젝트 불러오기

---

## 7. API 통합 사양

### 7.1 API 키 처리
- 사용자가 Google AI Studio에서 발급한 Gemini API 키 입력
- `localStorage.setItem('gemini_api_key', key)` 저장
- 첫 방문 시 모달 강제 표시
- 헤더 ⚙️에서 변경 가능
- 절대 백엔드/Vercel로 전송하지 않음 (이 프로젝트에는 백엔드 자체가 없음)

### 7.2 SDK
```bash
npm install @google/genai
```

```typescript
// lib/gemini/client.ts
import { GoogleGenAI } from '@google/genai';

export function getGeminiClient() {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) throw new Error('API key not set');
  return new GoogleGenAI({ apiKey });
}
```

### 7.3 텍스트 호출 예시
```typescript
const ai = getGeminiClient();
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userInput }] }],
  config: {
    temperature: 0.7,
    responseMimeType: 'application/json',
  },
});
const json = JSON.parse(response.text);
```

### 7.4 이미지 호출 예시
```typescript
const parts: any[] = [];

// 캐릭터 참조 이미지 첨부
for (const char of characters) {
  const base64 = await blobToBase64(char.referenceImages[0]);
  parts.push({
    inlineData: { mimeType: 'image/jpeg', data: base64 },
  });
}

// 텍스트 프롬프트
parts.push({ text: fullPrompt });

const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash-image-preview',  // 최신 모델명 web_search 확인
  contents: [{ role: 'user', parts }],
});

// 응답에서 이미지 추출
const imagePart = response.candidates[0].content.parts.find(
  (p: any) => p.inlineData
);
const imageBlob = base64ToBlob(imagePart.inlineData.data, 'image/png');
```

### 7.5 에러 처리
- 401/403: API 키 오류 → 모달 다시 띄우기
- 429: rate limit → 5초 대기 후 자동 재시도 (최대 3회)
- 500: 서버 에러 → "재시도" 버튼 표시
- 네트워크 오류: 동일 처리

### 7.6 비용 표시
설정 화면에 추정 비용 표시:
- 텍스트 호출 1회: 무시 가능
- 이미지 1컷: 약 $0.04 (₩55)
- "30컷 생성 시 예상 비용: ₩1,650"

---

## 8. 합성 알고리즘 (Canvas 코드)

```typescript
// lib/stitch.ts
export async function stitchPanels(
  panels: Panel[],
  options = {}
): Promise<Blob> {
  const { gap = 80, background = '#FAF8F3', maxWidth = 800 } = options;

  // 1. 모든 이미지 로드
  const images = await Promise.all(
    panels
      .filter(p => p.imageBlob)
      .sort((a, b) => /* by panel index */ 0)
      .map(p => loadImage(URL.createObjectURL(p.imageBlob!)))
  );

  if (images.length === 0) throw new Error('No panels to stitch');

  // 2. 최종 너비 결정
  const targetWidth = Math.min(
    Math.max(...images.map(i => i.width)),
    maxWidth
  );

  // 3. 각 이미지 비율 유지 + 너비 맞춤 후 높이 계산
  const adjusted = images.map(img => ({
    img,
    width: targetWidth,
    height: Math.round((img.height / img.width) * targetWidth),
  }));

  const totalHeight =
    adjusted.reduce((sum, a) => sum + a.height, 0) +
    gap * (adjusted.length - 1);

  // 4. Canvas 생성
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, targetWidth, totalHeight);

  // 5. 그리기
  let y = 0;
  for (const a of adjusted) {
    ctx.drawImage(a.img, 0, y, a.width, a.height);
    y += a.height + gap;
  }

  // 6. Blob 반환
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png'
    );
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
```

매우 긴 PNG (예: 800 × 30,000)는 일부 브라우저에서 toBlob 실패 가능. 60컷 이상 시 분할 출력 옵션 고려.

---

## 9. 환경 변수 / 설정

`.env.local.example`:
```
# 이 프로젝트는 사용자 본인의 Gemini API 키를 브라우저 localStorage에 저장합니다.
# 환경 변수는 사용하지 않습니다.
# 개발 시에만 다음을 사용할 수 있습니다 (선택):
# NEXT_PUBLIC_DEFAULT_GEMINI_KEY=
```

배포: Vercel에 환경변수 없이 그대로 배포 가능.

---

## 10. 작업 순서 (Phase별 — Claude Code 단계 실행)

### Phase 1: 프로젝트 셋업 (예상 30분)
- [ ] `npx create-next-app@latest webtoon-studio --typescript --tailwind --app`
- [ ] Tailwind v4 설정 확인
- [ ] shadcn/ui 초기화: `npx shadcn@latest init`
- [ ] 기본 컴포넌트 추가: `npx shadcn@latest add button input textarea dialog card slider select progress sonner`
- [ ] 패키지 설치: `npm i @google/genai dexie zustand file-saver lucide-react uuid`
- [ ] 타입 패키지: `npm i -D @types/file-saver @types/uuid`
- [ ] `lib/types.ts`, `lib/store.ts`, `lib/storage/db.ts` 작성
- [ ] 기본 layout + 빈 page.tsx (BoBi 블루 헤더만)
- [ ] `npm run dev`로 확인 → 보고

### Phase 2: 캐릭터 관리 (예상 1시간)
- [ ] CharacterModal 컴포넌트 (이름, 설명, 이미지 업로드 - 드래그앤드롭)
- [ ] 이미지 리사이즈 유틸 (1024px 이내, JPEG 압축)
- [ ] CharacterCard 컴포넌트
- [ ] CharacterList 사이드바
- [ ] Zustand store에 add/update/remove
- [ ] Dexie 자동 동기화
- [ ] 페이지 새로고침 후 복원 확인
- [ ] 보고

### Phase 3: API 키 + Gemini 클라이언트 (예상 30분)
- [ ] ApiKeyModal (첫 진입 시 강제 표시)
- [ ] localStorage 저장
- [ ] `lib/gemini/client.ts` 작성
- [ ] 헤더 ⚙️ 버튼 → API 키 변경 가능
- [ ] **이 시점에 web_search로 Gemini 2.5 Flash Image API 최신 사용법 확인 후 SDK 호출 예시 코드 검증**
- [ ] 보고

### Phase 4: 스토리 → 컷 프롬프트 생성 (예상 1시간)
- [ ] StoryInput 컴포넌트 (textarea + 컷 수 slider + 스타일 select)
- [ ] `lib/gemini/story-to-panels.ts` 작성
- [ ] [생성 시작] 버튼 → 프롬프트 N개 생성 → store에 저장
- [ ] 로딩 상태 표시
- [ ] 콘솔에서 결과 JSON 확인 가능 + 디버그 패널 표시
- [ ] 보고

### Phase 5: 이미지 생성 + 갤러리 (예상 2시간 — 가장 중요)
- [ ] `lib/gemini/generate-image.ts` — 단일 컷 생성
- [ ] `lib/utils.ts` — pLimit (concurrency 3) 헬퍼
- [ ] PanelGallery 컴포넌트 (반응형 그리드)
- [ ] PanelCard (placeholder, 스피너, done 상태, 에러 상태)
- [ ] 진행률 표시 (12/30)
- [ ] 생성된 컷 IndexedDB 저장
- [ ] 다운로드 버튼 (개별)
- [ ] 재생성 버튼 (단일 컷)
- [ ] 편집 버튼 (프롬프트 수정 → 재생성)
- [ ] 토스트 알림 (sonner)
- [ ] 보고

### Phase 6: 합치기 + 다운로드 (예상 30분)
- [ ] `lib/stitch.ts` 작성 (위 Section 8 코드)
- [ ] StitchButton 컴포넌트
- [ ] 미리보기 (lightbox)
- [ ] file-saver로 다운로드
- [ ] 파일명: `webtoon_{프로젝트제목}_{YYYYMMDD-HHmm}.png`
- [ ] 보고

### Phase 7: 프로젝트 관리 + 마무리 (예상 1시간)
- [ ] 프로젝트 자동 저장 (5초 debounce)
- [ ] 헤더 "프로젝트 ▼" 드롭다운
- [ ] 새 프로젝트 / 불러오기 / 이름 변경 / 삭제
- [ ] 비용 추정 표시
- [ ] README.md 작성 (사용법, 배포 방법)
- [ ] Vercel 배포 가이드
- [ ] 보고

**총 예상 시간**: 6시간 ~ 1일 작업

---

## 11. 완료 기준 (검증 시나리오)

다음 시나리오가 끝까지 통과하면 MVP 완료:

1. ✅ 빈 상태에서 사이트 접속 → API 키 모달 표시 → 키 입력 → 메인 화면 진입
2. ✅ 캐릭터 2명 추가 ("김지영" 사진 1장, "박 부장" 사진 1장)
3. ✅ 스토리 textarea에 다음 텍스트 붙여넣기 (한승수의 BoBi 단편 일부):
   ```
   알람은 6시 30분에 맞춰 두었지만, 김지영 설계사는 5시 50분부터 깨어 있었다.
   천장을 바라보며 누워 있는 동안... [중략]
   "부장님, 지호 천식은 좀 어때요?" 박 부장의 얼굴이 살짝 풀어졌다.
   ```
4. ✅ 컷 수 15, 스타일 "모던 슬라이스 오브 라이프" 선택
5. ✅ [생성 시작] 클릭 → 진행률 표시 → 1-2분 내 15컷 모두 생성
6. ✅ 갤러리에서 김지영의 얼굴이 모든 컷에서 일관됨 (완벽하지는 않더라도 같은 인물 인식 가능)
7. ✅ 마음에 안 드는 컷 1개 [재생성] 클릭 → 다시 생성됨
8. ✅ 컷 1개 [편집] → 프롬프트 수정 → 재생성 → 결과 반영
9. ✅ [웹툰으로 합치기] 클릭 → 세로 PNG 다운로드 → 파일 열어보면 15컷이 위에서 아래로 이어짐
10. ✅ 페이지 새로고침 → 캐릭터, 스토리, 갤러리 모두 복원
11. ✅ Vercel 배포 후 동일 시나리오 통과

---

## 12. 함정 / 주의사항 (반드시 숙지)

1. **Gemini 2.5 Flash Image API 모델명 변경 가능**
   구현 시 반드시 web_search로 최신 모델명 확인. 작성 시점 기준 `gemini-2.5-flash-image-preview` 또는 `gemini-2.5-flash-image` 등 변경됨.

2. **이미지 응답 파싱**
   응답 구조가 `candidates[0].content.parts` 안에 텍스트와 이미지가 섞여 있음. `inlineData`가 있는 part만 필터링.

3. **여러 캐릭터 한 컷 등장 시 일관성 저하**
   예: 김지영 + 박 부장이 한 컷에. 두 사람 다 정확히 닮게 만드는 건 어려움. 한 컷에 한 캐릭터씩 (시점 변환)을 텍스트 프롬프트 단계에서 자동으로 유도. 시스템 프롬프트에 "Prefer single-character panels with shot variety over crowded multi-character panels" 추가.

4. **rate limit**
   Gemini 무료 티어는 분당 호출 수 제한 있음. 동시 3개로 제한, 429 에러 시 5초 대기 후 재시도.

5. **이미지 텍스트 생성 약점**
   Gemini는 한국어 텍스트를 이미지에 그릴 때 깨짐 자주 발생. 프롬프트에 "No text, no speech bubbles, no written language in the image" 강제.

6. **IndexedDB Blob 크기**
   참조 이미지 + 생성 컷 다 저장하면 빠르게 GB 단위 됨. 캐릭터 이미지는 리사이즈 필수, 30일 이상 안 쓴 프로젝트는 자동 정리 옵션 고려 (V2).

7. **Canvas 메모리 한계**
   너무 긴 합성 PNG (60컷 이상)는 일부 모바일 브라우저에서 toBlob 실패. 50컷 초과 시 경고 또는 분할.

8. **API 키 보안**
   사용자에게 명확히 고지: "키는 브라우저에만 저장됩니다. 공용 컴퓨터에서 사용 후 키를 삭제하세요." 헤더 ⚙️에 [API 키 삭제] 버튼.

9. **모바일 대응**
   MVP는 데스크탑 우선. 모바일에서는 사이드바를 햄버거 메뉴로. 합치기 결과 다운로드는 어차피 데스크탑이 편함.

10. **개발 시 비용 절약**
    Phase 5 디버깅 시 매번 진짜 이미지 생성하면 비용 누적. mock 모드 환경변수 추가:
    `NEXT_PUBLIC_MOCK_IMAGES=true` 일 때 placeholder.com 더미 이미지 반환.

---

## 13. 작업 원칙

- 기술 스택은 Section 2에서 확정된 것만 사용. 변경 금지.
- Phase 1부터 순서대로 진행.
- 각 Phase 완료 시 짧게 보고하고 다음 Phase 진행 여부 확인.
- Gemini 2.5 Flash Image API 호출 코드는 Phase 3에서 web_search로 최신 사양 확인 후 작성.
- TypeScript strict, 타입 정의는 lib/types.ts에 통합.
- 모든 사용자 텍스트는 한국어, 코드 주석은 영문 가능.
- 디자인 톤: 깔끔한 흰 배경, BoBi 블루(#1a56db) 액센트, 슬라이스 오브 라이프 웹툰 스튜디오 느낌.

---

## 14. V2 후보 (MVP 완료 후 우선순위)

1. **말풍선 자동 배치** — 이미지 위에 SVG/Canvas로 대사 오버레이, 드래그로 위치 조정
2. **컷별 편집기** — 마음에 안 드는 영역만 마스크 → inpaint 재생성
3. **캐릭터 라이브러리** — 캐릭터를 프로젝트 간 공유, 시리즈 일관성
4. **스타일 커스텀** — LoRA 파일 업로드 (RunPod 백엔드 추가 시)
5. **PSD 출력** — 작가 후작업용 레이어 분리
6. **TTS 더빙 + 영상 출력** — Shorts/Reels용 모션그래픽 자동 생성
7. **다국어** — 영문/일본어 스토리 입력 지원
8. **Bottle SaaS 출시** — 월 9,900원, 사용자별 API 키 관리, 결제 연동 (KG이니시스)

---

**END OF SPEC**
*webtoon-studio v0.1 — Bottle Inc. © 2026*
