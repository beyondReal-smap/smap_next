'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiCreditCard, 
  FiDownload, 
  FiCalendar,
  FiDollarSign,
  FiCheck,
  FiX,
  FiRefreshCw,
  FiShoppingBag,
  FiStar,
  FiTrendingUp,
  FiPieChart,
  FiBarChart,
  FiSettings,
  FiInfo,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiFilter,
  FiSearch,
  FiMoreVertical,
  FiUsers
} from 'react-icons/fi';
import { HiSparkles, HiCheckCircle } from 'react-icons/hi2';

// 모바일 최적화된 CSS 애니메이션 (초록색 테마)
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

.animate-shimmer {
  animation: shimmer 2s infinite linear;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200px 100%;
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

.purchase-card {
  background: linear-gradient(135deg, #22C55D 0%, #16A34A 100%);
  position: relative;
  overflow: hidden;
}

.purchase-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E") repeat;
  opacity: 0.3;
}

.stats-card {
  background: linear-gradient(135deg, #10B981 0%, #059669 100%);
}

.subscription-card {
  background: linear-gradient(135deg, #34D399 0%, #10B981 100%);
}

.hover-lift {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.menu-item-hover {
  transition: all 0.2s ease;
}

.menu-item-hover:hover {
  background-color: #f0fdf4;
  transform: translateX(2px);
}

.profile-glow {
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
}
`;

// 데이터 타입 정의
interface Purchase {
  id: string;
  type: 'monthly' | 'yearly' | 'premium' | 'addon';
  name: string;
  amount: number;
  date: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  paymentMethod: string;
  receiptUrl?: string;
  description?: string;
}

interface Subscription {
  id: string;
  plan: string;
  status: 'active' | 'expired' | 'cancelled';
  nextBilling: string;
  amount: number;
  features: string[];
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank' | 'paypal';
  name: string;
  last4: string;
  isDefault: boolean;
}

// 모의 데이터
const MOCK_PURCHASES: Purchase[] = [
  {
    id: '1',
    type: 'yearly',
    name: '프리미엄 연간 플랜',
    amount: 120000,
    date: '2024-01-15',
    status: 'completed',
    paymentMethod: '신용카드 (**** 1234)',
    receiptUrl: '/receipts/1.pdf',
    description: '1년간 모든 프리미엄 기능 이용 가능'
  },
  {
    id: '2',
    type: 'monthly',
    name: '베이직 월간 플랜',
    amount: 15000,
    date: '2024-02-01',
    status: 'completed',
    paymentMethod: '카카오페이',
    receiptUrl: '/receipts/2.pdf'
  },
  {
    id: '3',
    type: 'addon',
    name: '추가 저장공간',
    amount: 5000,
    date: '2024-02-10',
    status: 'pending',
    paymentMethod: '신용카드 (**** 5678)'
  }
];

const MOCK_SUBSCRIPTION: Subscription = {
  id: 'sub_1',
  plan: '프리미엄 플랜',
  status: 'active',
  nextBilling: '2024-03-15',
  amount: 15000,
  features: [
    '무제한 그룹 생성',
    '고급 분석 도구',
    '우선 고객 지원',
    '광고 제거',
    '데이터 백업'
  ]
};

const MOCK_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: '1',
    type: 'card',
    name: '신한카드',
    last4: '1234',
    isDefault: true
  },
  {
    id: '2',
    type: 'card',
    name: '국민카드',
    last4: '5678',
    isDefault: false
  }
];

export default function PurchasePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'history' | 'subscription' | 'payment'>('history');
  const [purchases] = useState(MOCK_PURCHASES);
  const [subscription] = useState(MOCK_SUBSCRIPTION);
  const [paymentMethods] = useState(MOCK_PAYMENT_METHODS);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // 뒤로가기 핸들러
  const handleBack = () => {
    router.back();
  };

  // 구매 상태별 필터링
  const filteredPurchases = purchases.filter(purchase => 
    filterStatus === 'all' || purchase.status === filterStatus
  );

  // 구매 상태 아이콘
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <HiCheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending':
        return <FiClock className="w-4 h-4 text-yellow-500" />;
      case 'failed':
        return <FiX className="w-4 h-4 text-red-500" />;
      case 'refunded':
        return <FiRefreshCw className="w-4 h-4 text-blue-500" />;
      default:
        return <FiInfo className="w-4 h-4 text-gray-400" />;
    }
  };

  // 구매 상태 텍스트
  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '결제 완료';
      case 'pending':
        return '결제 대기';
      case 'failed':
        return '결제 실패';
      case 'refunded':
        return '환불 완료';
      default:
        return '알 수 없음';
    }
  };

  // 구매 타입 색상 (초록색 테마)
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'yearly':
        return 'bg-green-100 text-green-700';
      case 'monthly':
        return 'bg-emerald-100 text-emerald-700';
      case 'premium':
        return 'bg-teal-100 text-teal-700';
      case 'addon':
        return 'bg-lime-100 text-lime-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // 영수증 다운로드
  const handleDownloadReceipt = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setShowReceiptModal(true);
  };

  // 구독 취소
  const handleCancelSubscription = async () => {
    setIsLoading(true);
    try {
      // 모의 API 호출
      await new Promise(resolve => setTimeout(resolve, 2000));
      setShowCancelModal(false);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      console.error('구독 취소 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 총 지출 계산
  const totalSpent = purchases
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <>
      <style jsx global>{pageAnimations}</style>
      <div className="schedule-page-container bg-gradient-to-br from-green-50 via-white to-emerald-50">
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
                  <h1 className="text-lg font-bold text-gray-900">구매 관리</h1>
                  <p className="text-xs text-gray-500">결제 내역 및 구독 관리</p>
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
          {/* 지출 요약 카드 - 초록색 테마 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="pb-2"
          >
            <div className="bg-[#22C55D] rounded-3xl p-6 text-white shadow-xl">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                    <FiShoppingBag className="w-8 h-8" />
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h2 className="text-xl font-bold">총 지출 현황</h2>
                    <div className="flex items-center space-x-1 bg-yellow-400/20 px-2 py-1 rounded-full">
                      <HiSparkles className="w-3 h-3 text-yellow-300" />
                      <span className="text-xs font-medium text-yellow-100">{purchases.length}건</span>
                    </div>
                  </div>
                  <p className="text-green-100 text-sm mb-1">₩{totalSpent.toLocaleString()}</p>
                  <p className="text-green-200 text-xs">이번 달까지의 누적 지출</p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-white/20">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <FiTrendingUp className="w-4 h-4 text-green-200" />
                      <span className="text-sm text-green-100">이번 달</span>
                    </div>
                    <p className="text-lg font-bold">₩{(totalSpent * 0.3).toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <FiBarChart className="w-4 h-4 text-green-200" />
                      <span className="text-sm text-green-100">평균</span>
                    </div>
                    <p className="text-lg font-bold">₩{Math.round(totalSpent / purchases.length).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 탭 메뉴 - 초록색 테마 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <div className="bg-white rounded-2xl p-2 shadow-sm border border-gray-100">
              <div className="grid grid-cols-3 gap-1 relative">
                <motion.div
                  className="absolute top-1 bottom-1 bg-green-600 rounded-xl"
                  initial={false}
                  animate={{
                    x: activeTab === 'history' ? '0%' : activeTab === 'subscription' ? '100%' : '200%'
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  style={{ width: 'calc(33.333% - 4px)' }}
                />
                {[
                  { key: 'history', label: '구매내역', icon: FiShoppingBag },
                  { key: 'subscription', label: '구독관리', icon: FiStar },
                  { key: 'payment', label: '결제수단', icon: FiCreditCard }
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
              {activeTab === 'history' && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                >
                  {/* 필터 - 초록색 테마 */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900">필터</h3>
                      <FiFilter className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex space-x-2 overflow-x-auto pb-2">
                      {[
                        { key: 'all', label: '전체' },
                        { key: 'completed', label: '완료' },
                        { key: 'pending', label: '대기' },
                        { key: 'refunded', label: '환불' }
                      ].map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setFilterStatus(key)}
                          className={`px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors mobile-button ${
                            filterStatus === key 
                              ? 'bg-green-600 text-white' 
                              : 'bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 구매 내역 - 초록색 테마 */}
                  {filteredPurchases.length > 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      {filteredPurchases.map((purchase, index) => (
                        <motion.div
                          key={purchase.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className={`p-4 menu-item-hover mobile-button ${index !== filteredPurchases.length - 1 ? 'border-b border-gray-50' : ''}`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                              <FiShoppingBag className="w-5 h-5 text-green-600" />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getTypeColor(purchase.type)}`}>
                                  {purchase.name}
                                </span>
                                <div className="flex items-center space-x-1">
                                  {getStatusIcon(purchase.status)}
                                  <span className="text-xs text-gray-500">{getStatusText(purchase.status)}</span>
                                </div>
                              </div>
                              <h4 className="font-medium text-gray-900 mb-0.5">₩{purchase.amount.toLocaleString()}</h4>
                              <p className="text-xs text-gray-500">{purchase.date} • {purchase.paymentMethod}</p>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              {purchase.receiptUrl && (
                                <motion.button
                                  onClick={() => handleDownloadReceipt(purchase)}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="p-2 bg-green-50 rounded-xl hover:bg-green-100 transition-colors"
                                >
                                  <FiDownload className="w-4 h-4 text-green-600" />
                                </motion.button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiShoppingBag className="w-10 h-10 text-green-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">구매 내역이 없습니다</h3>
                      <p className="text-gray-500">아직 구매한 상품이나 서비스가 없어요</p>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'subscription' && (
                <motion.div
                  key="subscription"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                >
                  {/* 현재 구독 - 초록색 테마 */}
                  <div className="subscription-card rounded-2xl p-6 text-white shadow-xl">
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-bold mb-1">{subscription.plan}</h3>
                          <p className="text-green-100">현재 활성 구독</p>
                        </div>
                        <motion.div
                          className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm"
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <FiStar className="w-6 h-6" />
                        </motion.div>
                      </div>
                      
                      <div className="bg-white/20 rounded-xl p-4 backdrop-blur-sm mb-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-green-100">다음 결제일</span>
                          <span className="font-semibold">{subscription.nextBilling}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-green-100">결제 금액</span>
                          <span className="text-xl font-bold">₩{subscription.amount.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="bg-white/20 py-3 rounded-xl backdrop-blur-sm font-medium mobile-button"
                        >
                          플랜 변경
                        </motion.button>
                        <motion.button
                          onClick={() => setShowCancelModal(true)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="bg-white/20 py-3 rounded-xl backdrop-blur-sm font-medium mobile-button"
                        >
                          구독 취소
                        </motion.button>
                      </div>
                    </div>
                  </div>

                  {/* 구독 혜택 - 초록색 테마 */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">구독 혜택</h3>
                    <div className="space-y-3">
                      {subscription.features.map((feature, index) => (
                        <motion.div
                          key={feature}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center space-x-3"
                        >
                          <HiCheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                          <span className="text-gray-700">{feature}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'payment' && (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                >
                  {/* 등록된 결제 수단 - 초록색 테마 */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {paymentMethods.map((method, index) => (
                      <motion.div
                        key={method.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`p-4 menu-item-hover mobile-button ${index !== paymentMethods.length - 1 ? 'border-b border-gray-50' : ''}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <FiCreditCard className="w-5 h-5 text-green-600" />
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-medium text-gray-900">{method.name}</h4>
                              {method.isDefault && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                                  기본
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">**** **** **** {method.last4}</p>
                          </div>
                          
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="p-2 bg-green-50 rounded-xl hover:bg-green-100 transition-colors"
                          >
                            <FiMoreVertical className="w-4 h-4 text-green-600" />
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* 새 결제 수단 추가 버튼 - 초록색 테마 */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium rounded-2xl shadow-lg mobile-button"
                  >
                    새 결제 수단 추가
                  </motion.button>
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
              <div className="bg-green-500 text-white p-4 rounded-2xl shadow-lg flex items-center space-x-3">
                <HiCheckCircle className="w-6 h-6" />
                <span className="font-medium">구독이 성공적으로 취소되었습니다</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 구독 취소 모달 */}
        {showCancelModal && (
          <div 
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" 
            onClick={() => setShowCancelModal(false)}
          >
            <div 
              className="w-full max-w-md bg-white rounded-t-3xl p-6 pb-8 shadow-2xl animate-slideInFromBottom"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6"></div>
              
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FiAlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">구독 취소</h3>
                <p className="text-gray-600 text-sm">정말로 구독을 취소하시겠습니까?</p>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={handleCancelSubscription}
                  disabled={isLoading}
                  className="w-full py-4 rounded-2xl bg-red-500 text-white font-medium shadow-lg mobile-button disabled:opacity-50"
                >
                  {isLoading ? '처리 중...' : '구독 취소'}
                </button>
                
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="w-full py-4 rounded-2xl bg-gray-100 text-gray-700 font-medium mobile-button"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
} 