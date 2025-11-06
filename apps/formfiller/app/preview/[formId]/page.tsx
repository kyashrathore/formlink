// Server-only: use shared helper to fetch schema
import { getFormSchemaById } from "@/app/lib/getFormSchema";
import { notFound } from "next/navigation";
import PreviewPageClient from "./PreviewPageClient";

export const dynamic = "force-dynamic";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const awaitedParams = await params;
  const formId = awaitedParams?.formId;

  if (!formId) {
    notFound();
  }

  const formSchema = await getFormSchemaById(formId);

  if (!formSchema) {
    notFound();
  }

  // Always set test mode for preview
  const isTestSubmission = true;

  const themeOverrides = (formSchema.settings as any)?.theme_overrides || {};
  const shadcnCss =
    typeof themeOverrides.shadcn_css === "string"
      ? themeOverrides.shadcn_css
      : null;
  const themeMode =
    (themeOverrides.theme_mode as "light" | "dark" | "system" | undefined) ||
    "dark";

  const initialThemeScript = `!(function(){try{var d=document.documentElement;d.classList.remove('light','dark');var m=${JSON.stringify(themeMode)};if(m==='dark')d.classList.add('dark');else if(m==='light')d.classList.add('light');else if(m==='system'){var prefersDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;if(prefersDark)d.classList.add('dark');else d.classList.add('light');}}catch(e){}})();`;

  return (
    <>
      {shadcnCss ? (
        <style
          id="initial-formlink-theme"
          dangerouslySetInnerHTML={{ __html: shadcnCss }}
        />
      ) : null}
      <script dangerouslySetInnerHTML={{ __html: initialThemeScript }} />
      {/* diagnostics script removed (logs) */}
      <PreviewPageClient
        formSchema={formSchema}
        isTestSubmission={isTestSubmission}
      />
    </>
  );
}
