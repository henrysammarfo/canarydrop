/** @type {import('next').NextConfig} */
const isStatic = process.env.STATIC_EXPORT === '1';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const config = {
  poweredByHeader: false,
  transpilePackages: ['geist'],
  generateBuildId: async () =>
    process.env.NEXT_PUBLIC_BUILD_ID || process.env.SOURCE_DATE_EPOCH || 'canarydrop-v7',
  ...(isStatic
    ? {
        output: 'export',
        trailingSlash: true,
        images: { unoptimized: true },
        ...(basePath ? { basePath, assetPrefix: basePath } : {}),
      }
    : {}),
  headers: async () => {
    if (isStatic) return [];
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default config;
