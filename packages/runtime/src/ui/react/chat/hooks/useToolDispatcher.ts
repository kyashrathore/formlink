"use client";

export function useToolDispatcher(opts: {
  onApplyResult: (toolName: string, result: any) => void;
}) {
  const { onApplyResult } = opts;

  function apply(message: any): void {
    if (!message) return;
    const parts: any[] = Array.isArray(message.parts) ? message.parts : [];
    for (const p of parts) {
      const t = String(p?.type ?? "");
      if (!t.startsWith("tool-")) continue;
      const toolName = t.replace(/^tool-/, "");
      const result = p?.output ?? p?.result;
      try {
        onApplyResult(toolName, result);
      } catch {}
    }
  }

  return { apply } as const;
}
