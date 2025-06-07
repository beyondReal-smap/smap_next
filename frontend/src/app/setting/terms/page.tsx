"use client";
import React, { useState } from 'react';
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
  FiUser
} from 'react-icons/fi';
import { HiSparkles, HiCheckCircle } from 'react-icons/hi2';

// 모바일 최적화된 CSS 애니메이션
const mobileAnimations = `
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

@keyframes slideOutToLeft {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(-30px);
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

.animate-slideOutToLeft {
  animation: slideOutToLeft 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.privacy-card {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.location-card {
  background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
}

.term-item {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.term-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.consent-toggle {
  transition: all 0.2s ease;
}

.consent-toggle.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
`;

// 데이터 타입 정의
interface Term {
  id: string;
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

// 모의 데이터
const TERMS_DATA: Term[] = [
  {
    id: 'service',
    title: '서비스 이용약관',
    description: '서비스 이용에 대한 기본적인 약관입니다.',
    link: '/setting/terms/service',
    icon: FiFileText,
    color: 'service-card',
    version: 'v2.1',
    lastUpdated: '2024-03-15',
    isRequired: true,
    isConsented: true,
    summary: 'SMAP 서비스 이용 시 준수해야 할 기본 규칙과 사용자의 권리 및 의무에 대한 내용입니다.'
  },
  {
    id: 'privacy',
    title: '개인정보 처리방침',
    description: '개인정보의 수집 및 이용, 보호에 관한 정책입니다.',
    link: '/setting/terms/privacy',
    icon: FiShield,
    color: 'privacy-card',
    version: 'v1.8',
    lastUpdated: '2024-03-10',
    isRequired: true,
    isConsented: true,
    summary: '개인정보 수집, 이용, 보관, 파기에 대한 정책과 사용자의 개인정보 보호 권리에 대한 내용입니다.'
  },
  {
    id: 'location',
    title: '위치기반서비스 이용약관',
    description: '위치기반서비스 이용에 대한 약관입니다.',
    link: '/setting/terms/location',
    icon: FiMapPin,
    color: 'location-card',
    version: 'v1.3',
    lastUpdated: '2024-02-28',
    isRequired: false,
    isConsented: true,
    summary: '위치정보 수집 및 이용, 위치기반서비스 제공에 대한 약관과 사용자의 선택권에 대한 내용입니다.'
  }
];

const CONSENT_HISTORY: ConsentHistory[] = [
  {
    termId: 'service',
    version: 'v2.1',
    consentedAt: '2024-03-15 14:30:00',
    action: 'updated'
  },
  {
    termId: 'privacy',
    version: 'v1.8',
    consentedAt: '2024-03-10 09:15:00',
    action: 'updated'
  },
  {
    termId: 'location',
    version: 'v1.3',
    consentedAt: '2024-02-28 16:45:00',
    action: 'agreed'
  }
];

export default function TermsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'terms' | 'consent' | 'history'>('terms');
  const [terms, setTerms] = useState(TERMS_DATA);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<Term | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

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
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setTerms(prev => prev.map(term => 
        term.id === termId 
          ? { ...term, isConsented: !term.isConsented }
          : term
      ));
      
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      console.error('동의 상태 변경 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 전체 동의
  const handleAllConsent = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setTerms(prev => prev.map(term => ({ ...term, isConsented: true })));
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      console.error('전체 동의 실패:', error);
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
      <style jsx global>{mobileAnimations}</style>
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -30 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 min-h-screen pb-10"
      >
        {/* 헤더 */}
        <motion.header 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed top-0 left-0 right-0 z-50 glass-effect"
        >
          <div className="flex items-center justify-between h-16 px-4">
            <div className="flex items-center space-x-3">
              <motion.button 
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </motion.button>
              <div className="flex items-center space-x-3">
                <motion.div
                  initial={{ rotate: -180, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                  className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl"
                >
                  <FiBookOpen className="w-5 h-5 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">약관 및 동의</h1>
                  <p className="text-xs text-gray-500">서비스 이용 약관 관리</p>
                </div>
              </div>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-lg"
            >
              <FiSettings className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.header>

        {/* 동의 현황 카드 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="px-4 pt-20 pb-6"
        >
          <div className="terms-card rounded-3xl p-6 text-white shadow-xl">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold mb-1">동의 현황</h2>
                  <p className="text-indigo-100">약관 동의 상태를 확인하세요</p>
                </div>
                <motion.div
                  className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm animate-float"
                >
                  <HiSparkles className="w-8 h-8" />
                </motion.div>
              </div>
              
              <div className="bg-white/20 rounded-2xl p-4 backdrop-blur-sm mb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-indigo-100 text-sm mb-1">전체 동의</p>
                    <p className="text-2xl font-bold">{consentStats.consented}/{consentStats.total}</p>
                  </div>
                  <div>
                    <p className="text-indigo-100 text-sm mb-1">필수 동의</p>
                    <p className="text-2xl font-bold">{consentStats.requiredConsented}/{consentStats.required}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  onClick={handleAllConsent}
                  disabled={isLoading || consentStats.consented === consentStats.total}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-white/20 py-3 rounded-xl backdrop-blur-sm font-medium disabled:opacity-50"
                >
                  전체 동의
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-white/20 py-3 rounded-xl backdrop-blur-sm font-medium"
                >
                  약관 다운로드
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 탭 메뉴 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="px-4 mb-6"
        >
          <div className="bg-white rounded-2xl p-2 shadow-sm border border-gray-100">
            <div className="grid grid-cols-3 gap-1 relative">
              <motion.div
                className="absolute top-1 bottom-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl"
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
                  className={`relative z-10 py-3 px-4 rounded-xl text-sm font-medium transition-colors ${
                    activeTab === key ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* 탭 컨텐츠 */}
        <div className="px-4 pb-20">
          <AnimatePresence mode="wait">
            {activeTab === 'terms' && (
              <motion.div
                key="terms"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {terms.map((term, index) => (
                  <motion.div
                    key={term.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 term-item"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0">
                          <term.icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="text-lg font-bold text-gray-900">{term.title}</h3>
                            {term.isRequired && (
                              <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full">
                                필수
                              </span>
                            )}
                          </div>
                          <p className="text-gray-600 text-sm mb-2">{term.description}</p>
                          <p className="text-gray-500 text-xs mb-3">{term.summary}</p>
                          <div className="flex items-center space-x-4 text-xs text-gray-400">
                            <span>버전 {term.version}</span>
                            <span>•</span>
                            <span>최종 업데이트: {term.lastUpdated}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {term.isConsented ? (
                          <HiCheckCircle className="w-6 h-6 text-green-500" />
                        ) : (
                          <FiX className="w-6 h-6 text-red-500" />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <motion.button
                        onClick={() => handlePreviewTerm(term)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center justify-center space-x-2 py-3 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                      >
                        <FiEye className="w-4 h-4" />
                        <span className="text-sm font-medium">미리보기</span>
                      </motion.button>
                      <motion.button
                        onClick={() => handleViewTerm(term)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center justify-center space-x-2 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                      >
                        <FiChevronRight className="w-4 h-4" />
                        <span className="text-sm font-medium">전체보기</span>
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {activeTab === 'consent' && (
              <motion.div
                key="consent"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* 동의 관리 안내 */}
                <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                  <div className="flex items-start space-x-3">
                    <FiInfo className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-blue-900 mb-1">동의 관리 안내</h3>
                      <p className="text-blue-700 text-sm">
                        필수 약관은 서비스 이용을 위해 반드시 동의해야 하며, 선택 약관은 언제든지 철회할 수 있습니다.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 동의 토글 목록 */}
                <div className="space-y-4">
                  {terms.map((term, index) => (
                    <motion.div
                      key={term.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 flex-1">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                            <term.icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-semibold text-gray-900">{term.title}</h4>
                              {term.isRequired && (
                                <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full">
                                  필수
                                </span>
                              )}
                            </div>
                            <p className="text-gray-500 text-sm">버전 {term.version} • {term.lastUpdated}</p>
                          </div>
                        </div>
                        <motion.button
                          onClick={() => !term.isRequired && handleConsentToggle(term.id)}
                          disabled={term.isRequired || isLoading}
                          whileHover={{ scale: term.isRequired ? 1 : 1.05 }}
                          whileTap={{ scale: term.isRequired ? 1 : 0.95 }}
                          className={`w-12 h-6 rounded-full transition-all duration-200 ${
                            term.isConsented 
                              ? 'bg-gradient-to-r from-blue-600 to-indigo-600' 
                              : 'bg-gray-300'
                          } ${term.isRequired ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <motion.div
                            className="w-5 h-5 bg-white rounded-full shadow-md"
                            animate={{ x: term.isConsented ? 26 : 2 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
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
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {CONSENT_HISTORY.map((history, index) => {
                  const term = terms.find(t => t.id === history.termId);
                  if (!term) return null;

                  return (
                    <motion.div
                      key={`${history.termId}-${history.version}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
                    >
                      <div className="flex items-start space-x-4">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0">
                          <term.icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-gray-900">{term.title}</h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              history.action === 'agreed' ? 'bg-green-100 text-green-700' :
                              history.action === 'updated' ? 'bg-blue-100 text-blue-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {history.action === 'agreed' ? '동의' :
                               history.action === 'updated' ? '업데이트' : '철회'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>버전 {history.version}</span>
                            <span>•</span>
                            <span>{history.consentedAt}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 미리보기 모달 */}
        <AnimatePresence>
          {showPreviewModal && selectedTerm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-50 p-4"
              onClick={() => setShowPreviewModal(false)}
            >
              <motion.div 
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-white rounded-t-3xl w-full max-w-md h-3/4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 h-full flex flex-col">
                  <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6"></div>
                  
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                      <selectedTerm.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{selectedTerm.title}</h3>
                      <p className="text-gray-500 text-sm">버전 {selectedTerm.version}</p>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto">
                    <div className="prose prose-sm max-w-none">
                      <p className="text-gray-700 leading-relaxed mb-4">
                        {selectedTerm.summary}
                      </p>
                      <div className="bg-gray-50 rounded-xl p-4 mb-4">
                        <h4 className="font-semibold text-gray-900 mb-2">주요 내용</h4>
                        <ul className="space-y-2 text-sm text-gray-600">
                          <li>• 서비스 이용 조건 및 제한사항</li>
                          <li>• 사용자의 권리와 의무</li>
                          <li>• 서비스 제공자의 책임 범위</li>
                          <li>• 약관 변경 및 통지 방법</li>
                        </ul>
                      </div>
                      <p className="text-xs text-gray-500">
                        전체 내용을 보시려면 '전체보기' 버튼을 클릭하세요.
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mt-6">
                    <motion.button
                      onClick={() => setShowPreviewModal(false)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold"
                    >
                      닫기
                    </motion.button>
                    <motion.button
                      onClick={() => {
                        setShowPreviewModal(false);
                        handleViewTerm(selectedTerm);
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="py-3 bg-blue-600 text-white rounded-xl font-semibold"
                    >
                      전체보기
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 성공 토스트 */}
        <AnimatePresence>
          {showSuccessToast && (
            <motion.div 
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.9 }}
              className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50"
            >
              <div className="bg-green-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3">
                <HiCheckCircle className="w-6 h-6" />
                <span className="font-semibold">동의 상태가 변경되었습니다</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
} 