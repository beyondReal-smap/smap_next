import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';

// 회원가입 요청 타입
interface RegisterRequest {
  mt_type: number;
  mt_level: number;
  mt_status: number;
  mt_id: string;
  mt_pwd: string;
  mt_name: string;
  mt_nickname: string;
  mt_email: string;
  mt_birth: string;
  mt_gender: number;
  mt_onboarding: 'Y' | 'N';
  mt_show: 'Y' | 'N';
  mt_agree1: 'Y' | 'N';
  mt_agree2: 'Y' | 'N';
  mt_agree3: 'Y' | 'N';
  mt_agree4: 'Y' | 'N';
  mt_agree5: 'Y' | 'N';
  mt_push1: 'Y' | 'N';
  mt_lat: number | null;
  mt_long: number | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequest = await request.json();

    // 필수 필드 검증
    const requiredFields = ['mt_id', 'mt_pwd', 'mt_name', 'mt_nickname', 'mt_email', 'mt_birth'];
    for (const field of requiredFields) {
      if (!body[field as keyof RegisterRequest]) {
        return NextResponse.json(
          { error: `${field}는 필수 입력 항목입니다.` },
          { status: 400 }
        );
      }
    }

    // 필수 약관 동의 확인
    if (body.mt_agree1 !== 'Y' || body.mt_agree2 !== 'Y' || body.mt_agree3 !== 'Y') {
      return NextResponse.json(
        { error: '필수 약관에 동의해주세요.' },
        { status: 400 }
      );
    }

    // 전화번호 중복 확인 (실제 구현에서는 DB 조회)
    // TODO: 실제 DB에서 중복 확인
    const existingUser = false; // await checkUserExists(body.mt_id);
    
    if (existingUser) {
      return NextResponse.json(
        { error: '이미 가입된 전화번호입니다.' },
        { status: 409 }
      );
    }

    // 비밀번호 해싱 (PHP의 PASSWORD_DEFAULT는 bcrypt)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(body.mt_pwd, saltRounds);

    // 회원 정보 구성
    const memberData = {
      mt_type: body.mt_type || 1,
      mt_level: body.mt_level || 2,
      mt_status: body.mt_status || 1,
      mt_id: body.mt_id,
      mt_pwd: hashedPassword,
      mt_name: body.mt_name,
      mt_nickname: body.mt_nickname,
      mt_email: body.mt_email,
      mt_birth: body.mt_birth,
      mt_gender: body.mt_gender,
      mt_onboarding: body.mt_onboarding || 'N',
      mt_show: body.mt_show || 'Y',
      mt_agree1: body.mt_agree1,
      mt_agree2: body.mt_agree2,
      mt_agree3: body.mt_agree3,
      mt_agree4: body.mt_agree4,
      mt_agree5: body.mt_agree5,
      mt_push1: body.mt_push1 || 'Y',
      mt_lat: body.mt_lat,
      mt_long: body.mt_long,
      mt_wdate: new Date().toISOString(),
    };

    // TODO: 실제 DB에 저장
    // const result = await insertMember(memberData);
    
    // 임시로 성공 응답
    const mockResult = {
      mt_idx: Math.floor(Math.random() * 10000) + 1000,
      ...memberData
    };

    console.log('회원가입 성공:', mockResult);

    return NextResponse.json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      data: {
        mt_idx: mockResult.mt_idx,
        mt_id: mockResult.mt_id,
        mt_name: mockResult.mt_name,
        mt_nickname: mockResult.mt_nickname
      }
    });

  } catch (error) {
    console.error('회원가입 오류:', error);
    return NextResponse.json(
      { error: '회원가입 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 전화번호 인증 요청
export async function PUT(request: NextRequest) {
  try {
    const { action, phone, code } = await request.json();

    if (action === 'send_verification') {
      // TODO: 실제 SMS 발송 로직
      console.log(`인증번호 발송: ${phone}`);
      
      // 임시 인증번호 생성 (실제로는 SMS로 발송)
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      return NextResponse.json({
        success: true,
        message: '인증번호가 발송되었습니다.',
        // 개발용으로만 포함 (실제 운영에서는 제거)
        debug_code: verificationCode
      });
    }

    if (action === 'verify_code') {
      // TODO: 실제 인증번호 확인 로직
      console.log(`인증번호 확인: ${phone}, ${code}`);
      
      // 임시로 모든 인증번호를 유효하다고 처리
      const isValid = code.length === 6;
      
      if (isValid) {
        return NextResponse.json({
          success: true,
          message: '인증이 완료되었습니다.'
        });
      } else {
        return NextResponse.json(
          { error: '인증번호가 올바르지 않습니다.' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: '잘못된 요청입니다.' },
      { status: 400 }
    );

  } catch (error) {
    console.error('인증 오류:', error);
    return NextResponse.json(
      { error: '인증 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 