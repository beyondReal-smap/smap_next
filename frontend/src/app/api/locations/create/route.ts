import { NextRequest, NextResponse } from 'next/server';
import { verifyBackendAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { user, token, errorResponse } = await verifyBackendAuth(request);
    if (errorResponse || !user || !token) {
      return errorResponse ?? NextResponse.json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();

    const memberId = body.mt_idx || body.insert_mt_idx || user.mt_idx;
    if (!memberId) {
      return NextResponse.json(
        { success: false, message: '회원 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const backendBase = process.env.BACKEND_URL || 'https://api3.aiagnt.kr';
    const backendUrl = `${backendBase}/api/v1/locations/members/${memberId}/locations`;

    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (backendResponse.ok) {
      const result = await backendResponse.json();
      return NextResponse.json(
        {
          success: true,
          message: 'Location created successfully',
          data: result
        },
        { status: 201 }
      );
    } else {
      const errorText = await backendResponse.text().catch(() => '');
      console.error('[Location Create API] 백엔드 에러 응답:', backendResponse.status, errorText);
      return NextResponse.json(
        {
          success: false,
          message: '장소 생성에 실패했습니다.',
          error: errorText || undefined,
        },
        { status: backendResponse.status }
      );
    }
  } catch (error) {
    console.error('[Location Create API] 전체 에러:', error);
    return NextResponse.json(
      {
        success: false,
        message: '장소 생성 중 서버 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
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