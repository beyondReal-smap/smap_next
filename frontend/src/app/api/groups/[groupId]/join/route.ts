import { NextRequest, NextResponse } from 'next/server';
import { verifyBackendAuth } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { user, token, errorResponse } = await verifyBackendAuth(request);
    if (errorResponse || !user || !token) {
      return errorResponse ?? NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 });
    }

    const { groupId } = await params;
    const body = await request.json().catch(() => ({}));
    const mt_idx = user.mt_idx;
    const sgt_idx = body.sgt_idx || Number(groupId);

    if (!mt_idx || !sgt_idx) {
      return NextResponse.json(
        { error: '사용자 ID와 그룹 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('[Group Join API] 그룹 가입 시도:', { mt_idx, sgt_idx });

    // 백엔드 API 호출
    const backendBase = process.env.BACKEND_URL || 'https://api3.aiagnt.kr';
    const backendUrl = `${backendBase}/api/v1/groups/${groupId}/join`;
    
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        mt_idx,
        sgt_idx
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Group Join API] 백엔드 오류:', response.status, errorData);
      
      if (response.status === 400 && errorData.detail?.includes('이미 그룹에 가입되어 있습니다')) {
        return NextResponse.json(
          { error: '이미 가입된 그룹입니다.' },
          { status: 409 }
        );
      }
      
      if (response.status === 409) {
        return NextResponse.json(
          { error: '이미 가입된 그룹입니다.' },
          { status: 409 }
        );
      }
      
      if (response.status === 404) {
        return NextResponse.json(
          { error: '존재하지 않는 그룹입니다.' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: '그룹 가입 중 오류가 발생했습니다.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Group Join API] 그룹 가입 성공');

    return NextResponse.json(data);

  } catch (error) {
    console.error('[Group Join API] 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 