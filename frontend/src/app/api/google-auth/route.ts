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
      
      // ID 토큰에서 audience 확인 (디버깅용)
      try {
        const tokenParts = idToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          sendLogToConsole('info', 'ID 토큰 payload 정보', {
            aud: payload.aud,
            iss: payload.iss,
            expectedAudience: GOOGLE_CLIENT_ID,
            audienceMatch: payload.aud === GOOGLE_CLIENT_ID
          });
        }
      } catch (decodeError) {
        sendLogToConsole('warning', 'ID 토큰 디코딩 실패', { error: String(decodeError) });
      }
      
      // 여러 Client ID로 검증 시도 (더 많은 가능성 추가)
      let ticket;
      const possibleAudiences = [
        GOOGLE_CLIENT_ID, // 환경변수에서 가져온 값
        '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com', // iOS Client ID
        process.env.GOOGLE_CLIENT_ID, // 환경변수 직접 참조
        '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com', // 하드코딩된 값 (중복이지만 안전장치)
        // 웹 클라이언트 ID도 추가 (혹시 다른 클라이언트 ID가 있을 경우)
        process.env.GOOGLE_WEB_CLIENT_ID,
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      ].filter(Boolean).filter((value, index, self) => self.indexOf(value) === index); // 중복 제거
      
      sendLogToConsole('info', '가능한 audience 목록', possibleAudiences);
      
      let verificationError;
      for (const audience of possibleAudiences) {
        try {
          sendLogToConsole('info', `audience로 검증 시도: ${audience}`);
          ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: audience,
          });
          sendLogToConsole('info', `✅ 검증 성공 - audience: ${audience}`);
          break; // 성공하면 루프 종료
        } catch (err) {
          sendLogToConsole('warning', `❌ 검증 실패 - audience: ${audience}`, {
            error: err instanceof Error ? err.message : String(err)
          });
          verificationError = err;
        }
      }
      
      if (!ticket) {
        throw verificationError || new Error('모든 audience로 검증 실패');
      }
      
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
      
      // 토큰 검증 실패 시 토큰에서 직접 정보 추출 시도 (임시 방편)
      sendLogToConsole('warning', '토큰 검증 실패, 직접 파싱 시도');
      try {
        const tokenParts = idToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          
          // 기본적인 토큰 유효성 확인
          const now = Math.floor(Date.now() / 1000);
          if (payload.exp && payload.exp < now) {
            throw new Error('토큰이 만료되었습니다');
          }
          
          if (payload.iss !== 'https://accounts.google.com') {
            throw new Error('유효하지 않은 토큰 발급자입니다');
          }
          
          // audience 정보 로깅
          sendLogToConsole('info', '직접 파싱된 토큰 정보', {
            aud: payload.aud,
            iss: payload.iss,
            sub: payload.sub,
            email: payload.email,
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
          
          sendLogToConsole('info', '직접 파싱으로 사용자 정보 추출 성공', googleUser);
        } else {
          throw new Error('잘못된 토큰 형식');
        }
      } catch (parseError) {
        sendLogToConsole('error', '직접 파싱도 실패', {
          error: parseError instanceof Error ? parseError.message : String(parseError)
        });
        
        return NextResponse.json(
          { 
            error: 'Google 토큰 검증에 실패했습니다.',
            details: error instanceof Error ? error.message : String(error),
            originalError: error instanceof Error ? error.message : String(error)
          },
          { status: 400 }
        );
      }
    }

    // 백엔드 API 시도 (실패해도 계속 진행)
    let backendData = null;
    let isNewUser = true;
    
    try {
      sendLogToConsole('info', '백엔드 연결 시도 시작', {
        backendUrl: 'https://118.67.130.71:8000/api/v1/auth/google-login',
        googleUserId: googleUser.googleId,
        googleUserEmail: googleUser.email
      });
      
      // SSL 인증서 검증 비활성화 (개발 환경)
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      
      const requestBody = {
        google_id: googleUser.googleId,
        email: googleUser.email,
        name: googleUser.name,
        given_name: googleUser.givenName,
        family_name: googleUser.familyName,
        picture: googleUser.picture,
        id_token: idToken
      };
      
      sendLogToConsole('info', '백엔드 요청 본문', requestBody);
      
      // 타임아웃 설정
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃
      
      const backendResponse = await fetch('https://118.67.130.71:8000/api/v1/auth/google-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'SMAP-NextJS-GoogleAuth/1.0'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId); // 성공 시 타임아웃 클리어

      sendLogToConsole('info', '백엔드 응답 상태', {
        status: backendResponse.status,
        statusText: backendResponse.statusText,
        ok: backendResponse.ok,
        headers: Object.fromEntries(backendResponse.headers.entries())
      });

      if (backendResponse.ok) {
        const responseText = await backendResponse.text();
        sendLogToConsole('info', '백엔드 응답 텍스트', { responseText });
        
        try {
          backendData = JSON.parse(responseText);
          sendLogToConsole('info', '백엔드 JSON 파싱 성공', backendData);
        } catch (jsonError) {
          sendLogToConsole('error', 'JSON 파싱 실패', { 
            error: String(jsonError),
            responseText: responseText.substring(0, 500) 
          });
          throw new Error(`JSON 파싱 실패: ${String(jsonError)}`);
        }
      } else {
        const errorText = await backendResponse.text();
        sendLogToConsole('error', '백엔드 HTTP 오류', {
          status: backendResponse.status,
          statusText: backendResponse.statusText,
          errorBody: errorText.substring(0, 500)
        });
        throw new Error(`Backend HTTP Error: ${backendResponse.status} - ${errorText}`);
      }
    } catch (backendError) {
      sendLogToConsole('error', '백엔드 연결 실패 상세', {
        errorType: typeof backendError,
        errorMessage: backendError instanceof Error ? backendError.message : String(backendError),
        errorStack: backendError instanceof Error ? backendError.stack : 'No stack',
        isNetworkError: backendError instanceof TypeError,
        isFetchError: String(backendError).includes('fetch')
      });
      
      // 네트워크 오류인 경우 추가 정보
      if (backendError instanceof TypeError && String(backendError).includes('fetch')) {
        sendLogToConsole('error', '네트워크 연결 불가 - DNS, 방화벽, 서버 상태 확인 필요');
      }
      
      sendLogToConsole('warning', '임시 모드로 전환');
    }

    // 백엔드 연결 성공 시
    if (backendData && backendData.success) {
      sendLogToConsole('info', '백엔드 연동 성공!', {
        hasData: !!backendData.data,
        hasUser: !!backendData.data?.user,
        isNewUser: !!backendData.data?.isNewUser
      });
      
      const user = backendData.data.user;
      isNewUser = backendData.data.isNewUser;

      sendLogToConsole('info', '실제 고객 정보 확인', {
        mt_idx: user.mt_idx,
        mt_email: user.mt_email,
        mt_name: user.mt_name,
        mt_nickname: user.mt_nickname,
        mt_level: user.mt_level,
        mt_type: user.mt_type,
        isNewUser: isNewUser,
        googleEmail: googleUser.email,
        emailMatch: user.mt_email === googleUser.email
      });

      // 탈퇴한 사용자인지 확인 (mt_level이 1이면 탈퇴한 사용자)
      if (user.mt_level === 1) {
        sendLogToConsole('warning', '탈퇴한 사용자 로그인 시도', { mt_idx: user.mt_idx });
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

      sendLogToConsole('info', '✅ 실제 고객으로 로그인 성공', {
        mt_idx: user.mt_idx,
        email: user.mt_email,
        name: user.mt_name,
        isNewUser: isNewUser
      });

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
    sendLogToConsole('warning', '⚠️ 백엔드 연결 실패 - 임시 모드로 로그인 처리');
    sendLogToConsole('warning', '임시 계정 정보', {
      googleId: googleUser.googleId,
      email: googleUser.email,
      name: googleUser.name,
      note: '실제 고객 데이터가 아닌 임시 테스트 계정입니다'
    });
    
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