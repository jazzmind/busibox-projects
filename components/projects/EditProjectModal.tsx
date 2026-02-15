'use client';

/**
 * EditProjectModal - Modal for editing project details including owner assignment.
 */

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { UserPicker, type UserProfile } from '@jazzmind/busibox-app';
import type { Project, ProjectStatus, UpdateProjectInput } from '@/lib/types';

interface EditProjectModalProps {
  project: Project;
  users: UserProfile[];
  onClose: () => void;
  onSave: (updates: UpdateProjectInput) => Promise<void>;
}

export function EditProjectModal({ project, users, onClose, onSave }: EditProjectModalProps) {
  const [form, setForm] = useState({
    name: project.name,
    description: project.description || '',
    status: project.status as ProjectStatus,
    progress: project.progress,
    owner: project.owner || '',
    nextCheckpoint: project.nextCheckpoint || '',
    checkpointDate: project.checkpointDate ? project.checkpointDate.split('T')[0] : '',
    checkpointProgress: project.checkpointProgress,
    tags: (project.tags || []).join(', '),
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setIsSaving(true);
    try {
      const updates: UpdateProjectInput = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        status: form.status,
        progress: form.progress,
        owner: form.owner || undefined,
        nextCheckpoint: form.nextCheckpoint.trim() || undefined,
        checkpointDate: form.checkpointDate || undefined,
        checkpointProgress: form.checkpointProgress,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };
      await onSave(updates);
      onClose();
    } catch (err) {
      console.error('[EditProjectModal] Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Edit Project
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label
                htmlFor="edit-project-name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Project Name *
              </label>
              <input
                id="edit-project-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="edit-project-description"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Description
              </label>
              <textarea
                id="edit-project-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of the project..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Status + Progress row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="edit-project-status"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Status
                </label>
                <select
                  id="edit-project-status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="on-track">On Track</option>
                  <option value="at-risk">At Risk</option>
                  <option value="off-track">Off Track</option>
                  <option value="completed">Completed</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="edit-project-progress"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Progress ({form.progress}%)
                </label>
                <input
                  id="edit-project-progress"
                  type="range"
                  min={0}
                  max={100}
                  value={form.progress}
                  onChange={(e) => setForm({ ...form, progress: parseInt(e.target.value) })}
                  className="w-full mt-2"
                />
              </div>
            </div>

            {/* Owner */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Owner
              </label>
              <UserPicker
                users={users}
                value={form.owner || undefined}
                placeholder="Assign owner"
                onChange={(userId) => setForm({ ...form, owner: userId || '' })}
              />
            </div>

            {/* Checkpoint */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="edit-project-checkpoint"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Next Checkpoint
                </label>
                <input
                  id="edit-project-checkpoint"
                  type="text"
                  value={form.nextCheckpoint}
                  onChange={(e) => setForm({ ...form, nextCheckpoint: e.target.value })}
                  placeholder="e.g., MVP Release"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-project-checkpoint-date"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Checkpoint Date
                </label>
                <input
                  id="edit-project-checkpoint-date"
                  type="date"
                  value={form.checkpointDate}
                  onChange={(e) => setForm({ ...form, checkpointDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Checkpoint Progress */}
            <div>
              <label
                htmlFor="edit-project-checkpoint-progress"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Checkpoint Progress ({form.checkpointProgress}%)
              </label>
              <input
                id="edit-project-checkpoint-progress"
                type="range"
                min={0}
                max={100}
                value={form.checkpointProgress}
                onChange={(e) => setForm({ ...form, checkpointProgress: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Tags */}
            <div>
              <label
                htmlFor="edit-project-tags"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Tags (comma-separated)
              </label>
              <input
                id="edit-project-tags"
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="e.g., ai, automation, priority"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!form.name.trim() || isSaving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
