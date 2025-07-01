/** @type {import('next').NextConfig} */
const nextConfig = {
  // React 최적화 - Strict Mode 비활성화 (컴포넌트 이중 마운트 방지)
  reactStrictMode: false,
  
  // 실험적 기능들 (안정성 우선)
  experimental: {
    memoryBasedWorkersCount: true,
  },
  
  // Turbopack 설정 (Next.js 15에서 안정화됨)
  turbopack: {
    rules: {
      '*.js': {
        loaders: ['babel-loader'],
      },
    },
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
    
    // React JSX Runtime 모듈 해결 문제 수정
    config.resolve.alias = {
      ...config.resolve.alias,
      // React 중복 방지 및 경로 명시
      'react': require.resolve('react'),
      'react-dom': require.resolve('react-dom'),
    };
    
    // React JSX Runtime을 명시적으로 fallback 설정
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'react/jsx-runtime': require.resolve('react/jsx-runtime'),
      'react/jsx-dev-runtime': require.resolve('react/jsx-dev-runtime'),
    };
    
    // 모듈 해결 옵션 강화
    config.resolve.modules = [
      'node_modules',
      require.resolve('react').split('/node_modules/')[0] + '/node_modules'
    ];
    
    // React 관련 확장자 우선순위
    config.resolve.extensions = ['.jsx', '.js', '.tsx', '.ts', '.json'];
    
    // externals 설정으로 React 모듈 강제 해결
    if (!isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'react/jsx-runtime': 'commonjs react/jsx-runtime',
        'react/jsx-dev-runtime': 'commonjs react/jsx-dev-runtime'
      });
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
  
  // SWC는 Next.js 15에서 기본으로 활성화됨
  
  // 추가 최적화 설정
  compiler: {
    // 개발 도구 제거 (프로덕션)
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
};

module.exports = nextConfig; 