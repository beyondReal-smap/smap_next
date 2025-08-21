import { NextRequest, NextResponse } from 'next/server';
import { resolveBackendBaseUrl } from '../../_utils/backend';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mt_idx, fcm_token, device_type, platform } = body;

    if (!mt_idx || !fcm_token) {
      console.error('[Member FCM Token API] ❌ 필수 파라미터 누락:', { mt_idx, hasToken: !!fcm_token });
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
    const backendUrl = `${backendBase}/api/v1/member-fcm-token/check-and-update`;

    console.log('[Member FCM Token API] 📡 백엔드 요청 시작:', {
      backendUrl,
      mt_idx,
      token_length: fcm_token.length,
      device_type,
      platform
    });

    // 요청 헤더에 인증 토큰 포함
    const authHeader = request.headers.get('authorization');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
      console.log('[Member FCM Token API] 🔐 인증 토큰 포함됨');
    } else {
      console.log('[Member FCM Token API] ⚠️ 인증 토큰 없음');
    }

    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        mt_idx: mt_idx,
        fcm_token: fcm_token,
        device_type: device_type || 'unknown',
        platform: platform || 'unknown'
      }),
    });

    const data = await backendResponse.json();
    
    console.log('[Member FCM Token API] 📡 백엔드 응답:', {
      status: backendResponse.status,
      success: data.success,
      message: data.message,
      has_token: data.has_token,
      token_preview: data.token_preview
    });

    if (!backendResponse.ok) {
      console.error('[Member FCM Token API] ❌ 백엔드 오류:', {
        status: backendResponse.status,
        data
      });
    }

    return NextResponse.json(data, { status: backendResponse.status });

  } catch (error) {
    console.error('[Member FCM Token API] ❌ 서버 오류:', error);
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
