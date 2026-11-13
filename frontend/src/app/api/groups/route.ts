import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '../_utils/backend';
import { verifyBackendAuth, extractAuthToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { user, token, errorResponse } = await verifyBackendAuth(request);
    if (errorResponse || !user || !token) {
      return errorResponse ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const mt_idx = user.mt_idx.toString();

    const backendBase = resolveBackendBaseUrl();
    const backendUrl = `${backendBase}/api/v1/groups/member/${mt_idx}`;
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Groups API] 백엔드 에러 응답:', response.status, errorText);
      return NextResponse.json(
        { success: false, message: '그룹 목록을 가져오는데 실패했습니다.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('[Groups API] 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '그룹 목록을 가져오는데 실패했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();

    const enhancedBody = {
      ...body,
      _timestamp: Date.now(),
      _force_refresh: true
    };

    const backendBase = resolveBackendBaseUrl();
    const backendUrl = `${backendBase}/api/v1/groups`;

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Force-Refresh': 'true',
        'X-Timestamp': Date.now().toString(),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(enhancedBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Groups API] 백엔드 에러 응답:', response.status, errorText);
      return NextResponse.json(
        { success: false, message: '그룹 생성에 실패했습니다.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const responseObj = NextResponse.json({
      success: true,
      data: data
    });
    
    responseObj.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    responseObj.headers.set('Pragma', 'no-cache');
    responseObj.headers.set('Expires', '0');
    responseObj.headers.set('X-Force-Refresh', 'true');
    responseObj.headers.set('X-Timestamp', Date.now().toString());
    
    return responseObj;

  } catch (error) {
    console.error('[Groups API] 그룹 생성 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '그룹 생성에 실패했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 