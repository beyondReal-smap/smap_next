import { NextRequest, NextResponse } from 'next/server';

// 회원가입 요청 타입
interface RegisterRequest {
  mt_type?: number;
  mt_id?: string;
  mt_pwd?: string;
  mt_name: string;
  mt_nickname: string;
  mt_hp?: string;
  mt_email?: string;
  email_verification_token?: string;
  mt_birth?: string;
  mt_gender?: number;
  mt_onboarding?: string;
  mt_show?: string;
  mt_agree1: boolean;
  mt_agree2: boolean;
  mt_agree3: boolean;
  mt_agree4?: boolean;
  mt_agree5?: boolean;
  mt_push1?: boolean;
  mt_lat?: number;
  mt_long?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequest = await request.json();

    // mt_type: 1=일반, 2=카카오, 3=애플, 4=구글
    const isSocialLogin = body.mt_type === 2 || body.mt_type === 3 || body.mt_type === 4;

    if (!body.mt_name || !body.mt_nickname) {
      return NextResponse.json(
        { success: false, error: '이름과 닉네임은 필수입니다.' },
        { status: 400 }
      );
    }

    if (!isSocialLogin && (!body.mt_id && !body.mt_email || !body.mt_pwd)) {
      return NextResponse.json(
        { success: false, error: '아이디(이메일 또는 전화번호)와 비밀번호는 필수입니다.' },
        { status: 400 }
      );
    }

    if (!body.mt_agree1 || !body.mt_agree2 || !body.mt_agree3) {
      return NextResponse.json(
        { success: false, error: '필수 약관에 동의해주세요.' },
        { status: 400 }
      );
    }

    // 백엔드 계약에 맞춰 전달 (권한/상태 필드 및 비밀번호 사전 해싱 제외)
    const memberData: Record<string, any> = {
      mt_type: body.mt_type || 1,
      mt_id: body.mt_id || body.mt_email || '',
      mt_pwd: body.mt_pwd,
      mt_name: body.mt_name,
      mt_nickname: body.mt_nickname,
      mt_hp: body.mt_hp || null,
      mt_email: body.mt_email || null,
      email_verification_token: body.email_verification_token || undefined,
      mt_birth: body.mt_birth || null,
      mt_gender: body.mt_gender || null,
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
    };

    if (isSocialLogin) {
      if (body.mt_type === 4 && (body as any).mt_google_id) {
        memberData.mt_google_id = (body as any).mt_google_id;
      }
      if (body.mt_type === 3 && (body as any).mt_apple_id) {
        memberData.mt_apple_id = (body as any).mt_apple_id;
      }
      if (body.mt_type === 2 && (body as any).mt_kakao_id) {
        memberData.mt_kakao_id = (body as any).mt_kakao_id;
      }
      if ((body as any).profile_image || (body as any).mt_file1) {
        memberData.mt_file1 = (body as any).profile_image || (body as any).mt_file1;
      }
    }

    const backendBase = process.env.BACKEND_URL || 'https://api3.aiagnt.kr';
    const backendResponse = await fetch(`${backendBase}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(memberData),
    });

    const backendData = await backendResponse.json().catch(() => ({}));

    if (!backendResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: backendData.detail || backendData.message || '회원가입에 실패했습니다.'
        },
        { status: backendResponse.status }
      );
    }

    const token = backendData.data?.token;
    const response = NextResponse.json(backendData, { status: backendResponse.status });

    if (token) {
      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
    }

    return response;
  } catch (error) {
    console.error('회원가입 오류:', error);
    return NextResponse.json(
      { success: false, error: '회원가입 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}