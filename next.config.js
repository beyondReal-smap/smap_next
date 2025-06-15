/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    domains: ['localhost', '118.67.130.71'],
    unoptimized: true,
  },
  // iOS WebView 호환성을 위한 실험적 기능
  experimental: {
    optimizePackageImports: ['framer-motion'],
    webVitalsAttribution: ['CLS', 'LCP'],
  },
  webpack: (config, { isServer, dev }) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
    };
    
    // iOS WebView 호환성을 위한 설정
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
      
      // iOS WebView에서 chunk 로딩 문제 해결
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: {
              minChunks: 1,
              priority: -20,
              reuseExistingChunk: true,
            },
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: -10,
              chunks: 'all',
            },
          },
        },
      };
    }
    
    // iOS WebView에서 모듈 해석 문제 해결
    config.resolve.alias = {
      ...config.resolve.alias,
      'react/jsx-runtime': require.resolve('react/jsx-runtime'),
    };
    
    return config;
  },
  // iOS WebView에서의 호환성을 위한 추가 설정
  transpilePackages: ['framer-motion', 'react-icons'],
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? ['log', 'warn'] : false,
  },
  // 빌드 에러 무시 (개발 중)
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // iOS WebView 라우팅 문제 해결
  trailingSlash: false,
  // 정적 최적화 비활성화 (iOS WebView 호환성)
  output: 'standalone',
  // 개발 서버 설정
  ...(process.env.NODE_ENV === 'development' && {
    devIndicators: {
      buildActivity: false,
    },
  }),
};

module.exports = nextConfig; 