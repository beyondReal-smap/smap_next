import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  try {
    console.log('[VERIFY TOKEN] 토큰 검증 요청 시작');
    
    const { token } = await request.json();
    
    if (!token) {
      console.log('[VERIFY TOKEN] 토큰이 제공되지 않음');
      return NextResponse.json(
        { success: false, message: '토큰이 필요합니다.' },
        { status: 400 }
      );
    }

    // JWT 토큰 검증
    const secret = process.env.NEXTAUTH_SECRET || 'default-secret';
    console.log('[VERIFY TOKEN] JWT 토큰 검증 시작');
    
    const decoded = jwt.verify(token, secret) as any;
    console.log('[VERIFY TOKEN] JWT 토큰 검증 성공:', { userId: decoded.userId, email: decoded.email });

    return NextResponse.json({
      success: true,
      message: '토큰이 유효합니다.',
      user: {
        userId: decoded.userId,
        email: decoded.email,
        nickname: decoded.nickname,
        provider: decoded.provider || 'local'
      }
    });

  } catch (error) {
    console.error('[VERIFY TOKEN] JWT 토큰 검증 실패:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      return NextResponse.json(
        { success: false, message: '토큰이 만료되었습니다.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, message: '토큰 검증 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 