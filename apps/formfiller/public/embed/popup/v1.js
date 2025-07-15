!(function () {
  const t = {
    buttonBgColor: "#000000",
    buttonIconColor: "#ffffff",
    buttonIconType: "default",
  };
  let n;
  let chatbotContainer;
  let chatbotIframe;
  let chatbotButton;

  function o() {
    const o = (function () {
      const n = document.getElementsByTagName("script");
      for (let o = 0; o < n.length; o++) {
        const e = n[o];

        if (
          e.src &&
          (e.src.includes("/embed/popup/v1.js") ||
            e.hasAttribute("data-formlink-url"))
        ) {
          return {
            formUrl: e.getAttribute("data-formlink-url") || "",
            buttonBgColor:
              e.getAttribute("data-formlink-popup-bg-color") || t.buttonBgColor,
            buttonIconColor:
              e.getAttribute("data-formlink-popup-icon-color") ||
              t.buttonIconColor,
            buttonIconType:
              e.getAttribute("data-formlink-popup-icon-type") ||
              t.buttonIconType,
          };
        }
      }
      console.warn(
        "Formlink Chatbot: Could not find configuration script tag or data-formlink-url attribute."
      );
      return { ...t, formUrl: "" };
    })();

    if (!o.formUrl) {
      console.error(
        "Formlink Chatbot: data-formlink-url is required on the script tag."
      );
      return;
    }

    !(function () {
      const t = document.createElement("style");
      t.textContent = `
  .formlink-chatbot-button {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background-color: var(--button-bg-color);
    border: none;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    transition: transform 0.2s ease-out; 
  }
  
  
  .formlink-chatbot-button:hover,
  .formlink-chatbot-button:focus { 
    transform: scale(1.1);
  }
  .formlink-chatbot-button:active {
    transform: scale(0.95); 
  }
  
  .formlink-chatbot-button svg {
    width: 20px; 
    height: 20px;
    fill: var(--button-icon-color);
    transition: transform 0.3s ease; 
  }
  
  .formlink-chatbot-button.is-open svg:first-child {
    transform: scale(0); 
  }
  .formlink-chatbot-button svg:last-child {
    position: absolute; 
    transform: scale(0); 
  }
  .formlink-chatbot-button.is-open svg:last-child {
    transform: scale(1); 
  }
  
  
  .formlink-chatbot-container {
    position: fixed;
    bottom: 80px; 
    right: 20px;
    width: 400px;  
    height: 600px; 
    max-width: calc(100vw - 40px); 
    max-height: calc(100vh - 100px); 
    background-color: #fff; 
    pointer-events: none;
    z-index: 9998;
    transform: translateY(20px); 
    transition:
      opacity 0.3s ease,
      transform 0.3s ease,
      visibility 0s linear 0.3s; 
    opacity: 0;
    visibility: hidden;
    border-radius: 1rem; 
    box-shadow: 0 5px 25px rgba(0, 0, 0, 0.15); 
    overflow: hidden; 
  }
  
  .formlink-chatbot-container iframe {
    width: 100%;
    height: 100%;
    border: none;
    
    
    pointer-events: auto;
    opacity: 1; 
    transition: opacity 0.3s ease 0.1s; 
  }
  
  .formlink-chatbot-container.show {
    visibility: visible;
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
    transition:
      opacity 0.3s ease,
      transform 0.3s ease,
      visibility 0s linear 0s; 
  }
  
  
  .formlink-loader {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border: 3px solid rgba(0, 0, 0, 0.1); 
    border-top: 3px solid var(--button-bg-color, #000); 
    border-radius: 50%;
    width: 30px;
    height: 30px;
    animation: formlink-spin 1s linear infinite;
    z-index: 1; 
    display: none; 
  }
  
  .formlink-chatbot-container.loading .formlink-loader {
    display: block; 
  }
  
  .formlink-chatbot-container.loading iframe {
    opacity: 0; 
    transition: none; 
  }
  
  @keyframes formlink-spin {
    0% { transform: translate(-50%, -50%) rotate(0deg); }
    100% { transform: translate(-50%, -50%) rotate(360deg); }
  }
  
  
  
  
  @media (max-width: 480px) { 
    .formlink-chatbot-container {
      width: 100vw;
      height: calc(100vh - 70px); 
      bottom: 0;
      right: 0;
      max-height: calc(100vh - 70px);
      transform: translateY(100%); 
      border-radius: 0;
      opacity: 1; 
      box-shadow: none;
    }
  
    .formlink-chatbot-container.show {
      transform: translateY(0);
    }
  
    .formlink-chatbot-button {
      bottom: 10px; 
      right: 10px;
    }
  }
  `;
      document.head.appendChild(t);
    })();

    chatbotButton = (function (bgColor, iconColor) {
      const r = document.createElement("button");
      r.className = "formlink-chatbot-button";
      r.setAttribute("aria-label", "Open Chat");
      r.style.setProperty("--button-bg-color", bgColor);
      r.style.setProperty("--button-icon-color", iconColor);

      n =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M5.337 21.718a6.707 6.707 0 0 1-.533-.074.75.75 0 0 1-.44-1.223 3.73 3.73 0 0 0 .814-1.686c.023-.115-.022-.317-.254-.543C3.274 16.587 2.25 14.41 2.25 12c0-5.03 4.428-9 9.75-9s9.75 3.97 9.75 9c0 5.03-4.428 9-9.75 9-.833 0-1.643-.097-2.417-.279a6.721 6.721 0 0 1-4.246.997Z" clip-rule="evenodd" /></svg>';

      const closeIcon =
        '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>';

      r.innerHTML = n + closeIcon;
      return r;
    })(o.buttonBgColor, o.buttonIconColor);

    chatbotContainer = (function (formUrl) {
      const containerDiv = document.createElement("div");
      containerDiv.className = "formlink-chatbot-container";

      const loaderElement = document.createElement("div");
      loaderElement.className = "formlink-loader";

      chatbotIframe = document.createElement("iframe");
      chatbotIframe.src = "about:blank";
      chatbotIframe.title = "Chatbot";

      chatbotIframe.setAttribute(
        "referrerpolicy",
        "strict-origin-when-cross-origin"
      );

      containerDiv.appendChild(loaderElement);
      containerDiv.appendChild(chatbotIframe);

      chatbotIframe.addEventListener("load", () => {
        chatbotContainer.classList.remove("loading");
      });
      chatbotIframe.addEventListener("error", (e) => {
        console.error("Formlink Chatbot: Error loading iframe content.", e);
        chatbotContainer.classList.remove("loading");
      });

      return containerDiv;
    })(o.formUrl);

    document.body.appendChild(chatbotButton);
    document.body.appendChild(chatbotContainer);

    chatbotButton.addEventListener("click", () => {
      const isOpen = chatbotContainer.classList.contains("show");

      if (isOpen) {
        chatbotContainer.classList.remove("show");
        chatbotButton.classList.remove("is-open");
        chatbotButton.setAttribute("aria-label", "Open Chat");
      } else {
        chatbotContainer.classList.add("loading");
        chatbotContainer.classList.add("show");
        chatbotButton.classList.add("is-open");
        chatbotButton.setAttribute("aria-label", "Close Chat");

        if (chatbotIframe.src !== o.formUrl) {
          chatbotIframe.src = o.formUrl;
        } else {
          let isLikelyReady = false;
          try {
            isLikelyReady =
              chatbotIframe.contentWindow.document.readyState === "complete";
          } catch (e) {}

          if (isLikelyReady) {
            chatbotContainer.classList.remove("loading");
          } else {
            console.log(
              "Formlink Chatbot: Iframe src unchanged, waiting for load event."
            );
          }
        }
      }
    });
  }

  "loading" === document.readyState
    ? document.addEventListener("DOMContentLoaded", o)
    : o();
})();
