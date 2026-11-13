import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userIdentifier, userName, email, identityToken, authorizationCode } = await request.json();

    if (!identityToken) {
      return NextResponse.json(
        { success: false, message: 'Apple identityToken이 필요합니다.' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.BACKEND_URL || 'https://api3.aiagnt.kr';
    const resp = await fetch(`${backendUrl}/api/v1/auth/apple-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'SMAP-NextJS-AppleAuth/1.0'
      },
      body: JSON.stringify({
        userIdentifier,
        userName,
        email,
        identityToken,
        authorizationCode
      })
    });

    const json = await resp.json().catch(() => ({}));

    if (!resp.ok || !json?.success) {
      return NextResponse.json(
        {
          success: false,
          message: json?.message || json?.detail || 'Apple 로그인 검증에 실패했습니다.'
        },
        { status: resp.ok ? 401 : resp.status }
      );
    }

    const token = json.data?.token || null;
    const isNewUser = Boolean(json.data?.isNewUser ?? json.data?.is_new_user ?? !token);

    const response = NextResponse.json(json, { status: resp.status });

    if (!isNewUser && token) {
      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
      const refreshToken = json.data?.refresh_token;
      if (refreshToken) {
        response.cookies.set('refresh-token', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30,
          path: '/',
        });
      }
    }

    return response;
  } catch (error) {
    console.error('🍎 [API] Apple 로그인 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Apple 로그인 처리 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}
