# Premium Features Implementation Plan v2

## Executive Summary

This document outlines the **revised premium features strategy** for FormCraft, focusing on **value-added premium features** rather than core functionality limitations. The approach prioritizes **user acquisition** through unlimited forms and questions while monetizing through **advanced features**, **professional tools**, and **enhanced user experience**.

**Key Strategy**: Keep core form building unlimited and free, monetize through professional features that enhance productivity and brand presence.

## Revised Premium Strategy & Tiers

### Tier Structure

#### **Free Tier (Generous)**

- ✅ **Unlimited forms**
- ✅ **Unlimited questions per form**
- ✅ **Unlimited responses/submissions**
- ✅ **AI assistance**
- ✅ **Basic themes**
- ✅ **Standard integrations (Email, Slack)**
- ✅ **Basic analytics**
- ⚠️ **FormLink branding**
- ⚠️ **Standard support**

#### **Pro Tier ($29/month)**

- ✅ **Everything in Free**
- ✅ **Remove FormLink branding** (MVP feature)
- 🚧 **Advanced analytics & reporting** (Future)
- 🚧 **CSV/Excel export** (Future)
- 🚧 **Premium integrations (Zapier, Webhooks, API)** (Future)
- 🚧 **Priority support** (Future)
- 🚧 **Custom domains** (Future)
- 🚧 **File uploads** (Future)
- 🚧 **Custom CSS** (Future)
- 🚧 **Team collaboration** (Future)

### Premium Feature Categories

#### **Value-Added Features (Not Limitations)**

- **Branding & Design**: Remove branding, live design updates, custom themes, custom CSS, logo upload, custom domains
- **Analytics & Insights**: Advanced analytics, response filtering, data export, real-time insights
- **Integrations & Automation**: Premium integrations, webhooks, API access, Zapier integration
- **Collaboration & Teams**: Team collaboration, user management
- **Advanced Features**: File uploads, multi-language support
- **Support & Service**: Priority support

#### **AI Usage**

- **Free & Pro**: Unlimited AI assistance for form creation
- **Future**: May implement form/submission limits if costs become prohibitive

## Subscription System Technical Implementation

### Simplified Database Schema

```sql
-- User subscriptions table (simplified)
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  external_customer_id TEXT, -- Polar.sh customer ID
  plan_type TEXT NOT NULL CHECK (plan_type IN ('free', 'pro')),
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Simple audit log for subscription changes
CREATE TABLE subscription_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'created', 'updated', 'canceled'
  old_status TEXT,
  new_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Polar.sh Integration Architecture

#### Simple Webhook Processing

1. **Webhook Received**: Polar.sh sends webhook to `/api/webhooks/polar`
2. **Event Processing**: Handle subscription status changes
3. **Database Update**: Update user_subscriptions table
4. **Done**: No complex retry logic or caching needed

#### Simplified Subscription Service

```typescript
// apps/formcraft/app/lib/subscription/types.ts
export interface SubscriptionStatus {
  isActive: boolean;
  isPro: boolean;
  plan: "free" | "pro";
  status: "active" | "canceled" | "past_due";
  currentPeriodEnd?: Date;
}

// apps/formcraft/app/lib/subscription/service.ts
export class SubscriptionService {
  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    const subscription = await this.db.query(
      `
      SELECT plan_type, status, current_period_end 
      FROM user_subscriptions 
      WHERE user_id = $1
    `,
      [userId],
    );

    if (!subscription || subscription.status === "canceled") {
      return {
        isActive: false,
        isPro: false,
        plan: "free",
        status: "canceled",
      };
    }

