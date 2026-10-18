import { z } from "zod";
import type { Auth, Env } from "@/env";
import { GUIDE } from "@/guide";
import { VIEW_APP_URI, VIEW_RUNTIME_TAG, VIEW_TOOLS, viewForMcpApp } from "@/views";
import type { Background } from "@/services/submissions";
import { getAnalytics } from "@/services/events";
import { FormInput, SettingsPatch, createForm, deleteForm, getForm, listForms, updateForm } from "@/services/forms";
import { HOOK_EVENTS, getHook, listHookRuns, setHook, testHook } from "@/services/hooks";
import { deleteSecret, listSecretNames, setSecret } from "@/services/secrets";
import {
  DeployInput,
  SiteInput,
  SiteUpdate,
  addDomain,
  createSite,
  deleteSite,
  deploySite,
  getDomain,
  getViewHtml,
  listDeployments,
  listSites,
  removeDomain,
  rollbackSite,
  saveView,
  updateSite,
} from "@/services/sites";
import {
  ListQuery,
  UpdateSubmissionInput,
  deleteSubmission,
  exportSubmissions,
  getSubmission,
  listSubmissions,
  updateSubmission,
} from "@/services/submissions";
import { getWorkspace } from "@/services/workspaces";

interface Tool<S extends z.ZodObject = z.ZodObject> {
  name: string;
  description: string;
  input: S;
  /** MCP `_meta`, e.g. `{ ui: { resourceUri } }` for tools that render an MCP App. */
  meta?: Record<string, unknown>;
  readOnly?: boolean;
  destructive?: boolean;
  run: (env: Env, auth: Auth, args: z.infer<S>, background: Background) => Promise<unknown>;
}

const tool = <S extends z.ZodObject>(t: Tool<S>) => t as unknown as Tool;

const formId = z.string().describe("Form id (frm_...)");

