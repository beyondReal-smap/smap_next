/** @type {import('next').NextConfig} */
const nextConfig = {
  // React 최적화 - Strict Mode 비활성화 (컴포넌트 이중 마운트 방지)
  reactStrictMode: false,
  
  // 실험적 기능들 (최소한만)
  experimental: {
    memoryBasedWorkersCount: true,
    // iOS WebView 호환성을 위해 최신 실험적 기능 비활성화
    forceSwcTransforms: false,
  },
  
  // 개발 모드 설정
  ...(process.env.NODE_ENV === 'development' && {
    onDemandEntries: {
      maxInactiveAge: 25 * 1000,
      pagesBufferLength: 2,
    },
  }),
  
  // 이미지 최적화 (기본 설정)
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
    unoptimized: false,
  },
  
  // iOS WebView 호환성을 위한 webpack 설정
  webpack: (config, { isServer, dev, buildId }) => {
    // 서버 사이드에서만 브라우저 API 방지
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    // Terser plugin 모듈 경로 문제 해결
    if (!dev && !isServer) {
      // Terser 관련 최적화 문제 해결을 위해 기본 minimizer 사용
      config.optimization = {
        ...config.optimization,
        minimize: true,
        // minimizer 설정을 Next.js 기본값으로 유지
      };
    }
    
    // iOS WebView 호환성을 위한 최적화
    if (!isServer) {
      // 청크 분할을 더 안전하게
      if (config.optimization.splitChunks) {
        config.optimization.splitChunks = {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks.cacheGroups,
            default: {
              ...config.optimization.splitChunks.cacheGroups?.default,
              minChunks: 2,
              maxAsyncRequests: 10, // iOS WebView에서 안전한 수준으로 제한
              maxInitialRequests: 10,
            },
          },
        };
      }
      
      // iOS WebView에서 문제가 될 수 있는 모듈 처리
      config.resolve.alias = {
        ...config.resolve.alias,
        // React 중복 방지
        'react': require.resolve('react'),
        'react-dom': require.resolve('react-dom'),
      };
    }
    
    return config;
  },
  
  // 기본 헤더
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // iOS WebView 캐싱 최적화
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  
  // 압축 활성화
  compress: true,
  
  // 전원 헤더 비활성화
  poweredByHeader: false,
  
  // ESLint 빌드 시 무시
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // TypeScript 빌드 시 무시
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 출력 설정 - iOS WebView 호환성
  output: 'standalone',
  
  // SWC 컴파일러 설정 (Terser 대신 SWC 사용)
  swcMinify: true, // Terser 문제 해결을 위해 SWC minify 사용
  
  // 추가 최적화 설정
  compiler: {
    // 개발 도구 제거 (프로덕션)
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
};

module.exports = nextConfig; 