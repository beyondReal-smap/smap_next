'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ko';

dayjs.locale('ko');
import { 
  FiUser, 
  FiPhone, 
  FiMail, 
  FiLock, 
  FiCalendar,
  FiMapPin,
  FiCheck,
  FiArrowLeft,
  FiArrowRight,
  FiEye,
  FiEyeOff,
  FiShield,
  FiFileText,
  FiHeart,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight
} from 'react-icons/fi';
import groupService from '@/services/groupService';
import { REGISTER_STEPS, useRegisterContext } from './RegisterContext';

// 약관 데이터
const TERMS_DATA = [
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

// 소셜 로그인 데이터 타입
interface SocialLoginData {
  provider: string;
  email: string;
  name: string;
  nickname: string;
  profile_image?: string;
  google_id?: string;
  kakao_id?: string;
}

interface RegisterData {
  // 약관 동의
  mt_agree1: boolean;
  mt_agree2: boolean;
  mt_agree3: boolean;
  mt_agree4: boolean;
  mt_agree5: boolean;
  
  // 기본 정보
  mt_id: string; // 전화번호 또는 이메일 (소셜 로그인 시)
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

export default function RegisterPage() {
  // 모바일 키보드 대응을 위한 간단한 스타일
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* 모바일 입력 필드 최적화 */
      @media (max-width: 480px) {
        .register-input {
          font-size: 16px !important; /* iOS 줌 방지 */
        }
        .register-button {
          min-height: 44px !important; /* 터치 친화적 크기 */
        }
      }
      
      /* 키보드 올라올 때 스크롤 보장 */
      .register-scroll {
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const router = useRouter();
  // Context에서 단계 관리
  const { 
    currentStep, 
    setCurrentStep,
    birthModalOpen,
    setBirthModalOpen 
  } = useRegisterContext();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationTimer, setVerificationTimer] = useState(0);
  const [lastSentTime, setLastSentTime] = useState<number | null>(null);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string; isCountdown: boolean; style?: any }>({ isOpen: false, title: '', message: '', isCountdown: false });
  const [countdownTime, setCountdownTime] = useState(0);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false
  });
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [calendarCurrentMonth, setCalendarCurrentMonth] = useState(dayjs());
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  
  // 포커스 상태 관리
  const [focusedField, setFocusedField] = useState<string | null>(null);
  
  // 위치 정보 관련 상태
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  
  const [registerData, setRegisterData] = useState<RegisterData>({
    mt_agree1: false,
    mt_agree2: false,
    mt_agree3: false,
    mt_agree4: false,
    mt_agree5: false,
    mt_id: '',
    mt_pwd: '',
    mt_name: '',
    mt_nickname: '',
    mt_email: '',
    mt_birth: '',
    mt_gender: null,
    mt_lat: null,
    mt_long: null,
    mt_push1: true,
    verification_code: '',
    isSocialLogin: false,
    socialProvider: '',
    socialId: ''
  });

  const [isJoiningGroup, setIsJoiningGroup] = useState(false);
  const [isOpeningApp, setIsOpeningApp] = useState(false);

  // 웹 API를 사용한 위치 정보 요청
  const requestLocationWithWebAPI = React.useCallback(() => {
    console.log('🌐 [LOCATION] 웹 API로 위치 정보 요청 시작');
    
    const options = {
      enableHighAccuracy: true, // 높은 정확도 요청
      timeout: 10000, // 10초 타임아웃
      maximumAge: 300000 // 5분 이내 캐시된 위치 허용
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('✅ [LOCATION] 위치 정보 가져오기 성공:', position.coords);
        setRegisterData(prev => ({
          ...prev,
          mt_lat: position.coords.latitude,
          mt_long: position.coords.longitude
        }));
        setLocationLoading(false);
        setLocationError('');
      },
      (error) => {
        console.error('❌ [LOCATION] 위치 정보 가져오기 실패:', error);
        setLocationLoading(false);
        
        let errorMessage = '';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = '위치 권한이 거부되었습니다. 설정에서 위치 권한을 허용해주세요.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = '위치 정보를 사용할 수 없습니다. GPS가 활성화되어 있는지 확인해주세요.';
            break;
          case error.TIMEOUT:
            errorMessage = '위치 정보 요청이 시간 초과되었습니다. 다시 시도해주세요.';
            break;
          default:
            errorMessage = '위치 정보를 가져오는 중 오류가 발생했습니다.';
            break;
        }
        setLocationError(errorMessage);
      },
      options
    );
  }, [setRegisterData, setLocationLoading, setLocationError]);

  // 네이티브 앱 위치 권한 응답 콜백 등록
  useEffect(() => {
    // iOS 위치 권한 요청 성공 콜백
    (window as any).onLocationPermissionGranted = (locationData: any) => {
      console.log('🎯 [LOCATION CALLBACK] iOS 위치 권한 허용 및 위치 정보 수신:', locationData);
      
      if (locationData && locationData.latitude && locationData.longitude) {
        setRegisterData(prev => ({
          ...prev,
          mt_lat: locationData.latitude,
          mt_long: locationData.longitude
        }));
        setLocationLoading(false);
        setLocationError('');
        console.log('✅ [LOCATION CALLBACK] 위치 정보 저장 완료');
      } else {
        console.log('⚠️ [LOCATION CALLBACK] 위치 데이터가 불완전함, 웹 API로 폴백');
        requestLocationWithWebAPI();
      }
    };

    // iOS 위치 권한 요청 거부 콜백
    (window as any).onLocationPermissionDenied = (error: any) => {
      console.log('❌ [LOCATION CALLBACK] iOS 위치 권한 거부:', error);
      setLocationLoading(false);
      setLocationError('위치 권한이 거부되었습니다. 설정에서 위치 권한을 허용해주세요.');
    };

    // Android 위치 권한 요청 성공 콜백
    (window as any).onAndroidLocationSuccess = (locationData: any) => {
      console.log('🎯 [LOCATION CALLBACK] Android 위치 정보 수신:', locationData);
      
      if (locationData && locationData.latitude && locationData.longitude) {
        setRegisterData(prev => ({
          ...prev,
          mt_lat: locationData.latitude,
          mt_long: locationData.longitude
        }));
        setLocationLoading(false);
        setLocationError('');
        console.log('✅ [LOCATION CALLBACK] Android 위치 정보 저장 완료');
      } else {
        console.log('⚠️ [LOCATION CALLBACK] Android 위치 데이터가 불완전함, 웹 API로 폴백');
        requestLocationWithWebAPI();
      }
    };

    // Android 위치 권한 요청 거부 콜백
    (window as any).onAndroidLocationError = (error: any) => {
      console.log('❌ [LOCATION CALLBACK] Android 위치 권한 거부:', error);
      setLocationLoading(false);
      setLocationError('위치 권한이 거부되었습니다. 설정에서 위치 권한을 허용해주세요.');
    };

    console.log('📱 [LOCATION] 네이티브 위치 권한 콜백 함수들 등록 완료');

    // 컴포넌트 언마운트 시 콜백 정리
    return () => {
      delete (window as any).onLocationPermissionGranted;
      delete (window as any).onLocationPermissionDenied;
      delete (window as any).onAndroidLocationSuccess;
      delete (window as any).onAndroidLocationError;
      console.log('🧹 [LOCATION] 네이티브 위치 권한 콜백 함수들 정리 완료');
    };
  }, [requestLocationWithWebAPI, setRegisterData, setLocationLoading, setLocationError]);

  // 소셜 로그인 데이터 초기화
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const socialProvider = urlParams.get('social');
    
    if (socialProvider) {
      // sessionStorage에서 소셜 로그인 데이터 확인
      const socialData = sessionStorage.getItem('socialLoginData');
      if (socialData) {
        try {
          const parsedData: SocialLoginData = JSON.parse(socialData);
          
          console.log(`🔥 [REGISTER] ${parsedData.provider} 소셜 로그인 데이터 로드:`, parsedData);
          
          setRegisterData(prev => ({
            ...prev,
            mt_id: parsedData.email || '', // 이메일을 아이디로 사용
            mt_email: parsedData.email || '',
            mt_name: parsedData.name || '',
            mt_nickname: parsedData.nickname || '',
            isSocialLogin: true,
            socialProvider: parsedData.provider,
            socialId: parsedData.kakao_id || parsedData.google_id || ''
          }));
          
          // 소셜 로그인 시 약관 동의 단계로 시작 (소셜 로그인이므로 전화번호 인증은 생략)
          setCurrentStep(REGISTER_STEPS.TERMS);
          
          console.log(`🔥 [REGISTER] ${parsedData.provider} 소셜 로그인 데이터 로드 완료`);
          
          // 사용 완료 후 sessionStorage에서 제거
          sessionStorage.removeItem('socialLoginData');
          
        } catch (error) {
          console.error('🔥 [REGISTER] 소셜 로그인 데이터 파싱 오류:', error);
        }
      } else {
        console.warn('🔥 [REGISTER] URL에 social 파라미터가 있지만 socialLoginData가 없음');
      }
    }
  }, []);

  // 진행률 계산
  const getProgress = () => {
    const steps = Object.values(REGISTER_STEPS);
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / (steps.length - 1)) * 100; // COMPLETE 제외
  };

  // 전화번호 포맷팅 함수
  const formatPhoneNumber = (value: string) => {
    if (!value) return value;
    const numericValue = value.replace(/[^0-9]/g, '');
    const length = numericValue.length;

    if (length < 4) return numericValue;
    if (length < 7) {
      return `${numericValue.slice(0, 3)}-${numericValue.slice(3)}`;
    }
    if (length < 11) {
      return `${numericValue.slice(0, 3)}-${numericValue.slice(3, 6)}-${numericValue.slice(6)}`;
    }
    return `${numericValue.slice(0, 3)}-${numericValue.slice(3, 7)}-${numericValue.slice(7, 11)}`;
  };

  // 이메일 유효성 검사 함수
  const validateEmail = (email: string) => {
    if (!email) {
      setEmailError('');
      return true; // 선택사항이므로 빈 값은 유효
    }
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const isValid = emailRegex.test(email);
    
    if (!isValid) {
      setEmailError('올바른 이메일 형식을 입력해주세요');
      return false;
    }
    
    setEmailError('');
    return true;
  };

  // 비밀번호 유효성 검사 함수
  const validatePassword = (password: string) => {
    const strength = {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };
    
    setPasswordStrength(strength);
    
    const allValid = Object.values(strength).every(Boolean);
    
    if (!password) {
      setPasswordError('');
      return false;
    }
    
    if (!allValid) {
      const missingRequirements = [];
      if (!strength.minLength) missingRequirements.push('8자 이상');
      if (!strength.hasUppercase) missingRequirements.push('대문자');
      if (!strength.hasLowercase) missingRequirements.push('소문자');
      if (!strength.hasNumber) missingRequirements.push('숫자');
      if (!strength.hasSpecialChar) missingRequirements.push('특수문자');
      
      setPasswordError(`다음 조건이 필요합니다: ${missingRequirements.join(', ')}`);
      return false;
    }
    
    setPasswordError('');
    return true;
  };

  // 전화번호 입력 핸들러
  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const formatted = formatPhoneNumber(rawValue);
    
    // 전화번호가 변경되면 쿨다운 리셋
    if (formatted !== registerData.mt_id) {
      setLastSentTime(null);
      setVerificationSent(false);
      setVerificationTimer(0);
    }
    
    setRegisterData(prev => ({ ...prev, mt_id: formatted }));
  };

  // 전화번호 입력 필드 포커스 핸들러 (모바일 키보드 대응)
  const handlePhoneInputFocus = () => {
    // 모바일에서 키보드가 올라올 때 하단 버튼이 보이도록 스크롤
    setTimeout(() => {
      const bottomButton = document.querySelector('[data-bottom-button]');
      if (bottomButton) {
        bottomButton.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'end',
          inline: 'nearest'
        });
      }
    }, 300); // 키보드 애니메이션 후 실행
  };

  // 생년월일 모달 열기
  const handleBirthModalOpen = () => {
    // 기존 생년월일이 있다면 파싱하여 캘린더 설정
    if (registerData.mt_birth) {
      const birthDate = dayjs(registerData.mt_birth);
      setSelectedDate(birthDate);
      setCalendarCurrentMonth(birthDate);
      } else {
      // 기본값: 현재 년도에서 30년 전
      const defaultDate = dayjs().subtract(30, 'year');
      setSelectedDate(null);
      setCalendarCurrentMonth(defaultDate);
    }
    setBirthModalOpen(true);
  };

  // 생년월일 확인
  const handleBirthConfirm = () => {
    if (selectedDate) {
      const birthDate = selectedDate.format('YYYY-MM-DD');
      setRegisterData(prev => ({ ...prev, mt_birth: birthDate }));
    }
    setBirthModalOpen(false);
  };

  // 캘린더 날짜 선택
  const handleCalendarDateSelect = (date: Dayjs) => {
    setSelectedDate(date);
  };

  // 캘린더 이전 월
  const handleCalendarPrevMonth = () => {
    setCalendarCurrentMonth(prev => prev.subtract(1, 'month'));
  };

  // 캘린더 다음 월
  const handleCalendarNextMonth = () => {
    setCalendarCurrentMonth(prev => prev.add(1, 'month'));
  };

  // 캘린더 오늘로 이동
  const handleCalendarToday = () => {
    const today = dayjs();
    setCalendarCurrentMonth(today);
    setSelectedDate(today);
  };

  // 인증번호 타이머
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (verificationTimer > 0) {
      interval = setInterval(() => {
        setVerificationTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [verificationTimer]);

  // 카운트다운 타이머 (재발송 제한 모달용)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (countdownTime > 0 && errorModal.isOpen && errorModal.isCountdown) {
      interval = setInterval(() => {
        setCountdownTime(prev => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            // 카운트다운 완료 시 모달 닫기
            setErrorModal({ isOpen: false, title: '', message: '', isCountdown: false });
            return 0;
          }
          
          // 모달 메시지 업데이트
          const minutes = Math.floor(newTime / 60);
          const seconds = newTime % 60;
          setErrorModal(prev => ({
            ...prev,
            message: `같은 번호로는 ${minutes}분 ${seconds}초 후에 재발송이 가능합니다.`
          }));
          
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [countdownTime, errorModal.isOpen, errorModal.isCountdown]);

  // 뒤로가기
  const handleBack = () => {
    if (currentStep === REGISTER_STEPS.TERMS) {
      // 첫 번째 단계에서는 로그인 페이지로 이동
      router.push('/login');
    } else {
      const steps = Object.values(REGISTER_STEPS);
      const currentIndex = steps.indexOf(currentStep);
      
      // 소셜 로그인 시 전화번호 인증 단계 건너뛰기
      if (registerData.isSocialLogin && currentStep === REGISTER_STEPS.BASIC_INFO) {
        setCurrentStep(REGISTER_STEPS.TERMS);
        return;
      }
      
      if (currentIndex > 0) {
        setCurrentStep(steps[currentIndex - 1]);
      }
    }
  };

  // 다음 단계
  const handleNext = () => {
    const steps = Object.values(REGISTER_STEPS);
    const currentIndex = steps.indexOf(currentStep);
    
    // 소셜 로그인 시 전화번호 인증 단계 건너뛰기
    if (registerData.isSocialLogin) {
      if (currentStep === REGISTER_STEPS.TERMS) {
        setCurrentStep(REGISTER_STEPS.BASIC_INFO);
        return;
      }
    }
    
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  // 약관 전체 동의
  const handleAllAgree = (checked: boolean) => {
    setRegisterData(prev => ({
      ...prev,
      mt_agree1: checked,
      mt_agree2: checked,
      mt_agree3: checked,
      mt_agree4: checked,
      mt_agree5: checked
    }));
  };

  // 개별 약관 동의
  const handleTermAgree = (termId: string, checked: boolean) => {
    setRegisterData(prev => ({
      ...prev,
      [termId]: checked
    }));
  };

  // 필수 약관 동의 확인
  const isRequiredTermsAgreed = () => {
    return registerData.mt_agree1 && registerData.mt_agree2 && registerData.mt_agree3;
  };

  // 전화번호 인증 요청
  const handleSendVerification = async () => {
    if (!registerData.mt_id) return;
    
    setIsLoading(true);
    try {
      const now = Date.now();
      const cleanPhone = registerData.mt_id.replace(/-/g, '');
      
      // 테스트용 전화번호 처리
      if (cleanPhone === '01011111111') {
        setVerificationSent(true);
        setVerificationTimer(180); // 3분
        setLastSentTime(now);
        // 테스트 번호는 실제 SMS 발송 없이 바로 다음 단계로 이동
        handleNext();
        return;
      }
    
      const response = await fetch('/api/auth/register', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send_verification',
          phone: cleanPhone
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setVerificationSent(true);
        setVerificationTimer(180); // 3분
        setLastSentTime(now);
        // 인증번호 발송 성공 시 자동으로 다음 단계로 이동
        handleNext();
      } else {
        throw new Error(data.error || '인증번호 발송에 실패했습니다.');
      }
    } catch (error) {
      console.error('인증번호 발송 실패:', error);
              setErrorModal({
          isOpen: true,
          title: '발송 실패',
          message: error instanceof Error ? error.message : '인증번호 발송에 실패했습니다.',
          isCountdown: false
        });
    } finally {
      setIsLoading(false);
    }
  };

  // 인증번호 확인
  const handleVerifyCode = async () => {
    if (!registerData.verification_code) return;
    
    // 인증번호 발송 여부 확인
    if (!verificationSent) {
      setErrorModal({
        isOpen: true,
        title: '인증번호 미발송',
        message: '먼저 인증번호를 요청해주세요.',
        isCountdown: false
      });
      return;
    }
    
    setIsLoading(true);
    try {
      const cleanPhone = registerData.mt_id.replace(/-/g, '');
      
      // 테스트용 전화번호 처리
      if (cleanPhone === '01011111111') {
        if (registerData.verification_code === '111111') {
          handleNext();
          return;
        } else {
          setErrorModal({
            isOpen: true,
            title: '인증 실패',
            message: '테스트 번호의 인증번호는 111111입니다.',
            isCountdown: false
          });
          setIsLoading(false);
          return;
        }
      }

      const response = await fetch('/api/auth/register', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'verify_code',
          phone: cleanPhone,
          code: registerData.verification_code
        }),
      });
      
      const data = await response.json();
      if (response.ok) {
        handleNext();
      } else {
        throw new Error(data.error || '인증번호가 올바르지 않습니다.');
      }
    } catch (error) {
      console.error('인증번호 확인 실패:', error);
      setErrorModal({
        isOpen: true,
        title: '인증 실패',
        message: error instanceof Error ? error.message : '인증번호 확인에 실패했습니다.',
        isCountdown: false
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 위치 정보 가져오기
  const handleGetLocation = () => {
    console.log('🗺️ [LOCATION] 위치 정보 요청 시작');
    console.log('🗺️ [LOCATION] 환경 감지:', {
      isIOS: isIOS(),
      isAndroid: isAndroid(),
      isMobile: isMobile(),
      hasWebKit: !!(window as any).webkit?.messageHandlers?.smapIos,
      hasAndroidBridge: !!(window as any).SmapApp,
      userAgent: navigator.userAgent.substring(0, 100)
    });

    if (!navigator.geolocation) {
      setLocationError('이 브라우저는 위치 서비스를 지원하지 않습니다.');
      return;
    }

    setLocationLoading(true);
    setLocationError('');

    // 네이티브 앱 환경에서 네이티브 위치 권한 요청
    if (isIOS() && (window as any).webkit?.messageHandlers?.smapIos) {
      console.log('🍎 [LOCATION] iOS 네이티브 위치 권한 요청');
      
      try {
        // iOS 네이티브 위치 권한 요청
        (window as any).webkit.messageHandlers.smapIos.postMessage({
          type: 'requestLocationPermission',
          param: '',
          timestamp: Date.now(),
          source: 'register_location'
        });

        console.log('📱 [LOCATION] iOS 네이티브 위치 권한 요청 호출 완료');

        // iOS에서 3초 후 웹 API로 폴백
        setTimeout(() => {
          console.log('🔍 [LOCATION] iOS 위치 권한 응답 확인 중...');
          if (locationLoading) {
            console.log('⚠️ [LOCATION] iOS 네이티브 응답 없음, 웹 API로 폴백');
            requestLocationWithWebAPI();
          }
        }, 3000);

        return;
      } catch (error) {
        console.error('❌ [LOCATION] iOS 네이티브 위치 권한 요청 실패:', error);
        requestLocationWithWebAPI();
        return;
      }
    }

    // Android 네이티브 위치 권한 요청
    if (isAndroid() && (window as any).SmapApp?.requestLocationPermission) {
      console.log('🤖 [LOCATION] Android 네이티브 위치 권한 요청');
      
      try {
        (window as any).SmapApp.requestLocationPermission();
        console.log('📱 [LOCATION] Android 네이티브 위치 권한 요청 호출 완료');

        // Android에서 3초 후 웹 API로 폴백
        setTimeout(() => {
          console.log('🔍 [LOCATION] Android 위치 권한 응답 확인 중...');
          if (locationLoading) {
            console.log('⚠️ [LOCATION] Android 네이티브 응답 없음, 웹 API로 폴백');
            requestLocationWithWebAPI();
          }
        }, 3000);

        return;
      } catch (error) {
        console.error('❌ [LOCATION] Android 네이티브 위치 권한 요청 실패:', error);
        requestLocationWithWebAPI();
        return;
      }
    }

    // 일반 브라우저 환경에서는 웹 API 사용
    console.log('🌐 [LOCATION] 웹 브라우저 환경 - 웹 API 사용');
    requestLocationWithWebAPI();
  };

  // 회원가입 완료
  const handleRegister = async () => {
    console.log('회원가입 시작 - handleRegister 호출됨');
    console.log('현재 registerData:', registerData);
    
    setIsLoading(true);
    try {
      let requestData: any = {
        ...registerData,
        mt_type: registerData.isSocialLogin ? 
          (registerData.socialProvider === 'google' ? 4 : 2) : 1, // 구글: 4, 카카오: 2, 일반: 1
        mt_level: 2, // 일반(무료)
        mt_status: 1, // 정상
        mt_onboarding: 'N',
        mt_show: 'Y'
      };

      // 소셜 로그인이 아닌 경우에만 전화번호 하이픈 제거
      if (!registerData.isSocialLogin) {
        requestData.mt_id = registerData.mt_id.replace(/-/g, '');
      }

      // 소셜 로그인 관련 데이터 추가
      if (registerData.isSocialLogin) {
        if (registerData.socialProvider === 'google') {
          requestData.mt_google_id = registerData.socialId;
        } else if (registerData.socialProvider === 'kakao') {
          requestData.mt_kakao_id = registerData.socialId;
        }
      }
      
      console.log('API 요청 데이터:', requestData);
      
      // 소셜 로그인의 경우 소셜 회원가입 API 사용
      const apiEndpoint = registerData.isSocialLogin ? 
        `/api/${registerData.socialProvider}-auth` : 
        '/api/auth/register';
      
      let response;
      
      if (registerData.isSocialLogin) {
        // 소셜 로그인 회원가입
        const socialRegisterData = {
          ...requestData,
          action: 'register', // 회원가입 액션 지정
          isRegister: true
        };
        
        response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(socialRegisterData),
        });
      } else {
        // 일반 회원가입
        response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        });
      }

      console.log('API 응답 상태:', response.status);
      
      const data = await response.json();
      console.log('API 응답 데이터:', data);
      
      if (response.ok && data.success) {
        console.log('회원가입 성공:', data);
        
        // 회원가입 성공 시 mt_idx를 localStorage에 저장
        if (data.data && data.data.mt_idx) {
          localStorage.setItem('newMemberMtIdx', data.data.mt_idx.toString());
          console.log('새 회원 mt_idx 저장:', data.data.mt_idx);
        }
        
        // 소셜 로그인 데이터 정리
        localStorage.removeItem('socialLoginData');
        
        setCurrentStep(REGISTER_STEPS.COMPLETE);
      } else {
        throw new Error(data.error || data.message || '회원가입에 실패했습니다.');
      }
    } catch (error) {
      console.error('회원가입 실패:', error);
      setErrorModal({
        isOpen: true,
        title: '회원가입 실패',
        message: error instanceof Error ? error.message : '회원가입에 실패했습니다.',
        isCountdown: false
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 플랫폼 감지
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = () => /Android/.test(navigator.userAgent);
  const isMobile = () => isIOS() || isAndroid();

  // 앱 스토어 링크
  const APP_STORE_URL = 'https://apps.apple.com/kr/app/smap-%EC%9C%84%EC%B9%98%EC%B6%94%EC%A0%81-%EC%9D%B4%EB%8F%99%EA%B2%BD%EB%A1%9C-%EC%9D%BC%EC%A0%95/id6480279658?platform=iphone';
  const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.dmonster.smap&hl=ko';

  // 앱 설치 여부 감지 (간접적 방법)
  const checkAppInstalled = () => {
    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        console.log('앱이 설치되어 있지 않은 것으로 판단됩니다.');
        resolve(false);
      }, 2500);
      
      const startTime = Date.now();
      
      // 앱이 열리면 페이지가 숨겨지거나 blur 이벤트 발생
      const handleVisibilityChange = () => {
        if (document.hidden) {
          const timeDiff = Date.now() - startTime;
          if (timeDiff < 2000) { // 2초 이내에 숨겨지면 앱이 열린 것으로 판단
            clearTimeout(timeout);
            console.log('앱이 성공적으로 열렸습니다.');
            resolve(true);
          }
        }
      };
      
      const handleBlur = () => {
        const timeDiff = Date.now() - startTime;
        if (timeDiff < 2000) {
          clearTimeout(timeout);
          console.log('앱이 성공적으로 열렸습니다 (blur).');
          resolve(true);
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('blur', handleBlur);
      
      // 앱 스키마 실행 (딥링크)
      try {
        if (isIOS()) {
          // iOS: 커스텀 URL 스키마
          const deepLink = `smap://signin`;
          console.log('iOS 딥링크 시도:', deepLink);
          window.location.href = deepLink;
        } else if (isAndroid()) {
          // Android: Intent URL
          const deepLink = `intent://signin#Intent;scheme=smap;package=com.dmonster.smap;S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`;
          console.log('Android 딥링크 시도:', deepLink);
          window.location.href = deepLink;
        }
      } catch (error) {
        console.error('앱 스키마 실행 오류:', error);
        clearTimeout(timeout);
        resolve(false);
      }
      
      // 정리 함수
      setTimeout(() => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blur', handleBlur);
      }, 3000);
    });
  };

  // 앱으로 이동 시도
  const handleOpenApp = async () => {
    console.log('앱 열기 시도 중...');
    const appInstalled = await checkAppInstalled();
    
    if (!appInstalled) {
      console.log('앱이 설치되어 있지 않음, 스토어로 이동');
      // 앱이 설치되어 있지 않으면 스토어로 이동
      if (isIOS()) {
        window.open(APP_STORE_URL, '_blank');
      } else if (isAndroid()) {
        window.open(PLAY_STORE_URL, '_blank');
      } else {
        // 데스크탑에서는 웹 버전 사용 안내
        alert('SMAP은 모바일 앱으로 제공됩니다. 모바일 기기에서 접속해주세요.');
      }
    } else {
      console.log('앱이 성공적으로 열림');
    }
  };

  // 자동 그룹 가입 처리
  const handleAutoGroupJoin = async () => {
    try {
      const pendingGroupJoin = localStorage.getItem('pendingGroupJoin');
      const redirectAfterRegister = localStorage.getItem('redirectAfterRegister');
      
      if (pendingGroupJoin && redirectAfterRegister) {
        const groupData = JSON.parse(pendingGroupJoin);
        const groupId = groupData.groupId;
        
        console.log('자동 그룹 가입 시도:', groupId);
        
        setIsJoiningGroup(true);
        
        // 새로 가입한 회원의 mt_idx를 가져오기
        const newMemberMtIdx = localStorage.getItem('newMemberMtIdx');
        
        if (!newMemberMtIdx) {
          console.error('새 회원의 mt_idx를 찾을 수 없음');
          throw new Error('회원 정보를 찾을 수 없습니다.');
        }
        
        const mt_idx = parseInt(newMemberMtIdx);
        console.log('새 회원 mt_idx:', mt_idx);
        
        // 새로 가입한 회원을 위한 그룹 가입 API 호출
        await groupService.joinNewMemberToGroup(parseInt(groupId), mt_idx);
        
        // 성공 시 localStorage 정리
        localStorage.removeItem('pendingGroupJoin');
        localStorage.removeItem('redirectAfterRegister');
        localStorage.removeItem('newMemberMtIdx');
        
        console.log('자동 그룹 가입 성공');
        
        // 그룹 가입 성공 후 앱으로 이동 시도
        setIsJoiningGroup(false);
        setIsOpeningApp(true);
        
        if (isMobile()) {
          await handleOpenApp();
        } else {
          // 데스크탑에서는 signin 페이지로 이동
          router.push('/signin');
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('자동 그룹 가입 실패:', error);
      return false;
    } finally {
      setIsJoiningGroup(false);
    }
  };

  // 완료 단계에서 자동 그룹 가입 시도
  useEffect(() => {
    if (currentStep === REGISTER_STEPS.COMPLETE) {
      handleAutoGroupJoin();
    }
  }, [currentStep]);

  // 단계별 유효성 검사
  const isStepValid = () => {
    switch (currentStep) {
      case REGISTER_STEPS.TERMS:
        return isRequiredTermsAgreed();
      case REGISTER_STEPS.PHONE:
        return registerData.mt_id.length >= 10;
      case REGISTER_STEPS.VERIFICATION:
        return registerData.verification_code.length === 6;
      case REGISTER_STEPS.BASIC_INFO:
        // 이메일 유효성 검사 (상태 업데이트 없이)
        const isEmailValid = !registerData.mt_email || 
          /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(registerData.mt_email);
        
        // 비밀번호 강도 검사
        const isPasswordStrong = Object.values(passwordStrength).every(Boolean);
        
        return registerData.mt_pwd && 
               registerData.mt_name && 
               registerData.mt_nickname &&
               passwordConfirm === registerData.mt_pwd &&
               !passwordError && // 비밀번호 에러가 없어야 함
               isPasswordStrong && // 모든 비밀번호 조건 만족
               !emailError && // 이메일 에러가 없어야 함
               isEmailValid; // 빈 값이거나 유효한 이메일
      case REGISTER_STEPS.PROFILE:
        return registerData.mt_birth && registerData.mt_gender !== null;
      case REGISTER_STEPS.LOCATION:
        return true; // 선택사항
      default:
        return false;
    }
  };

  return (
    <div className="register-content-area">
      {/* 진행률 바 - 상단 고정 */}
      {currentStep !== REGISTER_STEPS.COMPLETE && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 z-40">
          <motion.div 
            className="h-full"
            style={{backgroundColor: '#0113A3'}}
            initial={{ width: 0 }}
            animate={{ width: `${getProgress()}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}

      {/* 스크롤 가능한 메인 콘텐츠 영역 */}
      <div className="register-scroll-area" style={{ 
        paddingTop: currentStep !== REGISTER_STEPS.COMPLETE ? '24px' : '20px', // 진행률 바 공간
        paddingBottom: currentStep !== REGISTER_STEPS.COMPLETE ? '100px' : '20px' // 하단 버튼 공간
      }}>
        <div className="flex-1 flex items-center justify-center min-h-0">
          <div className="w-full max-w-md mx-auto py-4 register-content">
            <AnimatePresence mode="wait">
          {/* 약관 동의 단계 */}
          {currentStep === REGISTER_STEPS.TERMS && (
            <motion.div
              key="terms"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full h-full flex flex-col"
            >
              <div 
                className="text-center register-header"
                style={{
                  marginBottom: /iPad|iPhone|iPod/.test(navigator.userAgent) ? '0' : '16px' // iOS에서만 마진 제거
                }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2" style={{backgroundColor: '#0113A3'}}>
                  <FiFileText className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  {registerData.isSocialLogin ? 
                    `${registerData.socialProvider === 'google' ? '구글' : '카카오'} 회원가입` : 
                    '서비스 이용약관'
                  }
                </h2>
                <p className="text-sm text-gray-600" style={{ wordBreak: 'keep-all' }}>
                  {registerData.isSocialLogin ? 
                    `${registerData.socialProvider === 'google' ? '구글' : '카카오'} 계정으로 간편 회원가입을 진행합니다` :
                    'SMAP 서비스 이용을 위해 약관에 동의해주세요'
                  }
                </p>
                {registerData.isSocialLogin && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-700" style={{ wordBreak: 'keep-all' }}>
                      📧 <strong>{registerData.mt_email}</strong><br/>
                      전화번호 인증 없이 간편하게 가입할 수 있습니다
                    </p>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pb-4 register-form" style={{paddingTop: '20px' }}>
                {/* 전체 동의 */}
                <div className="bg-white rounded-xl p-4 border-2" style={{borderColor: '#e0e7ff'}}>
                  <label className="block cursor-pointer">
                                          <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={TERMS_DATA.every(term => registerData[term.id as keyof RegisterData] as boolean)}
                          onChange={(e) => handleAllAgree(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          TERMS_DATA.every(term => registerData[term.id as keyof RegisterData] as boolean)
                            ? 'border-gray-300' 
                            : 'border-gray-300'
                        }`}
                          style={TERMS_DATA.every(term => registerData[term.id as keyof RegisterData] as boolean) 
                            ? {backgroundColor: '#0113A3', borderColor: '#0113A3'} 
                            : {}}>
                          {TERMS_DATA.every(term => registerData[term.id as keyof RegisterData] as boolean) && (
                            <FiCheck className="w-3 h-3 text-white" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold text-gray-900">전체 동의</span>
                      </div>
                    </div>
                  </label>
                </div>

                {/* 개별 약관 */}
                {TERMS_DATA.map((term) => (
                  <div key={term.id} className="bg-white rounded-xl p-3 border border-gray-100">
                    <label className="block cursor-pointer">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={registerData[term.id as keyof RegisterData] as boolean}
                            onChange={(e) => handleTermAgree(term.id, e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            registerData[term.id as keyof RegisterData]
                              ? 'border-gray-300' 
                              : 'border-gray-300'
                          }`}
                            style={registerData[term.id as keyof RegisterData] 
                              ? {backgroundColor: '#0113A3', borderColor: '#0113A3'} 
                              : {}}>
                            {registerData[term.id as keyof RegisterData] && (
                              <FiCheck className="w-3 h-3 text-white" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900">{term.title}</span>
                            {term.required && (
                              <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">필수</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1" style={{ wordBreak: 'keep-all' }}>{term.content}</p>
                        </div>
                        <div className="flex-shrink-0 mt-0.5">
                          <FiArrowRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* 전화번호 입력 단계 */}
          {currentStep === REGISTER_STEPS.PHONE && (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full h-full flex flex-col justify-center"
            >
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2" style={{backgroundColor: '#0113A3'}}>
                  <FiPhone className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">전화번호 인증</h2>
                <p className="text-sm text-gray-600" style={{ wordBreak: 'keep-all' }}>본인 확인을 위해 전화번호를 입력해주세요</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    전화번호
                  </label>
                  <div className="relative register-input-container">
                    <div className="absolute left-6 z-10 pointer-events-none" style={{top: '50%', transform: 'translateY(-50%)'}}>
                      <FiPhone className="w-4 h-4 transition-colors duration-200" 
                        style={{color: focusedField === 'phone' ? '#0113A3' : '#9CA3AF'}} />
                    </div>
              <input
                      type="tel"
                      value={registerData.mt_id}
                      onChange={handlePhoneNumberChange}
                      onFocus={(e) => {
                        setFocusedField('phone');
                        handlePhoneInputFocus();
                        e.target.style.boxShadow = '0 0 0 2px #0113A3';
                      }}
                      onBlur={(e) => {
                        setFocusedField(null);
                        e.target.style.boxShadow = '';
                      }}
                      placeholder="010-1234-5678"
                      maxLength={13}
                      className="w-full pl-12 pr-6 py-4 px-1 border border-gray-200 rounded-xl focus:ring-2 focus:border-transparent register-input"
                      style={{outlineOffset: '2px'}}
                    />
                  </div>
                </div>

                {verificationSent && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl p-4"
                    style={{backgroundColor: '#eff6ff', border: '1px solid #c7d2fe'}}
                  >
                    <div className="flex items-center space-x-2">
                      <FiCheck className="w-5 h-5" style={{color: '#0113A3'}} />
                      <span className="font-medium" style={{color: '#1e40af'}}>인증번호가 발송되었습니다</span>
                    </div>
                    <p className="text-sm mt-1" style={{ wordBreak: 'keep-all', color: '#0113A3' }}>
                      {registerData.mt_id}로 인증번호를 발송했습니다
                    </p>
                  </motion.div>
              )}
            </div>
            </motion.div>
          )}

          {/* 인증번호 확인 단계 */}
          {currentStep === REGISTER_STEPS.VERIFICATION && (
            <motion.div
              key="verification"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full h-full flex flex-col justify-center"
            >
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2" style={{backgroundColor: '#0113A3'}}>
                  <FiShield className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">인증번호 입력</h2>
                <p className="text-sm text-gray-600" style={{ wordBreak: 'keep-all' }}>
                  {registerData.mt_id}로 발송된<br />
                  인증번호 6자리를 입력해주세요
                </p>
              </div>

              <div className="space-y-6">
                {/* 인증번호 미발송 상태 안내 */}
                {!verificationSent && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <span className="text-orange-700 font-medium">인증번호가 발송되지 않았습니다</span>
                    </div>
                    <p className="text-orange-600 text-sm" style={{ wordBreak: 'keep-all' }}>
                      먼저 이전 단계에서 인증번호를 요청해주세요.
                    </p>
                  </div>
                )}

            <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    인증번호
              </label>
              <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={registerData.verification_code}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, ''); // 숫자만 허용
                      setRegisterData(prev => ({ ...prev, verification_code: value }));
                    }}
                    placeholder="123456"
                    maxLength={6}
                    className="w-full px-5 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-offset-0 focus:border-transparent text-center text-2xl font-mono tracking-widest register-input"
                    onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px #0113A3'}
                    onBlur={(e) => e.target.style.boxShadow = ''}
                    style={{ outline: 'none' }}
                  />
                  {verificationTimer > 0 && (
                    <p className="text-sm text-gray-500 mt-2 text-center">
                      {Math.floor(verificationTimer / 60)}:{(verificationTimer % 60).toString().padStart(2, '0')} 후 만료
                    </p>
                  )}
                  
                  {/* 재발송 텍스트 버튼 */}
                  <div className="text-center mt-4">
                    <button
                      onClick={() => {
                        // 인증번호가 발송되지 않은 경우 이전 단계로 이동
                        if (!verificationSent) {
                          setCurrentStep(REGISTER_STEPS.PHONE);
                          setRegisterData(prev => ({ ...prev, verification_code: '' }));
                          return;
                        }
                        
                        // 3분 쿨다운 체크
                        const now = Date.now();
                        if (lastSentTime && (now - lastSentTime) < 180000) {
                          const remainingTime = Math.ceil((180000 - (now - lastSentTime)) / 1000);
                          const minutes = Math.floor(remainingTime / 60);
                          const seconds = remainingTime % 60;
                          setErrorModal({
                            isOpen: true,
                            title: '재발송 제한',
                            message: `같은 번호로는 ${minutes}분 ${seconds}초 후에 재발송이 가능합니다.`,
                            isCountdown: true,
                            style: { wordBreak: 'keep-all' }
                          });
                          setCountdownTime(remainingTime);
                          return;
                        }
                        
                        // 인증번호 재발송
                        handleSendVerification();
                      }}
                      disabled={isLoading}
                      className="text-sm text-gray-600 hover:text-gray-800 underline disabled:opacity-50"
                    >
                      {!verificationSent ? '이전 단계로' : '인증번호 재발송'}
                    </button>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      // 인증번호가 발송되지 않은 경우 이전 단계로 이동
                      if (!verificationSent) {
                        setCurrentStep(REGISTER_STEPS.PHONE);
                        setRegisterData(prev => ({ ...prev, verification_code: '' }));
                        return;
                      }
                      
                      // 3분 쿨다운 체크
                      const now = Date.now();
                      if (lastSentTime && (now - lastSentTime) < 180000) {
                        const remainingTime = Math.ceil((180000 - (now - lastSentTime)) / 1000);
                        const minutes = Math.floor(remainingTime / 60);
                        const seconds = remainingTime % 60;
                        setErrorModal({
                          isOpen: true,
                          title: '재발송 제한',
                          message: `같은 번호로는 ${minutes}분 ${seconds}초 후에 재발송이 가능합니다.`,
                          isCountdown: true,
                          style: { wordBreak: 'keep-all' }
                        });
                        setCountdownTime(remainingTime);
                        return;
                      }
                      
                      // 인증번호 재발송
                      handleSendVerification();
                    }}
                    disabled={isLoading}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    {!verificationSent ? '이전 단계로' : '재발송'}
                  </button>
                  <motion.button
                    onClick={handleVerifyCode}
                    disabled={!registerData.verification_code || isLoading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 py-3 text-white rounded-xl font-semibold disabled:opacity-50"
                    style={{backgroundColor: '#0113A3'}}
                  >
                    {isLoading ? '확인 중...' : '확인'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* 기본 정보 입력 단계 */}
          {currentStep === REGISTER_STEPS.BASIC_INFO && (
            <motion.div
              key="basic_info"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full h-full flex flex-col"
            >
              <div className="text-center mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2" style={{backgroundColor: '#0113A3'}}>
                  <FiUser className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">기본 정보</h2>
                <p className="text-sm text-gray-600" style={{ wordBreak: 'keep-all' }}>서비스 이용을 위한 기본 정보를 입력해주세요</p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pb-4 register-form">
                {/* 비밀번호 */}
            <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    비밀번호
              </label>
                  <div className="relative register-input-container px-0.5">
                    <div className="absolute left-5 z-10 pointer-events-none" style={{top: '50%', transform: 'translateY(-50%)'}}>
                      <FiLock className="w-4 h-4 transition-colors duration-200" 
                        style={{color: focusedField === 'password' ? '#0113A3' : '#9CA3AF'}} />
                    </div>
              <input
                      type={showPassword ? 'text' : 'password'}
                      value={registerData.mt_pwd}
                      onChange={(e) => {
                        const password = e.target.value;
                        setRegisterData(prev => ({ ...prev, mt_pwd: password }));
                        validatePassword(password);
                      }}
                      onFocus={(e) => {
                        setFocusedField('password');
                        e.target.style.boxShadow = '0 0 0 2px #0113A3';
                      }}
                      onBlur={(e) => {
                        setFocusedField(null);
                        e.target.style.boxShadow = '';
                      }}
                      placeholder="8자 이상, 대소문자, 숫자, 특수문자 포함"
                      className="w-full pl-11 pr-10 py-2.5 px-1 border border-gray-200 rounded-xl focus:ring-2 focus:ring-offset-0 focus:border-transparent register-input"
                      style={{ outline: 'none' }}
                    />
                    <div className="absolute right-2.5" style={{top: '50%', transform: 'translateY(-50%)'}}>
                                            <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  {/* 비밀번호 강도 표시기 */}
                  {registerData.mt_pwd && (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex space-x-1">
                        {Object.values(passwordStrength).map((isValid, index) => (
                          <div
                            key={index}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              isValid ? 'bg-green-500' : 'bg-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        {[
                          { key: 'minLength', label: '8자+', valid: passwordStrength.minLength },
                          { key: 'hasUppercase', label: '대문자', valid: passwordStrength.hasUppercase },
                          { key: 'hasLowercase', label: '소문자', valid: passwordStrength.hasLowercase },
                          { key: 'hasNumber', label: '숫자', valid: passwordStrength.hasNumber },
                          { key: 'hasSpecialChar', label: '특수문자', valid: passwordStrength.hasSpecialChar }
                        ].map(({ key, label, valid }) => (
                          <div key={key} className={`flex items-center space-x-1 ${valid ? 'text-green-600' : 'text-gray-500'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${valid ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <span>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {passwordError && (
                    <p className="text-red-500 text-sm mt-2" style={{ wordBreak: 'keep-all' }}>{passwordError}</p>
              )}
            </div>

                {/* 비밀번호 확인 */}
            <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    비밀번호 확인
              </label>
                  <div className="relative register-input-container px-0.5">
                    <div className="absolute left-5 z-10 pointer-events-none" style={{top: '50%', transform: 'translateY(-50%)'}}>
                      <FiLock className="w-4 h-4 transition-colors duration-200" 
                        style={{color: focusedField === 'passwordConfirm' ? '#0113A3' : '#9CA3AF'}} />
                    </div>
              <input
                      type={showPasswordConfirm ? 'text' : 'password'}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      onFocus={(e) => {
                        setFocusedField('passwordConfirm');
                        e.target.style.boxShadow = '0 0 0 2px #0113A3';
                      }}
                      onBlur={(e) => {
                        setFocusedField(null);
                        e.target.style.boxShadow = '';
                      }}
                      placeholder="비밀번호를 다시 입력해주세요"
                      className="w-full pl-11 pr-12 py-2.5 px-1 border border-gray-200 rounded-xl focus:ring-2 focus:ring-offset-0 focus:border-transparent register-input"
                      style={{ outline: 'none' }}
                    />
                    <div className="absolute right-2.5" style={{top: '50%', transform: 'translateY(-50%)'}}>
                      <button
                        type="button"
                        onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPasswordConfirm ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {passwordConfirm && passwordConfirm !== registerData.mt_pwd && (
                    <p className="text-red-500 text-sm mt-1" style={{ wordBreak: 'keep-all' }}>비밀번호가 일치하지 않습니다</p>
                  )}
                  {passwordConfirm && passwordConfirm === registerData.mt_pwd && registerData.mt_pwd && (
                    <p className="text-green-500 text-sm mt-1 flex items-center" style={{ wordBreak: 'keep-all' }}>
                      <FiCheck className="w-4 h-4 mr-1" />
                      비밀번호가 일치합니다
                    </p>
              )}
            </div>

                {/* 이름 */}
            <div className="px-0.5">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    이름
              </label>
              <input
                    type="text"
                    value={registerData.mt_name}
                    onChange={(e) => setRegisterData(prev => ({ ...prev, mt_name: e.target.value }))}
                    placeholder="실명을 입력해주세요"
                    className="w-full px-5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-offset-0 focus:border-transparent register-input"
                    onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px #0113A3'}
                    onBlur={(e) => e.target.style.boxShadow = ''}
                    style={{ outline: 'none' }}
                  />
                </div>

                {/* 닉네임 */}
                <div className="px-0.5">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    닉네임
                  </label>
                  <input
                    type="text"
                    value={registerData.mt_nickname}
                    onChange={(e) => setRegisterData(prev => ({ ...prev, mt_nickname: e.target.value }))}
                    placeholder="다른 사용자에게 표시될 닉네임"
                    className="w-full px-5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-offset-0 focus:border-transparent register-input"
                    onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px #0113A3'}
                    onBlur={(e) => e.target.style.boxShadow = ''}
                    style={{ outline: 'none' }}
                  />
                </div>

                {/* 이메일 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {registerData.isSocialLogin ? 'ID (이메일)' : '이메일 (선택)'}
                  </label>
                  {registerData.isSocialLogin && (
                    <p className="text-xs text-blue-600 mb-2" style={{ wordBreak: 'keep-all' }}>
                      {registerData.socialProvider === 'google' ? '구글' : '카카오'} 계정의 이메일이 ID로 사용됩니다
                    </p>
                  )}
                  <div className="relative register-input-container px-0.5">
                    <div className="absolute left-5 z-10 pointer-events-none" style={{top: '50%', transform: 'translateY(-50%)'}}>
                      <FiMail className="w-4 h-4 transition-colors duration-200" 
                        style={{color: focusedField === 'email' ? '#0113A3' : '#9CA3AF'}} />
                    </div>
                    <input
                      type="email"
                      value={registerData.mt_email}
                      onChange={(e) => {
                        if (registerData.isSocialLogin) return; // 소셜 로그인 시 변경 불가
                        const email = e.target.value;
                        setRegisterData(prev => ({ ...prev, mt_email: email }));
                        validateEmail(email);
                      }}
                      onFocus={(e) => {
                        if (!registerData.isSocialLogin) {
                          setFocusedField('email');
                          e.target.style.boxShadow = '0 0 0 2px #0113A3';
                        }
                      }}
                      onBlur={(e) => {
                        setFocusedField(null);
                        e.target.style.boxShadow = '';
                      }}
                      placeholder={registerData.isSocialLogin ? '' : 'example@email.com'}
                      disabled={registerData.isSocialLogin}
                      className={`w-full pl-11 pr-12 py-2.5 px-1 border border-gray-200 rounded-xl focus:ring-2 focus:ring-offset-0 focus:border-transparent register-input ${
                        registerData.isSocialLogin ? 'bg-gray-50 cursor-not-allowed' : ''
                      }`}
                      style={{ outline: 'none' }}
                    />
                    {registerData.mt_email && !emailError && (
                      <div className="absolute right-2.5" style={{top: '50%', transform: 'translateY(-50%)'}}>
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    {emailError && !registerData.isSocialLogin && (
                      <div className="absolute right-2.5" style={{top: '50%', transform: 'translateY(-50%)'}}>
                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {emailError && !registerData.isSocialLogin && (
                    <p className="text-red-500 text-sm mt-1" style={{ wordBreak: 'keep-all' }}>{emailError}</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* 프로필 정보 단계 */}
          {currentStep === REGISTER_STEPS.PROFILE && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full h-full flex flex-col justify-center"
            >
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2" style={{backgroundColor: '#0113A3'}}>
                  <FiHeart className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">프로필 정보</h2>
                <p className="text-sm text-gray-600" style={{ wordBreak: 'keep-all' }}>추가 정보를 입력해주세요</p>
              </div>

              <div className="space-y-6">
                {/* 생년월일 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    생년월일
                  </label>
                  <button
                    type="button"
                    onClick={handleBirthModalOpen}
                    className="w-full flex items-center px-4 py-3 border border-gray-200 rounded-xl transition-colors text-left hover:border-blue-300"
                    onFocus={(e) => {
                      setFocusedField('birth');
                      (e.target as HTMLButtonElement).style.boxShadow = '0 0 0 2px #0113A3';
                    }}
                    onBlur={(e) => {
                      setFocusedField(null);
                      (e.target as HTMLButtonElement).style.boxShadow = '';
                    }}
                  >
                    <FiCalendar className="w-5 h-5 mr-3 transition-colors duration-200" 
                      style={{color: focusedField === 'birth' ? '#0113A3' : '#9CA3AF'}} />
                    <span className={registerData.mt_birth ? 'text-gray-900' : 'text-gray-500'}>
                      {registerData.mt_birth 
                        ? dayjs(registerData.mt_birth).format('YYYY년 MM월 DD일')
                        : '생년월일을 선택해주세요'
                      }
                    </span>
                    <FiChevronDown className="w-5 h-5 text-gray-400 ml-auto" />
                  </button>
                </div>

                {/* 성별 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    성별
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRegisterData(prev => ({ ...prev, mt_gender: 1 }))}
                      className={`py-3 rounded-xl border-2 font-medium transition-all ${
                        registerData.mt_gender === 1
                          ? 'border-gray-200 text-gray-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                      style={registerData.mt_gender === 1 
                        ? {borderColor: '#0113A3', backgroundColor: '#eff6ff', color: '#1e40af'} 
                        : {}}
                    >
                      남성
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegisterData(prev => ({ ...prev, mt_gender: 2 }))}
                      className={`py-3 rounded-xl border-2 font-medium transition-all ${
                        registerData.mt_gender === 2
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      여성
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 위치 정보 단계 */}
          {currentStep === REGISTER_STEPS.LOCATION && (
            <motion.div
              key="location"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full h-full flex flex-col justify-center"
            >
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2" style={{backgroundColor: '#0113A3'}}>
                  <FiMapPin className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">위치 정보</h2>
                <p className="text-sm text-gray-600" style={{ wordBreak: 'keep-all' }}>
                  위치 기반 서비스 이용을 위해<br />
                  현재 위치를 설정해주세요
                </p>
              </div>

              <div className="space-y-4">
                {/* 위치 정보 성공 */}
                {registerData.mt_lat && registerData.mt_long && !locationLoading && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <FiCheck className="w-5 h-5 text-green-500" />
                      <span className="text-green-700 font-medium">위치 정보가 설정되었습니다</span>
                    </div>
                    <p className="text-green-600 text-sm mb-3" style={{ wordBreak: 'keep-all' }}>
                      위도: {registerData.mt_lat.toFixed(6)}<br />
                      경도: {registerData.mt_long.toFixed(6)}
                    </p>
                    <motion.button
                      onClick={handleGetLocation}
                      disabled={locationLoading}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-2.5 bg-green-100 text-green-700 rounded-xl font-medium text-sm border border-green-200 hover:bg-green-200 transition-colors"
                    >
                      위치 다시 가져오기
                    </motion.button>
                  </div>
                )}

                {/* 위치 정보 요청 */}
                {!registerData.mt_lat && !registerData.mt_long && !locationLoading && !locationError && (
                  <div className="rounded-xl p-4" style={{backgroundColor: '#eff6ff', border: '1px solid #c7d2fe'}}>
                    <div className="flex items-center space-x-2 mb-2">
                      <FiMapPin className="w-5 h-5" style={{color: '#0113A3'}} />
                      <span className="font-medium" style={{color: '#1e40af'}}>위치 정보 설정</span>
                    </div>
                    <p className="text-sm mb-4" style={{ wordBreak: 'keep-all', color: '#0113A3' }}>
                      그룹 멤버들과의 위치 공유, 주변 정보 제공 등을 위해 위치 정보가 필요합니다.
                    </p>
                    <motion.button
                      onClick={handleGetLocation}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-3 text-white rounded-xl font-semibold shadow-lg"
                      style={{backgroundColor: '#0113A3'}}
                    >
                      현재 위치 가져오기
                    </motion.button>
                  </div>
                )}

                {/* 로딩 상태 */}
                {locationLoading && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-blue-700 font-medium">위치 정보를 가져오는 중...</span>
                    </div>
                    <p className="text-blue-600 text-sm" style={{ wordBreak: 'keep-all' }}>
                      브라우저에서 위치 권한을 요청할 수 있습니다.<br />
                      '허용'을 선택해주세요.
                    </p>
                  </div>
                )}

                {/* 에러 상태 */}
                {locationError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <span className="text-red-700 font-medium">위치 정보 가져오기 실패</span>
                    </div>
                    <p className="text-red-600 text-sm mb-3" style={{ wordBreak: 'keep-all' }}>
                      {locationError}
                    </p>
                    <div className="space-y-2">
                      <motion.button
                        onClick={handleGetLocation}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-2.5 bg-red-600 text-white rounded-xl font-medium text-sm shadow-lg"
                      >
                        다시 시도
                      </motion.button>
                      <motion.button
                        onClick={() => {
                          setLocationError('');
                          // 위치 정보 없이 진행하는 경우 (선택사항이므로)
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm border border-gray-200 hover:bg-gray-200 transition-colors"
                      >
                        위치 정보 없이 진행
                      </motion.button>
                    </div>
                  </div>
                )}

                {/* 위치 정보 안내 */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start space-x-2">
                    <FiShield className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-gray-700 text-sm font-medium mb-1">개인정보 보호</p>
                      <p className="text-gray-600 text-xs leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                        위치 정보는 그룹 서비스 제공 목적으로만 사용되며, 사용자의 동의 없이 제3자에게 제공되지 않습니다. 언제든지 설정에서 위치 공유를 중단할 수 있습니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 완료 단계 */}
          {currentStep === REGISTER_STEPS.COMPLETE && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full h-full flex flex-col justify-center text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <FiCheck className="w-12 h-12 text-white" />
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h2 className="text-3xl font-bold text-gray-900 mb-4">회원가입 완료!</h2>
                <p className="text-gray-600 mb-8" style={{ wordBreak: 'keep-all' }}>
                  {isJoiningGroup ? (
                    <>
                      그룹에 자동 가입 중입니다...<br />
                      잠시만 기다려주세요!
                    </>
                  ) : isOpeningApp ? (
                    <>
                      앱으로 이동 중입니다...<br />
                      {isMobile() ? '앱이 열리지 않으면 스토어로 이동합니다' : '로그인 페이지로 이동합니다'}
                    </>
                  ) : (
                    <>
                      SMAP에 오신 것을 환영합니다.<br />
                      이제 그룹을 만들고 친구들과 함께 활동해보세요!
                    </>
                  )}
                </p>
                
                {!isJoiningGroup && !isOpeningApp && (
                  <motion.button
                    onClick={() => {
                      // 사용자 입력 정보를 localStorage에 저장
                      const userInfo = {
                        phone: registerData.mt_id,
                        name: registerData.mt_name,
                        nickname: registerData.mt_nickname,
                        email: registerData.mt_email,
                        birth: registerData.mt_birth,
                        gender: registerData.mt_gender,
                        registeredAt: new Date().toISOString()
                      };
                      
                      try {
                        localStorage.setItem('recentUserInfo', JSON.stringify(userInfo));
                        // 로그인 페이지에서 사용할 전화번호도 별도 저장
                        localStorage.setItem('lastRegisteredPhone', registerData.mt_id);
                      } catch (error) {
                        console.error('사용자 정보 저장 실패:', error);
                      }
                      
                      router.push('/signin');
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold text-lg"
                  >
                    로그인하러 가기
                  </motion.button>
                )}
                
                {isJoiningGroup && (
                  <div className="flex items-center justify-center space-x-2 text-gray-600">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
                    <span>그룹 가입 중...</span>
                  </div>
                )}
                
                {isOpeningApp && (
                  <div className="flex items-center justify-center space-x-2 text-gray-600">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
                    <span>앱으로 이동 중...</span>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 하단 고정 버튼 */}
      {currentStep !== REGISTER_STEPS.COMPLETE && (
        <div className="register-bottom-fixed">
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="p-4 safe-area-bottom"
            data-bottom-button
            style={{ 
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
              background: 'linear-gradient(to bottom right, rgba(240, 249, 255, 0.95), rgba(253, 244, 255, 0.95))',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderTop: '1px solid rgba(229, 231, 235, 0.3)'
            }}
          >
            <motion.button
              onClick={() => {
                console.log('하단 버튼 클릭됨, 현재 단계:', currentStep);
                console.log('isStepValid():', isStepValid());
                console.log('isLoading:', isLoading);
                
                if (currentStep === REGISTER_STEPS.PHONE) {
                  console.log('인증번호 발송 함수 호출');
                  handleSendVerification();
                } else if (currentStep === REGISTER_STEPS.VERIFICATION) {
                  console.log('인증번호 확인 함수 호출');
                  handleVerifyCode();
                } else if (currentStep === REGISTER_STEPS.LOCATION) {
                  console.log('회원가입 완료 함수 호출');
                  handleRegister();
                } else {
                  console.log('다음 단계 함수 호출');
                  handleNext();
                }
              }}
              disabled={!isStepValid() || isLoading || locationLoading}
              whileHover={{ scale: (isStepValid() && !locationLoading) ? 1.02 : 1 }}
              whileTap={{ scale: (isStepValid() && !locationLoading) ? 0.98 : 1 }}
              className={`w-full py-4 rounded-xl font-semibold text-lg transition-all register-button ${
                (isStepValid() && !locationLoading)
                  ? 'text-white shadow-lg'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              style={(isStepValid() && !locationLoading) 
                ? {backgroundColor: '#0113A3'} 
                : {}}
            >
              {isLoading ? '처리 중...' : 
               locationLoading ? '위치 정보 가져오는 중...' :
               currentStep === REGISTER_STEPS.PHONE ? '인증번호 발송' :
               currentStep === REGISTER_STEPS.VERIFICATION ? '인증번호 확인' :
               currentStep === REGISTER_STEPS.LOCATION ? '회원가입 완료' : '다음'}
            </motion.button>
          </motion.div>
        </div>
      )}

      {/* 오류 모달 */}
      {errorModal.isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setErrorModal({ isOpen: false, title: '', message: '', isCountdown: false })}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white rounded-3xl w-full max-w-sm mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 pb-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{errorModal.title}</h3>
                <p className="text-gray-600 leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                  {errorModal.message}
                </p>
              </div>
              
              <motion.button
                onClick={() => setErrorModal({ isOpen: false, title: '', message: '', isCountdown: false })}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 bg-red-500 text-white rounded-2xl font-medium hover:bg-red-600 transition-colors"
              >
                확인
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 생년월일 캘린더 모달 */}
      <AnimatePresence>
        {birthModalOpen && (
          <motion.div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" 
            onClick={() => setBirthModalOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div 
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl mx-4"
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="p-6">
                                  {/* 헤더 */}
                  <div className="text-center mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2" style={{backgroundColor: '#0113A3'}}>
                      <FiCalendar className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">생년월일 선택</h3>
                    <p className="text-sm text-gray-600" style={{ wordBreak: 'keep-all' }}>생년월일을 선택해주세요</p>
                  </div>

                {/* 캘린더 헤더 */}
                <div className="flex items-center justify-between mb-6">
                  <motion.button
                    onClick={handleCalendarPrevMonth}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <FiChevronLeft className="w-5 h-5 text-gray-600" />
                  </motion.button>
                  
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-0 mb-2">
                      <select
                        value={calendarCurrentMonth.year()}
                        onChange={(e) => setCalendarCurrentMonth(calendarCurrentMonth.year(parseInt(e.target.value)))}
                        className="text-lg font-bold bg-transparent border-none focus:outline-none text-gray-900 cursor-pointer min-w-[110px]"
                      >
                        {Array.from({ length: 75 }, (_, i) => {
                          const year = new Date().getFullYear() - i;
                          return (
                            <option key={year} value={year}>
                              {year}년
                            </option>
                          );
                        })}
                      </select>
                      <select
                        value={calendarCurrentMonth.month() + 1}
                        onChange={(e) => setCalendarCurrentMonth(calendarCurrentMonth.month(parseInt(e.target.value) - 1))}
                        className="text-lg font-bold bg-transparent border-none focus:outline-none text-gray-900 cursor-pointer min-w-[75px] pr-6"
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}월
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleCalendarToday}
                      className="text-sm transition-colors"
                      style={{color: '#0113A3'}}
                      onMouseEnter={(e) => (e.target as HTMLButtonElement).style.color = '#1e40af'}
                      onMouseLeave={(e) => (e.target as HTMLButtonElement).style.color = '#0113A3'}
                    >
                      오늘로 이동
              </button>
            </div>
                  
                  <motion.button
                    onClick={handleCalendarNextMonth}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <FiChevronRight className="w-5 h-5 text-gray-600" />
                  </motion.button>
                </div>

                {/* 요일 헤더 */}
                <div className="grid grid-cols-7 gap-1 mb-3">
                  {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
                    <div key={day} className={`h-8 flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : 'text-gray-700'
                    }`}>
                      {day}
                    </div>
                  ))}
                </div>

                {/* 캘린더 그리드 */}
                <div className="grid grid-cols-7 gap-1 mb-6">
                  {(() => {
                    const days = [];
                    const daysInMonth = calendarCurrentMonth.daysInMonth();
                    const firstDayOfMonth = calendarCurrentMonth.startOf('month').day();
                    const today = dayjs();
                    
                    // 빈 칸 추가 (이전 달 마지막 날들)
                    for (let i = 0; i < firstDayOfMonth; i++) {
                      days.push(<div key={`empty-${i}`} className="h-10"></div>);
                    }
                    
                    // 현재 달의 날짜들
                    for (let day = 1; day <= daysInMonth; day++) {
                      const currentDate = calendarCurrentMonth.date(day);
                      const isSelected = selectedDate?.isSame(currentDate, 'day');
                      const isToday = today.isSame(currentDate, 'day');
                      const isFuture = currentDate.isAfter(today, 'day');
                      
                      days.push(
                        <button
                          key={day}
                          onClick={() => handleCalendarDateSelect(currentDate)}
                          disabled={isFuture}
                          className={`
                            h-10 w-full rounded-lg flex items-center justify-center text-sm font-medium transition-all duration-200
                            ${isSelected ? 'text-white font-semibold shadow-lg' : ''}
                            ${isToday && !isSelected ? 'font-semibold' : ''}
                            ${!isSelected && !isToday && !isFuture ? 'hover:bg-gray-100 text-gray-800' : ''}
                            ${isFuture ? 'text-gray-300 cursor-not-allowed' : ''}
                          `}
                          style={isSelected 
                            ? {backgroundColor: '#0113A3'} 
                            : isToday && !isSelected 
                              ? {backgroundColor: '#eff6ff', color: '#1e40af'}
                              : {}}
                        >
                          {day}
                        </button>
                      );
                    }
                    
                    return days;
                  })()}
                </div>

                {/* 선택된 날짜 표시 */}
                {selectedDate && (
                  <div className="text-center mb-6 p-4 rounded-xl" style={{backgroundColor: '#eff6ff', border: '1px solid #e0e7ff'}}>
                    <p className="text-sm text-gray-600">선택된 날짜</p>
                    <p className="text-lg font-bold" style={{ wordBreak: 'keep-all', color: '#1e40af' }}>
                      {selectedDate.format('YYYY년 MM월 DD일 (ddd)')}
            </p>
          </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex space-x-3">
                  <button
                    onClick={() => setBirthModalOpen(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleBirthConfirm}
                    disabled={!selectedDate}
                    className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                      selectedDate
                        ? 'text-white'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                    style={selectedDate 
                      ? {backgroundColor: '#0113A3'}
                      : {}}
                  >
                    확인
                  </button>
        </div>
      </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 