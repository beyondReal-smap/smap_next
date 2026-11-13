import { NextRequest, NextResponse } from 'next/server';
import { extractAuthToken } from '@/lib/auth';

// 멤버 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json({ success: false, message: '인증 토큰이 필요합니다.' }, { status: 401 });
    }
    const { id } = await params;
    const backendBase = process.env.BACKEND_URL || 'https://api3.aiagnt.kr';
    const backendUrl = `${backendBase}/api/v1/members/${id}`;

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'SMAP-NextJS/1.0',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return NextResponse.json(
        { success: false, message: '멤버 정보를 불러오는데 실패했습니다.', detail: errorText || undefined },
        { status: response.status }
      );
    }

    const memberData = await response.json();
    return NextResponse.json(memberData, {
      headers: {
        'X-Data-Source': 'backend-real',
      }
    });
  } catch (error) {
    console.error('[Members API] 멤버 조회 오류:', error);
    return NextResponse.json(
      { success: false, message: '멤버 정보를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// 멤버 정보 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json({ success: false, message: '인증 토큰이 필요합니다.' }, { status: 401 });
    }
    const { id } = await params;
    const updateData = await request.json();

    const backendBase = process.env.BACKEND_URL || 'https://api3.aiagnt.kr';
    const backendUrl = `${backendBase}/api/v1/members/${id}`;

    const response = await fetch(backendUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'SMAP-NextJS/1.0',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(updateData),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return NextResponse.json(
        { success: false, message: '멤버 정보 업데이트에 실패했습니다.', detail: errorText || undefined },
        { status: response.status }
      );
    }

    const updatedMemberData = await response.json();
    return NextResponse.json(updatedMemberData, {
      headers: {
        'X-Data-Source': 'backend-real',
      }
    });
  } catch (error) {
    console.error('[Members API] 멤버 업데이트 오류:', error);
    return NextResponse.json(
      { success: false, message: '멤버 정보 업데이트에 실패했습니다.' },
      { status: 500 }
    );
  }
}
