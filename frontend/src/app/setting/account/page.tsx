'use client';
import React, { useState, useRef, useEffect } from 'react';
import { 
  FiUser, 
  FiPhone, 
  FiCalendar, 
  FiUserCheck, 
  FiLock, 
  FiLogOut, 
  FiTrash2, 
  FiInfo, 
  FiEdit3, 
  FiCamera, 
  FiImage,
  FiMail,
  FiShield,
  FiSettings,
  FiSave,
  FiKey,
  FiEye,
  FiEyeOff
} from 'react-icons/fi';
import { HiCheckCircle, HiExclamationTriangle, HiSparkles } from 'react-icons/hi2';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

const GENDER_OPTIONS = [
  { value: 'male', label: '남성', icon: '👨' },
  { value: 'female', label: '여성', icon: '👩' },
  { value: 'other', label: '선택안함', icon: '🤷' }
];

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

@keyframes slideInFromRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
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

@keyframes slideOutToRight {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

@keyframes scaleIn {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
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

.animate-slideInFromBottom {
  animation: slideInFromBottom 0.3s ease-out forwards;
}

.animate-slideInFromRight {
  animation: slideInFromRight 0.3s ease-out forwards;
}

.animate-slideOutToBottom {
  animation: slideOutToBottom 0.3s ease-in forwards;
}

.animate-slideOutToRight {
  animation: slideOutToRight 0.3s ease-in forwards;
}

.animate-scaleIn {
  animation: scaleIn 0.2s ease-out forwards;
}

.animate-fadeIn {
  animation: fadeIn 0.4s ease-out forwards;
}

.animate-pulse {
  animation: pulse 2s infinite;
}

.mobile-button {
  transition: all 0.2s ease;
  touch-action: manipulation;
  user-select: none;
}

.mobile-button:active {
  transform: scale(0.98);
}

.modal-safe-area {
  padding-bottom: env(safe-area-inset-bottom);
}

.gradient-bg {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.glass-effect {
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.7);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
}

.profile-glow {
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
}

.input-focus {
  transition: all 0.2s ease;
}

.input-focus:focus {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(99, 102, 241, 0.15);
}

.card-hover {
  transition: all 0.3s ease;
}

.card-hover:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.shimmer {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200px 100%;
  animation: shimmer 1.5s infinite;
}

.initial-hidden {
  opacity: 0;
  transform: translateX(100%);
  position: relative;
  width: 100%;
  overflow: hidden;
}
`;

export default function AccountPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [nickname, setNickname] = useState('길동이');
  const [name, setName] = useState('홍길동');
  const [phone, setPhone] = useState('010-1234-5678');
  const [birth, setBirth] = useState('1990-01-01');
  const [gender, setGender] = useState('male');
  const [originalNickname] = useState('길동이');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [profileImage, setProfileImage] = useState('/images/avatar1.png');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 뒤로가기 핸들러
  const handleBackNavigation = () => {
    router.back();
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = async () => {
    try {
      console.log('[ACCOUNT] 로그아웃 시작');
      
      // AuthContext를 통한 완전한 로그아웃 처리
      await logout();
      
      console.log('[ACCOUNT] 로그아웃 완료, signin으로 이동');
      
      // 로그아웃 후 signin 페이지로 이동
      router.push('/signin');
      
      // 모달 닫기
      setShowLogoutModal(false);
    } catch (error) {
      console.error('[ACCOUNT] 로그아웃 실패:', error);
      // 실패해도 signin으로 이동
      router.push('/signin');
      setShowLogoutModal(false);
    }
  };

  const handleImageSelect = (type: 'camera' | 'gallery') => {
    if (fileInputRef.current) {
      if (type === 'camera') {
        fileInputRef.current.setAttribute('capture', 'environment');
      } else {
        fileInputRef.current.removeAttribute('capture');
      }
      fileInputRef.current.click();
    }
    setShowImageModal(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setProfileImage(ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      console.error('저장 중 오류:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const closeModal = (setModalState: (state: boolean) => void) => {
    setModalState(false);
  };

  const hasChanges = nickname !== originalNickname;

  return (
    <>
      <style jsx global>{mobileAnimations}</style>
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -30 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 min-h-screen pb-10"
        style={{ 
          position: 'relative',
          width: '100%'
        }}
      >
        {/* 개선된 헤더 - setting/page.tsx 스타일 */}
        <motion.header 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed top-0 left-0 right-0 z-50 glass-effect"
        >
          <div className="flex items-center justify-between h-16 px-4">
            <div className="flex items-center space-x-3">
              <motion.button 
                onClick={handleBackNavigation}
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
                  <FiUser className="w-5 h-5 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">계정설정</h1>
                  <p className="text-xs text-gray-500">프로필 및 개인정보 관리</p>
                </div>
              </div>
            </div>
            
            {hasChanges && (
              <motion.button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-full text-sm font-medium disabled:opacity-50 flex items-center space-x-1"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <FiSave className="w-4 h-4" />
                )}
                <span>{isSaving ? '저장중' : '저장'}</span>
              </motion.button>
            )}
          </div>
        </motion.header>

        {/* 프로필 헤더 카드 - 개선된 디자인 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="px-4 pt-20 pb-6"
        >
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-6 text-white shadow-2xl">
            {/* 배경 패턴 */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-12 -translate-x-12"></div>
            </div>
            
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <motion.div 
                    className="relative"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <button
                      onClick={() => setShowImageModal(true)}
                      className="group relative"
                    >
                      <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-white/30 shadow-xl bg-white/10 backdrop-blur-sm">
                        <Image
                          src={profileImage}
                          alt="프로필 이미지"
                          width={96}
                          height={96}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <motion.div 
                        className="absolute -bottom-2 -right-2 bg-white rounded-xl p-2 shadow-lg"
                        whileHover={{ scale: 1.1 }}
                        transition={{ type: "spring", stiffness: 400 }}
                      >
                        <FiCamera className="w-4 h-4 text-indigo-600" />
                      </motion.div>
                    </button>
                  </motion.div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h2 className="text-2xl font-bold">{name}</h2>
                      <motion.div 
                        className="flex items-center space-x-1 bg-gradient-to-r from-yellow-400 to-orange-400 px-3 py-1 rounded-full"
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <HiSparkles className="w-4 h-4 text-white" />
                        <span className="text-xs font-bold text-white">VIP</span>
                      </motion.div>
                    </div>
                    <p className="text-white/90 text-base font-medium mb-1">@{nickname}</p>
                    <p className="text-white/70 text-sm">{phone}</p>
                  </div>
                </div>
              </div>
              
              {/* 통계 정보 */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
                <motion.div 
                  className="text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="text-2xl font-bold">24</div>
                  <div className="text-xs text-white/70">가입일</div>
                </motion.div>
                <motion.div 
                  className="text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="text-2xl font-bold">5</div>
                  <div className="text-xs text-white/70">그룹수</div>
                </motion.div>
                <motion.div 
                  className="text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <div className="text-2xl font-bold">128</div>
                  <div className="text-xs text-white/70">일정수</div>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 메인 컨텐츠 */}
        <div className="px-4 space-y-8 pb-20">
          {/* 기본 정보 섹션 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <div className="flex items-center mb-5 px-2">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                  <FiUser className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">기본 정보</h3>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent ml-4"></div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 card-hover">
              <div className="space-y-6">
                {/* 닉네임 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <FiEdit3 className="w-4 h-4 mr-1 text-indigo-500" />
                    닉네임
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={nickname}
                      onChange={e => setNickname(e.target.value)}
                      className="w-full bg-gray-50 rounded-xl px-4 py-4 text-base border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 input-focus"
                      placeholder="닉네임을 입력하세요"
                    />
                    {hasChanges && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* 성명 (읽기 전용) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <FiUserCheck className="w-4 h-4 mr-1 text-gray-500" />
                    성명
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={name}
                      className="w-full bg-gray-100 text-gray-500 rounded-xl px-4 py-4 text-base border border-gray-200 cursor-not-allowed"
                      readOnly
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <FiLock className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 flex items-center">
                    <FiInfo className="w-3 h-3 mr-1" />
                    성명은 변경할 수 없습니다
                  </p>
                </div>
                
                {/* 전화번호 (읽기 전용) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <FiPhone className="w-4 h-4 mr-1 text-gray-500" />
                    전화번호
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phone}
                      className="w-full bg-gray-100 text-gray-500 rounded-xl px-4 py-4 text-base border border-gray-200 cursor-not-allowed"
                      readOnly
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <FiLock className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 flex items-center">
                    <FiInfo className="w-3 h-3 mr-1" />
                    전화번호는 고객센터를 통해 변경 가능합니다
                  </p>
                </div>
                
                {/* 생년월일 (읽기 전용) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <FiCalendar className="w-4 h-4 mr-1 text-gray-500" />
                    생년월일
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={birth}
                      className="w-full bg-gray-100 text-gray-500 rounded-xl px-4 py-4 text-base border border-gray-200 cursor-not-allowed"
                      readOnly
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <FiLock className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 flex items-center">
                    <FiInfo className="w-3 h-3 mr-1" />
                    생년월일은 변경할 수 없습니다
                  </p>
                </div>
                
                {/* 성별 (읽기 전용) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <FiUser className="w-4 h-4 mr-1 text-gray-500" />
                    성별
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {GENDER_OPTIONS.map(option => (
                      <div
                        key={option.value}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${
                          gender === option.value
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 bg-gray-100'
                        } cursor-not-allowed opacity-60`}
                      >
                        <div className="text-lg mb-1">{option.icon}</div>
                        <div className="text-sm font-medium text-gray-600">{option.label}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2 flex items-center">
                    <FiInfo className="w-3 h-3 mr-1" />
                    성별은 변경할 수 없습니다
                  </p>
                </div>
                
                {/* 저장 버튼 */}
                {hasChanges && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="pt-4 border-t border-gray-100"
                  >
                    <motion.button
                      onClick={handleSave}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center space-x-2"
                    >
                      <FiSave className="w-5 h-5" />
                      <span>변경사항 저장</span>
                    </motion.button>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>

          {/* 보안 관리 섹션 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            <div className="flex items-center mb-5 px-2">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                  <FiShield className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">보안 관리</h3>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent ml-4"></div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden card-hover">
              <Link href="/setting/account/password">
                <div className="flex items-center p-4 hover:bg-gray-50 transition-colors mobile-button">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-4 shadow-sm">
                    <FiKey className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-0.5">비밀번호 변경</h4>
                    <p className="text-xs text-gray-500">계정 보안을 위해 정기적으로 변경하세요</p>
                  </div>
                  <div className="text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            </div>
          </motion.div>

          {/* 계정 관리 섹션 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            <div className="flex items-center mb-5 px-2">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-gray-600 to-gray-700 rounded-xl flex items-center justify-center shadow-lg">
                  <FiSettings className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">계정 관리</h3>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent ml-4"></div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden card-hover">
              <button 
                onClick={handleLogout}
                className="w-full flex items-center p-4 hover:bg-gray-50 transition-colors mobile-button"
              >
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mr-4 shadow-sm">
                  <FiLogOut className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h4 className="font-medium text-gray-900 mb-0.5">로그아웃</h4>
                  <p className="text-xs text-gray-500">현재 기기에서 로그아웃합니다</p>
                </div>
                <div className="text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
              
              <div className="border-t border-gray-100">
                <button 
                  onClick={() => router.push('/setting/account/withdraw')}
                  className="w-full flex items-center p-4 hover:bg-red-50 transition-colors mobile-button"
                >
                  <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 rounded-xl flex items-center justify-center mr-4 shadow-sm">
                    <FiTrash2 className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <h4 className="font-medium text-red-600 mb-0.5">회원탈퇴</h4>
                    <p className="text-xs text-red-500">계정을 영구적으로 삭제합니다</p>
                  </div>
                  <div className="text-red-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* 프로필 이미지 변경 모달 */}
        {showImageModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-50 p-4"
            onClick={() => closeModal(setShowImageModal)}
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
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <FiCamera className="w-10 h-10 text-white" />
                </motion.div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">프로필 사진 변경</h3>
                <p className="text-gray-600">새로운 프로필 사진을 선택해주세요</p>
              </div>
              
              <div className="space-y-4">
                <motion.button
                  onClick={() => handleImageSelect('camera')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold shadow-lg flex items-center justify-center space-x-3"
                >
                  <FiCamera className="w-6 h-6" />
                  <span>카메라로 촬영</span>
                </motion.button>
                
                <motion.button
                  onClick={() => handleImageSelect('gallery')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold shadow-lg flex items-center justify-center space-x-3"
                >
                  <FiImage className="w-6 h-6" />
                  <span>갤러리에서 선택</span>
                </motion.button>
                
                <motion.button
                  onClick={() => closeModal(setShowImageModal)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 rounded-2xl bg-gray-100 text-gray-700 font-semibold"
                >
                  취소
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* 로그아웃 확인 모달 */}
        {showLogoutModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => closeModal(setShowLogoutModal)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-3xl w-full max-w-sm mx-auto modal-safe-area shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8">
                <div className="text-center mb-8">
                  <motion.div 
                    className="w-20 h-20 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
                    animate={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <FiLogOut className="w-10 h-10 text-white" />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">로그아웃</h3>
                  <p className="text-gray-600 text-lg">정말 로그아웃 하시겠습니까?</p>
                </div>
                
                <div className="space-y-4">
                  <motion.button
                    onClick={handleConfirmLogout}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl font-semibold shadow-lg"
                  >
                    로그아웃
                  </motion.button>
                  <motion.button
                    onClick={() => closeModal(setShowLogoutModal)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold"
                  >
                    취소
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* 성공 토스트 */}
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
              <span className="font-semibold text-lg">변경사항이 저장되었습니다</span>
            </motion.div>
          </motion.div>
        )}

        {/* 숨겨진 파일 입력 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </motion.div>
    </>
  );
} 