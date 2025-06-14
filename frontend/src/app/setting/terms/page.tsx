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
    link: '/terms/service',
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
    link: '/terms/privacy',
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
    link: '/terms/location',
    icon: FiMapPin,
    color: 'bg-orange-100 text-orange-700',
    version: 'v1.3',
    lastUpdated: '2024-01-20',
    isRequired: false,
    isConsented: false,
    summary: '위치정보 수집 및 활용에 대한 동의사항을 포함합니다.'
  },
  {
    id: 'third_party',
    dbField: 'mt_agree4',
    title: '개인정보 제3자 제공 동의',
    description: '개인정보 제3자 제공에 관한 동의사항입니다.',
    link: '/terms/third-party',
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
    link: '/terms/marketing',
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

export default function TermsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'terms' | 'consent' | 'history'>('terms');
  const [terms, setTerms] = useState(TERMS_DATA);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<Term | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // 사용자 동의 정보 로드
  useEffect(() => {
    if (user) {
      loadUserConsents();
    }
  }, [user]);

  // 사용자의 동의 정보를 로드하는 함수
  const loadUserConsents = async () => {
    try {
      // 실제 API 호출 시 사용할 코드
      // const response = await fetch(`/api/user/${user.mt_idx}/consents`);
      // const userData = await response.json();
      
      // 임시로 사용자 데이터에서 동의 정보 가져오기
      const userConsents = {
        mt_agree1: user?.mt_agree1 || 'N',
        mt_agree2: user?.mt_agree2 || 'N',
        mt_agree3: user?.mt_agree3 || 'N',
        mt_agree4: user?.mt_agree4 || 'N',
        mt_agree5: user?.mt_agree5 || 'N'
      };

      setTerms(prev => prev.map(term => ({
        ...term,
        isConsented: userConsents[term.dbField as keyof typeof userConsents] === 'Y'
      })));
    } catch (error) {
      console.error('동의 정보 로드 실패:', error);
    }
  };

  // 뒤로가기 핸들러
  const handleBack = () => {
    router.back();
  };

  // 약관 상세 보기
  const handleViewTerm = (term: Term) => {
    router.push(term.link);
  };

  // 약관 미리보기
  const handlePreviewTerm = (term: Term) => {
    setSelectedTerm(term);
    setShowPreviewModal(true);
  };

  // 동의 상태 변경
  const handleConsentToggle = async (termId: string) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    setIsLoading(true);
    try {
      const term = terms.find(t => t.id === termId);
      if (!term) return;

      const newConsentValue = term.isConsented ? 'N' : 'Y';
      
      // 실제 API 호출 (임시로 토큰 없이 처리)
      const response = await fetch('/api/user/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer temp-token`,
        },
        body: JSON.stringify({
          mt_idx: user.mt_idx,
          field: term.dbField,
          value: newConsentValue
        })
      });

      if (!response.ok) {
        throw new Error('동의 상태 변경 실패');
      }

      // 로컬 상태 업데이트
      setTerms(prev => prev.map(t => 
        t.id === termId 
          ? { ...t, isConsented: !t.isConsented }
          : t
      ));
      
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      console.error('동의 상태 변경 실패:', error);
      alert('동의 상태 변경에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 전체 동의
  const handleAllConsent = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    setIsLoading(true);
    try {
      // 모든 약관에 대해 동의 처리
      const consentData = {
        mt_idx: user.mt_idx,
        mt_agree1: 'Y',
        mt_agree2: 'Y',
        mt_agree3: 'Y',
        mt_agree4: 'Y',
        mt_agree5: 'Y'
      };

      const response = await fetch('/api/user/consent/all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer temp-token`,
        },
        body: JSON.stringify(consentData)
      });

      if (!response.ok) {
        throw new Error('전체 동의 처리 실패');
      }

      // 로컬 상태 업데이트
      setTerms(prev => prev.map(term => ({ ...term, isConsented: true })));
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      console.error('전체 동의 실패:', error);
      alert('전체 동의 처리에 실패했습니다. 다시 시도해주세요.');
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
      <div className="schedule-page-container bg-gradient-to-br from-yellow-50 via-white to-amber-50">
        {/* 헤더 - 설정 페이지와 동일한 애니메이션 */}
        <motion.header 
          initial={{ y: -100, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ 
            delay: 0.2, 
            duration: 0.8, 
            ease: [0.25, 0.46, 0.45, 0.94],
            opacity: { duration: 0.6 },
            scale: { duration: 0.6 }
          }}
          className="fixed top-0 left-0 right-0 z-20 glass-effect"
        >
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex items-center justify-between h-16 px-4"
          >
            <div className="flex items-center space-x-3">
              <motion.button 
                onClick={handleBack}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </motion.button>
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.4 }}
                className="flex items-center space-x-3"
              >
                <div>
                  <h1 className="text-lg font-bold text-gray-900">약관 및 동의</h1>
                  <p className="text-xs text-gray-500">서비스 이용 약관 관리</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.header>

        {/* 메인 컨텐츠 - 설정 페이지와 동일한 구조 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="schedule-page-content px-4 pt-20 space-y-6"
        >
          {/* 동의 현황 카드 - 노란색 테마 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="pb-2"
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

          {/* 탭 메뉴 - 노란색 테마 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <div className="bg-white rounded-2xl p-2 shadow-sm border border-gray-100">
              <div className="grid grid-cols-3 gap-1 relative">
                <motion.div
                  className="absolute top-1 bottom-1 bg-yellow-600 rounded-xl"
                  initial={false}
                  animate={{
                    x: activeTab === 'terms' ? '0%' : activeTab === 'consent' ? '100%' : '200%'
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  style={{ width: 'calc(33.333% - 4px)' }}
                />
                {[
                  { key: 'terms', label: '약관목록', icon: FiFileText },
                  { key: 'consent', label: '동의관리', icon: FiCheck },
                  { key: 'history', label: '동의이력', icon: FiClock }
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key as any)}
                    className={`relative z-10 py-3 px-2 rounded-xl text-sm font-medium transition-colors mobile-button ${
                      activeTab === key ? 'text-white' : 'text-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* 탭 컨텐츠 */}
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {activeTab === 'terms' && (
                <motion.div
                  key="terms"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                >
                  {/* 전체 동의 버튼 */}
                  <motion.button
                    onClick={handleAllConsent}
                    disabled={isLoading || consentStats.consented === consentStats.total}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 bg-gradient-to-r from-yellow-600 to-amber-600 text-white font-medium rounded-2xl shadow-lg mobile-button disabled:opacity-50 mb-4"
                  >
                    {isLoading ? '처리 중...' : '전체 동의하기'}
                  </motion.button>

                  {/* 약관 목록 - 노란색 테마 */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {terms.map((term, index) => (
                      <motion.div
                        key={term.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`p-4 menu-item-hover mobile-button ${index !== terms.length - 1 ? 'border-b border-gray-50' : ''}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <term.icon className="w-5 h-5 text-yellow-600" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-medium text-gray-900">{term.title}</h4>
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
                            <p className="text-xs text-gray-400">{term.version} • {term.lastUpdated} • {term.dbField}</p>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <motion.button
                              onClick={() => handlePreviewTerm(term)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="p-2 bg-yellow-50 rounded-xl hover:bg-yellow-100 transition-colors"
                            >
                              <FiEye className="w-4 h-4 text-yellow-600" />
                            </motion.button>
                            <motion.button
                              onClick={() => handleViewTerm(term)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="p-2 bg-yellow-50 rounded-xl hover:bg-yellow-100 transition-colors"
                            >
                              <FiChevronRight className="w-4 h-4 text-yellow-600" />
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'consent' && (
                <motion.div
                  key="consent"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                >
                  {/* 동의 관리 안내 */}
                  <div className="bg-yellow-50 rounded-2xl p-4 border border-yellow-100 mb-4">
                    <div className="flex items-start space-x-3">
                      <FiInfo className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-yellow-900 mb-1">동의 관리 안내</h3>
                        <p className="text-yellow-700 text-sm">
                          필수 약관은 서비스 이용을 위해 반드시 동의해야 하며, 선택 약관은 언제든지 철회할 수 있습니다.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 동의 관리 - 노란색 테마 */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {terms.map((term, index) => (
                      <motion.div
                        key={term.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`p-4 ${index !== terms.length - 1 ? 'border-b border-gray-50' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 flex-1">
                            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center flex-shrink-0">
                              <term.icon className="w-5 h-5 text-yellow-600" />
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <h4 className="font-medium text-gray-900">{term.title}</h4>
                                {term.isRequired && (
                                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                                    필수
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">{term.summary}</p>
                              <p className="text-xs text-gray-400 mt-1">DB 필드: {term.dbField}</p>
                            </div>
                          </div>
                          
                          <motion.button
                            onClick={() => handleConsentToggle(term.id)}
                            disabled={isLoading}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className={`w-12 h-6 rounded-full transition-colors mobile-button ${
                              term.isConsented 
                                ? 'bg-yellow-500' 
                                : 'bg-gray-300'
                            }`}
                          >
                            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                              term.isConsented ? 'translate-x-6' : 'translate-x-0.5'
                            }`} />
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'history' && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                >
                  {/* 동의 이력 - 노란색 테마 */}
                  {CONSENT_HISTORY.length > 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      {CONSENT_HISTORY.map((history, index) => {
                        const term = terms.find(t => t.id === history.termId);
                        return (
                          <motion.div
                            key={`${history.termId}-${history.version}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`p-4 menu-item-hover ${index !== CONSENT_HISTORY.length - 1 ? 'border-b border-gray-50' : ''}`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                {term?.icon && <term.icon className="w-5 h-5 text-yellow-600" />}
                              </div>
                              
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <h4 className="font-medium text-gray-900">{term?.title}</h4>
                                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                    history.action === 'agreed' ? 'bg-green-100 text-green-700' :
                                    history.action === 'updated' ? 'bg-blue-100 text-blue-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    {history.action === 'agreed' ? '동의' : 
                                     history.action === 'updated' ? '업데이트' : '거부'}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500">{history.version} • {history.consentedAt}</p>
                                {term && <p className="text-xs text-gray-400">DB 필드: {term.dbField}</p>}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <div className="w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiClock className="w-10 h-10 text-yellow-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">동의 이력이 없습니다</h3>
                      <p className="text-gray-500">아직 약관 동의 이력이 없어요</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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
                <p className="text-gray-500 text-xs mt-1">DB 필드: {selectedTerm.dbField}</p>
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