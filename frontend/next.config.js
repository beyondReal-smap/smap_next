/** @type {import('next').NextConfig} */
const nextConfig = {
  // React 최적화
  reactStrictMode: true, // 프로덕션 최적화를 위해 활성화
  
  // 출력 최적화
  output: process.env.VERCEL ? undefined : (process.env.NODE_ENV === 'production' ? 'standalone' : undefined),
  
  // 실험적 기능들
  experimental: {
    // 번들 분석 최적화
    optimizePackageImports: [
      'react-icons',
      'framer-motion',
      'date-fns',
      'lodash-es'
    ],
    
    // 메모리 최적화
    memoryBasedWorkersCount: true,
  },
  
  // 이미지 최적화
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: '**',
      }
    ],
    // 프로덕션에서 이미지 최적화 활성화
    unoptimized: false,
    
    // 이미지 포맷 최적화
    formats: ['image/webp', 'image/avif'],
    
    // 이미지 크기 최적화
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    

    
    // 이미지 로딩 최적화
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // 컴파일러 최적화
  compiler: {
    // 프로덕션에서 console.log 제거
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false,
    
    // React 컴파일러 최적화
    reactRemoveProperties: process.env.NODE_ENV === 'production',
  },
  
  // 번들 최적화
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // 프로덕션 최적화
    if (!dev) {
      // 번들 분석 최적화
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            enforce: true,
          },
        },
      };
      
      // Tree shaking 최적화
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
    }
    
    // 개발 환경 최적화
    if (dev) {
      // 파일 변경 감지 최적화
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: /node_modules/,
      };
    }
    
    // 모듈 해결 최적화
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, 'src'),
    };
    
    // 외부 라이브러리 최적화
    if (isServer) {
      config.externals.push({
        'utf-8-validate': 'commonjs utf-8-validate',
        'bufferutil': 'commonjs bufferutil',
      });
    }
    
    return config;
  },
  
  // 헤더 최적화
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // 보안 헤더
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          // 성능 헤더
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          // API 캐싱 최적화
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          // 정적 파일 캐싱 최적화
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  
  // 리다이렉트 최적화
  async redirects() {
    return [
      // 필요한 리다이렉트 규칙들
    ];
  },
  
  // 환경 변수 최적화
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
  // 빌드 최적화
  generateBuildId: async () => {
    // 커스텀 빌드 ID (캐싱 최적화)
    return process.env.BUILD_ID || `build-${Date.now()}`;
  },
  
  // 압축 최적화
  compress: true,
  
  // 전원 최적화
  poweredByHeader: false,
  
  // 트레일링 슬래시 최적화
  trailingSlash: false,
  
  // ESLint 최적화
  eslint: {
    ignoreDuringBuilds: process.env.NODE_ENV === 'production',
  },
  
  // TypeScript 최적화
  typescript: {
    ignoreBuildErrors: process.env.NODE_ENV === 'production',
  },
};

module.exports = nextConfig; 