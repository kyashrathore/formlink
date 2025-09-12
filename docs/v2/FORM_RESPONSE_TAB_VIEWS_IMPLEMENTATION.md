# Form Response Tab Views — Implementation Plan (Code‑Aligned, Edge‑Case Ready)

## Overview

This document defines the implementation for the Form Response tab views, with concrete alignment to existing code and database functions. It covers todos #12–20 and expands on views, filters, exports, insights, and actions (via ACI). The plan calls out edge cases, performance constraints, security, and failure modes so the feature is shippable without surprises.

Key alignment with current codebase (Sept 2025):

- Backend endpoint for responses: `apps/formcraft/app/api/responses/route.ts` using the Supabase RPC `public.get_filtered_submissions(...)`.
- RPC returns a single row with `data` (array of submissions + aggregated answers) and counts; see `packages/db/src/migrations/20250912_get_filtered_submissions_status_array.sql`.
- Submission fields available today: `submission_id`, `form_version_id`, `user_id`, `created_at`, `completed_at`, `status` (enum), `testmode` (boolean), and `answers` (JSON keyed by `question_id`).
- AuthZ: `verifyUserCanAccessFormVersion(form_version_id, user_id)` enforced in the route.

## Architecture Overview

```
Form Submissions → DB (form_submissions, form_answers)
                       ↓ (RPC: get_filtered_submissions)
                Response API (authz, paging, counts)
                       ↓
               Tab Views (saved configs)
                       ↓
               Export (CSV)
```

## Core Components Implementation

### 1) Response Table Component (todos #12–14)

#### A. Table Header & Question Display

- Label as header: Use question `label` as column header; use `id` only as internal key.
- Truncation: Header max 50 chars; show full on tooltip; preserve accessibility with `title`.
- Column structure:
  - Default max width per data column 220px; allow per‑column override.
  - Horizontal virtualization (windowed) for wide forms; always enable horizontal scroll.
  - Sticky first column (Submission, includes status/testmode and timestamps) and sticky header row.
  - Support reordering and hide/show columns per saved view.
  - Render deleted/renamed questions as “(Removed)” with retained values when possible (see “Schema Drift”).

#### B. Export Functionality

- Formats: CSV (streaming) now; PDF later via background job.
- Scope: Export current filtered view; support “selected rows only”. Persist the exact filter JSON used (audit).
- Selection: Row select, “select all on page”, and “select all in view” (with confirmation showing total count).
- Implementation:
  - CSV: Server streams rows (Node stream or Postgres `COPY TO STDOUT`) with chunking; escape against CSV injection (prefix `=` `+` `-` `@` with `'`), quote values, normalize newlines.
  - Large exports (>25k rows): enqueue job → email/Slack link via ACI email/Slack functions; link is a signed URL that expires.
  - PDF: Background job using doc generation MCP (see ACI). Paginate tables; truncate large long‑text cells and attach a CSV for full raw.

#### C. Type Icons & Data Display

- Type mapping (examples): text · email · number · date · select · rating · boolean · file · multi‑select.
- Value rendering:
  - Text: truncate to 100 chars; tooltip on hover; show copy button for >40 chars.
  - Multi‑select arrays: render chips (max 3) with “+N more”.
  - File uploads: display filename, size, and a “Get link” button that issues a short‑lived signed URL; never embed raw public URLs.
  - Long markdown: show “Preview” popover with sanitized HTML; never render scripts.
  - Email/phone: clickable with `mailto:`/`tel:` but disabled in public views unless allowed.
  - Missing values: show muted “—”.

Accessibility: ensure row focus rings, proper `aria-sort`, and keyboard nav across virtualized grid.

### 2) Response Table Filters (todo #15)

#### Filter Categories

- Status:
  - `completed` (default)
  - `in_progress`
  - `abandoned` (enum exists; may be unused in UI until set in pipeline)
- Test mode:
  - `testmode = false` by default (hides test submissions)
  - Toggle to include `testmode = true`
- Time range: last 7d, 30d, 90d, all time (applies to `created_at`)

#### Implementation Structure

```typescript
// Submission-level filters map to allowed keys in the API route:
//   ["form_version_id", "status", "user_id", "created_at", "completed_at", "testmode"]
// Answer-level filters use question ids as keys; values are matched by equality or membership (array).
type SubmissionFilters = Partial<{
  form_version_id: string; // required for totals in RPC
  status: 'completed' | 'in_progress' | 'abandoned';
  user_id: string;
  created_at: string;      // ISO date lower bound
  completed_at: string;    // (optional future use)
  testmode: boolean;       // default false
}>;

type AnswerFilters = Record<string /* question_id */, string | number | boolean | null | Array<string | number | boolean>>;

interface ViewConfig {
  id: string;
  name: string;
  submission_filters: SubmissionFilters;
  answer_filters: AnswerFilters;
  columns: string[]; // question_ids + system columns (e.g., "_submission", "_created_at")
  sort?: { field: string; direction: 'asc' | 'desc' };
  isDefault?: boolean;
}

Operator support (today vs later):
- Today: equality and inclusion for answers; `created_at >=` for time; exact enum for `status`; boolean for `testmode`.
- Later: contains/ILIKE for text, numeric ranges for number/date, and relative time windows handled server‑side.
```

### 3) Funnel Analytics Component (todo #16)

#### Funnel Visualization

- **Drop-off Analysis**: Show completion rate per form step
- **Visual representation**: Horizontal funnel chart
- **Metrics tracked**:
  - Started submissions
  - Step completion rates
  - Final completion rate
  - Average time per step

#### Implementation

```typescript
interface FunnelStep {
  stepIndex: number;
  stepLabel: string;
  started: number;
  completed: number;
  dropoffRate: number;
  avgTimeSeconds: number;
}
```

### 3.5) AI‑Powered Insights Cards

#### Smart Insights Engine

- Form Schema Analysis: AI proposes insight cards based on question types and purpose.
- Automatic Insights Generation: Produces 3–6 cards; no deterministic fallbacks exist if AI disabled.
- SQL Generation: AI proposes SQL; we validate/sanitize and substitute parameterized templates only (never execute arbitrary SQL).
- Component Output: Returns props for our UI charts; keep data minimal and cache per view.

