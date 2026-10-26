import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  try {
    const { userIdentifier, userName, email, identityToken, authorizationCode } = await request.json();

    console.log('🍎 [API] Apple 로그인 요청:', {
      userIdentifier,
      userName,
      email: email || 'private',
      hasIdentityToken: !!identityToken,
      hasAuthorizationCode: !!authorizationCode
    });

    // 안전한 이메일 구성 (Apple이 이메일을 제공하지 않는 경우 프라이버트 릴레이 구성)
    const resolvedEmail = (email && email.includes('@'))
      ? email
      : `apple_${String(userIdentifier || '').slice(0, 8)}@privaterelay.appleid.com`;

    // 1) 백엔드에서 이메일로 사용자 조회 시도
    let backendUser: any = null;
    let isNewUser = true;

    try {
      // 개발 환경에서 SSL 문제 회피
      (process as any).env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

      const resp = await fetch('https://api3.aiagnt.kr/api/v1/auth/find-user-by-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'SMAP-NextJS-AppleAuth/1.0'
        },
        body: JSON.stringify({ email: resolvedEmail, provider: 'apple' })
      });

      const text = await resp.text();
      let json: any = {};
      try { json = text ? JSON.parse(text) : {}; } catch {
        console.warn('🍎 [API] 백엔드 응답 JSON 파싱 실패, 원문:', text?.slice(0, 400));
      }

      if (resp.ok && json && json.success) {
        backendUser = json.data?.user || json.data?.member || null;
        isNewUser = !backendUser || !backendUser.mt_idx;
        console.log('🍎 [API] 이메일 조회 결과:', { found: !!backendUser, isNewUser });
      } else {
        console.warn('🍎 [API] 이메일 조회 실패 또는 사용자 없음:', resp.status, json?.message);
      }
    } catch (err) {
      console.warn('🍎 [API] 백엔드 이메일 조회 예외:', err instanceof Error ? err.message : String(err));
    }

    // 2) 기존 사용자면 토큰 발급하여 로그인 처리
    if (backendUser && backendUser.mt_idx) {
      const token = jwt.sign(
        {
          mt_idx: backendUser.mt_idx,
          userId: backendUser.mt_idx,
          mt_id: backendUser.mt_id,
          mt_name: backendUser.mt_name,
          mt_nickname: backendUser.mt_nickname,
          mt_hp: backendUser.mt_hp,
          mt_email: backendUser.mt_email,
          mt_birth: backendUser.mt_birth,
          mt_gender: backendUser.mt_gender,
          mt_type: backendUser.mt_type,
          mt_level: backendUser.mt_level,
          appleId: backendUser.mt_apple_id || userIdentifier,
          provider: 'apple'
        },
        process.env.NEXTAUTH_SECRET || 'default-secret',
        { expiresIn: '7d' }
      );

      const response = NextResponse.json({
        success: true,
        message: 'Apple 로그인 성공',
        data: {
          isNewUser: false,
          user: {
            id: backendUser.mt_idx,
            mt_idx: backendUser.mt_idx,
            mt_id: backendUser.mt_id,
            mt_name: backendUser.mt_name,
            mt_nickname: backendUser.mt_nickname,
            mt_email: backendUser.mt_email,
            mt_file1: backendUser.mt_file1 || '',
            provider: 'apple',
            apple_id: backendUser.mt_apple_id || userIdentifier
          },
          token
        }
      });

      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });

      return response;
    }

    // 3) 신규 사용자 - 회원가입 플로우로 유도
    const demoUser = {
      mt_idx: null,
      mt_id: userIdentifier,
      mt_name: userName || '',
      mt_nickname: userName || '',
      mt_email: resolvedEmail,
      mt_file1: '',
      mt_gender: null,
      apple_id: userIdentifier,
      provider: 'apple'
    };

    return NextResponse.json({
      success: true,
      message: '신규 Apple 사용자입니다.',
      data: {
        isNewUser: true,
        user: demoUser,
        token: null
      }
    });
  } catch (error) {
    console.error('🍎 [API] Apple 로그인 오류:', error);
    return NextResponse.json({
      success: false,
      message: 'Apple 로그인 처리 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
