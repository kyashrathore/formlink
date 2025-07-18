# Premium Features Implementation Plan v1

## Executive Summary

This document outlines the comprehensive implementation plan for premium features in FormCraft, building on the existing Supabase authentication and authorization infrastructure. The plan focuses on **gradual rollout**, **user-friendly monetization**, and **scalable architecture** to drive sustainable revenue growth.

**Key Strategy**: Leverage existing solid foundations while adding subscription management, feature gating, and billing infrastructure using industry best practices.

## Current State Analysis

### ✅ **Existing Strengths**

- **Solid Authentication**: Supabase auth with anonymous user support
- **Authorization Framework**: Middleware patterns for user permissions
- **Usage Tracking**: Basic message limits and form restrictions
- **Database Schema**: Clean design with `users.premium` boolean field
- **Anonymous User System**: Well-implemented guest experience

### ❌ **Missing Components**

- **Billing Integration**: No Stripe or payment processing
- **Subscription Management**: No recurring billing logic
- **Feature Gating System**: No premium feature restrictions
- **Organization/Team Features**: No collaborative features
- **Advanced User Roles**: Only basic user/anonymous distinction

## Premium Strategy & Tiers

### Tier Structure

#### **Free Tier (Current)**

- 3 forms maximum
- 100 submissions per month
- 5 AI messages per day
- Basic themes
- FormLink branding

#### **Pro Tier ($29/month)**

- Unlimited forms
- 10,000 submissions per month
- 1,000 AI messages per day
- Custom branding removal
- Advanced themes & design customization
- Form analytics
- CSV export
- Priority support

#### **Enterprise Tier ($99/month)**

- Everything in Pro
- Unlimited submissions
- Unlimited AI messages
- Team collaboration (5 members)
- Custom domains
- Advanced analytics
- API access
- White-label options
- SSO integration
- Dedicated support

### Premium Feature Categories

#### **Core Limitations (Free → Pro)**

```typescript
const TIER_LIMITS = {
  free: {
    forms: 3,
    submissions_per_month: 100,
    ai_messages_per_day: 5,
    team_members: 1,
    storage_mb: 100,
    custom_domains: 0,
  },
  pro: {
    forms: -1, // unlimited
    submissions_per_month: 10000,
    ai_messages_per_day: 1000,
    team_members: 1,
    storage_mb: 10000,
    custom_domains: 0,
  },
  enterprise: {
    forms: -1,
    submissions_per_month: -1,
    ai_messages_per_day: -1,
    team_members: 5,
    storage_mb: 100000,
    custom_domains: 3,
  },
};
```

#### **Premium Features**

```typescript
const PREMIUM_FEATURES = {
  // Design & Branding
  CUSTOM_BRANDING: { free: false, pro: true, enterprise: true },
  ADVANCED_THEMES: { free: false, pro: true, enterprise: true },
  CUSTOM_CSS: { free: false, pro: true, enterprise: true },
  LOGO_UPLOAD: { free: false, pro: true, enterprise: true },

  // Analytics & Reporting
  ADVANCED_ANALYTICS: { free: false, pro: true, enterprise: true },
  DATA_EXPORT: { free: false, pro: true, enterprise: true },
  RESPONSE_FILTERING: { free: false, pro: true, enterprise: true },

  // Collaboration & Teams
  TEAM_COLLABORATION: { free: false, pro: false, enterprise: true },
  USER_MANAGEMENT: { free: false, pro: false, enterprise: true },
  ROLE_PERMISSIONS: { free: false, pro: false, enterprise: true },

  // Integration & API
  API_ACCESS: { free: false, pro: true, enterprise: true },
  WEBHOOKS: { free: false, pro: true, enterprise: true },
  CUSTOM_DOMAINS: { free: false, pro: false, enterprise: true },

  // Advanced Features
  CONDITIONAL_LOGIC: { free: false, pro: true, enterprise: true },
  FILE_UPLOADS: { free: false, pro: true, enterprise: true },
  PAYMENT_COLLECTION: { free: false, pro: false, enterprise: true },
  WHITE_LABEL: { free: false, pro: false, enterprise: true },
};
```

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal**: Database schema, billing infrastructure, and basic feature gating

#### 1.1 Database Schema Extensions

```sql
-- Subscription plans
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  features JSONB NOT NULL,
  limits JSONB NOT NULL,
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User subscriptions
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'trialing')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage tracking (extend existing)
CREATE TABLE usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL, -- 'forms', 'submissions', 'ai_messages', 'storage'
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, metric_type, period_start)
);

-- Organizations (for team features)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  subscription_id UUID REFERENCES user_subscriptions(id),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization members
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);
```

