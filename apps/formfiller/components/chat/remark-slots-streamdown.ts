// remark-slots-streamdown.ts
import { visit } from "unist-util-visit";

// We intentionally avoid importing 'mdast' types to keep this file zero-dep.
// Minimal shapes for our use.
type MdastText = { type: "text"; value: string };
type MdastNode = { type: string; [key: string]: unknown };
type MdastParent = { children: MdastNode[] };
type MdastRoot = MdastNode;

// Regex to find ::ComponentName props::
const SLOT_REGEX = /::([A-Z][A-Za-z0-9]*)\s*(.*?)::/g;

// Regex to extract key="value" pairs (supports spaces & quotes)
const PROP_REGEX = /([a-zA-Z_][a-zA-Z0-9_]*)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;

export function remarkSlots() {
  return (tree: MdastRoot) => {
    visit(
      tree as unknown as MdastNode,
      "text",
      (
        node: MdastText,
        index: number | undefined,
        parent: MdastParent | undefined,
      ) => {
        if (!parent || typeof index !== "number") return;

        const value = node.value || "";
        const children: MdastNode[] = [];
        let lastIndex = 0;

        for (const match of value.matchAll(SLOT_REGEX)) {
          const matchIndex = match.index ?? 0;

          // Escape hatch: \::Component:: → literal without the backslash
          if (matchIndex > 0 && value[matchIndex - 1] === "\\") {
            // Push text before backslash
            if (matchIndex - 1 > lastIndex) {
              children.push({
                type: "text",
                value: value.slice(lastIndex, matchIndex - 1),
              });
            }
            // Push the literal slot token (without the escape backslash)
            children.push({
              type: "text",
              value: match[0],
            });

            lastIndex = matchIndex + match[0].length;
            continue;
          }

          // Push text before match
          if (matchIndex > lastIndex) {
            children.push({
              type: "text",
              value: value.slice(lastIndex, matchIndex),
            });
          }

          const [, component, rawProps] = match;

          // Parse props
          const props: Record<string, unknown> = {};
          if (rawProps && rawProps.trim().length > 0) {
            let propMatch: RegExpExecArray | null;
            while ((propMatch = PROP_REGEX.exec(rawProps)) !== null) {
              const [, key, dq, sq, bare] = propMatch;
              let v: unknown = dq ?? sq ?? bare ?? "";

              // Type coercion only for unquoted bare values
              if (bare != null) {
                const lower = String(bare).toLowerCase();
                if (lower === "true") v = true;
                else if (lower === "false") v = false;
                else if (!Number.isNaN(Number(bare))) v = Number(bare);
                else v = bare;
              }

              if (!key) continue;
              const keyName = String(key);
              (props as Record<string, unknown>)[keyName] = v;
            }
          }

          // Replace with component node (recognized by mdast-util-to-hast/react-markdown)
          children.push({
            type: "slotComponent",
            data: {
              hName: component,
              hProperties: props,
            },
            children: [],
          });

          lastIndex = matchIndex + match[0].length;
        }

        // Push remaining text, but hide an unmatched trailing slot start like:
        // "::ComponentName props..." when closing "::" hasn't arrived yet (streaming)
        if (lastIndex < value.length) {
          const tail = value.slice(lastIndex);

          // Find the last non-escaped "::" in tail that looks like a slot start (next char is [A-Z])
          let cutIndex = -1;
          let searchPos = tail.lastIndexOf("::");
          while (searchPos !== -1) {
            const prevChar = searchPos > 0 ? tail[searchPos - 1] : "";
            const nextChar = tail[searchPos + 2];

            const isEscaped = prevChar === "\\";
            const looksLikeSlotStart =
              typeof nextChar === "string" &&
              nextChar >= "A" &&
              nextChar <= "Z";

            if (!isEscaped && looksLikeSlotStart) {
              // If we cannot find a closing "::" after this, consider it unmatched → hide it
              const closing = tail.indexOf("::", searchPos + 2);
              if (closing === -1) {
                cutIndex = searchPos;
                break;
              }
            }

            searchPos = tail.lastIndexOf("::", searchPos - 1);
          }

          if (cutIndex > 0) {
            // Push visible part only, hide the unmatched trailing token
            const visible = tail.slice(0, cutIndex);
            if (visible.length > 0) {
              children.push({ type: "text", value: visible });
            }
          } else if (cutIndex === 0) {
            // Entire tail is an unmatched token → hide completely
            // do nothing
          } else {
            // No unmatched token.
            // Also hide a partial single-colon prefix like ":ComponentName" (streaming start)
            const trimmed = tail.trim();
            const singleColonPartial = /^:([A-Z][A-Za-z0-9]*)$/.test(trimmed);
            if (singleColonPartial) {
              // hide until we know it's really a slot (when second ':' arrives)
            } else {
              children.push({ type: "text", value: tail });
            }
          }
        }

        if (children.length > 0) {
          parent.children.splice(index as number, 1, ...children);
        }
      },
    );
  };
}
