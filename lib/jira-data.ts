/**
 * Data-document helpers for JIRA integration settings and mappings.
 */

import { generateId, getNow, insertRecords, queryRecords, updateRecords, deleteRecords } from '@jazzmind/busibox-app';
import type { JiraConfig, JiraSyncDirection, JiraSyncMapping, JiraTaskMapping } from '@/lib/types';

type JiraRecordType = 'config' | 'mapping' | 'task-mapping';

interface JiraConfigRecord extends JiraConfig {
  recordType: JiraRecordType;
}

interface JiraSyncMappingRecord extends JiraSyncMapping {
  recordType: JiraRecordType;
}

interface JiraTaskMappingRecord extends JiraTaskMapping {
  recordType: JiraRecordType;
}

const JIRA_CONFIG_ID = 'jira-config';

export function maskJiraApiToken(token: string): string {
  if (!token) return '';
  if (token.length <= 6) return '*'.repeat(token.length);
  return `${token.slice(0, 3)}${'*'.repeat(token.length - 6)}${token.slice(-3)}`;
}

export async function getJiraConfig(token: string, jiraDocumentId: string): Promise<JiraConfig | null> {
  const result = await queryRecords<JiraConfigRecord>(token, jiraDocumentId, {
    where: { field: 'recordType', op: 'eq', value: 'config' },
    limit: 1,
  });
  return result.records[0] || null;
}

export async function upsertJiraConfig(
  token: string,
  jiraDocumentId: string,
  input: Omit<JiraConfig, 'id' | 'updatedAt'>
): Promise<JiraConfig> {
  const existing = await getJiraConfig(token, jiraDocumentId);
  const payload: JiraConfigRecord = {
    id: JIRA_CONFIG_ID,
    recordType: 'config',
    jiraBaseUrl: input.jiraBaseUrl,
    jiraEmail: input.jiraEmail,
    jiraApiToken: input.jiraApiToken,
    webhookSecret: input.webhookSecret,
    webhookId: input.webhookId,
    connected: input.connected,
    updatedAt: getNow(),
  };

  if (existing) {
    await updateRecords(token, jiraDocumentId, payload as unknown as Record<string, unknown>, {
      field: 'id',
      op: 'eq',
      value: JIRA_CONFIG_ID,
    });
  } else {
    await insertRecords(token, jiraDocumentId, [payload as unknown as Record<string, unknown>]);
  }

  return payload;
}

export async function getJiraSyncMappings(
  token: string,
  jiraDocumentId: string,
  projectId?: string
): Promise<JiraSyncMapping[]> {
  const where = projectId
    ? {
        and: [
          { field: 'recordType', op: 'eq' as const, value: 'mapping' },
          { field: 'projectId', op: 'eq' as const, value: projectId },
        ],
      }
    : { field: 'recordType', op: 'eq' as const, value: 'mapping' };

  const result = await queryRecords<JiraSyncMappingRecord>(token, jiraDocumentId, {
    where,
    limit: 500,
  });
  return result.records;
}

export async function getJiraSyncMappingByProjectId(
  token: string,
  jiraDocumentId: string,
  projectId: string
): Promise<JiraSyncMapping | null> {
  const result = await queryRecords<JiraSyncMappingRecord>(token, jiraDocumentId, {
    where: {
      and: [
        { field: 'recordType', op: 'eq', value: 'mapping' },
        { field: 'projectId', op: 'eq', value: projectId },
      ],
    },
    limit: 1,
  });
  return result.records[0] || null;
}

export async function getJiraSyncMappingByEpicKey(
  token: string,
  jiraDocumentId: string,
  jiraEpicKey: string
): Promise<JiraSyncMapping | null> {
  const result = await queryRecords<JiraSyncMappingRecord>(token, jiraDocumentId, {
    where: {
      and: [
        { field: 'recordType', op: 'eq', value: 'mapping' },
        { field: 'jiraEpicKey', op: 'eq', value: jiraEpicKey },
      ],
    },
    limit: 1,
  });
  return result.records[0] || null;
}

