# OrbitX Agent MCP System Documentation

## Overview

The OrbitX Agent MCP (Multi-Chain Protocol) System is a comprehensive framework for managing autonomous trading agents with token-gated access. It enables users to create, configure, and execute agents for trading, NFT minting, token launches, and social posting—all secured by a token-holding requirement.

## System Architecture

### 1. **Token Gating System**
- **Requirement**: Users must hold $10 worth of ORBITX token (`13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9`)
- **Verification Methods**:
  - Current wallet holdings: Must hold ≥ $10 in ORBITX tokens
  - Cumulative buy history: Total buy transactions must equal ≥ $10
  - Either condition grants access (OR logic)

### 2. **Agent Management**
- Create unlimited agents per user
- Each agent has:
  - Unique ID, name, description
  - Connected wallet (via Phantom)
  - Multiple API keys for programmatic access
  - Individual settings and capabilities
  - Complete activity history

### 3. **MCP Commands**
Agents can execute the following commands:

#### Trade
```json
{
  "type": "trade",
  "direction": "buy" | "sell",
  "tokenMint": "string (contract address)",
  "amount": number,
  "slippageTolerancePercent": number (optional, default 0.5)
}
```

#### Mint NFT
```json
{
  "type": "mint_nft",
  "name": "string",
  "symbol": "string",
  "metadataUri": "string (URI to metadata)",
  "royaltyBasisPoints": number (optional)
}
```

#### Launch Token
```json
{
  "type": "launch_token",
  "name": "string",
  "symbol": "string",
  "initialSupply": number,
  "decimals": number (optional, default 6)
}
```

#### Post on Social Media
```json
{
  "type": "post_social",
  "platform": "twitter" | "discord" | "telegram" | "blog",
  "content": "string",
  "mediaUrls": ["string"] (optional)
}
```

#### Query Token Data
```json
{
  "type": "query_token_data",
  "tokenMint": "string",
  "includeMetadata": boolean (optional),
  "includePriceHistory": boolean (optional)
}
```

## Database Schema

All database migrations are located in `/sql/Aug_SQL/`:

### Files:
- **01_agents_schema.sql** - Core agent, API key, and settings tables
- **02_token_gating.sql** - Token requirements, holdings, and access verification
- **03_activity_logging.sql** - Activity, trades, NFTs, tokens, and social posts tracking
- **04_views_and_functions.sql** - Helper views, functions, and triggers

### Key Tables:
```
agents
├── agent_api_keys
├── agent_settings
└── agent_activities
    ├── agent_trades
    ├── agent_nft_mints
    ├── agent_token_launches
    ├── agent_social_posts
    └── agent_api_calls

user_access_verification
├── user_token_holdings
└── user_buy_history
```

## API Endpoints

### Agent Management

**List Agents**
```
GET /api/agents
Authorization: Bearer <api-key>
```

**Create Agent**
```
POST /api/agents
Authorization: Bearer <api-key>
Body: { "name": "string", "description": "string (optional)" }
```

**Get Agent**
```
GET /api/agents/[id]
Authorization: Bearer <api-key>
```

**Update Agent**
```
PUT /api/agents/[id]
Authorization: Bearer <api-key>
Body: { fields to update }
```

**Delete Agent**
```
DELETE /api/agents/[id]
Authorization: Bearer <api-key>
```

### API Key Management

**List API Keys**
```
GET /api/agents/[id]/api-keys
Authorization: Bearer <api-key>
```

**Create API Key**
```
POST /api/agents/[id]/api-keys
Authorization: Bearer <api-key>
Body: { "name": "string" }
Response: { "id": "uuid", "key": "string", "name": "string" }
NOTE: Key is only returned on creation
```

**Revoke API Key**
```
DELETE /api/agents/[id]/api-keys/[keyId]
Authorization: Bearer <api-key>
```

### Settings

**Get Settings**
```
GET /api/agents/[id]/settings
Authorization: Bearer <api-key>
```

**Update Settings**
```
PUT /api/agents/[id]/settings
Authorization: Bearer <api-key>
Body: { settings object }
```

### MCP Execution

**Execute Command**
```
POST /api/agents/[id]/execute
Authorization: Bearer <api-key>
Body: { MCP command object }
Response: {
  "success": boolean,
  "activityId": "uuid",
  "tradeId": "uuid (if trade)",
  "txHash": "string (if applicable)",
  "tokenMint": "string (if launch)",
  "postUrl": "string (if social)",
  "data": object,
  "executionTimeMs": number,
  "error": "string (if failed)"
}
```

### Activity & History

**Get Activity History**
```
GET /api/agents/[id]/activity?limit=50&offset=0&type=trade
Authorization: Bearer <api-key>
```

**Get Trades History**
```
GET /api/agents/[id]/trades?limit=50&offset=0
Authorization: Bearer <api-key>
```

