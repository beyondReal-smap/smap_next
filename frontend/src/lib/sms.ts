// Fixie 프록시를 통한 고정 IP SMS 발송
// 백엔드 API를 통해 SMS 발송 (Fixie 프록시 사용)

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'https://api3.smap.site/api/v1';

interface SMSResponse {
  success: boolean;
  code?: string;
  message?: string;
  error?: string;
  msg_id?: string;
}

// 인증번호 생성 함수 (백엔드에서 생성하므로 더 이상 필요 없음)
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 인증번호 발송을 위한 함수 (백엔드 API 호출)
export async function sendVerificationCode(phoneNumber: string): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    console.log('[SMS] 백엔드 API를 통한 인증번호 발송 요청:', phoneNumber.substring(0, 3) + '***');

    const response = await fetch(`${BACKEND_API_URL}/sms/send-verification-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: phoneNumber
      }),
    });

    const result: SMSResponse = await response.json();

    if (result.success) {
      console.log('[SMS] 인증번호 발송 성공');
      return { success: true, code: result.code };
    } else {
      console.error('[SMS] 인증번호 발송 실패:', result.error);
      return { success: false, error: result.error };
    }

  } catch (error) {
    console.error('인증번호 발송 오류:', error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}

// 일반 SMS 발송 함수 (백엔드 API 호출)
export async function sendSMS(phoneNumber: string, message: string, subject?: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[SMS] 백엔드 API를 통한 SMS 발송 요청:', phoneNumber.substring(0, 3) + '***');

    const response = await fetch(`${BACKEND_API_URL}/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: phoneNumber,
        message: message,
        subject: subject || 'SMAP'
      }),
    });

    const result: SMSResponse = await response.json();

    if (result.success) {
      console.log('[SMS] SMS 발송 성공');
      return { success: true };
    } else {
      console.error('[SMS] SMS 발송 실패:', result.error);
      return { success: false, error: result.error };
    }

  } catch (error) {
    console.error('SMS 발송 오류:', error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}

// 비밀번호 재설정 링크 발송 함수 (백엔드 API 호출)
export async function sendPasswordResetLink(phoneNumber: string, resetUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    const message = `[SMAP] 비밀번호 재설정 링크입니다.\n${resetUrl}`;

    console.log('[SMS] 백엔드 API를 통한 비밀번호 재설정 SMS 발송 요청:', phoneNumber.substring(0, 3) + '***');

    const response = await fetch(`${BACKEND_API_URL}/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: phoneNumber,
        message: message,
        subject: 'SMAP 비밀번호 재설정'
      }),
    });

    const result: SMSResponse = await response.json();

    if (result.success) {
      console.log('[SMS] 비밀번호 재설정 SMS 발송 성공');
      return { success: true };
    } else {
      console.error('[SMS] 비밀번호 재설정 SMS 발송 실패:', result.error);
      return { success: false, error: result.error };
    }

  } catch (error) {
    console.error('비밀번호 재설정 SMS 발송 오류:', error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
} 