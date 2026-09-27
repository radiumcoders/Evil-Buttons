import { createMDX } from "fumadocs-mdx/next";

/** @type {import("next").NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // PillButton was replaced by RealisticSwitch before launch.
      {
        source: "/docs/pill-button",
        destination: "/docs/realistic-switch",
        permanent: true,
      },
    ];
  },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
