/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Allow server actions from both local dev and production domains
      allowedOrigins: [
        'localhost:3000',
        // Vercel preview and production URLs are allowed by default
        // Add your custom domain here if you have one, e.g.:
        // 'app.yourdomain.com',
      ],
    },
  },
  transpilePackages: ['@repo/shared'],
  // Ensure Next.js can reach the Railway API at build time if needed
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
