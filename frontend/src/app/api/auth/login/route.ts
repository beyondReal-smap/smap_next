import { NextRequest, NextResponse } from 'next/server';
import { Member, LoginResponse } from '@/types/auth';

export async function POST(request: NextRequest) {
  try {
    const { mt_id, mt_pwd } = await request.json();

    // 입력 검증
    if (!mt_id || !mt_pwd) {
      return NextResponse.json(
        { success: false, message: '아이디와 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // TODO: 실제 백엔드 API 호출
    // const response = await axios.post('http://your-backend-api/auth/login', {
    //   mt_id,
    //   mt_pwd
    // });

    // 임시 로직 - 실제 구현시 제거
    if (mt_id === 'test@test.com' && mt_pwd === 'password') {
      const mockUser: Member = {
        mt_idx: 1186,
        mt_type: 1,
        mt_level: 2,
        mt_status: 1,
        mt_id: mt_id,
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

      const response: LoginResponse = {
        success: true,
        message: '로그인 성공',
        data: {
          token: 'mock-jwt-token-' + Date.now(),
          member: mockUser
        }
      };

      return NextResponse.json(response);
    }

    return NextResponse.json(
      { success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' },
      { status: 401 }
    );

  } catch (error) {
    console.error('[API] 로그인 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 