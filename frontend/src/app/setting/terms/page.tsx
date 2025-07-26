"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiFileText, 
  FiShield, 
  FiMapPin,
  FiCheck,
  FiX,
  FiChevronRight,
  FiInfo,
  FiCalendar,
  FiSettings,
  FiDownload,
  FiEye,
  FiAlertCircle,
  FiClock,
  FiRefreshCw,
  FiBookOpen,
  FiLock,
  FiGlobe,
  FiUser,
  FiUsers
} from 'react-icons/fi';
import { HiSparkles, HiCheckCircle } from 'react-icons/hi2';
import { useAuth } from '@/contexts/AuthContext';
import authService from '@/services/authService';
import { triggerHapticFeedback, HapticFeedbackType } from '@/utils/haptic';
import AnimatedHeader from '../../../components/common/AnimatedHeader';

// 모바일 최적화된 CSS 애니메이션 (노란색 테마)
const pageAnimations = `
html, body {
  width: 100%;
  overflow-x: hidden;
  position: relative;
}

@keyframes slideInFromRight {
  from {
    transform: translateX(30px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOutToRight {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(-30px);
    opacity: 0;
  }
}

@keyframes slideInFromBottom {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes slideOutToBottom {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(100%);
    opacity: 0;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes scaleIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

.animate-slideInFromRight {
  animation: slideInFromRight 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

.animate-slideOutToRight {
  animation: slideOutToRight 0.4s cubic-bezier(0.55, 0.06, 0.68, 0.19) forwards;
}

.animate-slideInFromBottom {
  animation: slideInFromBottom 0.3s ease-out forwards;
}

.animate-slideOutToBottom {
  animation: slideOutToBottom 0.3s ease-in forwards;
}

.animate-fadeIn {
  animation: fadeIn 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

.animate-scaleIn {
  animation: scaleIn 0.2s ease-out forwards;
}

.animate-pulse {
  animation: pulse 2s infinite;
}

.animate-float {
  animation: float 3s ease-in-out infinite;
}

.initial-hidden {
  opacity: 0;
  transform: translateX(100%);
  position: relative;
  width: 100%;
  overflow: hidden;
}

.mobile-button {
  transition: all 0.2s ease;
  touch-action: manipulation;
  user-select: none;
}

.mobile-button:active {
  transform: scale(0.98);
}

.glass-effect {
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.7);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
}

.terms-card {
  background: linear-gradient(135deg, #EBB305 0%, #D97706 100%);
  position: relative;
  overflow: hidden;
}

.terms-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E") repeat;
  opacity: 0.3;
}

.service-card {
  background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
}

.privacy-card {
  background: linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%);
}

.location-card {
  background: linear-gradient(135deg, #FDE047 0%, #FACC15 100%);
}

.term-item {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.term-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.consent-toggle {
  transition: all 0.2s ease;
}

.consent-toggle.active {
  background: linear-gradient(135deg, #EBB305 0%, #D97706 100%);
}

.menu-item-hover {
  transition: all 0.2s ease;
}

.menu-item-hover:hover {
  background-color: #fffbeb;
  transform: translateX(2px);
}

.profile-glow {
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
}
`;

// 데이터 타입 정의
interface Term {
  id: string;
  dbField: string; // member_t 테이블의 필드명
  title: string;
  description: string;
  link: string;
  icon: any;
  color: string;
  version: string;
  lastUpdated: string;
  isRequired: boolean;
  isConsented: boolean;
  summary: string;
}

interface ConsentHistory {
  termId: string;
  version: string;
  consentedAt: string;
  action: 'agreed' | 'disagreed' | 'updated';
}

