import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    console.log('[Notice API] 공지사항 목록 조회 요청');
    
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const size = searchParams.get('size') || '20';
    const show_only = searchParams.get('show_only') || 'true';
    
    const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api3.smap.site'}/api/v1/notices/?page=${page}&size=${size}&show_only=${show_only}`;
    console.log('[Notice API] 백엔드 요청:', backendUrl);

    // SSL 인증서 문제 해결을 위한 설정
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.error('[Notice API] 백엔드 응답 오류:', response.status, response.statusText);
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[Notice API] 백엔드 응답 성공:', data);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Notice API] 오류:', error);
    return NextResponse.json(
      { error: '공지사항을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
} 