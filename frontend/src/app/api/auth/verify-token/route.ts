import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '@/app/api/_utils/backend';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token =
      (typeof body?.token === 'string' && body.token) ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
      request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: '토큰이 필요합니다.' },
        { status: 400 }
      );
    }

    const backendUrl = `${resolveBackendBaseUrl()}/api/v1/auth/me`;
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 401 || response.status === 403) {
      return NextResponse.json(
        { success: false, message: '유효하지 않거나 만료된 토큰입니다.' },
        { status: 401 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: '인증 서버 응답 오류가 발생했습니다.' },
        { status: 502 }
      );
    }

    const user = await response.json();
    return NextResponse.json({
      success: true,
      message: '토큰이 유효합니다.',
      user: {
        userId: user.mt_idx,
        mt_idx: user.mt_idx,
        mt_id: user.mt_id,
        mt_name: user.mt_name,
        mt_level: user.mt_level,
      },
    });
  } catch (error) {
    console.error('[VERIFY TOKEN] 토큰 검증 오류:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { success: false, message: '토큰 검증 중 서버 오류가 발생했습니다.' },
      { status: 502 }
    );
  }
}