// member_t 테이블 필드에 맞춘 약관 데이터
const TERMS_DATA: Term[] = [
  {
    id: 'service',
    dbField: 'mt_agree1',
    title: '서비스 이용약관',
    description: 'SMAP 서비스 이용에 관한 기본 약관입니다.',
    link: 'https://schedulemap.notion.site/30b32b5ad0bc4f99a39b28c0fe5f1de4?source=copy_link',
    icon: FiFileText,
    color: 'bg-yellow-100 text-yellow-700',
    version: 'v2.1',
    lastUpdated: '2024-01-15',
    isRequired: true,
    isConsented: false, // 실제 사용자 데이터에서 가져올 예정
    summary: '서비스 이용 시 준수해야 할 기본 규칙과 권리, 의무사항을 규정합니다.'
  },
  {
    id: 'privacy',
    dbField: 'mt_agree2',
    title: '개인정보 처리방침',
    description: '개인정보 수집, 이용, 보관에 관한 정책입니다.',
    link: 'https://schedulemap.notion.site/2ac62e02f97b4d61945d68c2d89109e9?source=copy_link',
    icon: FiShield,
    color: 'bg-amber-100 text-amber-700',
    version: 'v1.8',
    lastUpdated: '2024-02-01',
    isRequired: true,
    isConsented: false,
    summary: '개인정보의 수집 목적, 이용 범위, 보관 기간 등을 명시합니다.'
  },
  {
    id: 'location',
    dbField: 'mt_agree3',
    title: '위치기반서비스 이용약관',
    description: '위치 기반 서비스 이용에 관한 약관입니다.',
    link: 'https://schedulemap.notion.site/69cf94c6a04e471d8c3e3043f95baefb?source=copy_link',
    icon: FiMapPin,
    color: 'bg-orange-100 text-orange-700',
    version: 'v1.3',
    lastUpdated: '2024-01-20',
    isRequired: true,
    isConsented: false,
    summary: '위치정보 수집 및 활용에 대한 동의사항을 포함합니다.'
  },
  {
    id: 'third_party',
    dbField: 'mt_agree4',
    title: '개인정보 제3자 제공 동의',
    description: '개인정보 제3자 제공에 관한 동의사항입니다.',
    link: 'https://schedulemap.notion.site/3-21b302dcaba0490fbaa9430618a74f01?source=copy_link',
    icon: FiUsers,
    color: 'bg-red-100 text-red-700',
    version: 'v1.2',
    lastUpdated: '2024-01-10',
    isRequired: false,
    isConsented: false,
    summary: '서비스 제공을 위한 개인정보 제3자 제공에 대한 동의입니다.'
  },
  {
    id: 'marketing',
    dbField: 'mt_agree5',
    title: '마케팅 정보 수집 및 이용 동의',
    description: '마케팅 목적의 개인정보 수집 및 이용에 관한 동의사항입니다.',
    link: 'https://schedulemap.notion.site/7e35638d106f433f86fa95f88ba6efb1?source=copy_link',
    icon: FiGlobe,
    color: 'bg-yellow-100 text-yellow-700',
    version: 'v1.0',
    lastUpdated: '2024-01-01',
    isRequired: false,
    isConsented: false,
    summary: '이벤트, 혜택 등 마케팅 정보 수집 및 이용에 대한 동의입니다.'
  }
];

const CONSENT_HISTORY: ConsentHistory[] = [
  {
    termId: 'service',
    version: 'v2.1',
    consentedAt: '2024-01-15 14:30:00',
    action: 'agreed'
  },
  {
    termId: 'privacy',
    version: 'v1.8',
    consentedAt: '2024-02-01 09:15:00',
    action: 'updated'
  },
  {
    termId: 'marketing',
    version: 'v1.0',
    consentedAt: '2024-01-01 16:45:00',
    action: 'agreed'
  }
];

  // 안드로이드 기기 감지 함수
  const isAndroid = () => {
    if (typeof window !== 'undefined') {
      return /Android/i.test(navigator.userAgent);
    }
    return false;
  };

  // 안드로이드 상태바 높이 계산
  const getAndroidStatusBarHeight = () => {
    if (typeof window !== 'undefined' && isAndroid()) {
      // 안드로이드 상태바 높이는 보통 24-48px 정도
      return '24px';
    }
    return '0px';
  };

