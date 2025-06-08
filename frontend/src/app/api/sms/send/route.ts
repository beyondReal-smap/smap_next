import { NextRequest, NextResponse } from 'next/server';
import { sendSMS } from '@/lib/sms';

interface SMSRequest {
  receiver: string;
  msg: string;
  subject?: string;
  rdate?: string;
  rtime?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SMSRequest = await request.json();
    const { receiver, msg, subject = "" } = body;

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

    // SMS 발송
    const result = await sendSMS(cleanReceiver, msg, subject);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: '문자메시지가 성공적으로 발송되었습니다.'
      });
    } else {
      return NextResponse.json(
        { 
          error: '문자메시지 발송에 실패했습니다.',
          message: result.error
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

