"use client";

import React, { useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { FetchWrapper, Footer, VersionBar } from "@jazzmind/busibox-app";
import type { SessionData } from "@jazzmind/busibox-app";
import { AuthProvider, useAuth } from "@/components/auth/AuthContext";

// Simple header component - customize or replace with CustomHeader from busibox-app
function AppHeader({
  session,
  onLogout,
  portalUrl,
  appHomeLink,
}: {
  session: SessionData;
  onLogout: () => void;
  portalUrl: string;
  appHomeLink: string;
}) {
  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={appHomeLink}
            className="text-xl font-bold text-gray-900 dark:text-white"
          >
            My App
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {session.isAuthenticated ? (
            <>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {session.user?.email}
              </span>
              <button
                onClick={onLogout}
                className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Logout
              </button>
            </>
          ) : (
            <a
              href={portalUrl}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Login
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

function AppShellContent({
  children,
  basePath,
}: {
  children: React.ReactNode;
  basePath: string;
}) {
  const { isReady, refreshKey, authState, redirectToPortal, logout } =
    useAuth();
  const [session, setSession] = useState<SessionData>({
    user: null,
    isAuthenticated: false,
  });

  const portalUrl = process.env.NEXT_PUBLIC_AI_PORTAL_URL
    ? `${process.env.NEXT_PUBLIC_AI_PORTAL_URL}`
    : "/portal";

  const appHomeLink = basePath || "/";

  // URLs to skip auth handling for
  const skipAuthUrls = useMemo(
    () => [
      "/api/auth/refresh",
      "/api/auth/exchange",
      "/api/session",
      "/api/logout",
      "/api/health",
    ],
    []
  );

  const onLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  // Sync session from auth state when it changes
  useEffect(() => {
    if (authState?.isAuthenticated && authState.user) {
      setSession({
        user: {
          id: authState.user.id,
          email: authState.user.email,
          status: "ACTIVE",
          roles: authState.user.roles,
        },
        isAuthenticated: true,
      });
    }
  }, [authState]);

  // Load session after auth is ready
  useEffect(() => {
    if (!isReady) return;

    let cancelled = false;
    async function loadSession() {
      try {
        const res = await fetch("/api/session", {
          credentials: "include",
        });
        const data = await res.json();
        if (!cancelled) setSession(data);
      } catch {
        if (!cancelled) setSession({ user: null, isAuthenticated: false });
      }
    }
    loadSession();
    return () => {
      cancelled = true;
    };
  }, [isReady, refreshKey]);

  // Handle auth errors - redirect to portal
  const handleAuthError = useCallback(() => {
    console.log("[AppShell] Auth error, redirecting to portal");
    redirectToPortal("session_expired");
  }, [redirectToPortal]);

  return (
    <>
      <FetchWrapper
        skipAuthUrls={skipAuthUrls}
        onAuthError={handleAuthError}
        autoRetry={true}
      />
      <AppHeader
        session={session}
        onLogout={onLogout}
        portalUrl={portalUrl}
        appHomeLink={appHomeLink}
      />
      {/* Add your app navigation here */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center gap-6">
          <Link
            href="/"
            className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
          >
            Home
          </Link>
          {/* DEMO LINK - DELETE WHEN BUILDING REAL APP */}
          <Link
            href="/demo"
            className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
          >
            Demo Features
          </Link>
          {/* Add more navigation links as needed */}
        </div>
      </nav>
      <main className="flex-1">{children}</main>
      <Footer />
      <VersionBar />
    </>
  );
}

export function AppShell({
  children,
  basePath,
}: {
  children: React.ReactNode;
  basePath: string;
}) {
  return (
    <AuthProvider>
      <AppShellContent basePath={basePath}>{children}</AppShellContent>
    </AuthProvider>
  );
}
