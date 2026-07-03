# KOL Tracker Backend Documentation

## Overview

KOL Tracker is a Telegram bot integration system for monitoring KOL (Key Opinion Leader) wallet activity on Solana. The backend provides APIs for bot verification, transaction monitoring, and Telegram alert delivery.

## Architecture

### Components

1. **Frontend**: `/src/pages/KolTracker.tsx` - React component for UI and user interaction
2. **API Endpoints**: `/api/` - Serverless backend functions
3. **Storage**: localStorage - Client-side configuration storage

### API Endpoints

#### 1. Bot Verification (`/api/kol-tracker-verify`)

**Purpose**: Validate Telegram bot token against Telegram Bot API

**Request**:
```json
{
  "token": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
}
```

**Response** (Success):
```json
{
  "success": true,
  "botId": 123456789,
  "username": "my_kol_tracker_bot",
  "firstName": "KOL Tracker"
}
```

**Response** (Error):
```json
{
  "success": false,
  "error": "Invalid Telegram bot token"
}
```

**Validation Rules**:
- Token format: `<bot_id>:<token_string>`
- Must contain exactly one colon
- Validated against Telegram Bot API `/getMe` endpoint

---

#### 2. Transaction Monitoring (`/api/kol-tracker-monitor`)

**Purpose**: Monitor KOL wallets for buy/sell transactions on Solana

**Request** (Single wallet):
```json
{
  "wallet": "9w8Q2kL9m5P7R2L9m5P7R2L9m5P7R2L9m5P7R2"
}
```

**Request** (Track all or multiple):
```json
{
  "trackAllKols": true,
  "trackedWallets": [
    "9w8Q2kL9m5P7R2L9m5P7R2L9m5P7R2L9m5P7R2",
    "Eu8E5k3z5P7R2L9m5P7R2L9m5P7R2L9m5P7R2"
  ]
}
```

**Response**:
```json
{
  "success": true,
  "alert": {
    "kolName": "Alpha Trader",
    "wallet": "9w8Q2kL9m5P7R2L9m5P7R2L9m5P7R2L9m5P7R2",
    "txType": "buy",
    "tokenSymbol": "SOL",
    "amount": 100.5,
    "price": 145.30,
    "timestamp": "2024-07-03T12:34:56Z",
    "signature": "2aBcDefGhIjKlMnOpQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWxYzAbCdEfGhIjKlMnOp"
  }
}
```

**Features**:
- Fetches recent signatures from Solana RPC
- Parses transaction details
- Detects buy/sell patterns (placeholder implementation)
- Returns transaction metadata

**Environment Variables**:
- `SOLANA_RPC_URL` - Solana RPC endpoint (defaults to mainnet-beta)

---

#### 3. Send Alert (`/api/kol-tracker-send-alert`)

**Purpose**: Send formatted transaction alerts to Telegram

**Request**:
```json
{
  "botToken": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
  "chatId": "123456789",
  "kolName": "Alpha Trader",
  "wallet": "9w8Q2kL9m5P7R2L9m5P7R2L9m5P7R2L9m5P7R2",
  "txType": "buy",
  "tokenSymbol": "SOL",
  "amount": 100.5,
  "price": 145.30,
  "signature": "2aBcDefGhIjKlMnOpQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWxYzAbCdEfGhIjKlMnOp"
}
```

**Response** (Success):
```json
{
  "success": true,
  "messageId": 98765
}
```

**Response** (Error):
```json
{
  "success": false,
  "error": "Invalid Telegram bot token"
}
```

**Message Format**:
```
🟢 BUY

Alpha Trader
Wallet: 9w8Q2kL9...R2L9m5P7

Token: SOL
Amount: 100.50
Price: $145.300000

View on Solscan

⏰ 7/3/2024, 12:34:56 PM
```

**Features**:
- HTML formatted messages
- Emoji indicators (🟢 buy, 🔴 sell)
- Truncated wallet display
- Solscan explorer link
- Timestamp included

---

