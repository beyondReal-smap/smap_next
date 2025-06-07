'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiStar, 
  FiCheck, 
  FiX,
  FiAward,
  FiShield,
  FiZap,
  FiUsers,
  FiBarChart,
  FiCalendar,
  FiCreditCard,
  FiSettings,
  FiInfo,
  FiAlertCircle,
  FiTrendingUp,
  FiGift,
  FiRefreshCw,
  FiDownload,
  FiHeart,
  FiTarget
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

@keyframes shimmer {
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
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

.animate-shimmer {
  animation: shimmer 2s infinite linear;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200px 100%;
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

.premium-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
}

.premium-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E") repeat;
  opacity: 0.3;
}

.basic-card {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.pro-card {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.enterprise-card {
  background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
}

.plan-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.plan-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.plan-card.selected {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(102, 126, 234, 0.3);
  border: 2px solid #667eea;
}

.feature-check {
  transition: all 0.2s ease;
}

.feature-check:hover {
  transform: scale(1.1);
}
`;

// 데이터 타입 정의
interface Plan {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  period: 'month' | 'year';
  popular?: boolean;
  features: string[];
  limits: {
    groups: number | 'unlimited';
    storage: string;
    routes: number | 'unlimited';
    history: string;
    support: string;
  };
  color: string;
}

interface CurrentSubscription {
  plan: string;
  status: 'active' | 'expired' | 'trial';
  nextBilling: string;
  daysLeft: number;
  autoRenew: boolean;
}

// 모의 데이터
const SUBSCRIPTION_PLANS: Plan[] = [
  {
    id: 'basic',
    name: '베이직',
    price: 0,
    period: 'month',
    features: ['기본 지도 기능', '3개 그룹 관리', '1주일 히스토리', '커뮤니티 지원'],
    limits: {
      groups: 3,
      storage: '1GB',
      routes: 5,
      history: '1주일',
      support: '커뮤니티'
    },
    color: 'basic-card'
  },
  {
    id: 'monthly',
    name: '프리미엄 월간',
    price: 4900,
    period: 'month',
    features: ['모든 프리미엄 기능', '무제한 그룹', '2주 히스토리', '우선 지원', '광고 제거'],
    limits: {
      groups: 'unlimited',
      storage: '10GB',
      routes: 'unlimited',
      history: '2주',
      support: '우선 지원'
    },
    color: 'pro-card'
  },
  {
    id: 'yearly',
    name: '프리미엄 연간',
    price: 42000,
    originalPrice: 58800,
    period: 'year',
    popular: true,
    features: ['모든 프리미엄 기능', '무제한 그룹', '1개월 히스토리', '24/7 지원', '광고 제거', '고급 분석'],
    limits: {
      groups: 'unlimited',
      storage: '50GB',
      routes: 'unlimited',
      history: '1개월',
      support: '24/7 지원'
    },
    color: 'premium-card'
  }
];

const CURRENT_SUBSCRIPTION: CurrentSubscription = {
  plan: '프리미엄 연간',
  status: 'active',
  nextBilling: '2025-03-15',
  daysLeft: 127,
  autoRenew: true
};

export default function SubscriptionPage() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<string>('yearly');
  const [activeTab, setActiveTab] = useState<'plans' | 'current' | 'benefits'>('current');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // 뒤로가기 핸들러
  const handleBack = () => {
    router.back();
  };

  // 플랜 선택
  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
  };

  // 구독 업그레이드
  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setShowUpgradeModal(false);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      console.error('업그레이드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 구독 취소
  const handleCancel = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setShowCancelModal(false);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      console.error('취소 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 할인율 계산
  const getDiscountPercentage = (plan: Plan) => {
    if (!plan.originalPrice) return 0;
    return Math.round(((plan.originalPrice - plan.price) / plan.originalPrice) * 100);
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
                                     className="p-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl"
                 >
                   <FiAward className="w-5 h-5 text-white" />
                 </motion.div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">구독 관리</h1>
                  <p className="text-xs text-gray-500">프리미엄 기능을 경험하세요</p>
                </div>
              </div>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl shadow-lg"
            >
              <FiSettings className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.header>

        {/* 현재 구독 상태 카드 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="px-4 pt-20 pb-6"
        >
          <div className="premium-card rounded-3xl p-6 text-white shadow-xl">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                                 <div>
                   <div className="flex items-center space-x-2 mb-2">
                     <FiAward className="w-6 h-6" />
                     <h2 className="text-2xl font-bold">{CURRENT_SUBSCRIPTION.plan}</h2>
                   </div>
                   <p className="text-purple-100">현재 활성 구독</p>
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
                    <p className="text-purple-100 text-sm mb-1">다음 결제일</p>
                    <p className="text-lg font-bold">{CURRENT_SUBSCRIPTION.nextBilling}</p>
                  </div>
                  <div>
                    <p className="text-purple-100 text-sm mb-1">남은 기간</p>
                    <p className="text-lg font-bold">{CURRENT_SUBSCRIPTION.daysLeft}일</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  onClick={() => setShowUpgradeModal(true)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-white/20 py-3 rounded-xl backdrop-blur-sm font-medium"
                >
                  플랜 변경
                </motion.button>
                <motion.button
                  onClick={() => setShowCancelModal(true)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-white/20 py-3 rounded-xl backdrop-blur-sm font-medium"
                >
                  구독 관리
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
                className="absolute top-1 bottom-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl"
                initial={false}
                animate={{
                  x: activeTab === 'current' ? '0%' : activeTab === 'plans' ? '100%' : '200%'
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                style={{ width: 'calc(33.333% - 4px)' }}
              />
              {[
                { key: 'current', label: '현재구독', icon: FiStar },
                { key: 'plans', label: '플랜비교', icon: FiTarget },
                { key: 'benefits', label: '혜택안내', icon: FiGift }
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
            {activeTab === 'current' && (
              <motion.div
                key="current"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* 구독 상세 정보 */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">구독 상세</h3>
                  <div className="space-y-4">
                                         {[
                       { label: '플랜', value: CURRENT_SUBSCRIPTION.plan, icon: FiAward },
                       { label: '상태', value: '활성', icon: FiCheck },
                       { label: '다음 결제', value: CURRENT_SUBSCRIPTION.nextBilling, icon: FiCalendar },
                       { label: '자동 갱신', value: CURRENT_SUBSCRIPTION.autoRenew ? '활성화' : '비활성화', icon: FiRefreshCw }
                     ].map(({ label, value, icon: Icon }, index) => (
                      <motion.div
                        key={label}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                            <Icon className="w-5 h-5 text-purple-600" />
                          </div>
                          <span className="font-medium text-gray-900">{label}</span>
                        </div>
                        <span className="text-gray-600">{value}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* 사용량 통계 */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">이번 달 사용량</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: '그룹 생성', value: '8개', max: '무제한', progress: 0 },
                      { label: '경로 검색', value: '247회', max: '무제한', progress: 0 },
                      { label: '저장 공간', value: '2.3GB', max: '50GB', progress: 4.6 },
                      { label: '히스토리', value: '28일', max: '30일', progress: 93.3 }
                    ].map(({ label, value, max, progress }, index) => (
                      <motion.div
                        key={label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-gray-50 rounded-xl p-4"
                      >
                        <h4 className="font-semibold text-gray-900 mb-1">{label}</h4>
                        <p className="text-2xl font-bold text-purple-600 mb-1">{value}</p>
                        <p className="text-xs text-gray-500 mb-2">최대 {max}</p>
                        {progress > 0 && (
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <motion.div 
                              className="bg-purple-600 h-2 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              transition={{ delay: 0.5, duration: 1 }}
                            />
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'plans' && (
              <motion.div
                key="plans"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* 플랜 카드들 */}
                <div className="space-y-4">
                  {SUBSCRIPTION_PLANS.map((plan, index) => (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => handleSelectPlan(plan.id)}
                      className={`plan-card bg-white rounded-2xl p-6 shadow-sm border-2 ${
                        selectedPlan === plan.id ? 'border-purple-500 selected' : 'border-gray-100'
                      } relative`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <span className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
                            가장 인기
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                          <div className="flex items-end space-x-2">
                            {plan.originalPrice && (
                              <span className="text-gray-400 line-through text-sm">
                                ₩{plan.originalPrice.toLocaleString()}
                              </span>
                            )}
                            <span className="text-3xl font-bold text-gray-900">
                              {plan.price === 0 ? '무료' : `₩${plan.price.toLocaleString()}`}
                            </span>
                            <span className="text-gray-500">
                              / {plan.period === 'month' ? '월' : '년'}
                            </span>
                          </div>
                          {plan.originalPrice && (
                            <span className="inline-block bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full mt-2">
                              {getDiscountPercentage(plan)}% 할인
                            </span>
                          )}
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          selectedPlan === plan.id 
                            ? 'border-purple-500 bg-purple-500' 
                            : 'border-gray-300'
                        }`}>
                          {selectedPlan === plan.id && (
                            <FiCheck className="w-4 h-4 text-white" />
                          )}
                        </div>
                      </div>

                      <div className="space-y-3 mb-6">
                        {plan.features.map((feature, featureIndex) => (
                          <div key={featureIndex} className="flex items-center space-x-3">
                            <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center feature-check">
                              <FiCheck className="w-3 h-3 text-green-600" />
                            </div>
                            <span className="text-gray-700">{feature}</span>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">그룹</span>
                          <p className="font-semibold">
                            {plan.limits.groups === 'unlimited' ? '무제한' : `${plan.limits.groups}개`}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">저장공간</span>
                          <p className="font-semibold">{plan.limits.storage}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">경로검색</span>
                          <p className="font-semibold">
                            {plan.limits.routes === 'unlimited' ? '무제한' : `${plan.limits.routes}회/일`}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">히스토리</span>
                          <p className="font-semibold">{plan.limits.history}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* 업그레이드 버튼 */}
                <motion.button
                  onClick={() => setShowUpgradeModal(true)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold shadow-lg"
                >
                  선택한 플랜으로 업그레이드
                </motion.button>
              </motion.div>
            )}

            {activeTab === 'benefits' && (
              <motion.div
                key="benefits"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* 프리미엄 혜택 */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">프리미엄 혜택</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { icon: FiUsers, title: '무제한 그룹', desc: '그룹 생성 제한 없음' },
                      { icon: FiBarChart, title: '고급 분석', desc: '상세한 통계 제공' },
                      { icon: FiShield, title: '우선 지원', desc: '24시간 고객 지원' },
                      { icon: FiX, title: '광고 제거', desc: '모든 광고 차단' },
                      { icon: FiZap, title: '빠른 속도', desc: '최적화된 성능' },
                      { icon: FiHeart, title: '독점 기능', desc: '프리미엄 전용 기능' }
                    ].map(({ icon: Icon, title, desc }, index) => (
                      <motion.div
                        key={title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="text-center p-4 bg-gray-50 rounded-xl"
                      >
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                          <Icon className="w-6 h-6 text-purple-600" />
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-1">{title}</h4>
                        <p className="text-xs text-gray-500">{desc}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* 비교표 */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">기능 비교</h3>
                  <div className="space-y-4">
                    {[
                      { feature: '그룹 관리', basic: '3개', premium: '무제한' },
                      { feature: '경로 검색', basic: '5회/일', premium: '무제한' },
                      { feature: '히스토리', basic: '1주일', premium: '1개월' },
                      { feature: '저장 공간', basic: '1GB', premium: '50GB' },
                      { feature: '고객 지원', basic: '커뮤니티', premium: '24/7 지원' },
                      { feature: '광고', basic: '있음', premium: '없음' }
                    ].map(({ feature, basic, premium }, index) => (
                      <motion.div
                        key={feature}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0"
                      >
                        <span className="font-medium text-gray-900">{feature}</span>
                        <div className="flex space-x-8">
                          <span className="text-gray-500 text-sm w-16 text-center">{basic}</span>
                          <span className="text-purple-600 font-semibold text-sm w-16 text-center">{premium}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 업그레이드 모달 */}
        <AnimatePresence>
          {showUpgradeModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowUpgradeModal(false)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center mb-6">
                  <motion.div 
                    className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    animate={{ scale: [1, 1.1, 1] }}
                                         transition={{ duration: 2, repeat: Infinity }}
                   >
                     <FiAward className="w-10 h-10 text-white" />
                   </motion.div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">플랜을 업그레이드하시겠어요?</h3>
                  <p className="text-gray-600">더 많은 기능을 경험해보세요</p>
                </div>
                
                <div className="space-y-3">
                  <motion.button
                    onClick={handleUpgrade}
                    disabled={isLoading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>업그레이드 중...</span>
                      </>
                    ) : (
                      <span>업그레이드</span>
                    )}
                  </motion.button>
                  
                  <motion.button
                    onClick={() => setShowUpgradeModal(false)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold"
                  >
                    나중에
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 취소 모달 */}
        <AnimatePresence>
          {showCancelModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowCancelModal(false)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center mb-6">
                  <motion.div 
                    className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    animate={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.5 }}
                  >
                    <FiAlertCircle className="w-10 h-10 text-red-500" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">구독을 취소하시겠어요?</h3>
                  <p className="text-gray-600">취소하면 프리미엄 기능을 사용할 수 없습니다</p>
                </div>
                
                <div className="space-y-3">
                  <motion.button
                    onClick={handleCancel}
                    disabled={isLoading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 bg-red-500 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>취소 중...</span>
                      </>
                    ) : (
                      <span>구독 취소</span>
                    )}
                  </motion.button>
                  
                  <motion.button
                    onClick={() => setShowCancelModal(false)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold"
                  >
                    계속 이용하기
                  </motion.button>
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
                <span className="font-semibold">성공적으로 처리되었습니다</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
} 