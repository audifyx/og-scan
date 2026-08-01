# Agent System Setup Guide

## Prerequisites

- Node.js 16+
- PostgreSQL database
- Phantom wallet
- Supabase account (optional, for auth integration)

## Installation Steps

### 1. Install Dependencies

```bash
npm install pg uuid
# or
yarn add pg uuid
```

### 2. Database Setup

#### Option A: Local PostgreSQL
```bash
# Create database
createdb orbitx_agents

# Run migrations in order
psql -d orbitx_agents -f sql/Aug_SQL/01_agents_schema.sql
psql -d orbitx_agents -f sql/Aug_SQL/02_token_gating.sql
psql -d orbitx_agents -f sql/Aug_SQL/03_activity_logging.sql
psql -d orbitx_agents -f sql/Aug_SQL/04_views_and_functions.sql
```

#### Option B: Remote PostgreSQL (Neon, AWS RDS, etc.)
```bash
# Use psql or your database client to run the SQL files
# Ensure you have connection string: postgres://user:pass@host/db
```

### 3. Environment Variables

Create `.env.local`:
```
DATABASE_URL=postgres://user:password@localhost:5432/orbitx_agents
NEXT_PUBLIC_AGENT_API_BASE=http://localhost:3000
```

### 4. Run Dev Server

```bash
npm run dev
```

Visit `http://localhost:3000/agent` to see the dashboard.

## Verification Steps

### Test 1: Token Verification
```bash
# Generate a test API key (you'll need an initial one)
# Then verify access:
curl -X GET http://localhost:3000/api/verify-access \
  -H "Authorization: Bearer <test-key>"
```

### Test 2: Create Agent
```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Authorization: Bearer <test-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Agent",
    "description": "Testing the system"
  }'
```

### Test 3: Create API Key
```bash
curl -X POST http://localhost:3000/api/agents/<agent-id>/api-keys \
  -H "Authorization: Bearer <test-key>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Key"}'
```

### Test 4: Execute Command
```bash
curl -X POST http://localhost:3000/api/agents/<agent-id>/execute \
  -H "Authorization: Bearer <test-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "query_token_data",
    "tokenMint": "EPjFWaLb3m7LsqtiGA5jJV2NuNRQoNeJeLCbtqKQBWt"
  }'
```

## Database Connection Troubleshooting

### Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
- Ensure PostgreSQL is running: `brew services start postgresql`
- Check DATABASE_URL is correct

### Permission Denied
```
Error: role "user" does not exist
```
- Create the role: `createuser <username>`
- Grant privileges: `ALTER ROLE <username> WITH CREATEDB;`

### RLS Policy Errors
```
Error: new row violates row-level security policy
```
- Ensure auth.uid() returns correct user ID
- Check RLS policies are correctly applied
- Verify user_id is set in queries

## Production Deployment

### 1. Set Up Remote Database
```bash
# Use managed PostgreSQL (Neon, AWS RDS, etc.)
# Set DATABASE_URL in production environment
```

### 2. Run Migrations
```bash
# Before deploying, ensure migrations are run:
psql $DATABASE_URL -f sql/Aug_SQL/01_agents_schema.sql
psql $DATABASE_URL -f sql/Aug_SQL/02_token_gating.sql
psql $DATABASE_URL -f sql/Aug_SQL/03_activity_logging.sql
psql $DATABASE_URL -f sql/Aug_SQL/04_views_and_functions.sql
```

### 3. Deploy to Vercel
```bash
# Push to GitHub
git add .
git commit -m "Add agent system"
git push origin main

# Deploy (Vercel auto-deploys from GitHub)
# Set environment variables in Vercel dashboard
```

### 4. Enable HTTPS
- Ensure all API calls use HTTPS
- Update NEXT_PUBLIC_AGENT_API_BASE to HTTPS URL

### 5. Set Up Monitoring
- Monitor database connection pool
- Track API call rates
- Monitor transaction success rates
- Set up alerts for errors

## API Key Management

### First-Time Setup
1. Admin creates initial API key for seed agent
2. User logs in and receives their initial key
3. User can create agents and generate per-agent keys
4. Each agent key is scoped to that agent only

### Key Rotation
```bash
# List current keys
curl http://localhost:3000/api/agents/<id>/api-keys \
  -H "Authorization: Bearer <key>"

# Create new key
curl -X POST http://localhost:3000/api/agents/<id>/api-keys \
  -H "Authorization: Bearer <key>" \
  -d '{"name": "New Key"}'

# Revoke old key
curl -X DELETE http://localhost:3000/api/agents/<id>/api-keys/<key-id> \
  -H "Authorization: Bearer <key>"
```

## Scaling Considerations

- **Connection Pooling**: Current pool size is 20 (adjustable in `api/lib/db.ts`)
- **Query Caching**: Token verification cached 24 hours
- **Activity Retention**: Consider archiving old activity after 90 days
- **API Rate Limits**: Implement per-key rate limiting for production

## Common Issues

### Missing `pg` Module
```bash
npm install pg
```

### UUID Generation Errors
```bash
npm install uuid
```

### Transaction Failures
- Check for deadlocks: `SELECT * FROM pg_locks WHERE NOT granted;`
- Ensure transactions complete within timeout
- Add retry logic with exponential backoff

### High Memory Usage
- Check connection pool isn't growing unbounded
- Monitor idle connections
- Implement proper connection cleanup

## Next Steps

1. **Integrate Real DEX**: Replace mock Jupiter execution with real API calls
2. **Add Wallet Connection**: Implement Phantom wallet sign-in flow
3. **Enable Social Posting**: Connect to Twitter, Discord, Telegram
4. **Add Risk Management**: Implement stop-loss and take-profit logic
5. **Performance Monitoring**: Add APM and error tracking
