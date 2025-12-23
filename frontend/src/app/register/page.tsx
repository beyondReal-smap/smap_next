'use client';

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
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
import { FaApple } from 'react-icons/fa';
import groupService from '@/services/groupService';
import { REGISTER_STEPS, useRegisterContext } from './RegisterContext';

// 약관 데이터
const TERMS_DATA = [
  {
    id: 'mt_agree1',
    title: '서비스 이용약관',
    required: true,
    content: 'SMAP 서비스 이용에 관한 기본 약관입니다.',
    link: '/setting/service'
  },
  {
    id: 'mt_agree2',
    title: '개인정보 처리방침',
    required: true,
    content: '개인정보 수집, 이용, 보관에 관한 정책입니다.',
    link: '/setting/terms/privacy'
  },
  {
    id: 'mt_agree3',
    title: '위치기반서비스 이용약관',
    required: true,
    content: '위치정보 수집 및 이용에 관한 약관입니다.',
    link: '/setting/terms/location'
  },
  {
    id: 'mt_agree4',
    title: '개인정보 제3자 제공 동의',
    required: false,
    content: '서비스 향상을 위한 개인정보 제3자 제공 동의입니다.',
    link: '/setting/terms/third-party'
  },
  {
    id: 'mt_agree5',
    title: '마케팅 정보 수신 동의',
    required: false,
    content: '이벤트, 혜택 등 마케팅 정보 수신 동의입니다.',
    link: '/setting/terms/marketing'
  }
];

// 소셜 로그인 데이터 타입
interface SocialLoginData {
  provider: string;
  email: string;
  name: string;
  nickname: string;
  given_name?: string; // 구글에서 받아온 이름
  family_name?: string; // 구글에서 받아온 성
  profile_image?: string;
  google_id?: string;
  kakao_id?: string;
  apple_id?: string;
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
  profile_image?: string | null;  // 소셜 로그인 프로필 이미지
}

