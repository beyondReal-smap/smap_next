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

    // 토큰 길이 검증 (8자리가 아니면 실패)
    if (token.length !== 8) {
      console.log('[VERIFY RESET TOKEN] 토큰 길이 검증 실패:', token.length);
      return NextResponse.json(
        { message: '유효하지 않은 토큰입니다.' },
        { status: 400 }
      );
    }

    // 백엔드 API 호출
    console.log('[VERIFY RESET TOKEN] 백엔드 API 호출 시작');
    try {
      const backendUrl = 'https://api3.aiagnt.kr/api/v1/auth/verify-reset-token';
      
      console.log('[VERIFY RESET TOKEN] 백엔드 URL:', backendUrl);
      console.log('[VERIFY RESET TOKEN] 요청 데이터:', { 
        tokenLength: token.length
      });

      const backendResponse = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
        }),
        // 타임아웃 설정 (10초로 증가)
        signal: AbortSignal.timeout(10000)
      });

      console.log('[VERIFY RESET TOKEN] 백엔드 응답 상태:', backendResponse.status);
      console.log('[VERIFY RESET TOKEN] 백엔드 응답 헤더:', Object.fromEntries(backendResponse.headers.entries()));

      const backendData = await backendResponse.json();

      if (!backendResponse.ok) {
        // 백엔드에서 오류 응답이 온 경우
        console.error('[VERIFY RESET TOKEN] 백엔드 오류:', backendResponse.status);
        return NextResponse.json(
          { 
            success: false, 
            message: backendData.message || '토큰이 유효하지 않습니다.' 
          },
          { status: backendResponse.status }
        );
      }

      // 백엔드 응답을 그대로 전달
      console.log('[VERIFY RESET TOKEN] 백엔드 응답 처리:', {
        success: backendData.success,
        message: backendData.message,
        data: backendData.data
      });
      return NextResponse.json(backendData);

    } catch (backendError) {
      console.error('[VERIFY RESET TOKEN] 백엔드 연결 실패:', backendError);
      return NextResponse.json(
        { message: '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 503 }
      );
    }

  } catch (error: any) {
    console.error('[VERIFY RESET TOKEN] API 오류:', error);
    return NextResponse.json(
      { message: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}