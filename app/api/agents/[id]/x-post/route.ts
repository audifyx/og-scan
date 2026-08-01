import { NextRequest, NextResponse } from 'next/server';
import { generatePost, generateImageDescription } from '@/api/lib/claude';
import { generateImage, downloadImage } from '@/api/lib/fal-images';
import { postTweet, uploadMediaToX, getXConnection } from '@/api/lib/x-integration';
import { getUserFromSession, verifyApiKey } from '@/api/lib/auth';
import { db } from '@/api/lib/db';
import { logActivity } from '@/api/lib/activity';

interface PostGenerationRequest {
  topic: string;
  tone?: 'professional' | 'casual' | 'humorous' | 'marketing';
  includeImage?: boolean;
  imageStyle?: string;
  generateVariations?: boolean;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    const body: PostGenerationRequest = await request.json();

    // Verify authentication
    const sessionToken = request.headers.get('authorization')?.split(' ')[1];
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = await getUserFromSession(sessionToken);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Verify agent belongs to user
    const agentQuery = `
      SELECT * FROM agents WHERE id = $1 AND user_id = $2;
    `;
    const agentResult = await db.query(agentQuery, [agentId, user.id]);
    if (agentResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Check X connection
    const xConnection = await getXConnection(user.id);
    if (!xConnection) {
      return NextResponse.json(
        { error: 'X account not connected' },
        { status: 400 }
      );
    }

    // Generate post using Claude
    const post = await generatePost({
      topic: body.topic,
      tone: body.tone || 'casual',
      maxLength: 280,
      includeHashtags: true,
      includeEmoji: true,
    });

    let imageUrl: string | null = null;

    // Generate image if requested
    if (body.includeImage) {
      try {
        const imageDescription = await generateImageDescription({
          subject: body.topic,
          style: body.imageStyle || 'modern',
          mood: 'professional',
        });

        const generatedImage = await generateImage({
          prompt: imageDescription,
          width: 1024,
          height: 1024,
        });

        imageUrl = generatedImage.url;
      } catch (imageError) {
        console.error('[v0] Image generation failed:', imageError);
        // Continue without image
      }
    }

    // Upload image to X if available
    let mediaIds: string[] = [];
    if (imageUrl) {
      try {
        const imageBuffer = await downloadImage(imageUrl);
        const mediaId = await uploadMediaToX(user.id, imageBuffer);
        mediaIds = [mediaId];
      } catch (uploadError) {
        console.error('[v0] Media upload to X failed:', uploadError);
        // Continue without media
      }
    }

    // Post to X
    const xPost = await postTweet(user.id, post, mediaIds.length > 0 ? mediaIds : undefined);

    // Log activity
    await logActivity({
      agentId,
      userId: user.id,
      action: 'x_post_published',
      details: {
        xPostId: xPost.id,
        text: post,
        mediaCount: mediaIds.length,
      },
    });

    // Store post in database
    const insertQuery = `
      INSERT INTO x_posts (agent_id, user_id, x_connection_id, x_tweet_id, x_text, x_media_ids, generated_by_claude, image_urls, fal_image_urls)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;

    const insertResult = await db.query(insertQuery, [
      agentId,
      user.id,
      xConnection.id,
      xPost.id,
      post,
      mediaIds.length > 0 ? mediaIds : null,
      true, // generated_by_claude
      imageUrl ? [imageUrl] : null,
      imageUrl ? [imageUrl] : null,
    ]);

    return NextResponse.json({
      success: true,
      post: {
        text: post,
        xId: xPost.id,
        imageUrl,
        mediaCount: mediaIds.length,
      },
      data: insertResult.rows[0],
    });
  } catch (error) {
    console.error('[v0] X post generation error:', error);
    return NextResponse.json(
      { error: `Failed to generate and post: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// GET - Fetch posted content history
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;

    const sessionToken = request.headers.get('authorization')?.split(' ')[1];
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = await getUserFromSession(sessionToken);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    const query = `
      SELECT * FROM x_posts 
      WHERE agent_id = $1 AND user_id = $2
      ORDER BY created_at DESC
      LIMIT 50;
    `;

    const result = await db.query(query, [agentId, user.id]);

    return NextResponse.json({
      posts: result.rows,
    });
  } catch (error) {
    console.error('[v0] X posts fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}
