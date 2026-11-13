import { NextRequest, NextResponse } from 'next/server';

import resolveBackendBaseUrl from '../../../_utils/backend';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  try {
    console.log('[Notice Detail API] 공지사항 상세 조회 요청:', resolvedParams.id);
    
    const { searchParams } = new URL(request.url);
    const increment_hit = searchParams.get('increment_hit') || 'true';
    
    const backendUrl = `${resolveBackendBaseUrl()}/api/v1/notices/${encodeURIComponent(resolvedParams.id)}?increment_hit=${increment_hit}`;
    console.log('[Notice Detail API] 백엔드 요청:', backendUrl);

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[Notice Detail API] 백엔드 응답 오류:', response.status, response.statusText);
      
      if (response.status === 404) {
        return NextResponse.json(
          { error: '공지사항을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[Notice Detail API] 백엔드 응답 성공');
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Notice Detail API] 오류:', error);
    return NextResponse.json(
      { error: '공지사항을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
} 