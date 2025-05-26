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
  background: rgba(255, 255, 255, 0.9);
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
  const [nickname, setNickname] = useState('길동이');
  const [name, setName] = useState('홍길동');
  const [phone, setPhone] = useState('010-1234-5678');
  const [birth, setBirth] = useState('1990-01-01');
  const [gender, setGender] = useState('male');
  const [originalNickname] = useState('길동이');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [profileImage, setProfileImage] = useState('/images/avatar1.png');
  const [isClosing, setIsClosing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isEntering, setIsEntering] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [activeSection, setActiveSection] = useState('profile');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 컴포넌트 마운트 감지
  useEffect(() => {
    setIsMounted(true);
    document.body.style.overflowX = 'hidden';
    document.documentElement.style.overflowX = 'hidden';
    
    return () => {
      document.body.style.overflowX = '';
      document.documentElement.style.overflowX = '';
    };
  }, []);

  // 페이지 진입 애니메이션
  useEffect(() => {
    if (!isMounted) return;
    
    const skipAnimation = sessionStorage.getItem('skipEnterAnimation') === 'true';
    
    if (skipAnimation) {
      sessionStorage.removeItem('skipEnterAnimation');
      setIsEntering(false);
      setShouldAnimate(false);
    } else {
      setShouldAnimate(true);
      const timer = setTimeout(() => {
        setIsEntering(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isMounted]);

  // 레이아웃 안정화
  useEffect(() => {
    if (isEntering === false) {
      const forceReflow = () => {
        document.body.style.height = 'auto';
        document.body.offsetHeight;
        window.scrollTo(0, 0);
      };
      requestAnimationFrame(forceReflow);
    }
  }, [isEntering]);

  // 뒤로가기 애니메이션 핸들러
  const handleBackNavigation = () => {
    setIsExiting(true);
    sessionStorage.setItem('skipEnterAnimation', 'true');
    setTimeout(() => {
      router.back();
    }, 300);
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = () => {
    router.push('/login');
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
    setIsClosing(true);
    setTimeout(() => {
      setModalState(false);
      setIsClosing(false);
    }, 300);
  };

  const hasChanges = nickname !== originalNickname;

  return (
    <>
      <style jsx global>{mobileAnimations}</style>
      <div className={`bg-gradient-to-br from-indigo-50 via-white to-purple-50 min-h-screen pb-10 ${
        isExiting ? 'animate-slideOutToRight' : 
        (shouldAnimate && isEntering) ? 'animate-slideInFromRight' : ''
      }`} style={{ 
        position: 'relative',
        width: '100%',
        overflow: shouldAnimate && isEntering ? 'hidden' : 'visible'
      }}>
        {/* 앱 헤더 */}
        <div className="sticky top-0 z-10 px-4 bg-white/80 backdrop-blur-md border-b border-gray-200/50">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-3">
              <button 
                onClick={handleBackNavigation}
                className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 mobile-button"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex items-center space-x-2">
                <FiUser className="w-5 h-5 text-indigo-600" />
                <span className="text-lg font-semibold text-gray-900">계정설정</span>
              </div>
            </div>
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-full text-sm font-medium mobile-button disabled:opacity-50 flex items-center space-x-1"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <FiSave className="w-4 h-4" />
                )}
                <span>{isSaving ? '저장중' : '저장'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 프로필 헤더 카드 */}
        <div className="px-4 pt-6 pb-4">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-xl card-hover">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <button
                  onClick={() => setShowImageModal(true)}
                  className="mobile-button group relative"
                >
                  <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white/30 profile-glow">
                    <Image
                      src={profileImage}
                      alt="프로필 이미지"
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-2 shadow-lg group-hover:scale-110 transition-transform">
                    <FiCamera className="w-4 h-4 text-indigo-600" />
                  </div>
                </button>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h2 className="text-xl font-bold">{name}</h2>
                  <div className="flex items-center space-x-1 bg-yellow-400/20 px-2 py-1 rounded-full">
                    <HiSparkles className="w-3 h-3 text-yellow-300" />
                    <span className="text-xs font-medium text-yellow-100">VIP</span>
                  </div>
                </div>
                <p className="text-indigo-100 text-sm mb-1">@{nickname}</p>
                <p className="text-indigo-200 text-xs">{phone}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="px-4 space-y-6 pb-20">
          {/* 기본 정보 섹션 */}
          <div className="animate-fadeIn" style={{ animationDelay: '0.1s' }}>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 px-2 flex items-center">
              <FiUser className="w-5 h-5 mr-2 text-indigo-600" />
              <span>기본 정보</span>
              <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent ml-3"></div>
            </h3>
            
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
              </div>
            </div>
          </div>

          {/* 보안 관리 섹션 */}
          <div className="animate-fadeIn" style={{ animationDelay: '0.2s' }}>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 px-2 flex items-center">
              <FiShield className="w-5 h-5 mr-2 text-red-600" />
              <span>보안 관리</span>
              <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent ml-3"></div>
            </h3>
            
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
          </div>

          {/* 계정 관리 섹션 */}
          <div className="animate-fadeIn" style={{ animationDelay: '0.3s' }}>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 px-2 flex items-center">
              <FiSettings className="w-5 h-5 mr-2 text-gray-600" />
              <span>계정 관리</span>
              <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent ml-3"></div>
            </h3>
            
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
          </div>
        </div>

        {/* 프로필 이미지 변경 모달 */}
        {showImageModal && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-center z-50 p-4"
            onClick={() => closeModal(setShowImageModal)}
          >
            <div 
              className={`bg-white rounded-t-3xl w-full max-w-md p-6 pb-8 shadow-2xl ${
                isClosing ? 'animate-slideOutToBottom' : 'animate-slideInFromBottom'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6"></div>
              
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FiCamera className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">프로필 사진 변경</h3>
                <p className="text-gray-600 text-sm">새로운 프로필 사진을 선택해주세요</p>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={() => handleImageSelect('camera')}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium shadow-lg mobile-button flex items-center justify-center space-x-2"
                >
                  <FiCamera className="w-5 h-5" />
                  <span>카메라로 촬영</span>
                </button>
                
                <button
                  onClick={() => handleImageSelect('gallery')}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium shadow-lg mobile-button flex items-center justify-center space-x-2"
                >
                  <FiImage className="w-5 h-5" />
                  <span>갤러리에서 선택</span>
                </button>
                
                <button
                  onClick={() => closeModal(setShowImageModal)}
                  className="w-full py-4 rounded-2xl bg-gray-100 text-gray-700 font-medium mobile-button"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 로그아웃 확인 모달 */}
        {showLogoutModal && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => closeModal(setShowLogoutModal)}
          >
            <div 
              className={`bg-white rounded-3xl w-full max-w-sm mx-auto modal-safe-area ${
                isClosing ? 'animate-slideOutToBottom' : 'animate-slideInFromBottom'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 pb-8">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiLogOut className="w-8 h-8 text-orange-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">로그아웃</h3>
                  <p className="text-gray-600">정말 로그아웃 하시겠습니까?</p>
                </div>
                
                <div className="space-y-3">
                  <button
                    onClick={handleConfirmLogout}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-medium mobile-button"
                  >
                    로그아웃
                  </button>
                  <button
                    onClick={() => closeModal(setShowLogoutModal)}
                    className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-medium mobile-button"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 성공 토스트 */}
        {showSuccessToast && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-scaleIn">
            <div className="bg-green-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center space-x-2">
              <HiCheckCircle className="w-5 h-5" />
              <span className="font-medium">변경사항이 저장되었습니다</span>
            </div>
          </div>
        )}

        {/* 숨겨진 파일 입력 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </>
  );
} 