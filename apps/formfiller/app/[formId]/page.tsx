import React from "react";
import { Form } from "@formlink/schema";
import FormPageClient from "@/app/[formId]/FormPageClient";
import { createServerClient } from "@formlink/db";
import { notFound } from "next/navigation";
import { getFormSchemaById } from "@/app/lib/getFormSchema";

// Always render dynamically to avoid stale theme/styles after edits
export const dynamic = "force-dynamic";

// removed local fetch function in favor of shared helper

export default async function FormPage({
  params,
  searchParams,
}: {
  params: Promise<{ formId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const awaitedParams = await params;
  const awaitedSearchParams = await searchParams;
  const formId = awaitedParams?.formId;
  if (!formId) {
    notFound();
  }

  const preferDraft =
    typeof awaitedSearchParams?.formlinkai_draft === "string"
      ? awaitedSearchParams.formlinkai_draft === "true"
      : Array.isArray(awaitedSearchParams?.formlinkai_draft)
        ? awaitedSearchParams.formlinkai_draft[0] === "true"
        : false;

  const formSchema = await getFormSchemaById(formId, preferDraft);

  if (!formSchema) {
    notFound();
  }

  // Read the query param as boolean
  const isTestSubmission =
    typeof awaitedSearchParams?.formlinkai_testmode === "string"
      ? awaitedSearchParams.formlinkai_testmode === "true"
      : Array.isArray(awaitedSearchParams?.formlinkai_testmode)
        ? awaitedSearchParams.formlinkai_testmode[0] === "true"
        : false;

  // Extract query parameters specified in formSchema.settings.additionalFields.queryParamater
  const queryDataForForm: Record<string, string | number | boolean> = {};
  const queryParamList = Array.isArray(
    formSchema?.settings?.additionalFields?.queryParamater,
  )
    ? formSchema.settings.additionalFields.queryParamater
    : [];
  if (queryParamList.length > 0) {
    for (const param of queryParamList) {
      if (typeof param === "string" && param in awaitedSearchParams) {
        const value = awaitedSearchParams[param];
        // If the value is an array, take the first value
        if (value !== undefined) {
          const resolvedValue = Array.isArray(value) ? value[0] : value;
          if (resolvedValue !== undefined) {
            queryDataForForm[param] = resolvedValue;
          }
        }
      }
    }
  }

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
      <FormPageClient
        formSchema={formSchema}
        isTestSubmission={isTestSubmission}
        queryDataForForm={queryDataForForm}
        searchParams={awaitedSearchParams}
      />
    </>
  );
}
