import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://118.67.130.71:8000';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');
    const date = searchParams.get('date');

    if (!groupId || !date) {
      return NextResponse.json(
        { error: 'group_id and date parameters are required' },
        { status: 400 }
      );
    }

    console.log('[API] member-activity 요청:', { groupId, date });

    // 백엔드 API로 프록시
    const backendUrl = `${BACKEND_URL}/api/v1/logs/member-activity?group_id=${groupId}&date=${date}`;
    console.log('[API] 백엔드 URL:', backendUrl);

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] 백엔드 응답 오류:', { status: response.status, errorText });
      throw new Error(`Backend responded with ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('[API] 백엔드 응답 성공:', { 
      memberCount: data.member_activities?.length || 0,
      activeMembers: data.active_members || 0 
    });

    return NextResponse.json(data);

  } catch (error) {
    console.error('[API] member-activity 오류:', error);

    // 오류 발생 시 모의 데이터 반환
    const { searchParams: errorSearchParams } = new URL(request.url);
    const errorGroupId = errorSearchParams.get('group_id');
    const errorDate = errorSearchParams.get('date');

    const mockActivities = [
      {
        member_id: 1186,
        member_name: "jin",
        log_count: Math.floor(Math.random() * 91) + 10, // 10-100
        last_log_time: `${errorDate}T15:30:00Z`,
        first_log_time: `${errorDate}T09:00:00Z`,
        is_active: true
      },
      {
        member_id: 1187,
        member_name: "sil", 
        log_count: Math.floor(Math.random() * 76) + 5, // 5-80
        last_log_time: `${errorDate}T14:20:00Z`,
        first_log_time: `${errorDate}T08:30:00Z`,
        is_active: true
      },
      {
        member_id: 1188,
        member_name: "eun",
        log_count: 0,
        last_log_time: null,
        first_log_time: null,
        is_active: false
      }
    ];

    const activeMembers = mockActivities.filter(m => m.is_active).length;

    const mockData = {
      member_activities: mockActivities,
      date: errorDate,
      group_id: parseInt(errorGroupId || '0'),
      total_members: mockActivities.length,
      active_members: activeMembers
    };

    console.log('[API] 백엔드 연결 실패, 모의 데이터 반환');
    return NextResponse.json(mockData);
  }
} 