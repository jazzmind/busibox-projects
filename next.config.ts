import type { NextConfig } from "next";

const outputMode = process.env.BUSIBOX_NEXT_OUTPUT;

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },

  experimental: {
    // Allow resolving npm-linked workspace packages outside this repo root.
    externalDir: true,
    esmExternals: true,
  },

  pageExtensions: ["tsx", "ts", "jsx", "js"],

  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || "",
  trailingSlash: false,

  // Transpile busibox-app (handles symlinked package)
  transpilePackages: ["@jazzmind/busibox-app"],

  // Default to "standard" output since Busibox deploys full source + node_modules
  // into the container. Keep standalone as an opt-in for projects that want it:
  //   BUSIBOX_NEXT_OUTPUT=standalone npm run build
  ...(outputMode === "standalone" ? { output: "standalone" } : {}),
};

export default nextConfig;
