# Hosting, private views and dashboards

A **site** is a static app Formlink serves. Public sites are for respondents; private sites need
a share link and can read the submissions of the forms listed in `dataForms` (read-only).

## Create and deploy

```text
create_site { name: "Beta waitlist", slug?: "beta-waitlist" }            // public
create_site { name: "Waitlist dashboard", visibility: "private", dataForms: ["frm_..."] }
deploy_site { siteId, files: { "index.html": { content: "<!doctype html>..." },
                               "logo.png": { content: "<base64>", encoding: "base64" } } }
```

- Site object: `{ id, slug, name, visibility, dataForms, url, shareUrl, domains, activeDeployment }`.
  Share `url` for public sites, `shareUrl` (`url?token=...`) for private ones.
- URL is `https://<slug>.<sites-domain>/` when the server has a sites domain, else `<api>/s/<slug>/`.
- Slug: 3–40 chars, `a-z 0-9 -`, not reserved (`www api app admin mcp auth oauth docs status mail`);
  omitted → generated from the name plus a random suffix. Taken → 409 `conflict`.
- A deployment is a **complete snapshot**: send every file each time; anything omitted is gone.
  `index.html` is required. Limits: 1000 files, 25MB total (413 `too_large`). Paths are relative,
  no `..` or empty segments. Content type comes from the extension; override with `contentType`.
- Text files as-is; binary files base64 with `encoding: "base64"`.

Other ways to deploy:

```bash
formlink site create "Beta waitlist" --slug beta-waitlist
formlink deploy ./dist --site sit_...          # uploads the whole directory
```

```js
// Node / scripts
const admin = createAdmin({ apiKey: process.env.FORMLINK_API_KEY, baseUrl: "https://<api>" });
await admin.sites.deploy(siteId, { "index.html": { content: html } });
```

```bash
curl -X POST "$FORMLINK_URL/v1/sites/$SITE/deployments" -H "authorization: Bearer $FORMLINK_API_KEY" \
  -H "content-type: application/json" -d @deploy.json   # { "files": { "index.html": { "content": "..." } } }
```

## How hosted pages behave

- **API calls**: use absolute-path relative URLs, `/v1/...`. They are same-origin on every hosting
  mode (subdomain, custom domain, `/s/<slug>/` path). The SDK's default `baseUrl: ""` does this.
- **Assets**: reference them with relative paths (`./app.js`, `logo.png`), not `/app.js`, so the
  page also works under `/s/<slug>/`. Prefer one self-contained `index.html`.
- **SPA fallback**: an extension-less path tries `path`, `path/index.html`, then the root
  `index.html`. A missing file with an extension is a 404. With path hosting, nested client routes
  break relative asset paths: use hash routing (`#/results`) or a single file.
- **Caching**: HTML is `no-cache`; other files `max-age=300`. Rename changed assets (`app.3f2a.js`) or
  wait up to 5 minutes.
- Only GET/HEAD are served for pages (other methods → 405). Forms post to `/v1/f/...`, not to the page.
- `allowedOrigins`: if set on a form, include the hosted site's own origin too.

## Rollback

```text
GET /v1/sites/:id/deployments        → [{ id, files, createdAt }] (latest 50; SDK admin.sites.deployments)
rollback_site { siteId, deploymentId }  // instant; the old snapshot becomes live
```

## Custom domains

```text
add_domain { siteId, hostname: "forms.acme.com" }
→ { hostname, status: "pending", dns: { type: "CNAME", name: "forms.acme.com", target: "fallback.<sites-domain>" }, verification }
```

1. Tell the user to create exactly that CNAME at their DNS provider. Use a subdomain; an apex
   needs a provider that supports CNAME flattening.
2. Poll `get_domain { hostname }` (it re-reads status) until `status` is `"active"` (hostname and
   certificate both active). Usually minutes; DNS can take longer. `verification` holds the
   ownership/SSL records if the provider asks for extra TXT records.
3. The site keeps its default URL too. Remove with `DELETE /v1/domains/:hostname` (SDK `admin.domains.remove`).

Errors: 400 invalid hostname or a hostname under the sites domain, 409 already connected, 501
`not_configured` (server has no Cloudflare for SaaS config), 502 `cloudflare_error`.
CLI: `formlink domain add <siteId> <hostname>`.

---

## Private views

