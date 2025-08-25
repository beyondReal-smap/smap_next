import { NextRequest, NextResponse } from 'next/server';
import { generateJWT } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mt_idx, action } = body;

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

    console.log('🔍 [AUTO-LOGIN] 자동 로그인 요청:', { mt_idx, action });

    // 프론트엔드 API를 통해 mt_idx로 사용자 정보 조회
    try {
      // 기존에 구현된 members API 사용
      const frontendUrl = `/api/members/${mt_idx}`;
      console.log('🔍 [AUTO-LOGIN] 프론트엔드 API 호출 시작:', {
        url: frontendUrl,
        mt_idx: parseInt(mt_idx)
      });

      const frontendResponse = await fetch(frontendUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 [AUTO-LOGIN] 프론트엔드 응답 상태:', frontendResponse.status);

      if (!frontendResponse.ok) {
        console.error('❌ [AUTO-LOGIN] 프론트엔드 사용자 정보 조회 실패:', frontendResponse.status);
        return NextResponse.json(
          { success: false, error: '사용자 정보를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      const frontendData = await frontendResponse.json();
      console.log('📡 [AUTO-LOGIN] 프론트엔드 응답 데이터:', frontendData);

      if (frontendData.mt_idx) {
        const userData = frontendData;
        console.log('✅ [AUTO-LOGIN] 사용자 정보 조회 성공:', userData.mt_name);

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

      } else {
        console.error('❌ [AUTO-LOGIN] 백엔드 응답에 사용자 정보 없음:', backendData);
        return NextResponse.json(
          { success: false, error: '사용자 정보를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

    } catch (frontendError) {
      console.error('❌ [AUTO-LOGIN] 프론트엔드 API 호출 실패:', frontendError);
      return NextResponse.json(
        { success: false, error: '사용자 정보 조회에 실패했습니다.' },
        { status: 503 }
      );
    }

  } catch (error) {
    console.error('❌ [AUTO-LOGIN] 자동 로그인 API 오류:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
