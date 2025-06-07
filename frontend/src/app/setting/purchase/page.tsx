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

.purchase-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.subscription-card {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.hover-lift {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
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
    name: '연간 프리미엄 구독',
    amount: 42000,
    date: '2024-03-15',
    status: 'completed',
    paymentMethod: '신용카드 (**** 1234)',
    receiptUrl: '#',
    description: '1년간 모든 프리미엄 기능 이용'
  },
  {
    id: '2',
    type: 'monthly',
    name: '월간 베이직 구독',
    amount: 4900,
    date: '2024-03-01',
    status: 'completed',
    paymentMethod: '카카오페이',
    receiptUrl: '#'
  },
  {
    id: '3',
    type: 'addon',
    name: '추가 저장공간 (10GB)',
    amount: 2000,
    date: '2024-02-20',
    status: 'completed',
    paymentMethod: '신용카드 (**** 5678)',
    receiptUrl: '#'
  },
  {
    id: '4',
    type: 'monthly',
    name: '월간 베이직 구독',
    amount: 4900,
    date: '2024-02-01',
    status: 'refunded',
    paymentMethod: '카카오페이',
    description: '환불 처리됨'
  }
];

const MOCK_SUBSCRIPTION: Subscription = {
  id: '1',
  plan: '연간 프리미엄',
  status: 'active',
  nextBilling: '2025-03-15',
  amount: 42000,
  features: ['무제한 그룹 생성', '고급 분석', '우선 지원', '광고 제거']
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
        return <HiCheckCircle className="w-5 h-5 text-green-500" />;
      case 'pending':
        return <FiClock className="w-5 h-5 text-yellow-500" />;
      case 'failed':
        return <FiX className="w-5 h-5 text-red-500" />;
      case 'refunded':
        return <FiRefreshCw className="w-5 h-5 text-blue-500" />;
      default:
        return <FiInfo className="w-5 h-5 text-gray-400" />;
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

  // 구매 타입 색상
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'yearly':
        return 'bg-purple-100 text-purple-700';
      case 'monthly':
        return 'bg-blue-100 text-blue-700';
      case 'premium':
        return 'bg-yellow-100 text-yellow-700';
      case 'addon':
        return 'bg-green-100 text-green-700';
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
                  className="p-2 bg-purple-600 rounded-xl"
                >
                  <FiShoppingBag className="w-5 h-5 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">구매 관리</h1>
                  <p className="text-xs text-gray-500">결제 내역 및 구독 관리</p>
                </div>
              </div>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 bg-purple-600 text-white rounded-xl shadow-lg"
            >
              <FiSettings className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.header>

        {/* 지출 요약 카드 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="px-4 pt-20 pb-6"
        >
          <div className="purchase-card rounded-3xl p-6 text-white shadow-xl">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold mb-1">총 지출 현황</h2>
                  <p className="text-purple-100">이번 달까지의 누적 지출</p>
                </div>
                <motion.div
                  className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm"
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                >
                  <FiPieChart className="w-8 h-8" />
                </motion.div>
              </div>
              
              <div className="bg-white/20 rounded-2xl p-4 backdrop-blur-sm mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm mb-1">총 지출액</p>
                    <p className="text-3xl font-bold">₩{totalSpent.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-purple-100 text-sm mb-1">구매 건수</p>
                    <p className="text-2xl font-bold">{purchases.length}건</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/20 rounded-xl p-3 backdrop-blur-sm">
                  <div className="flex items-center space-x-2 mb-1">
                    <FiTrendingUp className="w-4 h-4" />
                    <span className="text-sm">이번 달</span>
                  </div>
                  <p className="text-lg font-bold">₩{(totalSpent * 0.3).toLocaleString()}</p>
                </div>
                                 <div className="bg-white/20 rounded-xl p-3 backdrop-blur-sm">
                   <div className="flex items-center space-x-2 mb-1">
                     <FiBarChart className="w-4 h-4" />
                     <span className="text-sm">평균</span>
                   </div>
                   <p className="text-lg font-bold">₩{Math.round(totalSpent / purchases.length).toLocaleString()}</p>
                 </div>
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
                className="absolute top-1 bottom-1 bg-purple-600 rounded-xl"
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
            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* 필터 */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">필터</h3>
                    <FiFilter className="w-5 h-5 text-gray-400" />
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
                        className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                          filterStatus === key 
                            ? 'bg-purple-600 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 구매 내역 */}
                {filteredPurchases.length > 0 ? (
                  <div className="space-y-4">
                    {filteredPurchases.map((purchase, index) => (
                      <motion.div
                        key={purchase.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover-lift"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(purchase.type)}`}>
                                {purchase.name}
                              </span>
                              <div className="flex items-center space-x-1">
                                {getStatusIcon(purchase.status)}
                                <span className="text-xs text-gray-500">{getStatusText(purchase.status)}</span>
                              </div>
                            </div>
                            <p className="text-2xl font-bold text-gray-900 mb-1">
                              ₩{purchase.amount.toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-500 mb-1">{purchase.paymentMethod}</p>
                            <p className="text-xs text-gray-400">{purchase.date}</p>
                            {purchase.description && (
                              <p className="text-sm text-gray-600 mt-2">{purchase.description}</p>
                            )}
                          </div>
                          <div className="flex flex-col space-y-2">
                            {purchase.receiptUrl && (
                              <motion.button
                                onClick={() => handleDownloadReceipt(purchase)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                              >
                                <FiDownload className="w-4 h-4 text-gray-600" />
                              </motion.button>
                            )}
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                            >
                              <FiMoreVertical className="w-4 h-4 text-gray-600" />
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FiShoppingBag className="w-10 h-10 text-gray-400" />
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
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* 현재 구독 */}
                <div className="subscription-card rounded-2xl p-6 text-white shadow-xl">
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold mb-1">{subscription.plan}</h3>
                        <p className="text-pink-100">현재 활성 구독</p>
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
                        <span className="text-pink-100">다음 결제일</span>
                        <span className="font-semibold">{subscription.nextBilling}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-pink-100">결제 금액</span>
                        <span className="text-xl font-bold">₩{subscription.amount.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <p className="text-pink-100 text-sm font-medium">포함된 기능</p>
                      {subscription.features.map((feature, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <HiCheckCircle className="w-4 h-4 text-green-300" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <motion.button
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
                        구독 취소
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* 구독 혜택 */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">구독 혜택</h3>
                  <div className="grid grid-cols-2 gap-4">
                                         {[
                       { icon: FiUsers, title: '무제한 그룹', desc: '그룹 생성 제한 없음' },
                       { icon: FiBarChart, title: '고급 분석', desc: '상세한 통계 제공' },
                       { icon: FiStar, title: '우선 지원', desc: '24시간 고객 지원' },
                       { icon: FiX, title: '광고 제거', desc: '모든 광고 차단' }
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
              </motion.div>
            )}

            {activeTab === 'payment' && (
              <motion.div
                key="payment"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* 등록된 결제 수단 */}
                <div className="space-y-4">
                  {paymentMethods.map((method, index) => (
                    <motion.div
                      key={method.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover-lift"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                            <FiCreditCard className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{method.name}</h4>
                            <p className="text-gray-500 text-sm">**** **** **** {method.last4}</p>
                            {method.isDefault && (
                              <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full mt-1">
                                기본 결제수단
                              </span>
                            )}
                          </div>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                        >
                          <FiSettings className="w-4 h-4 text-gray-600" />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* 새 결제수단 추가 */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 hover:border-purple-300 hover:text-purple-600 transition-colors"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <FiCreditCard className="w-5 h-5" />
                    <span className="font-medium">새 결제수단 추가</span>
                  </div>
                </motion.button>

                {/* 결제 보안 */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">결제 보안</h3>
                  <div className="space-y-4">
                    {[
                      { title: 'SSL 암호화', desc: '모든 결제 정보는 SSL로 암호화됩니다', icon: FiCheckCircle, color: 'text-green-500' },
                      { title: '2단계 인증', desc: '결제 시 추가 인증을 요구합니다', icon: FiAlertCircle, color: 'text-yellow-500' },
                      { title: '자동 결제', desc: '구독 갱신 시 자동으로 결제됩니다', icon: FiRefreshCw, color: 'text-blue-500' }
                    ].map(({ title, desc, icon: Icon, color }, index) => (
                      <motion.div
                        key={title}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center space-x-3"
                      >
                        <Icon className={`w-5 h-5 ${color}`} />
                        <div>
                          <h4 className="font-semibold text-gray-900">{title}</h4>
                          <p className="text-gray-500 text-sm">{desc}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 구독 취소 모달 */}
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
                  <p className="text-gray-600">취소하면 다음 결제일부터 서비스가 중단됩니다</p>
                </div>
                
                <div className="space-y-3">
                  <motion.button
                    onClick={handleCancelSubscription}
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
                <span className="font-semibold">구독이 취소되었습니다</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
} 