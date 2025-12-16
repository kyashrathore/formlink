import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// --- Smart Selection Logic ---
// --- Smart Selection Logic ---
if (import.meta.env.DEV) {
  (function initSmartSelection() {
    console.log("[Smart Selection] Initializing custom engine...");

    // 1. Create Overlay UI
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed",
      pointerEvents: "none",
      zIndex: "99999",
      border: "2px solid #6366f1", // Indigo-500
      backgroundColor: "rgba(99, 102, 241, 0.1)",
      borderRadius: "4px",
      transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
      display: "none",
      boxShadow:
        "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    });
    document.body.appendChild(overlay);

    const label = document.createElement("div");
    Object.assign(label.style, {
      position: "absolute",
      top: "-28px",
      left: "-2px",
      backgroundColor: "#6366f1",
      color: "white",
      padding: "4px 8px",
      borderRadius: "4px",
      fontSize: "12px",
      fontWeight: "600",
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      whiteSpace: "nowrap",
      boxShadow:
        "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
    });
    label.innerText = "Component";
    overlay.appendChild(label);

    const hint = document.createElement("span");
    Object.assign(hint.style, {
      opacity: "0.7",
      fontWeight: "400",
      marginLeft: "8px",
      fontSize: "11px",
    });
    hint.innerText = "Click to Edit";
    label.appendChild(hint);

    // 2. State
    let isActive = false;
    let activationTimer: any = null;
    let isWaitingForActivation = false;

    let lockedTarget: HTMLElement | null = null;

    // Toast logic for visual feedback of activation
    const showToast = (msg: string) => {
      const toast = document.createElement("div");
      Object.assign(toast.style, {
        position: "fixed",
        bottom: "20px",
        right: "20px",
        background: "#1f2937",
        color: "white",
        padding: "8px 16px",
        borderRadius: "6px",
        zIndex: "100000",
        fontSize: "14px",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
        opacity: "0",
        transition: "opacity 0.3s ease",
      });
      toast.innerText = msg;
      document.body.appendChild(toast);
      // Fade in
      requestAnimationFrame(() => (toast.style.opacity = "1"));
      // Remove
      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
      }, 2000);
    };

    const activate = () => {
      if (!isActive) {
        isActive = true;
        showToast("Element Selection Mode Active. (Esc to exit)");
        // Immediately highlight component under cursor if possible?
        // We rely on mouseover, which happens on move.
      }
    };

    const deactivate = () => {
      isActive = false;
      overlay.style.display = "none";
      lockedTarget = null;
      showToast("Smart Selection Deactivated");
    };

    // 3. React Fiber Inspection
    const getComponentInfo = (target: HTMLElement) => {
      // Find internal Fiber key
      const key =
        Object.keys(target).find((k) => k.startsWith("__reactFiber$")) ||
        Object.keys(target).find((k) =>
          k.startsWith("__reactInternalInstance$"),
        );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let fiber = key ? (target as any)[key] : null;

      let componentName =
        target.getAttribute("data-component") || "Unknown Component";
      let tagName = target.tagName.toLowerCase();
      let source: { file: string; lineNumber: number } | null = null;
      let foundName = false;

      // Walk up the fiber tree
      while (fiber) {
        const type = fiber.type;

        // Debug Source: Prioritize the deepest source found (usually the element itself)
        if (!source && fiber._debugSource) {
          source = {
            file: fiber._debugSource.fileName,
            lineNumber: fiber._debugSource.lineNumber,
          };
        }

        // Check if this fiber represents a functional/class component
        // We want the name of the CLOSEST component.
        if (
          !foundName &&
          (typeof type === "function" ||
            (typeof type === "object" && type !== null && type !== undefined))
        ) {
          const name = type.displayName || type.name;
          // Filter out standard HTML tags and internals
          if (
            name &&
            name !== "div" &&
            name !== "span" &&
            name !== "p" &&
            name !== "a" &&
            name !== "button" &&
            name !== "App" &&
            !name.includes("Provider")
          ) {
            componentName = name;
            foundName = true;

            // If we found the component name, we might want IT'S source specifically?
            // Usually the element source is better for "Click to Edit" (points to the JSX tag).
            // But if we want the COMPONENT file, we might prefer the component's definition source?
            // No, for "Text Edit", we want the line number of the JSX Text node.
            // React _debugSource on the HOST COMPONENT (div/p) usually points to the JSX line.
            // So prioritizing the deepest _debugSource (handled above) is correct for Line Number.
          }
        }

        if (foundName && source) break; // Found both, stop walking
        fiber = fiber.return;
      }

      return {
        name: componentName,
        tagName,
        source: source || { file: "src/App.tsx", lineNumber: 1 }, // Fallback
      };
    };

    // 4. Update Overlay Position & Content
    const updateOverlay = (target: HTMLElement) => {
      const rect = target.getBoundingClientRect();
      const info = getComponentInfo(target);

      overlay.style.display = "block";
      overlay.style.top = `${rect.top}px`;
      overlay.style.left = `${rect.left}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;

      // Display the HTML tag primarily, with component context
      label.firstChild!.textContent = `<${info.tagName}>`;

      if (lockedTarget) {
        label.style.backgroundColor = "#ec4899"; // Pink-500
        overlay.style.borderColor = "#ec4899";
        overlay.style.backgroundColor = "rgba(236, 72, 153, 0.1)";
        hint.innerText = `in ${info.name} (Esc to unlock)`;
      } else {
        label.style.backgroundColor = "#6366f1"; // Indigo-500
        overlay.style.borderColor = "#6366f1";
        overlay.style.backgroundColor = "rgba(99, 102, 241, 0.1)";
        hint.innerText = `in ${info.name}`;
      }
    };

    // 5. Event Listeners

    // Activation Logic: Cmd+C (Hold 1s OR Move)
    window.addEventListener("keydown", (e) => {
      // Toggle OFF/Exit
      if (e.key === "Escape") {
        if (isActive) deactivate();
        return;
      }

      // Check for Cmd+C
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
        if (isActive) return; // Already active

        if (!isWaitingForActivation) {
          isWaitingForActivation = true;

          // 1. Timer Trigger
          activationTimer = setTimeout(() => {
            activate();
            isWaitingForActivation = false;
          }, 1000); // 1 sec hold
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      if (
        e.key === "Meta" ||
        e.key === "Control" ||
        e.key.toLowerCase() === "c"
      ) {
        if (isWaitingForActivation) {
          // Released before activation
          clearTimeout(activationTimer);
          isWaitingForActivation = false;
        }
      }
    });

    // Movement Trigger (while waiting for activation)
    window.addEventListener("mousemove", () => {
      if (isWaitingForActivation && !isActive) {
        // If we move while holding, ACTIVATE
        clearTimeout(activationTimer); // Clear timer, we are activating immediately
        activate();
        isWaitingForActivation = false;
      }
    });

    // Normal Overlay Logic (Only if Active)
    window.addEventListener("mouseover", (e) => {
      if (!isActive) return;
      if (lockedTarget) return;

      const target = e.target as HTMLElement;
      // Ignore body/html/overlay
      if (
        target === document.body ||
        target === document.documentElement ||
        overlay.contains(target)
      ) {
        overlay.style.display = "none";
        return;
      }
      updateOverlay(target);
    });

    document.addEventListener("mouseout", (e) => {
      if (!isActive) return;
      if (!e.relatedTarget) {
        overlay.style.display = "none";
      }
    });

    // Capture Clicks for logic
    window.addEventListener(
      "click",
      (e) => {
        if (!isActive) return;
        // Prevent default navigation during smart selection
        e.preventDefault();
        e.stopPropagation();

        const target = lockedTarget || (e.target as HTMLElement);
        const info = getComponentInfo(target);

        console.log("[Smart Selection] Clicked:", info);

        // Send message to Parent
        window.parent.postMessage(
          {
            type: "ELEMENT_CLICKED",
            payload: {
              tagName: target.tagName.toLowerCase(),
              text: target.innerText?.slice(0, 50),
              componentName: info.name,
              source: info.source,
            },
          },
          "*",
        );

        // Flash effect
        const originalBg = overlay.style.backgroundColor;
        overlay.style.backgroundColor = "rgba(255, 255, 255, 0.5)";
        setTimeout(() => {
          overlay.style.backgroundColor = originalBg;
        }, 200);
      },
      true,
    );

    // --- Double Click to Edit ---
    window.addEventListener(
      "dblclick",
      (e) => {
        // Only allow if we are not already editing
        if (e.defaultPrevented) return;

        const target = e.target as HTMLElement;
        const info = getComponentInfo(target);

        // Only allow text editing on leaf nodes or specific text containers
        // Simple heuristic: Does it have direct text content?
        // Note: innerText includes children. valid checks: invalid if has many generic children?
        // Let's just try enabling it.

        // Safety: Don't edit inputs that are already inputs
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

        console.log("[Smart Edit] Double click on", target);

        e.preventDefault();
        e.stopPropagation();

        const originalText = target.innerText; // Keep innerText for replacement mapping
        const originalContent = target.innerHTML; // Backup full HTML in case we need to revert complicated structures

        target.contentEditable = "true";
        target.focus();

        // Visual cue
        const originalOutline = target.style.outline;
        target.style.outline = "2px solid #6366f1"; // Indigo focus ring

        // Check if selection was active before we started editing
        const wasActive = isActive;

        // Disable Smart Selection while editing
        isActive = false;
        overlay.style.display = "none";

        // Toast
        showToast("Text Editing Mode: Enter to save, Esc to cancel");

        let isFinished = false;

        const cleanup = () => {
          if (isFinished) return;
          isFinished = true;

          // Restore previous state
          isActive = wasActive;

          // If it was active, ensure overlay logic can resume (mouseover will handle display)

          target.contentEditable = "false";

          // Explicitly remove the property to fall back to CSS
          if (originalOutline) {
            target.style.outline = originalOutline;
          } else {
            target.style.removeProperty("outline");
          }

          target.removeEventListener("keydown", onKey);
          target.removeEventListener("blur", onBlur);

          // Force focus loss if still focused
          if (document.activeElement === target) {
            target.blur();
          }
        };

        const commit = () => {
          if (isFinished) return;
          // Delay commit slightly to allow blur to settle? No, synchronous is better.
          const newText = target.innerText;
          cleanup();

          if (newText === originalText) return; // No change

          console.log(
            "[Smart Edit] Committing change:",
            originalText,
            "->",
            newText,
          );

          // Notify Parent
          window.parent.postMessage(
            {
              type: "TEXT_UPDATE",
              payload: {
                source: info.source,
                originalText, // We send the ORIGINAL text so the backend can find-and-replace it
                newText,
                componentName: info.name,
              },
            },
            "*",
          );
        };

        const revert = () => {
          if (isFinished) return;
          target.innerHTML = originalContent; // Restore innerHTML to be safe
          cleanup();
          showToast("Edit cancelled");
        };

        const onKey = (ev: KeyboardEvent) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            // We call commit directly here, instead of blur(), to avoid double-firing risk
            // causing race conditions.
            commit();
          } else if (ev.key === "Escape") {
            ev.preventDefault();
            revert();
          }
        };

        const onBlur = () => {
          if (isFinished) return;
          commit(); // Auto-save on blur
        };

        target.addEventListener("keydown", onKey);
        target.addEventListener("blur", onBlur);
      },
      true,
    );
  })();
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
