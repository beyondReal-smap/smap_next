import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '../../../../../_utils/backend';
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
    const body = await request.json();

    const backendBase = resolveBackendBaseUrl();
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
      sgdt_leader_chk: body.sgdt_leader_chk === 'Y' ? 'Y' : 'N'
    };

    const updateUrl = `${backendBase}/api/v1/group-details/${targetMember.sgdt_idx}`;
    const result = await fetchBackend(updateUrl, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(updateData),
    });

    return NextResponse.json({
      success: true,
      message: '멤버 역할이 성공적으로 변경되었습니다.',
      data: {
        sgdt_idx: result.sgdt_idx || targetMember.sgdt_idx,
        sgdt_leader_chk: updateData.sgdt_leader_chk,
        sgdt_udate: result.sgdt_udate || new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('[Member Role API] 멤버 역할 변경 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '멤버 역할 변경에 실패했습니다.',
      },
      { status: error?.status || 500 }
    );
  }
}