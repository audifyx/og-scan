import { Rtweeterv2Client, TwitterApi } from 'twitter-api-v2';
import { db } from './db';

export interface XAuthCredentials {
  accessToken: string;
  refreshToken: string;
  userId: string;
  username: string;
}

export interface XConnection {
  id: string;
  userId: string;
  username: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get X OAuth URL for user authorization
 */
export function getXOAuthUrl(state: string, codeChallenge: string): string {
  const client = new TwitterApi({
    clientId: process.env.X_CLIENT_ID!,
    clientSecret: process.env.X_CLIENT_SECRET!,
  });

  return client.generateOAuth2AuthLink(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/x/callback`,
    {
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      scope: [
        'tweet.read',
        'tweet.write',
        'users.read',
        'offline.access',
      ],
    }
  )[0];
}

/**
 * Exchange X OAuth code for tokens
 */
export async function exchangeXCode(
  code: string,
  codeVerifier: string
): Promise<XAuthCredentials> {
  const client = new TwitterApi({
    clientId: process.env.X_CLIENT_ID!,
    clientSecret: process.env.X_CLIENT_SECRET!,
  });

  const {
    client: loggedClient,
    accessToken,
    refreshToken,
    expiresIn,
  } = await client.loginWithOAuth2({
    code,
    codeVerifier,
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/x/callback`,
  });

  const me = await loggedClient.v2.me();

  return {
    accessToken,
    refreshToken,
    userId: me.data.id,
    username: me.data.username,
  };
}

/**
 * Store X connection for user
 */
export async function storeXConnection(
  userId: string,
  credentials: XAuthCredentials
): Promise<XConnection> {
  const query = `
    INSERT INTO x_connections (user_id, x_user_id, x_username, x_access_token, x_refresh_token, token_expires_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (user_id) DO UPDATE SET
      x_user_id = $2,
      x_username = $3,
      x_access_token = $4,
      x_refresh_token = $5,
      token_expires_at = $6,
      updated_at = NOW()
    RETURNING *;
  `;

  const expiresAt = Math.floor(Date.now() / 1000) + (3600 * 24 * 30); // 30 days

  const result = await db.query(query, [
    userId,
    credentials.userId,
    credentials.username,
    credentials.accessToken,
    credentials.refreshToken,
    new Date(expiresAt * 1000),
  ]);

  return result.rows[0];
}

/**
 * Get X connection for user
 */
export async function getXConnection(userId: string): Promise<XConnection | null> {
  const query = `
    SELECT * FROM x_connections WHERE user_id = $1;
  `;

  const result = await db.query(query, [userId]);
  return result.rows[0] || null;
}

/**
 * Refresh X access token if expired
 */
export async function refreshXToken(userId: string): Promise<XConnection> {
  const connection = await getXConnection(userId);
  if (!connection) throw new Error('X connection not found');

  if (new Date(connection.expiresAt) > new Date()) {
    return connection; // Token still valid
  }

  const client = new TwitterApi({
    clientId: process.env.X_CLIENT_ID!,
    clientSecret: process.env.X_CLIENT_SECRET!,
  });

  const {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresIn,
  } = await client.refreshOAuth2Token(connection.refreshToken);

  // Update tokens in database
  const query = `
    UPDATE x_connections 
    SET x_access_token = $1, x_refresh_token = $2, token_expires_at = $3, updated_at = NOW()
    WHERE user_id = $4
    RETURNING *;
  `;

  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

  const result = await db.query(query, [
    newAccessToken,
    newRefreshToken,
    new Date(expiresAt * 1000),
    userId,
  ]);

  return result.rows[0];
}

/**
 * Post tweet to X
 */
export async function postTweet(
  userId: string,
  text: string,
  mediaIds?: string[]
): Promise<{ id: string; text: string }> {
  const connection = await refreshXToken(userId);

  const client = new TwitterApi(connection.xAccessToken);
  const rwClient = client.readWrite;

  const payload: any = { text };
  if (mediaIds && mediaIds.length > 0) {
    payload.media = {
      media_ids: mediaIds,
    };
  }

  const tweet = await rwClient.v2.tweet(payload);

  return {
    id: tweet.data.id,
    text: tweet.data.text,
  };
}

/**
 * Upload media to X
 */
export async function uploadMediaToX(
  userId: string,
  imageBuffer: Buffer,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' = 'image/jpeg'
): Promise<string> {
  const connection = await refreshXToken(userId);
  const client = new TwitterApi(connection.xAccessToken);
  const rwClient = client.readWrite;

  const mediaId = await rwClient.v1a.uploadMedia(imageBuffer, {
    mimeType: mediaType,
  });

  return mediaId;
}

/**
 * Delete X connection for user
 */
export async function disconnectX(userId: string): Promise<void> {
  const query = `
    DELETE FROM x_connections WHERE user_id = $1;
  `;

  await db.query(query, [userId]);
}
