import { NextRequest, NextResponse } from 'next/server';
import { extractAuthToken } from '@/lib/auth';

async function fetchBackend(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Next.js API Proxy',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const err: any = new Error(`API error: ${response.status} - ${errorText}`);
    err.status = response.status;
    throw err;
  }

  return await response.json();
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; memberId: string }> }
) {
  try {
    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json({ success: false, message: '인증 토큰이 필요합니다.' }, { status: 401 });
    }
    const authHeaders: Record<string, string> = { Authorization: `Bearer ${token}` };
    const { groupId, memberId } = await params;

    const backendBase = process.env.BACKEND_URL || 'https://api3.aiagnt.kr';
    const membersUrl = `${backendBase}/api/v1/group-members/member/${groupId}`;
    const members = await fetchBackend(membersUrl, { headers: authHeaders });

    const targetMember = Array.isArray(members)
      ? members.find((member: any) => member.mt_idx === parseInt(memberId))
      : null;

    if (!targetMember) {
      return NextResponse.json(
        { success: false, message: '그룹에서 해당 멤버를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const updateData = {
      sgdt_show: 'N',
      sgdt_exit: 'Y'
    };

    const updateUrl = `${backendBase}/api/v1/groups/${groupId}/members/${memberId}/remove`;
    const result = await fetchBackend(updateUrl, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(updateData),
    });

    return NextResponse.json({
      success: true,
      message: '멤버가 그룹에서 탈퇴되었습니다.',
      data: {
        sgdt_idx: result.sgdt_idx || targetMember.sgdt_idx,
        sgdt_show: 'N',
        sgdt_exit: 'Y',
        sgdt_udate: result.sgdt_udate || new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('[Member Remove API] 멤버 탈퇴 처리 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '멤버 탈퇴 처리에 실패했습니다.',
      },
      { status: error?.status || 500 }
    );
  }
}