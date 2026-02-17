import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import { ensureDataDocuments, getAppSettings, upsertAppSettings } from '@/lib/data-api-client';

const MAX_STYLE_LENGTH = 2000;

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const documentIds = await ensureDataDocuments(auth.apiToken);
    const settings = await getAppSettings(auth.apiToken, documentIds.settings);
    return NextResponse.json(settings);
  } catch (error) {
    console.error('[Admin/settings] Failed to load settings:', error);
    return NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => null) as { leadImageStyleInstructions?: string } | null;
    const styleInstructions = body?.leadImageStyleInstructions?.trim();

    if (!styleInstructions) {
      return NextResponse.json(
        { error: 'leadImageStyleInstructions is required' },
        { status: 400 }
      );
    }

    if (styleInstructions.length > MAX_STYLE_LENGTH) {
      return NextResponse.json(
        { error: `leadImageStyleInstructions must be <= ${MAX_STYLE_LENGTH} characters` },
        { status: 400 }
      );
    }

    const documentIds = await ensureDataDocuments(auth.apiToken);
    const settings = await upsertAppSettings(auth.apiToken, documentIds.settings, {
      leadImageStyleInstructions: styleInstructions,
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('[Admin/settings] Failed to update settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
