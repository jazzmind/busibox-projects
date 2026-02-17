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
import { ensureDataDocuments } from '@/lib/data-api-client';
import { getApiToken } from '@/lib/authz-client';
import { getTokenFromRequest } from '@jazzmind/busibox-app/lib/auth';
import { generateAndSaveProjectLeadImage } from '@/lib/lead-image';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  // Authenticate for data-api access
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    // 1. Ensure data documents
    const documentIds = await ensureDataDocuments(auth.apiToken);

    // 2. Get agent-api token for image generation
    const ssoToken = getTokenFromRequest(request);
    if (!ssoToken) {
      return NextResponse.json({ error: 'No SSO token available' }, { status: 401 });
    }
    const agentToken = await getApiToken(ssoToken, 'agent-api');

    const updated = await generateAndSaveProjectLeadImage({
      dataApiToken: auth.apiToken,
      agentApiToken: agentToken,
      projectId: id,
      documentIds: {
        projects: documentIds.projects,
        settings: documentIds.settings,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[generate-image] Error:', error);
    if (error instanceof Error && error.message.includes('Project not found')) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
