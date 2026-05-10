"use client";

import { useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  ExternalLink,
  Trash2,
  KeyRound,
  Sparkles,
  Bot,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getApiKey,
  setApiKey,
  clearApiKey,
  getOpenAIKey,
  setOpenAIKey,
  clearOpenAIKey,
  hasOpenAIKey,
  getActiveImageProvider,
  setActiveImageProvider,
  getOpenAIQuality,
  setOpenAIQuality,
  isMockImagesEnabled,
  setMockImagesEnabled,
  type ImageProviderId,
  type OpenAIQuality,
} from "@/lib/storage/api-key";
import { verifyApiKey } from "@/lib/gemini/client";
import { verifyOpenAIKey } from "@/lib/openai/client";
import { useWebtoonStore } from "@/lib/store";
import { BackupSection } from "@/components/backup-section";
import { StorageSection } from "@/components/storage-section";

interface ApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  required?: boolean;
}

const GEMINI_STUDIO_URL = "https://aistudio.google.com/apikey";
const OPENAI_KEYS_URL = "https://platform.openai.com/api-keys";

const QUALITY_OPTIONS: {
  value: OpenAIQuality;
  label: string;
  hint: string;
}[] = [
  { value: "low", label: "Low", hint: "≈ 13원/컷" },
  { value: "medium", label: "Medium", hint: "≈ 110원/컷 (권장)" },
  { value: "high", label: "High", hint: "≈ 437원/컷" },
];

