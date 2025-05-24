import { NextRequest, NextResponse } from 'next/server';
import { Member } from '@/types/auth';

// 멤버 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;

    // TODO: 실제 백엔드 API 호출
    // const response = await axios.get(`http://your-backend-api/members/${id}`);

    // 임시 Mock 데이터
    const mockMember: Member = {
      mt_idx: parseInt(id),
      mt_type: 1,
      mt_level: 2,
      mt_status: 1,
      mt_id: 'test@test.com',
      mt_name: '테스트 사용자',
      mt_nickname: '테스트닉네임',
      mt_hp: '01012345678',
      mt_email: 'test@test.com',
      mt_birth: '1990-01-01',
      mt_gender: 1,
      mt_file1: '/images/avatar1.png',
      mt_lat: 37.5642,
      mt_long: 127.0016,
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
      mt_adate: new Date().toISOString()
    };

    return NextResponse.json(mockMember);

  } catch (error) {
    console.error('[API] 멤버 조회 오류:', error);
    return NextResponse.json(
      { error: '멤버 정보를 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}

// 멤버 정보 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const updateData = await request.json();

    // TODO: 실제 백엔드 API 호출
    // const response = await axios.put(`http://your-backend-api/members/${id}`, updateData);

    // 임시 로직 - 업데이트된 데이터 반환
    const updatedMember: Member = {
      mt_idx: parseInt(id),
      mt_type: 1,
      mt_level: 2,
      mt_status: 1,
      mt_id: 'test@test.com',
      mt_name: updateData.mt_name || '테스트 사용자',
      mt_nickname: updateData.mt_nickname || '테스트닉네임',
      mt_hp: updateData.mt_hp || '01012345678',
      mt_email: updateData.mt_email || 'test@test.com',
      mt_birth: updateData.mt_birth || '1990-01-01',
      mt_gender: updateData.mt_gender || 1,
      mt_file1: updateData.mt_file1 || '/images/avatar1.png',
      mt_lat: updateData.mt_lat || 37.5642,
      mt_long: updateData.mt_long || 127.0016,
      mt_sido: updateData.mt_sido || '서울시',
      mt_gu: updateData.mt_gu || '강남구',
      mt_dong: updateData.mt_dong || '역삼동',
      mt_onboarding: updateData.mt_onboarding || 'Y',
      mt_push1: updateData.mt_push1 || 'Y',
      mt_plan_check: updateData.mt_plan_check || 'N',
      mt_plan_date: updateData.mt_plan_date || '',
      mt_weather_pop: updateData.mt_weather_pop || '20',
      mt_weather_sky: updateData.mt_weather_sky || 8,
      mt_weather_tmn: updateData.mt_weather_tmn || 18,
      mt_weather_tmx: updateData.mt_weather_tmx || 25,
      mt_weather_date: new Date().toISOString(),
      mt_ldate: new Date().toISOString(),
      mt_adate: new Date().toISOString()
    };

    return NextResponse.json(updatedMember);

  } catch (error) {
    console.error('[API] 멤버 업데이트 오류:', error);
    return NextResponse.json(
      { error: '멤버 정보 업데이트에 실패했습니다.' },
      { status: 500 }
    );
  }
} 