# FormJunction Implementation Workstreams - V2

## Overview

This document provides updated workstreams based on architectural analysis and feedback. Key changes:

- LangChain removal moved to groundwork
- Focused on cross-mode feature parity
- Reordered based on dependencies and impact
- Removed classical form builder (for now)

## Current Architecture Summary

- **UI Framework**: React 19, Next.js 15, Tailwind CSS v4, Shadcn/ui
- **Form Modes**: AI mode (conversational), TypeForm mode (one-at-a-time), Classic mode (all-at-once)
- **Database**: PostgreSQL via Supabase with RLS
- **Current Features**: Basic form creation, AI conversations, webhook integration
- **Critical Gap**: Branching only works in AI mode

## Workstream Ordering & Dependencies

### Phase 0: Authentication Foundation (Weeks 1-4)

#### 0. Better Auth Migration

**Status**: 🔴 Not Implemented | **Timeline**: 3-4 weeks | **Dependencies**: Groundwork

**Critical Migration** - Required for API keys and team features:

**Why Better Auth?**

- **API Key Management**: Native support for Zapier integration requirements
- **Team Features**: Built-in organization and role management
- **Superior Architecture**: Better than current Supabase Auth limitations

**Migration Scope**:

```typescript
// New capabilities needed
interface BetterAuthFeatures {
  apiKeys: {
    generation: "per-organization" | "per-user";
    scoping: string[]; // ["forms:read", "submissions:create"]
    rateLimit: number;
  };
  organizations: {
    members: TeamMember[];
    roles: "owner" | "admin" | "member";
    billing: PolarSubscription;
  };
  sessions: {
    anonymous: boolean;
    multiDevice: boolean;
    apiAccess: boolean;
  };
}
```

**Migration Challenges**:

1. **20+ RLS policies** need conversion to app-level auth
2. **Anonymous user system** requires redesign
3. **Usage tracking** tightly coupled to Supabase
4. **Session invalidation** during migration

**Implementation Plan**:

- Week 1: Setup Better Auth, migrate schema
- Week 2: Convert authentication flows
- Week 3: Replace RLS with middleware
- Week 4: API key system implementation

---

### Phase 1: Core Platform Enhancement (Weeks 5-8)

#### 1. Runtime AI Enhancement & Cross-Mode Branching

**Status**: 🟡 Partially Implemented | **Timeline**: 3-4 weeks | **Dependencies**: Groundwork items

See **[RUNTIME_AI_ENHANCEMENT_PLAN.md](./RUNTIME_AI_ENHANCEMENT_PLAN.md)** for detailed implementation.

**Key Features for Traditional Modes**:

1. **Quiz Scoring & Results**:

```typescript
// Traditional mode scoring without AI
interface QuizScoring {
  calculateScore(responses: Record<string, any>): number {
    // Sum correct answers based on question metadata
    return questions
      .filter(q => q.metadata?.correctAnswer === responses[q.id])
      .reduce((sum, q) => sum + (q.metadata?.points || 1), 0)
  }

  generateResult(score: number): ResultPage {
    // Use score ranges to determine result
    const ranges = form.settings.scoreRanges
    const result = ranges.find(r => score >= r.min && score <= r.max)
    return result.resultPage
  }
}
```

2. **Calculated/Computed Values**:

```typescript
// JSONata expressions for calculations
interface ComputedField {
  id: string;
  expression: string; // "$sum(responses.expenses)"
  displayFormat: string; // "Total: ${value}"
}

// Works in all modes - evaluated client-side
const total = jsonata(computedField.expression).evaluate(responses);
```

3. **Dynamic Result Pages**:

```typescript
// Template-based results for traditional modes
interface ResultTemplate {
  conditions: Array<{
    expression: string // JSONata
    template: string // Handlebars template
  }>

  generate(responses: Record<string, any>): string {
    const condition = conditions.find(c =>
      jsonata(c.expression).evaluate(responses)
    )
    return handlebars.compile(condition.template)(responses)
  }
}
```

**Cross-Mode Branching** (Critical):

- Currently `<branching_logic>` only works in AI mode
- Implement unified branching compiler (see plan)
- TypeForm: Skip logic to jump questions
- Classic: Dynamic sections that show/hide

---

#### 2. Email Notifications (Premium Feature)

