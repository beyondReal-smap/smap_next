import { NextRequest, NextResponse } from 'next/server';
import { resolveBackendBaseUrl } from '../../_utils/backend';

export async function POST(request: NextRequest) {
  console.log('[FCM Token API] 🚫 FCM API 비활성화됨 - iOS 네이티브에서 FCM 토큰 관리');

  return NextResponse.json(
    {
      resultCode: 403,
      resultMsg: 'FCM 토큰 업데이트는 iOS 네이티브에서만 처리됩니다.',
      resultData: null
    },
    { status: 403 }
  );
}