    return {
      isActive: subscription.status === "active",
      isPro: subscription.plan_type === "pro",
      plan: subscription.plan_type,
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
    };
  }

  async updateSubscription(
    userId: string,
    customerId: string,
    status: string,
  ): Promise<void> {
    const oldStatus = await this.getSubscriptionStatus(userId);

    await this.db.query(
      `
      INSERT INTO user_subscriptions (user_id, external_customer_id, plan_type, status, current_period_end)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) DO UPDATE SET
        external_customer_id = $2,
        plan_type = $3,
        status = $4,
        current_period_end = $5,
        updated_at = NOW()
    `,
      [
        userId,
        customerId,
        status === "active" ? "pro" : "free",
        status,
        status === "active"
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : null, // 30 days from now
      ],
    );

    // Simple logging
    await this.db.query(
      `
      INSERT INTO subscription_logs (user_id, action, old_status, new_status)
      VALUES ($1, $2, $3, $4)
    `,
      [userId, "updated", oldStatus.status, status],
    );
  }
}
```

### Simplified Feature Gating

#### Basic Feature Checking

```typescript
// apps/formcraft/app/lib/premium/feature-gate.ts
export async function hasFeature(
  userId: string,
  feature: string,
): Promise<boolean> {
  const subscription = await new SubscriptionService().getSubscriptionStatus(
    userId,
  );

  // Pro users get all features
  if (subscription.isPro && subscription.isActive) {
    return true;
  }

  // Free tier features
  const freeFeatures = [
    "basic_themes",
    "email_notifications",
    "basic_analytics",
  ];
  return freeFeatures.includes(feature);
}

// Simple usage checking using existing users table
export async function checkAILimit(
  userId: string,
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const subscription = await new SubscriptionService().getSubscriptionStatus(
    userId,
  );

  if (subscription.isPro && subscription.isActive) {
    return { allowed: true, current: 0, limit: -1 }; // Unlimited
  }

  // Use existing daily_message_count from users table
  const result = await db.query(
    `
    SELECT daily_message_count FROM users WHERE id = $1
  `,
    [userId],
  );

  const current = result.rows[0]?.daily_message_count || 0;
  const limit = 5; // Free tier limit

  return {
    allowed: current < limit,
    current,
    limit,
  };
}
```

#### Simple API Middleware

```typescript
// apps/formcraft/app/lib/middleware/premium.ts
export async function requirePremiumFeature(
  userId: string,
  feature: string,
): Promise<boolean> {
  return await hasFeature(userId, feature);
}

// Usage in API routes
export async function POST(request: Request) {
  const { user } = await requireAuth(request);

  // Check premium feature access
  const hasAccess = await requirePremiumFeature(user.id, "advanced_analytics");
  if (!hasAccess) {
    return new Response(
      JSON.stringify({
        error: "Premium feature required",
        upgradeUrl: "/upgrade",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Continue with premium feature logic
  return handleAdvancedAnalytics(request, user);
}
```

### Simplified Payment Flow

#### Polar.sh Integration

```typescript
// apps/formcraft/app/api/billing/upgrade/route.ts
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const { user } = await requireAuth(request);

  // Redirect to Polar.sh checkout
  const checkoutUrl = `https://polar.sh/checkout?product=formcraft-pro&customer=${user.id}`;
  return redirect(checkoutUrl);
}
```

#### Simple Customer Portal

```typescript
// apps/formcraft/app/api/billing/portal/route.ts
import { CustomerPortal } from "@polar-sh/nextjs";

export const GET = CustomerPortal({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  getCustomerId: async (req) => {
    const { user } = await requireAuth(req);
    return user.id;
  },
  server: process.env.NODE_ENV === "production" ? "production" : "sandbox",
});
```

#### Secure Webhook Handler

```typescript
// apps/formcraft/app/api/webhooks/polar/route.ts
import { createHmac } from "crypto";

export async function POST(request: Request) {
  // Verify webhook signature
  const signature = request.headers.get("polar-signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing signature" }), {
      status: 401,
    });
  }

  const body = await request.text();
  const expectedSignature = createHmac(
    "sha256",
    process.env.POLAR_WEBHOOK_SECRET!,
  )
    .update(body)
    .digest("hex");

  if (!signature.includes(expectedSignature)) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
    });
  }

  // Parse verified payload
  const { user_id, subscription_status } = JSON.parse(body);

  // Validate required fields
  if (!user_id || !subscription_status) {
    return new Response(JSON.stringify({ error: "Invalid payload" }), {
      status: 400,
    });
  }

  try {
    const subscriptionService = new SubscriptionService();
    await subscriptionService.updateSubscription(user_id, subscription_status);

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(JSON.stringify({ error: "Processing failed" }), {
      status: 500,
    });
  }
}
```

### No Caching Required

The simplified architecture doesn't require Redis caching. Subscription status is queried directly from the database when needed, which is sufficient for the current scale.

### Basic Security

```typescript
// apps/formcraft/app/lib/security/rate-limit.ts
export async function checkRateLimit(userId: string): Promise<boolean> {
  const subscription = await new SubscriptionService().getSubscriptionStatus(
    userId,
  );

  // Pro users get higher limits
  if (subscription.isPro && subscription.isActive) {
    return true; // No rate limiting for pro users
  }

  // Use existing AI rate limiting from users table
  const { allowed } = await checkAILimit(userId);
  return allowed;
}
```

## MVP Premium Features

### 1. Remove FormLink Branding

**Value Proposition**: Professional appearance for business forms

```typescript
// Simple branding component
export function FormBranding() {
  const { user } = useAuth();
  const [subscription] = useState(() => getSubscriptionStatus(user?.id));

  if (subscription?.isPro) {
    return null; // No branding for premium users
  }

  return (
    <div className="formlink-branding">
      <a href="https://formlink.com" target="_blank">
        Powered by FormLink
      </a>
    </div>
  );
}
```

### 2. Advanced Analytics

**Value Proposition**: Data-driven insights for better forms

```typescript
// Simple analytics upgrade
export function AnalyticsDashboard() {
  const { user } = useAuth();
  const [subscription] = useState(() => getSubscriptionStatus(user?.id));

  if (!subscription?.isPro) {
    return (
      <div className="analytics-upgrade">
        <h3>Basic Analytics</h3>
        <p>Total responses: {basicResponseCount}</p>
        <div className="upgrade-prompt">
          <p>Upgrade to Pro for detailed analytics</p>
          <a href="/upgrade">Upgrade Now</a>
        </div>
      </div>
    );
  }

  return (
    <div className="advanced-analytics">
      <ResponseTrends />
      <ConversionRates />
      <ExportOptions />
    </div>
  );
}
```

## Comprehensive Implementation Plan

### Implementation Timeline Overview

```
Week 1: Foundation & Payment Integration
├── Days 1-3: Database Schema & Core Services
└── Days 4-6: Payment Integration & Security

