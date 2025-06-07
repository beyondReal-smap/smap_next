import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // phone, email, nickname
    const value = searchParams.get('value');

    if (!type || !value) {
      return NextResponse.json(
        { error: '타입과 값이 필요합니다.' },
        { status: 400 }
      );
    }

    // 백엔드 API 호출
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    const backendResponse = await fetch(`${backendUrl}/api/v1/members/check/${type}/${encodeURIComponent(value)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const backendData = await backendResponse.json();

    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: backendData.message || '확인 중 오류가 발생했습니다.' },
        { status: backendResponse.status }
      );
    }

    return NextResponse.json(backendData);

  } catch (error) {
    console.error('중복 확인 오류:', error);
    return NextResponse.json(
      { error: '중복 확인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 