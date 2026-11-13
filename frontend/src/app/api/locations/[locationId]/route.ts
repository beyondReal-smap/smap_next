import { NextRequest, NextResponse } from 'next/server';
import { extractAuthToken } from '@/lib/auth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 장소 숨김 처리를 위한 PATCH 핸들러
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
    const backendBase = process.env.BACKEND_URL || 'https://api3.aiagnt.kr';
    const backendUrl = `${backendBase}/api/v1/locations/${locationId}`;
    const hidePayload = { slt_show: 'N' };

    const response = await fetch(backendUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(hidePayload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[API PROXY] 위치 숨김 처리 백엔드 에러 응답:', response.status, errorText);
      return NextResponse.json(
        { success: false, message: '장소 숨김 처리에 실패했습니다.' },
        { status: response.status, headers: corsHeaders }
      );
    }

    const responseText = await response.text();
    let data;
    if (!responseText) {
      data = { success: true, message: 'Location hidden successfully' };
    } else {
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { success: true, message: 'Location hidden successfully' };
      }
    }

    return NextResponse.json(data, { status: response.status, headers: corsHeaders });
  } catch (error) {
    console.error('[API PROXY] 위치 숨김 처리 오류:', error);
    return NextResponse.json(
      { success: false, message: '장소 숨김 처리 중 오류가 발생했습니다.' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// 장소 완전 삭제를 위한 DELETE 핸들러
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ locationId: string }> }
) {
  const token = extractAuthToken(request);
  if (!token) {
    return NextResponse.json({ success: false, message: '인증 토큰이 필요합니다.' }, { status: 401, headers: corsHeaders });
  }
  const { locationId } = await context.params;
  try {
    const backendBase = process.env.BACKEND_URL || 'https://api3.aiagnt.kr';
    const backendUrl = `${backendBase}/api/v1/locations/${locationId}`;

    const response = await fetch(backendUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[API PROXY] 장소 삭제 백엔드 에러 응답:', response.status, errorText);
      return NextResponse.json(
        { success: false, message: '장소 삭제에 실패했습니다.' },
        { status: response.status, headers: corsHeaders }
      );
    }

    const responseText = await response.text();
    let data;
    if (!responseText) {
      data = { success: true, message: 'Location deleted successfully' };
    } else {
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { success: true, message: 'Location deleted successfully' };
      }
    }

    return NextResponse.json(data, { status: response.status, headers: corsHeaders });
  } catch (error) {
    console.error('[API PROXY] 장소 삭제 오류:', error);
    return NextResponse.json(
      { success: false, message: '장소 삭제 중 오류가 발생했습니다.' },
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