/**
 * POST /api/projects/[id]/generate-image
 *
 * Generates a lead image for a project using the agent API's image generation
 * endpoint (which proxies to LiteLLM -> FLUX/DALL-E).
 *
 * Flow:
 * 1. Authenticate and exchange tokens for both data-api and agent-api
 * 2. Fetch the project to get its name and description
 * 3. Craft an image generation prompt from the project details
 * 4. Call POST /llm/images/create on the agent API
 * 5. Save the image URL to the project's leadImage field
 * 6. Return the updated project
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import { getAgentApiUrl } from '@/lib/agent-api-client';
import { ensureDataDocuments, getProject, updateProject } from '@/lib/data-api-client';
import { getApiToken } from '@/lib/authz-client';
import { getTokenFromRequest } from '@jazzmind/busibox-app/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  // Authenticate for data-api access
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    // 1. Get project details
    const documentIds = await ensureDataDocuments(auth.apiToken);
    const project = await getProject(auth.apiToken, documentIds.projects, id);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 2. Get agent-api token for image generation
    const ssoToken = getTokenFromRequest(request);
    if (!ssoToken) {
      return NextResponse.json({ error: 'No SSO token available' }, { status: 401 });
    }
    const agentToken = await getApiToken(ssoToken, 'agent-api');

    // 3. Craft image generation prompt
    const projectContext = [
      project.name,
      project.description,
    ].filter(Boolean).join('. ');

    const prompt = `Create a professional, modern, abstract illustration for a project dashboard. The image should visually represent the concept of: "${projectContext}". Style: clean, minimal, corporate-friendly, using soft gradients and geometric shapes. No text or words in the image. Suitable as a banner/hero image.`;

    // 4. Call agent API image generation
    const agentApiUrl = getAgentApiUrl();
    const imageResponse = await fetch(`${agentApiUrl}/llm/images/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${agentToken}`,
      },
      body: JSON.stringify({
        model: 'image',
        prompt,
        size: '1024x1024',
        n: 1,
        response_format: 'url',
      }),
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error('[generate-image] Agent API error:', imageResponse.status, errorText);
      return NextResponse.json(
        { error: 'Image generation failed', details: errorText },
        { status: imageResponse.status }
      );
    }

    const imageData = await imageResponse.json();

    // Extract image URL from OpenAI-format response
    // Format: { data: [{ url: "...", revised_prompt: "..." }] }
    const imageUrl = imageData?.data?.[0]?.url || imageData?.data?.[0]?.b64_json;

    if (!imageUrl) {
      console.error('[generate-image] No image URL in response:', JSON.stringify(imageData));
      return NextResponse.json(
        { error: 'No image URL returned from generation' },
        { status: 500 }
      );
    }

    // 5. Save lead image to project
    const updated = await updateProject(auth.apiToken, documentIds.projects, id, {
      leadImage: imageUrl,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[generate-image] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