#### AI Insights Endpoint

```typescript
// Generate insights for a form
POST /api/forms/{formId}/insights/generate
Body: {
  time_period?: '7d' | '30d' | '90d' | 'all';
  insight_types?: ('conversion' | 'demographics' | 'trends' | 'performance' | 'satisfaction')[];
  max_insights?: number; // Default: 6
}
Response: {
  insights: InsightCard[];
  generated_at: string;
  expires_at: string; // Cache (e.g., 1 hour)
}

// Get cached insights
GET /api/forms/{formId}/insights
Query: {
  time_period?: string;
}
```

#### Insight Card Structure

```typescript
interface InsightCard {
  id: string;
  type: "metric" | "chart" | "trend" | "comparison";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";

  // Data payload
  data: any;

  // UI Component configuration (shadcn/ui ready)
  component: {
    type:
      | "stat-card"
      | "bar-chart"
      | "line-chart"
      | "pie-chart"
      | "progress-ring";
    props: Record<string, any>; // Direct props for shadcn components
  };

  // Metadata
  sql_query?: string; // For debugging only; never executed verbatim
  confidence_score: number; // 0-1, AI confidence in insight relevance
  tags: string[];
}

// Example metric card
interface MetricInsightCard extends InsightCard {
  type: "metric";
  data: {
    value: number;
    label: string;
    change?: {
      value: number;
      period: string;
      direction: "up" | "down" | "neutral";
    };
    comparison?: {
      value: number;
      label: string;
    };
  };
  component: {
    type: "stat-card";
    props: {
      title: string;
      value: string;
      description?: string;
      trend?: {
        value: number;
        label: string;
        color: "green" | "red" | "gray";
      };
    };
  };
}

// Example chart card
interface ChartInsightCard extends InsightCard {
  type: "chart";
  data: {
    datasets: Array<{
      label: string;
      data: Array<{ x: string; y: number }>;
      color?: string;
    }>;
    categories?: string[];
  };
  component: {
    type: "bar-chart" | "line-chart" | "pie-chart";
    props: {
      data: any[]; // Recharts compatible format
      config: {
        [key: string]: {
          label: string;
          color?: string;
        };
      };
      className?: string;
    };
  };
}
```

#### AI Insights Generation Process

1. **Form Analysis**
   - Parse form schema and question types
   - Identify key metrics (conversion, satisfaction, demographics)
   - Detect form purpose (lead capture, feedback, survey, etc.)

2. **Data Pattern Recognition**
   - Analyze submission patterns and trends
   - Identify interesting correlations
   - Detect outliers and anomalies

3. SQL Query Generation (safe)
   - Use whitelisted, parameterized templates (see “SQL templates”).
   - Bind `form_id`, `form_version_id`, windows, fields safely; no dynamic identifiers from AI.
   - Enforce `testmode = false` for default dashboards unless explicitly included.

4. **Component Mapping**
   - Map insights to appropriate UI components
   - Generate shadcn/ui compatible props
   - Optimize for visual hierarchy and importance

#### Example Generated Insights

```typescript
// For a Job Application Form
const jobApplicationInsights: InsightCard[] = [
  {
    id: "completion_rate",
    type: "metric",
    title: "Completion Rate",
    description: "Percentage of started applications that were completed",
    priority: "high",
    data: {
      value: 67,
      label: "Completion Rate",
      change: { value: 12, period: "vs last month", direction: "up" },
    },
    component: {
      type: "stat-card",
      props: {
        title: "Completion Rate",
        value: "67%",
        description: "+12% vs last month",
        trend: { value: 12, label: "increase", color: "green" },
      },
    },
  },

  {
    id: "applications_by_source",
    type: "chart",
    title: "Top Application Sources",
    description: "Where candidates are finding your job posting",
    priority: "high",
    data: {
      datasets: [
        {
          label: "Applications",
          data: [
            { x: "LinkedIn", y: 45 },
            { x: "Indeed", y: 32 },
            { x: "Company Site", y: 18 },
            { x: "Referral", y: 23 },
          ],
        },
      ],
    },
    component: {
      type: "bar-chart",
      props: {
        data: [
          { source: "LinkedIn", applications: 45 },
          { source: "Indeed", applications: 32 },
          { source: "Company Site", applications: 18 },
          { source: "Referral", applications: 23 },
        ],
        config: {
          applications: { label: "Applications", color: "#3b82f6" },
        },
      },
    },
  },

  {
    id: "experience_distribution",
    type: "chart",
    title: "Candidate Experience Levels",
    description: "Distribution of years of experience among applicants",
    priority: "medium",
    data: {
      datasets: [
        {
          label: "Candidates",
          data: [
            { x: "0-2 years", y: 28 },
            { x: "3-5 years", y: 45 },
            { x: "6-10 years", y: 32 },
            { x: "10+ years", y: 15 },
          ],
        },
      ],
    },
    component: {
      type: "pie-chart",
      props: {
        data: [
          { experience: "0-2 years", count: 28, fill: "#3b82f6" },
          { experience: "3-5 years", count: 45, fill: "#06b6d4" },
          { experience: "6-10 years", count: 32, fill: "#8b5cf6" },
          { experience: "10+ years", count: 15, fill: "#f59e0b" },
        ],
        config: {
          count: { label: "Candidates" },
        },
      },
    },
  },
];

// For a Customer Feedback Form
const feedbackInsights: InsightCard[] = [
  {
    id: "nps_score",
    type: "metric",
    title: "Net Promoter Score",
    description: "Overall customer satisfaction metric",
    priority: "high",
    data: {
      value: 8.2,
      label: "NPS Score",
      comparison: { value: 7.8, label: "Industry Average" },
    },
    component: {
      type: "stat-card",
      props: {
        title: "NPS Score",
        value: "8.2",
        description: "Above industry average (7.8)",
      },
    },
  },

  {
    id: "satisfaction_trend",
    type: "chart",
    title: "Satisfaction Trend",
    description: "Customer satisfaction over the last 30 days",
    priority: "high",
    data: {
      datasets: [
        {
          label: "Rating",
          data: [
            { x: "Week 1", y: 7.8 },
            { x: "Week 2", y: 8.1 },
            { x: "Week 3", y: 8.3 },
            { x: "Week 4", y: 8.2 },
          ],
        },
      ],
    },
    component: {
      type: "line-chart",
      props: {
        data: [
          { week: "Week 1", rating: 7.8 },
          { week: "Week 2", rating: 8.1 },
          { week: "Week 3", rating: 8.3 },
          { week: "Week 4", rating: 8.2 },
        ],
        config: {
          rating: { label: "Average Rating", color: "#10b981" },
        },
      },
    },
  },
];
```

