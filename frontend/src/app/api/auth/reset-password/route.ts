import { NextRequest, NextResponse } from 'next/server';

interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ResetPasswordRequest = await request.json();
    const { token, newPassword } = body;

    // 입력값 검증
    if (!token || !newPassword) {
      return NextResponse.json(
        { message: '토큰과 새 비밀번호가 모두 필요합니다.' },
        { status: 400 }
      );
    }

    // 토큰 길이 검증 (8자리가 아니면 실패)
    if (token.length !== 8) {
      console.log('[RESET PASSWORD] 토큰 길이 검증 실패:', token.length);
      return NextResponse.json(
        { message: '유효하지 않은 토큰입니다.' },
        { status: 400 }
      );
    }

    // 비밀번호 강도 검증
    if (newPassword.length < 8) {
      return NextResponse.json(
        { message: '비밀번호는 8자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

    if (!hasLetter || !hasNumber || !hasSpecial) {
      return NextResponse.json(
        { message: '비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다.' },
        { status: 400 }
      );
    }

    console.log('[RESET PASSWORD] 비밀번호 재설정 요청:', {
      tokenLength: token.length,
      passwordLength: newPassword.length,
      timestamp: new Date().toISOString()
    });

    // 백엔드 API 호출
    console.log('[RESET PASSWORD] 백엔드 API 호출 시작');
    try {
      const backendUrl = 'https://118.67.130.71:8000/api/v1/auth/reset-password';
      
      console.log('[RESET PASSWORD] 백엔드 URL:', backendUrl);
      console.log('[RESET PASSWORD] 요청 데이터:', { 
        tokenLength: token.length,
        passwordLength: newPassword.length
      });
      
      // SSL 인증서 문제 해결을 위한 설정
      process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

      const backendResponse = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          new_password: newPassword,
        }),
        // 타임아웃 설정 (10초로 증가)
        signal: AbortSignal.timeout(10000)
      });

      console.log('[RESET PASSWORD] 백엔드 응답 상태:', backendResponse.status);
      console.log('[RESET PASSWORD] 백엔드 응답 헤더:', Object.fromEntries(backendResponse.headers.entries()));

      const backendData = await backendResponse.json();
      console.log('[RESET PASSWORD] 백엔드 응답 데이터:', backendData);

      if (!backendResponse.ok) {
        // 백엔드에서 오류 응답이 온 경우
        console.error('[RESET PASSWORD] 백엔드 오류:', backendResponse.status, backendData);
        return NextResponse.json(
          { 
            success: false, 
            message: backendData.message || '비밀번호 재설정에 실패했습니다.' 
          },
          { status: backendResponse.status }
        );
      }

      // 백엔드 응답을 그대로 전달
      console.log('[RESET PASSWORD] 백엔드 응답 처리:', {
        success: backendData.success,
        message: backendData.message,
        data: backendData.data
      });
      return NextResponse.json(backendData);

    } catch (backendError) {
      console.error('[RESET PASSWORD] 백엔드 연결 실패:', backendError);
      
      // 개발 환경에서는 Mock 데이터 반환
      if (process.env.NODE_ENV === 'development') {
        console.log('[RESET PASSWORD] 개발 환경 - Mock 데이터 반환');
        return NextResponse.json({
          success: true,
          message: '비밀번호가 성공적으로 변경되었습니다.',
          data: null,
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
    console.error('[RESET PASSWORD] API 오류:', error);
    return NextResponse.json(
      { message: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}