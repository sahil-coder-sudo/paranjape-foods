/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output for Docker, default standard output for Vercel
  output: process.env.VERCEL ? undefined : 'standalone',
};

export default nextConfig;
