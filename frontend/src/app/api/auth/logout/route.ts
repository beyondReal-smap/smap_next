import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // 헤더에서 토큰 추출
    const token = request.headers.get('authorization')?.replace('Bearer ', '');

    // TODO: 실제 백엔드 API 호출
    // const response = await axios.post('http://your-backend-api/auth/logout', {}, {
    //   headers: { Authorization: `Bearer ${token}` }
    // });

    // 로그아웃 응답 생성 및 쿠키 삭제
    const response = NextResponse.json({
      success: true,
      message: '로그아웃되었습니다.'
    });

    // 쿠키에서 토큰 삭제
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // 즉시 만료
      expires: new Date(0) // 과거 날짜로 설정하여 삭제
    });

    console.log('[LOGOUT API] 쿠키 삭제 완료');
    return response;

  } catch (error) {
    console.error('[API] 로그아웃 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 