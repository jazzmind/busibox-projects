/**
 * Admin Graph Sync API Route
 * 
 * POST: Re-sync all status-report data documents to the graph database (Neo4j).
 * 
 * This first ensures each document's schema is up-to-date (including graphNode
 * and graphRelationships fields), then triggers graph-sync for each document
 * so that Neo4j nodes and relationships are created/updated.
 * 
 * Useful for:
 * - Populating the graph with pre-existing records
 * - Recovering from graph database issues
 * - Re-syncing after schema changes
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import {
  ensureDataDocuments,
  projectSchema,
  taskSchema,
  updateSchema,
} from '@/lib/data-api-client';

const DATA_API_URL = process.env.DATA_API_URL || 'http://localhost:8002';

interface SyncResult {
  document: string;
  documentId: string;
  graphNode: string;
  recordCount: number;
  syncedCount: number;
  schemaUpdated: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    // Get document IDs (ensures they exist)
    const documentIds = await ensureDataDocuments(auth.apiToken);

    const documents = [
      { key: 'projects', id: documentIds.projects, label: 'Projects', schema: projectSchema },
      { key: 'tasks', id: documentIds.tasks, label: 'Tasks', schema: taskSchema },
      { key: 'updates', id: documentIds.updates, label: 'Updates', schema: updateSchema },
    ];

    const results: SyncResult[] = [];

    for (const doc of documents) {
      try {
        // Step 1: Force-update the schema to include graphNode/graphRelationships
        // This is needed for documents created before graph fields were added
        let schemaUpdated = false;
        try {
          const schemaResponse = await fetch(
            `${DATA_API_URL}/data/${doc.id}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${auth.apiToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                metadata: { sourceApp: 'status-report' },
                schema: doc.schema,
              }),
            }
          );

          if (schemaResponse.ok) {
            schemaUpdated = true;
          } else {
            const errText = await schemaResponse.text();
            console.warn(`[Admin/graph-sync] Schema update for ${doc.label} returned ${schemaResponse.status}: ${errText}`);
          }
        } catch (schemaErr) {
          console.warn(`[Admin/graph-sync] Schema update failed for ${doc.label}:`, schemaErr);
        }

        // Step 2: Trigger graph sync
        const response = await fetch(
          `${DATA_API_URL}/data/${doc.id}/graph-sync`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${auth.apiToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Admin/graph-sync] Failed to sync ${doc.label}:`, response.status, errorText);
          results.push({
            document: doc.label,
            documentId: doc.id,
            graphNode: doc.schema.graphNode || '',
            recordCount: 0,
            syncedCount: 0,
            schemaUpdated,
            error: `HTTP ${response.status}: ${errorText}`,
          });
          continue;
        }

        const data = await response.json();
        results.push({
          document: doc.label,
          documentId: doc.id,
          graphNode: data.graphNode || '',
          recordCount: data.recordCount || 0,
          syncedCount: data.syncedCount || 0,
          schemaUpdated,
        });
      } catch (err) {
        console.error(`[Admin/graph-sync] Error syncing ${doc.label}:`, err);
        results.push({
          document: doc.label,
          documentId: doc.id,
          graphNode: doc.schema.graphNode || '',
          recordCount: 0,
          syncedCount: 0,
          schemaUpdated: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const totalSynced = results.reduce((sum, r) => sum + r.syncedCount, 0);
    const totalRecords = results.reduce((sum, r) => sum + r.recordCount, 0);
    const hasErrors = results.some(r => r.error);

    return NextResponse.json({
      success: !hasErrors,
      message: hasErrors
        ? `Synced ${totalSynced} of ${totalRecords} records (some errors occurred)`
        : `Successfully synced ${totalSynced} records across ${results.length} documents to graph database`,
      results,
      totalRecords,
      totalSynced,
    });
  } catch (error) {
    console.error('[Admin/graph-sync] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync graph data', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
