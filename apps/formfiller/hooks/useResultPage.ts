"use client";

import { useEffect, useMemo, useState } from "react";
import { Form } from "@formlink/schema";

export interface ResultPageState {
  loading: boolean;
  error: string | null;
  markdown: string | null;
}

export function useResultPage(
  enabled: boolean,
  form: Form | null,
  responses: Record<string, unknown>,
): ResultPageState {
  const [state, setState] = useState<ResultPageState>({
    loading: false,
    error: null,
    markdown: null,
  });

  const hasPrompt = useMemo(() => {
    return Boolean((form as any)?.settings?.resultPageGenerationPrompt);
  }, [form]);

  useEffect(() => {
    if (!enabled || !form) return;

    // If no prompt, skip fetching; we may still show score via CompletionScreen
    if (!hasPrompt) {
      setState((s) => ({ ...s, loading: false, error: null }));
      return;
    }

    let cancelled = false;
    setState({ loading: true, error: null, markdown: null });

    (async () => {
      try {
        const res = await fetch("/api/results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ form, responses }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { markdown?: string };
        if (!cancelled) {
          setState({
            loading: false,
            error: null,
            markdown: data.markdown || null,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setState({
            loading: false,
            error: e instanceof Error ? e.message : "Failed to load result",
            markdown: null,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, form, hasPrompt, responses]);

  return state;
}
