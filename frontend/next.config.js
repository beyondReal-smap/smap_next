/** @type {import('next').NextConfig} */
const nextConfig = {
  // React 최적화 - Strict Mode 비활성화 (컴포넌트 이중 마운트 방지)
  reactStrictMode: false,
  
  // 실험적 기능들 (최소한만)
  experimental: {
    memoryBasedWorkersCount: true,
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
    
    // React 모듈 해결 문제 수정 (SWC 호환)
    config.resolve.alias = {
      ...config.resolve.alias,
      // React 중복 방지
      'react': require.resolve('react'),
      'react-dom': require.resolve('react-dom'),
      // JSX Runtime 명시적 해결
      'react/jsx-runtime': require.resolve('react/jsx-runtime'),
      'react/jsx-dev-runtime': require.resolve('react/jsx-dev-runtime'),
    };
    
    // Node modules fallback 설정
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    
    // 모듈 해결 확장자 순서 명시
    config.resolve.extensions = ['.tsx', '.ts', '.jsx', '.js', '.json'];
    
    // 모듈 검색 경로 명시
    config.resolve.modules = ['node_modules', 'src'];
    
    // React JSX를 위한 추가 설정
    config.resolve.symlinks = false;
    
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
  
  // SWC 컴파일러 설정 (next/font 지원을 위해 필요)
  swcMinify: true,
  
  // SWC 컴파일러 최적화 설정
  compiler: {
    // 개발 도구 제거 (프로덕션)
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
    // React refresh 설정
    reactRemoveProperties: process.env.NODE_ENV === 'production',
    // Styled components 지원
    styledComponents: false,
  },
};

module.exports = nextConfig; 