import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { sendVerificationCode } from '../../sms/send/route';

// 회원가입 요청 타입
interface RegisterRequest {
  mt_type: number;
  mt_level: number;
  mt_status: number;
  mt_id: string; // 전화번호
  mt_pwd: string;
  mt_name: string;
  mt_nickname: string;
  mt_email?: string;
  mt_birth?: string;
  mt_gender?: number;
  mt_onboarding: string;
  mt_show: string;
  mt_agree1: boolean;
  mt_agree2: boolean;
  mt_agree3: boolean;
  mt_agree4: boolean;
  mt_agree5: boolean;
  mt_push1: boolean;
  mt_lat?: number;
  mt_long?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequest = await request.json();

    // 필수 필드 검증
    if (!body.mt_id || !body.mt_pwd || !body.mt_name || !body.mt_nickname) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 필수 약관 동의 확인
    if (!body.mt_agree1 || !body.mt_agree2 || !body.mt_agree3) {
      return NextResponse.json(
        { error: '필수 약관에 동의해주세요.' },
        { status: 400 }
      );
    }

    // 전화번호 중복 확인 (실제 구현에서는 DB 조회)
    // const existingUser = await checkUserExists(body.mt_id);
    // if (existingUser) {
    //   return NextResponse.json(
    //     { error: '이미 가입된 전화번호입니다.' },
    //     { status: 409 }
    //   );
    // }

    // 비밀번호 해싱 (PHP의 PASSWORD_DEFAULT는 bcrypt)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(body.mt_pwd, saltRounds);

    // 회원 정보 구성
    const memberData = {
      mt_type: body.mt_type || 1, // 일반 회원
      mt_level: body.mt_level || 2, // 일반(무료)
      mt_status: body.mt_status || 1, // 정상
      mt_id: body.mt_id,
      mt_pwd: hashedPassword,
      mt_name: body.mt_name,
      mt_nickname: body.mt_nickname,
      mt_email: body.mt_email || null,
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
      mt_lat: body.mt_lat || null,
      mt_long: body.mt_long || null,
      mt_wdate: new Date().toISOString(),
    };

    // 실제 구현에서는 여기서 DB에 저장
    // const result = await insertMember(memberData);
    
    // 임시로 성공 응답 반환
    console.log('회원가입 데이터:', memberData);

    return NextResponse.json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      data: {
        mt_idx: Math.floor(Math.random() * 10000), // 임시 ID
        mt_id: body.mt_id,
        mt_name: body.mt_name,
        mt_nickname: body.mt_nickname
      }
    });

  } catch (error) {
    console.error('회원가입 오류:', error);
    return NextResponse.json(
      { error: '회원가입 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 인메모리 저장소 (실제 환경에서는 Redis나 DB 사용)
const verificationCodes = new Map<string, { code: string; expires: number }>();

// 전화번호 인증 API
export async function PUT(request: NextRequest) {
  try {
    const { action, phone, code } = await request.json();

    if (action === 'send_verification') {
      // 전화번호 형식 검증
      if (!phone) {
        return NextResponse.json(
          { error: '전화번호가 필요합니다.' },
          { status: 400 }
        );
      }

      // 실제 SMS 발송
      const result = await sendVerificationCode(phone);
      
      if (result.success && result.code) {
        // 인증번호를 메모리에 저장 (3분 후 만료)
        const expires = Date.now() + (3 * 60 * 1000); // 3분
        verificationCodes.set(phone, { code: result.code, expires });
        
        console.log(`인증번호 발송 성공: ${phone}, 코드: ${result.code}`);
        
        return NextResponse.json({
          success: true,
          message: '인증번호가 발송되었습니다.'
        });
      } else {
        return NextResponse.json(
          { error: result.error || '인증번호 발송에 실패했습니다.' },
          { status: 500 }
        );
      }
    }

    if (action === 'verify_code') {
      // 전화번호와 인증번호 검증
      if (!phone || !code) {
        return NextResponse.json(
          { error: '전화번호와 인증번호가 필요합니다.' },
          { status: 400 }
        );
      }

      // 저장된 인증번호 확인
      const storedData = verificationCodes.get(phone);
      
      if (!storedData) {
        return NextResponse.json(
          { error: '인증번호를 먼저 요청해주세요.' },
          { status: 400 }
        );
      }

      // 만료 시간 확인
      if (Date.now() > storedData.expires) {
        verificationCodes.delete(phone);
        return NextResponse.json(
          { error: '인증번호가 만료되었습니다. 다시 요청해주세요.' },
          { status: 400 }
        );
      }

      // 인증번호 일치 확인
      if (storedData.code === code) {
        verificationCodes.delete(phone); // 사용된 인증번호 삭제
        console.log(`인증번호 확인 성공: ${phone}`);
        
        return NextResponse.json({
          success: true,
          message: '인증이 완료되었습니다.'
        });
      } else {
        return NextResponse.json(
          { error: '잘못된 인증번호입니다.' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: '잘못된 요청입니다.' },
      { status: 400 }
    );

  } catch (error) {
    console.error('인증 처리 오류:', error);
    return NextResponse.json(
      { error: '인증 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 