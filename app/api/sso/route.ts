import { NextRequest, NextResponse } from "next/server";
import { validateSSOToken, createSessionFromSSO } from "@jazzmind/busibox-app/lib/auth";

/**
 * SSO callback endpoint
 *
 * Handles SSO redirects from AI Portal.
 * Validates the token and sets up the session.
 * 
 * IMPORTANT: Only sets app-specific cookies, NOT busibox-session.
 * The busibox-session is managed by AI Portal at the domain level.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("token");
  const returnUrl = searchParams.get("return") || "/";

  if (!token) {
    console.error("[SSO] No token provided");
    return NextResponse.redirect(new URL("/login?error=no_token", request.url));
  }

  try {
    // Validate the token
    const validation = await validateSSOToken(token);

    if (!validation.valid) {
      console.error("[SSO] Token validation failed:", validation.error);
      return NextResponse.redirect(
        new URL(`/login?error=${validation.error}`, request.url)
      );
    }

    // Create session data
    const session = createSessionFromSSO(validation);

    // Create response with redirect
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const redirectUrl = returnUrl.startsWith("/")
      ? `${basePath}${returnUrl}`
      : returnUrl;

    const response = NextResponse.redirect(new URL(redirectUrl, request.url));

    // Set app-specific session cookie with extracted user info
    const appName = process.env.APP_NAME || "app";
    response.cookies.set(`${appName}-session`, JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: basePath || "/",
    });

    // Set app-specific auth_token cookie to avoid conflicts with other apps
    // Using app-prefixed name ensures each app has its own token cookie
    response.cookies.set(`${appName}-auth-token`, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 6, // 6 hours
      path: basePath || "/",
    });

    // NOTE: Do NOT set busibox-session here - that's the portal's domain-wide
    // session cookie and should not be overwritten by individual apps.

    return response;
  } catch (error) {
    console.error("[SSO] Error:", error);
    return NextResponse.redirect(
      new URL("/login?error=sso_failed", request.url)
    );
  }
}

/**
 * SSO POST handler for token-based auth
 * 
 * IMPORTANT: Only sets app-specific cookies, NOT busibox-session.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = body.token;

    if (!token) {
      return NextResponse.json(
        { error: "No token provided" },
        { status: 400 }
      );
    }

    // Validate the token
    const validation = await validateSSOToken(token);

    if (!validation.valid) {
      return NextResponse.json(
        { error: "Invalid token", details: validation.error },
        { status: 401 }
      );
    }

    // Create session data
    const session = createSessionFromSSO(validation);

    // Create response
    const response = NextResponse.json({
      success: true,
      user: {
        id: session.userId,
        email: session.email,
        roles: session.roles,
      },
    });

    // Get basePath for cookie scoping
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/";

    // Set app-specific session cookies
    const appName = process.env.APP_NAME || "app";
    response.cookies.set(`${appName}-session`, JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: basePath,
    });

    // Set app-specific auth_token cookie to avoid conflicts with other apps
    response.cookies.set(`${appName}-auth-token`, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 6,
      path: basePath,
    });

    // NOTE: Do NOT set busibox-session here - that's the portal's domain-wide
    // session cookie and should not be overwritten by individual apps.

    return response;
  } catch (error) {
    console.error("[SSO] POST Error:", error);
    return NextResponse.json(
      { error: "SSO failed" },
      { status: 500 }
    );
  }
}
