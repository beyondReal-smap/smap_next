import { NextRequest, NextResponse } from 'next/server';
import { generateJWT } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mt_idx, action, userInfo } = body;

    if (action !== 'auto-login') {
      return NextResponse.json(
        { success: false, error: '잘못된 액션입니다.' },
        { status: 400 }
      );
    }

    if (!mt_idx) {
      return NextResponse.json(
        { success: false, error: 'mt_idx가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('🔍 [AUTO-LOGIN] 자동 로그인 요청:', { 
      mt_idx, 
      action, 
      hasUserInfo: !!userInfo,
      userInfoKeys: userInfo ? Object.keys(userInfo) : [],
      userInfoValues: userInfo ? Object.values(userInfo) : []
    });

    // 회원가입 시 받은 사용자 정보를 직접 사용
    if (userInfo && userInfo.mt_idx) {
      const userData = userInfo;
      console.log('✅ [AUTO-LOGIN] 회원가입 정보로 자동 로그인:', {
        mt_idx: userData.mt_idx,
        mt_name: userData.mt_name,
        mt_email: userData.mt_email,
        mt_type: userData.mt_type
      });

      // JWT 토큰 생성
      const jwtToken = generateJWT({
        mt_idx: userData.mt_idx,
        userId: userData.mt_idx,
        mt_id: userData.mt_id,
        mt_name: userData.mt_name,
        mt_nickname: userData.mt_nickname,
        mt_hp: userData.mt_hp,
        mt_email: userData.mt_email,
        mt_birth: userData.mt_birth,
        mt_gender: userData.mt_gender,
        mt_type: userData.mt_type,
        mt_level: userData.mt_level,
        mt_file1: userData.mt_file1
      });

      console.log('✅ [AUTO-LOGIN] JWT 토큰 생성 완료');

      // 응답 생성
      const response = NextResponse.json({
        success: true,
        data: {
          token: jwtToken,
          user: userData
        }
      });

      // 쿠키에 토큰 저장
      response.cookies.set('auth-token', jwtToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30일
      });

      return response;
    }

    // userInfo가 없는 경우 에러 반환
    console.error('❌ [AUTO-LOGIN] 사용자 정보가 제공되지 않음');
    return NextResponse.json(
      { success: false, error: '사용자 정보가 제공되지 않았습니다.' },
      { status: 400 }
    );

  } catch (error) {
    console.error('❌ [AUTO-LOGIN] 자동 로그인 API 오류:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 
