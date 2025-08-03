import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    
    if (!code) {
      return NextResponse.json(
        { error: '초대 코드가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('[Group Code API] 초대 코드로 그룹 조회:', code);

    // 백엔드 API 호출
    const backendUrl = `https://118.67.130.71:8000/api/v1/groups/code/${code}`;
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Group Code API] 백엔드 오류:', response.status, errorData);
      
      if (response.status === 404) {
        return NextResponse.json(
          { error: '유효하지 않은 초대 코드입니다.' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: '그룹 정보 조회 중 오류가 발생했습니다.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Group Code API] 그룹 정보 조회 성공:', data);

    return NextResponse.json(data);

  } catch (error) {
    console.error('[Group Code API] 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 