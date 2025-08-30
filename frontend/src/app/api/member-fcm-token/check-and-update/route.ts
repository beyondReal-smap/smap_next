import { NextRequest, NextResponse } from 'next/server';
import { resolveBackendBaseUrl } from '../../_utils/backend';

export async function POST(request: NextRequest) {
  console.log('[Member FCM Token API] 🚫 FCM API 비활성화됨 - iOS 네이티브에서 FCM 토큰 관리');

  return NextResponse.json(
    {
      success: false,
      message: 'FCM 토큰 확인 및 업데이트는 iOS 네이티브에서만 처리됩니다.',
      mt_idx: null,
      has_token: false,
      token_preview: null
    },
    { status: 403 }
  );
}
