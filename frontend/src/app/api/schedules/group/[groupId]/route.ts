import { NextRequest, NextResponse } from 'next/server';

interface Schedule {
  id: string;
  sst_pidx?: number | null;
  mt_schedule_idx?: number | null;
  title?: string | null;
  date?: string | null;
  sst_edate?: string | null;
  sst_location_title?: string | null;
  sst_location_lat?: number | null;
  sst_location_long?: number | null;
  sst_memo?: string | null;
  sst_wdate?: string | null;
}

// node-fetch를 대안으로 사용
let nodeFetch: any = null;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('[API PROXY] node-fetch 패키지를 찾을 수 없음');
}

export async function GET(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const { groupId } = await params;
    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') || '7'; // 기본 7일

    // TODO: 실제 백엔드 API 호출
    // const response = await axios.get(`http://your-backend-api/schedules/group/${groupId}?days=${days}`);

    // 임시 Mock 데이터
    const today = new Date();
    const mockSchedules: Schedule[] = [
      {
        id: '1',
        sst_pidx: 1,
        mt_schedule_idx: 1186, // 김철수
        title: '팀 회의',
        date: new Date(today.getTime() + 2 * 60 * 60 * 1000).toISOString(), // 2시간 후
        sst_edate: new Date(today.getTime() + 3 * 60 * 60 * 1000).toISOString(), // 3시간 후
        sst_location_title: '강남 사무실',
        sst_location_lat: 37.5642,
        sst_location_long: 127.0016,
        sst_memo: '주간 팀 미팅',
        sst_wdate: new Date().toISOString()
      },
      {
        id: '2',
        sst_pidx: 2,
        mt_schedule_idx: 1187, // 이영희
        title: '프로젝트 발표',
        date: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(), // 내일
        sst_edate: new Date(today.getTime() + 25 * 60 * 60 * 1000).toISOString(),
        sst_location_title: '회의실 A',
        sst_location_lat: 37.5652,
        sst_location_long: 127.0026,
        sst_memo: 'Q3 프로젝트 결과 발표',
        sst_wdate: new Date().toISOString()
      },
      {
        id: '3',
        sst_pidx: 3,
        mt_schedule_idx: 1188, // 박민수
        title: '고객 미팅',
        date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 모레
        sst_edate: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        sst_location_title: '강남 오피스',
        sst_location_lat: 37.5632,
        sst_location_long: 127.0006,
        sst_memo: '신규 프로젝트 논의',
        sst_wdate: new Date().toISOString()
      },
      {
        id: '4',
        sst_pidx: 4,
        mt_schedule_idx: 1186, // 김철수
        title: '저녁 약속',
        date: new Date(today.getTime() + 8 * 60 * 60 * 1000).toISOString(), // 8시간 후 (저녁)
        sst_edate: new Date(today.getTime() + 10 * 60 * 60 * 1000).toISOString(),
        sst_location_title: '이탈리안 레스토랑',
        sst_location_lat: 37.5662,
        sst_location_long: 127.0036,
        sst_memo: '동료들과 저녁 식사',
        sst_wdate: new Date().toISOString()
      }
    ];

    return NextResponse.json(mockSchedules);

  } catch (error) {
    console.error('[API] 그룹 스케줄 조회 오류:', error);
    return NextResponse.json(
      { error: '그룹 스케줄을 불러올 수 없습니다.' },
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