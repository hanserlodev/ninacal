import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static: `npm run build` writes a deployable folder to `out/`.
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
