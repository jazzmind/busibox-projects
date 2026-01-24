export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Welcome to Busibox App Template
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
          A production-ready template with demo features for testing deployment
        </p>
      </div>

      {/* DEMO SECTION - DELETE WHEN BUILDING REAL APP */}
      <div className="mb-12 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h2 className="text-2xl font-semibold text-blue-900 dark:text-blue-300 mb-4">
          🎯 Demo Features Available
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          This template includes working demo features to test your deployment:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 mb-6">
          <li>
            <strong>SSO Authentication:</strong> Display authenticated user info from
            Busibox session
          </li>
          <li>
            <strong>Database CRUD:</strong> Create, read, update, and delete notes
            using Prisma
          </li>
          <li>
            <strong>Agent API Calls:</strong> Test Zero Trust token exchange with
            downstream services
          </li>
        </ul>
        <a
          href="/demo"
          className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Demo Features →
        </a>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          ⚠️ Remember to delete all demo features before building your production
          app. See{" "}
          <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">DEMO.md</code>{" "}
          for deletion instructions.
        </p>
      </div>
      {/* END DEMO SECTION */}

      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Getting Started
        </h2>
        <ul className="text-left text-gray-600 dark:text-gray-300 space-y-2">
          <li>
            1. Update{" "}
            <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">
              app/layout.tsx
            </code>{" "}
            with your app name
          </li>
          <li>
            2. Update{" "}
            <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">
              app/providers.tsx
            </code>{" "}
            with your branding
          </li>
          <li>
            3. Add your routes in the{" "}
            <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">
              app/
            </code>{" "}
            directory
          </li>
          <li>
            4. Add navigation links in{" "}
            <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">
              app/app-shell.tsx
            </code>
          </li>
          <li>
            5. Configure your environment in{" "}
            <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">
              .env.local
            </code>
          </li>
          <li>
            6. <strong>Delete demo features</strong> using{" "}
            <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">
              DEMO.md
            </code>{" "}
            checklist
          </li>
        </ul>
      </div>
    </div>
  );
}
