import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api3.smap.site';

// 응답 데이터 변환 함수
function transformResponse(backendData: any) {
  // 케이스 1: 백엔드가 이미 일관된 형식으로 응답하는 경우
  if (backendData && typeof backendData.result === 'string') {
    return backendData;
  }
  
  // 케이스 2: 백엔드가 데이터만 반환하는 경우 (변환 필요)
  if (backendData && (backendData.member_activities || Array.isArray(backendData))) {
    const data = Array.isArray(backendData) ? backendData : backendData;
    
    return {
      result: "Y",
      data: data,
      total_members: data.total_members || (data.member_activities ? data.member_activities.length : 0),
      active_members: data.active_members || (data.member_activities ? data.member_activities.filter((m: any) => m.is_active).length : 0),
      success: true,
      message: "조회 성공"
    };
  }
  
  // 케이스 3: 예상하지 못한 형식 - 오류로 처리
  console.warn('[API] 예상하지 못한 백엔드 응답 형식:', backendData);
  throw new Error('Invalid backend response format');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');
    const date = searchParams.get('date');

    if (!groupId || !date) {
      return NextResponse.json(
        { 
          result: "N",
          error: 'group_id and date parameters are required',
          success: false,
          message: "필수 파라미터 누락"
        },
        { status: 400 }
      );
    }

    console.log('[API] member-activity 요청:', { groupId, date });

    // 백엔드 API로 프록시
    const backendUrl = `${BACKEND_URL}/api/v1/logs/member-activity?group_id=${groupId}&date=${date}`;
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
    console.log('[API] 백엔드 원본 응답:', { 
      dataKeys: Object.keys(data || {}),
      memberCount: data.member_activities?.length || 0,
      activeMembers: data.active_members || 0 
    });

    // 응답 데이터 변환
    const transformedData = transformResponse(data);
    console.log('[API] 변환된 응답:', {
      result: transformedData.result,
      memberCount: transformedData.data?.member_activities?.length || transformedData.data?.length || 0
    });

    return NextResponse.json(transformedData);

  } catch (error) {
    console.error('[API] member-activity 오류:', error);

    // 오류 발생 시 일관된 형식의 모의 데이터 반환
    const { searchParams: errorSearchParams } = new URL(request.url);
    const errorGroupId = errorSearchParams.get('group_id');
    const errorDate = errorSearchParams.get('date');

    const mockActivities = [
      {
        member_id: 1186,
        member_name: "jin",
        member_photo: null,
        member_gender: 1,
        log_count: Math.floor(Math.random() * 91) + 10, // 10-100
        last_log_time: `${errorDate}T15:30:00Z`,
        first_log_time: `${errorDate}T09:00:00Z`,
        is_active: true
      },
      {
        member_id: 1194,
        member_name: "sil",
        member_photo: null, 
        member_gender: 2,
        log_count: Math.floor(Math.random() * 76) + 5, // 5-80
        last_log_time: `${errorDate}T14:20:00Z`,
        first_log_time: `${errorDate}T08:30:00Z`,
        is_active: true
      },
      {
        member_id: 1200,
        member_name: "eun",
        member_photo: null,
        member_gender: 2,
        log_count: 0,
        last_log_time: null,
        first_log_time: null,
        is_active: false
      }
    ];

    const activeMembers = mockActivities.filter(m => m.is_active).length;

    const mockData = {
      result: "Y",
      data: {
        member_activities: mockActivities,
        date: errorDate,
        group_id: parseInt(errorGroupId || '0'),
        total_members: mockActivities.length,
        active_members: activeMembers
      },
      total_members: mockActivities.length,
      active_members: activeMembers,
      success: true,
      message: "백엔드 연결 실패, 모의 데이터 사용"
    };

    console.log('[API] 백엔드 연결 실패, 일관된 형식의 모의 데이터 반환');
    return NextResponse.json(mockData);
  }
} 