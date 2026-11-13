import { NextRequest, NextResponse } from 'next/server';
import { extractAuthToken } from '@/lib/auth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ locationId: string }> }
) {
  const token = extractAuthToken(request);
  if (!token) {
    return NextResponse.json({ success: false, message: '인증 토큰이 필요합니다.' }, { status: 401, headers: corsHeaders });
  }
  const { locationId } = await context.params;
  try {
    const body = await request.json();

    const backendBase = process.env.BACKEND_URL || 'https://api3.aiagnt.kr';
    const backendUrl = `${backendBase}/api/v1/locations/${locationId}/notification`;

    const response = await fetch(backendUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[API PROXY] 위치 알림 설정 업데이트 백엔드 에러 응답:', response.status, errorText);
      return NextResponse.json(
        { success: false, message: '위치 알림 설정 업데이트에 실패했습니다.' },
        { status: response.status, headers: corsHeaders }
      );
    }

    const responseText = await response.text();
    const data = responseText ? JSON.parse(responseText) : { success: true };

    return NextResponse.json(data, { status: response.status, headers: corsHeaders });
  } catch (error) {
    console.error('[API PROXY] 위치 알림 설정 업데이트 오류:', error);
    return NextResponse.json(
      { success: false, message: '위치 알림 설정 업데이트 중 오류가 발생했습니다.' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 