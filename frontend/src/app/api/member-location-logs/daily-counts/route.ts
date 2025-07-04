import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://118.67.130.71:8000';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');
    const days = searchParams.get('days') || '14';

    if (!groupId) {
      return NextResponse.json(
        { error: 'group_id parameter is required' },
        { status: 400 }
      );
    }

    console.log('[API] daily-counts 요청:', { groupId, days });

    // 백엔드 API로 프록시
    const backendUrl = `${BACKEND_URL}/api/v1/logs/daily-counts?group_id=${groupId}&days=${days}`;
    console.log('[API] 백엔드 URL:', backendUrl);

    // Node.js 환경 변수로 SSL 검증 비활성화
    const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    
    // 환경 변수 복원
    if (originalTlsReject !== undefined) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
    } else {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] 백엔드 응답 오류:', { status: response.status, errorText });
      throw new Error(`Backend responded with ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('[API] 백엔드 응답 성공:', { 
      memberCount: data.member_daily_counts?.length || 0,
      totalDays: data.total_days || 0 
    });

    return NextResponse.json(data);

  } catch (error) {
    console.error('[API] daily-counts 오류:', error);

    // 오류 발생 시 모의 데이터 반환
    const { searchParams: errorSearchParams } = new URL(request.url);
    const errorGroupId = errorSearchParams.get('group_id');
    const errorDays = parseInt(errorSearchParams.get('days') || '14');
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (errorDays - 1));

    const mockData = {
      member_daily_counts: [
        {
          member_id: 1186,
          member_name: "jin",
          daily_counts: Array.from({ length: errorDays }, (_, i) => {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            return {
              date: date.toISOString().split('T')[0],
              formatted_date: date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace(/-/g, '.'),
              count: Math.floor(Math.random() * 51)
            };
          })
        }
      ],
      total_daily_counts: [],
      total_days: errorDays,
      total_members: 1,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      group_id: parseInt(errorGroupId || '0')
    };

    console.log('[API] 백엔드 연결 실패, 모의 데이터 반환');
    return NextResponse.json(mockData);
  }
} 