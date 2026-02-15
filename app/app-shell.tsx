'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FetchWrapper, Footer, VersionBar, AuthProvider, useAuth } from '@jazzmind/busibox-app';
import type { SessionData } from '@jazzmind/busibox-app';
import { CustomHeader } from '@/components/CustomHeader';
import { cn } from '@jazzmind/busibox-app/lib/utils';

function AppShellContent({ children, basePath }: { children: React.ReactNode; basePath: string }) {
  const { isReady, refreshKey, authState, redirectToPortal, logout } = useAuth();
  const [session, setSession] = useState<SessionData>({ user: null, isAuthenticated: false });
  const pathname = usePathname();
  
  // Portal URL - normalized in AppShell, but also normalize here for safety
  const portalUrl = normalizePortalUrl(process.env.NEXT_PUBLIC_BUSIBOX_PORTAL_URL || '');
  
  // App home link - use "/" since Next.js Link automatically prepends basePath
  const appHomeLink = '/';

  // Navigation items
  const navItems = [
    { href: '/', label: 'Dashboard' },
    { href: '/graph', label: 'Graph' },
    { href: '/chat', label: 'Chat' },
    { href: '/admin', label: 'Admin' },
  ];

  // URLs to skip auth handling for
  const skipAuthUrls = useMemo(() => [
    `${basePath}/api/auth/refresh`,
    `${basePath}/api/auth/exchange`,
    `${basePath}/api/auth/token`,
    `${basePath}/api/session`,
    `${basePath}/api/logout`,
    `${basePath}/api/health`,
    '/api/auth/refresh',
    '/api/auth/exchange',
    '/api/auth/token',
    '/api/session',
    '/api/logout',
    '/api/health',
  ], [basePath]);

  // Use system-wide logout from auth context
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
          status: 'ACTIVE',
          roles: authState.user.roles,
        },
        isAuthenticated: true,
      });
    }
  }, [authState]);

  // Load session after auth is ready, and reload when refreshKey changes
  useEffect(() => {
    if (!isReady) return;
    
    let cancelled = false;
    async function loadSession() {
      try {
        const res = await fetch(`${basePath}/api/session`, {
          credentials: 'include',
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
  }, [isReady, refreshKey, basePath]);

  // Handle auth errors - redirect to portal
  const handleAuthError = useCallback(() => {
    console.log('[AppShell] Auth error, redirecting to portal');
    redirectToPortal('session_expired');
  }, [redirectToPortal]);

  // Check if path is active
  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/' || pathname === basePath || pathname === `${basePath}/`;
    }
    return pathname?.startsWith(href) || pathname?.startsWith(`${basePath}${href}`);
  };

  return (
    <>
      <FetchWrapper 
        skipAuthUrls={skipAuthUrls}
        onAuthError={handleAuthError}
        autoRetry={true}
      />
      <CustomHeader
        session={session}
        onLogout={onLogout}
        portalUrl={portalUrl}
        accountLink={`${portalUrl}/account`}
        appHomeLink={appHomeLink}
        appName="AI Initiative Status"
        adminNavigation={[]}
      />
      {/* App navigation */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="flex-1">{children}</main>
      <Footer />
      <VersionBar />
    </>
  );
}

// Normalize portal URL: ensure it ends with /portal (but not /portal/portal)
function normalizePortalUrl(raw: string): string {
  const base = raw.replace(/\/+$/, '');
  if (!base) return '';
  return base.endsWith('/portal') ? base : `${base}/portal`;
}

export function AppShell({ children, basePath }: { children: React.ReactNode; basePath: string }) {
  const rawPortalUrl = process.env.NEXT_PUBLIC_BUSIBOX_PORTAL_URL || '';
  const appId = process.env.APP_NAME || 'busibox-projects';
  
  return (
    <AuthProvider
      appId={appId}
      portalUrl={rawPortalUrl}
      basePath={basePath}
    >
      <AppShellContent basePath={basePath}>{children}</AppShellContent>
    </AuthProvider>
  );
}
