import { NextRequest, NextResponse } from 'next/server';

// Aligo SMS 설정
const ALIGO_USER_ID = process.env.ALIGO_USER_ID || 'smap2023';
const ALIGO_KEY = process.env.ALIGO_KEY || '6uvw7alcd1v1u6dx5thv31lzic8mxfrt';
const ALIGO_SENDER = process.env.ALIGO_SENDER || '070-8065-2207';

interface SMSRequest {
  receiver: string;
  msg: string;
  subject?: string;
  rdate?: string;
  rtime?: string;
}

interface AligoResponse {
  result_code: string;
  message: string;
  msg_id?: string;
  success_cnt?: number;
  error_cnt?: number;
  msg_type?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SMSRequest = await request.json();
    const { receiver, msg, subject = "", rdate = "", rtime = "" } = body;

    // 필수 파라미터 검증
    if (!receiver || !msg) {
      return NextResponse.json(
        { error: '수신자 번호와 메시지는 필수입니다.' },
        { status: 400 }
      );
    }

    // 전화번호 형식 검증 (숫자만)
    const cleanReceiver = receiver.replace(/[^0-9]/g, '');
    if (cleanReceiver.length < 10 || cleanReceiver.length > 11) {
      return NextResponse.json(
        { error: '올바른 전화번호 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    // Aligo API 호출을 위한 FormData 생성
    const formData = new FormData();
    formData.append('user_id', ALIGO_USER_ID);
    formData.append('key', ALIGO_KEY);
    formData.append('msg', msg);
    formData.append('receiver', cleanReceiver);
    formData.append('destination', '');
    formData.append('sender', ALIGO_SENDER);
    formData.append('rdate', rdate);
    formData.append('rtime', rtime);
    formData.append('testmode_yn', 'N');
    formData.append('title', subject);
    formData.append('msg_type', 'SMS');

    // Aligo API 호출
    const response = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: AligoResponse = await response.json();

    // 결과 확인
    if (result.result_code === '1') {
      return NextResponse.json({
        success: true,
        message: '문자메시지가 성공적으로 발송되었습니다.',
        data: {
          msg_id: result.msg_id,
          success_cnt: result.success_cnt,
          error_cnt: result.error_cnt
        }
      });
    } else {
      return NextResponse.json(
        { 
          error: '문자메시지 발송에 실패했습니다.',
          message: result.message,
          result_code: result.result_code
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('SMS 발송 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 인증번호 생성 함수
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 인증번호 발송을 위한 별도 함수
export async function sendVerificationCode(phoneNumber: string): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    const code = generateVerificationCode();
    const message = `[SMAP] 인증번호는 ${code}입니다. 3분 이내에 입력해주세요.`;

    const formData = new FormData();
    formData.append('user_id', ALIGO_USER_ID);
    formData.append('key', ALIGO_KEY);
    formData.append('msg', message);
    formData.append('receiver', phoneNumber.replace(/[^0-9]/g, ''));
    formData.append('destination', '');
    formData.append('sender', ALIGO_SENDER);
    formData.append('rdate', '');
    formData.append('rtime', '');
    formData.append('testmode_yn', 'N');
    formData.append('title', 'SMAP 인증번호');
    formData.append('msg_type', 'SMS');

    const response = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      body: formData,
    });

    const result: AligoResponse = await response.json();

    if (result.result_code === '1') {
      return { success: true, code };
    } else {
      return { success: false, error: result.message };
    }

  } catch (error) {
    console.error('인증번호 발송 오류:', error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
} 