import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('[AUTH CALLBACK] API 호출됨');
    
    const body = await request.json();
    const { tokenId, lat, long } = body;
    
    console.log('[AUTH CALLBACK] 요청 데이터:', { 
      hasTokenId: !!tokenId, 
      lat, 
      long 
    });
    
    if (!tokenId) {
      console.error('[AUTH CALLBACK] 토큰이 없음');
      return NextResponse.json(
        { success: false, error: '토큰이 필요합니다.' },
        { status: 400 }
      );
    }

    // 백엔드 API로 토큰 전송
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.smap.site';
    const response = await fetch(`${backendUrl}/api/auth/google/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokenId,
        lat,
        long,
      }),
    });

    const data = await response.json();
    console.log('[AUTH CALLBACK] 백엔드 응답:', {
      status: response.status,
      success: data.success,
      hasUser: !!data.user,
      hasToken: !!data.token
    });

    if (response.ok && data.success) {
      // 성공 시 쿠키에 토큰 설정
      const response = NextResponse.json({
        success: true,
        user: data.user,
        message: '인증이 완료되었습니다.'
      });

      if (data.token) {
        response.cookies.set('auth-token', data.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60, // 7일
        });
      }

      return response;
    } else {
      console.error('[AUTH CALLBACK] 백엔드 인증 실패:', data.error);
      return NextResponse.json(
        { success: false, error: data.error || '인증에 실패했습니다.' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[AUTH CALLBACK] 처리 중 오류:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 