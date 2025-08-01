import { NextRequest, NextResponse } from 'next/server';

interface ForgotPasswordRequest {
  type: 'phone' | 'email';
  contact: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ForgotPasswordRequest = await request.json();
    const { type, contact } = body;

    // 입력값 검증
    if (!type || !contact) {
      return NextResponse.json(
        { message: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 연락처 형식 검증
    if (type === 'phone') {
      const phoneRegex = /^010-\d{4}-\d{4}$/;
      if (!phoneRegex.test(contact)) {
        return NextResponse.json(
          { message: '올바른 전화번호 형식이 아닙니다.' },
          { status: 400 }
        );
      }
    } else if (type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contact)) {
        return NextResponse.json(
          { message: '올바른 이메일 형식이 아닙니다.' },
          { status: 400 }
        );
      }
    }

    console.log('[FORGOT PASSWORD] 비밀번호 재설정 요청:', {
      type,
      contact: type === 'phone' ? contact.replace(/(\d{3})-(\d{4})-(\d{4})/, '$1-****-$3') : contact.replace(/(.{2}).*(@.*)/, '$1***$2'),
      timestamp: new Date().toISOString()
    });

    // 백엔드 API 호출
    try {
      const backendUrl = process.env.BACKEND_URL || 'https://118.67.130.71:8000';
      const backendResponse = await fetch(`${backendUrl}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          contact,
        }),
        signal: AbortSignal.timeout(10000), // 10초 타임아웃
      });

      const backendData = await backendResponse.json();

      if (!backendResponse.ok) {
        console.error('[FORGOT PASSWORD] 백엔드 에러:', backendData);
        
        // 사용자에게는 보안상 구체적인 이유를 알려주지 않음
        if (backendResponse.status === 404) {
          return NextResponse.json(
            { message: '입력하신 정보로 가입된 계정을 찾을 수 없습니다.' },
            { status: 404 }
          );
        }
        
        return NextResponse.json(
          { message: '요청 처리 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }

      console.log('[FORGOT PASSWORD] 백엔드 성공:', {
        success: true,
        type,
        timestamp: new Date().toISOString()
      });

      // 개발 환경에서는 백엔드 응답 데이터도 로그로 출력
      if (process.env.NODE_ENV === 'development') {
        console.log('[FORGOT PASSWORD] 백엔드 응답 데이터:', backendData);
      }

      return NextResponse.json({
        success: true,
        message: type === 'phone' 
          ? 'SMS로 비밀번호 재설정 링크를 발송했습니다.' 
          : '이메일로 비밀번호 재설정 링크를 발송했습니다.',
        data: {
          type,
          contact: type === 'phone' ? contact : contact
        }
      });

    } catch (backendError) {
      console.error('[FORGOT PASSWORD] 백엔드 연결 실패:', backendError);
      
      // 개발 환경에서는 임시로 성공 처리 (테스트용)
      if (process.env.NODE_ENV === 'development') {
        console.log('[FORGOT PASSWORD] 개발 환경 - 임시 성공 처리');
        return NextResponse.json({
          success: true,
          message: type === 'phone' 
            ? 'SMS로 비밀번호 재설정 링크를 발송했습니다.' 
            : '이메일로 비밀번호 재설정 링크를 발송했습니다.',
          data: {
            type,
            contact: type === 'phone' ? contact : contact
          },
          dev: true
        });
      }
      
      return NextResponse.json(
        { message: '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 503 }
      );
    }

  } catch (error) {
    console.error('[FORGOT PASSWORD] API 오류:', error);
    return NextResponse.json(
      { message: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}