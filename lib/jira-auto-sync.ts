import { ensureDataDocuments, getProject, listTasks } from '@/lib/data-api-client';
import { getJiraConfig, getJiraSyncMappingByProjectId, upsertJiraSyncMapping } from '@/lib/jira-data';
import { fullSync } from '@/lib/jira-sync';
import type { Project } from '@/lib/types';

export async function syncProjectToJiraIfMapped(
  token: string,
  projectId: string
): Promise<{ synced: boolean; reason?: string }> {
  const documentIds = await ensureDataDocuments(token);
  const [project, config, mapping] = await Promise.all([
    getProject(token, documentIds.projects, projectId),
    getJiraConfig(token, documentIds.jira),
    getJiraSyncMappingByProjectId(token, documentIds.jira, projectId),
  ]);

  if (!project) return { synced: false, reason: 'project_not_found' };
  if (!config?.connected) return { synced: false, reason: 'jira_not_connected' };

  let activeMapping = mapping;
  if (!activeMapping && project.jiraSyncEnabled && project.jiraProjectKey) {
    activeMapping = await upsertJiraSyncMapping(token, documentIds.jira, {
      projectId: project.id,
      jiraProjectKey: project.jiraProjectKey,
      jiraEpicKey: project.jiraEpicKey || '',
      syncEnabled: true,
      syncDirection: 'both',
    });
  }

  if (!activeMapping || !activeMapping.syncEnabled) {
    return { synced: false, reason: 'mapping_not_enabled' };
  }

  if (!activeMapping.jiraEpicKey) {
    const tasks = await listTasks(token, documentIds.tasks, { projectId: project.id, limit: 1000 });
    const updatedMapping = await fullSync(token, config, activeMapping, documentIds, 'push');
    return { synced: true, reason: `synced_${updatedMapping.tasksSynced}_tasks` };
  }

  await fullSync(token, config, activeMapping, documentIds, 'push');
  return { synced: true };
}

export async function maybeCreateMappingFromProject(
  token: string,
  project: Project
): Promise<void> {
  if (!project.jiraSyncEnabled || !project.jiraProjectKey) return;
  const documentIds = await ensureDataDocuments(token);
  await upsertJiraSyncMapping(token, documentIds.jira, {
    projectId: project.id,
    jiraProjectKey: project.jiraProjectKey,
    jiraEpicKey: project.jiraEpicKey || '',
    syncEnabled: true,
    syncDirection: 'both',
  });
}