export const TOOLS: Tool[] = [
  tool({
    name: "guide",
    description:
      "Read this first. How Formlink works: forms, submissions, hooks, secrets, hosting, the public API your UI calls, and the hook contract.",
    input: z.object({}),
    readOnly: true,
    run: async () => GUIDE,
  }),
  tool({
    name: "whoami",
    description: "The workspace and role of the connected key.",
    input: z.object({}),
    readOnly: true,
    run: async (env, auth) => ({ workspace: await getWorkspace(env, auth.workspaceId), role: auth.role }),
  }),
  tool({
    name: "list_forms",
    description: "List forms with their settings.",
    input: z.object({}),
    readOnly: true,
    run: (env, auth) => listForms(env, auth),
  }),
  tool({
    name: "create_form",
    description:
      "Create a form. A form is only a data bucket plus server-side settings; you build the UI separately and post answers to its public endpoint.",
    input: FormInput,
    run: (env, auth, args) => createForm(env, auth, args),
  }),
  tool({
    name: "update_form",
    description: "Rename, open/close, or change settings of a form. Settings merge over the current ones; null resets a setting.",
    input: z.object({ formId, name: z.string().optional(), status: z.enum(["open", "closed"]).optional(), settings: SettingsPatch.optional() }),
    run: (env, auth, { formId, ...rest }) => updateForm(env, auth, formId, rest),
  }),
  tool({
    name: "delete_form",
    description: "Permanently delete a form with all its submissions and files.",
    input: z.object({ formId }),
    destructive: true,
    run: async (env, auth, { formId }) => (await deleteForm(env, auth, formId), { deleted: formId }),
  }),
  tool({
    name: "query_submissions",
    description:
      "List submissions for a form, newest first. Filter by status, time range (ms epoch) or text. Use nextCursor to page.",
    input: ListQuery.extend({ formId }),
    readOnly: true,
    run: (env, auth, { formId, ...q }) => listSubmissions(env, auth, formId, q),
  }),
  tool({
    name: "get_submission",
    description: "One submission with its files (signed download URLs).",
    input: z.object({ submissionId: z.string() }),
    readOnly: true,
    run: (env, auth, { submissionId }) => getSubmission(env, auth, submissionId),
  }),
  tool({
    name: "update_submission",
    description: "Set a submission's status (runs onStatusChange, e.g. approvals) or merge data/computed fields.",
    input: UpdateSubmissionInput.extend({ submissionId: z.string() }),
    run: (env, auth, { submissionId, ...rest }, bg) => updateSubmission(env, auth, submissionId, rest, bg),
  }),
  tool({
    name: "delete_submission",
    description: "Permanently delete one submission and its files.",
    input: z.object({ submissionId: z.string() }),
    destructive: true,
    run: async (env, auth, { submissionId }) => (await deleteSubmission(env, auth, submissionId), { deleted: submissionId }),
  }),
  tool({
    name: "export_submissions",
    description: "All non-draft submissions of a form as CSV (answers flattened to columns) or JSON.",
    input: z.object({ formId, format: z.enum(["csv", "json"]).default("csv") }),
    readOnly: true,
    run: (env, auth, { formId, format }) => exportSubmissions(env, auth, formId, format),
  }),
  tool({
    name: "get_analytics",
    description: "Funnel for a form: views, starts, completes, per-step reach and drop-off, daily completes.",
    input: z.object({ formId, since: z.number().optional(), until: z.number().optional() }),
    readOnly: true,
    run: (env, auth, { formId, ...range }) => getAnalytics(env, auth, formId, range),
  }),
  tool({
    name: "get_hook",
    description: "The form's active hook source and version.",
    input: z.object({ formId }),
    readOnly: true,
    run: (env, auth, { formId }) => getHook(env, auth, formId),
  }),
  tool({
    name: "set_hook",
    description:
      "Save a new version of the form's hook (an ES module with optional beforeSubmit, afterSubmit, onStatusChange, price, sendVerification exports). Empty code removes the hook. Test it with test_hook first.",
    input: z.object({ formId, code: z.string() }),
    run: (env, auth, { formId, code }) => setHook(env, auth, formId, code),
  }),
  tool({
    name: "test_hook",
    description:
      "Run one hook event against sample input without storing anything. Pass `code` to test unsaved code. Returns result, error and console logs.",
    input: z.object({
      formId,
      event: z.enum(HOOK_EVENTS),
      input: z.record(z.string(), z.unknown()).describe("e.g. { submission: { data: {...} } } or { data: {...} } for price"),
      code: z.string().optional(),
    }),
    readOnly: true,
    run: (env, auth, { formId, event, input, code }) => testHook(env, auth, formId, event, input, code),
  }),
  tool({
    name: "list_hook_runs",
    description: "Recent hook executions with errors and logs, for debugging.",
    input: z.object({ formId, limit: z.number().int().max(100).optional() }),
    readOnly: true,
    run: (env, auth, { formId, limit }) => listHookRuns(env, auth, formId, limit),
  }),
  tool({
    name: "list_secrets",
    description: "Names of workspace secrets available to hooks as ctx.secrets (values are never returned).",
    input: z.object({}),
    readOnly: true,
    run: (env, auth) => listSecretNames(env, auth.workspaceId),
  }),
  tool({
    name: "set_secret",
    description: "Store an encrypted secret (UPPER_SNAKE_CASE) for hooks, e.g. STRIPE_SECRET_KEY, RESEND_API_KEY, SLACK_WEBHOOK_URL.",
    input: z.object({ name: z.string(), value: z.string() }),
    run: async (env, auth, { name, value }) => (await setSecret(env, auth, name, value), { saved: name }),
  }),
  tool({
    name: "delete_secret",
    description: "Delete a secret.",
    input: z.object({ name: z.string() }),
    destructive: true,
    run: async (env, auth, { name }) => (await deleteSecret(env, auth, name), { deleted: name }),
  }),
  tool({
    name: "list_sites",
    description: "Hosted sites (form pages, dashboards, views) with URLs and share links.",
    input: z.object({}),
    readOnly: true,
    run: (env, auth) => listSites(env, auth),
  }),
  tool({
    name: "create_site",
    description:
      "Create a hosted site. Public for forms people fill in; private (share link) for views that read submissions of `dataForms`.",
    input: SiteInput,
    run: (env, auth, args) => createSite(env, auth, args),
  }),
  tool({
    name: "update_site",
    description: "Rename a site, change slug, visibility or dataForms, or rotate its share link.",
    input: SiteUpdate.extend({ siteId: z.string() }),
    run: (env, auth, { siteId, ...rest }) => updateSite(env, auth, siteId, rest),
  }),
  tool({
    name: "deploy_site",
    description:
      "Publish a complete static build to a site (must include index.html). Text files as-is; binary files base64 with encoding 'base64'. Returns the live URL.",
    input: DeployInput.extend({ siteId: z.string() }),
    run: (env, auth, { siteId, files }) => deploySite(env, auth, siteId, { files }),
  }),
  tool({
    name: "list_deployments",
    description: "A site's deployments, newest first, for rollback.",
    input: z.object({ siteId: z.string() }),
    readOnly: true,
    run: (env, auth, { siteId }) => listDeployments(env, auth, siteId),
  }),
  tool({
    name: "delete_site",
    description: "Permanently delete a site, its deployments and its custom domains.",
    input: z.object({ siteId: z.string() }),
    destructive: true,
    run: async (env, auth, { siteId }) => (await deleteSite(env, auth, siteId), { deleted: siteId }),
  }),
  tool({
    name: "rollback_site",
    description: "Make an earlier deployment live again.",
    input: z.object({ siteId: z.string(), deploymentId: z.string() }),
    run: (env, auth, { siteId, deploymentId }) => rollbackSite(env, auth, siteId, deploymentId),
  }),
  tool({
    name: "add_domain",
    description: "Connect a custom domain to a site. Returns the DNS record the user must add.",
    input: z.object({ siteId: z.string(), hostname: z.string() }),
    run: (env, auth, { siteId, hostname }) => addDomain(env, auth, siteId, hostname),
  }),
  tool({
    name: "get_domain",
    description: "Check a custom domain's verification and certificate status.",
    input: z.object({ hostname: z.string() }),
    readOnly: true,
    run: (env, auth, { hostname }) => getDomain(env, auth, hostname),
  }),
  tool({
    name: "remove_domain",
    description: "Disconnect a custom domain from its site.",
    input: z.object({ hostname: z.string() }),
    destructive: true,
    run: async (env, auth, { hostname }) => (await removeDomain(env, auth, hostname), { removed: hostname }),
  }),
  tool({
    name: "save_view",
    description: `Save a reusable view (dashboard, table, chart) over form data as one HTML page. It is shareable by link and can be shown inside the chat with show_view, so it never has to be rebuilt. The page includes ${VIEW_RUNTIME_TAG} and reads data only through \`await formlink.call(tool, args)\` with one of: ${VIEW_TOOLS.join(", ")} (same arguments as those tools). Pass siteId to update an existing view.`,
    input: z.object({
      name: z.string().min(1).max(200),
      dataForms: z.array(z.string()).min(1).describe("Form ids the view may read"),
      html: z.string().min(1).describe("Complete self-contained HTML document"),
      siteId: z.string().optional(),
    }),
    run: (env, auth, args) => saveView(env, auth, args),
  }),
  tool({
    name: "show_view",
    description: "Show a saved view inside the chat (MCP App), with live data. Use list_sites to find views (private sites).",
    input: z.object({ siteId: z.string() }),
    readOnly: true,
    meta: { ui: { resourceUri: VIEW_APP_URI } },
    run: async (env, auth, { siteId }) => {
      const { site, html } = await getViewHtml(env, auth, siteId);
      return {
        view: { id: site.id, name: site.name, shareUrl: site.shareUrl, html: viewForMcpApp(html) },
        message: `Showing "${site.name}". Share link: ${site.shareUrl}`,
      };
    },
  }),
  tool({
    name: "get_form",
    description: "One form with settings, public endpoint and hook version.",
    input: z.object({ formId }),
    readOnly: true,
    run: async (env, auth, { formId }) => ({
      ...(await getForm(env, auth, formId)),
      publicEndpoint: `${env.PUBLIC_URL}/v1/f/${formId}`,
    }),
  }),
];
