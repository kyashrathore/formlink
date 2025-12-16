import { loadPrompt } from "@formlink/prompts";

export class ChatContextService {
  /**
   * Stabilizes object keys for consistent JSON stringification
   */
  static stabilizeObject<T>(input: T): T {
    if (Array.isArray(input)) {
      return input.map((item) => this.stabilizeObject(item)) as T;
    }
    if (input && typeof input === "object") {
      const sortedEntries = Object.keys(input as Record<string, unknown>)
        .sort()
        .map((key) => {
          const value = (input as Record<string, unknown>)[key];
          return [key, this.stabilizeObject(value)];
        });
      return Object.fromEntries(sortedEntries) as T;
    }
    return input;
  }

  /**
   * Injects the XML context block into the last user message or appends a new one
   */
  static injectXmlContext(
    messages: any[],
    contextPayload: any,
    fallbackText: string = "",
  ): any[] {
    const xmlBlock = `<current_turn_context>${JSON.stringify(
      contextPayload,
    )}</current_turn_context>`;
    const blockWithNewline = `${xmlBlock}\n`;

    const cloned = messages.map((message) => ({
      ...message,
      parts: Array.isArray(message.parts)
        ? message.parts.map((part: any) => ({ ...part }))
        : message.parts,
    }));

    let lastUserIndex = -1;
    for (let i = cloned.length - 1; i >= 0; i -= 1) {
      if (cloned[i]?.role === "user") {
        lastUserIndex = i;
        break;
      }
    }

    if (lastUserIndex >= 0) {
      const target = cloned[lastUserIndex];
      const existingParts = Array.isArray(target.parts)
        ? [...target.parts]
        : [];
      const firstTextIndex = existingParts.findIndex(
        (part) => part?.type === "text",
      );
      if (firstTextIndex >= 0) {
        const originalText = existingParts[firstTextIndex]?.text ?? "";
        existingParts[firstTextIndex] = {
          ...existingParts[firstTextIndex],
          text: `${blockWithNewline}${originalText}`,
        };
      } else {
        existingParts.unshift({
          type: "text",
          text: `${blockWithNewline}${fallbackText}`,
        });
      }
      target.parts = existingParts;
    } else {
      cloned.push({
        id: `server-user-${Date.now()}`,
        role: "user",
        parts: [{ type: "text", text: `${blockWithNewline}${fallbackText}` }],
      });
    }

    return cloned;
  }

  static async loadSystemPrompt(formSchema: any): Promise<string> {
    return loadPrompt("filler/form-assistant-system.md", {
      journey_script: String(formSchema?.settings?.journeyScript || ""),
      include_guards: true,
    });
  }
}
