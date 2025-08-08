import { NextRequest, NextResponse } from 'next/server';

interface ForgotPasswordRequest {
  type: 'phone' | 'email';
  contact: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ForgotPasswordRequest = await request.json();
    const { type, contact } = body;

    if (!type || !contact) {
      return NextResponse.json(
        { message: '타입과 연락처가 모두 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('[FORGOT PASSWORD] 비밀번호 재설정 요청:', {
      type,
      contact: type === 'phone' ? contact.substring(0, 3) + '****-' + contact.substring(7) : contact,
      timestamp: new Date().toISOString()
    });

    // 백엔드 API 호출
    console.log('[FORGOT PASSWORD] 백엔드 API 호출 시작');
    try {
      const backendUrl = 'https://api3.smap.site/api/v1/auth/forgot-password';
      
      console.log('[FORGOT PASSWORD] 백엔드 URL:', backendUrl);
      console.log('[FORGOT PASSWORD] 요청 데이터:', { 
        type, 
        contact: type === 'phone' ? contact.substring(0, 3) + '***' : contact 
      });
      
      // SSL 인증서 문제 해결을 위한 설정
      process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

      const backendResponse = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          contact,
        }),
        // 타임아웃 설정 (10초로 증가)
        signal: AbortSignal.timeout(10000)
      });

      console.log('[FORGOT PASSWORD] 백엔드 응답 상태:', backendResponse.status);
      console.log('[FORGOT PASSWORD] 백엔드 응답 헤더:', Object.fromEntries(backendResponse.headers.entries()));

      const backendData = await backendResponse.json();
      console.log('[FORGOT PASSWORD] 백엔드 응답 데이터:', backendData);

      if (!backendResponse.ok) {
        // 백엔드에서 오류 응답이 온 경우
        console.error('[FORGOT PASSWORD] 백엔드 오류:', backendResponse.status, backendData);
        return NextResponse.json(
          { 
            success: false, 
            message: backendData.message || '비밀번호 재설정 요청에 실패했습니다.' 
          },
          { status: backendResponse.status }
        );
      }

      // 백엔드 응답을 그대로 전달
      console.log('[FORGOT PASSWORD] 백엔드 응답 처리:', {
        success: backendData.success,
        message: backendData.message,
        data: backendData.data
      });
      return NextResponse.json(backendData);

    } catch (backendError) {
      console.error('[FORGOT PASSWORD] 백엔드 연결 실패:', backendError);
      
      // 개발 환경에서는 Mock 데이터 반환
      if (process.env.NODE_ENV === 'development') {
        console.log('[FORGOT PASSWORD] 개발 환경 - Mock 데이터 반환');
        return NextResponse.json({
          success: true,
          message: type === 'phone' 
            ? 'SMS로 비밀번호 재설정 링크를 발송했습니다.' 
            : '이메일로 비밀번호 재설정 링크를 발송했습니다.',
          data: {
            type,
            contact: type === 'phone' ? contact : contact,
            token_expires: "1분",
            sent: true
          },
          dev: true
        });
      }
      
      // 프로덕션에서는 에러 반환
      return NextResponse.json(
        { message: '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 503 }
      );
    }
    
  } catch (error: any) {
    console.error('[FORGOT PASSWORD] API 오류:', error);
    return NextResponse.json(
      { message: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}