import React from "react";
import { FormSchema, Form } from "@formlink/schema";
import PreviewPageClient from "./PreviewPageClient";
import { createServerClient } from "@formlink/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

// Transform legacy string-based question types to new discriminated union format
function transformLegacyQuestionType(legacyQuestion: any): any {
  const { type, questionType, ...rest } = legacyQuestion;

  // Use questionType if it exists, otherwise fallback to type
  const legacyTypeValue = questionType || type;

  // If type is already an object, return as-is
  if (typeof legacyTypeValue === "object" && legacyTypeValue !== null) {
    return { ...rest, type: legacyTypeValue };
  }

  // Transform string-based types to discriminated union format
  let newType: any;

  switch (legacyTypeValue) {
    case "text":
      // For text questions, check if there's a display.inputType to use as format
      const inputType = legacyQuestion.display?.inputType;
      const format =
        inputType &&
        [
          "text",
          "email",
          "url",
          "tel",
          "number",
          "password",
          "country",
          "textarea",
        ].includes(inputType)
          ? inputType
          : "text";
      newType = { name: "text", format };
      break;
    case "email":
    case "url":
    case "tel":
    case "number":
    case "password":
    case "country":
      newType = { name: "text", format: legacyTypeValue };
      break;
    case "textarea":
      newType = { name: "text", format: "textarea" };
      break;
    case "singleChoice":
      const singleChoiceDisplay =
        legacyQuestion.display?.inputType === "dropdown" ? "dropdown" : "radio";
      newType = {
        name: "singleChoice",
        display: singleChoiceDisplay,
        options: legacyQuestion.options || [],
      };
      break;
    case "multipleChoice":
      const multipleChoiceDisplay =
        legacyQuestion.display?.inputType === "multiSelectDropdown"
          ? "multiSelectDropdown"
          : "checkbox";
      newType = {
        name: "multipleChoice",
        display: multipleChoiceDisplay,
        options: legacyQuestion.options || [],
      };
      break;
    case "rating":
      newType = {
        name: "rating",
        config: {
          min: legacyQuestion.min || 1,
          max: legacyQuestion.max || 5,
          step: legacyQuestion.step || 1,
          minLabel: legacyQuestion.minLabel,
          maxLabel: legacyQuestion.maxLabel,
        },
      };
      break;
    case "date":
      newType = { name: "date", format: "date" };
      break;
    case "dateRange":
      newType = { name: "date", format: "dateRange" };
      break;
    case "ranking":
      newType = { name: "ranking", options: legacyQuestion.options || [] };
      break;
    case "fileUpload":
      newType = { name: "fileUpload" };
      break;
    case "address":
      newType = { name: "address" };
      break;
    case "linearScale":
      newType = {
        name: "linearScale",
        config: {
          start: legacyQuestion.start || 0,
          end: legacyQuestion.end || 10,
          step: legacyQuestion.step || 1,
          startLabel: legacyQuestion.startLabel,
          endLabel: legacyQuestion.endLabel,
        },
      };
      break;
    case "likertScale":
      newType = {
        name: "likertScale",
        options: legacyQuestion.options || [],
      };
      break;
    default:
      // Fallback to text for unknown types
      newType = { name: "text", format: "text" };
      break;
  }

  return {
    ...rest,
    type: newType,
    // Ensure required fields exist
    submissionBehavior: legacyQuestion.submissionBehavior || "manualAnswer",
  };
}

