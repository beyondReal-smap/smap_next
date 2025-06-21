'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiGift, 
  FiPlus, 
  FiClock, 
  FiCheck, 
  FiX,
  FiCalendar,
  FiTag,
  FiPercent,
  FiDollarSign,
  FiShoppingBag,
  FiInfo,
  FiCopy,
  FiStar
} from 'react-icons/fi';
import { HiSparkles, HiCheckCircle } from 'react-icons/hi2';

// 모바일 최적화된 CSS 애니메이션
const mobileAnimations = `
html, body {
  width: 100%;
  overflow-x: hidden;
  position: relative;
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

@keyframes shimmer {
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
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

.coupon-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
}

.coupon-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E") repeat;
  opacity: 0.3;
}

.coupon-expired {
  background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);
}

.coupon-used {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.shimmer-effect {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200px 100%;
  animation: shimmer 1.5s infinite;
}

.tab-indicator {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
`;

// 쿠폰 타입 정의
interface Coupon {
  id: string;
  title: string;
  description: string;
  discount: string;
  type: 'percentage' | 'fixed' | 'free_shipping';
  code: string;
  expiryDate: string;
  status: 'active' | 'used' | 'expired';
  minAmount?: number;
  category?: string;
}

// 모의 쿠폰 데이터
const MOCK_COUPONS: Coupon[] = [
  {
    id: '1',
    title: '신규 가입 축하',
    description: '첫 구매 시 사용 가능',
    discount: '20%',
    type: 'percentage',
    code: 'WELCOME20',
    expiryDate: '2024-12-31',
    status: 'active',
    minAmount: 10000,
    category: '전체'
  },
  {
    id: '2',
    title: '프리미엄 플랜 할인',
    description: '프리미엄 구독 시 할인',
    discount: '5,000원',
    type: 'fixed',
    code: 'PREMIUM5K',
    expiryDate: '2024-11-30',
    status: 'active',
    minAmount: 20000,
    category: '구독'
  },
  {
    id: '3',
    title: '무료 배송',
    description: '배송비 무료 혜택',
    discount: '배송비',
    type: 'free_shipping',
    code: 'FREESHIP',
    expiryDate: '2024-10-31',
    status: 'used',
    category: '배송'
  },
  {
    id: '4',
    title: '여름 특가',
    description: '여름 시즌 한정 할인',
    discount: '15%',
    type: 'percentage',
    code: 'SUMMER15',
    expiryDate: '2024-08-31',
    status: 'expired',
    minAmount: 15000,
    category: '시즌'
  }
];

