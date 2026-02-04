/**
 * Authentication Context
 * 
 * Provides authentication state management including:
 * - Token exchange status tracking
 * - Ready signal for data fetching
 * - Proactive token refresh via auth state manager
 * - Automatic redirect to portal when re-authentication is required
 * 
 * Based on the agent-manager AuthContext pattern.
 */

'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  createAuthStateManager,
  setGlobalAuthManager,
  clearGlobalAuthManager,
  type AuthStateManager,
  type AuthState,
} from '@jazzmind/busibox-app/lib/auth';

interface AuthContextValue {
  /** Whether auth is ready (no pending token exchange) */
  isReady: boolean;
  /** Whether a token exchange is in progress */
  isExchanging: boolean;
  /** Trigger a data refresh (call this after token exchange) */
  refreshKey: number;
  /** Current auth state from the auth manager */
  authState: AuthState | null;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Force a token refresh */
  refreshToken: () => Promise<boolean>;
  /** Redirect to portal for re-authentication */
  redirectToPortal: (reason?: string) => void;
  /** Perform a system-wide logout */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  isReady: true,
  isExchanging: false,
  refreshKey: 0,
  authState: null,
  isAuthenticated: false,
  refreshToken: async () => false,
  redirectToPortal: () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isExchanging, setIsExchanging] = useState(false);
  const [isReady, setIsReady] = useState(false); // Start as not ready
  const [refreshKey, setRefreshKey] = useState(0);
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [tokenExchangeComplete, setTokenExchangeComplete] = useState(false);
  
  const authManagerRef = useRef<AuthStateManager | null>(null);
  
  // Portal URL - MUST be configured via NEXT_PUBLIC_AI_PORTAL_URL
  // No fallback to localhost:3000 as that causes redirect loops in Docker environments
  const portalUrl = process.env.NEXT_PUBLIC_AI_PORTAL_URL || '';
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  // Ensure internal fetches respect Next.js basePath.
  // When basePath is set (e.g. "/myapp"), API routes are served at:
  //   /myapp/api/...
  // NOT at:
  //   /api/...
  const withBasePath = useCallback((path: string) => {
    if (!path.startsWith('/')) path = `/${path}`;
    if (!basePath) return path;
    return `${basePath}${path}`;
  }, [basePath]);

  // Handle token exchange from URL FIRST, before starting auth manager
  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      // No token in URL - mark exchange as complete immediately
      setTokenExchangeComplete(true);
      setIsReady(true);
      return;
    }

    // Token present - need to exchange it before starting auth monitoring
    console.log('[AuthProvider] Token found in URL, starting exchange...');
    setIsReady(false);
    setIsExchanging(true);

    exchangeToken(token)
      .then(() => {
        console.log('[AuthProvider] Token exchange successful');
        setRefreshKey(prev => prev + 1);
      })
      .catch((error) => {
        console.error('[AuthProvider] Token exchange failed:', error);
      })
      .finally(() => {
        setIsExchanging(false);
        setIsReady(true);
        setTokenExchangeComplete(true);
        
        // Remove token from URL - need to strip basePath since router.replace adds it
        const url = new URL(window.location.href);
        url.searchParams.delete('token');
        
        // Get path relative to basePath (Next.js router expects paths without basePath)
        let path = url.pathname;
        if (basePath && path.startsWith(basePath)) {
          path = path.slice(basePath.length) || '/';
        }
        
        // Use window.history to avoid Next.js router prepending basePath
        const newUrl = path + url.search;
        console.log('[AuthProvider] Replacing URL:', window.location.pathname, '->', newUrl);
        window.history.replaceState(null, '', url.pathname + url.search);
      });
  }, [searchParams, basePath]);

  // Initialize auth state manager ONLY after token exchange is complete
  useEffect(() => {
    // Don't start until token exchange is complete
    if (!tokenExchangeComplete) {
      console.log('[AuthProvider] Waiting for token exchange to complete before starting auth manager');
      return;
    }

    console.log('[AuthProvider] Token exchange complete, starting auth manager');

    // Create the auth state manager
    // autoRedirect: true - redirect to portal when session is invalid
    // This is needed for apps that require authentication
    const manager = createAuthStateManager({
      refreshEndpoint: withBasePath('/api/auth/refresh'),
      sessionEndpoint: withBasePath('/api/session'),
      portalUrl: portalUrl ? `${portalUrl}/home` : '', // Go to portal home page
      appId: process.env.APP_NAME || 'app-template',
      checkIntervalMs: 30_000, // Check every 30 seconds
      refreshBufferMs: 5 * 60 * 1000, // Refresh 5 minutes before expiry
      autoRedirect: Boolean(portalUrl), // Only auto-redirect if portal URL is configured
      basePath,
      getToken: () => {
        if (typeof window !== 'undefined') {
          return localStorage.getItem('auth_token');
        }
        return null;
      },
      setToken: (token) => {
        if (typeof window !== 'undefined') {
          if (token) {
            localStorage.setItem('auth_token', token);
          } else {
            localStorage.removeItem('auth_token');
          }
        }
      },
    });

    // Set as global manager for FetchWrapper to use
    setGlobalAuthManager(manager);
    authManagerRef.current = manager;

    // Subscribe to auth state changes
    const unsubscribeState = manager.on<AuthState>('authStateChanged', (state) => {
      console.log('[AuthProvider] Auth state changed:', state);
      setAuthState(state);
      // Trigger refresh of data when auth state changes
      setRefreshKey(prev => prev + 1);
    });

    // Subscribe to token refresh events
    const unsubscribeRefresh = manager.on('tokenRefreshed', () => {
      console.log('[AuthProvider] Token refreshed successfully');
      setRefreshKey(prev => prev + 1);
    });

    // Subscribe to re-auth requirements (auto-redirect is handled by manager)
    const unsubscribeReauth = manager.on('requiresReauth', (data: unknown) => {
      const reason = (data as { reason?: string })?.reason;
      console.log('[AuthProvider] Re-authentication required:', reason);
    });

    // Start monitoring - but give a brief delay to let cookies settle
    const startDelay = setTimeout(() => {
      manager.start();
    }, 100);

    return () => {
      clearTimeout(startDelay);
      unsubscribeState();
      unsubscribeRefresh();
      unsubscribeReauth();
      manager.stop();
      clearGlobalAuthManager();
    };
  }, [portalUrl, basePath, tokenExchangeComplete, withBasePath]);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    if (authManagerRef.current) {
      return authManagerRef.current.refreshNow();
    }
    return false;
  }, []);

  const redirectToPortal = useCallback((reason?: string) => {
    // Only redirect if portalUrl is configured
    if (!portalUrl) {
      console.warn('[AuthProvider] No portal URL configured, cannot redirect');
      return;
    }
    
    // Redirect to portal home page - the portal will handle re-auth if needed
    const portalHome = `${portalUrl}/home`;
    console.log('[AuthProvider] Redirecting to portal:', portalHome);
    window.location.href = portalHome;
  }, [portalUrl]);

  const logout = useCallback(async () => {
    // Clear local storage
    try {
      localStorage.removeItem('auth_token');
    } catch {
      // ignore
    }
    
    // Call logout endpoint
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // ignore
    }
    
    // Stop auth manager
    if (authManagerRef.current) {
      authManagerRef.current.stop();
    }
    
    // Redirect to portal home (or login)
    if (portalUrl) {
      window.location.href = `${portalUrl}/home`;
    }
  }, [portalUrl]);

  const isAuthenticated = authState?.isAuthenticated ?? false;

  return (
    <AuthContext.Provider value={{ 
      isReady, 
      isExchanging, 
      refreshKey, 
      authState,
      isAuthenticated,
      refreshToken,
      redirectToPortal,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Exchange token from URL - calls SSO endpoint to set cookies
 * 
 * IMPORTANT: Uses POST to /api/sso which returns JSON and sets cookies directly.
 * Do NOT use GET with redirect: 'manual' as browsers don't process Set-Cookie
 * headers from redirect responses when using manual redirect mode.
 */
async function exchangeToken(token: string): Promise<void> {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const ssoUrl = basePath ? `${basePath}/api/sso` : '/api/sso';

  // Call the SSO POST endpoint to validate the token and set cookies
  // Using POST because it returns JSON instead of redirecting
  const response = await fetch(ssoUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('[AuthProvider] SSO token exchange failed:', error);
    throw new Error(error.error || 'Token exchange failed');
  }

  console.log('[AuthProvider] SSO cookie exchange successful');

  // Also store in localStorage as backup for client-side requests
  try {
    localStorage.setItem('auth_token', token);
  } catch (e) {
    // Ignore localStorage errors
  }
}
