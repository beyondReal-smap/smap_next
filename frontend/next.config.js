// 개발환경에서만 SSL 검증 비활성화
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// PWA 설정
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api3\.smap\.site\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24, // 24시간
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: /^https:\/\/firebase\.googleapis\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'firebase-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 * 7, // 7일
        },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // React 최적화 - Strict Mode 비활성화 (컴포넌트 이중 마운트 방지)
  reactStrictMode: false,
  
  // 실험적 기능들 (Vercel 최적화)
  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
    optimizePackageImports: ['framer-motion', '@heroicons/react', 'react-icons'],
  },
  
  // Turbopack 설정 (stable)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },

  // 컴파일러 최적화
  compiler: {
    // CSS 최적화
    styledComponents: false,
    // 번들 크기 최적화
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false,
  },
  
  // 폰트 최적화는 기본으로 활성화되어 있음
  
  // 개발 모드 설정 (Vercel 최적화)
  ...(process.env.NODE_ENV === 'development' && {
    onDemandEntries: {
      maxInactiveAge: 25 * 1000,
      pagesBufferLength: 2,
    },
  }),
  
  // 이미지 최적화 개선
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
    unoptimized: false, // 이미지 최적화 활성화
    formats: ['image/webp', 'image/avif'], // 모던 이미지 포맷 사용
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1년 캐시
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    domains: [
      'localhost',
      'nextstep.smap.site', 
      'app2.smap.site',
      'app.smap.site',
      'smap.site',
      '118.67.130.71',
      'api3.smap.site'
    ],
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
    
    // React JSX Runtime 모듈 해결 설정 (강화)
    try {
      const reactPath = require.resolve('react');
      const reactDomPath = require.resolve('react-dom');
      const reactJsxRuntimePath = require.resolve('react/jsx-runtime');
      const reactJsxDevRuntimePath = require.resolve('react/jsx-dev-runtime');
      
      config.resolve.alias = {
        ...config.resolve.alias,
        'react$': reactPath,
        'react-dom$': reactDomPath,
        'react/jsx-runtime$': reactJsxRuntimePath,
        'react/jsx-dev-runtime$': reactJsxDevRuntimePath,
      };
      
      console.log('React module paths resolved:', {
        react: reactPath,
        'jsx-runtime': reactJsxRuntimePath,
        'jsx-dev-runtime': reactJsxDevRuntimePath
      });
    } catch (error) {
      console.error('Error resolving React modules:', error);
    }
    
    // 모듈 해결 우선순위 및 fallback 설정
    config.resolve.modules = [
      'node_modules',
      ...(config.resolve.modules || [])
    ];
    
    config.resolve.mainFields = ['browser', 'module', 'main'];
    
    // React JSX runtime을 externals에서 제외
    if (!isServer && config.externals) {
      const originalExternals = config.externals;
      config.externals = (context, request, callback) => {
        if (request === 'react/jsx-runtime' || request === 'react/jsx-dev-runtime') {
          return callback();
        }
        if (typeof originalExternals === 'function') {
          return originalExternals(context, request, callback);
        }
        return callback();
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
    }
    
    if (!isServer) {
      config.externals = {
        ...config.externals,
        'naver-maps': 'naver',
        'google-maps': 'google',
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
            key: 'Access-Control-Allow-Origin',
            value: '*'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' *.map.naver.com *.googleapis.com *.gstatic.com *.google.com *.navercorp.com *.naver.net *.pstatic.net *.vercel-scripts.com *.vercel.com",
              "connect-src 'self' *.map.naver.com *.apigw.ntruss.com dapi.kakao.com *.googleapis.com *.google.com *.firebaseapp.com *.navercorp.com *.naver.net *.pstatic.net *.vercel-scripts.com *.vercel.com https://api3.smap.site wss: ws: data: blob:",
              "img-src 'self' data: blob: api3.smap.site https://api3.smap.site *.map.naver.com *.googleapis.com *.gstatic.com *.google.com *.navercorp.com *.naver.net *.pstatic.net *.vercel-scripts.com *.vercel.com",
              "style-src 'self' 'unsafe-inline' *.googleapis.com *.gstatic.com *.google.com accounts.google.com *.navercorp.com *.naver.net *.pstatic.net *.vercel-scripts.com *.vercel.com",
              "font-src 'self' *.gstatic.com *.googleapis.com *.navercorp.com *.naver.net *.pstatic.net *.vercel-scripts.com *.vercel.com",
              "frame-src 'self' *.google.com *.firebaseapp.com *.navercorp.com *.naver.net *.pstatic.net *.vercel-scripts.com *.vercel.com smap:",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'"
            ].join('; ')
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none'
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups'
          }
        ],
      },
    ];
  },
  
  // 압축 활성화
  compress: true,
  
  // 전원 헤더 비활성화
  poweredByHeader: false,
  
  // Vercel 환경 최적화
  ...(process.env.VERCEL && {
    experimental: {
      optimizeCss: true,
      scrollRestoration: true,
      optimizePackageImports: ['framer-motion', 'react-icons'],
      // memoryBasedWorkers 옵션은 Next.js 최신 버전에서 제거됨
    },
  }),
  
  // ESLint 빌드 시 무시
  eslint: {
    ignoreDuringBuilds: false,
  },
  
  // TypeScript 빌드 시 무시
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // 에러 페이지 프리렌더링 방지
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
  
  // 출력 설정 - Vercel 호환성 (기본값 사용)
  // output: 'standalone', // API 라우트와 충돌하므로 제거
  
  // 정적 경로 명시적 설정 (Vercel 빌드 최적화)
  // rewrites는 vercel.json에서 처리
  

  
  // SWC 컴파일러 최적화 설정 (JSX Runtime 포함)
  compiler: {
    // React JSX Runtime 설정
    emotion: false,
    // 개발 도구 제거 (프로덕션)
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
    // React refresh 설정
    reactRemoveProperties: process.env.NODE_ENV === 'production',
    // Styled components 지원
    styledComponents: false,
  },
  

  
  // 리다이렉트 설정 제거 - 로컬 개발 환경에서 문제 발생 방지
  // async redirects() {
  //   return [
  //     {
  //       source: '/(.*)',
  //       has: [
  //         {
  //           type: 'header',
  //           key: 'x-forwarded-proto',
  //           value: 'http',
  //         },
  //       ],
  //       destination: 'https://nextstep.smap.site/:path*',
  //       permanent: true,
  //     },
  //   ];
  // },
  
  trailingSlash: false,
};

module.exports = withPWA(nextConfig);