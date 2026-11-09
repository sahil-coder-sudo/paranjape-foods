import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In local monorepo development, load root .env.local if present
const parentEnv = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(parentEnv)) {
  const content = fs.readFileSync(parentEnv, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output for Docker, default standard output for Vercel
  output: process.env.VERCEL ? undefined : 'standalone',
  env: {
    NEXT_PUBLIC_RAZORPAY_KEY_ID:
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
      process.env.NEXT_RAZORPAY_KEY_ID ||
      process.env.RAZORPAY_KEY_ID,
    NEXT_RAZORPAY_KEY_ID:
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
      process.env.NEXT_RAZORPAY_KEY_ID ||
      process.env.RAZORPAY_KEY_ID,
  },
};

export default nextConfig;
