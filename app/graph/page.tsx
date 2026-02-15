/**
 * Graph Visualization Page
 * 
 * Interactive force-directed graph showing relationships between
 * projects, tasks, and status updates. Nodes are color-coded by
 * status and sized by type (projects largest, tasks medium, updates small).
 */

import { ProjectGraph } from '@/components/projects/ProjectGraph';

export default function GraphPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Project Graph
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Visualize relationships between projects, tasks, and status updates.
          Projects are color-coded by status, tasks by their completion state.
        </p>
      </div>
      <ProjectGraph />
    </div>
  );
}
