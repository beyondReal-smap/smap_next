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
      console.log('[KAKAO API] 카카오 오러 응답:', errorText);
      return NextResponse.json(
        { error: '카카오 사용자 정보를 가져올 수 없습니다.' },
        { status: 400 }
      );
    }

    const kakaoUser = await kakaoUserResponse.json();
    console.log('[KAKAO API] 카카오 사용자 정보:', kakaoUser);
    
    // 사용자 정보 구성
    const user = {
      id: kakaoUser.id,
      email: kakaoUser.kakao_account?.email || null,
      nickname: kakaoUser.properties?.nickname || '',
      profile_image: kakaoUser.properties?.profile_image || null,
      provider: 'kakao',
    };

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user.id, email: user.email, nickname: user.nickname },
      process.env.NEXTAUTH_SECRET || 'default-secret',
      { expiresIn: '7d' }
    );

    console.log('[KAKAO API] 사용자 정보 구성 완료:', user);
    console.log('[KAKAO API] JWT 토큰 생성 완료');

    // 응답 생성
    const response = NextResponse.json({
      success: true,
      user,
      token
    });

    // 쿠키에 토큰 저장
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    });

    console.log('[KAKAO API] 로그인 성공, 응답 반환');
    return response;

  } catch (error) {
    console.error('카카오 로그인 오류:', error);
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
    console.error('로그아웃 오류:', error);
    return NextResponse.json(
      { error: '로그아웃 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 