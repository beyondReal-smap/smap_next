import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '@/app/api/_utils/backend';

export async function POST(request: NextRequest) {
  try {
    let refreshToken = request.cookies.get('refresh-token')?.value;

    if (!refreshToken) {
      try {
        const body = await request.json();
        if (body && typeof body.refresh_token === 'string' && body.refresh_token) {
          refreshToken = body.refresh_token;
        }
      } catch {
        // body 없는 요청 허용
      }
    }

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, message: 'Refresh token이 필요합니다.' },
        { status: 401 }
      );
    }

    const backendUrl = `${resolveBackendBaseUrl()}/api/v1/auth/refresh`;
    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(5000),
    });

    const data = await backendResponse.json().catch(() => ({}));
    if (!backendResponse.ok || !data?.token) {
      return NextResponse.json(
        { success: false, message: data?.detail || data?.message || '토큰 갱신에 실패했습니다.' },
        { status: backendResponse.status || 401 }
      );
    }

    const nextResponse = NextResponse.json({
      success: true,
      message: data.message || '토큰이 갱신되었습니다.',
      token: data.token,
      expires_in: data.expires_in,
    });

    nextResponse.cookies.set('auth-token', data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    if (data.refresh_token) {
      nextResponse.cookies.set('refresh-token', data.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return nextResponse;
  } catch (error) {
    console.error('[REFRESH API] 토큰 갱신 오류:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { success: false, message: '토큰 갱신 중 서버 오류가 발생했습니다.' },
      { status: 502 }
    );
  }
}
