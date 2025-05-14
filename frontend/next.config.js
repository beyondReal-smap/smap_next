/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // 활성화하여 최적화된 빌드 생성
  images: {
    domains: ['localhost'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://backend:5000/api/v1/:path*', // Docker 네트워크 환경에서 backend 컨테이너의 /api/v1 으로 프록시
      },
    ];
  },
};

module.exports = nextConfig; 