**Status**: 🔴 Not Implemented | **Timeline**: 1.5 weeks | **Dependencies**: Premium gating

**Premium Feature** - UI already exists:

- Integrate email service (Resend recommended)
- Template system for branded emails
- Queue for reliability
- Creator + submitter notifications
- **Pro Plan Required**: Feature gated behind subscription

**Implementation**:

```typescript
// Email service integration
class EmailService {
  async sendSubmissionNotification(submission: Submission) {
    // To creator
    await resend.send({
      to: form.settings.notifyEmail,
      template: "submission-notification",
      data: { form, submission, summary },
    });

    // To submitter (if opted in)
    if (submission.email && form.settings.sendCopy) {
      await resend.send({
        to: submission.email,
        template: "submission-confirmation",
        data: { form, answers: submission.responses },
      });
    }
  }
}
```

---

### Phase 2: User Experience Enhancement (Weeks 5-10)

#### 3. TypeForm Mode Polish

**Status**: 🟡 Basic Exists | **Timeline**: 3 weeks | **Dependencies**: Runtime AI Enhancement

Current "Classic mode" needs TypeForm polish:

- **Smooth animations** between questions (spring physics)
- **Full keyboard navigation** (arrows, tab, shortcuts)
- **Progress indicators** (vertical bar, percentage)
- **Question transitions** based on type
- **Background media** support

**Key Enhancements**:

```typescript
// Enhanced TypeForm renderer
interface TypeFormEnhancements {
  transitions: {
    questionChange: "slide" | "fade" | "zoom";
    duration: number; // Spring-based
  };
  keyboard: {
    shortcuts: Map<string, Action>;
    navigation: "arrows" | "tab" | "both";
  };
  progress: {
    style: "bar" | "dots" | "percentage";
    position: "top" | "bottom" | "side";
  };
}
```

---

#### 4. UI/UX Revamp

**Status**: 🟢 Good Foundation | **Timeline**: 3-4 weeks | **Dependencies**: None

Focus on polish and consistency:

- **Dashboard redesign** with better information architecture
- **Mobile-first** responsive improvements
- **Micro-interactions** and loading states
- **Empty states** and error boundaries
- **Dark mode** completion

**New Two-Column Layout Architecture**:

See complete specification: [Formlink.ai UI/UX Specification](./UI_UX_SPECIFICATION.md)

Key layout features:

- **Left Panel**: Chat/Design panel (resizable 300px-600px)
- **Right Panel**: Main content area (flexible width)
- **Panel States**: Auto-collapse/expand based on active tab
- **Chat Mode**: AI conversation for form building
- **Design Mode**: Live theme/color customization
- **Floating Mode**: Detachable chat panel with drag functionality

**Form Preview Modes**:

- **Chat Mode**: AI-guided form filling simulation
- **Conversation Mode**: TypeForm-style one-question-per-screen
- **Edit Mode**: Inline editing with visual indicators

**Tab-Based Navigation**:

- **Form Tab**: Main form building (chat panel expanded)
- **Responses Tab**: Analytics dashboard (chat panel collapsed)
- **Share Tab**: Embed code generation (chat panel hidden)

**Responsive Behaviors**:

- Resize handle between panels with constraints
- Smooth 300ms transitions for panel states
- Floating panel with viewport constraints
- Auto-save with visual feedback

Leverage existing:

- Motion primitives for animations
- CVA for component variants
- Existing design system

---

#### 5. Workspaces and Teams (Moved Up)

**Status**: 🔴 Not Implemented | **Timeline**: 4-5 weeks | **Dependencies**: Better Auth Migration

**Why moved up**: Affects many downstream features

**Implementation**:

```typescript
// New data model
interface Organization {
  id: string;
  name: string;
  slug: string;
  subscription: SubscriptionTier;
}

interface TeamMember {
  userId: string;
  orgId: string;
  role: "owner" | "admin" | "editor" | "viewer";
  permissions: Permission[];
}

// Form ownership model
interface FormOwnership {
  ownerId: string; // user_id
  organizationId?: string; // optional org ownership
  visibility: "private" | "org" | "public";
  permissions: FormPermission[];
}
```

**Features**:

- Organization creation and management
- Team invitations via email
- Role-based permissions
- Form sharing within org
- Unified billing per org

---

