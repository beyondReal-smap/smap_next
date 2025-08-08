import { NextRequest, NextResponse } from 'next/server';
import { Member, LoginResponse } from '@/types/auth';
import { generateJWT } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { mt_id, mt_pwd } = await request.json();

    console.log('[LOGIN API] 요청 시작:', { mt_id, mt_pwd: '***' });

    // 입력 검증
    if (!mt_id || !mt_pwd) {
      console.log('[LOGIN API] 입력 검증 실패: 빈 값');
      return NextResponse.json(
        { success: false, message: '전화번호와 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 전화번호 형식 정리 (하이픈 제거)
    const cleanPhoneNumber = mt_id.replace(/-/g, '');

    console.log('[LOGIN API] 로그인 시도:', { mt_id: cleanPhoneNumber });

    // 백엔드 API 호출
    console.log('[LOGIN API] 백엔드 API 호출 시작');
    try {
      const backendUrl = 'https://api3.smap.site/api/v1/members/login';
      
      console.log('[LOGIN API] 백엔드 URL:', backendUrl);
      console.log('[LOGIN API] 요청 데이터:', { mt_id: cleanPhoneNumber, mt_pwd: '***' });
      
      // SSL 인증서 문제 해결을 위한 설정
      process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

      const backendResponse = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mt_id: cleanPhoneNumber,
          mt_pwd: mt_pwd
        }),
        // 타임아웃 설정 (10초로 증가)
        signal: AbortSignal.timeout(10000)
      });

      console.log('[LOGIN API] 백엔드 응답 상태:', backendResponse.status);
      console.log('[LOGIN API] 백엔드 응답 헤더:', Object.fromEntries(backendResponse.headers.entries()));

      const backendData = await backendResponse.json();
      console.log('[LOGIN API] 백엔드 응답 데이터:', backendData);

      if (!backendResponse.ok) {
        // 백엔드에서 오류 응답이 온 경우
        console.error('[LOGIN API] 백엔드 오류:', backendResponse.status, backendData);
        return NextResponse.json(
          { 
            success: false, 
            message: backendData.message || '로그인에 실패했습니다.' 
          },
          { status: backendResponse.status }
        );
      }

      if (backendData.success && backendData.data?.user) {
        // 백엔드 로그인 성공
        console.log('[LOGIN API] 백엔드 로그인 성공 처리');
        const userData = backendData.data.user;
        
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

        // JWT 토큰 생성 (실제 사용자 정보 포함)
        const jwtToken = generateJWT({
          mt_idx: userData.mt_idx,
          userId: userData.mt_idx,
          mt_id: userData.mt_id,
          mt_name: userData.mt_name,
          mt_nickname: userData.mt_nickname,
          mt_hp: userData.mt_hp,
          mt_email: userData.mt_email,
          mt_birth: userData.mt_birth,
          mt_gender: userData.mt_gender,
          mt_type: userData.mt_type,
          mt_level: userData.mt_level,
          mt_file1: userData.mt_file1
        });

        // 세션 정보 로깅 (나중에 DB 저장으로 확장 가능)
        const sessionInfo = {
          mt_idx: userData.mt_idx,
          login_time: new Date().toISOString(),
          ip_address: request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown'
        };
        console.log('[LOGIN API] 세션 생성:', sessionInfo);

        const response: LoginResponse = {
          success: true,
          message: '로그인 성공',
          data: {
            token: jwtToken, // 실제 사용자 정보가 포함된 JWT 토큰 사용
            member: member
          }
        };

        console.log('[LOGIN API] 백엔드 로그인 성공:', member.mt_idx, member.mt_name);
        
        // 응답 생성 및 쿠키에 토큰 저장
        const nextResponse = NextResponse.json(response);
        nextResponse.cookies.set('auth-token', jwtToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30 // 30일 (한 달)
        });
        
        return nextResponse;
      } else {
        // 백엔드 로그인 실패
        console.log('[LOGIN API] 백엔드 로그인 실패:', backendData);
        return NextResponse.json(
          { 
            success: false, 
            message: backendData.message || '아이디 또는 비밀번호가 올바르지 않습니다.' 
          },
          { status: 401 }
        );
      }

    } catch (backendError) {
      // 백엔드 연결 실패
      console.error('[LOGIN API] 백엔드 연결 실패:', backendError);
      
      if (backendError instanceof Error) {
        if (backendError.name === 'AbortError') {
          return NextResponse.json(
            { success: false, message: '서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.' },
            { status: 408 }
          );
        }
        if (backendError.message.includes('fetch')) {
          return NextResponse.json(
            { success: false, message: '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.' },
            { status: 503 }
          );
        }
      }
      
      return NextResponse.json(
        { success: false, message: '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 503 }
      );
    }

  } catch (error) {
    console.error('[LOGIN API] 로그인 오류:', error);
    
    // 기타 오류
    return NextResponse.json(
      { success: false, message: `서버 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}` },
      { status: 500 }
    );
  }
} 