```text
create_site { name: "Applications", visibility: "private", dataForms: ["frm_a", "frm_b"] }
```

- Opening `shareUrl` sets an HttpOnly cookie (30 days) and redirects to the clean URL. Without it:
  401 "This page is private".
- With that cookie, the page's own `fetch` calls get **read-only** admin access limited to
  `dataForms`: `GET /v1/forms/:id`, `/v1/forms/:id/submissions`, `/v1/forms/:id/analytics`,
  `/v1/forms/:id/export`, `/v1/submissions/:id` (with signed file URLs), `/v1/files/:id`.
  Writes → 403; other forms → 403.
- Always send the header `x-formlink-site: <slug>` on these calls. It is required when the page is
  served under `/s/<slug>/` (API host) and harmless elsewhere.
- **Rotate** the link (revokes every existing cookie immediately): `update_site { siteId, rotateShareToken: true }`
  → new `shareUrl`. Change readable forms: `update_site { siteId, dataForms: [...] }`.
- Need writes (approve/reject buttons)? Not from a view. Do it through the agent
  (`update_submission`) or a trusted backend with an admin key. Never embed `fl_sk_` keys in a page.
- Respondent data is untrusted: render it with `textContent`, never `innerHTML`.

### Complete dashboard (single file, no chart library)

