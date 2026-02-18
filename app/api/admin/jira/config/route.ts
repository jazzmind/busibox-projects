import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import { ensureDataDocuments } from '@/lib/data-api-client';
import { registerJiraWebhook, testJiraConnection } from '@/lib/jira-client';
import { getJiraConfig, maskJiraApiToken, upsertJiraConfig } from '@/lib/jira-data';

function sanitizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const documentIds = await ensureDataDocuments(auth.apiToken);
    const config = await getJiraConfig(auth.apiToken, documentIds.jira);

    if (!config) {
      return NextResponse.json({
        connected: false,
        jiraBaseUrl: '',
        jiraEmail: '',
        jiraApiTokenMasked: '',
        webhookConfigured: false,
      });
    }

    return NextResponse.json({
      connected: config.connected,
      jiraBaseUrl: config.jiraBaseUrl,
      jiraEmail: config.jiraEmail,
      jiraApiTokenMasked: maskJiraApiToken(config.jiraApiToken),
      webhookConfigured: Boolean(config.webhookId),
      updatedAt: config.updatedAt,
    });
  } catch (error) {
    console.error('[Admin/JIRA/config] Failed to fetch config:', error);
    return NextResponse.json({ error: 'Failed to fetch JIRA config' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json().catch(() => null)) as
      | {
          jiraBaseUrl?: string;
          jiraEmail?: string;
          jiraApiToken?: string;
          registerWebhook?: boolean;
        }
      | null;

    const jiraBaseUrl = sanitizeBaseUrl(body?.jiraBaseUrl || '');
    const jiraEmail = (body?.jiraEmail || '').trim();
    const jiraApiToken = (body?.jiraApiToken || '').trim();

    if (!jiraBaseUrl || !jiraEmail || !jiraApiToken) {
      return NextResponse.json(
        { error: 'jiraBaseUrl, jiraEmail, and jiraApiToken are required' },
        { status: 400 }
      );
    }

    await testJiraConnection({
      jiraBaseUrl,
      jiraEmail,
      jiraApiToken,
    });

    const documentIds = await ensureDataDocuments(auth.apiToken);
    const existing = await getJiraConfig(auth.apiToken, documentIds.jira);

    const webhookSecret = existing?.webhookSecret || randomBytes(24).toString('hex');
    let webhookId = existing?.webhookId;

    if (body?.registerWebhook) {
      const publicWebhookUrl = process.env.JIRA_WEBHOOK_PUBLIC_URL?.trim();
      if (!publicWebhookUrl) {
        return NextResponse.json(
          { error: 'JIRA_WEBHOOK_PUBLIC_URL is not configured for webhook registration' },
          { status: 400 }
        );
      }

      webhookId = String(
        (
          await registerJiraWebhook(
            { jiraBaseUrl, jiraEmail, jiraApiToken },
            publicWebhookUrl
          )
        ) || ''
      );
    }

    const saved = await upsertJiraConfig(auth.apiToken, documentIds.jira, {
      jiraBaseUrl,
      jiraEmail,
      jiraApiToken,
      webhookSecret,
      webhookId,
      connected: true,
    });

    return NextResponse.json({
      connected: saved.connected,
      jiraBaseUrl: saved.jiraBaseUrl,
      jiraEmail: saved.jiraEmail,
      jiraApiTokenMasked: maskJiraApiToken(saved.jiraApiToken),
      webhookConfigured: Boolean(saved.webhookId),
      updatedAt: saved.updatedAt,
    });
  } catch (error) {
    console.error('[Admin/JIRA/config] Failed to update config:', error);
    return NextResponse.json(
      {
        error: 'Failed to update JIRA config',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
