/**
 * Agent API Client utilities
 * 
 * Provides helper functions for connecting to the agent-api service.
 * Based on agent-manager's implementation.
 */

/**
 * Get the agent API URL based on environment.
 * 
 * Server-side: Uses internal container URL (AGENT_API_URL or fallback)
 * Client-side: Should use Next.js API routes (/api/agent)
 * 
 * NOTE: Must be called at runtime, not module init, to get correct env vars
 */
export function getAgentApiUrl(): string {
  // Server-side: use internal URL (HTTP to avoid TLS issues with nginx)
  if (typeof window === 'undefined') {
    // Priority: AGENT_API_URL > AGENT_API_HOST:PORT > default
    const url = process.env.AGENT_API_URL;
    if (url) {
      if (process.env.VERBOSE_AUTHZ_LOGGING === 'true') {
        console.log(`[AGENT-API] Using AGENT_API_URL: ${url}`);
      }
      return url;
    }
    
    const host = process.env.AGENT_API_HOST;
    const port = process.env.AGENT_API_PORT || '8000';
    if (host) {
      const hostUrl = `http://${host}:${port}`;
      if (process.env.VERBOSE_AUTHZ_LOGGING === 'true') {
        console.log(`[AGENT-API] Using AGENT_API_HOST:PORT: ${hostUrl}`);
      }
      return hostUrl;
    }
    
    // Fallback to Docker service name (works in Docker network)
    if (process.env.VERBOSE_AUTHZ_LOGGING === 'true') {
      console.log(`[AGENT-API] Using default: http://agent-api:8000`);
    }
    return 'http://agent-api:8000';
  }
  
  // Client-side: This shouldn't be called directly from browser
  // All client requests should go through Next.js API routes
  console.warn('[AGENT-API] Client-side call detected - should use Next.js API routes instead');
  return '/api/agent';
}
