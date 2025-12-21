/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },
  async redirects() {
    return [
      {
        source: "/bridge",
        destination: "/?tab=bridge",
        permanent: true, // 301 redirect
      },
    ]
  },
  transpilePackages: [
    "@ant-design",
    "antd",
    "rc-input",
    "rc-pagination",
    "rc-picker",
    "rc-table",
    "rc-tree",
    "rc-util",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
}

export default nextConfig
