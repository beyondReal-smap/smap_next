import { NextRequest, NextResponse } from 'next/server';
import { extractAuthToken } from '@/lib/auth';
import resolveBackendBaseUrl from '../../../_utils/backend';

// 멤버가 속한 그룹 상세 정보 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = extractAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 });
  }

  try {
    const { id } = await params; // mt_idx
    const backendBase = resolveBackendBaseUrl();
    const backendUrl = `${backendBase}/api/v1/group-details/member/${encodeURIComponent(id)}`;

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Next.js API Proxy',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: '멤버의 그룹 상세 정보를 불러올 수 없습니다.', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] 멤버 그룹 상세 조회 오류:', error);
    return NextResponse.json(
      { error: '멤버의 그룹 상세 정보를 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}