export default function CouponPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'available' | 'used' | 'expired'>('available');
  const [showAddModal, setShowAddModal] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 뒤로가기 핸들러
  const handleBack = () => {
    router.back();
  };

  // 탭별 쿠폰 필터링
  const filteredCoupons = MOCK_COUPONS.filter(coupon => coupon.status === activeTab);

  // 쿠폰 코드 입력 핸들러
  const handleCouponCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    if (/[^A-Z0-9]/.test(value)) {
      setError('쿠폰 코드는 영문과 숫자만 입력할 수 있습니다.');
    } else {
      setError('');
    }
    setCouponCode(value.replace(/[^A-Z0-9]/g, ''));
  };

  // 쿠폰 등록
  const handleAddCoupon = async () => {
    if (couponCode.length < 6) {
      setError('쿠폰 코드는 최소 6자리 이상이어야 합니다.');
      return;
    }

    setIsLoading(true);
    try {
      // 모의 API 호출
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setShowAddModal(false);
      setCouponCode('');
      setError('');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      setError('쿠폰 등록에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 쿠폰 코드 복사
  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(''), 2000);
    } catch (error) {
      console.error('복사 실패:', error);
    }
  };

  // 쿠폰 카드 컴포넌트
  const CouponCard = ({ coupon, index }: { coupon: Coupon; index: number }) => {
    const getStatusIcon = () => {
      switch (coupon.status) {
        case 'used':
          return <HiCheckCircle className="w-6 h-6 text-white" />;
        case 'expired':
          return <FiX className="w-6 h-6 text-white" />;
        default:
          return <FiGift className="w-6 h-6 text-white" />;
      }
    };

    const getStatusText = () => {
      switch (coupon.status) {
        case 'used':
          return '사용완료';
        case 'expired':
          return '기간만료';
        default:
          return '사용가능';
      }
    };

    const getDiscountIcon = () => {
      switch (coupon.type) {
        case 'percentage':
          return <FiPercent className="w-5 h-5" />;
        case 'fixed':
          return <FiDollarSign className="w-5 h-5" />;
        case 'free_shipping':
          return <FiShoppingBag className="w-5 h-5" />;
        default:
          return <FiTag className="w-5 h-5" />;
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1, duration: 0.6 }}
        className={`relative rounded-2xl p-6 text-white shadow-xl mb-4 ${
          coupon.status === 'expired' ? 'coupon-expired' : 
          coupon.status === 'used' ? 'coupon-used' : 'coupon-card'
        }`}
      >
        {/* 배경 패턴 */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-12 -translate-x-12"></div>
        </div>

        <div className="relative z-10">
          {/* 헤더 */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                {getDiscountIcon()}
              </div>
              <div>
                <h3 className="text-lg font-bold">{coupon.title}</h3>
                <p className="text-white/80 text-sm">{coupon.description}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon()}
              <span className="text-xs font-medium">{getStatusText()}</span>
            </div>
          </div>

          {/* 할인 정보 */}
          <div className="mb-4">
            <div className="text-3xl font-bold mb-1">{coupon.discount}</div>
            {coupon.type !== 'free_shipping' && (
              <div className="text-white/80 text-sm">
                {coupon.minAmount && `${coupon.minAmount.toLocaleString()}원 이상 구매 시`}
              </div>
            )}
          </div>

          {/* 쿠폰 코드 및 만료일 */}
          <div className="flex items-center justify-between pt-4 border-t border-white/20">
            <div className="flex items-center space-x-2">
              <FiCalendar className="w-4 h-4 text-white/60" />
              <span className="text-white/80 text-sm">{coupon.expiryDate}까지</span>
            </div>
            {coupon.status === 'active' && (
              <motion.button
                onClick={() => handleCopyCode(coupon.code)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center space-x-2 bg-white/20 px-3 py-1.5 rounded-lg backdrop-blur-sm"
              >
                <span className="text-sm font-medium">{coupon.code}</span>
                {copiedCode === coupon.code ? (
                  <HiCheckCircle className="w-4 h-4 text-green-300" />
                ) : (
                  <FiCopy className="w-4 h-4" />
                )}
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <>
      <style jsx global>{mobileAnimations}</style>
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -30 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="bg-gradient-to-br from-pink-50 via-white to-purple-50 min-h-screen pb-10"
      >
        {/* 헤더 */}
        <motion.header 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed top-0 left-0 right-0 z-50 glass-effect header-fixed"
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
                  className="p-2 bg-pink-600 rounded-xl"
                >
                  <FiGift className="w-5 h-5 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">쿠폰함</h1>
                  <p className="text-xs text-gray-500">할인 혜택을 확인하세요</p>
                </div>
              </div>
            </div>
            
            <motion.button
              onClick={() => setShowAddModal(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 bg-pink-600 text-white rounded-xl shadow-lg"
            >
              <FiPlus className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.header>

        {/* 통계 카드 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="px-4 pt-20 pb-6"
        >
          <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-3xl p-6 text-white shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold mb-1">내 쿠폰</h2>
                <p className="text-pink-100">사용 가능한 혜택을 확인하세요</p>
              </div>
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm"
              >
                <HiSparkles className="w-8 h-8" />
              </motion.div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{MOCK_COUPONS.filter(c => c.status === 'active').length}</div>
                <div className="text-xs text-pink-100">사용가능</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{MOCK_COUPONS.filter(c => c.status === 'used').length}</div>
                <div className="text-xs text-pink-100">사용완료</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{MOCK_COUPONS.filter(c => c.status === 'expired').length}</div>
                <div className="text-xs text-pink-100">기간만료</div>
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
                className="absolute top-1 bottom-1 bg-pink-600 rounded-xl tab-indicator"
                initial={false}
                animate={{
                  x: activeTab === 'available' ? '0%' : activeTab === 'used' ? '100%' : '200%'
                }}
                style={{ width: 'calc(33.333% - 4px)' }}
              />
              {[
                { key: 'available', label: '사용가능', icon: FiGift },
                { key: 'used', label: '사용완료', icon: FiCheck },
                { key: 'expired', label: '기간만료', icon: FiClock }
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

        {/* 쿠폰 목록 */}
        <div className="px-4 pb-20">
          <AnimatePresence mode="wait">
            {filteredCoupons.length > 0 ? (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {filteredCoupons.map((coupon, index) => (
                  <CouponCard key={coupon.id} coupon={coupon} index={index} />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key={`empty-${activeTab}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="text-center py-16"
              >
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiGift className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {activeTab === 'available' && '사용 가능한 쿠폰이 없습니다'}
                  {activeTab === 'used' && '사용한 쿠폰이 없습니다'}
                  {activeTab === 'expired' && '만료된 쿠폰이 없습니다'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {activeTab === 'available' && '새로운 쿠폰을 등록해보세요!'}
                  {activeTab === 'used' && '쿠폰을 사용하면 여기에 표시됩니다'}
                  {activeTab === 'expired' && '만료된 쿠폰들이 여기에 표시됩니다'}
                </p>
                {activeTab === 'available' && (
                  <motion.button
                    onClick={() => setShowAddModal(true)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-3 bg-pink-600 text-white rounded-xl font-medium shadow-lg"
                  >
                    쿠폰 등록하기
                  </motion.button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 쿠폰 등록 모달 */}
        <AnimatePresence>
          {showAddModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-50 p-4"
              onClick={() => setShowAddModal(false)}
            >
              <motion.div 
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-white rounded-t-3xl w-full max-w-md p-6 pb-8 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6"></div>
                
                <div className="text-center mb-8">
                  <motion.div 
                    className="w-20 h-20 bg-gradient-to-r from-pink-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <FiPlus className="w-10 h-10 text-white" />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">쿠폰 등록</h3>
                  <p className="text-gray-600">쿠폰 코드를 입력해주세요</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      쿠폰 코드
                    </label>
                    <input
                      ref={inputRef}
                      type="text"
                      value={couponCode}
                      onChange={handleCouponCodeChange}
                      placeholder="쿠폰 코드를 입력하세요"
                      className="w-full bg-gray-50 rounded-xl px-4 py-4 text-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                      maxLength={20}
                    />
                    {error && (
                      <motion.p 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-500 text-sm mt-2 flex items-center"
                      >
                        <FiInfo className="w-4 h-4 mr-1" />
                        {error}
                      </motion.p>
                    )}
                    <p className="text-gray-500 text-sm mt-2">
                      영문 대문자와 숫자만 입력 가능합니다
                    </p>
                  </div>
                  
                  <div className="space-y-3 pt-4">
                    <motion.button
                      onClick={handleAddCoupon}
                      disabled={couponCode.length < 6 || !!error || isLoading}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>등록 중...</span>
                        </>
                      ) : (
                        <>
                          <FiPlus className="w-5 h-5" />
                          <span>쿠폰 등록</span>
                        </>
                      )}
                    </motion.button>
                    
                    <motion.button
                      onClick={() => setShowAddModal(false)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold"
                    >
                      취소
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
              <motion.div 
                className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.3 }}
              >
                <HiCheckCircle className="w-6 h-6" />
                <span className="font-semibold text-lg">쿠폰이 등록되었습니다!</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 복사 완료 토스트 */}
        <AnimatePresence>
          {copiedCode && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50"
            >
              <div className="bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
                <FiCopy className="w-4 h-4" />
                <span className="text-sm">코드가 복사되었습니다</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
} 