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
    try {
      const backendUrl = process.env.BACKEND_URL || 'https://118.67.130.71:8000';
      const backendResponse = await fetch(`${backendUrl}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          new_password: newPassword,
        }),
      });

      const backendData = await backendResponse.json();

      // 백엔드 응답의 success 필드를 확인
      if (!backendData.success) {
        console.error('[RESET PASSWORD] 백엔드 비밀번호 재설정 실패:', backendData);
        
        // 토큰 만료/무효 에러 처리
        if (backendData.message && backendData.message.includes('토큰')) {
          return NextResponse.json(
            { message: '토큰이 만료되었거나 유효하지 않습니다.' },
            { status: 400 }
          );
        }
        
        return NextResponse.json(
          { message: backendData.message || '비밀번호 재설정에 실패했습니다.' },
          { status: 400 }
        );
      }

      console.log('[RESET PASSWORD] 비밀번호 재설정 성공');

      return NextResponse.json({
        success: true,
        message: '비밀번호가 성공적으로 변경되었습니다.',
        data: backendData.data
      });

    } catch (backendError) {
      console.error('[RESET PASSWORD] 백엔드 연결 실패:', backendError);
      
      // 개발 환경에서만 임시 성공 처리 (실제 비밀번호 변경 시뮬레이션)
      if (process.env.NODE_ENV === 'development') {
        console.log('[RESET PASSWORD] 개발 환경 - 백엔드 연결 실패로 인한 임시 성공 처리');
        return NextResponse.json({
          success: true,
          message: '비밀번호가 성공적으로 변경되었습니다.',
          dev: true,
          note: '백엔드 연결 실패로 인한 임시 처리입니다.'
        });
      }
      
      // 백엔드 연결 실패 시 에러 메시지 반환
      return NextResponse.json(
        { message: '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 503 }
      );
    }

  } catch (error) {
    console.error('[RESET PASSWORD] API 오류:', error);
    return NextResponse.json(
      { message: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}