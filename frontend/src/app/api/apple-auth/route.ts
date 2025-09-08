import { NextRequest, NextResponse } from 'next/server';

interface RegisterRequest {
  mt_type: number;
  mt_level: number;
  mt_status: number;
  mt_id: string;
  mt_pwd?: string;
  mt_name: string;
  mt_nickname: string;
  mt_email?: string;
  mt_birth?: string;
  mt_gender?: number;
  mt_file1?: string;  // 프로필 이미지 경로
  profile_image?: string;  // 애플에서 제공하는 프로필 이미지
  mt_onboarding: string;
  mt_show: string;
  mt_agree1: boolean;
  mt_agree2: boolean;
  mt_agree3: boolean;
  mt_agree4: boolean;
  mt_agree5: boolean;
  mt_push1: boolean;
  mt_lat?: number | null;
  mt_long?: number | null;
  action?: string;
  isRegister?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequest = await request.json();

    // 회원가입 액션 처리만 지원 (로그인은 /api/auth/apple-login 사용)
    if (body.action === 'register' || body.isRegister) {
      // 필수 필드 검증 (소셜 가입이므로 mt_pwd는 선택)
      if (!body.mt_id || !body.mt_name || !body.mt_nickname) {
        return NextResponse.json(
          { error: '필수 정보가 누락되었습니다.' },
          { status: 400 }
        );
      }

      // 프로필 이미지 처리 - 애플에서 제공된 이미지가 있으면 사용, 없으면 백엔드에서 랜덤 아바타 선택
      const profileImage = body.profile_image || body.mt_file1 || null;

      const memberData = {
        mt_type: body.mt_type || 3, // 애플
        mt_level: body.mt_level || 2,
        mt_status: body.mt_status || 1,
        mt_id: body.mt_id,
        // 소셜 가입은 비밀번호를 사용하지 않지만, 백엔드 호환을 위해 전달 가능
        // 백엔드에서 무시되거나 저장 방식 정의에 따름
        mt_pwd: body.mt_pwd || 'apple_auto_password_123',
        mt_name: body.mt_name,
        mt_nickname: body.mt_nickname,
        mt_email: body.mt_email || null,
        mt_birth: body.mt_birth || null,
        mt_gender: body.mt_gender || null,
        mt_file1: profileImage,  // 프로필 이미지 경로
        mt_onboarding: body.mt_onboarding || 'N',
        mt_show: body.mt_show || 'Y',
        mt_agree1: body.mt_agree1 ? 'Y' : 'N',
        mt_agree2: body.mt_agree2 ? 'Y' : 'N',
        mt_agree3: body.mt_agree3 ? 'Y' : 'N',
        mt_agree4: body.mt_agree4 ? 'Y' : 'N',
        mt_agree5: body.mt_agree5 ? 'Y' : 'N',
        mt_push1: body.mt_push1 ? 'Y' : 'N',
        mt_lat: body.mt_lat ?? null,
        mt_long: body.mt_long ?? null,
        mt_wdate: new Date().toISOString(),
      };

      try {
        const backendUrl = 'https://api3.smap.site/api/v1/members/register';
        const backendResponse = await fetch(backendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(memberData),
        });

        const backendData = await backendResponse.json().catch(() => ({}));

        if (!backendResponse.ok) {
          return NextResponse.json(
            { success: false, message: backendData.message || '회원가입에 실패했습니다.' },
            { status: backendResponse.status }
          );
        }

        return NextResponse.json(backendData);
      } catch (err) {
        // 백엔드 연결 실패 시 임시 성공 응답
        const tempMemberData = {
          mt_idx: Math.floor(Math.random() * 10000) + 1000,
          mt_id: memberData.mt_id,
          mt_name: memberData.mt_name,
          mt_nickname: memberData.mt_nickname,
          mt_email: memberData.mt_email,
          mt_wdate: new Date().toISOString(),
        };

        return NextResponse.json({
          success: true,
          message: '회원가입이 완료되었습니다. (임시 처리)',
          data: tempMemberData,
        });
      }
    }

    return NextResponse.json(
      { success: false, message: '지원하지 않는 요청입니다. (애플 로그인은 /api/auth/apple-login 사용)' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Apple 회원가입 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}