Week 2: MVP Feature & Launch
├── Days 7-8: MVP Feature Implementation (Remove Branding)
├── Days 9-10: Testing & Validation
└── Days 11-12: Production Deployment & Gradual Rollout

Week 3: Future Feature Planning
└── Days 13-14: Optimization & Plan Future Premium Features
```

### Phase 1: Database Schema & Core Services (Days 1-3)

**Foundation Setup - Zero Payment Processing**

#### Database Schema Implementation

- Create subscription tables with proper constraints and indexes
- Add migration scripts with rollback capabilities
- Update existing users table to integrate with subscriptions
- Set up proper foreign key relationships and RLS policies

#### Basic Subscription Service

- Implement core SubscriptionService class
- Create subscription status checking functions
- Add basic feature gating infrastructure
- Implement user subscription queries

#### Key Deliverables

- Database migration scripts (up/down)
- Core subscription service with basic CRUD operations
- Initial feature gating hooks
- Unit tests for subscription logic

#### Risk Mitigation

- Use Supabase migrations with automatic rollback
- Test on staging environment first
- Maintain existing user experience unchanged
- Add comprehensive logging for debugging

### Phase 2: Payment Integration & Security (Days 4-6)

**Secure Payment Processing with Polar.sh**

#### Polar.sh Integration Setup

- Configure Polar.sh organization and products
- Set up sandbox environment for testing
- Implement secure webhook handler with signature verification
- Create customer portal integration
- Add environment variables and configuration

#### Payment Flow Implementation

- Create upgrade/downgrade API endpoints
- Implement subscription creation and management
- Add payment success/failure handling
- Set up subscription status synchronization
- Create billing management interface

#### Security & Validation

- Implement HMAC signature verification for webhooks
- Add input validation for all payment-related endpoints
- Create proper error handling and logging
- Set up webhook retry mechanisms
- Add rate limiting for payment endpoints

#### Key Deliverables

- Secure webhook handler with signature verification
- Payment processing API endpoints
- Polar.sh customer portal integration
- Comprehensive error handling and logging
- Sandbox testing suite

### Phase 3: MVP Feature Implementation (Days 7-8)

**Implement Single MVP Feature: Remove Branding**

#### Feature Gating Infrastructure

- Create feature gating middleware for API routes
- Implement premium status checking in components
- Add feature flag system for gradual rollout
- Create premium feature hooks for React components

#### MVP Feature: Remove FormLink Branding

- Identify all FormLink branding locations in forms
- Create conditional branding component based on subscription status
- Add "Powered by FormLink" footer for free users only
- Hide branding for Pro subscribers

#### UI Updates for MVP

- Add upgrade prompts in strategic locations
- Create "Upgrade to Pro" buttons/CTAs
- Implement billing management interface
- Add Pro badge/indicator for subscribed users

#### Integration Points

- Integrate premium checks with existing authentication
- Add subscription status to user context/state
- Create reusable premium feature checking utilities

### Phase 4: Testing & Validation (Days 9-10)

**Comprehensive System Testing**

#### Testing Strategy

1. **Unit Testing**: Test all subscription service methods and feature gating logic
2. **Integration Testing**: Test payment flows end-to-end in sandbox environment
3. **Security Testing**: Validate webhook signature verification and input validation
4. **Performance Testing**: Ensure no degradation in response times with premium checks
5. **User Experience Testing**: Test upgrade flows and premium feature access

#### Validation Scenarios

- **New User Journey**: Sign up → upgrade → access premium features
- **Existing User Journey**: Current user → upgrade → premium features work
- **Payment Failure Scenarios**: Failed payments, expired cards, downgrades
- **Edge Cases**: Webhook failures, network issues, concurrent updates
- **Security Scenarios**: Invalid signatures, malicious payloads, rate limiting

#### Pre-Production Checklist

- [ ] All unit tests passing
- [ ] Integration tests covering payment flows
- [ ] Security tests for webhook handling
- [ ] Performance benchmarks maintained
- [ ] Rollback procedures tested
- [ ] Monitoring and alerting configured
- [ ] Documentation updated

### Phase 5: Production Deployment & Gradual Rollout (Days 11-12)

**Risk-Minimized Launch Strategy**

#### Deployment Strategy

```
Day 11 Morning:    Deploy infrastructure (database, services)
Day 11 Afternoon:  Enable payment processing for new users
Day 12 Morning:    Gradual rollout to existing users (10% → 50% → 100%)
Day 12 Afternoon:  Full feature activation and monitoring
```

#### Rollout Phases

1. **Internal Testing**: Team members test full premium flow
2. **Beta Users**: Invite 10-20 beta users to test premium features
3. **New User Rollout**: All new signups see premium features
4. **Existing User Rollout**: Gradual exposure to existing user base
5. **Full Launch**: Complete premium feature availability

#### Monitoring & Alerts

- **Payment Metrics**: Track conversion rates, payment failures, refunds
- **System Performance**: Monitor API response times, error rates
- **User Behavior**: Track engagement with premium features
- **Business Metrics**: Monitor MRR, churn, upgrade patterns
- **Security Monitoring**: Watch for webhook abuse, payment fraud

#### Rollback Procedures

- **Level 1**: Disable premium UI (feature flag)
- **Level 2**: Disable payment processing (keep existing subscriptions)
- **Level 3**: Full rollback to pre-premium state
- **Recovery**: Procedures for data recovery and user communication

### Phase 6: Post-Launch Optimization & Future Features (Days 13-14)

**Data-Driven Optimization**

#### Performance Optimization

- **Database Query Optimization**: Analyze slow queries and add indexes as needed
- **Caching Implementation**: Add Redis caching for frequently accessed subscription data
- **API Response Optimization**: Optimize premium feature checks for better performance
- **CDN Integration**: Optimize premium UI assets delivery
- **Database Connection Pooling**: Optimize database connections for subscription queries

#### User Experience Refinements

- **Conversion Rate Optimization**: A/B test upgrade prompts and pricing displays
- **Onboarding Improvements**: Streamline premium feature discovery and adoption
- **Billing UX Enhancements**: Improve payment flow and billing management interface
- **Feature Discoverability**: Add better premium feature showcasing and tutorials
- **Mobile Optimization**: Ensure premium features work smoothly on mobile devices

#### Business Intelligence & Future Planning

- **Revenue Analytics**: Track MRR, churn, conversion rates
- **MVP Feature Usage**: Monitor branding removal effectiveness
- **Conversion Funnel Analysis**: Identify bottlenecks in the upgrade process
- **Customer Feedback**: Collect feedback on what premium features users want most
- **Feature Roadmap**: Plan next premium features based on user demand

## Technical Implementation Details

### MVP Launch Configuration

**Goal**: Basic premium features with Polar.sh integration

#### 1.1 Polar.sh Setup

```bash
pnpm add @polar-sh/nextjs
```

#### 1.2 Environment Variables

```bash
POLAR_ACCESS_TOKEN=your_token_here
POLAR_ORGANIZATION=formcraft
POLAR_WEBHOOK_SECRET=your_webhook_secret_here
```

#### 1.3 Database Migration

```sql
-- Add simplified subscription table
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  external_customer_id TEXT,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('free', 'pro')),
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