### Token Access Verification

**Verify User Access**
```
GET /api/verify-access
Authorization: Bearer <api-key>
Response: {
  "hasAccess": boolean,
  "currentHoldingUsd": number,
  "cumulativeBuyValueUsd": number,
  "requiredTokenCa": "string",
  "requiredTokenSymbol": "string",
  "requiredValueUsd": number,
  "verifiedAt": "ISO 8601 date",
  "expiresAt": "ISO 8601 date"
}
```

## Frontend Pages

### `/agent`
Main agent dashboard showing:
- List of all user's agents
- Create agent button
- Token verification status
- Quick stats per agent

### `/agent/[id]`
Detailed agent page with tabs:
- **Overview**: Agent details, wallet connection, status
- **Settings**: Enable/disable capabilities, set trade limits
- **API Keys**: Create, view, revoke API keys
- **MCP Control**: Execute trades and view command builder
- **Activity**: Complete history of agent actions

## Authentication Flow

1. User connects wallet via Phantom
2. System verifies token holdings ($10 ORBITX)
3. System checks cumulative buy history
4. Access granted if either condition met
5. Generate initial API key for user account
6. User can create agents and generate per-agent API keys

## Token Verification Logic

```
User Access = 
  (Current ORBITX Holdings ≥ $10) 
  OR 
  (Cumulative Buy Value ≥ $10)
```

### Caching:
- Access verification cached for 24 hours
- Cache invalidated on:
  - New token holdings detected
  - New buy transaction recorded
  - Manual verification refresh

## Security Features

- **API Key Hashing**: SHA-256 hash stored, never plaintext
- **Rate Limiting**: Per-agent API call throttling
- **RLS (Row Level Security)**: PostgreSQL RLS policies on all tables
- **User Isolation**: Each user sees only their own agents
- **Audit Trail**: All API calls logged with timestamp and response code
- **Transaction Verification**: Blockchain transaction verification for on-chain operations

## Implementation Notes

### Services
- **Database Client** (`api/lib/db.ts`): Connection pooling with pg
- **Token Gating** (`api/lib/token-gating.ts`): Verification & caching
- **Agents** (`api/lib/agents.ts`): CRUD operations
- **Activity Logging** (`api/lib/activity.ts`): Trade, NFT, token, social tracking
- **MCP Executor** (`api/lib/mcp-executor.ts`): Command routing & execution
- **Auth** (`api/lib/auth.ts`): API key verification & middleware

### Frontend Components
- `agent/agent-dashboard`: Main dashboard layout
- `agent/agents-list`: List of agents with quick actions
- `agent/create-agent-modal`: Create new agent form
- `agent/agent-detail`: View agent overview
- `agent/agent-settings`: Configure agent capabilities
- `agent/agent-api-keys`: Manage API keys
- `agent/mcp-control-panel`: Execute trades and commands
- `agent/agent-activity`: View activity history
- `agent/token-gating-verifier`: Token gating UI

## Environment Variables Required

```
DATABASE_URL=postgres://user:password@host/database
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=your_url
```

## Deployment Checklist

- [ ] Run SQL migrations in `/sql/Aug_SQL/` in order
- [ ] Set up PostgreSQL database with proper RLS
- [ ] Configure environment variables
- [ ] Install dependencies: `npm install pg uuid`
- [ ] Deploy Next.js app
- [ ] Test token verification flow
- [ ] Create test agent and API key
- [ ] Verify MCP command execution

## Usage Example

### Create Agent & Get API Key
```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Trading Bot Alpha",
    "description": "High-frequency trading bot"
  }'
```

### Execute Trade
```bash
curl -X POST http://localhost:3000/api/agents/AGENT_ID/execute \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "trade",
    "direction": "buy",
    "tokenMint": "EPjFWaLb3m7LsqtiGA5jJV2NuNRQoNeJeLCbtqKQBWt",
    "amount": 100
  }'
```

## Troubleshooting

### User Can't Access Agents Page
- Verify token holdings at `/api/verify-access`
- Check cumulative buy history in database
- Ensure 24-hour cache hasn't expired (clear if needed)

### API Key Not Working
- Verify key hasn't been revoked
- Check Authorization header format: `Bearer <key>`
- Ensure agent belongs to authenticated user

### MCP Commands Failing
- Verify Phantom wallet is connected to agent
- Check agent capabilities are enabled in settings
- Review trade limits and daily volume caps
- Check DEX liquidity for token

## Future Enhancements

- [ ] Real Jupiter swap integration
- [ ] Actual Twitter/Discord posting
- [ ] Real NFT minting via Metaplex
- [ ] Real token launching on Raydium
- [ ] Machine learning for trade optimization
- [ ] Advanced risk management
- [ ] Multi-chain support
- [ ] Community governance
