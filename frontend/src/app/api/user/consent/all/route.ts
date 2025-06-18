import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // 헤더에서 인증 토큰 확인
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: '인증 토큰이 필요합니다.' },
        { status: 401 }
      );
    }

    const token = authorization.split(' ')[1];
    const { mt_idx, mt_agree1, mt_agree2, mt_agree3, mt_agree4, mt_agree5 } = await request.json();

    // 모든 값이 'Y' 또는 'N'인지 확인
    const agreeValues = [mt_agree1, mt_agree2, mt_agree3, mt_agree4, mt_agree5];
    const validValues = agreeValues.every(value => ['Y', 'N'].includes(value));
    
    if (!validValues) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 동의 값입니다.' },
        { status: 400 }
      );
    }

    // 백엔드 API 호출
    const backendResponse = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3000'}/api/member/consent/all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        mt_idx,
        mt_agree1,
        mt_agree2,
        mt_agree3,
        mt_agree4,
        mt_agree5
      }),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      return NextResponse.json(
        { success: false, message: errorData.message || '전체 동의 처리에 실패했습니다.' },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();

    return NextResponse.json({
      success: true,
      message: '전체 동의가 성공적으로 처리되었습니다.',
      data: result.data
    });

  } catch (error) {
    console.error('전체 동의 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 