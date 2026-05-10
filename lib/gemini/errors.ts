// Translates raw Gemini errors (JSON-stringified by the SDK or fetch path)
// into actionable Korean messages so the user sees a useful next step
// instead of a wall of @type / metadata noise.

const RESET_HINT =
  "헤더 ⚙️에서 키를 다시 입력해주세요. (aistudio.google.com/apikey 에서 새 키 발급 가능)";

export function humanizeGeminiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  // Try to extract the inner Gemini error message if the SDK wrapped a JSON.
  let inner = raw;
  const jsonMatch = raw.match(/\{[\s\S]*"error"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const msg = parsed?.error?.message;
      if (typeof msg === "string") inner = msg;
    } catch {
      // fall through with raw
    }
  }

  // Auth failures — most common is API_KEY_INVALID after a stale/test key.
  if (
    /API[_ ]?KEY[_ ]?INVALID/i.test(raw) ||
    /API key not valid/i.test(inner) ||
    /401|403/.test(raw)
  ) {
    return `Gemini API 키가 유효하지 않습니다. ${RESET_HINT}`;
  }

  // Permission / API not enabled
  if (/PERMISSION_DENIED|consumer.*disabled|API.*not enabled/i.test(raw)) {
    return [
      "이 키가 속한 Google Cloud 프로젝트에서 Generative Language API가 비활성화되어 있습니다.",
      "console.cloud.google.com 에서 'Generative Language API'를 enable 하거나, aistudio.google.com/apikey 에서 새 키를 발급받아 ⚙️에 등록해주세요.",
    ].join(" ");
  }

  // Quota / rate limit — paid accounts also hit per-minute caps on the
  // image model, which is stricter than the text model.
  if (/RESOURCE_EXHAUSTED|quota|429/i.test(raw)) {
    return [
      "Gemini 분당 요청 한도에 도달했습니다.",
      "(paid Tier 1도 이미지 모델은 분당 ~10 RPM으로 보수적입니다)",
      "막힘 없이 계속 작업하시려면 ⚙️ → [테스트 모드]를 켜세요. placeholder 이미지로 즉시 진행되고, 실제 이미지가 필요할 때 다시 끄시면 됩니다.",
    ].join(" ");
  }

  // Safety / content filter
  if (/SAFETY|blocked|safety[_ ]?settings/i.test(raw)) {
    return "Gemini 안전 필터에 의해 차단된 프롬프트입니다. 캐릭터 설명이나 스토리 톤을 조정해주세요.";
  }

  // Model not found / unsupported
  if (/NOT_FOUND|model.*not.*found|unsupported/i.test(raw)) {
    return "요청한 Gemini 모델을 사용할 수 없습니다. 키가 속한 리전이나 프로젝트의 모델 접근 권한을 확인해주세요.";
  }

  // Empty response (image fallthrough already in caller, but keep cover)
  if (/응답이 없습니다|empty/i.test(inner)) {
    return inner;
  }

  // Default — surface the inner string but cap length so the toast doesn't
  // become a JSON wall.
  const trimmed = inner.length > 220 ? `${inner.slice(0, 220)}…` : inner;
  return `Gemini 호출 실패: ${trimmed}`;
}
