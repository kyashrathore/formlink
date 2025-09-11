// Server-only: use shared helper to fetch schema
import { notFound } from "next/navigation";
import PreviewPageClient from "./PreviewPageClient";
import { getFormSchemaById } from "@/app/lib/getFormSchema";

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
      <script
        // diagnostics: log SSR theme presence in preview iframe before hydration
        dangerouslySetInnerHTML={{
          __html: `try{(function(){
            var st=document.getElementById('initial-formlink-theme');
            var len=st&&st.textContent?st.textContent.length:0;
            var hasDark=st&&/\.dark\s*\{/.test(st.textContent||'');
            var vsn = (function(){try{var fs=${JSON.stringify(formSchema)};return fs.version_id===fs.current_draft_version_id?'draft':'published';}catch{return 'unknown'}})();
            console.info('[Formlink][SSR][Preview] injected', { cssLength: len, hasDark: !!hasDark, themeMode: ${JSON.stringify(themeMode)}, versionStatus: vsn });
          })()}catch(e){console.warn('[Formlink][SSR][Preview] diag error',e)};`,
        }}
      />
      <PreviewPageClient
        formSchema={formSchema}
        isTestSubmission={isTestSubmission}
      />
    </>
  );
}
