"use client";

type SendMessage = (
  message: { text: string },
  opts?: { body?: Record<string, any> },
) => Promise<any> | void;

export function useIntroStart(opts: {
  sendMessage: SendMessage;
  suppressUserMessagePersistence?: boolean;
}) {
  const { sendMessage, suppressUserMessagePersistence = true } = opts;

  function start(args?: { text?: string; startMode?: "start" | "resume" }) {
    const text = args?.text ?? "Start the form";
    const startMode = args?.startMode ?? "start";
    sendMessage(
      { text },
      { body: { initiate: true, suppressUserMessagePersistence, startMode } },
    );
  }

  return { start } as const;
}
