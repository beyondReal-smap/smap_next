import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // 헤더에서 토큰 추출
    const token = request.headers.get('authorization')?.replace('Bearer ', '');

    // TODO: 실제 백엔드 API 호출
    // const response = await axios.post('http://your-backend-api/auth/logout', {}, {
    //   headers: { Authorization: `Bearer ${token}` }
    // });

    // 로그아웃은 클라이언트에서 토큰 제거하는 것이 주된 로직이므로 간단히 성공 응답
    return NextResponse.json({
      success: true,
      message: '로그아웃되었습니다.'
    });

  } catch (error) {
    console.error('[API] 로그아웃 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 