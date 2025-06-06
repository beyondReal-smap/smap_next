import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');
    const date = searchParams.get('date');

    if (!groupId) {
      return NextResponse.json({ error: 'group_id 파라미터가 필요합니다' }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: 'date 파라미터가 필요합니다' }, { status: 400 });
    }

    const backendUrl = `${BACKEND_URL}/api/v1/logs/member-activity?group_id=${groupId}&date=${date}`;
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Backend API Error:', errorData);
      return NextResponse.json(
        { error: '멤버 활동 조회 실패', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 