### Phase 3: Platform Features (Weeks 11-18)

#### 6. Component Extension Pack

**Status**: 🟡 Basic Set | **Timeline**: 3-4 weeks | **Dependencies**: Component standards

Priority components based on user demand:

1. **Calendar Booking** (Cal.com style):
   - Available slots from calendar
   - Timezone handling
   - Confirmation emails

2. **Signature Pad**:
   - Touch/mouse drawing
   - Legal compliance features
   - Image export

3. **Payment Collection** (Stripe):
   - One-time payments
   - Subscription setup
   - Price calculations

4. **Advanced Inputs**:
   - Location picker (maps)
   - Terms acceptance
   - Matrix/grid questions
   - NPS score

---

#### 7. Advanced Integrations Hub (Premium Feature)

**Status**: 🟡 Webhook Only | **Timeline**: 4-5 weeks | **Dependencies**: Premium gating + Plugin architecture

**Tiered Integration Access**:

**Free Plan**: Basic webhooks only

**Pro Plan**: Advanced integrations

1. **Zapier Official App** (Requires API Keys):
   - **Authentication**: API key-based (Better Auth migration required)
   - **Triggers**: form_submitted, form_updated, form_published
   - **Actions**: create_submission, update_form, retrieve_responses
   - **Field Mapping**: Full schema mapping with dynamic form fields
   - **Scoping**: Organization-level API keys with granular permissions

2. **Direct Integrations**:
   - Google Sheets (live sync)
   - Slack (notifications)
   - HubSpot/Salesforce (CRM)
   - Mailchimp (email lists)

3. **API Enhancement**:
   - RESTful endpoints
   - GraphQL support
   - Webhook management API

**Premium Gating**: Integration marketplace with subscription checks

---

#### 8. Analytics & Insights Dashboard

**Status**: 🟡 Basic | **Timeline**: 3 weeks | **Dependencies**: Event system

Comprehensive analytics:

- **Conversion funnels** with drop-off analysis
- **Response time** distributions
- **A/B test results** visualization
- **AI conversation** quality metrics
- **Export capabilities** (CSV, PDF reports)

```typescript
interface AnalyticsDashboard {
  metrics: {
    completionRate: TimeSeriesData;
    avgCompletionTime: TimeSeriesData;
    dropOffByQuestion: QuestionMetrics[];
    aiMetrics?: AIConversationMetrics;
  };

  exports: {
    format: "csv" | "pdf" | "json";
    filters: DateRange & QuestionFilter;
    scheduling: "daily" | "weekly" | "monthly";
  };
}
```

---

### Phase 4: Growth & Monetization (Weeks 19-24)

#### 9. Pricing & Billing (Pro Plan Strategy)

**Status**: 🔴 Not Implemented | **Timeline**: 3 weeks | **Dependencies**: Workspaces

Polar.sh-based billing with premium feature gating:

**Premium Features (Pro Plan Only)**:

- ✅ **AI Mode + TypeForm Mode** (currently available to all)
- ✅ **No Formlink Branding** (white-label experience)
- ✅ **Custom Brand Assets** (logos, colors, fonts)
- ✅ **Email Notifications** (to creator and respondents)
- ✅ **Advanced Integrations** (beyond basic webhooks)

**Subscription Tiers**:

- **Free**: Basic forms, Formlink branding, 100 responses/month, webhooks only
- **Pro ($29/month)**: All premium features, unlimited responses, custom branding
- **Team ($99/month)**: Pro + workspaces, team collaboration, priority support

**Implementation Using Polar.sh**:

```typescript
// Polar integration
import { Polar } from "@polar-sh/sdk";

interface PremiumFeatureGate {
  aiMode: boolean;
  typeformMode: boolean;
  customBranding: boolean;
  emailNotifications: boolean;
  advancedIntegrations: boolean;
  unlimitedResponses: boolean;
}

class SubscriptionService {
  async checkFeatureAccess(
    userId: string,
    feature: keyof PremiumFeatureGate,
  ): Promise<boolean> {
    const subscription = await polar.subscriptions.get(userId);
    return subscription.plan.features.includes(feature);
  }
}
```

**Billing Portal**: Polar's customer portal for self-service subscription management

---

#### 10. A/B Testing Platform

**Status**: 🔴 Not Implemented | **Timeline**: 3 weeks | **Dependencies**: Analytics

