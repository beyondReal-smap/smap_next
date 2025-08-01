import { NextRequest, NextResponse } from 'next/server';
import { sendSMS } from '@/lib/sms';

interface SMSRequest {
  phone: string;
  message: string;
  subject?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SMSRequest = await request.json();
    const { phone, message, subject } = body;

    // 입력값 검증
    if (!phone || !message) {
      return NextResponse.json(
        { error: '전화번호와 메시지가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('[SMS SEND] SMS 발송 요청:', {
      phone: phone.substring(0, 3) + '***',
      messageLength: message.length,
      subject
    });

    // SMS 발송
    const result = await sendSMS(phone, message, subject);

    if (result.success) {
      console.log('[SMS SEND] SMS 발송 성공:', phone.substring(0, 3) + '***');
      return NextResponse.json({
        success: true,
        message: 'SMS가 성공적으로 발송되었습니다.'
      });
    } else {
      console.error('[SMS SEND] SMS 발송 실패:', result.error);
      return NextResponse.json(
        { error: result.error || 'SMS 발송에 실패했습니다.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[SMS SEND] API 오류:', error);
    return NextResponse.json(
      { error: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

