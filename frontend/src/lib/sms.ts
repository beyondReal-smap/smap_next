// Aligo SMS 설정
const ALIGO_USER_ID = process.env.ALIGO_USER_ID || 'smap2023';
const ALIGO_KEY = process.env.ALIGO_KEY || '6uvw7alcd1v1u6dx5thv31lzic8mxfrt';
const ALIGO_SENDER = process.env.ALIGO_SENDER || '070-8065-2207';

interface AligoResponse {
  result_code: string;
  message: string;
  msg_id?: string;
  success_cnt?: number;
  error_cnt?: number;
  msg_type?: string;
}

// 인증번호 생성 함수
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 인증번호 발송을 위한 함수
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

// 일반 SMS 발송 함수
export async function sendSMS(phoneNumber: string, message: string, subject?: string): Promise<{ success: boolean; error?: string }> {
  try {
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
    formData.append('title', subject || '');
    formData.append('msg_type', 'SMS');

    const response = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      body: formData,
    });

    const result: AligoResponse = await response.json();

    if (result.result_code === '1') {
      return { success: true };
    } else {
      return { success: false, error: result.message };
    }

  } catch (error) {
    console.error('SMS 발송 오류:', error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
} 