### 4) Saved Views (Tabs)

- Storage schema (server):
  - `{ id, form_id, form_version_id, name, submission_filters, answer_filters, columns, sort, is_default, created_by }`.
  - `submission_filters` must include `form_version_id` for accurate totals.
- Default tabs:
  - “All” (status any, `testmode=false`).
  - Use‑case specific (e.g., “Published Testimonials”, “Qualified Leads”) created by AI/heuristics; user can hide.
- Behavior:
  - Changing filter or columns shows “Unsaved changes”; user can save to update view or “Save as new”.
  - Each tab remembers page size, sort, and column order.
  - Clone and share (internal only initially).

### 4. Natural Language Filtered Views (todo #18)

#### AI-Powered View Creation

- **Input**: Natural language query ("top 100 applicants", "applications with score > 80")
- **Processing**: Parse query → generate SQL filters → create saved view
- **Implementation**: Use LLM to convert natural language to filter objects

#### View Management

- **Tabbed interface**: Each saved view becomes a tab
- **Default views**: All, Completed, Recent
- **Custom views**: User-created via natural language or manual filters
- **View persistence**: Save to database with user association

### 5. Response Actions Integration (todo #19)

#### ACI Action Types

- **Per Submission Actions**:
  - Send follow-up email
  - Create CRM contact
  - Generate PDF report
  - Post to Slack/webhook
- **Batch Actions**:
  - Bulk export
  - Mass email campaigns
  - Batch CRM updates
- **Scheduled Actions**:
  - Weekly summaries
  - Automated follow-ups
  - Digest reports

#### Trigger Mechanisms

- **Manual**: User selects rows → chooses action
- **Automated**: On submission completion
- **Scheduled**: Cron-based batch processing

### 6. Embeddable Data Hook & Copy-Paste Integration

#### Hook Generator

- **Generate React Hook**: Data fetching hook with FORMLINK_API_KEY integration
- **Generate Vue Composable**: Vue 3 composition API version
- **Generate Vanilla JS**: Framework-agnostic data fetching utility
- **Data Schema Documentation**: TypeScript interfaces and data structure

#### Copy‑Paste Functionality

```typescript
// Hook generation endpoint
GET /api/views/{viewId}/generate-hook
Query: {
  framework: 'react' | 'vue' | 'vanilla';
  features?: ('pagination' | 'search' | 'actions' | 'real-time')[];
}
Response: {
  hook_code: string;
  data_schema: string; // TypeScript interfaces
  usage_example: string;
  installation_instructions: string;
}
```

#### Generated Hook Features

- **Zero Config**: Works with just `viewId` and `apiKey`
- **Built-in Features**:
  - Pagination controls
  - Search/filter functionality
  - Loading states
  - Error handling
  - Real-time updates (via WebSocket)
  - Action execution
- **TypeScript Support**: Full type definitions
- **Customizable**: Easy to extend and modify

Security for public embeds:

- API keys are scoped to views and permissions; keys are masked and revocable.
- CORS/Allowed origins and IP allowlist supported by key metadata.
- Public data must exclude PII unless explicitly approved per column; default deny.

#### Data Schema

```typescript
// Generated TypeScript interfaces
interface FormResponseData {
  view: ViewMetadata;
  data: ResponseRow[];
  pagination: PaginationInfo;
  actions?: PublicAction[];
}

interface ViewMetadata {
  id: string;
  name: string;
  form_title: string;
  form_id: string;
  columns: ViewColumn[];
  total_count: number;
  filters_applied: ResponseFilter[];
}

interface ViewColumn {
  id: string;
  field: string;
  label: string;
  full_label: string;
  type: "text" | "email" | "number" | "date" | "select" | "rating" | "boolean";
  required: boolean;
  options?: string[]; // For select types
}

interface ResponseRow {
  id: string;
  form_id: string;
  status: "in_progress" | "completed" | "abandoned";
  testmode: boolean; // true = test submission
  completed_at: string | null;
  created_at: string;

  // Dynamic fields based on form schema
  [field_name: string]: any;

  // System metadata
  ip_address?: string;
  user_agent?: string;
  completion_time_seconds?: number;
  source?: string; // utm_source or referrer
}

interface PaginationInfo {
  page: number;
  limit: number;
  total_pages: number;
  total_count: number;
  has_more: boolean;
}

interface PublicAction {
  name: string;
  display_name: string;
  description: string;
  icon?: string;
  parameters?: ActionParameter[];
  batch_supported: boolean;
}

interface ActionParameter {
  name: string;
  type: "string" | "number" | "boolean" | "select";
  required: boolean;
  options?: string[];
  default_value?: any;
}

interface ResponseFilter {
  id: string;
  field: string;
  operator: "equals" | "contains" | "gt" | "lt" | "range" | "in";
  value: any;
  label: string;
}
```

#### Generated React Hook

