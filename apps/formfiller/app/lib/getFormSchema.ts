import { FormSchema, type Form } from "@formlink/schema";
import { createServerClient } from "@formlink/db";

export async function getFormSchemaById(
  formIdOrShortId: string,
  preferDraft = false,
): Promise<Form | null> {
  const supabase = await createServerClient(null, "service");

  // Try short_id first, then fallback to full id
  const byShort = await supabase
    .from("forms")
    .select(
      "id, brand_id, current_published_version_id, current_draft_version_id",
    )
    .eq("short_id", formIdOrShortId)
    .single();

  const byId = byShort.data
    ? null
    : await supabase
        .from("forms")
        .select(
          "id, brand_id, current_published_version_id, current_draft_version_id",
        )
        .eq("id", formIdOrShortId)
        .single();

  const formData = byShort.data ?? byId?.data;
  const formError = byShort.error ?? byId?.error ?? null;
  if (formError || !formData) {
    if (formError && (formError as any).code !== "PGRST116") {
      console.error(
        `[forms] Supabase error fetching form ${formIdOrShortId}:`,
        (formError as any).message,
      );
    }
    return null;
  }

  let versionId: string | null = null;
  let versionStatus: "published" | "draft" = "published";
  if (preferDraft && formData.current_draft_version_id) {
    versionId = formData.current_draft_version_id;
    versionStatus = "draft";
  } else {
    versionId = formData.current_published_version_id;
    versionStatus = "published";
    if (!versionId) {
      versionId = formData.current_draft_version_id;
      versionStatus = "draft";
    }
  }
  if (!versionId) return null;

  const { data: versionData, error: versionError } = await supabase
    .from("form_versions")
    .select("version_id, title, description, questions, settings")
    .eq("version_id", versionId)
    .eq("status", versionStatus)
    .single();

  if (versionError || !versionData) {
    if (versionError && (versionError as any).code !== "PGRST116") {
      console.error(
        `[forms] Supabase error fetching ${versionStatus} version ${versionId} for form ${formIdOrShortId}:`,
        (versionError as any).message,
      );
    }
    return null;
  }

  try {
    const rawQuestions = Array.isArray(versionData.questions)
      ? versionData.questions
      : [];

    const overrides =
      (typeof versionData.settings === "object" && versionData.settings
        ? (
            versionData.settings as {
              theme_overrides?: {
                shadcn_css?: string;
                theme_mode?: "light" | "dark" | "system";
              };
            }
          ).theme_overrides
        : undefined) || undefined;

    // Utility: normalize brand theme shapes to shadcn overrides
    const brandToShadcn = (
      brandTheme: unknown,
    ): { css?: string; mode?: "light" | "dark" | "system" } => {
      if (!brandTheme || typeof brandTheme !== "object") return {};
      const t = brandTheme as Record<string, unknown>;
      const cssRaw =
        (typeof t.shadcn_css === "string" && t.shadcn_css) ||
        (typeof t.shadcnCss === "string" && t.shadcnCss) ||
        (typeof t.css === "string" && t.css) ||
        undefined;
      const css = cssRaw ? cssRaw.trim() : undefined;
      const modeRaw = t.theme_mode ?? t.themeMode;
      const mode =
        modeRaw === "light" || modeRaw === "dark" || modeRaw === "system"
          ? modeRaw
          : undefined;
      return { css, mode };
    };

    // Choose effective overrides: form > brand > none
    let effectiveThemeOverrides:
      | { shadcn_css?: string; theme_mode?: "light" | "dark" | "system" }
      | undefined;
    const hasFormCss = Boolean(
      overrides?.shadcn_css && overrides.shadcn_css.trim(),
    );
    const hasFormMode = Boolean(overrides?.theme_mode);
    if (hasFormCss || hasFormMode) {
      effectiveThemeOverrides = {
        ...(hasFormCss ? { shadcn_css: overrides!.shadcn_css } : {}),
        ...(hasFormMode ? { theme_mode: overrides!.theme_mode } : {}),
      };
    } else {
      const brandId = (formData as { brand_id?: string }).brand_id || null;
      if (brandId) {
        try {
          const { data: brandData } = await supabase
            .from("brands")
            .select("theme")
            .eq("brand_id", brandId)
            .single();
          const norm = brandToShadcn((brandData as { theme?: unknown })?.theme);
          if (norm.css || norm.mode) {
            effectiveThemeOverrides = {
              ...(norm.css ? { shadcn_css: norm.css } : {}),
              ...(norm.mode ? { theme_mode: norm.mode } : {}),
            };
          }
        } catch {}
      }
    }

    const formSchemaResult = {
      id: formData.id,
      short_id: formIdOrShortId,
      version_id: versionData.version_id,
      title: versionData.title,
      description: versionData.description,
      questions: rawQuestions,
      settings: {
        ...(typeof versionData.settings === "object" && versionData.settings
          ? (versionData.settings as Record<string, unknown>)
          : {}),
        ...(effectiveThemeOverrides
          ? { theme_overrides: effectiveThemeOverrides }
          : {}),
      },
      current_published_version_id: formData.current_published_version_id,
      current_draft_version_id: formData.current_draft_version_id,
    } as const;

    const validationResult = FormSchema.safeParse(formSchemaResult);
    if (!validationResult.success) {
      console.error(
        `[forms] Server Schema Validation Error for form ${formData.id} (version ${versionData.version_id})`,
      );
      return null;
    }

    // Preserve theme_overrides after parsing
    const parsed = validationResult.data as Form;
    const injectedOverrides = (formSchemaResult.settings as any)
      ?.theme_overrides;
    if (injectedOverrides) {
      (parsed as any).settings = {
        ...(parsed.settings as any),
        theme_overrides: injectedOverrides,
      } as any;
    }
    return parsed;
  } catch (err) {
    console.error(
      `Error constructing form schema object for version ${versionId}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
