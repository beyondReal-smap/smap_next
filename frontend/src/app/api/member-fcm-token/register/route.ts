import { NextRequest, NextResponse } from 'next/server';
import { resolveBackendBaseUrl } from '../../_utils/backend';

export async function POST(request: NextRequest) {
  try {
    const { mt_idx, fcm_token, platform } = await request.json();

    console.log('[Member FCM Register API] FCM 토큰 등록 요청:', {
      mt_idx,
      platform,
      tokenLength: fcm_token?.length,
      userAgent: request.headers.get('user-agent')?.substring(0, 100)
    });

    // 플랫폼에 따른 처리
    if (platform === 'android' || platform === 'web') {
      console.log('[Member FCM Register API] 📱 안드로이드/Web 플랫폼 FCM 토큰 등록 처리');

      // 백엔드 API 호출
      const backendUrl = resolveBackendBaseUrl('/api/v1/members/fcm-token');
      console.log('[Member FCM Register API] 백엔드 URL:', backendUrl);

      const backendResponse = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mt_idx,
          fcm_token,
          platform
        }),
      });

      const backendData = await backendResponse.json();
      console.log('[Member FCM Register API] 백엔드 응답:', backendData);

      if (backendResponse.ok && backendData.success) {
        return NextResponse.json({
          success: true,
          message: 'FCM 토큰이 성공적으로 등록되었습니다.',
          mt_idx,
          has_token: true,
          token_preview: fcm_token?.substring(0, 20) + '...'
        });
      } else {
        console.error('[Member FCM Register API] 백엔드 오류:', backendData);
        return NextResponse.json({
          success: false,
          message: backendData.message || 'FCM 토큰 등록에 실패했습니다.',
          mt_idx: null,
          has_token: false,
          token_preview: null
        }, { status: backendResponse.status });
      }
    } else {
      console.log('[Member FCM Register API] 🚫 iOS 플랫폼 - 네이티브에서 FCM 토큰 관리');
      return NextResponse.json(
        {
          success: false,
          message: 'FCM 토큰 등록은 iOS 네이티브에서만 처리됩니다.',
          mt_idx: null,
          has_token: false,
          token_preview: null
        },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error('[Member FCM Register API] 예외 발생:', error);
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
