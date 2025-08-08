import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json(
        { success: false, message: '전화번호가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('[FIND_USER_BY_PHONE] 백엔드 요청 시작:', { phone: phone.substring(0, 3) + '***' });

    // 백엔드 API 호출
    console.log('[FIND_USER_BY_PHONE] 백엔드 API 호출 시작');
    try {
      const backendUrl = 'https://api3.smap.site/api/v1/auth/find-user-by-phone';
      
      console.log('[FIND_USER_BY_PHONE] 백엔드 URL:', backendUrl);
      console.log('[FIND_USER_BY_PHONE] 요청 데이터:', { phone: phone.substring(0, 3) + '***' });
      
      // SSL 인증서 문제 해결을 위한 설정
      process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

      const backendResponse = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phone
        }),
        // 타임아웃 설정 (10초로 증가)
        signal: AbortSignal.timeout(10000)
      });

      console.log('[FIND_USER_BY_PHONE] 백엔드 응답 상태:', backendResponse.status);
      console.log('[FIND_USER_BY_PHONE] 백엔드 응답 헤더:', Object.fromEntries(backendResponse.headers.entries()));

      const backendData = await backendResponse.json();
      console.log('[FIND_USER_BY_PHONE] 백엔드 응답 데이터:', backendData);

      if (!backendResponse.ok) {
        // 백엔드에서 오류 응답이 온 경우
        console.error('[FIND_USER_BY_PHONE] 백엔드 오류:', backendResponse.status, backendData);
        return NextResponse.json(
          { 
            success: false, 
            message: backendData.message || '사용자 조회에 실패했습니다.' 
          },
          { status: backendResponse.status }
        );
      }

      // 백엔드 응답을 그대로 전달 (success가 false여도 정상 응답)
      console.log('[FIND_USER_BY_PHONE] 백엔드 응답 처리:', {
        success: backendData.success,
        found: backendData.data?.found,
        message: backendData.message
      });
      return NextResponse.json(backendData);

    } catch (backendError) {
      console.error('[FIND_USER_BY_PHONE] 백엔드 연결 실패:', backendError);
      
      // 개발 환경에서는 Mock 데이터 반환
      if (process.env.NODE_ENV === 'development') {
        console.log('[FIND_USER_BY_PHONE] 개발 환경 - Mock 데이터 반환');
        return NextResponse.json({
          success: true,
          message: '사용자 조회 성공 (개발 모드)',
          data: {
            found: true,
            is_new_user: false,
            user: {
              mt_idx: 1186,
              mt_id: '01029565435',
              mt_name: '테스트 사용자',
              mt_nickname: '테스트',
              mt_hp: '01029565435',
              mt_email: 'test@example.com',
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
            lookup_method: 'phone',
            needs_onboarding: false
          }
        });
      }
      
      // 프로덕션에서는 에러 반환
      return NextResponse.json(
        { 
          success: false, 
          message: '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.' 
        },
        { status: 503 }
      );
    }
    
  } catch (error: any) {
    console.error('[FIND_USER_BY_PHONE] API 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '요청 처리 중 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
} 