'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import type { MergeProjectsResult, Project } from '@/lib/types';

interface MergeProjectsModalProps {
  projects: Project[];
  basePath: string;
  onClose: () => void;
  onMerged: (result: MergeProjectsResult) => void;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function similarityScore(a: Project, b: Project): number {
  const nameA = normalizeText(a.name);
  const nameB = normalizeText(b.name);
  const tokensA = new Set(nameA.split(' ').filter(Boolean));
  const tokensB = new Set(nameB.split(' ').filter(Boolean));
  const sharedTokens = [...tokensA].filter((t) => tokensB.has(t)).length;
  const tokenScore = sharedTokens / Math.max(tokensA.size, tokensB.size, 1);

  const tagsA = new Set((a.tags || []).map((t) => t.toLowerCase()));
  const tagsB = new Set((b.tags || []).map((t) => t.toLowerCase()));
  const sharedTags = [...tagsA].filter((t) => tagsB.has(t)).length;
  const tagScore = sharedTags / Math.max(tagsA.size, tagsB.size, 1);

  const containsBonus = nameA && nameB && (nameA.includes(nameB) || nameB.includes(nameA)) ? 0.25 : 0;
  return tokenScore * 0.6 + tagScore * 0.3 + containsBonus;
}

export function MergeProjectsModal({ projects, basePath, onClose, onMerged }: MergeProjectsModalProps) {
  const [targetProjectId, setTargetProjectId] = useState<string>('');
  const [sourceProjectIds, setSourceProjectIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    for (const project of projects) map.set(project.id, project);
    return map;
  }, [projects]);

  const selectableSources = useMemo(
    () => projects.filter((project) => project.id !== targetProjectId),
    [projects, targetProjectId]
  );

  const suggestedSimilarIds = useMemo(() => {
    if (!targetProjectId) return new Set<string>();
    const target = projectMap.get(targetProjectId);
    if (!target) return new Set<string>();

    const scored = selectableSources
      .map((project) => ({ id: project.id, score: similarityScore(target, project) }))
      .filter((item) => item.score >= 0.45)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return new Set(scored.map((item) => item.id));
  }, [targetProjectId, projectMap, selectableSources]);

  const canSubmit = targetProjectId && sourceProjectIds.length > 0 && !submitting;

  const toggleSource = (projectId: string) => {
    setSourceProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId]
    );
  };

  const handleMerge = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${basePath}/api/projects/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetProjectId, sourceProjectIds }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.details || errorData?.message || errorData?.error || `Merge failed (${response.status})`
        );
      }

      const result = (await response.json()) as MergeProjectsResult;
      setSuccess(
        `Merged ${result.mergedSourceProjectIds.length} project(s). Moved ${result.movedTasks} task(s) and ${result.movedUpdates} update(s).`
      );
      onMerged(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge projects');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

        <div className="relative w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Merge Duplicate/Similar Projects</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Choose one target project to keep, then select source projects to merge into it.
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200">
              <X className="h-5 w-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
              <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="merge-target" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Target Project (kept)
              </label>
              <select
                id="merge-target"
                value={targetProjectId}
                onChange={(event) => {
                  const nextTarget = event.target.value;
                  setTargetProjectId(nextTarget);
                  setSourceProjectIds((current) => current.filter((id) => id !== nextTarget));
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select a target project...</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <span>Source Projects (deleted after merge)</span>
                {targetProjectId && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Similar options are highlighted
                  </span>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                {selectableSources.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No source projects available.</div>
                ) : (
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {selectableSources.map((project) => {
                      const checked = sourceProjectIds.includes(project.id);
                      const suggested = suggestedSimilarIds.has(project.id);
                      return (
                        <li key={project.id} className="flex items-center justify-between px-4 py-3">
                          <label className="flex items-center gap-3 text-sm text-gray-800 dark:text-gray-200">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSource(project.id)}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>{project.name}</span>
                          </label>
                          {suggested && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              Similar
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Tasks and status updates are moved to the target project, then source projects are deleted.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleMerge}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? 'Merging...' : 'Merge Projects'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
