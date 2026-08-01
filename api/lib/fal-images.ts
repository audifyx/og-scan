import * as fal from '@fal-ai/serverless';

// Initialize Fal with API key
fal.config({
  credentials: process.env.FAL_API_KEY,
});

export interface ImageGenerationParams {
  prompt: string;
  model?: 'flux-pro' | 'flux-realism' | 'grok-vision';
  width?: number;
  height?: number;
  numInference?: number;
  seed?: number;
}

export interface GeneratedImage {
  url: string;
  seed: number;
  timings?: {
    inference: number;
  };
}

/**
 * Generate image using Fal (supports Grok via Fal)
 */
export async function generateImage(
  params: ImageGenerationParams
): Promise<GeneratedImage> {
  const {
    prompt,
    model = 'flux-pro',
    width = 1024,
    height = 1024,
    numInference = 1,
    seed,
  } = params;

  try {
    const result = await fal.subscribe('fal-ai/flux-pro', {
      input: {
        prompt,
        image_size: {
          width,
          height,
        },
        num_inference_steps: numInference,
        ...(seed && { seed }),
      },
    });

    const images = result.data.images as Array<{ url: string }>;

    return {
      url: images[0].url,
      seed: result.data.seed || seed || 0,
      timings: result.data.timings,
    };
  } catch (error) {
    console.error('[v0] Fal image generation error:', error);
    throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate multiple images in parallel
 */
export async function generateImages(
  params: ImageGenerationParams & { count?: number }
): Promise<GeneratedImage[]> {
  const { count = 3, ...restParams } = params;

  const promises = Array.from({ length: count }).map((_, index) =>
    generateImage({
      ...restParams,
      seed: restParams.seed ? restParams.seed + index : undefined,
    })
  );

  return Promise.all(promises);
}

/**
 * Generate image with automatic upscaling
 */
export async function generateImageWithUpscaling(
  params: ImageGenerationParams
): Promise<GeneratedImage> {
  const image = await generateImage(params);

  // Upscale the generated image
  try {
    const upscaleResult = await fal.subscribe('fal-ai/upscayl', {
      input: {
        image_url: image.url,
        upscale_factor: 2,
        model: 'realesrgan-x2-plus',
      },
    });

    return {
      url: upscaleResult.data.image.url,
      seed: image.seed,
      timings: image.timings,
    };
  } catch (error) {
    console.error('[v0] Upscaling failed, returning original:', error);
    return image;
  }
}

/**
 * Generate image with style transfer
 */
export async function generateImageWithStyle(
  imageUrl: string,
  stylePrompt: string
): Promise<GeneratedImage> {
  try {
    const result = await fal.subscribe('fal-ai/flux-pro-repainting', {
      input: {
        image_url: imageUrl,
        prompt: stylePrompt,
        strength: 0.8,
      },
    });

    const images = result.data.images as Array<{ url: string }>;

    return {
      url: images[0].url,
      seed: result.data.seed || 0,
      timings: result.data.timings,
    };
  } catch (error) {
    console.error('[v0] Style transfer error:', error);
    throw new Error(`Failed to apply style: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Download image from URL and return as buffer
 */
export async function downloadImage(imageUrl: string): Promise<Buffer> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.error('[v0] Download image error:', error);
    throw new Error(`Failed to download image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate batch of images with different prompts
 */
export async function generateImageBatch(
  prompts: string[],
  baseParams?: Omit<ImageGenerationParams, 'prompt'>
): Promise<GeneratedImage[]> {
  const promises = prompts.map((prompt) =>
    generateImage({
      ...baseParams,
      prompt,
    })
  );

  return Promise.all(promises);
}
