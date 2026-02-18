import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import { ensureDataDocuments } from '@/lib/data-api-client';
import { getJiraConfig, getJiraSyncMappings, getJiraSyncMappingByProjectId } from '@/lib/jira-data';
import { fullSync } from '@/lib/jira-sync';
import type { JiraSyncDirection } from '@/lib/types';

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json().catch(() => null)) as
      | {
          projectId?: string;
          direction?: JiraSyncDirection;
          syncAll?: boolean;
        }
      | null;
    const direction: JiraSyncDirection = body?.direction || 'both';

    const documentIds = await ensureDataDocuments(auth.apiToken);
    const config = await getJiraConfig(auth.apiToken, documentIds.jira);
    if (!config?.connected) {
      return NextResponse.json({ error: 'JIRA is not connected' }, { status: 400 });
    }

    const mappings = body?.syncAll
      ? await getJiraSyncMappings(auth.apiToken, documentIds.jira)
      : body?.projectId
        ? [await getJiraSyncMappingByProjectId(auth.apiToken, documentIds.jira, body.projectId)].filter(Boolean)
        : [];

    if (!mappings.length) {
      return NextResponse.json({ error: 'No mappings found for sync request' }, { status: 404 });
    }

    const results = [];
    for (const mapping of mappings) {
      const result = await fullSync(auth.apiToken, config, mapping!, documentIds, direction);
      results.push(result);
    }

    return NextResponse.json({
      success: true,
      direction,
      synced: results.length,
      results,
    });
  } catch (error) {
    console.error('[Admin/JIRA/sync] Failed to sync:', error);
    return NextResponse.json(
      { error: 'Failed to run sync', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
