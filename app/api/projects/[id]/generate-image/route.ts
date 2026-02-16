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
 * 5. Download/decode the generated image bytes
 * 6. Upload the image to data-api (stored in user's personal MEDIA library)
 * 7. Save the portal media URL (/portal/api/media/{fileId}) as leadImage
 * 8. Return the updated project
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import { getAgentApiUrl } from '@/lib/agent-api-client';
import { ensureDataDocuments, getProject, updateProject } from '@/lib/data-api-client';
import { getApiToken } from '@/lib/authz-client';
import { getTokenFromRequest } from '@jazzmind/busibox-app/lib/auth';
import { getDataServiceUrl } from '@jazzmind/busibox-app/lib/data';

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

    // 5. Extract and download/decode the generated image
    const first = imageData?.data?.[0];
    if (!first) {
      console.error('[generate-image] No image data in response:', JSON.stringify(imageData));
      return NextResponse.json(
        { error: 'No image data returned from generation' },
        { status: 500 }
      );
    }

    let imageBytes: Buffer;
    let mimeType = 'image/png';

    if (first.b64_json) {
      // Base64 models (gpt-image-1, gpt-image-1-mini)
      imageBytes = Buffer.from(first.b64_json, 'base64');
      console.log(`[generate-image] Decoded b64_json response (${imageBytes.length} bytes)`);
    } else if (first.url) {
      // URL-based models (DALL-E 3, FLUX) - download the temporary URL
      console.log(`[generate-image] Downloading image from URL: ${first.url.substring(0, 80)}...`);
      const downloadResp = await fetch(first.url);
      if (!downloadResp.ok) {
        return NextResponse.json(
          { error: 'Failed to download generated image from provider' },
          { status: 502 }
        );
      }
      const contentType = downloadResp.headers.get('content-type');
      if (contentType?.includes('jpeg') || contentType?.includes('jpg')) {
        mimeType = 'image/jpeg';
      } else if (contentType?.includes('webp')) {
        mimeType = 'image/webp';
      }
      imageBytes = Buffer.from(await downloadResp.arrayBuffer());
      console.log(`[generate-image] Downloaded image (${imageBytes.length} bytes, ${mimeType})`);
    } else {
      console.error('[generate-image] No url or b64_json in response:', JSON.stringify(first));
      return NextResponse.json(
        { error: 'Image model returned no image data' },
        { status: 500 }
      );
    }

    // 6. Upload image to data-api (stored in user's personal MEDIA library)
    const dataApiUrl = getDataServiceUrl();
    const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
    const filename = `project-lead-image.${ext}`;

    const formData = new FormData();
    formData.append('file', new Blob([imageBytes], { type: mimeType }), filename);
    formData.append('visibility', 'personal');
    formData.append('metadata', JSON.stringify({
      source: 'project_lead_image',
      projectId: id,
      projectName: project.name,
      generated: true,
    }));

    const uploadResp = await fetch(`${dataApiUrl}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.apiToken}`,
      },
      body: formData,
    });

    if (!uploadResp.ok) {
      const errorText = await uploadResp.text();
      console.error('[generate-image] Data API upload error:', uploadResp.status, errorText);
      return NextResponse.json(
        { error: 'Failed to store generated image', details: errorText },
        { status: 500 }
      );
    }

    const uploadData = await uploadResp.json();
    const fileId = uploadData.fileId;
    if (!fileId) {
      console.error('[generate-image] No fileId in upload response:', JSON.stringify(uploadData));
      return NextResponse.json(
        { error: 'Upload succeeded but no fileId returned' },
        { status: 500 }
      );
    }

    // 7. Build portal-relative URL and save to project
    const mediaUrl = `/portal/api/media/${fileId}`;
    console.log(`[generate-image] Uploaded image, fileId=${fileId}, mediaUrl=${mediaUrl}`);

    const updated = await updateProject(auth.apiToken, documentIds.projects, id, {
      leadImage: mediaUrl,
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
