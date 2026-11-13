import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message: '지원하지 않는 로그인 방식입니다. 전용 소셜 로그인 API(/api/google-auth, /api/auth/apple-login, /api/kakao-auth)를 사용해주세요.'
    },
    { status: 400 }
  );
}