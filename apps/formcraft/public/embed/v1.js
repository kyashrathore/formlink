(() => {
  // PHASE 1: Singleton Iframe Initialization and Preloading

  let globalIframeElements = null;

  const commonStyles = `
      .formlink-iframe-container {
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.5s ease, visibility 0.5s ease;
        position: fixed;
        top: -9999px;
        left: -9999px;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.2);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .formlink-iframe-container.show {
        opacity: 1;
        visibility: visible;
        top: 0;
        left: 0;
      }
      .formlink-iframe-container iframe {
        border: 1px solid #80808000;
        border-radius: 2rem;
        opacity: 0; 
        transition: transform 0.5s ease, opacity 0.5s ease;
        background-color: white; 
        width: 90%; 
        height: 90%; 
      }
      .formlink-iframe-container.show:not(.loading) iframe {
        opacity: 1;
        visibility: visible;
      }
      .formlink-close-button {
        position: absolute;
        top: 10px;
        right: 10px;
        background-color: transparent;
        border: none;
        font-size: 2rem;
        color: white;
        cursor: pointer;
        z-index: 10000;
        background-color: rgba(250,250,250,0.8);
        height: 2rem;
        width: 2rem;
        border-radius: 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        line-height: 1;
      }
      .formlink-close-button:hover {
        background-color: rgba(250,250,250,1);
      }
      .formlink-close-button svg {
        height: 1rem;
        width: 1rem;
        color: black;
      }
      .formlink-iframe-container.loading iframe {
        opacity: 0 !important; 
        visibility: hidden !important;
      }
      .formlink-loader {
        display: none; 
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        border: 5px solid #f3f3f3; 
        border-top: 5px solid #gray; 
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        z-index: 1; 
      }
      .formlink-iframe-container.loading .formlink-loader {
        display: block; 
      }
      @keyframes spin {
        0% { transform: translate(-50%, -50%) rotate(0deg); }
        100% { transform: translate(-50%, -50%) rotate(360deg); }
      }
      .formlink-iframe-container.modal iframe {
        width: 90%;
        max-width: 60rem;
        height: 90%;
        transform: translateY(10%);
      }
      .formlink-iframe-container.modal.show:not(.loading) iframe {
        transform: translateY(0);
        opacity: 1;
        visibility: visible;
      }
      .formlink-iframe-container.modal.loading iframe {
        transform: translateY(10%);
      }
      .formlink-iframe-container.slider iframe {
        border-radius: 0; 
        height: 100%;
        max-width: 35rem;
        width: 90%;
      }
      .formlink-iframe-container.slider.slider-right {
        justify-content: flex-end;
      }
      .formlink-iframe-container.slider.slider-right iframe {
        transform: translateX(100%);
        border-top-left-radius:1rem; 
        border-bottom-left-radius:1rem; 
      }
      .formlink-iframe-container.slider.slider-right.show:not(.loading) iframe {
        transform: translateX(0);
        opacity: 1;
        visibility: visible;
      }
      .formlink-iframe-container.slider.slider-right.loading iframe {
        transform: translateX(100%);
      }
      .formlink-iframe-container.slider.slider-left {
        justify-content: flex-start;
      }
      .formlink-iframe-container.slider.slider-left iframe {
        transform: translateX(-100%);
        border-top-right-radius: 1rem; 
        border-bottom-right-radius: 1rem; 
      }
      .formlink-iframe-container.slider.slider-left.show:not(.loading) iframe {
        transform: translateX(0);
        opacity: 1;
        visibility: visible;
      }
      .formlink-iframe-container.slider.slider-left.loading iframe {
        transform: translateX(-100%);
      }
    `;
  const chatbotStyles = `
      .formlink-iframe-container.chatbot {
        background-color: transparent; 
        pointer-events: none; 
        align-items: flex-end;
      }
      .formlink-iframe-container.chatbot iframe {
        pointer-events: auto; 
        width: 90%;
        max-width: 550px;
        height: 90vh;
        max-height: calc(100vh - 40px);
        border-radius: 1rem; 
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
        margin-bottom: 20px;
        transform: translateY(calc(5% + 20px));
        border: 1px solid #80808000;
      }
      .formlink-iframe-container.chatbot.show:not(.loading) iframe {
        transform: translateY(0);
        opacity: 1;
        visibility: visible;
      }
      .formlink-iframe-container.chatbot.loading iframe {
        transform: translateY(calc(5% + 20px));
      }
      .formlink-iframe-container.chatbot.chatbot-right {
        justify-content: flex-end;
      }
      .formlink-iframe-container.chatbot.chatbot-right iframe {
        margin-right: 20px;
      }
      .formlink-iframe-container.chatbot.chatbot-left {
        justify-content: flex-start;
      }
      .formlink-iframe-container.chatbot.chatbot-left iframe {
        margin-left: 20px;
      }
      .formlink-iframe-container.chatbot .formlink-close-button {
        pointer-events: auto; 
        position: absolute;
        top: auto;
        bottom: calc(90vh + 5px); 
        right: 10px;
        transform: translateY(calc(-100% - 5px));
      }
      .formlink-iframe-container.chatbot.chatbot-right .formlink-close-button {
        right: 30px; 
        left: auto;
      }
      .formlink-iframe-container.chatbot.chatbot-left .formlink-close-button {
        left: 30px; 
        right: auto;
      }
      .formlink-iframe-container.chatbot .formlink-loader {
        top: auto;
        bottom: 45vh; 
        left: 50%;
        transform: translate(-50%, 50%);
      }
      .formlink-iframe-container.chatbot.chatbot-right .formlink-loader {
        left: auto;
        right: calc(50% - 10px); 
        transform: translate(50%, 50%);
      }
      .formlink-iframe-container.chatbot.chatbot-left .formlink-loader {
        right: auto;
        left: calc(50% + 10px); 
        transform: translate(-50%, 50%);
      }
    `;

  function injectGlobalStyles() {
    if (document.getElementById("formlink-dynamic-styles")) return;
    const styleElement = document.createElement("style");
    styleElement.id = "formlink-dynamic-styles";
    styleElement.textContent = commonStyles + chatbotStyles;
    document.head.appendChild(styleElement);
  }

  // Helper: Lock/unlock body scroll with scrollbar compensation
  function lockBodyScroll() {
    if (!document.body.classList.contains("formlink-scroll-locked")) {
      const scrollBarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = scrollBarWidth + "px";
      }
      document.body.style.overflow = "hidden";
      document.body.classList.add("formlink-scroll-locked");
    }
  }
  function unlockBodyScroll() {
    if (document.body.classList.contains("formlink-scroll-locked")) {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
      document.body.classList.remove("formlink-scroll-locked");
    }
  }

  // Helper: Trap focus within container
  function trapFocus(container, firstFocusEl) {
    function getFocusableEls() {
      return [
        ...container.querySelectorAll("button.formlink-close-button, iframe"),
      ].filter(
        (el) =>
          el.tabIndex !== -1 &&
          !el.disabled &&
          (el.offsetWidth > 0 || el.offsetHeight > 0)
      );
    }
    function handleKeydown(e) {
      if (e.key !== "Tab") return;
      const focusableEls = getFocusableEls();
      if (focusableEls.length === 0) return;
      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];
      const active = document.activeElement;
      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      }
    }
    container.__formlinkFocusHandler = handleKeydown;
    container.addEventListener("keydown", handleKeydown);
    if (firstFocusEl) firstFocusEl.focus();
  }
  function untrapFocus(container) {
    if (container.__formlinkFocusHandler) {
      container.removeEventListener(
        "keydown",
        container.__formlinkFocusHandler
      );
      delete container.__formlinkFocusHandler;
    }
  }

  // PHASE 1: Singleton Iframe Management
  function getOrCreateFormlinkContainer(initialConfig) {
    if (globalIframeElements) return globalIframeElements;

    // Create elements
    const iframeContainer = document.createElement("div");
    iframeContainer.className = "formlink-iframe-container";
    // Initial hidden state
    iframeContainer.style.top = "-9999px";
    iframeContainer.style.left = "-9999px";
    iframeContainer.style.opacity = "0";
    iframeContainer.style.visibility = "hidden";
    iframeContainer.style.display = "flex";

    const iframe = document.createElement("iframe");
    iframe.title = (initialConfig && initialConfig.title) || "Embedded Content";

    const loader = document.createElement("div");
    loader.className = "formlink-loader";
    iframeContainer.appendChild(loader);

    const closeButton = document.createElement("button");
    closeButton.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>';
    closeButton.className = "formlink-close-button";
    closeButton.setAttribute("aria-label", "Close Form");

    iframeContainer.appendChild(iframe);
    iframeContainer.appendChild(closeButton);

    // Set type/side classes if provided
    const type = (initialConfig && initialConfig.type) || "modal";
    const side = (initialConfig && initialConfig.side) || "right";
    iframeContainer.classList.add(type);
    if (type === "slider") iframeContainer.classList.add(`slider-${side}`);
    if (type === "chatbot") iframeContainer.classList.add(`chatbot-${side}`);

    // State
    let currentHref = null;
    let openerButton = null;

    // Escape key handler
    function handleEscape(e) {
      if (e.key === "Escape" && iframeContainer.classList.contains("show")) {
        hideIframe();
      }
    }

    function hideIframe() {
      iframeContainer.classList.remove("show");
      unlockBodyScroll();
      untrapFocus(iframeContainer);
      window.removeEventListener("keydown", handleEscape, true);
      if (openerButton) openerButton.focus();
      // Hide out of flow
      iframeContainer.style.top = "-9999px";
      iframeContainer.style.left = "-9999px";
      iframeContainer.style.opacity = "0";
      iframeContainer.style.visibility = "hidden";
    }

    closeButton.addEventListener("click", (e) => {
      e.stopPropagation();
      hideIframe();
    });
    iframeContainer.addEventListener("click", (e) => {
      if (
        e.target === iframeContainer &&
        !iframeContainer.classList.contains("chatbot")
      ) {
        hideIframe();
      }
    });

    iframe.addEventListener("load", () => {
      iframeContainer.classList.remove("loading");
    });
    iframe.addEventListener("error", () => {
      console.error("Formlink: Failed to load iframe content:", currentHref);
      iframeContainer.classList.remove("loading");
    });

    document.body.appendChild(iframeContainer);

    // Preload if initialConfig.href is provided
    if (initialConfig && initialConfig.href) {
      iframe.src = initialConfig.href;
      currentHref = initialConfig.href;
      iframeContainer.classList.add("loading");
    }

    globalIframeElements = {
      iframeContainer,
      iframe,
      closeButton,
      loader,
      get currentHref() {
        return currentHref;
      },
      set currentHref(href) {
        currentHref = href;
      },
      get openerButton() {
        return openerButton;
      },
      set openerButton(btn) {
        openerButton = btn;
      },
      handleEscape,
      hideIframe,
    };
    return globalIframeElements;
  }

  // PHASE 2: Trigger Logic for Reusability
  function initializeDivTrigger(divElement) {
    if (divElement.dataset.formlinkInitialized === "true") return;
    divElement.dataset.formlinkInitialized = "true";

    const config = {
      href: divElement.dataset.href,
      type: divElement.dataset.type || "modal",
      side: divElement.dataset.side || "right",
      title: divElement.dataset.title || "Form",
    };

    if (!config.href) {
      console.error(
        "Formlink trigger div requires a data-href attribute.",
        divElement
      );
      return;
    }

    const button = divElement.querySelector("button");
    if (!button) {
      console.warn(
        "Formlink trigger div is missing an inner button element.",
        divElement
      );
      return;
    }

    // Ensure global iframe exists (preload if first)
    getOrCreateFormlinkContainer(config);

    const handleClick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const {
        iframeContainer,
        iframe,
        closeButton,
        loader,
        handleEscape,
        hideIframe,
      } = globalIframeElements;

      // Set opener for focus restore
      globalIframeElements.openerButton = button;

      // Content update logic
      if (config.href !== globalIframeElements.currentHref) {
        iframe.src = config.href;
        globalIframeElements.currentHref = config.href;
        iframeContainer.classList.add("loading");
      }

      // Remove all type/side classes
      iframeContainer.classList.remove(
        "modal",
        "slider",
        "slider-right",
        "slider-left",
        "chatbot",
        "chatbot-right",
        "chatbot-left"
      );
      // Add new type/side classes
      iframeContainer.classList.add(config.type);
      if (config.type === "slider")
        iframeContainer.classList.add(`slider-${config.side}`);
      if (config.type === "chatbot")
        iframeContainer.classList.add(`chatbot-${config.side}`);

      // Show and style
      iframeContainer.style.top = "0";
      iframeContainer.style.left = "0";
      iframeContainer.style.opacity = "";
      iframeContainer.style.visibility = "";
      iframeContainer.style.display = "flex";

      requestAnimationFrame(() => {
        iframeContainer.classList.add("show");
      });

      // Lock scroll and trap focus
      lockBodyScroll();
      trapFocus(iframeContainer, closeButton);

      // Add escape key listener
      window.removeEventListener("keydown", handleEscape, true);
      window.addEventListener("keydown", handleEscape, true);
    };

    button.addEventListener("click", handleClick);
  }

  // PHASE 1/2: Preloading and Initialization
  function runInitialization() {
    injectGlobalStyles();

    const triggerDivs = document.querySelectorAll(
      "div#formlink-launch-button[data-href]"
    );

    // Preload with first valid trigger
    let firstConfig = null;
    for (const div of triggerDivs) {
      const href = div.dataset.href;
      if (href) {
        firstConfig = {
          href,
          type: div.dataset.type || "modal",
          side: div.dataset.side || "right",
          title: div.dataset.title || "Form",
        };
        break;
      }
    }
    if (firstConfig) {
      getOrCreateFormlinkContainer(firstConfig);
    }

    // Initialize all triggers
    triggerDivs.forEach((div) => {
      initializeDivTrigger(div);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runInitialization);
  } else {
    runInitialization();
  }
})();
