import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // App Router는 점으로 시작하는 디렉터리를 라우트 세그먼트로 잡지 않습니다.
  // MCP 디스커버리는 /.well-known/ 아래에 있어야 클라이언트가 자동으로 찾으므로 rewrite로 연결합니다.
  async rewrites() {
    return [
      { source: "/.well-known/mcp.json", destination: "/api/ai/mcp" },
    ];
  },
};

export default nextConfig;