```typescript
// Generated: hooks/useFormResponseData.ts
import { useState, useEffect, useCallback } from "react";

interface UseFormResponseDataProps {
  viewId: string;
  apiKey: string;
  enableRealTime?: boolean;
  initialPage?: number;
  pageSize?: number;
}

interface UseFormResponseDataReturn {
  // Data
  data: FormResponseData | null;
  responses: ResponseRow[];
  view: ViewMetadata | null;

  // State
  loading: boolean;
  error: Error | null;

  // Pagination
  pagination: {
    page: number;
    hasMore: boolean;
    totalPages: number;
    totalCount: number;
    nextPage: () => void;
    previousPage: () => void;
    goToPage: (page: number) => void;
  };

  // Search & Filtering
  search: {
    query: string;
    setQuery: (query: string) => void;
    isSearching: boolean;
  };

  // Actions
  executeAction: (
    actionName: string,
    submissionIds: string[],
    parameters?: Record<string, any>,
  ) => Promise<any>;

  // Utilities
  refresh: () => Promise<void>;
  getResponseById: (id: string) => ResponseRow | undefined;
  getFieldValue: (responseId: string, fieldName: string) => any;
}

export const useFormResponseData = ({
  viewId,
  apiKey,
  enableRealTime = false,
  initialPage = 0,
  pageSize = 20,
}: UseFormResponseDataProps): UseFormResponseDataReturn => {
  const [data, setData] = useState<FormResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(initialPage);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(page === 0);
      setIsSearching(searchQuery.length > 0);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      });

      if (searchQuery) {
        params.append("search", searchQuery);
      }

      const response = await fetch(
        `https://api.formlink.com/api/public/views/${viewId}/data?${params}`,
        {
          headers: {
            "X-Formlink-API-Key": apiKey,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: FormResponseData = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  }, [viewId, apiKey, page, searchQuery, pageSize]);

  const executeAction = useCallback(
    async (actionName: string, submissionIds: string[], parameters = {}) => {
      try {
        const response = await fetch(
          `https://api.formlink.com/api/public/views/${viewId}/actions`,
          {
            method: "POST",
            headers: {
              "X-Formlink-API-Key": apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action_name: actionName,
              submission_ids: submissionIds,
              parameters,
            }),
          },
        );

        if (!response.ok) {
          throw new Error(`Action failed: HTTP ${response.status}`);
        }

        const result = await response.json();

        // Refresh data after successful action
        await fetchData();

        return result;
      } catch (err) {
        console.error("Action execution failed:", err);
        throw err;
      }
    },
    [viewId, apiKey, fetchData],
  );

  // Pagination controls
  const pagination = {
    page,
    hasMore: data?.pagination.has_more || false,
    totalPages: data?.pagination.total_pages || 0,
    totalCount: data?.pagination.total_count || 0,
    nextPage: () => setPage((p) => p + 1),
    previousPage: () => setPage((p) => Math.max(0, p - 1)),
    goToPage: (newPage: number) => setPage(Math.max(0, newPage)),
  };

  // Search controls
  const search = {
    query: searchQuery,
    setQuery: (query: string) => {
      setSearchQuery(query);
      setPage(0); // Reset to first page when searching
    },
    isSearching,
  };

  // Utility functions
  const getResponseById = useCallback(
    (id: string) => {
      return data?.data.find((response) => response.id === id);
    },
    [data],
  );

  const getFieldValue = useCallback(
    (responseId: string, fieldName: string) => {
      const response = getResponseById(responseId);
      return response?.[fieldName];
    },
    [getResponseById],
  );

  // Fetch data when dependencies change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // WebSocket for real-time updates
  useEffect(() => {
    if (!enableRealTime || !viewId || !apiKey) return;

    const ws = new WebSocket(
      `wss://api.formlink.com/api/public/views/${viewId}/live?api_key=${encodeURIComponent(apiKey)}`,
    );

    ws.onopen = () => {
      console.log("Real-time connection established");
    };

    ws.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        if (
          update.type === "submission_update" ||
          update.type === "new_submission"
        ) {
          fetchData(); // Refresh data on updates
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("Real-time connection closed");
    };

    return () => {
      ws.close();
    };
  }, [viewId, apiKey, enableRealTime, fetchData]);

  return {
    // Data
    data,
    responses: data?.data || [],
    view: data?.view || null,

    // State
    loading,
    error,

    // Controls
    pagination,
    search,

    // Actions
    executeAction,

    // Utilities
    refresh: fetchData,
    getResponseById,
    getFieldValue,
  };
};
```

## Database Schema

### Core Tables

```sql
-- Enhanced form_submissions table
CREATE TABLE form_submissions (
  id UUID PRIMARY KEY,
  form_id UUID NOT NULL,
  status submission_status DEFAULT 'in_progress',
  mode submission_mode DEFAULT 'live',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,

  -- Analytics fields
  completion_time_seconds INTEGER,
  steps_completed INTEGER,
  total_steps INTEGER,
  last_active_at TIMESTAMPTZ,

  -- Action tracking
  last_action_at TIMESTAMPTZ,
  last_action_name TEXT,
  action_count INTEGER DEFAULT 0
);

