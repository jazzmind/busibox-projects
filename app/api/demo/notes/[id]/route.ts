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
 * GET /api/demo/notes/[id]
 * Get a single note by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuthWithTokenExchange(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = params;
    const userId = process.env.TEST_USER_ID || "test-user-id";

    const note = await prisma.demoNote.findUnique({
      where: { id },
    });

    if (!note) {
      return NextResponse.json(
        { error: "Note not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (note.userId !== userId) {
      return NextResponse.json(
        { error: "Not authorized to access this note" },
        { status: 403 }
      );
    }

    return NextResponse.json(note);
  } catch (error) {
    console.error("[DEMO] Failed to fetch note:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch note",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/demo/notes/[id]
 * Update a note
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuthWithTokenExchange(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = params;
    const body = await request.json();
    const { title, content } = body;
    const userId = process.env.TEST_USER_ID || "test-user-id";

    // Check if note exists and verify ownership
    const existingNote = await prisma.demoNote.findUnique({
      where: { id },
    });

    if (!existingNote) {
      return NextResponse.json(
        { error: "Note not found" },
        { status: 404 }
      );
    }

    if (existingNote.userId !== userId) {
      return NextResponse.json(
        { error: "Not authorized to update this note" },
        { status: 403 }
      );
    }

    // Prepare update data
    const updateData: { title?: string; content?: string } = {};
    
    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return NextResponse.json(
          { error: "Title must be a non-empty string" },
          { status: 400 }
        );
      }
      updateData.title = title.trim();
    }

    if (content !== undefined) {
      if (typeof content !== "string" || !content.trim()) {
        return NextResponse.json(
          { error: "Content must be a non-empty string" },
          { status: 400 }
        );
      }
      updateData.content = content.trim();
    }

    const note = await prisma.demoNote.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(note);
  } catch (error) {
    console.error("[DEMO] Failed to update note:", error);
    return NextResponse.json(
      {
        error: "Failed to update note",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/demo/notes/[id]
 * Delete a note
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuthWithTokenExchange(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = params;
    const userId = process.env.TEST_USER_ID || "test-user-id";

    // Check if note exists and verify ownership
    const existingNote = await prisma.demoNote.findUnique({
      where: { id },
    });

    if (!existingNote) {
      return NextResponse.json(
        { error: "Note not found" },
        { status: 404 }
      );
    }

    if (existingNote.userId !== userId) {
      return NextResponse.json(
        { error: "Not authorized to delete this note" },
        { status: 403 }
      );
    }

    await prisma.demoNote.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[DEMO] Failed to delete note:", error);
    return NextResponse.json(
      {
        error: "Failed to delete note",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
