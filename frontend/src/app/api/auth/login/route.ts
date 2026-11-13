import { NextRequest, NextResponse } from 'next/server';
import { Member, LoginResponse } from '@/types/auth';
import resolveBackendBaseUrl from '@/app/api/_utils/backend';

export async function POST(request: NextRequest) {
  try {
    const { mt_id, mt_pwd } = await request.json();

    if (!mt_id || !mt_pwd) {
      return NextResponse.json(
        { success: false, message: '전화번호와 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    const cleanPhoneNumber = mt_id.replace(/-/g, '');
    const backendUrl = `${resolveBackendBaseUrl()}/api/v1/auth/login`;

    try {
      const backendResponse = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mt_id: cleanPhoneNumber,
          mt_pwd,
        }),
        signal: AbortSignal.timeout(10000),
      });

      const backendData = await backendResponse.json();
      console.log('[LOGIN API] 백엔드 응답 상태:', backendResponse.status);

      if (!backendResponse.ok) {
        return NextResponse.json(
          {
            success: false,
            message: backendData.message || '로그인에 실패했습니다.',
          },
          { status: backendResponse.status }
        );
      }

      if (backendData.success && backendData.data?.user && backendData.data?.token) {
        const userData = backendData.data.user;
        const accessToken: string = backendData.data.token;
        const refreshToken: string | undefined = backendData.data.refresh_token;

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
          mt_adate: userData.mt_adate,
        };

        const responseBody: LoginResponse = {
          success: true,
          message: '로그인 성공',
          data: {
            token: accessToken,
            member,
          },
        };

        const nextResponse = NextResponse.json(responseBody);
        nextResponse.cookies.set('auth-token', accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30,
        });

        if (refreshToken) {
          nextResponse.cookies.set('refresh-token', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
          });
        }

        return nextResponse;
      }

      return NextResponse.json(
        {
          success: false,
          message: backendData.message || '아이디 또는 비밀번호가 올바르지 않습니다.',
        },
        { status: 401 }
      );
    } catch (backendError) {
      console.error('[LOGIN API] 백엔드 연결 실패:', backendError instanceof Error ? backendError.message : String(backendError));
      if (backendError instanceof Error && backendError.name === 'AbortError') {
        return NextResponse.json(
          { success: false, message: '서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.' },
          { status: 408 }
        );
      }
      return NextResponse.json(
        { success: false, message: '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('[LOGIN API] 로그인 오류:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
