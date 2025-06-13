import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  console.log('[KAKAO API] POST 요청 시작');
  try {
    const body = await request.json();
    console.log('[KAKAO API] 요청 본문:', body);
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

    // 백엔드 API 시도 (실패해도 계속 진행)
    let backendData = null;
    let isNewUser = true;
    
    try {
      console.log('[KAKAO API] 백엔드 연결 시도...');
      // SSL 인증서 검증 비활성화 (개발 환경)
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      
      const backendResponse = await fetch('https://118.67.130.71:8000/api/v1/auth/kakao-login', {
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
        console.log('[KAKAO API] 백엔드 응답 성공:', backendData);
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
          kakaoId: user.mt_kakao_id,
          provider: 'kakao'
        },
        process.env.NEXTAUTH_SECRET || 'default-secret',
        { expiresIn: '7d' }
      );

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
        message: isNewUser ? '카카오 계정으로 회원가입되었습니다.' : '카카오 로그인 성공'
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
    console.log('[KAKAO API] 임시 모드로 로그인 처리');
    
    const tempUser = {
      id: kakaoId,
      mt_idx: parseInt(kakaoId.substring(0, 8)), // 임시 ID
      email: email,
      nickname: nickname,
      profile_image: profileImage,
      provider: 'kakao',
      mt_type: 2 // 카카오 로그인
    };

    // JWT 토큰 생성 (임시 모드용)
    const token = jwt.sign(
      { 
        mt_idx: tempUser.mt_idx,
        userId: tempUser.mt_idx, 
        mt_id: tempUser.id,
        email: tempUser.email, 
        nickname: tempUser.nickname,
        kakaoId: kakaoId,
        provider: 'kakao'
      },
      process.env.NEXTAUTH_SECRET || 'default-secret',
      { expiresIn: '7d' }
    );

    console.log('[KAKAO API] 임시 사용자 정보 구성 완료:', tempUser);
    console.log('[KAKAO API] JWT 토큰 생성 완료');

    const response = NextResponse.json({
      success: true,
      user: tempUser,
      token,
      isNewUser: isNewUser,
      message: '카카오 로그인 성공 (임시 모드)'
    });

    // 쿠키에 토큰 저장
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    });

    console.log('[KAKAO API] 임시 모드 로그인 성공, 응답 반환');
    return response;

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