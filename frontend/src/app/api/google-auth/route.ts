import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

// Google Client ID (iOS 로그에서 확인된 값)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// iOS 로그 전송 함수 (서버사이드)
const sendLogToConsole = (level: 'info' | 'error' | 'warning', message: string, data?: any) => {
  const logMessage = `[GOOGLE API ${level.toUpperCase()}] ${message}`;
  console.log(logMessage, data ? JSON.stringify(data, null, 2) : '');
};

export async function POST(request: NextRequest) {
  sendLogToConsole('info', 'POST 요청 시작');
  sendLogToConsole('info', '환경 변수 확인', {
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    googleClientIdLength: process.env.GOOGLE_CLIENT_ID?.length || 0,
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    usingClientId: GOOGLE_CLIENT_ID
  });
  
  try {
    const body = await request.json();
    sendLogToConsole('info', '요청 본문 분석', {
      bodyType: typeof body,
      bodyKeys: Object.keys(body || {}),
      hasIdToken: !!body?.idToken,
      idTokenLength: body?.idToken?.length || 0,
      hasUserInfo: !!body?.userInfo,
      userInfoType: typeof body?.userInfo
    });
    
    const { idToken, userInfo } = body;

    if (!idToken) {
      sendLogToConsole('error', 'ID 토큰이 없음');
      return NextResponse.json(
        { error: 'ID 토큰이 필요합니다.' },
        { status: 400 }
      );
    }

    sendLogToConsole('info', 'ID 토큰 확인 완료', { tokenLength: idToken.length });

    sendLogToConsole('info', 'Google ID 토큰 검증 시작');
    sendLogToConsole('info', '검증 설정', {
      clientId: GOOGLE_CLIENT_ID,
      tokenPrefix: idToken.substring(0, 50) + '...'
    });

    // Google ID 토큰 검증
    let googleUser;
    try {
      sendLogToConsole('info', 'OAuth2Client.verifyIdToken 호출 중');
      const ticket = await client.verifyIdToken({
        idToken: idToken,
        audience: GOOGLE_CLIENT_ID,
      });
      
      sendLogToConsole('info', '토큰 검증 완료, payload 추출 중');
      const payload = ticket.getPayload();
      
      if (!payload) {
        sendLogToConsole('error', 'payload가 null/undefined');
        throw new Error('Invalid token payload');
      }

      sendLogToConsole('info', 'payload 내용', {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        aud: payload.aud,
        iss: payload.iss,
        exp: payload.exp,
        iat: payload.iat
      });

      googleUser = {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        givenName: payload.given_name,
        familyName: payload.family_name,
        picture: payload.picture,
        emailVerified: payload.email_verified
      };

      sendLogToConsole('info', 'Google 토큰 검증 성공', googleUser);
    } catch (error) {
      sendLogToConsole('error', 'Google 토큰 검증 실패', {
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : 'No stack'
      });
      
      return NextResponse.json(
        { 
          error: 'Google 토큰 검증에 실패했습니다.',
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 400 }
      );
    }

    // 백엔드 API 시도 (실패해도 계속 진행)
    let backendData = null;
    let isNewUser = true;
    
    try {
      console.log('[GOOGLE API] 백엔드 연결 시도...');
      // SSL 인증서 검증 비활성화 (개발 환경)
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      
      const backendResponse = await fetch('https://118.67.130.71:8000/api/v1/auth/google-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          google_id: googleUser.googleId,
          email: googleUser.email,
          name: googleUser.name,
          given_name: googleUser.givenName,
          family_name: googleUser.familyName,
          picture: googleUser.picture,
          id_token: idToken
        }),
      });

      if (backendResponse.ok) {
        backendData = await backendResponse.json();
        console.log('[GOOGLE API] 백엔드 응답 성공:', backendData);
      } else {
        console.log('[GOOGLE API] 백엔드 요청 실패:', backendResponse.status);
        throw new Error('Backend connection failed');
      }
    } catch (backendError) {
      console.log('[GOOGLE API] 백엔드 연결 실패:', backendError instanceof Error ? backendError.message : String(backendError));
      console.log('[GOOGLE API] 임시 모드로 계속 진행...');
    }

    // 백엔드 연결 성공 시
    if (backendData && backendData.success) {
      const user = backendData.data.user;
      isNewUser = backendData.data.isNewUser;

      // 탈퇴한 사용자인지 확인 (mt_level이 1이면 탈퇴한 사용자)
      if (user.mt_level === 1) {
        console.log('[GOOGLE API] 탈퇴한 사용자 로그인 시도:', user.mt_idx);
        return NextResponse.json(
          { 
            success: false, 
            error: '탈퇴한 계정입니다. 새로운 계정으로 가입해주세요.',
            isWithdrawnUser: true
          },
          { status: 403 }
        );
      }

      // JWT 토큰 생성 (백엔드 응답의 실제 사용자 정보 사용)
      const token = jwt.sign(
        { 
          mt_idx: user.mt_idx,
          userId: user.mt_idx, 
          mt_id: user.mt_id,
          mt_name: user.mt_name,
          mt_nickname: user.mt_nickname,
          mt_hp: user.mt_hp,
          mt_email: user.mt_email,
          mt_birth: user.mt_birth,
          mt_gender: user.mt_gender,
          mt_type: user.mt_type,
          mt_level: user.mt_level,
          googleId: user.mt_google_id,
          provider: 'google'
        },
        process.env.NEXTAUTH_SECRET || 'default-secret',
        { expiresIn: '7d' }
      );

      console.log('[GOOGLE API] 백엔드 연동 성공');

      const response = NextResponse.json({
        success: true,
        user: {
          id: user.mt_idx,
          mt_idx: user.mt_idx,
          email: user.mt_email,
          name: user.mt_name,
          nickname: user.mt_nickname,
          profile_image: user.mt_file1 || googleUser.picture,
          provider: 'google',
          google_id: googleUser.googleId,
          isNewUser: isNewUser
        },
        token,
        isNewUser,
        message: isNewUser ? 'Google 계정으로 회원가입되었습니다.' : 'Google 로그인 성공'
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

    // 백엔드 연결 실패 시 임시 모드
    console.log('[GOOGLE API] 임시 모드로 로그인 처리');
    
    const tempUser = {
      id: googleUser.googleId,
      mt_idx: parseInt(googleUser.googleId.substring(0, 8)), // 임시 ID
      email: googleUser.email,
      name: googleUser.name,
      nickname: googleUser.givenName || googleUser.name,
      profile_image: googleUser.picture,
      provider: 'google',
      mt_type: 3 // Google 로그인
    };

    // JWT 토큰 생성 (임시 모드용)
    const token = jwt.sign(
      { 
        mt_idx: tempUser.mt_idx,
        userId: tempUser.mt_idx, 
        mt_id: tempUser.id,
        email: tempUser.email, 
        name: tempUser.name,
        nickname: tempUser.nickname,
        googleId: googleUser.googleId,
        provider: 'google'
      },
      process.env.NEXTAUTH_SECRET || 'default-secret',
      { expiresIn: '7d' }
    );

    console.log('[GOOGLE API] 임시 사용자 정보 구성 완료:', tempUser);
    console.log('[GOOGLE API] JWT 토큰 생성 완료');

    const response = NextResponse.json({
      success: true,
      user: tempUser,
      token,
      isNewUser: isNewUser,
      message: 'Google 로그인 성공 (임시 모드)'
    });

    // 쿠키에 토큰 저장
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    });

    console.log('[GOOGLE API] 응답 전송 완료');
    return response;

  } catch (error) {
    console.error('[GOOGLE API] 처리 중 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  console.log('[GOOGLE API] DELETE 요청 - 로그아웃');
  
  const response = NextResponse.json({ 
    success: true, 
    message: '로그아웃되었습니다.' 
  });
  
  // 쿠키 삭제
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  
  return response;
} 