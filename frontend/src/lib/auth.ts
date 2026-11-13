import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '@/app/api/_utils/backend';

export interface BackendUserIdentity {
  mt_idx: number;
  mt_id: string;
  mt_name: string;
  mt_level: number;
}

/**
 * 요청 헤더 또는 쿠키에서 백엔드 인증 토큰 추출
 */
export function extractAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const adminCookie = request.cookies.get('admin-token')?.value;
  if (adminCookie) return adminCookie;

  const authCookie = request.cookies.get('auth-token')?.value;
  if (authCookie) return authCookie;

  const clientCookie = request.cookies.get('client-token')?.value;
  if (clientCookie) return clientCookie;

  return null;
}

/**
 * 백엔드 GET /api/v1/auth/me 를 호출해 토큰 검증 및 사용자 신원 확인
 * - 토큰 없음 / 백엔드 401·403 → 401
 * - 백엔드 연결 실패·5xx → 502
 */
export async function verifyBackendAuth(request: NextRequest): Promise<{
  user: BackendUserIdentity | null;
  token: string | null;
  errorResponse?: NextResponse;
}> {
  const token = extractAuthToken(request);
  if (!token) {
    return {
      user: null,
      token: null,
      errorResponse: NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      ),
    };
  }

  try {
    const backendBase = resolveBackendBaseUrl();
    const response = await fetch(`${backendBase}/api/v1/auth/me`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 401 || response.status === 403) {
      return {
        user: null,
        token: null,
        errorResponse: NextResponse.json(
          { success: false, error: '유효하지 않거나 만료된 인증 토큰입니다.' },
          { status: 401 }
        ),
      };
    }

    if (!response.ok) {
      return {
        user: null,
        token: null,
        errorResponse: NextResponse.json(
          { success: false, error: '인증 서버 응답 오류가 발생했습니다.' },
          { status: 502 }
        ),
      };
    }

    const user = (await response.json()) as BackendUserIdentity;
    if (!user || typeof user.mt_idx !== 'number') {
      return {
        user: null,
        token: null,
        errorResponse: NextResponse.json(
          { success: false, error: '인증 서버 응답 형식이 올바르지 않습니다.' },
          { status: 502 }
        ),
      };
    }

    return { user, token };
  } catch (error) {
    console.error('[AUTH] 백엔드 인증 확인 실패:', error instanceof Error ? error.message : String(error));
    return {
      user: null,
      token: null,
      errorResponse: NextResponse.json(
        { success: false, error: '인증 서버에 연결할 수 없습니다.' },
        { status: 502 }
      ),
    };
  }
}

/**
 * 관리자 권한 필수 체크 헬퍼 함수 (백엔드 /api/v1/auth/me 의 mt_level >= 9 기준)
 */
export async function verifyBackendAdminAuth(request: NextRequest): Promise<{
  user: BackendUserIdentity | null;
  token: string | null;
  errorResponse?: NextResponse;
}> {
  const authResult = await verifyBackendAuth(request);
  if (authResult.errorResponse || !authResult.user || !authResult.token) {
    return authResult;
  }

  if ((authResult.user.mt_level ?? 0) < 9) {
    return {
      user: null,
      token: null,
      errorResponse: NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      ),
    };
  }

  return authResult;
}

/**
 * 지도/검색 API 인증 검증 헬퍼 (백엔드 /api/v1/auth/me 확인)
 */
export async function requireSignedMapAuth(request: NextRequest): Promise<NextResponse | null> {
  const { errorResponse } = await verifyBackendAuth(request);
  return errorResponse ?? null;
}
