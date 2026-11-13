import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('[KAKAO API] POST 요청 시작');
  try {
    const body = await request.json();
    const { access_token } = body;

    if (!access_token) {
      console.log('[KAKAO API] 액세스 토큰이 없음');
      return NextResponse.json(
        { error: '액세스 토큰이 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('[KAKAO API] 카카오 사용자 정보 요청 시작');

    // 카카오 사용자 정보 가져오기
    const kakaoUserResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
    });

    if (!kakaoUserResponse.ok) {
      console.log('[KAKAO API] 카카오 사용자 정보 요청 실패:', kakaoUserResponse.status, kakaoUserResponse.statusText);
      const errorText = await kakaoUserResponse.text();
      console.log('[KAKAO API] 카카오 오류 응답:', errorText);
      return NextResponse.json(
        { error: '카카오 사용자 정보를 가져올 수 없습니다.' },
        { status: 400 }
      );
    }

    const kakaoUser = await kakaoUserResponse.json();
    console.log('[KAKAO API] 카카오 사용자 정보:', kakaoUser);

    // 카카오 사용자 정보 추출
    const kakaoId = kakaoUser.id.toString();
    const email = kakaoUser.kakao_account?.email || null;
    const nickname = kakaoUser.properties?.nickname || '';
    const profileImage = kakaoUser.properties?.profile_image || null;

    console.log('[KAKAO API] 추출된 정보:', { kakaoId, email, nickname, profileImage });

    if (!email) {
      console.log('[KAKAO API] 이메일 정보가 없음');
      return NextResponse.json(
        { error: '카카오 계정에서 이메일 정보를 가져올 수 없습니다. 카카오 계정 설정에서 이메일을 확인해주세요.' },
        { status: 400 }
      );
    }

    // 백엔드 API 시도 (실패해도 계속 진행)
    let backendData = null;
    let isNewUser = true; // 기본값은 신규 사용자
    
    try {
      console.log('[KAKAO API] 백엔드 연결 시도...');
      
      const backendResponse = await fetch('https://api3.aiagnt.kr/api/v1/auth/kakao-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kakao_id: kakaoId,
          email: email,
          nickname: nickname,
          profile_image: profileImage,
          access_token: access_token
        }),
      });

      if (backendResponse.ok) {
        backendData = await backendResponse.json();
        console.log('[KAKAO API] 백엔드 응답 상태:', backendResponse.status);
      } else {
        console.log('[KAKAO API] 백엔드 요청 실패:', backendResponse.status);
        throw new Error('Backend connection failed');
      }
    } catch (backendError) {
      console.log('[KAKAO API] 백엔드 연결 실패:', backendError instanceof Error ? backendError.message : String(backendError));
      console.log('[KAKAO API] 임시 모드로 계속 진행...');
    }

    // 백엔드 연결 성공 시
    if (backendData && backendData.success) {
      const user = backendData.data.user;
      isNewUser = backendData.data.isNewUser;

      // 탈퇴한 사용자인지 확인 (mt_level이 1이면 탈퇴한 사용자)
      if (user.mt_level === 1) {
        console.log('[KAKAO API] 탈퇴한 사용자 로그인 시도:', user.mt_idx);
        return NextResponse.json(
          { 
            success: false, 
            error: '탈퇴한 계정입니다. 새로운 계정으로 가입해주세요.',
            isWithdrawnUser: true
          },
          { status: 403 }
        );
      }

      // 백엔드에서 발급한 토큰 사용 (자체 JWT 폴백 생성 금지)
      const token = backendData.data?.token || null;
      if (!isNewUser && !token) {
        return NextResponse.json(
          { success: false, error: '인증 토큰을 발급받지 못했습니다.' },
          { status: 502 }
        );
      }

      console.log('[KAKAO API] 백엔드 연동 성공');

      const response = NextResponse.json({
        success: true,
        user: {
          id: user.mt_idx,
          mt_idx: user.mt_idx,
          email: user.mt_email,
          nickname: user.mt_nickname,
          profile_image: user.mt_file1 || profileImage,
          provider: 'kakao',
          kakao_id: kakaoId,
          isNewUser: isNewUser
        },
        token,
        isNewUser,
        socialLoginData: isNewUser ? {
          provider: 'kakao',
          kakao_id: kakaoId,
          email: email,
          nickname: nickname,
          profile_image: profileImage
        } : null,
        message: isNewUser ? '카카오 계정으로 회원가입이 필요합니다.' : '카카오 로그인 성공'
      });

      if (!isNewUser && token) {
        response.cookies.set('auth-token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });
        const refreshToken = backendData.data?.refresh_token;
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
    }

    return NextResponse.json(
      { success: false, error: '카카오 인증 서버와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.' },
      { status: 502 }
    );

  } catch (error) {
    console.error('[KAKAO API] 카카오 로그인 오류:', error);
    return NextResponse.json(
      { error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 로그아웃 처리
export async function DELETE(request: NextRequest) {
  try {
    const response = NextResponse.json({ success: true, message: '로그아웃 되었습니다.' });
    
    // 쿠키 삭제
    response.cookies.delete('auth-token');
    
    return response;
  } catch (error) {
    console.error('[KAKAO API] 로그아웃 오류:', error);
    return NextResponse.json(
      { error: '로그아웃 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 