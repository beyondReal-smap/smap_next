import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '../../_utils/backend';
import { extractAuthToken } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const token = extractAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 });
  }

  const { groupId } = await params;

  try {
    const backendBase = resolveBackendBaseUrl();
    const backendUrl = `${backendBase}/api/v1/groups/${encodeURIComponent(groupId)}`;

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Next.js API Proxy',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Group not found', message: '그룹을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: false, message: '그룹 정보 조회에 실패했습니다.', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    const groupData = {
      sgt_idx: data.sgt_idx,
      sgt_title: data.sgt_title,
      sgt_content: data.sgt_content || data.sgt_memo,
      sgt_memo: data.sgt_memo,
      mt_idx: data.mt_idx,
      sgt_show: data.sgt_show,
      sgt_wdate: data.sgt_wdate,
      memberCount: 0,
    };

    return NextResponse.json(groupData);
  } catch (error) {
    console.error('[Group Get API] 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '그룹 정보 조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const token = extractAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 });
  }

  const { groupId } = await params;

  try {
    const body = await request.json();
    const backendBase = resolveBackendBaseUrl();
    const backendUrl = `${backendBase}/api/v1/groups/${encodeURIComponent(groupId)}`;

    const response = await fetch(backendUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Next.js API Proxy',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, message: '그룹 업데이트에 실패했습니다.', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    const groupData = {
      sgt_idx: data.sgt_idx,
      sgt_title: data.sgt_title,
      sgt_content: data.sgt_content || data.sgt_memo,
      sgt_memo: data.sgt_memo,
      mt_idx: data.mt_idx,
      sgt_show: data.sgt_show,
      sgt_wdate: data.sgt_wdate,
      memberCount: 0,
    };

    return NextResponse.json({
      success: true,
      data: groupData,
      message: '그룹이 성공적으로 업데이트되었습니다.',
    });
  } catch (error) {
    console.error('[Group Update API] 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '그룹 업데이트 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const token = extractAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 });
  }

  const { groupId } = await params;

  try {
    const updateData = {
      sgt_show: 'N',
      _timestamp: Date.now(),
      _force_refresh: true,
    };

    const backendBase = resolveBackendBaseUrl();
    const backendUrl = `${backendBase}/api/v1/groups/${encodeURIComponent(groupId)}`;

    const response = await fetch(backendUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Next.js API Proxy',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, message: '그룹 삭제에 실패했습니다.', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    const groupData = {
      sgt_idx: data.sgt_idx,
      sgt_title: data.sgt_title,
      sgt_content: data.sgt_content || data.sgt_memo,
      sgt_memo: data.sgt_memo,
      mt_idx: data.mt_idx,
      sgt_show: data.sgt_show,
      sgt_wdate: data.sgt_wdate,
      memberCount: 0,
    };

    const nextResponse = NextResponse.json({
      success: true,
      data: groupData,
      message: '그룹이 목록에서 숨겨졌습니다. (소프트 삭제)',
    });
    nextResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    nextResponse.headers.set('Pragma', 'no-cache');
    nextResponse.headers.set('Expires', '0');
    return nextResponse;
  } catch (error) {
    console.error('[Group Delete API] 소프트 삭제 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '그룹 삭제 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
