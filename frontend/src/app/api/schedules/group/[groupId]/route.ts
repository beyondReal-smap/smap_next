import { NextRequest, NextResponse } from 'next/server';

// 목업 데이터
const mockSchedules = [
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
  },
  {
    sst_idx: 3,
    mt_idx: 1187,
    mt_schedule_idx: 1187,
    sst_title: '프로젝트 발표',
    sst_sdate: '2024-12-28 10:00:00',
    sst_edate: '2024-12-28 11:00:00',
    sst_location_title: '회의실 A',
    sst_location_lat: 37.5692,
    sst_location_long: 127.0036,
    sst_memo: '분기별 성과 발표',
    sst_show: 1,
    sst_all_day: 0
  },
  {
    sst_idx: 4,
    mt_idx: 1188,
    mt_schedule_idx: 1188,
    sst_title: '주간 회의',
    sst_sdate: '2024-12-29 11:00:00',
    sst_edate: '2024-12-29 12:00:00',
    sst_location_title: '본사 대회의실',
    sst_location_lat: 37.5662,
    sst_location_long: 126.9986,
    sst_memo: '주간 업무 점검',
    sst_show: 1,
    sst_all_day: 0
  },
  {
    sst_idx: 5,
    mt_idx: 1188,
    mt_schedule_idx: 1188,
    sst_title: '고객 미팅',
    sst_sdate: '2024-12-30 15:00:00',
    sst_edate: '2024-12-30 16:30:00',
    sst_location_title: '강남 오피스',
    sst_location_lat: 37.5665,
    sst_location_long: 126.9780,
    sst_memo: '신규 프로젝트 제안',
    sst_show: 1,
    sst_all_day: 0
  }
];

interface RouteContext {
  params: {
    groupId: string;
  };
}

export async function GET(
  request: NextRequest,
  context: any
) {
  const groupId = context.params.groupId;
  const { searchParams } = new URL(request.url);
  const days = searchParams.get('days');
  
  if (!groupId) {
    return NextResponse.json(
      { error: '그룹 ID가 필요합니다.' }, 
      { status: 400 }
    );
  }

  try {
    console.log(`[API] 그룹 스케줄 조회: 그룹 ID ${groupId}, days: ${days}`);
    
    // 날짜 필터링 (days 파라미터가 있는 경우)
    let filteredSchedules = mockSchedules;
    if (days && parseInt(days) > 0) {
      const currentDate = new Date();
      const endDate = new Date();
      endDate.setDate(currentDate.getDate() + parseInt(days));
      
      filteredSchedules = mockSchedules.filter(schedule => {
        const scheduleDate = new Date(schedule.sst_sdate);
        return scheduleDate >= currentDate && scheduleDate <= endDate;
      });
    }
    
    return NextResponse.json(filteredSchedules, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('그룹 스케줄 조회 에러:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' }, 
      { status: 500 }
    );
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