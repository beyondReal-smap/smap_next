import { NextRequest, NextResponse } from 'next/server';
import { Member, GroupDetail } from '@/types/auth';

// 그룹의 멤버 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // TODO: 실제 백엔드 API 호출
    // const response = await axios.get(`http://your-backend-api/groups/${id}/members`);

    // 임시 Mock 데이터 - 멤버 정보와 그룹 상세 정보가 합쳐진 형태
    const mockMembers: (Member & GroupDetail)[] = [
      {
        // Member 정보
        mt_idx: 1186,
        mt_type: 1,
        mt_level: 2,
        mt_status: 1,
        mt_id: 'user1@test.com',
        mt_name: '김철수',
        mt_nickname: '철수',
        mt_hp: '01012345678',
        mt_email: 'user1@test.com',
        mt_birth: '1990-01-01',
        mt_gender: 1,
        mt_file1: '/images/avatar1.png',
        mt_lat: 37.5642 + 0.001,
        mt_long: 127.0016 + 0.001,
        mt_sido: '서울시',
        mt_gu: '강남구',
        mt_dong: '역삼동',
        mt_onboarding: 'Y',
        mt_push1: 'Y',
        mt_plan_check: 'N',
        mt_plan_date: '',
        mt_weather_pop: '20',
        mt_weather_sky: 8,
        mt_weather_tmn: 18,
        mt_weather_tmx: 25,
        mt_weather_date: new Date().toISOString(),
        mt_ldate: new Date().toISOString(),
        mt_adate: new Date().toISOString(),
        // GroupDetail 정보
        sgdt_idx: 1,
        sgt_idx: parseInt(id),
        sgdt_owner_chk: 'Y',
        sgdt_leader_chk: 'Y',
        sgdt_discharge: 'N',
        sgdt_group_chk: 'Y',
        sgdt_exit: 'N',
        sgdt_show: 'Y',
        sgdt_push_chk: 'Y',
        sgdt_wdate: new Date().toISOString(),
        sgdt_udate: new Date().toISOString(),
        sgdt_ddate: '',
        sgdt_xdate: '',
        sgdt_adate: ''
      },
      {
        // Member 정보
        mt_idx: 1187,
        mt_type: 1,
        mt_level: 2,
        mt_status: 1,
        mt_id: 'user2@test.com',
        mt_name: '이영희',
        mt_nickname: '영희',
        mt_hp: '01023456789',
        mt_email: 'user2@test.com',
        mt_birth: '1992-05-15',
        mt_gender: 2,
        mt_file1: '/images/avatar2.png',
        mt_lat: 37.5642 - 0.002,
        mt_long: 127.0016 + 0.003,
        mt_sido: '서울시',
        mt_gu: '강남구',
        mt_dong: '논현동',
        mt_onboarding: 'Y',
        mt_push1: 'Y',
        mt_plan_check: 'N',
        mt_plan_date: '',
        mt_weather_pop: '30',
        mt_weather_sky: 4,
        mt_weather_tmn: 16,
        mt_weather_tmx: 23,
        mt_weather_date: new Date().toISOString(),
        mt_ldate: new Date().toISOString(),
        mt_adate: new Date().toISOString(),
        // GroupDetail 정보
        sgdt_idx: 2,
        sgt_idx: parseInt(id),
        sgdt_owner_chk: 'N',
        sgdt_leader_chk: 'N',
        sgdt_discharge: 'N',
        sgdt_group_chk: 'Y',
        sgdt_exit: 'N',
        sgdt_show: 'Y',
        sgdt_push_chk: 'Y',
        sgdt_wdate: new Date().toISOString(),
        sgdt_udate: new Date().toISOString(),
        sgdt_ddate: '',
        sgdt_xdate: '',
        sgdt_adate: ''
      },
      {
        // Member 정보
        mt_idx: 1188,
        mt_type: 1,
        mt_level: 2,
        mt_status: 1,
        mt_id: 'user3@test.com',
        mt_name: '박민수',
        mt_nickname: '민수',
        mt_hp: '01034567890',
        mt_email: 'user3@test.com',
        mt_birth: '1988-12-10',
        mt_gender: 1,
        mt_file1: '/images/avatar3.png',
        mt_lat: 37.5642 + 0.003,
        mt_long: 127.0016 - 0.002,
        mt_sido: '서울시',
        mt_gu: '서초구',
        mt_dong: '서초동',
        mt_onboarding: 'Y',
        mt_push1: 'Y',
        mt_plan_check: 'N',
        mt_plan_date: '',
        mt_weather_pop: '10',
        mt_weather_sky: 1,
        mt_weather_tmn: 20,
        mt_weather_tmx: 28,
        mt_weather_date: new Date().toISOString(),
        mt_ldate: new Date().toISOString(),
        mt_adate: new Date().toISOString(),
        // GroupDetail 정보
        sgdt_idx: 3,
        sgt_idx: parseInt(id),
        sgdt_owner_chk: 'N',
        sgdt_leader_chk: 'Y',
        sgdt_discharge: 'N',
        sgdt_group_chk: 'Y',
        sgdt_exit: 'N',
        sgdt_show: 'Y',
        sgdt_push_chk: 'Y',
        sgdt_wdate: new Date().toISOString(),
        sgdt_udate: new Date().toISOString(),
        sgdt_ddate: '',
        sgdt_xdate: '',
        sgdt_adate: ''
      }
    ];

    return NextResponse.json(mockMembers);

  } catch (error) {
    console.error('[API] 그룹 멤버 조회 오류:', error);
    return NextResponse.json(
      { error: '그룹 멤버 정보를 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
} 