import { NextRequest, NextResponse } from 'next/server';
import { resolveBackendBaseUrl } from '../../_utils/backend';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mt_idx, fcm_token } = body;

    if (!mt_idx || !fcm_token) {
      return NextResponse.json(
        { 
          success: false,
          message: 'mt_idx와 fcm_token이 필요합니다.',
          mt_idx: null,
          has_token: false,
          token_preview: null
        },
        { status: 400 }
      );
    }

    const backendBase = resolveBackendBaseUrl();
    const backendUrl = `${backendBase}/api/v1/member-fcm-token/register`;

    console.log('[Member FCM Register API] 백엔드 요청:', backendUrl);
    console.log('[Member FCM Register API] 요청 데이터:', { mt_idx, token_length: fcm_token.length });

    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mt_idx: mt_idx,
        fcm_token: fcm_token
      }),
    });

    const data = await backendResponse.json();
    
    console.log('[Member FCM Register API] 백엔드 응답:', {
      status: backendResponse.status,
      success: data.success,
      message: data.message
    });

    return NextResponse.json(data, { status: backendResponse.status });

  } catch (error) {
    console.error('[Member FCM Register API] 오류:', error);
    return NextResponse.json(
      { 
        success: false,
        message: '서버 오류가 발생했습니다.',
        mt_idx: null,
        has_token: false,
        token_preview: null
      },
      { status: 500 }
    );
  }
}