## Frontend Integration

### User Flow

1. **Bot Setup**
   - User enters Telegram bot token
   - Frontend validates via `/api/kol-tracker-verify`
   - User uploads profile image
   - User configures bot name and bio

2. **Tracking Configuration**
   - Choose "Track All KOLs" or "Select Specific"
   - Add/remove individual wallet addresses
   - Select from preset KOL buttons

3. **Save Configuration**
   - Frontend validates bot token
   - Saves config to localStorage
   - Sets bot status to "active"

4. **Alert Display**
   - Recent alerts shown in sidebar
   - Updates as transactions occur
   - Formatted with KOL name, token symbol, amount

### Data Storage

**localStorage Keys**:
- `kol_tracker_config` - Bot configuration
- `kol_tracker_alerts` - Recent transaction alerts

**Config Schema**:
```typescript
interface BotConfig {
  id: string;
  telegramBotToken: string;
  botName: string;
  botBio: string;
  botImageUrl: string | null;
  trackAllKols: boolean;
  trackedKols: TrackedKol[];
  status: 'active' | 'inactive' | 'error';
}

interface TrackedKol {
  id: string;
  wallet: string;
  name: string;
  isActive: boolean;
}
```

---

## Testing

### API Test File

Location: `/api/__tests__/kol-tracker.test.ts`

**Test Cases**:
1. Invalid token format validation
2. Missing required fields
3. Method not allowed (non-POST)
4. Valid payload acceptance
5. Single wallet monitoring
6. Track all KOLs mode

**Running Tests**:
```bash
npm test -- kol-tracker.test.ts
```

### Manual Testing

**Test Verify Endpoint**:
```bash
curl -X POST http://localhost:8080/api/kol-tracker-verify \
  -H "Content-Type: application/json" \
  -d '{"token":"invalid"}'
```

**Test Send Alert**:
```bash
curl -X POST http://localhost:8080/api/kol-tracker-send-alert \
  -H "Content-Type: application/json" \
  -d '{
    "botToken":"YOUR_BOT_TOKEN",
    "chatId":"YOUR_CHAT_ID",
    "kolName":"Test KOL",
    "wallet":"test_wallet",
    "txType":"buy",
    "tokenSymbol":"SOL",
    "amount":100,
    "price":145.5
  }'
```

---

## Setup Instructions

### 1. Create Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot`
3. Choose bot name and username
4. Copy bot token (format: `123456:ABC-DEF...`)

### 2. Configure KOL Tracker

1. Navigate to `/koltelebot` route
2. Paste bot token
3. Enter bot display name
4. Add bot bio
5. Upload profile image (optional)
6. Select KOLs to track
7. Click "Save & Activate Tracker"

### 3. Get Chat ID

To receive alerts, you need your Telegram chat ID:
1. Send a message to your bot
2. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Copy `message.from.id` value

---

## Future Enhancements

- [ ] Database integration (Supabase/Neon) for persistent storage
- [ ] Real-time transaction monitoring with WebSocket
- [ ] DEX interaction parsing (Raydium, Orca, Jupiter)
- [ ] Price impact calculation
- [ ] Portfolio tracking
- [ ] Custom alert thresholds
- [ ] Multiple Telegram channels per tracker
- [ ] Historical analytics
- [ ] Alert scheduling (quiet hours)

---

## Security Considerations

1. **Token Encryption**: Bot tokens are base64 encoded (should be properly encrypted in production)
2. **Validation**: All inputs validated against Telegram API
3. **Rate Limiting**: Recommended 1-2 requests per second to Telegram API
4. **Environment**: Store sensitive tokens in environment variables only

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid bot token" | Verify format: `<id>:<token>`. Check with @BotFather |
| Alerts not sending | Verify chat ID is correct. Check Telegram API status |
| No transactions detected | Ensure wallet has recent activity. Check RPC endpoint |
| Build fails | Run `npm install` and clear node_modules cache |

---

## Support

For issues or feature requests, refer to the main project documentation.
