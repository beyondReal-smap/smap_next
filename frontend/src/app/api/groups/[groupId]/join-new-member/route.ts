import { NextRequest, NextResponse } from 'next/server';
import { verifyBackendAuth } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  try {
    const { user, token, errorResponse } = await verifyBackendAuth(request);
    if (errorResponse || !user || !token) {
      return errorResponse ?? NextResponse.json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const params = await context.params;
    const body = await request.json().catch(() => ({}));
    const requestedMtIdx = body?.mt_idx;

    if (requestedMtIdx !== undefined && Number(requestedMtIdx) !== Number(user.mt_idx)) {
      return NextResponse.json(
        { success: false, message: '본인 계정만 그룹에 가입할 수 있습니다.' },
        { status: 403 }
      );
    }

    const mt_idx = user.mt_idx;
    const groupId = parseInt(params.groupId);

    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'https://api3.aiagnt.kr';
    const response = await fetch(`${backendUrl}/api/v1/groups/${groupId}/join-new-member`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        mt_idx: mt_idx,
        sgt_idx: groupId
      }),
    });

    console.log(`[GROUP JOIN NEW MEMBER API] 백엔드 응답 상태: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[GROUP JOIN NEW MEMBER API] 백엔드 오류:`, errorData);
      
      return NextResponse.json(
        { 
          success: false, 
          message: errorData.detail || errorData.message || '그룹 가입에 실패했습니다.' 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[GROUP JOIN NEW MEMBER API] 그룹 가입 성공');

    return NextResponse.json({
      success: true,
      message: '새 회원이 그룹에 성공적으로 가입되었습니다.',
      data: data
    });

  } catch (error) {
    console.error('[GROUP JOIN NEW MEMBER API] 오류:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: '서버 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
} 