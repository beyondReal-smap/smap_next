import { NextResponse } from 'next/server';
import { Member, LoginResponse } from '@/types/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, token } = body;

    // 소셜 로그인 처리 로직 - 데모용 (실제로는 NextAuth 사용)
    // 실제 구현에서는 각 소셜 플랫폼의 토큰 검증 및 사용자 정보 조회가 필요합니다
    
    console.log(`[SOCIAL LOGIN] ${provider} 로그인 시도:`, { token: token?.substring(0, 20) + '...' });

    // 데모용 응답 - 실제로는 NextAuth를 통해 처리됨
    const mockUserId = Math.floor(Math.random() * 9000) + 1000; // 랜덤 사용자 ID
    const mockUser: Member = {
      mt_idx: mockUserId,
      mt_type: 1,
      mt_level: 2,
      mt_status: 1,
      mt_id: `${provider}_user_${mockUserId}`,
      mt_name: `${provider} 사용자 ${mockUserId}`,
      mt_nickname: `${provider}닉네임${mockUserId}`,
      mt_hp: '01012345678',
      mt_email: `user${mockUserId}@${provider}.com`,
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
      message: `${provider} 로그인 성공`,
      data: {
        token: `mock-${provider}-token-${mockUserId}-` + Date.now(),
        member: mockUser
      }
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[SOCIAL LOGIN ERROR]:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || '소셜 로그인 중 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
} 