export default function TermsPage() {
  // 🚨 즉시 실행 테스트 로그
  console.log('🚨 [TERMS] TermsPage 컴포넌트 실행됨 - 타임스탬프:', new Date().toISOString());
  console.log('🚨 [TERMS] 현재 URL:', window.location.href);
  
  const router = useRouter();
  const { user } = useAuth();

  console.log('🚨 [TERMS] useAuth 훅 실행됨 - user:', user);

  const [terms, setTerms] = useState(TERMS_DATA);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<Term | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConsents, setIsLoadingConsents] = useState(true);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  console.log('🚨 [TERMS] 상태 초기화 완료');

  // 컴포넌트 마운트 확인
  useEffect(() => {
    console.log('[TERMS] 컴포넌트 마운트됨');
    return () => {
      console.log('[TERMS] 컴포넌트 언마운트됨');
    };
  }, []);

  // body에 data-page 속성 추가 및 스크롤 스타일 제어
  useEffect(() => {
    console.log('[TERMS] 페이지 스타일 설정 시작');
    document.body.setAttribute('data-page', '/setting/terms');
    
    // 이 페이지에서만 스크롤 허용
    const html = document.documentElement;
    const body = document.body;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.height = '100vh';
    
    // 메인 컨텐츠 영역만 스크롤 가능하도록 설정
    const contentElement = document.querySelector('.scrollable-content');
    if (contentElement) {
      body.style.overflow = 'hidden';
      body.style.touchAction = 'none';
      contentElement.classList.add('scrollable-content');
    }

    return () => {
      console.log('[TERMS] 페이지 스타일 복구');
      document.body.removeAttribute('data-page');
      // 페이지를 떠날 때 원래 스타일로 복구
      html.style.overflow = '';
      body.style.overflow = '';
      body.style.height = '';
      body.style.touchAction = '';
    };
  }, []);

  // 사용자 동의 정보 로드
  useEffect(() => {
    console.log('[TERMS] useEffect 실행 - user 상태:', user);
    console.log('[TERMS] user 타입:', typeof user);
    console.log('[TERMS] user.mt_idx:', user?.mt_idx);
    
    if (user?.mt_idx) {
      console.log('[TERMS] 사용자 정보 확인됨, 동의 정보 로드 시작:', user.mt_idx);
      loadUserConsents();
    } else {
      console.log('[TERMS] 사용자 정보가 없음, 로딩 상태 false로 설정');
      setIsLoadingConsents(false);
    }
  }, [user]);

  // 추가: user 변화 감지
  useEffect(() => {
    console.log('[TERMS] user 변화 감지:', {
      hasUser: !!user,
      userId: user?.mt_idx,
      userName: user?.mt_name,
      timestamp: new Date().toISOString()
    });
  }, [user]);

  // 사용자의 동의 정보를 로드하는 함수
  const loadUserConsents = async () => {
    console.log('[TERMS] loadUserConsents 시작');
    
    if (!user?.mt_idx) {
      console.error('[TERMS] 사용자 정보가 없습니다.');
      setIsLoadingConsents(false);
      return;
    }

    console.log('[TERMS] 동의 정보 조회 시작 - user_id:', user.mt_idx);
    setIsLoadingConsents(true);
    
    try {
      const token = localStorage.getItem('auth-token');
      console.log('[TERMS] 토큰 확인:', token ? '토큰 있음' : '토큰 없음');
      
      if (!token) {
        console.error('[TERMS] 토큰이 없습니다.');
        setIsLoadingConsents(false);
        return;
      }

      const apiUrl = `/api/v1/members/consent/${user.mt_idx}`;
      console.log('[TERMS] API 호출 시작:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('[TERMS] API 응답 상태:', response.status);
      
      if (!response.ok) {
        console.error('[TERMS] API 응답 오류:', response.status, response.statusText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('[TERMS] 동의 정보 조회 응답:', result);

      if (result.success && result.data) {
        const userConsents = result.data;
        console.log('[TERMS] 동의 정보 데이터:', userConsents);
        
        setTerms(prev => prev.map(term => ({
          ...term,
          isConsented: userConsents[term.dbField as keyof typeof userConsents] === 'Y'
        })));
        
        console.log('[TERMS] 동의 정보 로드 성공');
      } else {
        console.warn('[TERMS] 동의 정보 조회 실패, 기본값 설정:', result.message);
        setTerms(prev => prev.map(term => ({
          ...term,
          isConsented: false
        })));
      }
    } catch (error) {
      console.error('[TERMS] 동의 정보 로드 실패:', error);
      
      // 폴백 로직: 사용자 컨텍스트에서 가져오기
      if (user) {
        console.log('[TERMS] 폴백: 사용자 컨텍스트에서 동의 정보 가져오기');
        const userConsents = {
          mt_agree1: user.mt_agree1 || 'N',
          mt_agree2: user.mt_agree2 || 'N',
          mt_agree3: user.mt_agree3 || 'N',
          mt_agree4: user.mt_agree4 || 'N',
          mt_agree5: user.mt_agree5 || 'N'
        };
        
        console.log('[TERMS] 폴백 동의 정보:', userConsents);
        
        setTerms(prev => prev.map(term => ({
          ...term,
          isConsented: userConsents[term.dbField as keyof typeof userConsents] === 'Y'
        })));
      }
    } finally {
      console.log('[TERMS] 동의 정보 로딩 완료');
      setIsLoadingConsents(false);
    }
  };

  // 뒤로가기 핸들러
  const handleBack = () => {
    // 🎮 뒤로가기 햅틱 피드백
    triggerHapticFeedback(HapticFeedbackType.SELECTION, '약관 및 정책 뒤로가기', { 
      component: 'terms', 
      action: 'back-navigation' 
    });
    router.push('/setting');
  };

  // 약관 상세 보기
  const handleViewTerm = (term: Term) => {
    // 🎮 약관 상세보기 햅틱 피드백
    triggerHapticFeedback(HapticFeedbackType.SELECTION, '약관 상세보기', { 
      component: 'terms', 
      action: 'view-term',
      termId: term.id 
    });
    // 외부 링크로 새 탭에서 열기
    window.open(term.link, '_blank', 'noopener,noreferrer');
  };

  // 약관 미리보기
  const handlePreviewTerm = (term: Term) => {
    // 🎮 약관 미리보기 햅틱 피드백
    triggerHapticFeedback(HapticFeedbackType.SELECTION, '약관 미리보기', { 
      component: 'terms', 
      action: 'preview-term',
      termId: term.id 
    });
    setSelectedTerm(term);
    setShowPreviewModal(true);
  };

  // 동의 상태 변경
  const handleConsentToggle = async (termId: string) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    const term = terms.find(t => t.id === termId);
    if (!term) return;

    console.log('[TOGGLE] 클릭된 약관:', term.title, '현재 상태:', term.isConsented);

    
    if (term.isRequired) {
      // 🎮 필수 약관 변경 시도 시 경고 햅틱 피드백
      triggerHapticFeedback(HapticFeedbackType.ERROR, '필수 약관 변경 불가', { 
        component: 'terms', 
        action: 'required-term-warning',
        termId: term.id 
      });
      alert('필수 약관은 변경할 수 없습니다.');
      return;
    }

    // 🎮 동의 상태 변경 햅틱 피드백
    triggerHapticFeedback(HapticFeedbackType.SELECTION, `약관 동의 ${term.isConsented ? '해제' : '설정'}`, { 
      component: 'terms', 
      action: 'consent-toggle',
      termId: term.id,
      newState: !term.isConsented 
    });

    // 즉시 UI 업데이트 (낙관적 업데이트)
    setTerms(prevTerms => 
      prevTerms.map(t => 
        t.id === termId 
          ? { ...t, isConsented: !t.isConsented }
          : t
      )
    );

    setIsLoading(true);
    try {
      const newConsentValue = term.isConsented ? 'N' : 'Y';
      const token = localStorage.getItem('auth-token');
      
      if (!token) {
        throw new Error('인증 토큰이 없습니다.');
      }

      console.log('[TERMS] 동의 상태 변경 API 호출:', { field: term.dbField, value: newConsentValue });
      
      const response = await fetch('/api/v1/members/consent', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          field: term.dbField,
          value: newConsentValue
        }),
      });

      console.log('[TERMS] 동의 상태 변경 API 응답 상태:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('[TERMS] 개별 동의 상태 변경 응답:', result);

      if (!result.success) {
        throw new Error(result.message || '동의 상태 변경 실패');
      }

      // API 성공 - 낙관적 업데이트가 이미 되어있으므로 추가 업데이트 불필요
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      console.log('[TERMS] 개별 동의 상태 변경 성공');
    } catch (error) {
      console.error('[TERMS] 동의 상태 변경 실패:', error);
      
      // API 실패 시 원래 상태로 되돌리기
      setTerms(prevTerms => 
        prevTerms.map(t => 
          t.id === termId 
            ? { ...t, isConsented: !t.isConsented }
            : t
        )
      );
      
      alert('동의 상태 변경에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 동의 통계
  const consentStats = {
    total: terms.length,
    consented: terms.filter(term => term.isConsented).length,
    required: terms.filter(term => term.isRequired).length,
    requiredConsented: terms.filter(term => term.isRequired && term.isConsented).length
  };

  return (
    <>
      <style jsx global>{pageAnimations}</style>
      <div 
        className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-amber-50 scrollable-content"
        data-page="/setting/terms"
      >
        {/* notice 페이지와 동일한 헤더 */}
        <AnimatedHeader 
          variant="enhanced"
          className="setting-header"
          style={{ paddingTop: getAndroidStatusBarHeight() }}
        >
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
            className="setting-header-content"
          >
            <motion.button 
              onClick={handleBack}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="setting-back-button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </motion.button>
              <div className="setting-header-text">
              <h1 className="text-lg font-bold text-gray-900 leading-tight">약관 및 동의</h1>
              <p className="text-xs text-gray-500 leading-tight">서비스 이용 약관 관리</p>
            </div>
            </motion.div>
          {/* </motion.div> */}
        </AnimatedHeader>

        {/* 메인 컨텐츠 - notice 페이지와 동일한 구조 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="px-4 space-y-6 pb-24"
        >
          {/* 동의 현황 카드 - 노란색 테마 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mt-4"
          >
            <div className="bg-[#EBB305] rounded-3xl p-6 text-white shadow-xl">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                    <FiBookOpen className="w-8 h-8" />
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h2 className="text-xl font-bold">동의 현황</h2>
                    <div className="flex items-center space-x-1 bg-white/20 px-2 py-1 rounded-full">
                      <HiSparkles className="w-3 h-3 text-yellow-100" />
                      <span className="text-xs font-medium text-yellow-100">{consentStats.consented}/{consentStats.total}</span>
                    </div>
                  </div>
                  <p className="text-yellow-100 text-sm mb-1">전체 {consentStats.consented}개 동의 완료</p>
                  <p className="text-yellow-200 text-xs">약관 동의 상태를 확인하세요</p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-white/20">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <FiCheck className="w-4 h-4 text-yellow-200" />
                      <span className="text-sm text-yellow-100">필수 동의</span>
                    </div>
                    <p className="text-lg font-bold">{consentStats.requiredConsented}/{consentStats.required}</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <FiFileText className="w-4 h-4 text-yellow-200" />
                      <span className="text-sm text-yellow-100">선택 동의</span>
                    </div>
                    <p className="text-lg font-bold">{consentStats.consented - consentStats.requiredConsented}/{consentStats.total - consentStats.required}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 약관 목록 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            {/* 로딩 상태 */}
            {isLoadingConsents ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center py-12"
              >
                <div className="flex items-center space-x-3">
                                          <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-600 rounded-full unified-animate-spin"></div>
                  <span className="text-gray-600">동의 정보를 불러오는 중...</span>
                </div>
              </motion.div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {terms.map((term, index) => (
                  <motion.div
                    key={term.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`p-3 menu-item-hover mobile-button cursor-pointer ${index !== terms.length - 1 ? 'border-b border-gray-50' : ''}`}
                    onClick={() => handlePreviewTerm(term)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <term.icon className="w-5 h-5 text-yellow-600" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-xs text-gray-900">{term.title}</h4>
                          {term.isRequired && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                              필수
                            </span>
                          )}
                          {term.isConsented && (
                            <HiCheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mb-1">{term.description}</p>
                        <p className="text-xs text-gray-400">{term.version} • {term.lastUpdated}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

        </motion.div>

        {/* 성공 토스트 */}
        <AnimatePresence>
          {showSuccessToast && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-4 left-4 right-4 z-50"
            >
              <div className="bg-yellow-500 text-white p-4 rounded-2xl shadow-lg flex items-center space-x-3">
                <HiCheckCircle className="w-6 h-6" />
                <span className="font-medium">동의 상태가 성공적으로 변경되었습니다</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 약관 미리보기 모달 */}
        {showPreviewModal && selectedTerm && (
          <div 
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" 
            onClick={() => setShowPreviewModal(false)}
          >
            <div 
              className="w-full max-w-md bg-white rounded-t-3xl p-6 pb-8 shadow-2xl animate-slideInFromBottom max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6"></div>
              
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <selectedTerm.icon className="w-8 h-8 text-yellow-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">{selectedTerm.title}</h3>
                <p className="text-gray-600 text-sm">{selectedTerm.version} • {selectedTerm.lastUpdated}</p>
              </div>
              
              <div className="space-y-4 mb-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">약관 요약</h4>
                  <p className="text-gray-600 text-sm">{selectedTerm.summary}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">상세 설명</h4>
                  <p className="text-gray-600 text-sm">{selectedTerm.description}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">동의 상태</h4>
                  <div className="flex items-center space-x-2">
                    {selectedTerm.isConsented ? (
                      <>
                        <HiCheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-green-700 font-medium">동의함</span>
                      </>
                    ) : (
                      <>
                        <FiX className="w-5 h-5 text-red-500" />
                        <span className="text-red-700 font-medium">동의하지 않음</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={() => handleViewTerm(selectedTerm)}
                  className="w-full py-4 rounded-2xl bg-yellow-500 text-white font-medium shadow-lg mobile-button"
                >
                  전체 약관 보기
                </button>
                
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="w-full py-4 rounded-2xl bg-gray-100 text-gray-700 font-medium mobile-button"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
} 