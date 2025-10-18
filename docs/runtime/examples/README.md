# Examples — Formlink Runtime/UI/Chat (v1)

These files show what a code generation platform can emit directly, assuming the following packages exist:

- `@formlink/runtime` — headless runtime (non-chat)
- `@formlink/ui` — UI components
- `@formlink/chat` — chat ResponseWrapper

Files

- `job-application-sde2-stripe.tsx` — Typeform-like flow with resume upload.
- `waitlist-typeform.tsx` — One-by-one waitlist for a website.
- `chat-pain-points.tsx` — ai-sdk chat with ResponseWrapper.
- `branching-feedback-router.tsx` — Classic page with branching by visibility.

Notes

- These examples focus on wiring (`context`/`actions`) and keep validation/branching in the runtime.
- Chat examples do not run the runtime client-side; the backend owns validation and slot emission.
- Replace any `any` types with your repo’s `Form` type when available.
