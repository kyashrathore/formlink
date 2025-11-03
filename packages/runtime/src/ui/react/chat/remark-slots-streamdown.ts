// remark-slots-streamdown.ts (runtime copy — no external deps)
type MdastText = { type: "text"; value: string };
type MdastNode = { type: string; [key: string]: unknown };
type MdastParent = { children: MdastNode[] };
type MdastRoot = MdastNode;

const SLOT_REGEX = /::([A-Z][A-Za-z0-9]*)\s*(.*?)::/g;
const PROP_REGEX = /([a-zA-Z_][a-zA-Z0-9_]*)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;

export function remarkSlots() {
  return (tree: MdastRoot) => {
    let carry: string | null = null;

    const walk = (node: MdastNode, parent: MdastParent | null) => {
      if (!node) return;
      if (node.type === "text" && parent) {
        const index = (
          (parent as unknown as { children?: MdastNode[] }).children || []
        ).indexOf(node);
        if (index < 0) return;

        const value = (carry ? carry : "") + (node.value || "");
        carry = null;

        const children: MdastNode[] = [];
        let lastIndex = 0;

        for (const match of value.matchAll(SLOT_REGEX)) {
          const matchIndex = match.index ?? 0;

          // Escape hatch: \::Component:: → literal without the backslash
          if (matchIndex > 0 && value[matchIndex - 1] === "\\") {
            if (matchIndex - 1 > lastIndex) {
              children.push({
                type: "text",
                value: value.slice(lastIndex, matchIndex - 1),
              });
            }
            children.push({ type: "text", value: match[0] });
            lastIndex = matchIndex + match[0].length;
            continue;
          }

          if (matchIndex > lastIndex) {
            children.push({
              type: "text",
              value: value.slice(lastIndex, matchIndex),
            });
          }

          const [, component, rawProps] = match;
          const props: Record<string, unknown> = {};
          if (rawProps && rawProps.trim().length > 0) {
            let propMatch: RegExpExecArray | null;
            while ((propMatch = PROP_REGEX.exec(rawProps)) !== null) {
              const [, key, dq, sq, bare] = propMatch;
              let v: unknown = dq ?? sq ?? bare ?? "";
              if (bare != null) {
                const lower = String(bare).toLowerCase();
                if (lower === "true") v = true;
                else if (lower === "false") v = false;
                else if (!Number.isNaN(Number(bare))) v = Number(bare);
                else v = bare;
              }
              if (!key) continue;
              (props as Record<string, unknown>)[String(key)] = v;
            }
          }

          children.push({
            type: "slotComponent",
            data: { hName: component, hProperties: props },
            children: [],
          });

          lastIndex = matchIndex + match[0].length;
        }

        if (lastIndex < value.length) {
          const tail = value.slice(lastIndex);
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
              const closing = tail.indexOf("::", searchPos + 2);
              if (closing === -1) {
                cutIndex = searchPos;
                break;
              }
            }
            searchPos = tail.lastIndexOf("::", searchPos - 1);
          }

          if (cutIndex > 0) {
            const visible = tail.slice(0, cutIndex);
            if (visible.length > 0)
              children.push({ type: "text", value: visible });
            carry = tail.slice(cutIndex);
          } else if (cutIndex === 0) {
            carry = tail;
          } else {
            const trimmed = tail.trim();
            const singleColonPartial = /^:([A-Z][A-Za-z0-9]*)$/.test(trimmed);
            if (singleColonPartial) {
              carry = tail;
            } else {
              children.push({ type: "text", value: tail });
            }
          }
        }

        if (children.length > 0) {
          (parent as unknown as { children: MdastNode[] }).children.splice(
            index as number,
            1,
            ...children,
          );
          return; // finished for this node
        }
      }

      // Recurse into children if present
      const kidArray = (node as unknown as { children?: MdastNode[] })
        .children as MdastNode[] | undefined;
      if (Array.isArray(kidArray)) {
        // Iterate over a snapshot since we may splice during traversal
        const snapshot = [...kidArray];
        snapshot.forEach((child) =>
          walk(child, node as unknown as MdastParent),
        );
      }
    };

    walk(tree as unknown as MdastNode, null);
  };
}
