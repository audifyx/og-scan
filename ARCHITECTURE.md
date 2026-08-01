# Agent System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                           │
│  /agent Dashboard → Agent List → Agent Detail → MCP Control     │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ├─────────────────────────────────────────────┐
                      │                                             │
┌─────────────────────▼──────────────────────────────────────────┐ │
│                  API Layer (Next.js Routes)                    │ │
│                                                                │ │
│  /api/agents                 - List, Create agents            │ │
│  /api/agents/[id]            - Get, Update, Delete agent      │ │
│  /api/agents/[id]/api-keys   - Manage API keys                │ │
│  /api/agents/[id]/settings   - Configure agent                │ │
│  /api/agents/[id]/execute    - Run MCP commands               │ │
│  /api/agents/[id]/activity   - Get history                    │ │
│  /api/verify-access          - Check token access             │ │
└─────────────────────┬──────────────────────────────────────────┘ │
                      │                                             │
┌─────────────────────▼──────────────────────────────────────────┐ │
│              Service Layer (api/lib/*.ts)                      │ │
│                                                                │ │
│  ┌──────────────────┐  ┌──────────────────┐                  │ │
│  │ Auth Service     │  │ Token Gating     │                  │ │
│  │ - API key hash   │  │ - $10 verify     │                  │ │
│  │ - Verify keys    │  │ - Cache 24h      │                  │ │
│  │ - Rate limit     │  │ - Holdings calc  │                  │ │
│  └──────────────────┘  └──────────────────┘                  │ │
│                                                                │ │
│  ┌──────────────────┐  ┌──────────────────┐                  │ │
│  │ Agent Service    │  │ Activity Service │                  │ │
│  │ - CRUD ops       │  │ - Log trades     │                  │ │
│  │ - Settings       │  │ - Log mints      │                  │ │
│  │ - API keys       │  │ - Log posts      │                  │ │
│  └──────────────────┘  └──────────────────┘                  │ │
│                                                                │ │
│  ┌──────────────────┐  ┌──────────────────┐                  │ │
│  │ MCP Executor     │  │ Database Client  │                  │ │
│  │ - Trade          │  │ - Connection pool│                  │ │
│  │ - Mint NFT       │  │ - Query builder  │                  │ │
│  │ - Launch token   │  │ - Transactions   │                  │ │
│  │ - Post social    │  │ - RLS support    │                  │ │
│  └──────────────────┘  └──────────────────┘                  │ │
└─────────────────────┬──────────────────────────────────────────┘ │
                      │                                             │
┌─────────────────────▼──────────────────────────────────────────┐ │
│            PostgreSQL Database                                 │ │
│                                                                │ │
│  Core Tables:                                                  │ │
│  ├── agents                                                    │ │
│  ├── agent_api_keys                                            │ │
│  ├── agent_settings                                            │ │
│  │                                                             │ │
│  Token Gating Tables:                                          │ │
│  ├── user_access_verification                                 │ │
│  ├── user_token_holdings                                       │ │
│  ├── user_buy_history                                          │ │
│  ├── token_requirements                                        │ │
│  │                                                             │ │
│  Activity Tables:                                              │ │
│  ├── agent_activities                                          │ │
│  ├── agent_trades                                              │ │
│  ├── agent_nft_mints                                           │ │
│  ├── agent_token_launches                                      │ │
│  ├── agent_social_posts                                        │ │
│  └── agent_api_calls                                           │ │
│                                                                │ │
│  Security: RLS enabled on all tables                           │ │
└────────────────────────────────────────────────────────────────┘ │
                                                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Agent Creation Flow
```
User → Dashboard → Create Form → API POST /api/agents
    → Auth Middleware (verify API key)
    → Token Gating (verify $10)
    → Agent Service (insert into DB)
    → RLS Policy (only user sees own agent)
    → Return agent with ID
```

### API Key Generation Flow
```
User → Agent Detail → API Keys Tab → Create Button
    → API POST /api/agents/[id]/api-keys
    → Verify agent belongs to user
    → Generate random key
    → Hash with SHA-256
    → Store hash in DB
    → Return key once (never again)
    → Store locally or pass to user
```

### MCP Command Execution Flow
```
Agent Command → API POST /api/agents/[id]/execute
    → Auth Middleware (verify API key)
    → Get agent (verify user owns agent)
    → Verify Phantom connected
    → Route to MCP Executor:
        ├─ Trade → Jupiter mock
        ├─ Mint NFT → Metaplex mock
        ├─ Launch token → Raydium mock
        ├─ Post Social → Platform API mock
        └─ Query Token → DEX mock
    → Log activity to DB
    → Update trade/mint/post status
    → Return execution result
```

### Token Verification Flow
```
User Login → /agent Dashboard
    → Check cached verification (24h TTL)
    → If expired or missing:
        → Get user token holdings
        → Calculate cumulative buys
        → Check: holdings ≥ $10 OR buys ≥ $10
        → Cache result for 24h
    → If not met → Show token gating screen
    → If met → Show agent dashboard
```

## Authentication & Authorization

### API Key Authentication
```
Request Header: Authorization: Bearer <api-key>
    ↓
Hash key with SHA-256
    ↓
Query: SELECT agent_id FROM agent_api_keys WHERE key_hash = ?
    ↓
If found → Get user_id from agent
    ↓
If not found or revoked → 401 Unauthorized
```

### Row Level Security (RLS)
```
Database Level:
    ├─ Agents: SELECT only where user_id = auth.uid()
    ├─ API Keys: SELECT through agent ownership
    ├─ Activities: SELECT through agent ownership
    └─ Token Gating: SELECT based on user_id

Application Level:
    ├─ All queries scoped to auth.uid()
    ├─ Cannot query other users' data
    └─ Enforced at both DB and API
```

## File Structure

```
/vercel/share/v0-project/
├── sql/Aug_SQL/                          # Database migrations
│   ├── 01_agents_schema.sql              # Core tables
│   ├── 02_token_gating.sql               # Token verification
│   ├── 03_activity_logging.sql           # Activity tracking
│   └── 04_views_and_functions.sql        # Helper functions
│
├── api/lib/                              # Service layer
│   ├── db.ts                             # Database client
│   ├── auth.ts                           # API key auth
│   ├── token-gating.ts                   # Token verification
│   ├── agents.ts                         # Agent CRUD
│   ├── activity.ts                       # Activity logging
│   └── mcp-executor.ts                   # Command execution
│
├── app/api/agents/                       # API routes
│   ├── route.ts                          # List, create
│   ├── [id]/route.ts                     # Get, update, delete
│   ├── [id]/api-keys/
│   │   ├── route.ts                      # List, create keys
│   │   └── [keyId]/route.ts              # Revoke key
│   ├── [id]/settings/route.ts            # Settings
│   ├── [id]/execute/route.ts             # Execute commands
│   ├── [id]/activity/route.ts            # Activity history
│   └── [id]/trades/route.ts              # Trade history
│
├── app/api/verify-access/route.ts        # Token verification
│
├── app/agent/                            # Frontend pages
│   ├── page.tsx                          # Dashboard
│   └── [id]/page.tsx                     # Agent detail
│
├── components/agent/                     # UI components
│   ├── agent-dashboard.tsx               # Main dashboard
│   ├── agents-list.tsx                   # List agents
│   ├── create-agent-modal.tsx            # Create form
│   ├── agent-detail.tsx                  # Agent overview
│   ├── agent-settings.tsx                # Settings panel
│   ├── agent-api-keys.tsx                # API key manager
│   ├── mcp-control-panel.tsx             # Command executor
│   ├── agent-activity.tsx                # Activity history
│   └── token-gating-verifier.tsx         # Token gate UI
│
├── AGENT_SYSTEM.md                       # Complete docs
├── SETUP.md                              # Setup guide
├── PACKAGE_UPDATES.md                    # Dependencies
├── ARCHITECTURE.md                       # This file
└── DEPLOYMENT_CHECKLIST.md               # Go-live checklist
```

## Component Dependencies

```
agent/page.tsx
├── AgentDashboard
│   ├── AgentsList
│   │   └── Fetches from /api/agents
│   ├── CreateAgentModal
│   │   └── POSTs to /api/agents
│   └── TokenGatingVerifier
│       └── Calls /api/verify-access

agent/[id]/page.tsx
├── AgentDetail
│   └── GETs from /api/agents/[id]
├── AgentSettings
│   ├── GETs from /api/agents/[id]/settings
│   └── PUTs to /api/agents/[id]/settings
├── AgentApiKeys
│   ├── GETs from /api/agents/[id]/api-keys
│   └── POSTs to /api/agents/[id]/api-keys
├── McpControlPanel
│   └── POSTs to /api/agents/[id]/execute
└── AgentActivity
    ├── GETs from /api/agents/[id]/activity
    └── GETs from /api/agents/[id]/trades
```

## Database Query Patterns

### User Isolation (RLS)
```sql
-- User can only see their agents
SELECT * FROM agents WHERE user_id = auth.uid();

-- User can only see API keys of their agents
SELECT ak.* FROM agent_api_keys ak
JOIN agents a ON ak.agent_id = a.id
WHERE a.user_id = auth.uid();

-- All activity tables follow same pattern
```

### Token Verification
```sql
-- Check holdings
SELECT SUM(value_usd) FROM user_token_holdings
WHERE user_id = $1 AND verified_from_chain = TRUE;

-- Check cumulative buys
SELECT SUM(total_value_usd) FROM user_buy_history
WHERE user_id = $1 AND verified_from_chain = TRUE;

-- Combined check (24h cached)
SELECT meets_token_requirement FROM user_access_verification
WHERE user_id = $1 AND expires_at > NOW();
```

### Activity Aggregation
```sql
-- Agent summary stats
SELECT 
  COUNT(DISTINCT at.id) as total_trades,
  SUM(CASE WHEN at.direction = 'buy' THEN at.total_value_usd ELSE 0 END) as buy_volume,
  COUNT(DISTINCT anm.id) as nft_mints,
  COUNT(DISTINCT atl.id) as token_launches
FROM agents a
LEFT JOIN agent_trades at ON a.id = at.agent_id
LEFT JOIN agent_nft_mints anm ON a.id = anm.agent_id
LEFT JOIN agent_token_launches atl ON a.id = atl.agent_id
WHERE a.id = $1;
```

## Performance Considerations

### Connection Pooling
- Pool size: 20 connections
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

### Query Optimization
- Indexes on: user_id, agent_id, status, created_at
- RLS policies optimized for fast filtering
- Token verification cached 24 hours

### Rate Limiting (Framework Ready)
- Per-API-key rate limiting
- Per-agent command throttling
- Daily volume caps enforced

## Security Layers

```
Layer 1: API Key Verification
    └─ SHA-256 hash validation
        └─ Prevents plaintext key exposure

Layer 2: User Ownership
    └─ RLS policy checks
        └─ Agent.user_id = auth.uid()

Layer 3: Token Gating
    └─ $10 ORBITX requirement
        └─ Holdings OR cumulative buys

Layer 4: Capability Limits
    └─ Per-agent settings
        └─ Max trade size, daily volume

Layer 5: Audit Trail
    └─ All API calls logged
        └─ Historical tracking for compliance
```

## Scalability Path

Current → Production → Enterprise

**Current (Single Server)**
- All services in-process
- Local PostgreSQL
- Single pool

**Production (Horizontal)**
- API layer: Multiple instances
- Database: Managed PostgreSQL
- Cache: Redis for tokens/verification

**Enterprise (Multi-Region)**
- API: CDN + multi-region
- Database: Sharded by user_id
- Cache: Distributed Redis
- Search: Elasticsearch for activity
