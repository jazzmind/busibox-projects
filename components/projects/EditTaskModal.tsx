'use client';

/**
 * EditTaskModal - Modal for editing task details including assignee.
 */

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { UserPicker, type UserProfile } from '@jazzmind/busibox-app';
import type { Task, TaskStatus, TaskPriority, UpdateTaskInput } from '@/lib/types';

interface EditTaskModalProps {
  task: Task;
  users: UserProfile[];
  onClose: () => void;
  onSave: (taskId: string, updates: UpdateTaskInput) => Promise<void>;
}

export function EditTaskModal({ task, users, onClose, onSave }: EditTaskModalProps) {
  const [form, setForm] = useState({
    title: task.title,
    description: task.description || '',
    status: task.status as TaskStatus,
    assignee: task.assignee || '',
    priority: task.priority as TaskPriority,
    dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setIsSaving(true);
    try {
      const updates: UpdateTaskInput = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        status: form.status,
        assignee: form.assignee || undefined,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
      };
      await onSave(task.id, updates);
      onClose();
    } catch (err) {
      console.error('[EditTaskModal] Save failed:', err);
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
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Edit Task
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
            {/* Title */}
            <div>
              <label
                htmlFor="edit-task-title"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Task Title *
              </label>
              <input
                id="edit-task-title"
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="edit-task-description"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Description
              </label>
              <textarea
                id="edit-task-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Task details..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Status + Priority row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="edit-task-status"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Status
                </label>
                <select
                  id="edit-task-status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="edit-task-priority"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Priority
                </label>
                <select
                  id="edit-task-priority"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            {/* Assignee */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Assignee
              </label>
              <UserPicker
                users={users}
                value={form.assignee || undefined}
                placeholder="Assign to..."
                onChange={(userId) => setForm({ ...form, assignee: userId || '' })}
              />
            </div>

            {/* Due Date */}
            <div>
              <label
                htmlFor="edit-task-due-date"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Due Date
              </label>
              <input
                id="edit-task-due-date"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              disabled={!form.title.trim() || isSaving}
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
