import { NextRequest, NextResponse } from 'next/server';

interface VerifyTokenRequest {
  token: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: VerifyTokenRequest = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { message: '토큰이 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('[VERIFY RESET TOKEN] 토큰 검증 요청:', {
      tokenLength: token.length,
      timestamp: new Date().toISOString()
    });

    // 백엔드 API 호출
    try {
      const backendUrl = process.env.BACKEND_URL || 'https://118.67.130.71:8000';
      const backendResponse = await fetch(`${backendUrl}/api/v1/auth/verify-reset-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
        }),
      });

      const backendData = await backendResponse.json();

      if (!backendResponse.ok) {
        console.error('[VERIFY RESET TOKEN] 백엔드 에러:', backendData);
        return NextResponse.json(
          { message: backendData.message || '토큰이 유효하지 않습니다.' },
          { status: backendResponse.status }
        );
      }

      console.log('[VERIFY RESET TOKEN] 토큰 검증 성공');

      return NextResponse.json({
        success: true,
        message: '토큰이 유효합니다.',
        data: backendData.data
      });

    } catch (backendError) {
      console.error('[VERIFY RESET TOKEN] 백엔드 연결 실패:', backendError);
      
      // 개발 환경에서는 임시로 성공 처리 (테스트용)
      if (process.env.NODE_ENV === 'development') {
        console.log('[VERIFY RESET TOKEN] 개발 환경 - 임시 성공 처리');
        return NextResponse.json({
          success: true,
          message: '토큰이 유효합니다.',
          dev: true
        });
      }
      
      return NextResponse.json(
        { message: '서버 연결에 실패했습니다.' },
        { status: 503 }
      );
    }

  } catch (error) {
    console.error('[VERIFY RESET TOKEN] API 오류:', error);
    return NextResponse.json(
      { message: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}