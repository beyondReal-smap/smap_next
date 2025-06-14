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

    const { mt_idx, field, value } = await request.json();

    // 유효한 동의 필드인지 확인
    const validFields = ['mt_agree1', 'mt_agree2', 'mt_agree3', 'mt_agree4', 'mt_agree5'];
    if (!validFields.includes(field)) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 필드입니다.' },
        { status: 400 }
      );
    }

    // 유효한 값인지 확인
    if (!['Y', 'N'].includes(value)) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 값입니다.' },
        { status: 400 }
      );
    }

    // 백엔드 API 호출
    const backendResponse = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3001'}/api/member/consent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        mt_idx,
        field,
        value
      }),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      return NextResponse.json(
        { success: false, message: errorData.message || '동의 상태 변경에 실패했습니다.' },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();

    return NextResponse.json({
      success: true,
      message: '동의 상태가 성공적으로 변경되었습니다.',
      data: result.data
    });

  } catch (error) {
    console.error('동의 상태 변경 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 