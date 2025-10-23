# Formlink Integration System: Specifications and Risks

**Document Version:** 1.0
**Date:** October 22, 2025

## 1\. Introduction & Goal

**1.1. Goal:**
To enable users of various AI code generation platforms (including Google AI Studio, v0, and Vite-based platforms like Lovable/Replit/Bolt) to easily link the generated React component's _original source code_ to the "Formlink" service. This linking is initiated via a "Link with Formlink" button embedded within the generated component's preview environment. The button's core function is to intelligently detect the preview platform and use the appropriate mechanism to retrieve the component's source code before redirecting the user to Formlink.

**1.2. Purpose:**
This system facilitates the saving, versioning, sharing, and potential activation of AI-generated forms/components through the central Formlink platform. It aims to bridge the gap between AI generation sandboxes and a persistent form management/submission service.

**1.3. Core Challenge Addressed:**
Client-side JavaScript running in a browser preview (especially within sandboxed iframes or across different origins) faces significant limitations in accessing its own source code due to browser security policies (Same-Origin Policy) and the lack of filesystem access. Platform-specific mechanisms (APIs, dev server configurations, bundler features) are often required, necessitating an adaptable approach.

## 2\. Explored & Discarded Approaches

Several methods for source code retrieval were considered and deemed unsuitable for a universal, client-side, single-file solution:

- **Filesystem Access (`fs`):** Only works server-side (e.g., Next.js Server Components), requires multiple files, and is unavailable in client-only preview environments like v0 or AI Studio.
- **Bundler-Specific Features (`?raw`):** Effective in Vite/Bun environments but not supported by default in Next.js/Turbopack or custom environments like v0. Requires specific AI instruction.
- **Fetching Compiled Code (`blob:` URLs):** The compiled code (e.g., using `_jsxDEV`) found in environments like v0 is not portable to standard build systems (like Next.js) which expect raw JSX. Imports also often rely on environment-specific URLs (`blob:` or aliases).
- **Cross-Origin Interception (Parent Window -\> Iframe):** Blocked by the browser's Same-Origin Policy. A script in one origin cannot access or modify the execution context (including network requests) of another origin.
- **Backend Automation (Puppeteer):** Fails in practice because preview environments often require the user's active browser session cookies/authentication, which are not present in a separate Puppeteer instance.
- **v0 API (`/api/blocks/source`):** Platform-specific and requires authentication likely unavailable to the preview iframe.

## 3\. Chosen Approach: Environment Detection & Adapted Retrieval

The system will rely on logic embedded _within the generated component_ (primarily provided via the `@formlink/runtime` package) to attempt retrieval of a `.txt` copy of the component's source code. If this fails, specific error handling (especially for v0) can guide the user/AI to create this file. Standard bundler features (`?raw`) will be used where applicable (Vite) as a priority.

## 4\. Core Workflow

