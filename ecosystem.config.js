// smap 모노레포 통합 pm2 설정
// 2026-07-06 통합: apps/web(www:5121), apps/api(api2:5122/api3:5123/scheduler:5125), apps/api-go(go:5124)
// 2026-08-07 추가: apps/mcp(mcp:5126) — AI 클라이언트용 MCP 서버
const ROOT = __dirname;
const WEB = `${ROOT}/apps/web`;
const API = `${ROOT}/apps/api`;
const APIGO = `${ROOT}/apps/api-go`;
const MCP = `${ROOT}/apps/mcp`;
const FIREBASE = `${API}/com-dmonster-smap-firebase-adminsdk-2zx5p-2610556cf5.json`;

// FastAPI(uvicorn) 앱 공통 팩토리. api2/api3는 스케줄러 비활성, scheduler 앱만 활성.
const pyApp = (name, module, port, extraEnv = {}) => ({
  name,
  cwd: API,
  interpreter: "none",
  script: `${API}/.venv/bin/uvicorn`,
  args: `${module} --host 127.0.0.1 --port ${port} --proxy-headers --forwarded-allow-ips=*`,
  // FIREBASE_CREDENTIALS_PATH: config.py 기본값(backend/...)이 통합 이전 경로(apps/backend)로 해석돼 푸시가 비활성화되므로 명시 주입
  env: { PYTHONUNBUFFERED: "1", PYTHONPATH: API, FIREBASE_CREDENTIALS_PATH: FIREBASE, ...extraEnv },
  out_file: `${API}/logs/${name}-out.log`,
  error_file: `${API}/logs/${name}-error.log`,
  max_restarts: 10,
  restart_delay: 3000,
  autorestart: true,
});

module.exports = {
  apps: [
    // www.smap.site (Next.js)
    {
      name: "smap-web",
      cwd: WEB,
      interpreter: "none",
      script: `${WEB}/node_modules/.bin/next`,
      args: "start -p 5121 -H 127.0.0.1",
      env: { NODE_ENV: "production", PORT: "5121" },
      out_file: `${WEB}/logs/web-out.log`,
      error_file: `${WEB}/logs/web-error.log`,
      max_memory_restart: "2G",
      autorestart: true,
    },
    // api2.smap.site (5122) / api3.smap.site python 경로 (5123) — 스케줄러 비활성
    pyApp("smap-api2", "app_v2.main:app", 5122, { SMAP_SCHEDULER_DISABLED: "1" }),
    pyApp("smap-api3", "app_v2.main:app", 5123, { SMAP_SCHEDULER_DISABLED: "1" }),
    // scheduler (5125) — 스케줄러 활성 (SMAP_SCHEDULER_DISABLED 미설정)
    pyApp("smap-scheduler", "app.main:app", 5125),
    // api3.smap.site go 경로 (5124)
    {
      name: "smap-go-api",
      cwd: APIGO,
      interpreter: "none",
      script: `${APIGO}/bin/api`,
      env: {
        GO_HTTP_HOST: "127.0.0.1",
        GO_HTTP_PORT: "5124",
        REDIS_URL: "redis://127.0.0.1:6379/0",
        FIREBASE_CREDENTIALS_PATH: FIREBASE,
      },
      out_file: `${APIGO}/logs/go-api-out.log`,
      error_file: `${APIGO}/logs/go-api-error.log`,
      max_restarts: 10,
      restart_delay: 3000,
      autorestart: true,
    },
    // mcp.smap.site (5126) — AI 클라이언트용 MCP 서버.
    // 콘텐츠는 웹(5121)의 /api/ai/* 에서 가져오므로 내부 주소로 직접 호출합니다.
    {
      name: "smap-mcp",
      cwd: MCP,
      // dist/http.js는 실행 권한이 없어 interpreter:"none"(직접 exec)이면 spawn 실패 → node로 실행
      interpreter: "node",
      script: `${MCP}/dist/http.js`,
      env: {
        NODE_ENV: "production",
        SMAP_MCP_HOST: "127.0.0.1",
        SMAP_MCP_PORT: "5126",
        SMAP_AI_BASE_URL: "http://127.0.0.1:5121",
      },
      out_file: `${MCP}/logs/mcp-out.log`,
      error_file: `${MCP}/logs/mcp-error.log`,
      max_memory_restart: "512M",
      max_restarts: 10,
      restart_delay: 3000,
      autorestart: true,
    },
  ],
};
