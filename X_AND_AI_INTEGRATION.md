# X (Twitter) & AI Integration Guide

## Overview

The agent system now includes full X (Twitter) integration with Claude AI for post generation and Fal AI for image generation. Users can:

1. Connect their X account via OAuth 2.0 with PKCE
2. Generate social media posts using Claude AI
3. Generate images using Fal AI models
4. Automatically post to X with generated content
5. Track engagement metrics and posting history

## Components

### X Integration (`/api/lib/x-integration.ts`)

Handles all X/Twitter OAuth and posting operations:

- **getXOAuthUrl()** - Generate OAuth URL for user authorization
- **exchangeXCode()** - Exchange OAuth code for access tokens
- **storeXConnection()** - Persist X credentials in database
- **getXConnection()** - Retrieve stored X connection
- **refreshXToken()** - Refresh expired tokens
- **postTweet()** - Post content to X
- **uploadMediaToX()** - Upload images to X
- **disconnectX()** - Remove X connection

### Claude AI Service (`/api/lib/claude.ts`)

AI-powered content generation:

- **generatePost()** - Create posts with customizable tone
- **generateImageDescription()** - Create prompts for image generation
- **generatePostVariations()** - Generate multiple post options
- **refinePost()** - Improve existing posts

Parameters:
- `tone`: 'professional' | 'casual' | 'humorous' | 'marketing'
- `maxLength`: Character limit (default 280)
- `includeHashtags`: Auto-add relevant hashtags
- `includeEmoji`: Strategic emoji usage

### Fal Image Generation (`/api/lib/fal-images.ts`)

Image generation with multiple models:

- **generateImage()** - Single image generation
- **generateImages()** - Batch generation
- **generateImageWithUpscaling()** - Generate and upscale
- **generateImageWithStyle()** - Apply style transfer
- **downloadImage()** - Save images locally
- **generateImageBatch()** - Multiple prompts at once

Supported models:
- `flux-pro` - High-quality images
- `flux-realism` - Photorealistic output
- `grok-vision` - Grok AI model

## API Routes

### X Authentication

**GET /api/x/auth**
Initiates X OAuth flow. Returns OAuth URL and stores PKCE codes.

Response:
```json
{
  "authUrl": "https://twitter.com/i/oauth2/authorize?..."
}
```

**GET /api/x/callback**
OAuth callback handler. Exchanges code for tokens and stores connection.

**GET /api/x/connection**
Check if user has X connection. Returns connection status and username.

