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
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /api/demo/notes
 * List all notes for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthWithTokenExchange(request);
    if (auth instanceof NextResponse) return auth;

    // Extract userId from SSO token
    // In production, decode the JWT to get the actual user ID
    // For now, we'll use a test user ID or extract from the token
    const userId = process.env.TEST_USER_ID || "test-user-id";

    const notes = await prisma.demoNote.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      notes,
      count: notes.length,
    });
  } catch (error) {
    console.error("[DEMO] Failed to fetch notes:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch notes",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/demo/notes
 * Create a new note
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthWithTokenExchange(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { title, content } = body;

    // Validation
    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Title is required and must be a string" },
        { status: 400 }
      );
    }

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required and must be a string" },
        { status: 400 }
      );
    }

    // Extract userId from SSO token
    const userId = process.env.TEST_USER_ID || "test-user-id";

    const note = await prisma.demoNote.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        userId,
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("[DEMO] Failed to create note:", error);
    return NextResponse.json(
      {
        error: "Failed to create note",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