1.  **AI Generates Component & `.txt` Copy:** User prompts AI. AI generates a React component file (e.g., `MyFormComponent.tsx`) _and_ an identical copy named `MyFormComponent.tsx.txt`, following Section 5 specifications.
2.  **User Previews Component:** Component renders in the platform's preview environment.
3.  **User Clicks "Link with Formlink":** Button (likely from `@formlink/runtime`) is clicked.
4.  **Environment Detection & Code Retrieval (`getSourceCode()`):**
    - Button logic determines platform or attempts default method.
    - Attempts to retrieve source code using the _best_ method:
      - **Vite-based (Priority):** Use pre-imported `?raw` string if available.
      - **Other Platforms (AI Studio, v0, Claude/ChatGPT Previews - Default Attempt):** `fetch` the expected `.txt` file copy (e.g., `fetch('/MyFormComponent.tsx.txt')`).
    - **Error Handling:** If retrieval fails (e.g., `?raw` variable missing, `.txt` file doesn't exist/fetch fails):
      - **v0:** Throw specific `V0CopyError` instructing creation/regeneration of the `.txt` file via AI.
      - **Other Platforms:** Throw a generic error instructing creation/regeneration of the `.txt` file via AI.
5.  **Redirection to Formlink:**
    - **On Success:** Construct `GET` URL (`/create?formId=...&sourceCode=...&origin=...`) and redirect. _(Note: Monitor URL length limits)._
    - **On Failure:** Display user-friendly error message with instructions within the preview. Do not redirect.
6.  **Formlink Processing (User Confirmation Flow):**
    - User lands on Formlink `/create?...` URL.
    - Formlink prompts user to log in if not already authenticated.
    - Formlink presents a UI ("Confirm New Form" or "Update Existing Form") pre-filled/based on the `formId`, `sourceCode`, and `origin` from the URL. A preview or summary derived from `sourceCode` should be shown.
    - User confirms details, potentially names the form, and saves/updates the form definition in their Formlink account.
7.  **(Subsequent Use):** Form is managed via Formlink. Embedded forms (if the user hosts the generated code elsewhere) submit data to a Formlink `/submit/{formId}` endpoint.

## 5\. Component Generation Specifications (Instructions for AI)

The AI code generation model _must_ adhere to the following:

- **5.1. File Structure:** Generate **two files**:
  - The primary React component file (e.g., `MyFormComponent.tsx`). Start with `'use client';` if targeting Next.js.
  - An exact plain text copy named `MyFormComponent.tsx.txt`.
- **5.2. Core Component:** Implement user-requested UI/logic in the `.tsx` file.
- **5.3. Versioning/Identification (in `.tsx` file):**
  - **`formId` (UUID v4):** Embed `const formId = 'GENERATED_UUID_HERE';`. **AI must reuse existing `formId` during code updates.**
  - **`initialPreviewUrl` (Optional):** Embed if known by AI context: `const initialPreviewUrl = 'URL_IF_KNOWN';`.
- **5.4. Embed "Link with Formlink" Button (in `.tsx` file):**
  - Import the button component: `import { LinkWithFormlinkButton } from '@formlink/runtime';`
  - Render the button: `<LinkWithFormlinkButton />`.
  - **Crucial:** Embed the _expected path to the `.txt` file_ (relative to the preview server root): `const sourceCodeTxtPath = '/MyFormComponent.tsx.txt';` (AI must use the correct generated filename).
- **5.5. Button Component (`LinkWithFormlinkButton` - Provided by `@formlink/runtime`):**
  - This component (shipped in the npm package) contains the core logic.
  - It reads `formId` and `sourceCodeTxtPath` constants from the scope where it's rendered (or receives them as props). It should also check for `sourceCodeString` if `?raw` is used.
  - Implements `useState` for loading/error feedback.
  - Implements `onClick` handler orchestrating `getSourceCode()` and redirection/error display.
  - Implements `getSourceCode()` function (See Section 6).
- **5.6. Vite-Specific Handling:**
  - If the AI _knows_ it's targeting a Vite environment, it should _also_ include the `?raw` import in the `.tsx` file: `import sourceCodeString from './MyFormComponent.tsx?raw';`. The button component (Section 6) will prioritize this.

## 6\. Environment-Specific Logic (`getSourceCode()` in `@formlink/runtime`)

The `getSourceCode` function, part of the `LinkWithFormlinkButton` component in the `@formlink/runtime` package, must implement:

- **6.1. Detection/Prioritization:**

  ```javascript
  async function getSourceCode() {
    // Assume sourceCodeString, sourceCodeTxtPath are available in scope or via props

    // Priority 1: Check for ?raw import (Vite/Bun)
    if (
      typeof sourceCodeString === "string" &&
      sourceCodeString.trim() !== ""
    ) {
      console.log("Using sourceCodeString via ?raw import.");
      return sourceCodeString;
    }

    // Priority 2: Attempt to fetch the .txt file
    if (
      typeof sourceCodeTxtPath !== "string" ||
      sourceCodeTxtPath.trim() === ""
    ) {
      throw new Error(
        "@formlink/runtime: Configuration Error - sourceCodeTxtPath constant is missing or empty in the generated component.",
      );
    }

    console.log(`Attempting to fetch source from: ${sourceCodeTxtPath}`);
    try {
      const response = await fetch(sourceCodeTxtPath);
      if (!response.ok) {
        const hostname = window.location.hostname;
        const errorMsg = `Fetch Error (${response.status}): ${sourceCodeTxtPath} not found.`;

        // Throw specific error for v0 autofix trigger
        if (hostname.endsWith("vusercontent.net")) {
          throw new V0CopyError( // Specific error class defined in Section 8
            "COPY_TXT_FILE_MISSING",
            `v0 Error: ${errorMsg} Autofix needed to create the .txt file.`,
            sourceCodeTxtPath, // Pass path to error constructor
          );
        } else {
          // Generic error for other platforms
          throw new Error(
            `${errorMsg} Please ensure the AI generated a '.txt' copy of the component source code alongside the '.tsx' file.`,
          );
        }
      }
      const textContent = await response.text();
      console.log("Successfully fetched source from .txt file.");
      return textContent;
    } catch (error) {
      // Re-throw specific V0 error or wrap other fetch-related errors
      if (error instanceof V0CopyError) throw error;
      console.error("Fetch failed:", error);
      throw new Error(
        `@formlink/runtime: Failed to fetch source code - ${error.message}`,
      );
    }
  }
  ```

## 7\. Formlink Backend Requirements

- **7.1. `/create` Endpoint (GET):**
  - Accepts `formId` (string, UUID), `sourceCode` (string, URL-encoded), `origin` (string, URL-encoded) as query parameters.
  - **Authentication:** Checks for an active Formlink user session. If none, redirects the user to the Formlink login page, potentially preserving the original `/create` URL parameters for redirection after login.
  - **UI Flow:** After ensuring the user is authenticated, displays a dedicated page (e.g., "Link New Form" or "Update Existing Form").
    - This UI should clearly display the `formId` and `origin`.
    - It should present the received `sourceCode` (e.g., in a read-only code viewer).
    - Provide fields for the user to name/describe the form.
    - Include a "Save" or "Update" button.
  - **Persistence:** Upon user clicking "Save/Update", the backend validates the action (e.g., does the `formId` already exist for this user?) and saves/updates the form definition (including the `sourceCode`, `origin`, user-provided name, etc.) associated with the authenticated user and the `formId`.
- **7.2. `/submit/{formId}` Endpoint (POST):**
  - Publicly accessible endpoint accepting POST requests with form submission data (e.g., JSON body).
  - **Security Critical:** Must perform rigorous server-side validation against the schema/rules associated with `formId` in the database. **Never trust client-side data.**
  - **Security Critical:** Must implement robust anti-spam (CAPTCHA highly recommended, rate limiting essential) and anti-abuse measures.
  - Stores valid submission data associated with `formId`.
  - Handles configured post-submission actions (notifications, integrations, redirects specified by the form owner).
  - Returns appropriate JSON success or error response.
- **7.3. Schema Management:** Formlink needs a strategy to define/update the expected data schema and validation rules for each `formId`. This could be:
  - Automatically inferred/parsed from the `sourceCode` upon linking (complex, potentially brittle).
  - Manually configured by the form owner in the Formlink UI after linking.
  - A combination of both.

## 8\. v0 Autofix Mechanism

- **8.1. Custom Error Class (`V0CopyError` - Defined within `@formlink/runtime`):**
  ```javascript
  class V0CopyError extends Error {
    constructor(code, message, txtFilePath) {
      super(message);
      this.name = "V0CopyError";
      this.code = code; // e.g., 'COPY_TXT_FILE_MISSING'
      this.txtFilePath = txtFilePath; // Store the path that failed
      this.resolutionSteps = [
        `1. **Problem:** The file '${txtFilePath || "COMPONENT_NAME.tsx.txt"}' needed for code copying was not found in the preview environment.`,
        "2. **Solution:** Ask the AI to regenerate the code, specifically instructing it to create *two* files:",
        "   - The component code (e.g., `COMPONENT_NAME.tsx`)",
        "   - An exact plain text copy named `COMPONENT_NAME.tsx.txt`",
        "3. **Alternative:** If possible in v0, manually create a copy of the component's `.tsx` file and save it with the `.tsx.txt` extension in the same directory.",
        "4. **Rerun:** After ensuring the `.txt` file exists and is served by the preview, the 'Link with Formlink' button should function correctly.",
      ];
    }
  }
  ```
- **8.2. v0 Platform Responsibility:**
  - v0's parent window/environment must listen for errors originating from the preview iframe (`vusercontent.net`).
  - Detect if the caught error `is an instance of V0CopyError` (checking `error.name === 'V0CopyError'`) and if `error.code === 'COPY_TXT_FILE_MISSING'`.
  - If detected, trigger v0's autofix UI/workflow.
  - Present the detailed `error.resolutionSteps` to the user, perhaps suggesting they relay step \#2 back to the AI. Automatically creating the file might be difficult, so guiding the user/AI is the primary goal.

## 9\. Risk Analysis (Fragility Points)

- **9.1. AI Generation Reliability:** High risk. AI must consistently generate _two_ files with identical content but different extensions, correctly embed the `.txt` path constant, and reliably reuse the `formId` during updates. Failures lead to non-functional buttons or broken linking.
- **9.2. Platform Dependency & File Serving:** Moderate risk. Relies on preview platforms serving `.txt` files alongside `.tsx` files via predictable paths accessible to `fetch`. If a platform changes its file serving behavior, disables `.txt` access, or uses unpredictable paths, the primary retrieval method breaks. Vite `?raw` remains a separate dependency.
- **9.3. Code Retrieval Complexity:** Reduced compared to multi-API approach, but error handling (especially differentiating v0 errors for autofix) remains crucial and adds complexity to the `@formlink/runtime` package.
- **9.4. Code Drift (Synchronization):** High risk. The `.tsx` file (live component) and the `.tsx.txt` file (source for linking) could diverge if modified independently. Furthermore, the component code hosted on Platform X can still diverge from the definition stored in Formlink after initial linking, leading to submission validation issues. [Image representing diverging code versions]
- **9.5. Security (Formlink Backend):** High risk. Public `/submit` endpoints require robust protection against spam, abuse, and validation bypass attempts common to all web forms.
- **9.6. Scalability & Maintenance:**
  - **URL Length Limits:** High risk for `GET /create`. Large source code strings will easily exceed typical browser/server URL length limits, causing linking to fail. **A POST request for `/create` is strongly recommended.**
  - API versioning for `/submit` and `/create` is needed for future changes. Debugging across AI output, platform behavior, and Formlink backend remains complex.

## 10\. Mitigation Strategies

- **AI Reliability:** Use very clear, structured prompts emphasizing the two-file output requirement, `formId` reuse, and constant embedding. Validate AI output where possible.
- **Platform Dependency:** Test the `.txt` fetch method across target platforms. Ensure error messages clearly guide the user if fetch fails (e.g., "Ask AI to create FileName.tsx.txt"). Rely on `?raw` detection as a more robust path for Vite.
- **Code Retrieval:** Implement thorough error handling within the `@formlink/runtime` package. Ensure `V0CopyError` contains actionable steps.
- **Code Drift:** Formlink _must_ perform strict server-side validation based on the schema established _at the time of linking/saving_. Document clearly that modifying the live component might break submissions unless the Formlink definition is updated. Consider adding a "re-sync from source" feature in Formlink (though complex).
- **Security:** Prioritize Formlink backend security for the `/submit` endpoint: CAPTCHA, rate limiting (IP & `formId`), honeypots, strict input sanitization, comprehensive server-side validation. Allow form owners to enable/disable submissions per form.
- **Scalability/Maintenance:** **Strongly recommend changing `/create` to use POST** to handle arbitrary source code length. Implement versioning for Formlink APIs. Add detailed logging client-side (`@formlink/runtime`) and server-side (Formlink). Provide debugging guides.