Shows total/funnel numbers, a bar chart of one choice field, daily completes, and a filterable table.
Set `FORM_ID`, `SLUG`, and `CHART_FIELD`; deploy to a private site whose `dataForms` includes the form.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Responses</title>
<style>
  :root { --bg:#fafafa; --card:#fff; --fg:#161616; --muted:#666; --line:#e3e3e3; --bar:#3b5bdb; }
  @media (prefers-color-scheme: dark) { :root { --bg:#111; --card:#1a1a1a; --fg:#eee; --muted:#9a9a9a; --line:#2c2c2c; --bar:#7d95ff; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.45 system-ui, sans-serif; }
  main { max-width:1100px; margin:0 auto; padding:24px 16px; }
  .tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px 16px; }
  .tile b { display:block; font-size:1.8rem; font-variant-numeric:tabular-nums; }
  .tile span, .muted { color:var(--muted); }
  .row { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:12px 0; }
  @media (max-width: 720px) { .row { grid-template-columns:1fr; } }
  svg text { fill:var(--fg); font-size:12px; } svg .bar { fill:var(--bar); }
  .scroll { overflow-x:auto; }
  table { width:100%; border-collapse:collapse; } th, td { text-align:left; padding:6px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { font-weight:600; white-space:nowrap; } input { font:inherit; padding:6px 8px; width:100%; max-width:320px; }
</style>
</head>
<body>
<main>
  <h1 id="title">Responses</h1>
  <p id="error" role="alert"></p>
  <section class="tiles" id="tiles"></section>
  <section class="row">
    <div class="card"><h2 id="chart-title">Breakdown</h2><div id="chart"></div></div>
    <div class="card"><h2>Completes per day</h2><div id="daily"></div></div>
  </section>
  <section class="card">
    <h2>Latest submissions</h2>
    <label>Filter <input id="filter" type="search" placeholder="Search answers"></label>
    <div class="scroll"><table id="table"></table></div>
  </section>
</main>
<script type="module">
const FORM_ID = "frm_REPLACE_ME";
const SLUG = "applications-dashboard";   // this site's slug
const CHART_FIELD = "role";               // a single-choice data key
const HEADERS = { "x-formlink-site": SLUG };

async function api(path) {
  const res = await fetch(path, { headers: HEADERS }); // the share-link cookie rides along (same origin)
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${body.error?.code}: ${body.error?.message}`);
  return body;
}

async function allSubmissions(max = 2000) {
  const out = [];
  let cursor = null;
  do {
    const page = await api(`/v1/forms/${FORM_ID}/submissions?limit=500${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    out.push(...page.submissions);
    cursor = page.nextCursor;
  } while (cursor && out.length < max);
  return out;
}

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};
const svgEl = (tag, attrs) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};
const pct = (x) => (x == null ? "–" : `${Math.round(x * 100)}%`);
const show = (v) => (v == null ? "" : typeof v === "object" ? (v.name ?? JSON.stringify(v)) : String(v));

function tiles(a, subs) {
  // analytics covers the last 30 days by default (?since=&until= in ms to change it)
  const items = [["Views (30d)", a.views], ["Starts (30d)", a.starts], ["Completes (30d)", a.completes],
    ["Completion rate", pct(a.completionRate)], ["Submissions loaded", subs.length]];
  document.getElementById("tiles").replaceChildren(...items.map(([label, value]) =>
    el("div", { className: "card tile" }, el("b", { textContent: String(value) }), el("span", { textContent: label }))));
}

// Horizontal bars: one row per category, direct value labels, no legend needed.
function barChart(container, entries, label) {
  const W = 480, row = 28, left = 140, H = Math.max(entries.length, 1) * row + 8;
  const max = Math.max(1, ...entries.map(([, n]) => n));
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": label });
  entries.forEach(([name, n], i) => {
    const y = i * row + 4, w = ((W - left - 40) * n) / max;
    const t = svgEl("text", { x: left - 8, y: y + 17, "text-anchor": "end" }); t.textContent = name.slice(0, 22);
    const v = svgEl("text", { x: left + w + 6, y: y + 17 }); v.textContent = String(n);
    svg.append(t, svgEl("rect", { class: "bar", x: left, y, width: Math.max(w, 1), height: row - 8, rx: 3 }), v);
  });
  if (!entries.length) { const t = svgEl("text", { x: 8, y: 20 }); t.textContent = "No data yet"; svg.append(t); }
  container.replaceChildren(svg);
}

function table(subs) {
  const keys = [...new Set(subs.flatMap((s) => Object.keys(s.data)))].slice(0, 8);
  const head = el("tr", {}, ...["Submitted", "Status", ...keys].map((k) => el("th", { scope: "col", textContent: k })));
  const rows = subs.slice(0, 200).map((s) => el("tr", {},
    el("td", { textContent: new Date(s.completedAt ?? s.createdAt).toLocaleString() }),
    el("td", { textContent: s.status }),
    ...keys.map((k) => el("td", { textContent: show(s.data[k]).slice(0, 120) }))));
  document.getElementById("table").replaceChildren(el("thead", {}, head), el("tbody", {}, ...rows));
}

try {
  const [formInfo, analytics, subs] = await Promise.all([
    api(`/v1/forms/${FORM_ID}`), api(`/v1/forms/${FORM_ID}/analytics`), allSubmissions(),
  ]);
  document.getElementById("title").textContent = formInfo.name;
  document.title = formInfo.name;
  tiles(analytics, subs);

  const counts = {};
  for (const s of subs) { const v = show(s.data[CHART_FIELD]) || "(blank)"; counts[v] = (counts[v] ?? 0) + 1; }
  document.getElementById("chart-title").textContent = `By ${CHART_FIELD}`;
  barChart(document.getElementById("chart"), Object.entries(counts).sort((a, b) => b[1] - a[1]), `Responses by ${CHART_FIELD}`);
  barChart(document.getElementById("daily"), analytics.daily.slice(-14).map((d) => [d.day, d.count]), "Completes per day, latest 14 days with responses");

  table(subs);
  document.getElementById("filter").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    table(q ? subs.filter((s) => JSON.stringify(s.data).toLowerCase().includes(q)) : subs);
  });
} catch (e) {
  document.getElementById("error").textContent = `Couldn't load data: ${e.message}. Open this page with its share link.`;
}
</script>
</body>
</html>
```

Variations:

- Server-side text search instead of client filtering: `/v1/forms/:id/submissions?q=acme` (matches
  anywhere in the answers JSON). Status filter: `?status=qualified`. Include partials: `?drafts=true`
  (omit the param otherwise — any value turns it on). Time range: `?since=<ms>&until=<ms>`.
- Funnel chart: `analytics.steps` is `[{ step, sessions, dropOff }]` sorted by sessions descending —
  plot `sessions` per step id in your question order.
- File links: list rows have no files; fetch `/v1/submissions/:id` for `files[].url`.
- CSV download link: `<a href="/v1/forms/FORM_ID/export?format=csv">` works only when the page is served
  from the site's own host (the cookie must reach it without a custom header). On `/s/<slug>/`
  hosting, fetch it with the header and save via a Blob URL.
- Multiple forms: add them to `dataForms` and loop.

### Hand-off message to the user

When delivering a view, give: the share URL, that anyone with it can read the listed forms'
responses, how to revoke (ask to rotate the link), and that data is live on every page load.
