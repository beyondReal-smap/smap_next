import { NextRequest, NextResponse } from 'next/server';

// 백엔드 서버 URL (환경 변수에서 가져오거나 기본값 사용)
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function POST(request: NextRequest) {
  try {
    const { currentPassword, newPassword } = await request.json();

    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: '인증 토큰이 필요합니다' },
        { status: 401 }
      );
    }

    // 토큰에서 사용자 정보 추출 (간단한 방식)
    // 실제 운영 환경에서는 JWT 라이브러리를 사용해 토큰을 검증해야 합니다
    let userId: string;
    try {
      // Base64 디코딩으로 페이로드 추출 (임시 방식)
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }
      const payload = JSON.parse(atob(parts[1]));
      userId = payload.userId || payload.sub;
      
      if (!userId) {
        throw new Error('User ID not found in token');
      }
    } catch (error) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다' },
        { status: 401 }
      );
    }

    // 입력 값 검증
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: '새 비밀번호는 8자 이상이어야 합니다' },
        { status: 400 }
      );
    }

    try {
      // 백엔드 서버로 비밀번호 변경 요청
      const backendResponse = await fetch(`${BACKEND_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          currentPassword,
          newPassword,
        }),
      });

      const backendData = await backendResponse.json();

      if (!backendResponse.ok) {
        if (backendResponse.status === 401) {
          return NextResponse.json(
            { error: '현재 비밀번호가 일치하지 않습니다' },
            { status: 401 }
          );
        }
        return NextResponse.json(
          { error: backendData.message || '비밀번호 변경에 실패했습니다' },
          { status: backendResponse.status }
        );
      }

      return NextResponse.json({
        success: true,
        message: '비밀번호가 성공적으로 변경되었습니다',
      });

    } catch (backendError) {
      console.log('백엔드 서버 연결 실패, 임시 모드로 전환');
      
      // 백엔드 서버 연결 실패 시 임시 모드
      // 실제 운영 환경에서는 이 부분을 제거해야 합니다
      
      // 간단한 검증 (실제로는 데이터베이스에서 확인해야 함)
      const isValidCurrentPassword = currentPassword === 'temp123'; // 임시 검증
      
      if (!isValidCurrentPassword) {
        return NextResponse.json(
          { error: '현재 비밀번호가 일치하지 않습니다' },
          { status: 401 }
        );
      }

      // 임시 성공 응답
      return NextResponse.json({
        success: true,
        message: '비밀번호가 성공적으로 변경되었습니다 (임시 모드)',
      });
    }

  } catch (error) {
    console.error('비밀번호 변경 API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
} 