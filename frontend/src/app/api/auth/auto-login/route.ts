import { NextRequest, NextResponse } from 'next/server';

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

    console.log('자동 로그인 요청:', { mt_idx, action });

    // 백엔드 API 호출하여 자동 로그인 처리
    const backendResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/auto-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mt_idx: parseInt(mt_idx),
        action: 'auto-login'
      }),
    });

    const backendData = await backendResponse.json();

    if (backendResponse.ok && backendData.success) {
      console.log('백엔드 자동 로그인 성공:', backendData);
      
      // 백엔드에서 받은 토큰과 사용자 정보를 그대로 반환
      return NextResponse.json({
        success: true,
        data: {
          token: backendData.data.token,
          user: backendData.data.user
        }
      });
    } else {
      console.error('백엔드 자동 로그인 실패:', backendData);
      return NextResponse.json(
        { success: false, error: backendData.error || '자동 로그인에 실패했습니다.' },
        { status: backendResponse.status }
      );
    }

  } catch (error) {
    console.error('자동 로그인 API 오류:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