export async function upsertJiraSyncMapping(
  token: string,
  jiraDocumentId: string,
  input: {
    id?: string;
    projectId: string;
    jiraProjectKey: string;
    jiraEpicKey: string;
    jiraEpicIssueId?: string;
    syncEnabled?: boolean;
    syncDirection?: JiraSyncDirection;
    lastSyncAt?: string;
    lastBusiboxUpdatedAt?: string;
    lastJiraUpdatedAt?: string;
  }
): Promise<JiraSyncMapping> {
  const existing = await getJiraSyncMappingByProjectId(token, jiraDocumentId, input.projectId);
  const payload: JiraSyncMappingRecord = {
    id: existing?.id || input.id || generateId(),
    recordType: 'mapping',
    projectId: input.projectId,
    jiraProjectKey: input.jiraProjectKey,
    jiraEpicKey: input.jiraEpicKey,
    jiraEpicIssueId: input.jiraEpicIssueId,
    syncEnabled: input.syncEnabled ?? true,
    syncDirection: input.syncDirection ?? 'both',
    lastSyncAt: input.lastSyncAt ?? existing?.lastSyncAt,
    lastBusiboxUpdatedAt: input.lastBusiboxUpdatedAt ?? existing?.lastBusiboxUpdatedAt,
    lastJiraUpdatedAt: input.lastJiraUpdatedAt ?? existing?.lastJiraUpdatedAt,
    updatedAt: getNow(),
  };

  if (existing) {
    await updateRecords(token, jiraDocumentId, payload as unknown as Record<string, unknown>, {
      field: 'id',
      op: 'eq',
      value: existing.id,
    });
  } else {
    await insertRecords(token, jiraDocumentId, [payload as unknown as Record<string, unknown>]);
  }

  return payload;
}

export async function deleteJiraSyncMapping(
  token: string,
  jiraDocumentId: string,
  projectId: string
): Promise<boolean> {
  const result = await deleteRecords(token, jiraDocumentId, {
    and: [
      { field: 'recordType', op: 'eq', value: 'mapping' },
      { field: 'projectId', op: 'eq', value: projectId },
    ],
  });
  return result.count > 0;
}

export async function getJiraTaskMappings(
  token: string,
  jiraDocumentId: string,
  projectId?: string
): Promise<JiraTaskMapping[]> {
  const where = projectId
    ? {
        and: [
          { field: 'recordType', op: 'eq' as const, value: 'task-mapping' },
          { field: 'projectId', op: 'eq' as const, value: projectId },
        ],
      }
    : { field: 'recordType', op: 'eq' as const, value: 'task-mapping' };

  const result = await queryRecords<JiraTaskMappingRecord>(token, jiraDocumentId, {
    where,
    limit: 1000,
  });
  return result.records;
}

export async function getJiraTaskMappingByTaskId(
  token: string,
  jiraDocumentId: string,
  taskId: string
): Promise<JiraTaskMapping | null> {
  const result = await queryRecords<JiraTaskMappingRecord>(token, jiraDocumentId, {
    where: {
      and: [
        { field: 'recordType', op: 'eq', value: 'task-mapping' },
        { field: 'taskId', op: 'eq', value: taskId },
      ],
    },
    limit: 1,
  });
  return result.records[0] || null;
}

export async function getJiraTaskMappingByIssueKey(
  token: string,
  jiraDocumentId: string,
  jiraIssueKey: string
): Promise<JiraTaskMapping | null> {
  const result = await queryRecords<JiraTaskMappingRecord>(token, jiraDocumentId, {
    where: {
      and: [
        { field: 'recordType', op: 'eq', value: 'task-mapping' },
        { field: 'jiraIssueKey', op: 'eq', value: jiraIssueKey },
      ],
    },
    limit: 1,
  });
  return result.records[0] || null;
}

export async function upsertJiraTaskMapping(
  token: string,
  jiraDocumentId: string,
  input: {
    id?: string;
    projectId: string;
    taskId: string;
    jiraIssueKey: string;
    jiraIssueId?: string;
    syncEnabled?: boolean;
    lastSyncAt?: string;
    lastBusiboxUpdatedAt?: string;
    lastJiraUpdatedAt?: string;
  }
): Promise<JiraTaskMapping> {
  const existing = await getJiraTaskMappingByTaskId(token, jiraDocumentId, input.taskId);
  const payload: JiraTaskMappingRecord = {
    id: existing?.id || input.id || generateId(),
    recordType: 'task-mapping',
    projectId: input.projectId,
    taskId: input.taskId,
    jiraIssueKey: input.jiraIssueKey,
    jiraIssueId: input.jiraIssueId,
    syncEnabled: input.syncEnabled ?? true,
    lastSyncAt: input.lastSyncAt ?? existing?.lastSyncAt,
    lastBusiboxUpdatedAt: input.lastBusiboxUpdatedAt ?? existing?.lastBusiboxUpdatedAt,
    lastJiraUpdatedAt: input.lastJiraUpdatedAt ?? existing?.lastJiraUpdatedAt,
    updatedAt: getNow(),
  };

  if (existing) {
    await updateRecords(token, jiraDocumentId, payload as unknown as Record<string, unknown>, {
      field: 'id',
      op: 'eq',
      value: existing.id,
    });
  } else {
    await insertRecords(token, jiraDocumentId, [payload as unknown as Record<string, unknown>]);
  }

  return payload;
}
