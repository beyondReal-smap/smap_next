export interface SocialLoginData {
  provider: string;
  email: string;
  name: string;
  nickname: string;
  profile_image?: string;
  google_id?: string;
  kakao_id?: string;
}

export interface RegisterData {
  // 약관 동의
  mt_agree1: boolean;
  mt_agree2: boolean;
  mt_agree3: boolean;
  mt_agree4: boolean;
  mt_agree5: boolean;
  
  // 기본 정보
  mt_id: string;
  mt_pwd: string;
  mt_name: string;
  mt_nickname: string;
  mt_email: string;
  mt_birth: string;
  mt_gender: number | null;
  
  // 위치 정보
  mt_lat: number | null;
  mt_long: number | null;
  
  // 기타
  mt_push1: boolean;
  verification_code: string;
  
  // 소셜 로그인 관련
  isSocialLogin?: boolean;
  socialProvider?: string;
  socialId?: string;
}

export interface TermData {
  id: string;
  title: string;
  required: boolean;
  content: string;
}

export interface PasswordStrength {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

export interface ErrorModal {
  isOpen: boolean;
  title: string;
  message: string;
  isCountdown: boolean;
  style?: any;
}

export const REGISTER_STEPS = {
  TERMS: 'terms',
  PHONE: 'phone',
  VERIFICATION: 'verification',
  BASIC_INFO: 'basic_info',
  PROFILE: 'profile',
  LOCATION: 'location',
  COMPLETE: 'complete'
} as const;

export type RegisterStep = typeof REGISTER_STEPS[keyof typeof REGISTER_STEPS];

export const TERMS_DATA: TermData[] = [
  {
    id: 'mt_agree1',
    title: '서비스 이용약관',
    required: true,
    content: 'SMAP 서비스 이용에 관한 기본 약관입니다.'
  },
  {
    id: 'mt_agree2', 
    title: '개인정보 처리방침',
    required: true,
    content: '개인정보 수집, 이용, 보관에 관한 정책입니다.'
  },
  {
    id: 'mt_agree3',
    title: '위치기반서비스 이용약관',
    required: true,
    content: '위치정보 수집 및 이용에 관한 약관입니다.'
  },
  {
    id: 'mt_agree4',
    title: '개인정보 제3자 제공 동의',
    required: false,
    content: '서비스 향상을 위한 개인정보 제3자 제공 동의입니다.'
  },
  {
    id: 'mt_agree5',
    title: '마케팅 정보 수신 동의',
    required: false,
    content: '이벤트, 혜택 등 마케팅 정보 수신 동의입니다.'
  }
]; 