#### 1.2 Stripe Integration Setup

```typescript
// apps/formcraft/app/lib/stripe.ts
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
  typescript: true,
});

export const STRIPE_PLANS = {
  pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
  pro_yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID!,
  enterprise_monthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID!,
  enterprise_yearly: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID!,
};
```

#### 1.3 Premium Hook Implementation

```typescript
// apps/formcraft/app/hooks/usePremium.ts
interface PremiumHook {
  subscription: UserSubscription | null;
  plan: SubscriptionPlan | null;
  hasFeature: (feature: keyof typeof PREMIUM_FEATURES) => boolean;
  checkLimit: (
    resource: string,
    current: number,
  ) => { allowed: boolean; limit: number };
  upgradeUrl: (planSlug: string) => string;
  isLoading: boolean;
}

export function usePremium(): PremiumHook {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(
    null,
  );
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load subscription data
  useEffect(() => {
    if (user) {
      loadUserSubscription(user.id)
        .then(({ subscription, plan }) => {
          setSubscription(subscription);
          setPlan(plan);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const hasFeature = useCallback(
    (feature: keyof typeof PREMIUM_FEATURES) => {
      if (!plan) return PREMIUM_FEATURES[feature].free;

      return PREMIUM_FEATURES[feature][
        plan.slug as keyof (typeof PREMIUM_FEATURES)[typeof feature]
      ];
    },
    [plan],
  );

  const checkLimit = useCallback(
    (resource: string, current: number) => {
      const planLimits = plan
        ? TIER_LIMITS[plan.slug as keyof typeof TIER_LIMITS]
        : TIER_LIMITS.free;
      const limit = planLimits[resource as keyof typeof planLimits] as number;

      return {
        allowed: limit === -1 || current < limit,
        limit: limit === -1 ? Infinity : limit,
      };
    },
    [plan],
  );

  const upgradeUrl = useCallback((planSlug: string) => {
    return `/upgrade?plan=${planSlug}`;
  }, []);

  return {
    subscription,
    plan,
    hasFeature,
    checkLimit,
    upgradeUrl,
    isLoading,
  };
}
```

### Phase 2: Billing Infrastructure (Week 3-4)

**Goal**: Complete Stripe integration with checkout and billing management

#### 2.1 Billing API Endpoints

```typescript
// apps/formcraft/app/api/billing/checkout/route.ts
export async function POST(request: Request) {
  const { user } = await requireAuth(request);
  const { planSlug, interval = "monthly" } = await request.json();

  try {
    const plan = await getPlanBySlug(planSlug);
    const priceId =
      interval === "yearly"
        ? plan.stripe_price_id_yearly
        : plan.stripe_price_id_monthly;

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${getBaseUrl()}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getBaseUrl()}/billing/canceled`,
      metadata: { userId: user.id, planSlug },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    return Response.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}

