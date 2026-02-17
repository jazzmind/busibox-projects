import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import { getTokenFromRequest } from '@jazzmind/busibox-app/lib/auth';
import { getApiToken } from '@/lib/authz-client';
import { ensureDataDocuments, getAppSettings, listProjects } from '@/lib/data-api-client';
import { generateAndSaveProjectLeadImage } from '@/lib/lead-image';

type GenerateMode = 'missing' | 'all';

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => ({})) as { mode?: GenerateMode };
    const mode: GenerateMode = body.mode === 'all' ? 'all' : 'missing';

    const ssoToken = getTokenFromRequest(request);
    if (!ssoToken) {
      return NextResponse.json({ error: 'No SSO token available' }, { status: 401 });
    }
    const agentToken = await getApiToken(ssoToken, 'agent-api');

    const documentIds = await ensureDataDocuments(auth.apiToken);
    const settings = await getAppSettings(auth.apiToken, documentIds.settings);

    const { projects } = await listProjects(auth.apiToken, documentIds.projects, { limit: 500 });
    const targetProjects = mode === 'missing'
      ? projects.filter((project) => !project.leadImage)
      : projects;

    const results: Array<{ projectId: string; projectName: string; success: boolean; error?: string }> = [];

    for (const project of targetProjects) {
      try {
        await generateAndSaveProjectLeadImage({
          dataApiToken: auth.apiToken,
          agentApiToken: agentToken,
          projectId: project.id,
          documentIds: {
            projects: documentIds.projects,
            settings: documentIds.settings,
          },
          styleInstructions: settings.leadImageStyleInstructions,
        });
        results.push({ projectId: project.id, projectName: project.name, success: true });
      } catch (error) {
        results.push({
          projectId: project.id,
          projectName: project.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((item) => item.success).length;
    const failedCount = results.length - successCount;

    return NextResponse.json({
      mode,
      totalProjects: projects.length,
      targetedProjects: targetProjects.length,
      successCount,
      failedCount,
      results,
    });
  } catch (error) {
    console.error('[Admin/generate-images] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate images' },
      { status: 500 }
    );
  }
}
