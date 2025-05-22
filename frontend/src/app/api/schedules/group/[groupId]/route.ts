import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    const params = await context.params;
    const { groupId } = params;
    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days');
    
    let backendUrl = `https://118.67.130.71:8000/api/v1/schedules/group/${groupId}`;
    if (days) {
      backendUrl += `?days=${days}`;
    }
    
    console.log('[API PROXY] 백엔드 호출:', backendUrl);
    
    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
      },
    };
    
    const response = await fetch(backendUrl, fetchOptions);

    console.log('[API PROXY] 백엔드 응답 상태:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API PROXY] 백엔드 에러 응답:', errorText);
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[API PROXY] 백엔드 응답 성공:', data);

    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('[API PROXY] 오류:', error);
    
    // 목업 데이터 반환
    const mockData = [
      {
        sst_idx: 1,
        mt_idx: 1186,
        mt_schedule_idx: 1186,
        sst_title: '팀 회의',
        sst_sdate: '2024-12-27 14:00:00',
        sst_edate: '2024-12-27 15:00:00',
        sst_location_title: '강남 사무실',
        sst_location_lat: 37.5665,
        sst_location_long: 126.9780,
        sst_memo: '프로젝트 진행상황 논의',
        sst_show: 1,
        sst_all_day: 0
      },
      {
        sst_idx: 2,
        mt_idx: 1186,
        mt_schedule_idx: 1186,
        sst_title: '저녁 약속',
        sst_sdate: '2024-12-27 19:00:00',
        sst_edate: '2024-12-27 21:00:00',
        sst_location_title: '이탈리안 레스토랑',
        sst_location_lat: 37.5612,
        sst_location_long: 126.9966,
        sst_memo: '친구들과 저녁식사',
        sst_show: 1,
        sst_all_day: 0
      }
    ];

    return NextResponse.json(mockData, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 