-- Saved views for filtering
CREATE TABLE response_views (
  id UUID PRIMARY KEY,
  form_id UUID NOT NULL,
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  filters JSONB NOT NULL,
  columns JSONB NOT NULL,
  sort_config JSONB,
  is_default BOOLEAN DEFAULT false,

  -- Public access settings
  is_public BOOLEAN DEFAULT false,
  public_access_level public_access_level DEFAULT 'read_only',
  public_api_key_required BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Public API keys for external access
CREATE TABLE formlink_api_keys (
  id UUID PRIMARY KEY,
  key_prefix VARCHAR(20) NOT NULL, -- 'fl_api_'
  key_hash VARCHAR(255) NOT NULL, -- bcrypt hash of full key
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL,

  -- Permissions
  name VARCHAR(255) NOT NULL,
  permissions JSONB NOT NULL, -- ['read_responses', 'execute_actions', 'real_time']

  -- Access restrictions
  allowed_origins TEXT[], -- CORS origins
  allowed_ips INET[], -- IP whitelist
  rate_limit_per_minute INTEGER DEFAULT 100,

  -- View-level permissions
  view_access JSONB, -- {'view_id': 'access_level'}

  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(key_hash),
  INDEX(key_prefix, is_active),
  INDEX(user_id, is_active),
  INDEX(workspace_id)
);

-- Action execution log
CREATE TABLE response_actions_log (
  id UUID PRIMARY KEY,
  form_id UUID NOT NULL,
  action_name VARCHAR(255) NOT NULL,
  submission_ids UUID[] NOT NULL,
  user_id UUID NOT NULL,

  -- ACI integration
  aci_function VARCHAR(255),
  aci_payload JSONB,

  -- Execution tracking
  status action_status DEFAULT 'pending',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  result JSONB
);

-- Funnel analytics cache
CREATE TABLE form_funnel_analytics (
  form_id UUID PRIMARY KEY,
  steps JSONB NOT NULL,
  completion_rate DECIMAL(5,2),
  avg_completion_time_seconds INTEGER,
  total_started INTEGER,
  total_completed INTEGER,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Sidecar Annotation Tables — deferred

Moved to a separate doc. Not part of the current release scope.

### Enums

```sql
CREATE TYPE submission_status AS ENUM ('in_progress', 'completed', 'abandoned');
CREATE TYPE action_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE public_access_level AS ENUM ('read_only', 'read_write', 'full_access');
```

## API Endpoints

### Response Data Endpoints (current, internal)

```typescript
// Get responses with filters
GET /api/forms/{formId}/responses
Query: {
  view_id?: string;
  // `search` is a JSON string containing merged submission_filters + answer_filters
  search?: string;
  page: number;
  pageSize: number;
}

// Get saved views
GET /api/forms/{formId}/views
POST /api/forms/{formId}/views
PUT /api/forms/{formId}/views/{viewId}
DELETE /api/forms/{formId}/views/{viewId}

// Export responses (future)
POST /api/forms/{formId}/responses/export
Body: {
  format: 'csv' | 'pdf';
  view_id?: string;
  submission_filters?: SubmissionFilters;
  answer_filters?: AnswerFilters;
  submission_ids?: string[];
}

```

````

### Public View API (FORMLINK_API_KEY Authentication) — planned

```typescript
// Get public view data (for embedding)
GET /api/public/views/{viewId}/data
Headers: {
  'X-Formlink-API-Key': 'fl_api_xxx'
}
Query: {
  page?: number;
  limit?: number;
  live_refresh?: boolean; // WebSocket upgrade for real-time
}
Response: {
  view: {
    id: string;
    name: string;
    form_title: string;
    columns: ViewColumn[];
    total_count: number;
  };
  data: ResponseRow[]; // Includes merged annotations (subset per allow‑list)
  pagination: {
    page: number;
    limit: number;
    total_pages: number;
    has_more: boolean;
  };
  actions?: PublicAction[]; // If enabled and allowed by key
}

// Get view metadata for component generation
GET /api/public/views/{viewId}/meta
Headers: {
  'X-Formlink-API-Key': 'fl_api_xxx'
}
Response: {
  view: ViewMetadata;
  form: FormMetadata;
  component_config: ComponentConfig;
  api_endpoints: {
    data_url: string;
    websocket_url?: string;
    actions_url?: string;
  };
}

// Execute public actions (if enabled)
POST /api/public/views/{viewId}/actions
Headers: {
  'X-Formlink-API-Key': 'fl_api_xxx'
}
Body: {
  action_name: string;
  submission_ids: string[];
  parameters?: Record<string, any>;
}
````

### Analytics Endpoints

```typescript
// Get funnel data
GET /api/forms/{formId}/funnel
Query: { form_version_id?: string }

// Get response statistics
GET /api/forms/{formId}/stats
Response: {
  total_submissions: number;
  completion_rate: number;
  avg_completion_time: number;
  submissions_by_day: Array<{ date: string; count: number }>;
}

// Generate AI insights
POST /api/forms/{formId}/insights/generate
Body: {
  time_period?: '7d' | '30d' | '90d' | 'all';
  insight_types?: ('conversion' | 'demographics' | 'trends' | 'performance' | 'satisfaction')[];
  max_insights?: number;
}
Response: {
  insights: InsightCard[];
  generated_at: string;
  expires_at: string;
}

// Get cached insights
GET /api/forms/{formId}/insights
Query: {
  time_period?: string;
}
Response: {
  insights: InsightCard[];
  generated_at: string;
  cache_hit: boolean;
}
```

### Action Endpoints

```typescript
// Execute action on responses
POST /api/forms/{formId}/responses/actions
Body: {
  action_name: string;
  submission_ids: string[];
  parameters?: Record<string, any>;
}

// Get available actions
GET /api/forms/{formId}/actions

// Get action execution history
GET /api/forms/{formId}/actions/history
```

Action execution details:

- Transport: ACI (see docs/v2/aci.md). Each action maps to `{ aciApp, aciFunction, paramMappings }`.
- Auth: If user lacks a linked account, return `authentication_required` with OAuth URLs (per ACI guide).
- Idempotency: per (automation_id|action_name, submission_id, parameters hash).
- Auditing: write to `response_actions_log`; store request/response payloads (redact secrets).

### API Key Management Endpoints

```typescript
// Create new API key
POST /api/api-keys
Body: {
  name: string;
  permissions: ('read_responses' | 'execute_actions' | 'real_time')[];
  allowed_origins?: string[];
  allowed_ips?: string[];
  rate_limit_per_minute?: number;
  view_access?: Record<string, 'read_only' | 'read_write' | 'full_access'>;
  expires_at?: string;
}
Response: {
  id: string;
  name: string;
  key: string; // Full key shown only once: 'fl_api_xxx...'
  key_prefix: string; // 'fl_api_abc'
  permissions: string[];
  created_at: string;
}

// List API keys (keys masked)
GET /api/api-keys
Response: {
  keys: Array<{
    id: string;
    name: string;
    key_prefix: string; // 'fl_api_abc'
    permissions: string[];
    is_active: boolean;
    last_used_at?: string;
    usage_count: number;
    created_at: string;
    expires_at?: string;
  }>;
}

// Update API key
PUT /api/api-keys/{keyId}
Body: {
  name?: string;
  permissions?: string[];
  allowed_origins?: string[];
  allowed_ips?: string[];
  rate_limit_per_minute?: number;
  view_access?: Record<string, string>;
  is_active?: boolean;
  expires_at?: string;
}

// Delete API key
DELETE /api/api-keys/{keyId}

// API key usage analytics
GET /api/api-keys/{keyId}/usage
Query: {
  period: '24h' | '7d' | '30d' | '90d';
}
Response: {
  total_requests: number;
  requests_by_endpoint: Record<string, number>;
  requests_by_day: Array<{date: string, count: number}>;
  error_rate: number;
  top_origins: Array<{origin: string, count: number}>;
}
```

## UI Component Structure

### Main Response Dashboard

```
┌─ ResponseDashboard ─────────────────────────────────────────┐
│ ┌─ ViewTabs ─────┐ ┌─ Filters ──┐ ┌─ Actions ──┐ ┌─ Embed ─┐ │
│ │ • All          │ │ Status ▼   │ │ Export ▼   │ │ API Key │ │
│ │ • Completed    │ │ Mode ▼     │ │ Action ▼   │ │ </> Hook │ │
│ │ • Custom View  │ │ Time ▼     │ │ + New View │ │         │ │
│ └────────────────┘ └────────────┘ └────────────┘ └─────────┘ │
│                                                               │
│ ┌─ FunnelChart ────────────────────────────────────────────┐ │
│ │ Started: 1000 → Step 1: 850 → Step 2: 700 → Final: 600  │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌─ ResponseTable ──────────────────────────────────────────┐  │
│ │ ☐ ID   | Email ↓    | Name      | Rating | Created | ... │  │
│ │ ☐ 001  | john@co... | John Doe  | ⭐⭐⭐⭐ | 2h ago  | ... │  │
│ │ ☐ 002  | jane@co... | Jane Doe  | ⭐⭐⭐⭐⭐ | 1h ago  | ... │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                               │
│ ┌─ EmbedModal (when "Hook" clicked) ────────────────────────┐  │
│ │ Framework: [React ▼] Features: [✓ Pagination ✓ Search]   │  │
│ │ ┌─────────────────────────────────────────────────────────┐ │
│ │ │ // Generated hook code                                  │ │
│ │ │ const { responses, loading, search } =                  │ │
│ │ │   useFormResponseData({                                 │ │
│ │ │     viewId: "view_123",                                 │ │
│ │ │     apiKey: "fl_api_xxx"                                │ │
│ │ │   });                                                   │ │
│ │ └─────────────────────────────────────────────────────────┘ │
│ │ [Copy Hook] [Copy Types] [Download Package]               │ │
│ └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

1. **ViewTabs**: Tabbed interface for saved views
2. **FilterPanel**: Collapsible filter controls
3. **ActionBar**: Bulk actions and export options
4. **EmbedButton**: Opens hook generation modal
5. **FunnelChart**: Visual drop-off analysis
6. **ResponseTable**: Main data table with sorting/selection
7. **EmbedModal**: Hook code generation and copy interface
8. **APIKeyManager**: Create/manage public API keys
9. **ViewCreator**: Natural language view builder

## Implementation Phases

### Phase 1: Core Table (Week 1)

- [x] Basic response table component
- [x] Column configuration from form schema
- [x] Type icons and data formatting
- [x] Basic sorting and pagination
- [x] Selection checkboxes

### Phase 2: Filtering & Views (Week 2)

- [x] Filter panel implementation (DiceUI-style toolbar facets: Status multi-select, Test, Created time)
- [x] Saved views CRUD operations (server only; UI deferred)
- [ ] Default view creation (deferred)
- [ ] View tab interface (deferred; removed from UI per product request)
- [x] Filter persistence (server via RPC params + client state)

### Phase 3: Export & AI Analytics (Week 3)

- [x] CSV/PDF export functionality (CSV shipped; PDF deferred)
- [x] AI insights generation endpoint (available; UI currently hidden)
- [ ] Insights card component system (removed from UI for now)
- [ ] Funnel analytics calculation (stub only)
- [ ] Funnel visualization component (removed from UI for now)
- [x] Response statistics dashboard (basic counts: Completed, In Progress, Total)
- [ ] Performance optimization

### Phase 4: AI Views & Actions (Week 4)

- [x] Natural language query parser (endpoint: POST /api/forms/{formId}/views/nl)
- [x] AI-powered view generation (server-side only; UI deferred)
- [x] ACI action integration (minimal webhook action implemented)
- [x] Bulk action execution (selection-based)
- [x] Action history tracking (response_actions_log)

### Phase 5: API Keys & Embedding (Week 5)

- [x] API key generation and management system (SHA-256 hashed keys)
- [x] Public view access authentication (FORMLINK_API_KEY)
- [x] Component code generation endpoints (hook generator)
- [x] Copy-paste UI in dashboard (Hook dialog)
- [ ] Framework-specific code templates (React shipped; others deferred)

### Phase 6: Polish & Performance (Week 6)

- [x] UI/UX refinements (DiceUI table, simplified stats, removed unused UI)
- [x] Loading states and error handling (non-blocking table-only loader)
- [ ] Real-time WebSocket updates
- [ ] Mobile responsiveness
- [ ] Performance testing and optimization

## Progress Update — Sept 12, 2025

Delivered (current UI and APIs):

- Table: DiceUI-style grid with sticky header/first column, sorting, selection, pagination.
- Facets: Status (multi-select in UI), Test (tri-state), Created time presets; dotted border on active facet buttons.
- Export: CSV for filtered view and selected rows; moved to kebab menu. CSV injection mitigation in place.
- Actions: Minimal webhook action with idempotency; selection-based execution; audit log persists.
- Public embeds: API key CRUD (SHA-256 hashed), public view data/meta endpoints, hook generator; basic Hook dialog in UI.
- Views: Server CRUD + NL parser endpoints exist; UI (tabs/creator) removed per product request until later.
- Insights/Funnel: Endpoints exist; cards/funnel UI intentionally removed to avoid duplication with top-line stats.
- Loading behavior: Only the grid shows a small top-right loading pill; the toolbar/header remain visible during fetches.
- Cleanup: Legacy data-table components removed; replaced with DiceUI equivalents.

Migrations added (apply via Supabase):

- 20250912_get_filtered_submissions_status_array.sql — RPC accepts status arrays (UI supports multi-select).
- (Separately verifiable) 20250912_response_views_and_api_keys.sql + 20250912_rls_policies_response_views_api_keys.sql — saved views + API keys.
- (Optional later) 20250912_response_actions_idempotency.sql — idempotency for actions log.

Notes:

- Until the status-array migration is applied, the /api/responses handler coerces an array status to the first value to avoid 500s. Remove this compatibility path after the migration is live.
- “Manage columns” removed from UI for now.
- Views UI (tabs/save), Public embeds/API keys, Actions, Insights/Funnel: not part of this release; verify or ship separately.

## Verification Checklist (Owner/QA)

Pre‑reqs

- [ ] Apply status‑array RPC migration (20250912_get_filtered_submissions_status_array.sql).
- [ ] Sign in as a non‑guest user with access to at least one form with responses (≥ 7 rows to test pagination).
- [ ] Optional: Seed a few submissions in all three statuses (completed, in_progress, abandoned) and both testmode true/false.

Responses UI

- Toolbar & header
  - [ ] Toolbar renders left‑aligned: Search input, Status, Test, Created facet buttons (with icons), then Clear filters (only when active).
  - [ ] Right‑aligned kebab menu contains Export CSV; “Manage columns” is not present.
  - [ ] Active facet buttons show a dotted border and a compact value (e.g., “2 selected”, “Yes”, “Last 30d”).
  - [ ] Clicking a facet opens a dropdown; items show proper checkbox selection state.
  - [ ] Selecting filters keeps the page static; only the grid shows a small loading indicator badge; header and toolbar remain visible.

- Facets behavior
  - [ ] Status supports multi‑select; choosing multiple values updates the button label to “N selected”.
  - [ ] Test supports Any/Yes/No; if both Yes and No are checked it behaves as Any.
  - [ ] Created supports Last 7d/30d/90d/All time and displays a matching label; clearing resets to All time.
  - [ ] Clear filters resets all facets and removes dotted borders.

- Grid & sorting
  - [ ] Column headers use sort toggles; click cycles None → Asc → Desc.
  - [ ] Sticky header and first column stay fixed during scroll; horizontal scrollbar appears for wide schemas.
  - [ ] Selection column works: header checkbox selects all on page; rows toggle individually.

- Stats banner
  - [ ] Only simple totals render (Completed, In Progress, Total). No Insights or Funnel cards render anywhere.

- Export
  - [ ] Export CSV from kebab exports the current filtered view (when none selected) and downloads a file with base columns + question columns.
  - [ ] Export Selected (from selection action bar) exports only selected row IDs.
  - [ ] CSV content is properly quoted; leading = + - @ are prefixed (CSV injection mitigated).

- Actions
  - [ ] No ACI actions visible. Any legacy webhook action is hidden/disabled for this release.

Public API & Keys (verify separately)

- [ ] API key generation flows and RLS (if this lane is enabled for verification).

Server endpoints

- [ ] /api/forms/{formId}/responses/export returns CSV for filtered and selected sets.
- [ ] (No other endpoints exposed in this release.)

- [ ] /api/responses responds 200 for: status single; status array (if status array migration applied). If migration isn’t applied, array coerces to first element and still returns 200.
- [ ] /api/forms/{formId}/responses/export returns CSV for filtered and selected sets.
- [ ] /api/forms/{formId}/responses/actions logs a completed or failed action with idempotency_key.

Error/edge handling

- [ ] If formlink_api_keys/response_views tables or policies are missing, creation endpoints return 501 with descriptive messages (not generic 500s).
- [ ] Large text values are truncated in cells; missing values show as “—”.
- [ ] File answers render filename; no public file URLs are inlined.

## Current State (Feature Matrix)

- Implemented (UI + API)
  - DiceUI table (sorting, selection, sticky header/first col, pagination).
  - Facets: Status (multi‑select UI), Test (tri‑state), Created presets.
  - Export CSV: filtered/selected; kebab menu; CSV safety.
  - Actions: Webhook action (selection‑based) with idempotency + audit logging.
  - API keys: Create/list/update/delete; hashed; public view data/meta endpoints; hook generator.

- Implemented (API only, UI hidden/deferred)
  - Views CRUD (/api/forms/{formId}/views) and NL parser (/views/nl).
  - Insights endpoints; Funnel/stats endpoints.

- Deferred / Removed from UI
  - View tabs + save/update/clone.
  - Insights & funnel cards (to avoid duplication with simple stats for now).
  - Manage columns (kebab) — removed per product feedback; can be re‑added.

- Pending / Optional next work
  - Apply status-array RPC migration; then simplify /api/responses to pass arrays directly (remove temporary coercion).
  - Real-time updates; mobile responsiveness; performance passes.
  - Public API rate limiting, origin/IP allowlists, usage analytics.
  - PDF export via background jobs; large export queuing + signed URL delivery.

## Technical Considerations

### Performance

- **Virtual scrolling** for large datasets (1000+ rows)
- **Server-side filtering** to reduce payload
- **Cached analytics** with periodic updates
- **Lazy loading** for non-critical components

### Security

- **Row-level security** based on form ownership
- **Rate limiting** on export endpoints and public API
- **ACI permission validation** before action execution
- **Audit logging** for all data operations
- **API key security**:
  - bcrypt hashed keys in database
  - CORS origin validation
  - IP address whitelisting
  - Permission-based access control
  - Usage tracking and anomaly detection
- **Public view restrictions**:
  - Explicit public flag required
  - View-level access controls
  - Field-level data masking options (per‑field allow‑list for annotation/AI columns; default deny)
  - Sidecar tables (annotations/votes/AI) protected by RLS tied to form ownership

### Scalability

- **Pagination** with cursor-based navigation
- **Background processing** for large exports
- **Queue system** for bulk actions
- **Database indexing** on filtered columns

## Integration Points

### ACI Integration

- **Authentication agent** validates user permissions before actions
- **Function discovery** shows available actions based on connected services
- **Execution tracking** logs all ACI function calls
- **Error handling** provides user feedback on failed actions

### Real‑Time Updates

- **WebSocket connection** for live submission updates
- **Optimistic updates** for immediate UI feedback
- **Conflict resolution** for concurrent edits
- **Reconnection handling** for network issues

Implementation notes:

- Use channel keyed by `form_version_id` (or `form_id`) and broadcast new submission summaries.
- Debounce UI refresh; append row then reconcile with server on next page fetch.

## Success Metrics

### Functionality

- [ ] Table loads < 2s for 1000 rows
- [ ] Filters apply < 500ms
- [ ] Export streams < 30s for 10k rows; background job for larger
- [ ] Actions execute successfully 99%+ rate

### Usability

- [ ] Users can create custom views without training
- [ ] Export format meets user needs
- [ ] Funnel insights drive form optimization
- [ ] Actions reduce manual workflow steps
- [ ] AI insights provide actionable intelligence
- [ ] Hook generation enables seamless embedding

## AI Insights Implementation Details

### AI Prompt Template

```typescript
const INSIGHTS_GENERATION_PROMPT = `
You are an expert data analyst specialized in form analytics. Given a form schema and sample data, generate the most valuable insights for the form owner.

FORM SCHEMA:
{form_schema}

SAMPLE DATA (last 100 submissions):
{sample_data}

AVAILABLE UI COMPONENTS:
- stat-card: { title, value, description?, trend?: { value, label, color } }
- bar-chart: { data: Array<{x, y}>, config: {[key]: {label, color}} }
- line-chart: { data: Array<{x, y}>, config: {[key]: {label, color}} }
- pie-chart: { data: Array<{name, value, fill}>, config: {[key]: {label}} }
- progress-ring: { value: number, max: number, label: string }

INSTRUCTIONS:
1. Analyze the form type and identify 4-6 most valuable insights
2. For each insight, generate the SQL query needed
3. Map to the most appropriate UI component
4. Focus on actionable insights that help improve form performance
5. Prioritize high-impact metrics (completion rates, conversion, trends)
6. Include comparisons and trends where possible

Return JSON in this format:
{
  "insights": [
    {
      "id": "unique_id",
      "type": "metric|chart",
      "title": "Insight Title",
      "description": "What this means for the user",
      "priority": "high|medium|low",
      "sql_query": "SELECT ... FROM form_submissions WHERE ...",
      "component": {
        "type": "stat-card|bar-chart|line-chart|pie-chart",
        "props": { /* component-specific props */ }
      },
      "confidence_score": 0.9
    }
  ]
}
`;
```

### SQL Query Templates (parameterized)

```typescript
const SQL_TEMPLATES = {
  completion_rate: `
    SELECT 
      COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*) as completion_rate,
      COUNT(CASE WHEN status = 'completed' AND created_at >= NOW() - INTERVAL '30 days' THEN 1 END) * 100.0 / 
      NULLIF(COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END), 0) as completion_rate_30d,
      COUNT(CASE WHEN status = 'completed' AND created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days' THEN 1 END) * 100.0 / 
      NULLIF(COUNT(CASE WHEN created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days' THEN 1 END), 0) as completion_rate_prev_30d
    FROM form_submissions 
    WHERE form_id = $1 AND COALESCE(testmode, false) = false
  `,

  source_distribution: `
    SELECT 
      COALESCE(metadata->>'utm_source', 'Direct') as source,
      COUNT(*) as count
    FROM form_submissions 
    WHERE form_id = $1 AND status = 'completed' AND COALESCE(testmode, false) = false
      AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY source
    ORDER BY count DESC
    LIMIT 10
  `,

  daily_trend: `
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as submissions,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completions
    FROM form_submissions 
    WHERE form_id = $1 AND COALESCE(testmode, false) = false
      AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date
  `,

  avg_completion_time: `
    SELECT 
      AVG(completion_time_seconds) / 60 as avg_minutes,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY completion_time_seconds) / 60 as median_minutes
    FROM form_submissions 
    WHERE form_id = $1 AND status = 'completed' AND COALESCE(testmode, false) = false
      AND completion_time_seconds IS NOT NULL
      AND completion_time_seconds < 3600 -- Filter outliers > 1 hour
  `,
};
```

## Schema Drift & Versioning

- Question renames: Keep `id` stable; if label changes, views remain intact. If `id` must change, add a migration mapping and optionally duplicate values to the new id; mark old id as deprecated in UI.
- Deleted questions: Keep historical values in `answers`; display column as “(Removed)” unless hidden in the view.
- Form versions: RPC totals rely on `form_version_id`; by default, views are bound to a version. Later, add a cross‑version “Latest only” mode using field intersection logic.

## Performance & Indexes

- Ensure indexes:
  - `form_submissions(form_version_id)`, `form_submissions(status)`, `form_submissions(created_at)`, `form_submissions(testmode)`
  - `form_answers(submission_id)`, `form_answers(question_id)`, optional `GIN` on `form_answers.answer_value`
- Pagination: keyset pagination when sorting by `created_at DESC` for deep pages; retain offset for simplicity initially (<50k rows).
- Virtualization: row virtualization (windowing) in UI; measure reflow cost for wide grids.

## Security & Privacy

- AuthZ: Continue `verifyUserCanAccessFormVersion` checks. For public endpoints, require API key with per‑view allowlist and column allowlist (default deny for PII).
- PII: Mark sensitive fields in schema; block from public views/exports unless explicitly allowed.
- CSV injection: escape leading `=`, `+`, `-`, `@`.
- Signed URLs: Use short‑lived signed URLs for file access; avoid storing permanent public links in cells.
- Rate limits: Apply per‑user and per API key rate limiting.

## Edge Cases & Failure Modes

- Massive long‑text answers (>100k chars): truncate render; export raw via CSV only.
- File attachments missing/deleted: show “Expired/missing file” and omit from export unless link refresh succeeds.
- Mixed test/live: default hides `testmode=true`; show banner when `testmode=true` filter is active.
- Large selection actions: split into batches (e.g., 100 items) with status per batch; show partial failures and retry.
- Idempotency: prevent duplicate action runs on refresh by keying on `(action_name, submission_ids hash, parameters hash)`.
- Backend timeouts: for expensive exports, return 202 + job id; notify via ACI email/Slack when done.
- Ambiguity in TODO #17 (“keep”): unclear requirement; propose removal or clarification (“keep what?”). Pending product input.

## ACI Transport — Practical Notes

- Follow docs/v2/aci.md patterns. Before execution, check linked accounts; if missing, return OAuth URLs (authentication_required).
- Use `linked_account_owner_id` derived from our workspace user id format.
- Maintain an action registry per workspace with allowed field mappings; validate against a field‑level egress allowlist.
- Log all executions in `response_actions_log` with redacted payloads.

---

This plan is consistent with current API shapes (`/api/responses`, Supabase RPC), tightens terminology (use `testmode` boolean, not `mode`), and adds the operational detail needed to ship robust views, exports, insights, and actions with clear guardrails.