#### 1.4 Basic Premium Hook

```typescript
// apps/formcraft/app/hooks/usePremium.ts
export function usePremium() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(
    null,
  );

  useEffect(() => {
    if (user) {
      getSubscriptionStatus(user.id).then(setSubscription);
    }
  }, [user]);

  return {
    isPro: subscription?.isPro || false,
    isActive: subscription?.isActive || false,
  };
}
```

#### 1.5 Upgrade Button

```typescript
// apps/formcraft/app/components/UpgradeButton.tsx
export function UpgradeButton() {
  const { isPro } = usePremium();

  if (isPro) return null;

  return (
    <Button onClick={() => window.location.href = '/api/billing/upgrade'}>
      Upgrade to Pro
    </Button>
  );
}
```

### Phase 2: Feature Expansion (Week 3-4)

**Goal**: Add more premium features based on user feedback

Only add features that users actually request:

- File uploads
- Custom domains
- Advanced integrations
- Team collaboration

### Total Implementation Time: 2 weeks instead of 8 weeks

## Simplified User Experience

### Value-Focused Approach

- **Generous Free Tier**: Unlimited forms and questions
- **Clear Value Proposition**: Professional branding and insights
- **Simple Upgrade Path**: One-click upgrade to Pro
- **Immediate Benefits**: Features activate instantly

