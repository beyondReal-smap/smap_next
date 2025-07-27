import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }

    // JWT 토큰 검증
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET || 'default-secret') as any;
    
    return NextResponse.json({
      success: true,
      user: {
        id: decoded.userId,
        email: decoded.email,
        nickname: decoded.nickname,
        provider: 'kakao'
      }
    });

  } catch (error) {
    console.error('인증 확인 오류:', error);
    return NextResponse.json(
      { error: '인증 정보가 유효하지 않습니다.' },
      { status: 401 }
    );
  }
} 