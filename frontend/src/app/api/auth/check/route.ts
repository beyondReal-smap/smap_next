import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // phone, email
    const value = searchParams.get('value');

    if (!type || !value) {
      return NextResponse.json(
        { error: '타입과 값이 필요합니다.' },
        { status: 400 }
      );
    }

    if (type !== 'phone' && type !== 'email') {
      return NextResponse.json(
        { error: '지원하지 않는 타입입니다. phone 또는 email을 사용해주세요.' },
        { status: 400 }
      );
    }

    console.log(`[CHECK_USER] 사용자 확인 요청: ${type} = ${value.substring(0, 3)}***`);

    // 백엔드 API 호출
    console.log('[CHECK_USER] 백엔드 API 호출 시작');
    try {
      const backendUrl = 'https://118.67.130.71:8000';
      let apiEndpoint: string;
      let requestBody: any;
      
      if (type === 'email') {
        apiEndpoint = `${backendUrl}/api/v1/auth/find-user-by-email`;
        requestBody = { email: value };
      } else {
        apiEndpoint = `${backendUrl}/api/v1/auth/find-user-by-phone`;
        requestBody = { phone: value };
      }
      
      console.log('[CHECK_USER] 백엔드 URL:', apiEndpoint);
      console.log('[CHECK_USER] 요청 데이터:', { 
        [type]: value.substring(0, 3) + '***' 
      });
      
      // SSL 인증서 문제 해결을 위한 설정
      process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

      const backendResponse = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        // 타임아웃 설정 (10초로 증가)
        signal: AbortSignal.timeout(10000)
      });

      console.log('[CHECK_USER] 백엔드 응답 상태:', backendResponse.status);
      console.log('[CHECK_USER] 백엔드 응답 헤더:', Object.fromEntries(backendResponse.headers.entries()));

      const backendData = await backendResponse.json();
      console.log('[CHECK_USER] 백엔드 응답 데이터:', backendData);

      if (!backendResponse.ok) {
        // 백엔드에서 오류 응답이 온 경우
        console.error('[CHECK_USER] 백엔드 오류:', backendResponse.status, backendData);
        return NextResponse.json(
          { 
            success: false, 
            message: backendData.message || '사용자 확인에 실패했습니다.' 
          },
          { status: backendResponse.status }
        );
      }

      // 백엔드 응답을 그대로 전달
      console.log('[CHECK_USER] 백엔드 응답 처리:', {
        success: backendData.success,
        found: backendData.data?.found,
        message: backendData.message
      });
      return NextResponse.json(backendData);

    } catch (backendError) {
      console.error('[CHECK_USER] 백엔드 연결 실패:', backendError);
      
      // 개발 환경에서는 Mock 데이터 반환
      if (process.env.NODE_ENV === 'development') {
        console.log('[CHECK_USER] 개발 환경 - Mock 데이터 반환');
        return NextResponse.json({
          success: true,
          message: '사용자 확인 완료 (개발환경 Mock)',
          data: {
            found: true,
            is_new_user: false,
            user: {
              mt_idx: 1186,
              mt_id: type === 'phone' ? value : 'test@example.com',
              mt_name: '테스트 사용자',
              mt_nickname: '테스트',
              mt_hp: type === 'phone' ? value : '01012345678',
              mt_email: type === 'email' ? value : 'test@example.com',
              mt_birth: '1990-01-01',
              mt_gender: 1,
              mt_type: 1,
              mt_level: 2,
              mt_file1: '/images/male_1.png',
              mt_lat: 37.51869,
              mt_long: 126.88498,
              mt_onboarding: 'Y',
              mt_ldate: new Date().toISOString(),
              mt_wdate: new Date().toISOString()
            },
            groups: [],
            recent_schedules: [],
            group_count: 0,
            schedule_count: 0,
            has_data: false,
            lookup_method: type,
            needs_onboarding: false
          },
          dev: true
        });
      }
      
      // 프로덕션에서는 에러 반환
      return NextResponse.json(
        { message: '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 503 }
      );
    }

  } catch (error: any) {
    console.error('[CHECK_USER] API 오류:', error);
    return NextResponse.json(
      { message: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 