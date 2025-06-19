import { NextResponse } from 'next/server';
import { Member, LoginResponse } from '@/types/auth';
import jwt from 'jsonwebtoken';

// Node.js에서 fetch 사용을 위한 polyfill
let fetchImpl: typeof fetch;

if (typeof fetch === 'undefined') {
  try {
    const nodeFetch = require('node-fetch');
    fetchImpl = nodeFetch.default || nodeFetch;
  } catch (error) {
    console.warn('node-fetch not available, using native fetch');
    fetchImpl = fetch;
  }
} else {
  fetchImpl = fetch;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, token } = body;

    console.log(`[SOCIAL LOGIN] ${provider} 로그인 시도:`, { token: token?.substring(0, 20) + '...' });

    // 데모 토큰인지 확인
    const isDemoToken = token?.startsWith('demo-');
    
    if (isDemoToken) {
      console.log('[SOCIAL LOGIN] 데모 토큰 감지 - 테스트 모드로 진행');
      
      // 데모 모드 - 간단한 임시 사용자 생성
      const mockUserId = Math.floor(Math.random() * 9000) + 1000;
      const userData = {
        id: mockUserId,
        mt_idx: mockUserId,
        mt_id: `${provider.toLowerCase()}_demo_${mockUserId}`,
        email: `demo${mockUserId}@${provider.toLowerCase()}.com`,
        mt_email: `demo${mockUserId}@${provider.toLowerCase()}.com`,
        name: `${provider} 데모 사용자`,
        mt_name: `${provider} 데모 사용자`,
        nickname: `${provider}데모${mockUserId}`,
        mt_nickname: `${provider}데모${mockUserId}`,
        profile_image: '/images/avatar1.png',
        mt_file1: '/images/avatar1.png',
        provider: provider.toLowerCase(),
        isNewUser: true,
        mt_type: provider === 'google' || provider === '구글' ? 4 : 2,
        mt_level: 2,
        mt_status: 1,
        mt_hp: '01000000000',
        mt_birth: '1990-01-01',
        mt_gender: 1,
        mt_lat: 37.5642,
        mt_long: 127.0016,
        mt_sido: '서울시',
        mt_gu: '강남구',
        mt_dong: '역삼동',
        mt_onboarding: 'Y' as 'Y' | 'N',
        mt_push1: 'Y' as 'Y' | 'N',
        mt_plan_check: 'N' as 'Y' | 'N',
        mt_plan_date: '',
        mt_weather_pop: '20',
        mt_weather_sky: 8,
        mt_weather_tmn: 18,
        mt_weather_tmx: 25,
        mt_weather_date: new Date().toISOString(),
        mt_ldate: new Date().toISOString(),
        mt_adate: new Date().toISOString()
      };

      // 데모 토큰 생성
      const demoToken = jwt.sign(
        { 
          mt_idx: userData.mt_idx,
          userId: userData.id,
          email: userData.email, 
          name: userData.name,
          nickname: userData.nickname,
          provider: provider.toLowerCase(),
          demo: true
        },
        process.env.NEXTAUTH_SECRET || 'default-secret',
        { expiresIn: '7d' }
      );

      const member: Member = {
        mt_idx: userData.mt_idx,
        mt_type: userData.mt_type,
        mt_level: userData.mt_level,
        mt_status: userData.mt_status,
        mt_id: userData.mt_id,
        mt_name: userData.mt_name,
        mt_nickname: userData.mt_nickname,
        mt_hp: userData.mt_hp,
        mt_email: userData.mt_email,
        mt_birth: userData.mt_birth,
        mt_gender: userData.mt_gender,
        mt_file1: userData.mt_file1,
        mt_lat: userData.mt_lat,
        mt_long: userData.mt_long,
        mt_sido: userData.mt_sido,
        mt_gu: userData.mt_gu,
        mt_dong: userData.mt_dong,
        mt_onboarding: userData.mt_onboarding,
        mt_push1: userData.mt_push1,
        mt_plan_check: userData.mt_plan_check,
        mt_plan_date: userData.mt_plan_date,
        mt_weather_pop: userData.mt_weather_pop,
        mt_weather_sky: userData.mt_weather_sky,
        mt_weather_tmn: userData.mt_weather_tmn,
        mt_weather_tmx: userData.mt_weather_tmx,
        mt_weather_date: userData.mt_weather_date,
        mt_ldate: userData.mt_ldate,
        mt_adate: userData.mt_adate
      };

      const response: LoginResponse = {
        success: true,
        message: `${provider} 데모 로그인 성공`,
        data: {
          token: demoToken,
          member: member
        }
      };

      const nextResponse = NextResponse.json(response);
      nextResponse.cookies.set('auth-token', demoToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });

      return nextResponse;
    }

    // 실제 소셜 로그인 처리 - 현재는 구현되지 않음
    console.log('[SOCIAL LOGIN] 실제 소셜 로그인은 /api/google-auth 또는 /api/kakao-auth를 사용하세요');
    
    return NextResponse.json(
      { 
        success: false, 
        message: '실제 소셜 로그인은 해당 플랫폼의 전용 API를 사용해주세요. (예: /api/google-auth, /api/kakao-auth)'
      },
      { status: 400 }
    );
    
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