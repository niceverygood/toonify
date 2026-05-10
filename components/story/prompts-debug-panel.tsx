"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Copy, Bug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWebtoonStore } from "@/lib/store";

export function PromptsDebugPanel() {
  const project = useWebtoonStore((s) => s.currentProject);
  const characters = useWebtoonStore((s) => s.characters);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const prompts = project?.prompts ?? [];
  if (prompts.length === 0) return null;

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const charNameById = (id: string) =>
    characters.find((c) => c.id === id)?.name ?? id.slice(0, 6);

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(prompts, null, 2));
    toast.success("JSON을 클립보드에 복사했습니다.");
  };

  return (
    <div className="rounded-md border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition"
      >
        {open ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <Bug className="h-3.5 w-3.5" />
        <span className="font-medium">생성된 프롬프트</span>
        <span className="text-xs text-muted-foreground">
          ({prompts.length}개)
        </span>
      </button>

      {open && (
        <div className="border-t">
          <div className="flex justify-end p-2 border-b">
            <Button
              variant="ghost"
              size="sm"
              onClick={copyJson}
              className="h-7 text-xs"
            >
              <Copy className="h-3 w-3 mr-1" />
              JSON 복사
            </Button>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y">
            {prompts.map((p) => {
              const isExpanded = expanded.has(p.id);
              return (
                <div key={p.id} className="px-3 py-2 text-xs">
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    className="w-full flex items-start gap-2 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 mt-0.5 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-muted-foreground shrink-0">
                          #{p.index + 1}
                        </span>
                        {p.shotType && (
                          <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] shrink-0">
                            {p.shotType}
                          </span>
                        )}
                        {p.characterIds.map((cid) => (
                          <span
                            key={cid}
                            className="rounded bg-muted px-1.5 py-0.5 text-[10px] shrink-0"
                          >
                            {charNameById(cid)}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1 text-foreground/80 line-clamp-2">
                        {p.description}
                      </div>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="mt-2 pl-5 space-y-2">
                      <div>
                        <div className="text-muted-foreground mb-1">
                          설명 (한국어)
                        </div>
                        <div className="text-foreground">{p.description}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">
                          영문 프롬프트
                        </div>
                        <div className="font-mono text-[11px] bg-background border rounded p-2 whitespace-pre-wrap break-words">
                          {p.englishPrompt}
                        </div>
                      </div>
                      {p.dialogue && p.dialogue.length > 0 && (
                        <div>
                          <div className="text-muted-foreground mb-1">대사</div>
                          <ul className="space-y-0.5">
                            {p.dialogue.map((d, di) => (
                              <li key={di}>
                                <span className="font-medium">
                                  {d.speaker}:
                                </span>{" "}
                                {d.text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