export default function RegisterPage() {
  const [isIOSReady, setIsIOSReady] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  // iOS 초기 렌더링 제어 및 데이터 로딩 상태 관리
  React.useEffect(() => {
    console.log('🔥 [REGISTER] 페이지 초기화 시작');
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    const handlePageReady = () => {
      console.log('🔥 [REGISTER] 페이지 준비 완료');
      setIsIOSReady(true);

      // 데이터 로딩 대기 (소셜 로그인 데이터 확인)
      setTimeout(() => {
        console.log('🔥 [REGISTER] 데이터 로딩 체크 시작');
        const urlParams = new URLSearchParams(window.location.search);
        const socialProvider = urlParams.get('social');

        if (socialProvider) {
          // 소셜 로그인인 경우 localStorage 데이터 대기
          let attempts = 0;
          const maxAttempts = 10; // 최대 2초 대기

          const checkData = () => {
            const socialData = localStorage.getItem('socialLoginData');
            console.log(`🔥 [REGISTER] 데이터 체크 시도 ${attempts + 1}/${maxAttempts}:`, socialData ? '데이터 있음' : '데이터 없음');

            if (socialData) {
              console.log('🔥 [REGISTER] 소셜 로그인 데이터 확인됨');
              setIsDataLoaded(true);
              setIsInitializing(false);
            } else if (attempts < maxAttempts) {
              attempts++;
              setTimeout(checkData, 200);
            } else {
              console.warn('🔥 [REGISTER] 소셜 로그인 데이터 로딩 타임아웃');
              setInitError('소셜 로그인 데이터를 불러오는데 실패했습니다.');
              setIsDataLoaded(false);
              setIsInitializing(false);
            }
          };

          checkData();
        } else {
          // 일반 회원가입인 경우 바로 로딩 완료
          console.log('🔥 [REGISTER] 일반 회원가입 - 즉시 로딩 완료');
          setIsDataLoaded(true);
          setIsInitializing(false);
        }
      }, isIOS ? 500 : 100); // iOS에서는 더 긴 대기 시간
    };

    if (isIOS) {
      console.log('📱 [REGISTER] iOS 환경 감지 - DOM 로딩 대기');
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', handlePageReady);
        return () => document.removeEventListener('DOMContentLoaded', handlePageReady);
      } else {
        // DOM이 이미 로드된 경우 약간의 지연 후 실행
        setTimeout(handlePageReady, 100);
      }
    } else {
      console.log('💻 [REGISTER] 데스크탑/안드로이드 환경 - 즉시 준비');
      handlePageReady();
    }
  }, []);

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
      
      /* 모바일 최적화 */
      @media screen and (max-width: 768px) {
        .register-input {
          font-size: 16px;
        }
        .register-button {
          min-height: 44px;
        }
      }
      
      /* iOS 애니메이션 최적화 */
      @supports (-webkit-touch-callout: none) {
        /* iOS 초기 렌더링 제어 */
        .register-content-area {
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.5s ease, visibility 0.5s ease;
        }
        
        .register-content-area.ios-ready {
          opacity: 1;
          visibility: visible;
        }
        
        /* iOS 애니메이션 성능 최적화 */
        .register-content-area,
        .register-scroll-area,
        .register-content {
          -webkit-transform: translateZ(0);
          transform: translateZ(0);
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          -webkit-perspective: 1000px;
          perspective: 1000px;
        }
        
        /* 애니메이션 요소들에 하드웨어 가속 적용 */
        [data-framer-motion-component-id] {
          -webkit-transform: translateZ(0);
          transform: translateZ(0);
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          will-change: transform, opacity;
        }
        
        /* iOS에서 체크박스 렌더링 안정화 */
        input[type="checkbox"] {
          -webkit-appearance: none;
          appearance: none;
          background-color: #fff;
          border: 2px solid #d1d5db;
          border-radius: 4px;
          display: inline-block;
          position: relative;
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }
        
        input[type="checkbox"]:checked {
          background-color: #0114a2 !important;
          border-color: #0114a2 !important;
        }
        
        input[type="checkbox"]:checked::after {
          content: '';
          position: absolute;
          left: 4px;
          top: 1px;
          width: 4px;
          height: 8px;
          border: solid white;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }
        
        /* 모든 체크박스에 일관된 스타일 적용 */
        input[type="checkbox"].w-4.h-4.rounded,
        input[type="checkbox"].w-4.h-4.rounded.flex-shrink-0,
        input[type="checkbox"][class*="w-4"][class*="h-4"][class*="rounded"] {
          -webkit-appearance: none !important;
          appearance: none !important;
          background-color: #fff !important;
          border: 2px solid #d1d5db !important;
          border-radius: 4px !important;
          display: inline-block !important;
          position: relative !important;
          width: 16px !important;
          height: 16px !important;
          flex-shrink: 0 !important;
          transition: all 0.2s ease !important;
        }
        
        input[type="checkbox"].w-4.h-4.rounded:checked,
        input[type="checkbox"].w-4.h-4.rounded.flex-shrink-0:checked,
        input[type="checkbox"][class*="w-4"][class*="h-4"][class*="rounded"]:checked {
          background-color: #0114a2 !important;
          border-color: #0114a2 !important;
        }
        
        input[type="checkbox"].w-4.h-4.rounded:checked::after,
        input[type="checkbox"].w-4.h-4.rounded.flex-shrink-0:checked::after,
        input[type="checkbox"][class*="w-4"][class*="h-4"][class*="rounded"]:checked::after {
          content: '';
          position: absolute;
          left: 4px;
          top: 1px;
          width: 4px;
          height: 8px;
          border: solid white;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }
        
        /* 모든 체크박스 강제 적용 */
        input[type="checkbox"]:checked {
          background-color: #0114a2 !important;
          border-color: #0114a2 !important;
        }
        
        input[type="checkbox"]:checked::after {
          content: '';
          position: absolute;
          left: 4px;
          top: 1px;
          width: 4px;
          height: 8px;
          border: solid white;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }
        
        /* iOS 애니메이션 중간 끊김 방지 */
        .register-content-area * {
          -webkit-transform: translateZ(0);
          transform: translateZ(0);
        }
        
        /* 스크롤 성능 최적화 */
        .register-scroll-area {
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          -webkit-transform: translateZ(0);
          transform: translateZ(0);
        }
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
    setBirthModalOpen,
    isAppleLogin,
    isGoogleLogin
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
      console.log('📊 [LOCATION CALLBACK] GPS 데이터 상세 정보:');
      console.log('   📍 위도:', locationData?.latitude);
      console.log('   📍 경도:', locationData?.longitude);
      console.log('   📍 정확도:', locationData?.accuracy);
      console.log('   📍 타임스탬프:', locationData?.timestamp);
      console.log('   📍 소스:', locationData?.source);

      if (locationData && locationData.latitude && locationData.longitude) {
        console.log('✅ [LOCATION CALLBACK] 유효한 GPS 데이터 확인됨');
        setRegisterData(prev => ({
          ...prev,
          mt_lat: locationData.latitude,
          mt_long: locationData.longitude
        }));
        setLocationLoading(false);
        setLocationError('');
        console.log('✅ [LOCATION CALLBACK] 위치 정보 저장 완료');
        console.log('📝 [LOCATION CALLBACK] 저장된 위치:', { lat: locationData.latitude, lng: locationData.longitude });
      } else {
        console.log('⚠️ [LOCATION CALLBACK] 위치 데이터가 불완전함, 웹 API로 폴백');
        console.log('❌ [LOCATION CALLBACK] 누락된 데이터:', {
          hasLatitude: !!locationData?.latitude,
          hasLongitude: !!locationData?.longitude,
          latitude: locationData?.latitude,
          longitude: locationData?.longitude
        });
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

  // 소셜 로그인 데이터 초기화 (데이터 로딩 완료 후)
  useEffect(() => {
    if (!isDataLoaded || isInitializing) {
      console.log('🔥 [REGISTER] 데이터 로딩 대기 중... 소셜 로그인 데이터 초기화 건너뛰기');
      return;
    }

    console.log('🔥 [REGISTER] 소셜 로그인 데이터 초기화 시작');

    const urlParams = new URLSearchParams(window.location.search);
    const socialProvider = urlParams.get('social');

    console.log('🔥 [REGISTER] URL 파라미터 social:', socialProvider);

    if (socialProvider) {
      // localStorage에서 소셜 로그인 데이터 확인 (signin 페이지에서 localStorage에 저장함)
      const socialData = localStorage.getItem('socialLoginData');
      console.log('🔥 [REGISTER] localStorage에서 가져온 socialData:', socialData);

      if (socialData) {
        try {
          const parsedData: SocialLoginData = JSON.parse(socialData);

          console.log(`🔥 [REGISTER] ${parsedData.provider} 소셜 로그인 데이터 로드:`, parsedData);

          setRegisterData(prev => ({
            ...prev,
            mt_id: parsedData.email || '', // 이메일을 아이디로 사용
            mt_email: parsedData.email || '',
            mt_name: parsedData.provider === 'apple'
              ? (parsedData.name || parsedData.given_name || '')
              : (parsedData.name || parsedData.given_name || 'Google User'),
            mt_nickname: parsedData.provider === 'apple'
              ? (parsedData.nickname || parsedData.given_name || parsedData.name || '')
              : (parsedData.nickname || parsedData.given_name || parsedData.name || 'Google User'),
            // 구글/애플 로그인 시 임시 비밀번호 자동설정 (회원가입 API 검증 통과용)
            mt_pwd: parsedData.provider === 'google'
              ? 'google_auto_password_123'
              : (parsedData.provider === 'apple' ? 'apple_auto_password_123' : ''),
            isSocialLogin: true,
            socialProvider: parsedData.provider,
            socialId: parsedData.kakao_id || parsedData.google_id || parsedData.apple_id || '',
            profile_image: parsedData.profile_image || null  // 소셜 로그인 프로필 이미지
          }));

          // 소셜 로그인 시 약관 동의 단계로 시작 (소셜 로그인이므로 전화번호 인증은 생략)
          setCurrentStep(REGISTER_STEPS.TERMS);

          console.log(`🔥 [REGISTER] ${parsedData.provider} 소셜 로그인 데이터 로드 완료`);
          console.log('🔥 [REGISTER] 현재 스텝을 TERMS로 설정');

          // 소셜 로그인 데이터는 회원가입 완료 후에 제거하도록 변경
          // localStorage.removeItem('socialLoginData'); // 여기서 제거하지 않음

        } catch (error) {
          console.error('🔥 [REGISTER] 소셜 로그인 데이터 파싱 오류:', error);
          // 파싱 오류 시에는 데이터 제거
          localStorage.removeItem('socialLoginData');
          setInitError('소셜 로그인 데이터를 처리하는데 실패했습니다.');
        }
      } else {
        console.warn('🔥 [REGISTER] URL에 social 파라미터가 있지만 socialLoginData가 없음');
        console.warn('🔥 [REGISTER] 일반 회원가입으로 진행');
        setInitError('소셜 로그인 데이터가 없습니다. 다시 로그인해주세요.');
      }
    } else {
      console.log('🔥 [REGISTER] social 파라미터가 없으므로 일반 회원가입');
    }
  }, [isDataLoaded, isInitializing]);

  // 진행률 계산
  const getProgress = () => {
    const { getCurrentStepNumber, getTotalSteps } = useRegisterContext();
    return (getCurrentStepNumber() / getTotalSteps()) * 100;
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

  // 약관 단계에서 스크롤 위치 초기화 (데이터 로딩 완료 후에만)
  useEffect(() => {
    if (currentStep === REGISTER_STEPS.TERMS && isDataLoaded && !isInitializing) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      console.log('🔧 [REGISTER] 약관 단계 스크롤 초기화 - 데이터 로딩 완료');

      // iOS 전용 강력한 위치 고정
      const forceFixPosition = () => {
        // 올바른 스크롤 영역 선택자 사용
        const scrollArea = document.querySelector('.register-scroll-area') as HTMLElement;
        const contentArea = document.querySelector('.register-content-area') as HTMLElement;

        if (scrollArea) {
          // 스크롤 초기화
          scrollArea.scrollTop = 0;
          scrollArea.scrollTo({ top: 0, behavior: 'auto' });
          console.log('🔧 [iOS FIX] register-scroll-area 스크롤 위치 초기화 완료');
        }

        if (contentArea) {
          // 전체 컨텐츠 영역도 초기화
          contentArea.scrollTop = 0;
          contentArea.scrollTo({ top: 0, behavior: 'auto' });
          console.log('🔧 [iOS FIX] register-content-area 스크롤 위치 초기화 완료');
        }

        // 추가로 window 스크롤도 초기화
        window.scrollTo({ top: 0, behavior: 'auto' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;

        console.log('🔧 [iOS FIX] 모든 스크롤 위치 초기화 완료');
      };

      if (isIOS) {
        console.log('📱 [iOS] 약관 단계 진입 - 강화된 스크롤 위치 초기화');

        // 즉시 실행
        forceFixPosition();

        // 추가로 약간의 지연 후 다시 실행 (iOS 렌더링 지연 대응)
        setTimeout(() => {
          forceFixPosition();
        }, 100);

        // 더 긴 지연 후 한 번 더 실행
        setTimeout(() => {
          forceFixPosition();
        }, 500);
      } else {
        // 안드로이드에서는 기본 스크롤 초기화만
        const scrollArea = document.querySelector('.register-scroll-area') as HTMLElement;
        if (scrollArea) {
          scrollArea.scrollTop = 0;
          scrollArea.scrollTo(0, 0);
        }
      }
    }
  }, [currentStep, isDataLoaded, isInitializing]);

  // iOS에서 약관동의 페이지 강제 표시 (추가 보장, 데이터 로딩 완료 후에만)
  useEffect(() => {
    if (currentStep === REGISTER_STEPS.TERMS && isDataLoaded && !isInitializing) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      if (isIOS) {
        console.log('📱 [iOS] 약관동의 페이지 강제 표시 보장');

        // 즉시 실행
        const forceShowTerms = () => {
          // 모든 스크롤 영역 초기화
          const scrollArea = document.querySelector('.register-scroll-area') as HTMLElement;
          const contentArea = document.querySelector('.register-content-area') as HTMLElement;

          if (scrollArea) {
            scrollArea.scrollTop = 0;
            scrollArea.scrollTo({ top: 0, behavior: 'auto' });
          }

          if (contentArea) {
            contentArea.scrollTop = 0;
            contentArea.scrollTo({ top: 0, behavior: 'auto' });
          }

          // window 스크롤도 초기화
          window.scrollTo({ top: 0, behavior: 'auto' });
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;

          // 약관동의 콘텐츠 강제 표시
          const termsContent = document.querySelector('[data-step="terms"]');
          if (termsContent) {
            (termsContent as HTMLElement).style.visibility = 'visible';
            (termsContent as HTMLElement).style.opacity = '1';
            (termsContent as HTMLElement).style.display = 'block';
            (termsContent as HTMLElement).style.position = 'relative';
            (termsContent as HTMLElement).style.zIndex = '1';
          }

          // 추가로 모든 약관 관련 요소 강제 표시
          const allTermsElements = document.querySelectorAll('.space-y-3, .terms-agreement-section, .terms-card');
          allTermsElements.forEach((element) => {
            (element as HTMLElement).style.visibility = 'visible';
            (element as HTMLElement).style.opacity = '1';
            (element as HTMLElement).style.display = 'block';
          });

          console.log('📱 [iOS] 약관동의 페이지 강제 표시 완료');
        };

        // 즉시 실행
        forceShowTerms();

        // 약간의 지연 후 다시 실행
        setTimeout(forceShowTerms, 100);

        // 더 긴 지연 후 한 번 더 실행
        setTimeout(forceShowTerms, 500);

        // 최종 보장을 위한 실행
        const timer = setTimeout(forceShowTerms, 1000);

        return () => clearTimeout(timer);
      }
    }
  }, [currentStep, isDataLoaded, isInitializing]);

  // 뒤로가기
  const handleBack = () => {
    if (currentStep === REGISTER_STEPS.TERMS) {
      // 첫 번째 단계에서는 signin 페이지로 이동 (소셜 로그인 시)
      if (registerData.isSocialLogin) {
        // 소셜 로그인 데이터 정리 후 signin으로 이동
        localStorage.removeItem('socialLoginData');
        console.log('🔥 [REGISTER] 뒤로가기 - socialLoginData 제거 후 signin으로 이동');
        router.push('/signin');
      } else {
        router.push('/signin');
      }
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

    // iOS에서 애니메이션 전환 최적화
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    // 소셜 로그인 시 전화번호 인증 단계 건너뛰기
    if (registerData.isSocialLogin) {
      if (currentStep === REGISTER_STEPS.TERMS) {
        // 애플/구글 로그인도 기본 정보(닉네임) 입력 단계로 이동 (App Store 리젝션 수정)
        console.log('🔥 [REGISTER] 소셜 로그인 - 약관 동의 후 기본 정보 입력 단계로 이동');
        setCurrentStep(REGISTER_STEPS.BASIC_INFO);
        return;
      }

      // 애플/구글 로그인 시 BASIC_INFO 단계에서 프로필 단계 건너뛰고 바로 회원가입 완료
      if (currentStep === REGISTER_STEPS.BASIC_INFO) {
        if (registerData.socialProvider === 'apple' || registerData.socialProvider === 'google') {
          console.log('🔥 [REGISTER] 애플/구글 로그인 - 기본 정보 입력 후 회원가입 완료');
          handleRegister();
          return;
        }
      }
    }

    if (currentIndex < steps.length - 1) {
      // 애플 ID 로그인 시 프로필 단계에서 회원가입 완료
      if (registerData.isSocialLogin && registerData.socialProvider === 'apple' && currentStep === REGISTER_STEPS.PROFILE) {
        console.log('🔥 [REGISTER] 애플 ID 로그인 - 프로필 단계에서 회원가입 완료');
        handleRegister();
        return;
      }

      // iOS에서는 약간의 지연을 두어 애니메이션 완료된 후 전환
      if (isIOS) {
        setTimeout(() => {
          setCurrentStep(steps[currentIndex + 1]);
        }, 50);
      } else {
        setCurrentStep(steps[currentIndex + 1]);
      }
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
          param: {
            source: 'user_click',
            timestamp: Date.now()
          },
          timestamp: Date.now(),
          source: 'user_click'
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
          (registerData.socialProvider === 'google' ? 4 : registerData.socialProvider === 'apple' ? 3 : 2) : 1, // 구글:4, 애플:3, 카카오:2
        mt_level: 2, // 일반(무료)
        mt_status: 1, // 정상
        mt_onboarding: 'N',
        mt_show: 'Y'
      };

      // 애플 ID 로그인 시 기본정보 단계를 건너뛰었으므로, 애플에서 제공한 기본 정보 사용
      if (registerData.isSocialLogin && registerData.socialProvider === 'apple') {
        // 애플에서 제공한 기본 정보로 채우기
        requestData.mt_name = requestData.mt_name || 'Apple User';
        requestData.mt_nickname = requestData.mt_nickname || 'Apple User';
        requestData.mt_email = requestData.mt_email || '';

        // 애플 ID 로그인 시 비밀번호 제거
        delete requestData.mt_pwd;
      } else if (registerData.isSocialLogin && registerData.socialProvider === 'google') {
        // 구글 로그인 시 비밀번호 제거 (실제로는 사용되지 않음)
        delete requestData.mt_pwd;
      }

      // 소셜 로그인이 아닌 경우에만 전화번호 하이픈 제거
      if (!registerData.isSocialLogin) {
        requestData.mt_id = registerData.mt_id.replace(/-/g, '');
      }

      // 소셜 로그인 관련 데이터 추가
      if (registerData.isSocialLogin) {
        if (registerData.socialProvider === 'google') {
          requestData.mt_google_id = registerData.socialId;
        } else if (registerData.socialProvider === 'apple') {
          requestData.mt_apple_id = registerData.socialId;
        } else if (registerData.socialProvider === 'kakao') {
          requestData.mt_kakao_id = registerData.socialId;
        }

        // 소셜 로그인 프로필 이미지 추가
        if (registerData.profile_image) {
          requestData.mt_file1 = registerData.profile_image;
          requestData.profile_image = registerData.profile_image;  // 애플 API 호환
        }
      }

      console.log('API 요청 데이터:', requestData);

      // 회원가입은 모두 일반 회원가입 API 사용 (소셜 로그인 포함)
      // 구글/애플 로그인 시에는 idToken이 없으므로 /api/google-auth, /api/apple-auth 사용 불가
      // 카카오는 기존 방식 유지
      const apiEndpoint = (registerData.isSocialLogin && registerData.socialProvider === 'kakao')
        ? '/api/kakao-auth'
        : '/api/auth/register';

      let response;

      if (registerData.isSocialLogin && registerData.socialProvider === 'kakao') {
        // 카카오 로그인 회원가입 (기존 방식)
        const socialRegisterData = {
          ...requestData,
          action: 'register',
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
        // 일반 회원가입 및 구글/애플 소셜 로그인 회원가입
        // 구글/애플은 mt_google_id 또는 mt_apple_id를 함께 전달
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
        console.log('🔍 [REGISTER] API 응답에서 mt_idx 확인:', data.data);

        if (data.data && data.data.mt_idx) {
          localStorage.setItem('newMemberMtIdx', data.data.mt_idx.toString());
          console.log('✅ [REGISTER] 새 회원 mt_idx 저장 완료:', data.data.mt_idx);

          // FCM 토큰 등록 (백그라운드에서 실행)
          setTimeout(async () => {
            try {
              console.log('🚨 [REGISTER] Firebase 토큰 생성 로직 제거됨 - 네이티브에서 FCM 토큰 관리');
              // 🚨 Firebase 토큰 생성 로직 제거 - 네이티브에서 FCM 토큰 관리
              console.log('🚫 [REGISTER] FCM 토큰 업데이트 로직 비활성화됨 - 네이티브에서 관리');
            } catch (fcmError) {
              console.error('❌ [REGISTER] FCM 처리 중 오류:', fcmError);
            }
          }, 1500); // 회원가입 완료 후 1.5초 지연
        } else {
          console.error('❌ [REGISTER] API 응답에 mt_idx가 없음:', data);
          console.error('❌ [REGISTER] data.data:', data.data);
          console.error('❌ [REGISTER] data.data.mt_idx:', data.data?.mt_idx);
        }

        // 소셜 로그인 데이터 정리 (회원가입 성공 시에만)
        localStorage.removeItem('socialLoginData');
        console.log('🔥 [REGISTER] 회원가입 성공 후 socialLoginData 제거');

        // 🍎 소셜 로그인 회원가입 시 자동 로그인 처리
        if (registerData.isSocialLogin && data.data?.token) {
          console.log('🍎 [REGISTER] 소셜 로그인 회원가입 - 자동 로그인 처리 시작');

          try {
            const authService = await import('@/services/authService');

            // 토큰 저장
            authService.default.setToken(data.data.token);
            console.log('🍎 [REGISTER] JWT 토큰 저장 완료');

            // 사용자 정보 저장
            const userData = {
              mt_idx: data.data.mt_idx,
              mt_id: data.data.mt_id,
              mt_name: data.data.mt_name || registerData.mt_name,
              mt_nickname: data.data.mt_nickname || registerData.mt_nickname,
              mt_email: data.data.mt_email || registerData.mt_email,
              mt_type: registerData.socialProvider === 'apple' ? 3 : registerData.socialProvider === 'google' ? 4 : 2,
              mt_file1: data.data.mt_file1 || registerData.profile_image || ''
            };
            authService.default.setUserData(userData);
            console.log('🍎 [REGISTER] 사용자 정보 저장 완료:', userData);

            // 홈으로 바로 이동 (완료 화면 생략)
            console.log('🍎 [REGISTER] 소셜 로그인 회원가입 완료 - 홈으로 이동');
            router.push('/home');
            return; // 완료 화면으로 이동하지 않음
          } catch (authError) {
            console.error('❌ [REGISTER] 자동 로그인 처리 중 오류:', authError);
            // 오류 발생 시 완료 화면으로 이동
          }
        }

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

        // 구글 로그인 시 비밀번호 검사 건너뛰기
        if (registerData.isSocialLogin && (registerData.socialProvider === 'google' || registerData.socialProvider === 'apple')) {
          return registerData.mt_name &&
            registerData.mt_nickname &&
            !emailError && // 이메일 에러가 없어야 함
            isEmailValid; // 빈 값이거나 유효한 이메일
        }

        // 일반 회원가입 시 비밀번호 검사
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
        // 애플 ID 로그인 시에는 애플에서 제공한 기본 정보가 이미 있으므로, 생년월일과 성별만 확인
        if (registerData.isSocialLogin && registerData.socialProvider === 'apple') {
          return registerData.mt_birth && registerData.mt_gender !== null;
        }
        // 일반 회원가입이나 다른 소셜 로그인의 경우 기존 로직 유지
        return registerData.mt_birth && registerData.mt_gender !== null;
      default:
        return false;
    }
  };

  // 페이지 초기화 중이거나 에러가 있을 때 표시
  if (isInitializing || !isIOSReady || (!isDataLoaded && !initError)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="flex flex-col items-center justify-center p-4">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-[#0114a2] rounded-full animate-spin mb-4"></div>
          <span className="text-gray-600 text-sm">페이지를 준비하고 있습니다...</span>
          <span className="text-gray-400 text-xs mt-2">잠시만 기다려주세요</span>
        </div>
      </div>
    );
  }

  // 에러가 발생한 경우 에러 화면 표시
  if (initError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4" style={{ animation: 'none' }}>
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ animation: 'none', transform: 'none' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">페이지 로드 오류</h2>
          <p className="text-gray-600 text-sm mb-4" style={{ wordBreak: 'keep-all' }}>
            {initError}
          </p>
          <div className="space-y-2">
            <button
              onClick={() => {
                console.log('🔥 [REGISTER] 페이지 새로고침 시도');
                window.location.reload();
              }}
              className="w-full py-3 bg-[#0114a2] text-white rounded-xl font-medium hover:bg-[#0114a2]/90 transition-colors"
            >
              페이지 새로고침
            </button>
            <button
              onClick={() => {
                console.log('🔥 [REGISTER] 로그인 페이지로 이동');
                window.location.href = '/signin';
              }}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              로그인 페이지로 이동
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 회원가입 완료 단계 - 별도 UI로 렌더링 (레이아웃 제약 우회)
  if (currentStep === REGISTER_STEPS.COMPLETE) {
    return (
      <div className="register-complete-overlay">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl text-center"
        >
          {/* 체크 아이콘 */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
            className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <FiCheck className="w-10 h-10 text-white" strokeWidth={3} />
          </motion.div>

          {/* 텍스트 */}
          <h2 className="text-2xl font-bold text-gray-900 mb-3">회원가입 완료!</h2>
          <p className="text-gray-600 mb-8 leading-relaxed" style={{ wordBreak: 'keep-all' }}>
            SMAP에 오신 것을 환영합니다.<br />
            친구들과 소중한 추억을 공유해보세요.
          </p>

          {/* 버튼 */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            onClick={() => {
              router.push('/signin');
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 bg-[#0114a2] text-white rounded-xl font-semibold text-lg shadow-lg hover:bg-[#010f7a] transition-colors"
          >
            로그인하러 가기
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className={`register-content-area ${isIOSReady ? 'ios-ready' : ''}`}
      style={{
        // iOS 애니메이션 최적화
        willChange: 'auto',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        WebkitTransform: 'translateZ(0)',
        WebkitBackfaceVisibility: 'hidden'
      }}
    >
      {/* 진행률 바 - 상단 고정 */}
      {currentStep !== REGISTER_STEPS.COMPLETE && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 z-40">
          <motion.div
            className="h-full"
            style={{
              backgroundColor: '#0114a2',
              // iOS 애니메이션 최적화
              willChange: 'width',
              transform: 'translateZ(0)', // 하드웨어 가속 활성화
              backfaceVisibility: 'hidden'
            }}
            initial={{ width: 0 }}
            animate={{ width: `${getProgress()}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}

      {/* 스크롤 가능한 메인 콘텐츠 영역 */}
      <div
        className="register-scroll-area"
        style={{
          paddingTop: currentStep !== REGISTER_STEPS.COMPLETE ? '24px' : '20px', // 진행률 바 공간
          paddingBottom: currentStep !== REGISTER_STEPS.COMPLETE ? '100px' : '20px', // 하단 버튼 공간
          // iOS 애니메이션 최적화
          willChange: 'auto',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          WebkitTransform: 'translateZ(0)',
          WebkitBackfaceVisibility: 'hidden'
        }}
      >
        <div className="flex-1 flex items-center justify-center min-h-0">
          <div className="w-full max-w-md mx-auto py-4 register-content">
            <AnimatePresence
              mode="wait"
              initial={false}
              onExitComplete={() => {
                // iOS에서 애니메이션 완료 후 추가 정리 작업
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                if (isIOS) {
                  // iOS에서 스크롤 위치 강제 초기화
                  const scrollArea = document.querySelector('.register-scroll-area') as HTMLElement;
                  if (scrollArea) {
                    scrollArea.scrollTop = 0;
                  }
                }
              }}
            >
              {/* 약관 동의 단계 */}
              {currentStep === REGISTER_STEPS.TERMS && (
                <motion.div
                  key="terms"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{
                    duration: 0.3,
                    ease: [0.4, 0.0, 0.2, 1], // iOS 최적화된 이징
                    type: "tween"
                  }}
                  className="space-y-3"
                  data-step="terms"
                  style={{
                    // iOS에서 강제로 가시성 보장
                    visibility: 'visible',
                    opacity: 1,
                    display: 'block',
                    position: 'relative',
                    zIndex: 1,
                    // iOS 애니메이션 최적화
                    willChange: 'transform, opacity',
                    transform: 'translateZ(0)', // 하드웨어 가속 활성화
                    backfaceVisibility: 'hidden'
                  }}
                >
                  <div className="text-center mb-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: '#0114a2' }}>
                      <FiFileText className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 mb-1">
                      {registerData.isSocialLogin ?
                        `${registerData.socialProvider === 'google' ? '구글' : registerData.socialProvider === 'apple' ? '애플' : '카카오'} 회원가입` :
                        '서비스 이용약관'
                      }
                    </h2>
                    <p className="text-xs text-gray-600">
                      {registerData.isSocialLogin ?
                        `${registerData.socialProvider === 'google' ? '구글' : registerData.socialProvider === 'apple' ? '애플' : '카카오'} 계정으로 간편 회원가입을 진행합니다` :
                        'SMAP 서비스 이용을 위해 약관에 동의해주세요'
                      }
                    </p>
                    {registerData.isSocialLogin && (
                      <div className="mt-3 p-3 bg-[#0114a2]/10 rounded-lg border border-[#0114a2]/20">
                        <p className="text-xs text-[#0114a2]">
                          📧 <strong>{registerData.mt_email}</strong><br />
                          전화번호 인증 없이 간편하게 가입할 수 있습니다
                        </p>
                      </div>
                    )}
                    {/* 디버깅용 - 개발 환경에서만 표시 */}
                    {process.env.NODE_ENV === 'development' && registerData.isSocialLogin && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                        <strong>DEBUG:</strong> Provider: {registerData.socialProvider},
                        Email: {registerData.mt_email},
                        Name: {registerData.mt_name}
                      </div>
                    )}
                  </div>

                  {/* 전체 동의 */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={TERMS_DATA.every(term => registerData[term.id as keyof RegisterData] as boolean)}
                        onChange={(e) => handleAllAgree(e.target.checked)}
                        className="w-4 h-4 rounded"
                        style={{
                          WebkitAppearance: 'none',
                          appearance: 'none',
                          backgroundColor: TERMS_DATA.every(term => registerData[term.id as keyof RegisterData] as boolean) ? '#0114a2' : '#fff',
                          border: `2px solid ${TERMS_DATA.every(term => registerData[term.id as keyof RegisterData] as boolean) ? '#0114a2' : '#d1d5db'}`,
                          borderRadius: '4px',
                          position: 'relative',
                          width: '16px',
                          height: '16px',
                          flexShrink: 0
                        }}
                      />
                      <span className="font-medium text-gray-900 text-sm">전체 동의</span>
                    </label>
                  </div>

                  {/* 개별 약관 */}
                  <div className="space-y-2">
                    {TERMS_DATA.map((term) => (
                      <div key={term.id} className="bg-white border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center space-x-2">
                          <label className="flex items-center space-x-2 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={registerData[term.id as keyof RegisterData] as boolean}
                              onChange={(e) => handleTermAgree(term.id, e.target.checked)}
                              className="w-4 h-4 rounded flex-shrink-0"
                              style={{
                                WebkitAppearance: 'none',
                                appearance: 'none',
                                backgroundColor: (registerData[term.id as keyof RegisterData] as boolean) ? '#0114a2' : '#fff',
                                border: `2px solid ${(registerData[term.id as keyof RegisterData] as boolean) ? '#0114a2' : '#d1d5db'}`,
                                borderRadius: '4px',
                                position: 'relative',
                                width: '16px',
                                height: '16px',
                                flexShrink: 0
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-900 truncate">{term.title}</span>
                                {term.required && (
                                  <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full flex-shrink-0">필수</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{term.content}</p>
                            </div>
                          </label>

                          {/* 오른쪽 화살표 - 약관 링크로 이동 */}
                          <div
                            className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              // 내부 라우트로 이동 (현재 탭) + 약관 페이지는 일반 모드로 열기 (헤더 표시)
                              try {
                                const isInternal = term.link && term.link.startsWith('/');
                                if (isInternal) {
                                  let target = term.link as string;
                                  // embed 파라미터 제거하여 헤더가 표시되도록 함
                                  if (target.includes('?embed=')) {
                                    target = target.replace(/[?&]embed=[^&]*/, '');
                                    if (target.includes('?') && target.endsWith('?')) {
                                      target = target.slice(0, -1);
                                    }
                                  }

                                  // 현재 소셜 로그인 정보와 단계 정보를 약관 페이지 URL에 추가
                                  const urlParams = new URLSearchParams(window.location.search);
                                  const social = urlParams.get('social');
                                  const currentStepValue = currentStep; // 현재 단계

                                  if (social) {
                                    target += (target.includes('?') ? '&' : '?') + `social=${social}`;
                                  }
                                  if (currentStepValue) {
                                    target += (target.includes('?') ? '&' : '?') + `step=${currentStepValue}`;
                                  }

                                  // Next.js Router 사용
                                  try {
                                    const { push } = require('next/navigation');
                                    // require 사용 시 훅과 충돌하므로 안전하게 window.location로 폴백
                                    (push && typeof push === 'function') ? push(target) : (window.location.href = target);
                                  } catch {
                                    window.location.href = target;
                                  }
                                } else if (term.link) {
                                  window.open(term.link, '_blank');
                                }
                              } catch {
                                if (term.link) {
                                  window.open(term.link, '_blank');
                                }
                              }
                            }}
                          >
                            <FiChevronRight className="w-4 h-4 text-gray-400" />
                          </div>
                        </div>
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
                  transition={{
                    duration: 0.3,
                    ease: [0.4, 0.0, 0.2, 1], // iOS 최적화된 이징
                    type: "tween"
                  }}
                  className="w-full h-full flex flex-col justify-center"
                  style={{
                    // iOS 애니메이션 최적화
                    willChange: 'transform, opacity',
                    transform: 'translateZ(0)', // 하드웨어 가속 활성화
                    backfaceVisibility: 'hidden'
                  }}
                >
                  <div className="text-center mb-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: '#0114a2' }}>
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
                        <div className="absolute left-6 z-10 pointer-events-none" style={{ top: '50%', transform: 'translateY(-50%)' }}>
                          <FiPhone className="w-4 h-4 transition-colors duration-200"
                            style={{ color: focusedField === 'phone' ? '#0114a2' : '#9CA3AF' }} />
                        </div>
                        <input
                          type="tel"
                          value={registerData.mt_id}
                          onChange={handlePhoneNumberChange}
                          onFocus={(e) => {
                            setFocusedField('phone');
                            handlePhoneInputFocus();
                            e.target.style.boxShadow = '0 0 0 2px #0114a2';
                          }}
                          onBlur={(e) => {
                            setFocusedField(null);
                            e.target.style.boxShadow = '';
                          }}
                          placeholder="010-1234-5678"
                          maxLength={13}
                          className="w-full pl-12 pr-6 py-4 px-1 border border-gray-200 rounded-xl focus:ring-2 focus:border-transparent register-input"
                          style={{ outlineOffset: '2px' }}
                        />
                      </div>
                    </div>

                    {verificationSent && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl p-4"
                        style={{ backgroundColor: '#eff6ff', border: '1px solid #c7d2fe' }}
                      >
                        <div className="flex items-center space-x-2">
                          <FiCheck className="w-5 h-5" style={{ color: '#0114a2' }} />
                          <span className="font-medium" style={{ color: '#1e40af' }}>인증번호가 발송되었습니다</span>
                        </div>
                        <p className="text-sm mt-1" style={{ wordBreak: 'keep-all', color: '#0114a2' }}>
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
                  transition={{
                    duration: 0.3,
                    ease: [0.4, 0.0, 0.2, 1], // iOS 최적화된 이징
                    type: "tween"
                  }}
                  className="w-full h-full flex flex-col justify-center"
                  style={{
                    // iOS 애니메이션 최적화
                    willChange: 'transform, opacity',
                    transform: 'translateZ(0)', // 하드웨어 가속 활성화
                    backfaceVisibility: 'hidden'
                  }}
                >
                  <div className="text-center mb-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: '#0114a2' }}>
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
                        onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px #0114a2'}
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
                        style={{ backgroundColor: '#0114a2' }}
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
                  transition={{
                    duration: 0.3,
                    ease: [0.4, 0.0, 0.2, 1], // iOS 최적화된 이징
                    type: "tween"
                  }}
                  className="w-full h-full flex flex-col"
                  style={{
                    // iOS 애니메이션 최적화
                    willChange: 'transform, opacity',
                    transform: 'translateZ(0)', // 하드웨어 가속 활성화
                    backfaceVisibility: 'hidden'
                  }}
                >
                  <div className="text-center mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: '#0114a2' }}>
                      <FiUser className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">기본 정보</h2>
                    {registerData.isSocialLogin && (registerData.socialProvider === 'google' || registerData.socialProvider === 'apple') && (
                      <div className="flex items-center justify-center mb-2">
                        <div className="bg-[#0114a2] text-white text-xs px-3 py-1 rounded-full flex items-center">
                          {registerData.socialProvider === 'google' ? (
                            <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                          ) : (
                            <FaApple className="w-3 h-3 mr-1" />
                          )}
                          {registerData.socialProvider === 'google' ? '구글' : '애플'} 계정 연동
                        </div>
                      </div>
                    )}
                    <p className="text-sm text-gray-600" style={{ wordBreak: 'keep-all' }}>
                      서비스 이용을 위한 기본 정보를 확인해주세요
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pb-4 register-form">


                    {/* 비밀번호 - 소셜 로그인(구글/애플) 시 숨김 */}
                    {(!registerData.isSocialLogin || (registerData.socialProvider !== 'google' && registerData.socialProvider !== 'apple')) && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            비밀번호
                          </label>
                          <div className="relative register-input-container px-0.5">
                            <div className="absolute left-5 z-10 pointer-events-none" style={{ top: '50%', transform: 'translateY(-50%)' }}>
                              <FiLock className="w-4 h-4 transition-colors duration-200"
                                style={{ color: focusedField === 'password' ? '#0114a2' : '#9CA3AF' }} />
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
                                e.target.style.boxShadow = '0 0 0 2px #0114a2';
                              }}
                              onBlur={(e) => {
                                setFocusedField(null);
                                e.target.style.boxShadow = '';
                              }}
                              placeholder="8자 이상, 대소문자, 숫자, 특수문자 포함"
                              className="w-full pl-11 pr-10 py-2.5 px-1 border border-gray-200 rounded-xl focus:ring-2 focus:ring-offset-0 focus:border-transparent register-input"
                              style={{ outline: 'none' }}
                            />
                            <div className="absolute right-2.5" style={{ top: '50%', transform: 'translateY(-50%)' }}>
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
                                    className={`h-1 flex-1 rounded-full transition-colors ${isValid ? 'bg-green-500' : 'bg-gray-200'
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
                            <div className="absolute left-5 z-10 pointer-events-none" style={{ top: '50%', transform: 'translateY(-50%)' }}>
                              <FiLock className="w-4 h-4 transition-colors duration-200"
                                style={{ color: focusedField === 'passwordConfirm' ? '#0114a2' : '#9CA3AF' }} />
                            </div>
                            <input
                              type={showPasswordConfirm ? 'text' : 'password'}
                              value={passwordConfirm}
                              onChange={(e) => {
                                setPasswordConfirm(e.target.value);
                              }}
                              onFocus={(e) => {
                                setFocusedField('passwordConfirm');
                                e.target.style.boxShadow = '0 0 0 2px #0114a2';
                              }}
                              onBlur={(e) => {
                                setFocusedField(null);
                                e.target.style.boxShadow = '';
                              }}
                              placeholder="비밀번호를 다시 입력해주세요"
                              className="w-full pl-11 pr-12 py-2.5 px-1 border border-gray-200 rounded-xl focus:ring-2 focus:ring-offset-0 focus:border-transparent register-input"
                              style={{ outline: 'none' }}
                            />
                            <div className="absolute right-2.5" style={{ top: '50%', transform: 'translateY(-50%)' }}>
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
                      </>
                    )}

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
                        onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px #0114a2'}
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
                        onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px #0114a2'}
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
                        <p className="text-xs text-[#0114a2] mb-2" style={{ wordBreak: 'keep-all' }}>
                          {registerData.socialProvider === 'google' ? '구글' : registerData.socialProvider === 'apple' ? '애플' : '카카오'} 계정의 이메일이 ID로 사용됩니다
                        </p>
                      )}
                      <div className="relative register-input-container px-0.5">
                        <div className="absolute left-5 z-10 pointer-events-none" style={{ top: '50%', transform: 'translateY(-50%)' }}>
                          <FiMail className="w-4 h-4 transition-colors duration-200"
                            style={{ color: focusedField === 'email' ? '#0114a2' : '#9CA3AF' }} />
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
                              e.target.style.boxShadow = '0 0 0 2px #0114a2';
                            }
                          }}
                          onBlur={(e) => {
                            setFocusedField(null);
                            e.target.style.boxShadow = '';
                          }}
                          placeholder={registerData.isSocialLogin ? '' : 'example@email.com'}
                          disabled={registerData.isSocialLogin}
                          className={`w-full pl-11 pr-12 py-2.5 px-1 border border-gray-200 rounded-xl focus:ring-2 focus:ring-offset-0 focus:border-transparent register-input ${registerData.isSocialLogin ? 'bg-gray-50 cursor-not-allowed' : ''
                            }`}
                          style={{ outline: 'none' }}
                        />
                        {registerData.mt_email && !emailError && (
                          <div className="absolute right-2.5" style={{ top: '50%', transform: 'translateY(-50%)' }}>
                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                        {emailError && !registerData.isSocialLogin && (
                          <div className="absolute right-2.5" style={{ top: '50%', transform: 'translateY(-50%)' }}>
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
                  transition={{
                    duration: 0.3,
                    ease: [0.4, 0.0, 0.2, 1], // iOS 최적화된 이징
                    type: "tween"
                  }}
                  className="w-full h-full flex flex-col justify-center"
                  style={{
                    // iOS 애니메이션 최적화
                    willChange: 'transform, opacity',
                    transform: 'translateZ(0)', // 하드웨어 가속 활성화
                    backfaceVisibility: 'hidden'
                  }}
                >
                  <div className="text-center mb-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: '#0114a2' }}>
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
                        className="w-full flex items-center px-4 py-3 border border-gray-200 rounded-xl transition-colors text-left hover:border-[#0114a2]/30"
                        onFocus={(e) => {
                          setFocusedField('birth');
                          (e.target as HTMLButtonElement).style.boxShadow = '0 0 0 2px #0114a2';
                        }}
                        onBlur={(e) => {
                          setFocusedField(null);
                          (e.target as HTMLButtonElement).style.boxShadow = '';
                        }}
                      >
                        <FiCalendar className="w-5 h-5 mr-3 transition-colors duration-200"
                          style={{ color: focusedField === 'birth' ? '#0114a2' : '#9CA3AF' }} />
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
                          className={`py-3 rounded-xl border-2 font-medium transition-all ${registerData.mt_gender === 1
                            ? 'border-gray-200 text-gray-700'
                            : 'border-gray-200 text-gray-700 hover:border-gray-300'
                            }`}
                          style={registerData.mt_gender === 1
                            ? { borderColor: '#0114a2', backgroundColor: '#eff6ff', color: '#1e40af' }
                            : {}}
                        >
                          남성
                        </button>
                        <button
                          type="button"
                          onClick={() => setRegisterData(prev => ({ ...prev, mt_gender: 2 }))}
                          className={`py-3 rounded-xl border-2 font-medium transition-all ${registerData.mt_gender === 2
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



              {/* 완료 단계 - CSS 클래스로 전체 화면 오버레이 */}
              {currentStep === REGISTER_STEPS.COMPLETE && (
                <div className="register-complete-overlay">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl text-center"
                  >
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.1, duration: 0.4 }}
                      className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl text-center"
                    >
                      {/* 체크 아이콘 */}
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
                        className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6"
                      >
                        <FiCheck className="w-10 h-10 text-white" strokeWidth={3} />
                      </motion.div>

                      {/* 텍스트 */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                      >
                        <h2 className="text-2xl font-bold text-gray-900 mb-3">회원가입 완료!</h2>
                        <p className="text-gray-600 mb-8 leading-relaxed" style={{ wordBreak: 'keep-all' }}>
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
                              친구들과 소중한 추억을 공유해보세요.
                            </>
                          )}
                        </p>

                        {/* 버튼 */}
                        {!isJoiningGroup && !isOpeningApp && (
                          <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            onClick={async () => {
                              console.log('🚀 [REGISTER] 로그인하러가기 버튼 클릭됨');
                              console.log('📋 [REGISTER] 현재 registerData:', registerData);

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
                                localStorage.setItem('lastRegisteredPhone', registerData.mt_id);
                                console.log('✅ [REGISTER] 사용자 정보 localStorage 저장 완료:', userInfo);
                              } catch (error) {
                                console.error('❌ [REGISTER] 사용자 정보 저장 실패:', error);
                              }

                              const newMemberMtIdx = localStorage.getItem('newMemberMtIdx');
                              console.log('🔍 [REGISTER] localStorage에서 가져온 newMemberMtIdx:', newMemberMtIdx);

                              if (newMemberMtIdx) {
                                try {
                                  const socialLoginDataStr = localStorage.getItem('socialLoginData');
                                  let socialLoginData = null;
                                  if (socialLoginDataStr) {
                                    try {
                                      socialLoginData = JSON.parse(socialLoginDataStr);
                                      console.log('🔍 [REGISTER] socialLoginData:', socialLoginData);
                                    } catch (e) {
                                      console.warn('⚠️ [REGISTER] socialLoginData 파싱 실패:', e);
                                    }
                                  }

                                  const autoLoginUserInfo = {
                                    mt_idx: parseInt(newMemberMtIdx),
                                    mt_id: registerData.mt_id || socialLoginData?.apple_id || '',
                                    mt_name: registerData.mt_name || socialLoginData?.name || '',
                                    mt_nickname: registerData.mt_nickname || socialLoginData?.name || '',
                                    mt_hp: registerData.mt_id || socialLoginData?.apple_id || '',
                                    mt_email: registerData.mt_email || socialLoginData?.email || '',
                                    mt_birth: registerData.mt_birth || '',
                                    mt_gender: registerData.mt_gender || '',
                                    mt_type: registerData.isSocialLogin ?
                                      (registerData.socialProvider === 'google' ? 4 : registerData.socialProvider === 'apple' ? 3 : 2) : 1,
                                    mt_level: 2,
                                    mt_file1: ''
                                  };

                                  console.log('📤 [REGISTER] 자동 로그인 요청 정보:', autoLoginUserInfo);

                                  const loginResponse = await fetch('/api/auth/auto-login', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                      mt_idx: newMemberMtIdx,
                                      action: 'auto-login',
                                      userInfo: autoLoginUserInfo
                                    }),
                                  });

                                  console.log('📥 [REGISTER] 자동 로그인 응답 상태:', loginResponse.status);
                                  const loginData = await loginResponse.json();
                                  console.log('📥 [REGISTER] 자동 로그인 응답 데이터:', loginData);

                                  if (loginResponse.ok && loginData.success) {
                                    console.log('✅ [REGISTER] 자동 로그인 성공');
                                    if (loginData.data && loginData.data.token) {
                                      localStorage.setItem('auth_token', loginData.data.token);
                                      localStorage.setItem('user_data', JSON.stringify(loginData.data.user));
                                      localStorage.removeItem('newMemberMtIdx');
                                      localStorage.removeItem('socialLoginData');
                                      console.log('🏠 [REGISTER] 홈으로 리다이렉트');
                                      router.push('/home');
                                      return;
                                    } else {
                                      console.error('❌ [REGISTER] 응답에 토큰이 없음:', loginData);
                                    }
                                  } else {
                                    console.error('❌ [REGISTER] 자동 로그인 실패:', loginData);
                                  }
                                } catch (loginError) {
                                  console.error('❌ [REGISTER] 자동 로그인 중 오류:', loginError);
                                }
                              } else {
                                console.error('❌ [REGISTER] newMemberMtIdx가 localStorage에 없음');
                              }

                              console.log('🔀 [REGISTER] 로그인 페이지로 리다이렉트');
                              router.push('/signin');
                            }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full py-4 bg-[#0114a2] text-white rounded-xl font-semibold text-lg shadow-lg hover:bg-[#010f7a] transition-colors"
                          >
                            로그인하러 가기
                          </motion.button>
                        )}

                        {/* 로딩 인디케이터 */}
                        {(isJoiningGroup || isOpeningApp) && (
                          <div className="flex items-center justify-center space-x-2 text-gray-600 mt-4">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#0114a2]"></div>
                            <span>{isJoiningGroup ? '그룹 가입 중...' : '앱으로 이동 중...'}</span>
                          </div>
                        )}
                      </motion.div>
                    </motion.div>
                  </motion.div>
                </div>
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
            transition={{
              duration: 0.4,
              ease: [0.4, 0.0, 0.2, 1], // iOS 최적화된 이징
              type: "tween"
            }}
            className="p-4"
            data-bottom-button
            style={{
              paddingBottom: '1rem',
              // iOS 애니메이션 최적화
              willChange: 'transform',
              transform: 'translateZ(0)', // 하드웨어 가속 활성화
              backfaceVisibility: 'hidden'
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
                } else if (currentStep === REGISTER_STEPS.PROFILE) {
                  console.log('회원가입 완료 함수 호출');
                  handleRegister();
                } else {
                  // 모든 다른 경우 (TERMS, BASIC_INFO 등)는 handleNext()를 통해 흐름 처리
                  console.log('다음 단계 함수 호출');
                  handleNext();
                }
              }}
              disabled={!isStepValid() || isLoading || locationLoading || isInitializing || !isDataLoaded}
              whileHover={{ scale: (isStepValid() && !locationLoading && !isInitializing && isDataLoaded) ? 1.02 : 1 }}
              whileTap={{ scale: (isStepValid() && !locationLoading && !isInitializing && isDataLoaded) ? 0.98 : 1 }}
              className={`w-full py-4 rounded-xl font-semibold text-lg transition-all register-button ${(isStepValid() && !locationLoading && !isInitializing && isDataLoaded)
                ? 'text-white shadow-lg'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed opacity-60'
                }`}
              style={(isStepValid() && !locationLoading && !isInitializing && isDataLoaded)
                ? { backgroundColor: '#0114a2' }
                : {}}
            >
              <div className="flex items-center justify-center gap-2">
                {/* 애플 로그인 약관 동의 시 로딩바 표시 */}
                {isLoading && currentStep === REGISTER_STEPS.TERMS && registerData.isSocialLogin && registerData.socialProvider === 'apple' && (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                <span>
                  {isInitializing ? '초기화 중...' :
                    !isDataLoaded ? '데이터 로딩 중...' :
                      isLoading ? '처리 중...' :
                        locationLoading ? '위치 정보 가져오는 중...' :
                          currentStep === REGISTER_STEPS.PHONE ? '인증번호 발송' :
                            currentStep === REGISTER_STEPS.VERIFICATION ? '인증번호 확인' :
                              currentStep === REGISTER_STEPS.PROFILE ? '회원가입 완료' :
                                (currentStep === REGISTER_STEPS.BASIC_INFO && registerData.isSocialLogin && (registerData.socialProvider === 'apple' || registerData.socialProvider === 'google')) ? '회원가입 완료' : '다음'}
                </span>
              </div>
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
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: '#0114a2' }}>
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
                      style={{ color: '#0114a2' }}
                      onMouseEnter={(e) => (e.target as HTMLButtonElement).style.color = '#1e40af'}
                      onMouseLeave={(e) => (e.target as HTMLButtonElement).style.color = '#0114a2'}
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
                    <div key={day} className={`h-8 flex items-center justify-center text-xs font-bold ${index === 0 ? 'text-red-600' : index === 6 ? 'text-[#0114a2]' : 'text-gray-700'
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
                            ? { backgroundColor: '#0114a2' }
                            : isToday && !isSelected
                              ? { backgroundColor: '#eff6ff', color: '#1e40af' }
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
                  <div className="text-center mb-6 p-4 rounded-xl" style={{ backgroundColor: '#eff6ff', border: '1px solid #e0e7ff' }}>
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
                    className={`flex-1 py-3 rounded-xl font-medium transition-colors ${selectedDate
                      ? 'text-white'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    style={selectedDate
                      ? { backgroundColor: '#0114a2' }
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