Built-in experimentation:

- **Form variants** with traffic splitting
- **Question variants** for copy testing
- **Statistical significance** calculations
- **Winner selection** automation

---

#### 11. Multi-Language Support

**Status**: 🔴 Not Implemented | **Timeline**: 3 weeks | **Dependencies**: None

Internationalization:

- **Form translations** with fallbacks
- **RTL support** for Arabic/Hebrew
- **Locale detection** and switching
- **Response language** tracking

---

#### 12. Custom Branding & White Label (Premium Feature)

**Status**: 🟡 DB Ready | **Timeline**: 2 weeks | **Dependencies**: Premium gating

**Premium Feature** - Custom branding for Pro+ plans:

- **Remove Formlink Branding**: Clean, unbranded experience
- **Logo Upload**: Custom brand assets and positioning
- **Color Scheme**: Full theme customization
- **Font Selection**: Typography control
- **CSS Overrides**: Advanced styling for power users
- **White Label Domains**: Custom domain support

**Free Plan Limitation**: Shows "Powered by Formlink" branding

---

#### 13. Custom Domains (Moved Down)

**Status**: 🔴 Not Implemented | **Timeline**: 2 weeks | **Dependencies**: Infrastructure

Domain management:

- CNAME setup instructions
- SSL auto-provisioning
- Subdomain support
- Domain verification

---

## Premium Feature Strategy

### Polar.sh Integration Plan

**Phase 1: Billing Infrastructure** (2 weeks)

1. Set up Polar.sh organization and products
2. Integrate Polar SDK into codebase
3. Create subscription webhook handlers
4. Implement feature gating middleware

**Phase 2: Feature Gating** (1 week)

1. Add premium checks to AI/TypeForm modes
2. Implement branding removal logic
3. Gate email notifications
4. Restrict advanced integrations

**Phase 3: UI Integration** (1 week)

1. Add upgrade prompts throughout app
2. Integrate Polar customer portal
3. Show plan status in dashboard
4. Payment flow integration

### Free vs Pro Feature Matrix

| Feature             | Free Plan             | Pro Plan ($29/mo)           |
| ------------------- | --------------------- | --------------------------- |
| Forms               | 5 forms               | Unlimited                   |
| Responses           | 100/month             | Unlimited                   |
| AI Mode             | ❌                    | ✅                          |
| TypeForm Mode       | ❌                    | ✅                          |
| Branding            | "Powered by Formlink" | White-label                 |
| Email Notifications | ❌                    | ✅                          |
| Integrations        | Webhooks only         | Zapier, Google Sheets, etc. |
| Custom Domains      | ❌                    | ✅                          |
| Analytics           | Basic                 | Advanced                    |

## Implementation Strategy

### Quick Wins (1-2 weeks each)

1. ✅ Polar.sh billing setup (infrastructure exists)
2. ✅ Premium feature gating (database ready)
3. ✅ Email notifications (UI exists)

### High Impact (3-4 weeks each)

1. 🎯 Runtime AI Enhancement with cross-mode branching
2. 🎯 TypeForm mode polish
3. 🎯 Workspaces and teams

### Platform Building (4-6 weeks each)

1. 📦 Component extension pack
2. 📦 Integrations hub
3. 📦 Full analytics dashboard

## Critical Path Items

These must be done in order:

1. **Groundwork** (2 weeks) - See GROUNDWORK_V2.md
2. **Better Auth Migration** (3-4 weeks) - Required for API keys and teams
3. **Runtime AI Enhancement** (4 weeks) - Enables all smart features
4. **Workspaces** (5 weeks) - Changes data model fundamentally
5. **Pricing** (3 weeks) - Monetization gateway

## Success Metrics

- **Technical**: <100ms branching decisions, 99.9% uptime
- **User**: 40% better completion rates, true branching in all modes
- **Business**: 10k MAU, $50k MRR within 6 months
- **Developer**: <1 day to add new component via plugin

## Conclusion

The updated workstreams focus on:

1. **Feature parity** across all modes (especially branching)
2. **Quick wins** that users will notice immediately
3. **Platform capabilities** that enable exponential growth
4. **Monetization path** through workspaces and billing

Each workstream builds on the groundwork foundation, ensuring sustainable development without technical debt accumulation.
