'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiUserPlus, 
  FiShare2, 
  FiCopy, 
  FiGift,
  FiUsers,
  FiStar,
  FiTrendingUp,
  FiCalendar,
  FiPhone,
  FiMail,
  FiMessageSquare,
  FiInstagram,
  FiTwitter,
  FiFacebook,
  FiInfo,
  FiCheck,
  FiAward,
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

.referral-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
}

.referral-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E") repeat;
  opacity: 0.3;
}

.reward-card {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stats-card {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.share-button {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.share-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}
`;

// 친구 초대 데이터 타입
interface ReferralStats {
  totalInvited: number;
  successfulSignups: number;
  totalRewards: number;
  currentMonthInvites: number;
}

interface Friend {
  id: string;
  name: string;
  phone: string;
  joinDate: string;
  status: 'pending' | 'joined' | 'active';
  reward: number;
}

// 모의 데이터
const MOCK_REFERRAL_STATS: ReferralStats = {
  totalInvited: 12,
  successfulSignups: 8,
  totalRewards: 45000,
  currentMonthInvites: 3
};

const MOCK_FRIENDS: Friend[] = [
  {
    id: '1',
    name: '김민수',
    phone: '010-1234-5678',
    joinDate: '2024-03-15',
    status: 'active',
    reward: 5000
  },
  {
    id: '2',
    name: '이영희',
    phone: '010-2345-6789',
    joinDate: '2024-03-10',
    status: 'joined',
    reward: 5000
  },
  {
    id: '3',
    name: '박철수',
    phone: '010-3456-7890',
    joinDate: '2024-03-05',
    status: 'pending',
    reward: 0
  }
];

const REWARD_TIERS = [
  { friends: 1, reward: '5,000원', bonus: '첫 친구 초대' },
  { friends: 3, reward: '15,000원', bonus: '3명 달성' },
  { friends: 5, reward: '30,000원', bonus: '5명 달성' },
  { friends: 10, reward: '70,000원', bonus: '10명 달성' }
];

export default function ReferrerPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'invite' | 'friends' | 'rewards'>('invite');
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [copiedText, setCopiedText] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 내 추천 코드
  const myReferralCode = 'SMAP2024JIN';
  const myReferralLink = `https://smap.app/invite/${myReferralCode}`;

  // 뒤로가기 핸들러
  const handleBack = () => {
    router.back();
  };

  // 추천인 코드 입력 핸들러
  const handleReferralCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length > 11) return;
    
    if (value.length > 0 && value.length < 10) {
      setError('올바른 휴대전화번호를 입력해주세요.');
    } else {
      setError('');
    }
    setReferralCode(value);
  };

  // 추천인 등록
  const handleSubmitReferral = async () => {
    if (referralCode.length !== 11) {
      setError('올바른 휴대전화번호를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      // 모의 API 호출
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setShowReferralModal(false);
      setReferralCode('');
      setError('');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      setError('추천인 등록에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 텍스트 복사
  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(type);
      setTimeout(() => setCopiedText(''), 2000);
    } catch (error) {
      console.error('복사 실패:', error);
    }
  };

  // 공유하기
  const handleShare = async (platform: string) => {
    const shareText = `SMAP에서 함께해요! 내 추천 코드: ${myReferralCode}\n${myReferralLink}`;
    
    try {
      if (platform === 'native' && navigator.share) {
        await navigator.share({
          title: 'SMAP 친구 초대',
          text: shareText,
          url: myReferralLink
        });
      } else {
        // 플랫폼별 공유 URL
        const shareUrls = {
          kakao: `https://story.kakao.com/share?url=${encodeURIComponent(myReferralLink)}&text=${encodeURIComponent(shareText)}`,
          facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(myReferralLink)}`,
          twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
          instagram: myReferralLink // Instagram은 직접 링크 복사
        };
        
        if (shareUrls[platform as keyof typeof shareUrls]) {
          window.open(shareUrls[platform as keyof typeof shareUrls], '_blank');
        }
      }
      setShowShareModal(false);
    } catch (error) {
      console.error('공유 실패:', error);
    }
  };

  // 친구 상태 아이콘
  const getFriendStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <HiCheckCircle className="w-5 h-5 text-green-500" />;
      case 'joined':
        return <FiCheck className="w-5 h-5 text-blue-500" />;
      default:
        return <FiUsers className="w-5 h-5 text-gray-400" />;
    }
  };

  // 친구 상태 텍스트
  const getFriendStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '활성 사용자';
      case 'joined':
        return '가입 완료';
      default:
        return '초대 대기';
    }
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
                  className="p-2 bg-indigo-600 rounded-xl"
                >
                  <FiUserPlus className="w-5 h-5 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">친구 초대</h1>
                  <p className="text-xs text-gray-500">함께하면 더 즐거워요</p>
                </div>
              </div>
            </div>
            
            <motion.button
              onClick={() => setShowShareModal(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg"
            >
              <FiShare2 className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.header>

        {/* 내 추천 코드 카드 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="px-4 pt-20 pb-6"
        >
          <div className="referral-card rounded-3xl p-6 text-white shadow-xl">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold mb-1">내 추천 코드</h2>
                  <p className="text-indigo-100">친구들과 함께 특별한 혜택을 받아보세요</p>
                </div>
                <motion.div
                  className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm animate-float"
                >
                  <HiSparkles className="w-8 h-8" />
                </motion.div>
              </div>
              
              <div className="bg-white/20 rounded-2xl p-4 backdrop-blur-sm mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-indigo-100 text-sm mb-1">추천 코드</p>
                    <p className="text-2xl font-bold font-mono">{myReferralCode}</p>
                  </div>
                  <motion.button
                    onClick={() => handleCopy(myReferralCode, 'code')}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-3 bg-white/20 rounded-xl backdrop-blur-sm"
                  >
                    {copiedText === 'code' ? (
                      <HiCheckCircle className="w-6 h-6 text-green-300" />
                    ) : (
                      <FiCopy className="w-6 h-6" />
                    )}
                  </motion.button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <motion.button
                  onClick={() => handleCopy(myReferralLink, 'link')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center space-x-2 bg-white/20 py-3 rounded-xl backdrop-blur-sm"
                >
                  <FiCopy className="w-5 h-5" />
                  <span className="font-medium">링크 복사</span>
                </motion.button>
                <motion.button
                  onClick={() => setShowShareModal(true)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center space-x-2 bg-white/20 py-3 rounded-xl backdrop-blur-sm"
                >
                  <FiShare2 className="w-5 h-5" />
                  <span className="font-medium">공유하기</span>
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 통계 카드들 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="px-4 mb-6"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="stats-card rounded-2xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <FiUsers className="w-6 h-6" />
                <span className="text-2xl font-bold">{MOCK_REFERRAL_STATS.successfulSignups}</span>
              </div>
              <p className="text-cyan-100 text-sm">성공한 초대</p>
            </div>
            <div className="reward-card rounded-2xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <FiGift className="w-6 h-6" />
                <span className="text-2xl font-bold">{(MOCK_REFERRAL_STATS.totalRewards / 1000).toFixed(0)}K</span>
              </div>
              <p className="text-pink-100 text-sm">총 적립금</p>
            </div>
          </div>
        </motion.div>

        {/* 탭 메뉴 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="px-4 mb-6"
        >
          <div className="bg-white rounded-2xl p-2 shadow-sm border border-gray-100">
            <div className="grid grid-cols-3 gap-1 relative">
              <motion.div
                className="absolute top-1 bottom-1 bg-indigo-600 rounded-xl"
                initial={false}
                animate={{
                  x: activeTab === 'invite' ? '0%' : activeTab === 'friends' ? '100%' : '200%'
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                style={{ width: 'calc(33.333% - 4px)' }}
              />
              {[
                { key: 'invite', label: '초대하기', icon: FiUserPlus },
                { key: 'friends', label: '친구목록', icon: FiUsers },
                { key: 'rewards', label: '혜택안내', icon: FiGift }
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
            {activeTab === 'invite' && (
              <motion.div
                key="invite"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* 추천인 입력 카드 */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                      <FiPhone className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">추천인이 있나요?</h3>
                      <p className="text-gray-500 text-sm">추천인 코드 입력 시 1개월 무료!</p>
                    </div>
                  </div>
                  <motion.button
                    onClick={() => setShowReferralModal(true)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold shadow-lg"
                  >
                    추천인 코드 입력하기
                  </motion.button>
                </div>

                {/* 초대 방법 안내 */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">친구 초대 방법</h3>
                  <div className="space-y-4">
                    {[
                      { step: 1, title: '추천 코드 공유', desc: '내 추천 코드를 친구에게 공유하세요', icon: FiShare2 },
                      { step: 2, title: '친구 가입', desc: '친구가 추천 코드로 가입하면', icon: FiUserPlus },
                      { step: 3, title: '혜택 지급', desc: '둘 다 특별한 혜택을 받아요!', icon: FiGift }
                    ].map(({ step, title, desc, icon: Icon }) => (
                      <motion.div
                        key={step}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: step * 0.1 }}
                        className="flex items-center space-x-4"
                      >
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-indigo-600" />
                        </div>
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

            {activeTab === 'friends' && (
              <motion.div
                key="friends"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {MOCK_FRIENDS.length > 0 ? (
                  <div className="space-y-4">
                    {MOCK_FRIENDS.map((friend, index) => (
                      <motion.div
                        key={friend.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                              <span className="text-white font-bold">{friend.name[0]}</span>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">{friend.name}</h4>
                              <p className="text-gray-500 text-sm">{friend.phone}</p>
                              <p className="text-gray-400 text-xs">{friend.joinDate} 가입</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center space-x-2 mb-1">
                              {getFriendStatusIcon(friend.status)}
                              <span className="text-sm font-medium text-gray-600">
                                {getFriendStatusText(friend.status)}
                              </span>
                            </div>
                            {friend.reward > 0 && (
                              <p className="text-green-600 text-sm font-semibold">
                                +{friend.reward.toLocaleString()}원
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FiUsers className="w-10 h-10 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">아직 초대한 친구가 없어요</h3>
                    <p className="text-gray-500 mb-6">친구들을 초대하고 함께 혜택을 받아보세요!</p>
                    <motion.button
                      onClick={() => setShowShareModal(true)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium shadow-lg"
                    >
                      친구 초대하기
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'rewards' && (
              <motion.div
                key="rewards"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* 현재 진행 상황 */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">현재 진행 상황</h3>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-gray-600">성공한 초대</span>
                    <span className="text-2xl font-bold text-indigo-600">{MOCK_REFERRAL_STATS.successfulSignups}명</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((MOCK_REFERRAL_STATS.successfulSignups / 10) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-gray-500 text-sm">다음 단계까지 {Math.max(10 - MOCK_REFERRAL_STATS.successfulSignups, 0)}명 남음</p>
                </div>

                {/* 혜택 단계 */}
                <div className="space-y-4">
                  {REWARD_TIERS.map((tier, index) => {
                    const isCompleted = MOCK_REFERRAL_STATS.successfulSignups >= tier.friends;
                    const isCurrent = !isCompleted && MOCK_REFERRAL_STATS.successfulSignups >= (REWARD_TIERS[index - 1]?.friends || 0);
                    
                    return (
                      <motion.div
                        key={tier.friends}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`bg-white rounded-2xl p-4 shadow-sm border-2 ${
                          isCompleted ? 'border-green-200 bg-green-50' :
                          isCurrent ? 'border-indigo-200 bg-indigo-50' :
                          'border-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              isCompleted ? 'bg-green-500' :
                              isCurrent ? 'bg-indigo-500' :
                              'bg-gray-300'
                            }`}>
                              {isCompleted ? (
                                <HiCheckCircle className="w-6 h-6 text-white" />
                              ) : (
                                <FiTarget className="w-6 h-6 text-white" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">{tier.bonus}</h4>
                              <p className="text-gray-500 text-sm">{tier.friends}명 초대 시</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-indigo-600">{tier.reward}</p>
                            {isCompleted && (
                              <p className="text-green-600 text-sm font-medium">완료!</p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 추천인 입력 모달 */}
        <AnimatePresence>
          {showReferralModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-50 p-4"
              onClick={() => setShowReferralModal(false)}
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
                    className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <FiPhone className="w-10 h-10 text-white" />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">추천인 코드 입력</h3>
                  <p className="text-gray-600">추천인의 휴대전화번호를 입력하세요</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      추천인 휴대전화번호
                    </label>
                    <input
                      ref={inputRef}
                      type="tel"
                      inputMode="numeric"
                      value={referralCode}
                      onChange={handleReferralCodeChange}
                      placeholder="01012345678"
                      className="w-full bg-gray-50 rounded-xl px-4 py-4 text-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      maxLength={11}
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
                      하이픈(-) 없이 숫자만 입력해주세요
                    </p>
                  </div>
                  
                  <div className="space-y-3 pt-4">
                    <motion.button
                      onClick={handleSubmitReferral}
                      disabled={referralCode.length !== 11 || !!error || isLoading}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>등록 중...</span>
                        </>
                      ) : (
                        <>
                          <FiUserPlus className="w-5 h-5" />
                          <span>추천인 등록</span>
                        </>
                      )}
                    </motion.button>
                    
                    <motion.button
                      onClick={() => setShowReferralModal(false)}
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

        {/* 공유 모달 */}
        <AnimatePresence>
          {showShareModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-50 p-4"
              onClick={() => setShowShareModal(false)}
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
                    className="w-20 h-20 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <FiShare2 className="w-10 h-10 text-white" />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">친구 초대하기</h3>
                  <p className="text-gray-600">어떤 방법으로 공유하시겠어요?</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {[
                    { platform: 'kakao', label: '카카오톡', icon: FiMessageSquare, color: 'bg-yellow-500' },
                    { platform: 'facebook', label: '페이스북', icon: FiFacebook, color: 'bg-blue-600' },
                    { platform: 'twitter', label: '트위터', icon: FiTwitter, color: 'bg-sky-500' },
                    { platform: 'instagram', label: '인스타그램', icon: FiInstagram, color: 'bg-pink-500' }
                  ].map(({ platform, label, icon: Icon, color }) => (
                    <motion.button
                      key={platform}
                      onClick={() => handleShare(platform)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`${color} text-white p-4 rounded-2xl shadow-lg share-button`}
                    >
                      <Icon className="w-8 h-8 mx-auto mb-2" />
                      <span className="text-sm font-medium">{label}</span>
                    </motion.button>
                  ))}
                </div>

                <motion.button
                  onClick={() => setShowShareModal(false)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold"
                >
                  취소
                </motion.button>
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
                <span className="font-semibold text-lg">추천인이 등록되었습니다!</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 복사 완료 토스트 */}
        <AnimatePresence>
          {copiedText && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50"
            >
              <div className="bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
                <FiCopy className="w-4 h-4" />
                <span className="text-sm">
                  {copiedText === 'code' ? '추천 코드가' : '링크가'} 복사되었습니다
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
} 