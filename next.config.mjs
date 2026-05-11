/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable x-powered-by header for slight performance gain
  poweredByHeader: false,
  
  // Enable compression
  compress: true,
  
  // Disable source maps in production for smaller builds
  productionBrowserSourceMaps: false,
  
  // Optimize images
  images: {
    formats: ['image/webp'],
    minimumCacheTTL: 60,
  },
  
  // Experimental features for better performance
  experimental: {
    // Optimize package imports for faster builds
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      '@radix-ui/react-icons',
    ],
    // Turbopack for faster builds
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  
  // Trailing slash for better SEO and caching
  trailingSlash: true,
  
  // Headers for caching on Vercel
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|png|woff|woff2)',
        locale: false,
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
