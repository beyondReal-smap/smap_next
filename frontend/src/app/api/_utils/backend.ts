export function resolveBackendBaseUrl(): string {
  const envBase = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'https://api3.smap.site';
  try {
    const parsed = new URL(envBase);
    const hostname = parsed.hostname;
    const isIpHost = /^[0-9.]+$/.test(hostname);

    // IP 또는 http 스킴이면 강제로 공식 도메인 사용
    if (isIpHost || hostname.includes('118.67.130.71') || parsed.protocol === 'http:') {
      return 'https://api3.smap.site';
    }
    return envBase;
  } catch (_e) {
    // 파싱 실패 시 안전한 기본값 반환
    return 'https://api3.smap.site';
  }
}

export default resolveBackendBaseUrl;