### Simple Upgrade Flow

```typescript
// Simple upgrade prompt
export function UpgradePrompt() {
  const { isPro } = usePremium();

  if (isPro) return null;

  return (
    <div className="upgrade-prompt">
      <h4>Go Pro</h4>
      <p>Remove branding and get advanced analytics</p>
      <Button onClick={() => window.location.href = '/api/billing/upgrade'}>
        Upgrade - $29/month
      </Button>
    </div>
  );
}
```

## Success Metrics

### Key Targets

- **Free → Pro Conversion**: 5-10%
- **Monthly Churn**: <5%
- **Time to Market**: 2 weeks (vs 8 weeks with Stripe)
- **Development Cost**: 70% reduction

### Revenue Targets

- **Month 1**: $5K MRR
- **Month 3**: $15K MRR
- **Month 6**: $40K MRR
- **Month 12**: $100K MRR

## Benefits of This Approach

### Technical Benefits

- **70% less code** than Stripe implementation
- **No Redis required** - simple database queries
- **No complex webhook handling** - basic event processing
- **Faster development** - 2 weeks vs 8 weeks

### Business Benefits

- **20% lower fees** than Stripe
- **Faster time to market** - validate demand quicker
- **Less maintenance** - fewer moving parts
- **Better developer experience** - simpler debugging

### User Benefits

- **Generous free tier** - no artificial limits
- **Clear value proposition** - professional features
- **Simple upgrade process** - one-click checkout
- **Immediate feature access** - no complex provisioning

## Critical Success Factors

1. **Security First**: Webhook signature verification is non-negotiable
2. **Incremental Rollout**: Gradual deployment minimizes risk
3. **Existing User Protection**: Preserve current user experience during transition
4. **Data-Driven Decisions**: Use metrics to guide optimization efforts

## Resource Requirements

- **Development**: 1-2 full-stack developers with payment integration experience
- **Testing**: QA engineer for comprehensive testing in phases 4-5
- **DevOps**: System administrator for deployment and monitoring setup
- **Product**: Product manager for user experience optimization

## Immediate First Steps

1. Create database migration for subscription tables
2. Set up Polar.sh sandbox environment
3. Implement core SubscriptionService class
4. Begin webhook security implementation

## Long-term Success Metrics

- 5-10% free-to-paid conversion rate
- <5% monthly churn rate
- $10K+ MRR within 90 days
- 90%+ customer satisfaction with premium features

This comprehensive approach allows FormCraft to launch premium features systematically, validate user demand through data-driven optimization, and iterate based on real feedback rather than anticipated needs.
