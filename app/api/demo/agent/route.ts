/**
 * ============================================
 * DEMO FILE - DELETE WHEN BUILDING REAL APP
 * ============================================
 * 
 * This file is part of the app-template demo.
 * Delete this entire file when starting your real app.
 * 
 * See DEMO.md for complete deletion checklist.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";

/**
 * POST /api/demo/agent
 * Demo endpoint that calls the agent-api to test token exchange
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "agent-api");
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required and must be a string" },
        { status: 400 }
      );
    }

    // Determine agent API URL
    const agentApiUrl =
      process.env.DEMO_AGENT_API_URL ||
      process.env.AGENT_API_URL ||
      "http://10.96.200.202:8000";

    const startTime = Date.now();

    // Call agent-api health endpoint as a simple test
    // In a real app, you'd call a specific agent endpoint
    const response = await fetch(`${agentApiUrl}/health`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${auth.apiToken}`,
        "Content-Type": "application/json",
      },
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          error: "Agent API call failed",
          status: response.status,
          message: errorText,
          duration,
        },
        { status: 502 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: `Successfully called agent-api with message: "${message}"`,
      agentResponse: data,
      duration,
      timestamp: new Date().toISOString(),
      agentApiUrl,
    });
  } catch (error) {
    console.error("[DEMO] Agent API call failed:", error);
    return NextResponse.json(
      {
        error: "Failed to call agent API",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
