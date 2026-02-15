import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';

function toUserProfile(user: any) {
  return {
    id: user.user_id || user.id,
    email: user.email,
    displayName: user.display_name || user.displayName,
    firstName: user.first_name || user.firstName,
    lastName: user.last_name || user.lastName,
    avatarUrl: user.avatar_url || user.avatarUrl,
    favoriteColor: user.favorite_color || user.favoriteColor,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'authz-api', ['authz.users.read']);
  if (auth instanceof NextResponse) return auth;

  const authzBaseUrl = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';
  const response = await fetch(`${authzBaseUrl}/admin/users?limit=200&page=1`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${auth.apiToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const details = await response.text();
    return NextResponse.json(
      { error: `Failed to fetch users: ${details}` },
      { status: response.status }
    );
  }

  const payload = await response.json();
  const users = Array.isArray(payload.users) ? payload.users.map(toUserProfile) : [];
  return NextResponse.json({ users });
}
