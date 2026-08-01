import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface PostGenerationParams {
  topic: string;
  tone?: 'professional' | 'casual' | 'humorous' | 'marketing';
  maxLength?: number;
  includeHashtags?: boolean;
  includeEmoji?: boolean;
  context?: string;
}

export interface ImageDescriptionParams {
  subject: string;
  style?: string;
  mood?: string;
  context?: string;
  aspectRatio?: '1:1' | '16:9' | '9:16';
}

/**
 * Generate a social media post using Claude
 */
export async function generatePost(params: PostGenerationParams): Promise<string> {
  const {
    topic,
    tone = 'casual',
    maxLength = 280,
    includeHashtags = true,
    includeEmoji = true,
    context,
  } = params;

  const systemPrompt = `You are an expert social media content creator specializing in crypto and DeFi. 
Your posts are ${tone}, engaging, and designed to drive interaction.
${includeEmoji ? 'Use emojis strategically to enhance readability.' : 'Do not use emojis.'}
${includeHashtags ? 'Include 2-3 relevant hashtags at the end.' : 'Do not include hashtags.'}
Keep the post under ${maxLength} characters.`;

  const userPrompt = `Create a social media post about: ${topic}
${context ? `Context: ${context}` : ''}
Make it compelling and shareable.`;

  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    system: systemPrompt,
  });

  const content = message.content[0];
  if (content.type === 'text') {
    return content.text;
  }

  throw new Error('Unexpected response from Claude');
}

/**
 * Generate image prompt/description using Claude
 */
export async function generateImageDescription(
  params: ImageDescriptionParams
): Promise<string> {
  const {
    subject,
    style,
    mood,
    context,
    aspectRatio = '1:1',
  } = params;

  const systemPrompt = `You are an expert at writing detailed, creative image prompts for AI image generation models.
Your prompts are specific, vivid, and optimized for quality image generation.
Keep prompts concise but descriptive.`;

  let userPrompt = `Create an image prompt for: ${subject}`;
  if (style) userPrompt += `\nStyle: ${style}`;
  if (mood) userPrompt += `\nMood: ${mood}`;
  if (context) userPrompt += `\nContext: ${context}`;
  userPrompt += `\nAspect ratio: ${aspectRatio}`;
  userPrompt += '\nProvide only the prompt, no additional text.';

  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    system: systemPrompt,
  });

  const content = message.content[0];
  if (content.type === 'text') {
    return content.text;
  }

  throw new Error('Unexpected response from Claude');
}

/**
 * Generate multiple post variations using Claude
 */
export async function generatePostVariations(
  params: PostGenerationParams & { count?: number }
): Promise<string[]> {
  const { count = 3, ...restParams } = params;

  const systemPrompt = `You are an expert social media content creator specializing in crypto and DeFi.
Generate ${count} different variations of a social media post.
Each should be unique in approach but aligned with the same message.
Separate each post with "---" on its own line.`;

  const userPrompt = `Create ${count} different social media posts about: ${params.topic}
${params.context ? `Context: ${params.context}` : ''}
Make each one unique and compelling.`;

  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    system: systemPrompt,
  });

  const content = message.content[0];
  if (content.type === 'text') {
    const posts = content.text
      .split('---')
      .map((post) => post.trim())
      .filter((post) => post.length > 0);
    return posts;
  }

  throw new Error('Unexpected response from Claude');
}

/**
 * Enhance/refine a post using Claude
 */
export async function refinePost(
  post: string,
  improvement: 'more_engaging' | 'shorter' | 'longer' | 'professional' | 'casual'
): Promise<string> {
  const improvementGuide = {
    more_engaging: 'Make it more engaging and likely to drive interaction',
    shorter: 'Condense it to be shorter while keeping the key message',
    longer: 'Expand it with more details and context',
    professional: 'Make it more professional in tone',
    casual: 'Make it more casual and approachable',
  };

  const systemPrompt = `You are an expert social media content editor.
Refine posts to improve quality while maintaining the core message.
Return only the refined post, no additional text.`;

  const userPrompt = `Refine this post to be ${improvementGuide[improvement]}:

"${post}"`;

  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    system: systemPrompt,
  });

  const content = message.content[0];
  if (content.type === 'text') {
    return content.text.trim();
  }

  throw new Error('Unexpected response from Claude');
}