async function getFormSchemaById(
  formIdOrShortId: string,
): Promise<Form | null> {
  const supabase = await createServerClient(null, "service");

  // Try to find by short_id first, then by full id
  let formData, formError;

  // First try short_id
  const shortIdResult = await supabase
    .from("forms")
    .select(
      "id, brand_id, current_published_version_id, current_draft_version_id",
    )
    .eq("short_id", formIdOrShortId)
    .single();

  if (shortIdResult.data) {
    formData = shortIdResult.data;
    formError = shortIdResult.error;
  } else {
    // If not found by short_id, try by full id
    const fullIdResult = await supabase
      .from("forms")
      .select(
        "id, brand_id, current_published_version_id, current_draft_version_id",
      )
      .eq("id", formIdOrShortId)
      .single();

    formData = fullIdResult.data;
    formError = fullIdResult.error;
  }

  if (formError || !formData) {
    if (formError && formError.code !== "PGRST116") {
      console.error(
        `Supabase error fetching form ${formIdOrShortId}:`,
        formError.message,
      );
    }
    return null;
  }

  // In preview, prefer draft if available
  let versionId = formData.current_draft_version_id;
  let versionStatus: "published" | "draft" = versionId ? "draft" : "published";
  if (!versionId) {
    versionId = formData.current_published_version_id;
    versionStatus = "published";
  }

  if (!versionId) {
    return null;
  }

  const { data: versionData, error: versionError } = await supabase
    .from("form_versions")
    .select("version_id, title, description, questions, settings")
    .eq("version_id", versionId)
    .eq("status", versionStatus)
    .single();

  if (versionError || !versionData) {
    if (versionError && versionError.code !== "PGRST116") {
      console.error(
        `Supabase error fetching ${versionStatus} version ${versionId} for form ${formIdOrShortId}:`,
        versionError.message,
      );
    }
    return null;
  }

  try {
    const rawQuestions = Array.isArray(versionData.questions)
      ? versionData.questions
      : [];

    // Transform legacy questions to new schema format
    const transformedQuestions = rawQuestions.map(transformLegacyQuestionType);

    const brandToShadcn = (
      brandTheme: any,
    ): { css?: string; mode?: "light" | "dark" | "system" } => {
      if (!brandTheme) return {};
      const css =
        (typeof brandTheme.shadcn_css === "string" &&
          brandTheme.shadcn_css.trim()) ||
        (typeof brandTheme.shadcnCss === "string" &&
          brandTheme.shadcnCss.trim()) ||
        (typeof brandTheme.css === "string" && brandTheme.css.trim()) ||
        undefined;
      const mode = (brandTheme.theme_mode || brandTheme.themeMode) as any;
      return { css, mode };
    };

    const overrides = ((versionData as any)?.settings as any)?.theme_overrides;
    try {
      console.info("[Formlink][SSR][Preview][Server] fetch summary", {
        formId: formData.id,
        shortId: formIdOrShortId,
        brandId: (formData as any)?.brand_id || null,
        versionStatus,
        versionId,
        hasOverrides: Boolean(overrides),
        cssLen: (overrides?.shadcn_css || "").length || 0,
        mode: overrides?.theme_mode || null,
      });
    } catch {}

    // Choose a single source: form overrides > brand > none
    let source: "form" | "brand" | "default" = "default";
    let effectiveThemeOverrides:
      | { shadcn_css?: string; theme_mode?: "light" | "dark" | "system" }
      | undefined;
    const hasFormCss = Boolean(
      overrides?.shadcn_css && overrides.shadcn_css.trim(),
    );
    const hasFormMode = Boolean(overrides?.theme_mode);
    if (hasFormCss || hasFormMode) {
      source = "form";
      effectiveThemeOverrides = {
        ...(hasFormCss ? { shadcn_css: overrides!.shadcn_css } : {}),
        ...(hasFormMode ? { theme_mode: overrides!.theme_mode } : {}),
      };
    } else {
      const brandId = (formData as any)?.brand_id as string | null;
      if (brandId) {
        try {
          const { data: brandData } = await supabase
            .from("brands")
            .select("theme")
            .eq("brand_id", brandId)
            .single();
          const brandTheme = (brandData as any)?.theme || {};
          const norm = brandToShadcn(brandTheme);
          const hasBrandCss = Boolean(norm.css && norm.css.length);
          const hasBrandMode = Boolean(norm.mode);
          if (hasBrandCss || hasBrandMode) {
            source = "brand";
            effectiveThemeOverrides = {
              ...(hasBrandCss ? { shadcn_css: norm.css } : {}),
              ...(hasBrandMode ? { theme_mode: norm.mode as any } : {}),
            };
          }
          console.info("[Formlink][SSR][Preview][Server] brand check", {
            brandId,
            hasBrandCss,
            hasBrandMode,
          });
        } catch {
          // ignore
        }
      }
    }

    const formSchemaResult = {
      id: formData.id,
      short_id: formIdOrShortId,
      version_id: versionData.version_id,
      title: versionData.title,
      description: versionData.description,
      questions: transformedQuestions,
      settings: {
        ...((typeof versionData.settings === "object" &&
        versionData.settings !== null
          ? (versionData.settings as any)
          : {}) as any),
        ...(effectiveThemeOverrides
          ? { theme_overrides: effectiveThemeOverrides }
          : {}),
      },
      current_published_version_id: formData.current_published_version_id,
      current_draft_version_id: formData.current_draft_version_id,
    };

    const validationResult = FormSchema.safeParse(formSchemaResult);
    if (!validationResult.success) {
      console.error(
        `Server Schema Validation Error for form ${formData.id} (version ${versionData.version_id}):`,
        JSON.stringify(validationResult.error.errors, null, 2),
      );
      console.error(
        "Form data being validated:",
        JSON.stringify(formSchemaResult, null, 2),
      );

      return null;
    }

    // Preserve theme_overrides even if schema strips unknown keys
    const parsed = validationResult.data;
    const injectedOverrides = (formSchemaResult.settings as any)
      ?.theme_overrides;
    if (injectedOverrides) {
      parsed.settings = {
        ...(parsed.settings as any),
        theme_overrides: injectedOverrides,
      } as any;
    }
    try {
      const eff = (parsed.settings as any)?.theme_overrides || {};
      console.info("[Formlink][SSR][Preview][Server] effective overrides", {
        cssLen: (eff.shadcn_css || "").length || 0,
        mode: eff.theme_mode || null,
        source,
      });
    } catch {}
    return parsed;
  } catch (castError) {
    console.error(
      `Error constructing form schema object for version ${versionId}:`,
      castError,
    );
    return null;
  }
}

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
