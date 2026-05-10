// Translates raw OpenAI errors into actionable Korean messages so the toast
// gives the user a clear next step instead of an opaque English string.

const VERIFICATION_HINT =
  "⚙️ 설정에서 이미지 모델을 [Gemini 2.5 Flash Image]로 전환하시면 즉시 사용할 수 있습니다.";

export function humanizeOpenAIError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  // 403 organization verification — the most common new-account blocker for
  // gpt-image-1.5 / gpt-image-2 since OpenAI tightened access in 2025.
  if (/must be verified/i.test(raw) || /Verify Organization/i.test(raw)) {
    return [
      "OpenAI organization 인증이 필요합니다.",
      "platform.openai.com/settings/organization/general → [Verify Organization]을 완료한 후 최대 15분 기다려주세요.",
      VERIFICATION_HINT,
    ].join(" ");
  }

  // Auth failures
  if (/401|invalid[_ ]?api[_ ]?key|Incorrect API key/i.test(raw)) {
    return "OpenAI API 키가 유효하지 않습니다. ⚙️ 설정에서 다시 등록해주세요.";
  }

  // Quota
  if (/insufficient_quota|exceeded your current quota/i.test(raw)) {
    return [
      "OpenAI 사용량 한도를 초과했습니다.",
      "platform.openai.com/account/billing 에서 잔액을 확인해주세요.",
      VERIFICATION_HINT,
    ].join(" ");
  }

  // Rate limit (also handled by retry but if we surface it, tell user)
  if (/429|rate\s?limit/i.test(raw)) {
    return "OpenAI 요청이 너무 많습니다. 1-2분 후 다시 시도하거나 ⚙️ → [테스트 모드]를 켜서 placeholder로 진행하세요.";
  }

  // Content policy
  if (/safety|content[_ ]?policy|moderation/i.test(raw)) {
    return "OpenAI 콘텐츠 정책에 의해 차단된 프롬프트입니다. 캐릭터 설명을 조정하거나 Gemini로 전환해보세요.";
  }

  return `OpenAI 호출 실패: ${raw}`;
}
