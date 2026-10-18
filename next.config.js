/** @type {import('next').NextConfig} */
export default {
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; img-src 'self' data: https:; media-src https: data:; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' https:;" },
        ],
      },
    ];
  },
};

