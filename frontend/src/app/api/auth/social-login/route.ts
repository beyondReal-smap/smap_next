import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, token } = body;

    // 소셜 로그인 처리 로직
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/${provider}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || '소셜 로그인에 실패했습니다.');
    }

    // 로그인 성공 시 세션/토큰 처리
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || '소셜 로그인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 