import { NextRequest, NextResponse } from 'next/server';
import { verifyBackendAuth } from '@/lib/auth';

const CATEGORY_LABELS: Record<string, string> = {
  general: '일반 문의',
  technical: '기술 지원',
  account: '계정 문제',
  billing: '결제 문의',
};

export async function POST(request: NextRequest) {
  try {
    const { user, errorResponse } = await verifyBackendAuth(request);
    if (errorResponse || !user) {
      return errorResponse ?? NextResponse.json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!botToken || !chatId) {
      console.error('[INQUIRY] TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID 환경변수가 설정되지 않았습니다.');
      return NextResponse.json(
        { success: false, message: '문의 전송 설정 오류입니다.' },
        { status: 500 }
      );
    }

    const { category, subject, message, email } = await request.json();
    if (!category || !subject || !message || !email) {
      return NextResponse.json(
        { success: false, message: '모든 필수 필드를 입력해주세요.' },
        { status: 400 }
      );
    }

    const text = [
      '📨 새로운 1:1 문의',
      '',
      `👤 회원 ID: ${user?.mt_idx ?? '-'}`,
      `📋 문의 유형: ${CATEGORY_LABELS[category] || category}`,
      `📝 제목: ${String(subject).slice(0, 200)}`,
      `📧 이메일: ${String(email).slice(0, 200)}`,
      '',
      '💬 문의 내용:',
      String(message).slice(0, 3000),
      '',
      `⏰ 접수 시간: ${new Date().toLocaleString('ko-KR')}`,
    ].join('\n');

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      console.error('[INQUIRY] Telegram API 전송 실패:', response.status, result?.description);
      return NextResponse.json(
        { success: false, message: '문의 전송에 실패했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '메시지가 성공적으로 전송되었습니다.',
    });
  } catch (error) {
    console.error('[INQUIRY] 문의 전송 오류:', error);
    return NextResponse.json(
      { success: false, message: '문의 전송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
