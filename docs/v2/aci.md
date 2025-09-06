# ACI.dev (Agent-Computer Interface) - Comprehensive Integration Guide

## Table of Contents

1. [What is ACI.dev](#what-is-acidev)
2. [Architecture Overview](#architecture-overview)
3. [Core Concepts](#core-concepts)
4. [Authentication Flow](#authentication-flow)
5. [Integration Patterns](#integration-patterns)
6. [Self-Hosting Setup](#self-hosting-setup)
7. [TypeScript SDK](#typescript-sdk)
8. [Fork Maintenance Strategy](#fork-maintenance-strategy)
9. [Implementation Roadmap](#implementation-roadmap)

---

## What is ACI.dev?

**ACI.dev (Agent-Computer Interface)** is an open-source platform that provides **600+ tool integrations** for AI agents. It serves as infrastructure for connecting AI systems to external services through a unified interface.

### Key Capabilities

- **600+ Pre-built Integrations**: Gmail, GitHub, Slack, Stripe, Google Calendar, etc.
- **Multi-tenant Authentication**: Handle OAuth2, API keys, and credentials for multiple users
- **Dynamic Tool Discovery**: AI agents can search and find relevant functions based on intent
- **Secure Credential Management**: Encrypted storage of tokens and API keys with automatic refresh
- **Function Execution**: Execute actions across services using stored credentials
- **Self-hostable**: Complete control over infrastructure and data

### Why We Chose ACI.dev

- **Separation of Concerns**: Authentication setup vs execution are separate phases
- **Perfect for Form-driven UX**: Authenticate once, execute many times
- **Open Source**: Can self-host and customize for our needs
- **Extensive Integration**: 600+ tools cover most business needs
- **Enterprise Ready**: Multi-tenant, secure, scalable architecture

---

## Architecture Overview

```
Your App → Authentication Agent → Self-Hosted ACI.dev → External APIs
    ↓              ↓                      ↓              ↓
User Request → Check Auth Status → Execute Function → Return Result
```

### Core Components

1. **Backend API Server** (FastAPI)
   - `/v1/functions` - Function search and execution
   - `/v1/linked-accounts` - Authentication management
   - `/v1/apps` - App configuration
   - `/v1/projects` - Project management

2. **Frontend Portal** (Next.js)
   - Developer configuration interface
   - User authentication flows
   - App and function management

3. **Database** (PostgreSQL + pgvector)
   - Encrypted credential storage
   - Semantic function search
   - Multi-tenant data isolation

4. **Integration Layer**
   - 600+ app definitions (JSON configs)
   - Protocol adapters (REST, GraphQL, etc.)
   - Function executors with retry logic

---

## Core Concepts

### Project

- **Container for everything**: API keys, apps, agents, linked accounts
- **Multi-tenant isolation**: Each organization gets separate projects
- **Visibility controls**: Public vs private function access

### Agent

- **Programmatic actor**: Identified by API key
- **Permission system**: Controls which apps/functions agent can access
- **Rate limiting**: Per-agent quotas and usage tracking

### App

- **Service integration**: Represents external service (Gmail, GitHub, etc.)
- **Security schemes**: OAuth2, API key, or no-auth configurations
- **Function collection**: Groups of related API endpoints

### Function

- **Individual API endpoint**: Specific action within an app
- **Semantic search**: Vector embeddings for intent matching
- **Type definitions**: OpenAI/Anthropic compatible schemas

### Linked Account

- **User-service connection**: Associates user with external service
- **Credential storage**: Encrypted OAuth tokens, API keys
- **Per-user isolation**: Each end-user has separate linked accounts
- **Identified by**: `linked_account_owner_id` (your choice of format)

### App Configuration

- **Project-level setup**: Enable apps for your project
- **OAuth customization**: Use your own client IDs/secrets
- **Function selection**: Choose which functions to enable

---

## Authentication Flow

### Phase 1: Setup Authentication (One-time per user per service)

#### OAuth2 Services (Gmail, GitHub, Slack)

```typescript
// 1. Generate OAuth URL
const response = await fetch(`${ACI_BASE_URL}/v1/linked-accounts/oauth2`, {
  method: "GET",
  headers: { "X-API-KEY": ACI_API_KEY },
  params: {
    app_name: "gmail",
    linked_account_owner_id: `user_${userId}`,
    after_oauth2_link_redirect_url: "https://yourapp.com/oauth-success",
  },
});

// 2. Redirect user to OAuth URL
window.location.href = response.data.url;

// 3. User completes OAuth → tokens stored automatically in ACI
```

#### API Key Services (OpenAI, Stripe)

```typescript
// User provides API key through your app's UI
await fetch(`${ACI_BASE_URL}/v1/linked-accounts/api-key`, {
  method: "POST",
  headers: { "X-API-KEY": ACI_API_KEY },
  body: JSON.stringify({
    app_name: "openai",
    linked_account_owner_id: `user_${userId}`,
    api_key: "sk-proj-user-provided-key",
  }),
});
```

#### No-Auth Services (HackerNews, ArXiv)

```typescript
// Just create the linked account (no credentials needed)
await fetch(`${ACI_BASE_URL}/v1/linked-accounts/no-auth`, {
  method: "POST",
  headers: { "X-API-KEY": ACI_API_KEY },
  body: JSON.stringify({
    app_name: "hackernews",
    linked_account_owner_id: `user_${userId}`,
  }),
});
```

### Phase 2: Execute Functions (Anytime later)

```typescript
// User says: "Send email to my boss"
const result = await fetch(
  `${ACI_BASE_URL}/v1/functions/gmail__send_email/execute`,
  {
    method: "POST",
    headers: { "X-API-KEY": ACI_API_KEY },
    body: JSON.stringify({
      function_input: {
        to: "boss@company.com",
        subject: "Project Update",
        body: "Here is the latest update...",
      },
      linked_account_owner_id: `user_${userId}`, // Uses stored OAuth tokens
    }),
  },
);
```

---

## Integration Patterns

### Pattern 1: Authentication Agent

Create a small agent to manage authentications before executing functions:

```typescript
class ACIAuthenticationAgent {
  constructor(
    private aciBaseUrl: string,
    private aciApiKey: string,
  ) {}

  async checkUserLinkedAccounts(userId: string) {
    const response = await fetch(`${this.aciBaseUrl}/v1/linked-accounts`, {
      headers: { "X-API-KEY": this.aciApiKey },
      params: { linked_account_owner_id: `user_${userId}` },
    });

    const accounts = await response.json();
    return accounts.reduce((acc, account) => {
      acc[account.app_name] = account;
      return acc;
    }, {});
  }

  async isServiceAuthenticated(
    userId: string,
    serviceName: string,
  ): Promise<boolean> {
    const linkedAccounts = await this.checkUserLinkedAccounts(userId);
    return serviceName in linkedAccounts && linkedAccounts[serviceName].enabled;
  }

  async generateMissingAuthUrls(userId: string, requiredServices: string[]) {
    const linkedAccounts = await this.checkUserLinkedAccounts(userId);
    const missingServices = requiredServices.filter(
      (service) => !(service in linkedAccounts),
    );

    const authUrls = {};
    for (const service of missingServices) {
      const response = await fetch(
        `${this.aciBaseUrl}/v1/linked-accounts/oauth2`,
        {
          headers: { "X-API-KEY": this.aciApiKey },
          params: {
            app_name: service,
            linked_account_owner_id: `user_${userId}`,
            after_oauth2_link_redirect_url: "https://yourapp.com/auth-complete",
          },
        },
      );
      const data = await response.json();
      authUrls[service] = data.url;
    }

    return authUrls;
  }
}
```

### Pattern 2: Smart MCP Integration

Wrap MCP functions with automatic authentication checking:

```typescript
class SmartMCPClient {
  constructor(
    private authAgent: ACIAuthenticationAgent,
    private mcpClient: any, // Your MCP client
  ) {}

  async smartExecuteFunction(
    userId: string,
    functionName: string,
    functionArguments: any,
  ) {
    // 1. Check if user can execute this function
    const requiredServices = this.getRequiredServices(functionName);
    const missingAuths = [];

    for (const service of requiredServices) {
      if (!(await this.authAgent.isServiceAuthenticated(userId, service))) {
        missingAuths.push(service);
      }
    }

    // 2. If missing auths, return OAuth URLs
    if (missingAuths.length > 0) {
      const oauthUrls = await this.authAgent.generateMissingAuthUrls(
        userId,
        missingAuths,
      );
      return {
        status: "authentication_required",
        message: "Please authenticate with required services first",
        oauth_urls: oauthUrls,
        function_name: functionName,
        function_arguments: functionArguments,
      };
    }

    // 3. Execute via MCP with linked account owner ID
    process.env.LINKED_ACCOUNT_OWNER_ID = `user_${userId}`;
    return this.mcpClient.call_tool("ACI_EXECUTE_FUNCTION", {
      function_name: functionName,
      function_arguments: functionArguments,
    });
  }

  private getRequiredServices(functionName: string): string[] {
    const serviceMapping = {
      gmail__send_email: ["gmail"],
      github__create_issue: ["github"],
      calendar__create_event: ["google_calendar"],
      slack__send_message: ["slack"],
    };
    return serviceMapping[functionName] || [];
  }
}
```

### Pattern 3: Form-Driven Authentication

Perfect for form submissions that need multiple services:

```typescript
class FormHandler {
  constructor(
    private authAgent: ACIAuthenticationAgent,
    private mcpClient: SmartMCPClient,
  ) {}

  async handleFormSubmission(formData: any, userId: string) {
    // 1. Analyze form to determine required services
    const requiredServices = this.analyzeFormNeeds(formData);

    // 2. Check authentication status
    const authStatus = await Promise.all(
      requiredServices.map((service) =>
        this.authAgent.isServiceAuthenticated(userId, service),
      ),
    );

    const missingServices = requiredServices.filter(
      (_, index) => !authStatus[index],
    );

    // 3. If missing authentications, return OAuth URLs
    if (missingServices.length > 0) {
      const oauthUrls = await this.authAgent.generateMissingAuthUrls(
        userId,
        missingServices,
      );
      return {
        status: "authentication_required",
        message: `Please authorize access to: ${missingServices.join(", ")}`,
        oauth_urls: oauthUrls,
      };
    }

    // 4. Execute form actions
    const results = [];
    for (const action of formData.actions) {
      const result = await this.mcpClient.smartExecuteFunction(
        userId,
        action.function_name,
        action.arguments,
      );
      results.push(result);
    }

    return {
      status: "success",
      results: results,
    };
  }

  private analyzeFormNeeds(formData: any): string[] {
    const services = new Set<string>();

    if (formData.send_email) services.add("gmail");
    if (formData.create_calendar_event) services.add("google_calendar");
    if (formData.post_to_slack) services.add("slack");
    if (formData.create_github_issue) services.add("github");

    return Array.from(services);
  }
}
```

---

## Self-Hosting Setup

### 1. Initial Setup

```bash
# Clone the repository
git clone https://github.com/aipotheosis-labs/aci.git
cd aci

# Setup backend
cd backend
cp .env.example .env.local

# Configure your environment
# Edit .env.local with:
# - Your database credentials
# - Your OpenAI API key (required)
# - Your OAuth client IDs/secrets for apps you want to use
# - Your domain URLs

# Start services
docker compose up --build

# Seed database
docker compose exec runner ./scripts/seed_db.sh
```

### 2. Configure Your OAuth Apps

Edit app configurations in `backend/apps/*/app.json`:

```json
// backend/apps/gmail/app.json
{
  "name": "GMAIL",
  "security_schemes": {
    "oauth2": {
      "client_id": "YOUR_GOOGLE_CLIENT_ID",
      "client_secret": "YOUR_GOOGLE_CLIENT_SECRET",
      "scope": "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
      "redirect_url": "https://your-aci-domain.com/v1/linked-accounts/oauth2/callback"
    }
  }
}
```

### 3. Environment Configuration

```bash
# .env.local
SERVER_OPENAI_API_KEY=your-openai-key
SERVER_REDIRECT_URI_BASE=https://your-aci-domain.com
SERVER_DEV_PORTAL_URL=https://your-frontend-domain.com

# Database
SERVER_DB_HOST=your-db-host
SERVER_DB_USER=your-db-user
SERVER_DB_PASSWORD=your-db-password

# Your OAuth apps
AIPOLABS_GMAIL_CLIENT_ID=your-gmail-client-id
AIPOLABS_GMAIL_CLIENT_SECRET=your-gmail-client-secret
AIPOLABS_GITHUB_CLIENT_ID=your-github-client-id
AIPOLABS_GITHUB_CLIENT_SECRET=your-github-client-secret
```

### 4. Production Deployment

```bash
# Use production-ready database
# Set up proper SSL certificates
# Configure load balancing if needed
# Set up monitoring and logging

# Example docker-compose.prod.yml
version: '3.8'
services:
  server:
    image: your-registry/aci-server:latest
    environment:
      - SERVER_ENVIRONMENT=production
      - DATABASE_URL=your-production-db-url
    ports:
      - "8000:8000"
```

---

## TypeScript SDK

The [ACI TypeScript SDK](https://github.com/aipotheosis-labs/aci-typescript-sdk) provides a simplified interface for Node.js applications.

### Installation

```bash
npm install @aipotheosislabs/aci
```

### Basic Usage

```typescript
import { ACI } from "@aipotheosislabs/aci";

const client = new ACI({
  apiKey: process.env.ACI_API_KEY,
  baseURL: "https://your-aci-domain.com", // For self-hosted
});

// Search for functions
const searchResults = await client.functions.search({
  intent: "I want to send an email",
  limit: 10,
});

// Execute function
const result = await client.functions.execute(
  "gmail__send_email",
  {
    to: "user@example.com",
    subject: "Hello",
    body: "This is a test email",
  },
  "user_123",
);

// Handle function calls (for LLM integration)
const response = await client.handleFunctionCall({
  functionName: "ACI_SEARCH_FUNCTIONS",
  functionArguments: {
    intent: "create a GitHub issue",
  },
});
```

### Advanced Features

```typescript
// Manage linked accounts
const linkedAccounts = await client.linkedAccounts.list({
  linked_account_owner_id: "user_123",
});

// Check authentication status
const authStatus = await client.linkedAccounts.check("user_123", "gmail");

// Generate OAuth URLs
const oauthUrl = await client.linkedAccounts.generateOAuthUrl(
  "user_123",
  "gmail",
);

// App management
const apps = await client.apps.list();
const app = await client.apps.get("gmail");
```

### SDK vs Direct API

| Feature            | SDK                               | Direct API              |
| ------------------ | --------------------------------- | ----------------------- |
| **Ease of Use**    | High - abstracted methods         | Low - manual HTTP calls |
| **Type Safety**    | Full TypeScript support           | Manual typing needed    |
| **Error Handling** | Built-in retry and error handling | Manual implementation   |
| **Function Calls** | `handleFunctionCall()` helper     | Manual parsing          |
| **Authentication** | Automatic header management       | Manual header setting   |
| **Flexibility**    | SDK limitations                   | Full control            |

**Recommendation**: Use SDK for rapid development, direct API for custom needs.

---

## Fork Maintenance Strategy

### 1. Fork Setup

```bash
# Create your fork
git clone https://github.com/yourusername/aci.git
cd aci

# Add upstream remote
git remote add upstream https://github.com/aipotheosis-labs/aci.git

# Create your customization branch
git checkout -b custom/main
```

### 2. Customization Approach

Keep customizations minimal and isolated:

```bash
# Custom app configurations
backend/apps/custom-app/app.json

# Custom environment configs
backend/.env.custom

# Custom deployment scripts
deploy/
├── docker-compose.custom.yml
├── kubernetes/
└── scripts/
```

### 3. Sync Strategy

```bash
#!/bin/bash
# sync-upstream.sh

# Fetch latest from upstream
git fetch upstream

# Check for updates
git log --oneline main..upstream/main

# Create sync branch
git checkout -b sync/$(date +%Y-%m-%d)
git merge upstream/main

# Handle conflicts if any
# Test the merged changes
npm test
docker compose up --build

# If tests pass, merge to main
git checkout main
git merge sync/$(date +%Y-%m-%d)

# Deploy to staging for testing
./deploy/staging.sh

# If staging tests pass, deploy to production
./deploy/production.sh
```

### 4. Automated Sync Workflow

Create GitHub Action (`.github/workflows/sync-upstream.yml`):

```yaml
name: Sync Upstream
on:
  schedule:
    - cron: "0 0 * * 1" # Weekly on Monday
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Add upstream remote
        run: |
          git remote add upstream https://github.com/aipotheosis-labs/aci.git
          git fetch upstream

      - name: Check for updates
        id: check
        run: |
          BEHIND_COUNT=$(git rev-list --count main..upstream/main)
          echo "behind=$BEHIND_COUNT" >> $GITHUB_OUTPUT

      - name: Create sync PR
        if: steps.check.outputs.behind != '0'
        run: |
          git checkout -b sync/auto-$(date +%Y-%m-%d)
          git merge upstream/main
          git push origin sync/auto-$(date +%Y-%m-%d)

          gh pr create \
            --title "Sync upstream changes" \
            --body "Automated sync of upstream changes" \
            --base main \
            --head sync/auto-$(date +%Y-%m-%d)
```

### 5. Version Management

```bash
# Tag your production deployments
git tag -a v1.0.0-custom -m "Custom deployment v1.0.0"
git push origin v1.0.0-custom

# Track upstream versions
git tag -a upstream/v1.2.0 upstream/main -m "Upstream v1.2.0"

# Deploy specific versions
docker build -t your-registry/aci:v1.0.0-custom .
```

### 6. Conflict Resolution Strategy

Common conflict areas and resolutions:

```bash
# Database migrations
# Strategy: Always take upstream, add custom migrations separately

# Environment configs
# Strategy: Keep custom configs in separate files

# App configurations
# Strategy: Add custom apps, modify existing ones carefully

# API routes
# Strategy: Avoid modifying core routes, add custom endpoints
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

- [ ] Fork ACI.dev repository
- [ ] Set up self-hosted development environment
- [ ] Configure basic apps (Gmail, GitHub, Slack)
- [ ] Create authentication agent prototype
- [ ] Test basic OAuth flow

### Phase 2: Core Integration (Week 3-4)

- [ ] Implement TypeScript SDK integration
- [ ] Build smart MCP wrapper
- [ ] Create form-driven authentication system
- [ ] Add scope expansion handling
- [ ] Test with multiple users and services

### Phase 3: Production Ready (Week 5-6)

- [ ] Set up production environment
- [ ] Implement monitoring and logging
- [ ] Create backup and disaster recovery
- [ ] Set up automated upstream sync
- [ ] Performance testing and optimization

### Phase 4: Advanced Features (Week 7-8)

- [ ] Custom app development
- [ ] Advanced permission system
- [ ] API usage analytics
- [ ] Custom function development
- [ ] Integration with existing systems

---

## Conclusion

ACI.dev provides a powerful foundation for building AI agents with external service integrations. The separation of authentication and execution phases makes it perfect for form-driven applications where users authenticate once and execute many times.

Key benefits:

- **600+ integrations** out of the box
- **Self-hosted control** over infrastructure and data
- **Multi-tenant architecture** scales to many users
- **TypeScript SDK** for rapid development
- **Open source** with active community

The authentication agent pattern we've designed provides a clean abstraction that checks auth status before executing functions, providing a seamless user experience while maintaining security and control.

---

_Last Updated: $(date)_
_Version: 1.0.0_
