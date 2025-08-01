import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // phone, email
    const value = searchParams.get('value');

    if (!type || !value) {
      return NextResponse.json(
        { error: '타입과 값이 필요합니다.' },
        { status: 400 }
      );
    }

    if (type !== 'phone' && type !== 'email') {
      return NextResponse.json(
        { error: '지원하지 않는 타입입니다. phone 또는 email을 사용해주세요.' },
        { status: 400 }
      );
    }

    console.log(`[CHECK_USER] 사용자 확인 요청: ${type} = ${value.substring(0, 3)}***`);

    // 백엔드 API 호출
    const backendUrl = process.env.BACKEND_URL || 'https://118.67.130.71:8000';
    const backendResponse = await fetch(`${backendUrl}/api/v1/members/check/${type}/${encodeURIComponent(value)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10초 타임아웃
    });

    const backendData = await backendResponse.json();

    if (!backendResponse.ok) {
      console.error('[CHECK_USER] 백엔드 에러:', backendData);
      return NextResponse.json(
        { error: backendData.message || '사용자 확인 중 오류가 발생했습니다.' },
        { status: backendResponse.status }
      );
    }

    console.log('[CHECK_USER] 사용자 확인 성공:', backendData);

    return NextResponse.json(backendData);

  } catch (error) {
    console.error('[CHECK_USER] 사용자 확인 오류:', error);
    
    // 백엔드 서버 연결 실패 시 임시로 성공 응답 반환 (개발 환경)
    if (process.env.NODE_ENV === 'development') {
      console.warn('[CHECK_USER] 개발 환경 - 백엔드 연결 실패로 임시 성공 응답');
      return NextResponse.json({
        available: false, // 사용자가 존재한다고 가정
        message: "사용자 확인 완료 (임시)"
      });
    }
    
    return NextResponse.json(
      { error: '사용자 확인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 