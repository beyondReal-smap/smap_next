import { NextRequest, NextResponse } from 'next/server';
import { extractAuthToken } from '@/lib/auth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(10000),
      });
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Fetch failed');
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  const token = extractAuthToken(request);
  if (!token) {
    return NextResponse.json({ success: false, message: '인증 토큰이 필요합니다.' }, { status: 401, headers: corsHeaders });
  }
  const { memberId } = await context.params;

  try {
    const backendBase = process.env.BACKEND_URL || 'https://api3.aiagnt.kr';
    const backendUrl = `${backendBase}/api/v1/locations/member/${memberId}`;

    const response = await fetchWithRetry(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[API PROXY] 백엔드 에러 응답:', response.status, errorText);
      return NextResponse.json(
        { success: false, message: '장소 데이터를 불러오는데 실패했습니다.' },
        { status: response.status, headers: corsHeaders }
      );
    }

    const responseText = await response.text();
    const data = responseText ? JSON.parse(responseText) : [];

    return NextResponse.json(data, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error(`[API PROXY] 멤버 ${memberId} 장소 조회 실패:`, error);
    return NextResponse.json(
      { success: false, message: '장소 데이터를 불러오는 중 오류가 발생했습니다.' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 