// apps/formcraft/app/api/billing/portal/route.ts
export async function POST(request: Request) {
  const { user } = await requireAuth(request);

  try {
    const subscription = await getUserSubscription(user.id);
    if (!subscription?.stripe_customer_id) {
      return Response.json({ error: "No subscription found" }, { status: 404 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${getBaseUrl()}/billing`,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    return Response.json(
      { error: "Failed to create portal session" },
      { status: 500 },
    );
  }
}

// apps/formcraft/app/api/billing/webhook/route.ts
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature")!;

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );

    switch (event.type) {
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;
      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;
    }

    return Response.json({ received: true });
  } catch (error) {
    return Response.json({ error: "Webhook error" }, { status: 400 });
  }
}
```

#### 2.2 Subscription Management Components

```typescript
// apps/formcraft/app/components/billing/PlanSelector.tsx
interface PlanSelectorProps {
  currentPlan?: SubscriptionPlan;
  onPlanSelect: (planSlug: string, interval: 'monthly' | 'yearly') => void;
}

export function PlanSelector({ currentPlan, onPlanSelect }: PlanSelectorProps) {
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);

  useEffect(() => {
    loadAvailablePlans().then(setPlans);
  }, []);

  return (
    <div className="plan-selector">
      <div className="interval-toggle">
        <Button
          variant={interval === 'monthly' ? 'default' : 'outline'}
          onClick={() => setInterval('monthly')}
        >
          Monthly
        </Button>
        <Button
          variant={interval === 'yearly' ? 'default' : 'outline'}
          onClick={() => setInterval('yearly')}
        >
          Yearly <Badge>Save 20%</Badge>
        </Button>
      </div>

      <div className="plans-grid">
        {plans.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            interval={interval}
            isCurrent={currentPlan?.id === plan.id}
            onSelect={() => onPlanSelect(plan.slug, interval)}
          />
        ))}
      </div>
    </div>
  );
}

// apps/formcraft/app/components/billing/PlanCard.tsx
interface PlanCardProps {
  plan: SubscriptionPlan;
  interval: 'monthly' | 'yearly';
  isCurrent: boolean;
  onSelect: () => void;
}

export function PlanCard({ plan, interval, isCurrent, onSelect }: PlanCardProps) {
  const price = interval === 'yearly' ? plan.price_yearly : plan.price_monthly;
  const features = plan.features as string[];

  return (
    <Card className={`plan-card ${isCurrent ? 'current' : ''}`}>
      <CardHeader>
        <CardTitle>{plan.name}</CardTitle>
        <div className="price">
          ${price}
          <span className="interval">/{interval === 'yearly' ? 'year' : 'month'}</span>
        </div>
      </CardHeader>

      <CardContent>
        <ul className="features-list">
          {features.map(feature => (
            <li key={feature}>
              <Check className="check-icon" />
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        <Button
          onClick={onSelect}
          disabled={isCurrent}
          className="w-full"
        >
          {isCurrent ? 'Current Plan' : 'Select Plan'}
        </Button>
      </CardFooter>
    </Card>
  );
}
```

### Phase 3: Feature Gating Integration (Week 5-6)

**Goal**: Implement premium feature restrictions throughout the app

#### 3.1 Feature Gate Components

```typescript
// apps/formcraft/app/components/premium/PremiumGate.tsx
interface PremiumGateProps {
  feature: keyof typeof PREMIUM_FEATURES;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgrade?: boolean;
}

export function PremiumGate({ feature, children, fallback, showUpgrade = true }: PremiumGateProps) {
  const { hasFeature, upgradeUrl } = usePremium();

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showUpgrade) {
    return (
      <div className="premium-gate">
        <div className="gate-content">
          <Crown className="crown-icon" />
          <h3>Premium Feature</h3>
          <p>This feature is available with a Pro subscription.</p>
          <Button asChild>
            <Link href={upgradeUrl('pro')}>
              Upgrade to Pro
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

// apps/formcraft/app/components/premium/UsageIndicator.tsx
interface UsageIndicatorProps {
  resource: string;
  current: number;
  showUpgrade?: boolean;
}

export function UsageIndicator({ resource, current, showUpgrade = true }: UsageIndicatorProps) {
  const { checkLimit, upgradeUrl } = usePremium();
  const { allowed, limit } = checkLimit(resource, current);

  if (limit === Infinity) return null;

  const percentage = (current / limit) * 100;
  const isNearLimit = percentage >= 80;
  const isAtLimit = !allowed;

  return (
    <div className={`usage-indicator ${isAtLimit ? 'at-limit' : isNearLimit ? 'near-limit' : ''}`}>
      <div className="usage-header">
        <span className="usage-label">{resource}</span>
        <span className="usage-count">{current} / {limit}</span>
      </div>

      <div className="usage-bar">
        <div
          className="usage-fill"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {isAtLimit && showUpgrade && (
        <div className="upgrade-prompt">
          <p>You've reached your {resource} limit.</p>
          <Button size="sm" asChild>
            <Link href={upgradeUrl('pro')}>
              Upgrade Plan
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
```

#### 3.2 Feature Integration Examples

```typescript
// Form creation with limits
export function CreateFormButton() {
  const { checkLimit } = usePremium();
  const { data: userForms } = useUserForms();

  const { allowed, limit } = checkLimit('forms', userForms?.length || 0);

  if (!allowed) {
    return (
      <PremiumGate feature="UNLIMITED_FORMS">
        <Button disabled>
          Create Form (Limit Reached)
        </Button>
      </PremiumGate>
    );
  }

  return (
    <Button onClick={handleCreateForm}>
      Create Form
    </Button>
  );
}

// Theme customization
export function ThemeCustomization() {
  return (
    <PremiumGate feature="ADVANCED_THEMES">
      <div className="theme-customization">
        <ColorPicker />
        <FontSelector />
        <BrandingOptions />
      </div>
    </PremiumGate>
  );
}

// Analytics dashboard
export function AnalyticsDashboard() {
  return (
    <PremiumGate
      feature="ADVANCED_ANALYTICS"
      fallback={<BasicAnalytics />}
    >
      <AdvancedAnalytics />
    </PremiumGate>
  );
}
```

### Phase 4: Team & Organization Features (Week 7-8)

**Goal**: Implement team collaboration for Enterprise tier

#### 4.1 Organization Management

```typescript
// apps/formcraft/app/components/teams/OrganizationSettings.tsx
export function OrganizationSettings() {
  const { organization } = useOrganization();
  const { members, invitePending } = useOrganizationMembers();

  return (
    <PremiumGate feature="TEAM_COLLABORATION">
      <div className="organization-settings">
        <div className="section">
          <h3>Team Members</h3>
          <MembersList members={members} />
          <InviteMemberForm onInvite={handleInviteMember} />
        </div>

        <div className="section">
          <h3>Pending Invitations</h3>
          <PendingInvitesList invites={invitePending} />
        </div>

        <div className="section">
          <h3>Billing</h3>
          <TeamBillingInfo />
        </div>
      </div>
    </PremiumGate>
  );
}
```

## User Experience Flow

### Free User Journey

1. **Discovery**: User signs up, creates first form
2. **Engagement**: Uses basic features, hits limits
3. **Friction**: "You've reached your form limit" message
4. **Consideration**: Views pricing page, sees value
5. **Conversion**: Upgrades to Pro for unlimited forms

### Premium User Journey

1. **Onboarding**: Smooth upgrade experience
2. **Value Realization**: Immediately gets unlimited access
3. **Feature Discovery**: Explores advanced features
4. **Retention**: Continued value from premium features
5. **Expansion**: Considers Enterprise for team features

### Upgrade Experience

```typescript
// apps/formcraft/app/upgrade/page.tsx
export default function UpgradePage() {
  const { plan } = usePremium();
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUpgrade = async (planSlug: string, interval: 'monthly' | 'yearly') => {
    setIsProcessing(true);

    try {
      const { url } = await createCheckoutSession(planSlug, interval);
      window.location.href = url;
    } catch (error) {
      toast.error('Failed to start upgrade process');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="upgrade-page">
      <div className="upgrade-header">
        <h1>Choose Your Plan</h1>
        <p>Unlock advanced features and remove limits</p>
      </div>

      <PlanSelector
        currentPlan={plan}
        onPlanSelect={handleUpgrade}
      />

      <div className="upgrade-footer">
        <div className="guarantees">
          <div className="guarantee">
            <Shield className="icon" />
            <span>30-day money-back guarantee</span>
          </div>
          <div className="guarantee">
            <CreditCard className="icon" />
            <span>Cancel anytime</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Testing Strategy

### Unit Tests

```typescript
// Premium hook testing
describe('usePremium', () => {
  it('should return correct feature access for free user', () => {
    const { result } = renderHook(() => usePremium(), {
      wrapper: ({ children }) => (
        <AuthProvider user={mockFreeUser}>
          {children}
        </AuthProvider>
      )
    });

    expect(result.current.hasFeature('CUSTOM_BRANDING')).toBe(false);
    expect(result.current.hasFeature('UNLIMITED_FORMS')).toBe(false);
  });

  it('should return correct limits for pro user', () => {
    const { result } = renderHook(() => usePremium(), {
      wrapper: ({ children }) => (
        <AuthProvider user={mockProUser}>
          {children}
        </AuthProvider>
      )
    });

    const { allowed, limit } = result.current.checkLimit('forms', 5);
    expect(allowed).toBe(true);
    expect(limit).toBe(Infinity);
  });
});
```

### Integration Tests

```typescript
// Billing flow testing
describe("Billing Integration", () => {
  it("should create Stripe checkout session", async () => {
    const response = await request(app)
      .post("/api/billing/checkout")
      .send({ planSlug: "pro", interval: "monthly" })
      .expect(200);

    expect(response.body.url).toContain("checkout.stripe.com");
  });

  it("should handle subscription webhook", async () => {
    const webhook = createMockWebhook("customer.subscription.created");

    await request(app)
      .post("/api/billing/webhook")
      .send(webhook.body)
      .set("stripe-signature", webhook.signature)
      .expect(200);

    // Verify subscription was created in database
    const subscription = await getUserSubscription(webhook.userId);
    expect(subscription.status).toBe("active");
  });
});
```

## Analytics & Metrics

### Key Metrics to Track

```typescript
// Revenue metrics
const REVENUE_METRICS = {
  MRR: "Monthly Recurring Revenue",
  ARR: "Annual Recurring Revenue",
  CHURN_RATE: "Monthly churn rate",
  UPGRADE_RATE: "Free to paid conversion rate",
  EXPANSION_REVENUE: "Pro to Enterprise upgrades",
};

// User behavior metrics
const USER_METRICS = {
  FEATURE_ADOPTION: "Premium feature usage rates",
  LIMIT_ENCOUNTERS: "How often users hit limits",
  UPGRADE_FUNNEL: "Upgrade flow completion rates",
  RETENTION_RATE: "Monthly active premium users",
};
```

### Analytics Implementation

```typescript
// apps/formcraft/app/lib/analytics/premium.ts
export const premiumAnalytics = {
  trackLimitReached: (
    userId: string,
    resource: string,
    current: number,
    limit: number,
  ) => {
    analytics.track("Limit Reached", {
      userId,
      resource,
      current,
      limit,
      percentage: (current / limit) * 100,
    });
  },

  trackUpgradeStarted: (userId: string, fromPlan: string, toPlan: string) => {
    analytics.track("Upgrade Started", {
      userId,
      fromPlan,
      toPlan,
      upgradePath: `${fromPlan} → ${toPlan}`,
    });
  },

  trackFeatureUsage: (userId: string, feature: string, planTier: string) => {
    analytics.track("Premium Feature Used", {
      userId,
      feature,
      planTier,
      featureCategory: getPremiumFeatureCategory(feature),
    });
  },
};
```

## Security Considerations

### Data Protection

```typescript
// Row-level security for subscription data
CREATE POLICY "Users can only access their own subscription data"
  ON user_subscriptions
  FOR ALL
  USING (user_id = auth.uid());

// Organization access control
CREATE POLICY "Organization members can access organization data"
  ON organizations
  FOR ALL
  USING (
    id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
```

### Webhook Security

```typescript
// Stripe webhook verification
export function verifyStripeWebhook(body: string, signature: string): boolean {
  try {
    stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
    return true;
  } catch (error) {
    console.error("Webhook verification failed:", error);
    return false;
  }
}
```

## Launch Strategy

### Phase 1: Soft Launch (Week 9)

- Enable premium features for existing users
- Internal testing with team members
- Monitor metrics and fix issues
- Gather feedback from beta users

### Phase 2: Limited Launch (Week 10)

- Announce to email subscribers
- Enable upgrade prompts for limit encounters
- Social media soft announcement
- Monitor conversion rates

### Phase 3: Full Launch (Week 11)

- Public announcement
- Update marketing website
- Press release and outreach
- Full promotional campaign

### Phase 4: Optimization (Week 12+)

- A/B test pricing and features
- Optimize conversion funnel
- Add more premium features
- Expand to new market segments

## Success Metrics

### Financial Targets

- **Month 1**: $5K MRR
- **Month 3**: $15K MRR
- **Month 6**: $40K MRR
- **Month 12**: $100K MRR

### User Metrics

- **Free → Pro Conversion**: 3-5%
- **Pro → Enterprise**: 10-15%
- **Monthly Churn**: <5%
- **Feature Adoption**: >70% of premium users use advanced features

### Technical Metrics

- **Billing Uptime**: 99.9%
- **Webhook Processing**: <5s average
- **Checkout Success**: >95%
- **Support Tickets**: <2% of revenue

## Risk Mitigation

### Technical Risks

1. **Stripe Integration Issues**: Comprehensive testing and monitoring
2. **Database Performance**: Optimize queries and add indexes
3. **Feature Gate Bypasses**: Server-side validation for all limits
4. **Webhook Failures**: Retry logic and manual reconciliation

### Business Risks

1. **Low Conversion Rates**: A/B testing and user feedback
2. **High Churn**: Focus on user value and retention features
3. **Competitive Pressure**: Unique value proposition and innovation
4. **Support Burden**: Self-service tools and documentation

## Future Enhancements

### Advanced Features

- **Usage-Based Pricing**: Pay-per-submission model
- **White-Label Solutions**: Complete branding customization
- **Advanced Analytics**: Machine learning insights
- **Enterprise SSO**: SAML/OAuth integration

### Market Expansion

- **International Markets**: Multi-currency support
- **Enterprise Sales**: Dedicated sales team
- **Partner Program**: Affiliate and reseller network
- **Industry Solutions**: Vertical-specific features

This comprehensive plan provides a roadmap for implementing premium features that will drive sustainable revenue growth while maintaining excellent user experience and technical quality.
