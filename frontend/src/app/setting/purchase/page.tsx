'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  FiDownload, 
  FiX,
  FiRefreshCw,
  FiShoppingBag,
  FiTrendingUp,
  FiBarChart,
  FiInfo,
  FiClock,
  FiFilter
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



export default function PurchasePage() {
  const router = useRouter();
  const [purchases] = useState(MOCK_PURCHASES);
  const [filterStatus, setFilterStatus] = useState<string>('all');

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
    console.log('영수증 다운로드:', purchase);
    // 실제 다운로드 로직 구현
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



          {/* 구매 내역 컨텐츠 */}
          <div className="space-y-6">
            <div>
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
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
} 