export function ApiKeyModal({ open, onOpenChange, required }: ApiKeyModalProps) {
  // Gemini key (required)
  const [gemini, setGemini] = useState("");
  const [showGemini, setShowGemini] = useState(false);
  const [hasGemini, setHasGemini] = useState(false);
  const [verifyingGemini, setVerifyingGemini] = useState(false);

  // OpenAI key (optional)
  const [openai, setOpenai] = useState("");
  const [showOpenai, setShowOpenai] = useState(false);
  const [hasOpenai, setHasOpenai] = useState(false);
  const [verifyingOpenai, setVerifyingOpenai] = useState(false);

  // Provider preferences
  const [provider, setProvider] = useState<ImageProviderId>("gemini");
  const [quality, setQuality] = useState<OpenAIQuality>("medium");
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    if (!open) return;
    const g = getApiKey() ?? "";
    setGemini(g);
    setHasGemini(Boolean(g));
    const o = getOpenAIKey() ?? "";
    setOpenai(o);
    setHasOpenai(Boolean(o));
    setProvider(getActiveImageProvider());
    setQuality(getOpenAIQuality());
    setTestMode(isMockImagesEnabled());
    setShowGemini(false);
    setShowOpenai(false);
  }, [open]);

  const saveGemini = async () => {
    const trimmed = gemini.trim();
    if (!trimmed) {
      toast.error("Gemini API 키를 입력해주세요.");
      return false;
    }
    setVerifyingGemini(true);
    try {
      const { ok, error } = await verifyApiKey(trimmed);
      if (!ok) {
        toast.error(`Gemini 키 검증 실패: ${error ?? "알 수 없는 오류"}`);
        return false;
      }
      setApiKey(trimmed);
      setHasGemini(true);
      toast.success("Gemini API 키 저장됨.");
      return true;
    } finally {
      setVerifyingGemini(false);
    }
  };

  const saveOpenAI = async () => {
    const trimmed = openai.trim();
    if (!trimmed) {
      toast.error("OpenAI API 키를 입력해주세요.");
      return false;
    }
    setVerifyingOpenai(true);
    try {
      const { ok, error } = await verifyOpenAIKey(trimmed);
      if (!ok) {
        toast.error(`OpenAI 키 검증 실패: ${error ?? "알 수 없는 오류"}`);
        return false;
      }
      setOpenAIKey(trimmed);
      setHasOpenai(true);
      toast.success("OpenAI API 키 저장됨.");
      return true;
    } finally {
      setVerifyingOpenai(false);
    }
  };

  const deleteGemini = () => {
    clearApiKey();
    setGemini("");
    setHasGemini(false);
    toast.success("Gemini API 키 삭제됨.");
  };

  const deleteOpenAI = () => {
    clearOpenAIKey();
    setOpenai("");
    setHasOpenai(false);
    // If user disables OpenAI key, fall back to Gemini for image gen.
    if (provider === "openai") {
      setProvider("gemini");
      setActiveImageProvider("gemini");
    }
    toast.success("OpenAI API 키 삭제됨.");
  };

  const handleSaveAll = async () => {
    let ok = true;
    // Save Gemini if changed.
    const currentGem = getApiKey() ?? "";
    if (gemini.trim() && gemini.trim() !== currentGem) {
      ok = (await saveGemini()) && ok;
    }
    // Save OpenAI if changed.
    const currentOA = getOpenAIKey() ?? "";
    if (openai.trim() && openai.trim() !== currentOA) {
      ok = (await saveOpenAI()) && ok;
    }
    // Persist provider + quality + test-mode settings.
    setActiveImageProvider(provider);
    setOpenAIQuality(quality);
    setMockImagesEnabled(testMode);
    // Notify subscribers (cost display etc.) of the settings change.
    useWebtoonStore.getState().bumpSettings();
    if (ok && getApiKey()) onOpenChange(false);
  };

  const handleProviderChange = (next: ImageProviderId | null) => {
    if (!next) return;
    if (next === "openai" && !hasOpenAIKey()) {
      toast.error("OpenAI API 키를 먼저 저장해주세요.");
      return;
    }
    setProvider(next);
  };

  const verifying = verifyingGemini || verifyingOpenai;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && required && !getApiKey()) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="sm:max-w-md max-h-[90vh] overflow-y-auto"
        showCloseButton={!required || hasGemini}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            API 키 / 이미지 모델 설정
          </DialogTitle>
          <DialogDescription>
            모든 키는 이 브라우저의 localStorage에만 저장되며 어떤 서버로도 전송되지 않습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Gemini key */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="gemini-key-input"
                className="flex items-center gap-1.5 text-sm font-semibold"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Gemini API 키
                <span className="text-[10px] text-destructive">필수</span>
              </Label>
              <a
                href={GEMINI_STUDIO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary text-xs inline-flex items-center gap-0.5 hover:underline"
              >
                키 발급
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="relative">
              <Input
                id="gemini-key-input"
                type={showGemini ? "text" : "password"}
                placeholder="AIzaSy..."
                value={gemini}
                onChange={(e) => setGemini(e.target.value)}
                className="pr-9 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowGemini((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showGemini ? "키 숨기기" : "키 표시"}
              >
                {showGemini ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                스토리 → 컷 프롬프트 변환 + Gemini 이미지 생성에 사용
              </span>
              {hasGemini && (
                <button
                  type="button"
                  onClick={deleteGemini}
                  className="text-destructive hover:underline inline-flex items-center gap-0.5"
                >
                  <Trash2 className="h-3 w-3" />
                  삭제
                </button>
              )}
            </div>
          </section>

          {/* OpenAI key */}
          <section className="space-y-2 pt-1 border-t">
            <div className="flex items-center justify-between pt-3">
              <Label
                htmlFor="openai-key-input"
                className="flex items-center gap-1.5 text-sm font-semibold"
              >
                <Bot className="h-3.5 w-3.5 text-foreground/80" />
                OpenAI API 키
                <span className="text-[10px] text-muted-foreground">선택</span>
              </Label>
              <a
                href={OPENAI_KEYS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary text-xs inline-flex items-center gap-0.5 hover:underline"
              >
                키 발급
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="relative">
              <Input
                id="openai-key-input"
                type={showOpenai ? "text" : "password"}
                placeholder="sk-proj-..."
                value={openai}
                onChange={(e) => setOpenai(e.target.value)}
                className="pr-9 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowOpenai((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showOpenai ? "키 숨기기" : "키 표시"}
              >
                {showOpenai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                gpt-image-2 (대안 이미지 모델) 사용 시 필요
              </span>
              {hasOpenai && (
                <button
                  type="button"
                  onClick={deleteOpenAI}
                  className="text-destructive hover:underline inline-flex items-center gap-0.5"
                >
                  <Trash2 className="h-3 w-3" />
                  삭제
                </button>
              )}
            </div>
          </section>

          {/* Image provider preference */}
          <section className="space-y-2 pt-1 border-t">
            <Label className="text-sm font-semibold pt-3 block">
              이미지 생성 모델
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleProviderChange("gemini")}
                className={`rounded-md border p-3 text-left transition ${
                  provider === "gemini"
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="text-sm font-medium flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Gemini 2.5 Flash Image
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  9:16 네이티브 · ≈ 55원/컷
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleProviderChange("openai")}
                disabled={!hasOpenai}
                className={`rounded-md border p-3 text-left transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  provider === "openai"
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="text-sm font-medium flex items-center gap-1">
                  <Bot className="h-3.5 w-3.5" />
                  GPT Image 2
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  1024×1536 · 품질에 따라
                </div>
              </button>
            </div>

            {provider === "openai" && (
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="quality-select" className="text-xs">
                  GPT Image 2 품질
                </Label>
                <Select
                  value={quality}
                  onValueChange={(v) => v && setQuality(v as OpenAIQuality)}
                >
                  <SelectTrigger id="quality-select" className="w-full">
                    <SelectValue>
                      {(v) =>
                        QUALITY_OPTIONS.find((q) => q.value === v)?.label ?? ""
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {QUALITY_OPTIONS.map((q) => (
                      <SelectItem key={q.value} value={q.value}>
                        <span className="flex items-center justify-between gap-3 w-full">
                          <span>{q.label}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {q.hint}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </section>

          {/* Test mode — saves the user when the real API is rate-limited */}
          <section className="space-y-2 pt-1 border-t">
            <Label className="text-sm font-semibold pt-3 block">
              테스트 모드 (Mock Images)
            </Label>
            <button
              type="button"
              onClick={() => setTestMode((v) => !v)}
              className={`w-full rounded-md border p-3 text-left transition flex items-start gap-3 ${
                testMode ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
            >
              <div
                className={`mt-0.5 h-4 w-4 shrink-0 rounded border-2 transition flex items-center justify-center ${
                  testMode
                    ? "border-primary bg-primary"
                    : "border-input"
                }`}
              >
                {testMode && (
                  <svg
                    className="h-2.5 w-2.5 text-primary-foreground"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M2 6 L5 9 L10 3" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {testMode ? "테스트 모드 켬" : "테스트 모드 끔"}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {testMode
                    ? "이미지 생성이 placeholder로 즉시 반환됩니다. 비용 0원 / RPM 무관 — UI 흐름 검증용."
                    : "실제 Gemini / OpenAI API로 호출됩니다. 비용 발생 + 분당 RPM 제한 적용."}
                </div>
              </div>
            </button>
            {testMode && (
              <div className="rounded-md bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 p-2 text-[11px] text-amber-900 dark:text-amber-200">
                💡 실제 이미지를 보려면 이 토글을 끄세요. 텍스트(스토리·프롬프트) 생성은 항상 실제 Gemini 호출입니다.
              </div>
            )}
          </section>

          <BackupSection />

          <StorageSection />

          <div className="rounded-md bg-muted/50 border p-2.5 text-[11px] text-muted-foreground space-y-1">
            <div>🔒 키는 브라우저에만 저장되고 서버로 전송되지 않습니다.</div>
            <div>🧹 공용 PC에서는 사용 후 [삭제]를 눌러주세요.</div>
            <div>
              ⚠️ OpenAI 키는 브라우저에서 직접 호출하므로 페이지 사용자가 키를
              검사·복사할 수 있습니다. 공유 환경에서는 주의해주세요.
            </div>
          </div>
        </div>

        <DialogFooter>
          {(!required || hasGemini) && (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={verifying}
            >
              취소
            </Button>
          )}
          <Button onClick={handleSaveAll} disabled={verifying}>
            {verifying ? "검증 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
