import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getCurrentUserId } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  try {
    const params = await context.params;
    console.log(`[GROUP JOIN API] 그룹 가입 요청 시작 - groupId: ${params.groupId}`);
    
    // 인증 확인
    const { user, unauthorized } = requireAuth(request);
    if (unauthorized) {
      return NextResponse.json({ error: unauthorized.error }, { status: unauthorized.status });
    }

    const groupId = parseInt(params.groupId);
    const mt_idx = getCurrentUserId(request);

    if (!mt_idx) {
      console.log('[GROUP JOIN API] 인증된 사용자 ID가 없음');
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    console.log(`[GROUP JOIN API] 사용자 정보 - mt_idx: ${mt_idx}, groupId: ${groupId}`);

    // 백엔드 API 호출
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://118.67.130.71:8000';
    const response = await fetch(`${backendUrl}/api/v1/groups/${groupId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
      },
      body: JSON.stringify({
        mt_idx: mt_idx,
        sgt_idx: groupId
      }),
    });

    console.log(`[GROUP JOIN API] 백엔드 응답 상태: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[GROUP JOIN API] 백엔드 오류:`, errorData);
      
      return NextResponse.json(
        { 
          success: false, 
          message: errorData.message || '그룹 가입에 실패했습니다.' 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[GROUP JOIN API] 그룹 가입 성공:`, data);

    return NextResponse.json({
      success: true,
      message: '그룹에 성공적으로 가입되었습니다.',
      data: data
    });

  } catch (error) {
    console.error('[GROUP JOIN API] 오류:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: '서버 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
} 