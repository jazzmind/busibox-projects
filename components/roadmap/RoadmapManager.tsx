'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Pencil, GripVertical, Save, X, Loader2, Layers } from 'lucide-react';
import type { Roadmap, CreateRoadmapInput, UpdateRoadmapInput } from '@/lib/types';

const DEFAULT_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#f97316', '#6366f1', '#14b8a6', '#e11d48',
];

export function RoadmapManager() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<CreateRoadmapInput>({
    name: '',
    description: '',
    color: DEFAULT_COLORS[0],
  });

  const fetchRoadmaps = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${basePath}/api/roadmaps`);
      if (!res.ok) throw new Error('Failed to fetch roadmaps');
      const data = await res.json();
      setRoadmaps(data.roadmaps || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roadmaps');
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    fetchRoadmaps();
  }, [fetchRoadmaps]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`${basePath}/api/roadmaps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to create roadmap');
      const created = await res.json();
      setRoadmaps((prev) => [...prev, created]);
      setShowCreate(false);
      setForm({ name: '', description: '', color: DEFAULT_COLORS[(roadmaps.length + 1) % DEFAULT_COLORS.length] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create roadmap');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string, updates: UpdateRoadmapInput) => {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`${basePath}/api/roadmaps/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update roadmap');
      const updated = await res.json();
      setRoadmaps((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update roadmap');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this roadmap? Projects will be unlinked but not deleted.')) return;
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`${basePath}/api/roadmaps/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete roadmap');
      setRoadmaps((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete roadmap');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-gray-500 dark:text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading roadmaps...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Existing roadmaps */}
      {roadmaps.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <Layers className="w-8 h-8 mx-auto text-gray-400 dark:text-gray-600 mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No roadmaps yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Create one to start organizing your projects</p>
        </div>
      ) : (
        <div className="space-y-2">
          {roadmaps.map((rm) => (
            <RoadmapRow
              key={rm.id}
              roadmap={rm}
              isEditing={editingId === rm.id}
              saving={saving}
              onEdit={() => setEditingId(rm.id)}
              onCancel={() => setEditingId(null)}
              onSave={(updates) => handleUpdate(rm.id, updates)}
              onDelete={() => handleDelete(rm.id)}
            />
          ))}
        </div>
      )}

      {/* Create new roadmap */}
      {showCreate ? (
        <div className="border border-blue-300 dark:border-blue-700 rounded-lg p-4 bg-blue-50/50 dark:bg-blue-900/10">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer border-0"
              />
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Roadmap name"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <textarea
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description (optional)"
              rows={2}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreate(false);
                  setForm({ name: '', description: '', color: DEFAULT_COLORS[roadmaps.length % DEFAULT_COLORS.length] });
                }}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.name.trim() || saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            setShowCreate(true);
            setForm({ name: '', description: '', color: DEFAULT_COLORS[roadmaps.length % DEFAULT_COLORS.length] });
          }}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors w-full justify-center border border-dashed border-blue-300 dark:border-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Roadmap
        </button>
      )}
    </div>
  );
}

// =============================================================================
// RoadmapRow
// =============================================================================

interface RoadmapRowProps {
  roadmap: Roadmap;
  isEditing: boolean;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (updates: UpdateRoadmapInput) => void;
  onDelete: () => void;
}

function RoadmapRow({ roadmap, isEditing, saving, onEdit, onCancel, onSave, onDelete }: RoadmapRowProps) {
  const [editForm, setEditForm] = useState({
    name: roadmap.name,
    description: roadmap.description || '',
    color: roadmap.color,
  });

  useEffect(() => {
    setEditForm({
      name: roadmap.name,
      description: roadmap.description || '',
      color: roadmap.color,
    });
  }, [roadmap, isEditing]);

  if (isEditing) {
    return (
      <div className="border border-blue-300 dark:border-blue-700 rounded-lg p-3 bg-blue-50/50 dark:bg-blue-900/10">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={editForm.color}
              onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer border-0"
            />
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <textarea
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            placeholder="Description"
            rows={2}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(editForm)}
              disabled={!editForm.name.trim() || saving}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
      <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
      <div
        className="w-4 h-4 rounded-full flex-shrink-0"
        style={{ backgroundColor: roadmap.color }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {roadmap.name}
        </p>
        {roadmap.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {roadmap.description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