Response:
```json
{
  "connected": true,
  "connection": {
    "id": "uuid",
    "username": "@username",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

**DELETE /api/x/connection**
Disconnect X account.

### Post Generation & Publishing

**POST /api/agents/[id]/x-post**
Generate post using Claude AI and publish to X.

Request:
```json
{
  "topic": "New DeFi token launch",
  "tone": "casual",
  "includeImage": true,
  "imageStyle": "modern",
  "generateVariations": false
}
```

Response:
```json
{
  "success": true,
  "post": {
    "text": "Generated post text...",
    "xId": "1234567890",
    "imageUrl": "https://...",
    "mediaCount": 1
  },
  "data": { /* full database record */ }
}
```

**GET /api/agents/[id]/x-post**
Fetch posting history for agent.

Response:
```json
{
  "posts": [
    {
      "id": "uuid",
      "x_tweet_id": "1234567890",
      "x_text": "Post content",
      "like_count": 42,
      "retweet_count": 10,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## Environment Variables

Required:

```env
# X (Twitter) OAuth
X_CLIENT_ID=your_x_client_id
X_CLIENT_SECRET=your_x_client_secret

# Claude AI
ANTHROPIC_API_KEY=your_anthropic_api_key

# Fal Image Generation
FAL_API_KEY=your_fal_api_key

# Application
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## Database Schema

### x_connections
Stores X OAuth credentials and connection info.

```sql
- id (UUID) - Primary key
- user_id (UUID) - Foreign key to users
- x_user_id (VARCHAR) - X user ID
- x_username (VARCHAR) - X username
- x_access_token (TEXT) - OAuth access token
- x_refresh_token (TEXT) - OAuth refresh token
- token_expires_at (TIMESTAMP) - Token expiration
```

### x_posts
Tracks posted content and engagement.

```sql
- id (UUID) - Primary key
- agent_id (UUID) - Foreign key to agents
- x_tweet_id (VARCHAR) - X tweet ID
- x_text (TEXT) - Posted text
- generated_by_claude (BOOLEAN) - AI-generated flag
- image_urls (TEXT[]) - Attached image URLs
- fal_model (VARCHAR) - Model used for images
- status (VARCHAR) - published | failed | deleted
- like_count (INT) - Current likes
- retweet_count (INT) - Current retweets
- reply_count (INT) - Current replies
```

### x_post_generation_logs
Audit trail of post generation.

```sql
- id (UUID) - Primary key
- topic (TEXT) - Original topic
- tone (VARCHAR) - Post tone
- generated_post (TEXT) - Created content
- image_description (TEXT) - Image prompt
- status (VARCHAR) - success | failed
```

### x_post_schedules
Store posts for later publishing.

```sql
- id (UUID) - Primary key
- scheduled_for (TIMESTAMP) - When to publish
- status (VARCHAR) - scheduled | published | failed
```

## Frontend Components

### XIntegration Component
Main component for X connection and post generation.

Features:
- X account connection/disconnection
- Post generation dialog with Claude AI
- Image generation options
- Posting history with engagement metrics
- Real-time stats display

Props:
```typescript
interface XIntegrationProps {
  agentId: string;
  xConnected: boolean;
  xUsername?: string;
}
```

Usage:
```tsx
<XIntegration
  agentId="agent-uuid"
  xConnected={true}
  xUsername="@username"
/>
```

## Workflow

### 1. User Connects X Account
1. User clicks "Connect X" button
2. Frontend calls `GET /api/x/auth`
3. Backend generates OAuth URL with PKCE
4. User redirected to X authorization
5. User grants permissions
6. Callback to `GET /api/x/callback`
7. Backend exchanges code for tokens
8. Tokens stored in database
9. User redirected back to dashboard

### 2. Generate & Publish Post
1. User opens "Generate & Post" dialog
2. Enters topic and selects options
3. Frontend calls `POST /api/agents/[id]/x-post`
4. Backend calls Claude API to generate post
5. If image selected:
   - Generate image description with Claude
   - Call Fal API to generate image
   - Download image
   - Upload to X
6. Post to X with/without media
7. Store post in database
8. Return results to frontend
9. Update posting history

## Security

- **OAuth 2.0 with PKCE** - Protects against authorization code interception
- **Token Refresh** - Automatic token refresh before expiry
- **RLS Policies** - Database policies prevent unauthorized access
- **HTTPS Only** - Tokens transmitted over secure channels
- **HttpOnly Cookies** - PKCE codes stored securely
- **User Isolation** - Users only see their own connections and posts

## Error Handling

All endpoints include comprehensive error handling:

- Invalid session → 401 Unauthorized
- Missing X connection → 400 Bad Request
- API rate limits → 429 Too Many Requests
- Server errors → 500 Internal Server Error

## Rate Limiting

X API limits:
- Posts: 300 per 15 minutes (standard tier)
- Media uploads: 15 per 15 minutes
- Token refresh: Once per request (caches for 1 hour)

## Best Practices

1. **Always refresh tokens** before making API calls
2. **Cache token validation** to avoid repeated database queries
3. **Handle failures gracefully** - posts can fail, continue with next action
4. **Log all activities** for debugging and compliance
5. **Respect rate limits** - implement exponential backoff
6. **Test with mock data** before deploying to production

## Troubleshooting

### X Connection Fails
- Verify `X_CLIENT_ID` and `X_CLIENT_SECRET` are correct
- Ensure callback URL matches registered app
- Check browser cookies are enabled

### Post Generation Fails
- Verify `ANTHROPIC_API_KEY` is valid
- Check Claude model availability
- Ensure network connectivity

### Image Generation Fails
- Verify `FAL_API_KEY` is valid
- Check image prompt is descriptive
- Ensure model supports requested style

### Posts Don't Appear
- Verify X connection is active (check token expiry)
- Check rate limits haven't been exceeded
- Verify post text meets X requirements (not spam, no banned links)
- Check error logs in database

## Future Enhancements

- [ ] Scheduled post publishing
- [ ] Post analytics dashboard
- [ ] Multi-account scheduling
- [ ] Template library
- [ ] Sentiment analysis
- [ ] Hashtag research tools
- [ ] Thread creation
- [ ] Image editing/customization
