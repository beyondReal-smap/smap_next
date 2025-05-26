'use client';
import React, { useState, useRef } from 'react';
import { FiUser, FiPhone, FiCalendar, FiUserCheck, FiLock, FiLogOut, FiTrash2, FiInfo, FiEdit3, FiCamera, FiImage } from 'react-icons/fi';
import { HiCheckCircle, HiExclamationTriangle } from 'react-icons/hi2';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const GENDER_OPTIONS = [
  { value: 'male', label: '남성' },
  { value: 'female', label: '여성' },
  { value: 'other', label: '선택안함' }
];

// 모바일 최적화된 CSS 애니메이션
const mobileAnimations = `
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 페이지 진입 애니메이션
  React.useEffect(() => {
    // 뒤로가기가 아닌 경우에만 애니메이션 활성화
    const skipAnimation = sessionStorage.getItem('skipEnterAnimation') === 'true';
    
    if (skipAnimation) {
      sessionStorage.removeItem('skipEnterAnimation');
      setIsEntering(false);
      setShouldAnimate(false);
    } else {
      setShouldAnimate(true);
      const timer = setTimeout(() => {
        setIsEntering(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, []);

  // 뒤로가기 애니메이션 핸들러
  const handleBackNavigation = () => {
    setIsExiting(true);
    // 뒤로가기임을 표시
    sessionStorage.setItem('skipEnterAnimation', 'true');
    setTimeout(() => {
      router.back();
    }, 300);
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = () => {
    // TODO: 실제 로그아웃 처리 (토큰 삭제 등)
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
      // 모의 저장 처리
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

  return (
    <>
      <style jsx global>{mobileAnimations}</style>
      <div className={`bg-indigo-50 min-h-screen pb-10 ${
        isExiting ? 'animate-slideOutToRight' : 
        (shouldAnimate && isEntering) ? 'animate-slideInFromRight' : ''
      }`}>
        {/* 앱 헤더 - setting 페이지와 동일한 스타일 (고정) */}
        <div className="sticky top-0 z-10 px-4 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center space-x-2">
              <button 
                onClick={handleBackNavigation}
                className="px-2 py-2 hover:bg-gray-100 transition-all duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-indigo-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-lg font-normal text-gray-900">계정설정</span>
            </div>
          </div>
        </div>

        <div className="px-4 pt-6">
          {/* 프로필 섹션 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex flex-col items-center mb-6">
              <div className="relative mb-4">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-indigo-100">
                  <Image
                    src={profileImage}
                    alt="프로필 이미지"
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  onClick={() => setShowImageModal(true)}
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg mobile-button"
                >
                  <FiCamera className="w-4 h-4 text-white" />
                </button>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">{name}</h3>
              <p className="text-indigo-600 text-sm">{phone}</p>
            </div>
          </div>

          {/* 기본 정보 카드 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                <FiUser className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">기본 정보</h3>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">닉네임</label>
                <div className="relative">
                  <input
                    type="text"
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    className="w-full bg-gray-50 rounded-xl px-4 py-4 text-base border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="닉네임을 입력하세요"
                  />
                  <FiEdit3 className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">성명</label>
                <input
                  type="text"
                  value={name}
                  className="w-full bg-gray-100 text-gray-500 rounded-xl px-4 py-4 text-base border border-gray-200 cursor-not-allowed"
                  placeholder="성명을 입력하세요"
                  readOnly
                />
                <p className="text-xs text-gray-500 mt-1">성명은 변경할 수 없습니다</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">전화번호</label>
                <input
                  type="tel"
                  value={phone}
                  className="w-full bg-gray-100 text-gray-500 rounded-xl px-4 py-4 text-base border border-gray-200 cursor-not-allowed"
                  placeholder="전화번호를 입력하세요"
                  readOnly
                />
                <p className="text-xs text-gray-500 mt-1">전화번호는 고객센터를 통해 변경 가능합니다</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">생년월일</label>
                <input
                  type="date"
                  value={birth}
                  className="w-full bg-gray-100 text-gray-500 rounded-xl px-4 py-4 text-base border border-gray-200 cursor-not-allowed"
                  readOnly
                />
                <p className="text-xs text-gray-500 mt-1">생년월일은 변경할 수 없습니다</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">성별</label>
                <select
                  value={gender}
                  onChange={e => setGender(e.target.value)}
                  className="w-full bg-gray-100 text-gray-500 rounded-xl px-4 py-4 text-base border border-gray-200 cursor-not-allowed"
                  disabled
                >
                  {GENDER_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">성별은 변경할 수 없습니다</p>
              </div>
            </div>
            
            <button
              onClick={handleSave}
              disabled={nickname === originalNickname || isSaving}
              className={`w-full mt-6 py-4 rounded-xl font-medium text-base mobile-button flex items-center justify-center space-x-2 ${
                nickname === originalNickname || isSaving
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
              }`}
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>저장 중...</span>
                </>
              ) : (
                <>
                  <HiCheckCircle className="w-5 h-5" />
                  <span>변경사항 저장</span>
                </>
              )}
            </button>
          </div>

          {/* 계정 관리 카드 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                <FiLock className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">계정 관리</h3>
            </div>
            
            <div className="space-y-3">
              <Link href="/setting/account/password">
                <button className="w-full py-4 rounded-xl bg-indigo-600 text-white text-base font-medium mobile-button flex items-center justify-center space-x-2 shadow-lg">
                  <FiLock className="w-5 h-5" />
                  <span>비밀번호 변경</span>
                </button>
              </Link>
              
              <button 
                onClick={handleLogout}
                className="w-full py-4 rounded-xl bg-gray-100 text-gray-700 text-base font-medium mobile-button flex items-center justify-center space-x-2"
              >
                <FiLogOut className="w-5 h-5" />
                <span>로그아웃</span>
              </button>
              
              <button 
                onClick={() => router.push('/setting/account/withdraw')}
                className="w-full py-4 rounded-xl bg-red-50 text-red-600 text-base font-medium mobile-button flex items-center justify-center space-x-2 border border-red-200"
              >
                <FiTrash2 className="w-5 h-5" />
                <span>회원탈퇴</span>
              </button>
            </div>
          </div>
        </div>

        {/* 프로필 이미지 선택 모달 */}
        {showImageModal && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => closeModal(setShowImageModal)}
          >
            <div 
              className={`bg-white rounded-3xl w-full max-w-sm mx-auto modal-safe-area ${
                isClosing ? 'animate-slideOutToBottom' : 'animate-slideInFromBottom'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 pb-8">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiCamera className="w-8 h-8 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">프로필 사진 변경</h3>
                  <p className="text-gray-600">새로운 프로필 사진을 선택해주세요</p>
                </div>
                
                <div className="space-y-3">
                  <button 
                    onClick={() => handleImageSelect('camera')}
                    className="w-full mobile-button flex items-center justify-center p-4 rounded-2xl bg-indigo-600 text-white"
                  >
                    <FiCamera className="w-6 h-6 mr-3" />
                    <span className="font-medium">카메라로 촬영</span>
                  </button>
                  
                  <button 
                    onClick={() => handleImageSelect('gallery')}
                    className="w-full mobile-button flex items-center justify-center p-4 rounded-2xl bg-gray-100 text-gray-700"
                  >
                    <FiImage className="w-6 h-6 mr-3" />
                    <span className="font-medium">갤러리에서 선택</span>
                  </button>
                  
                  <button
                    onClick={() => closeModal(setShowImageModal)}
                    className="w-full mobile-button py-4 text-gray-600 font-medium"
                  >
                    취소
                  </button>
                </div>
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
                  <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <HiExclamationTriangle className="w-8 h-8 text-yellow-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">로그아웃</h3>
                  <p className="text-gray-600">정말 로그아웃 하시겠습니까?</p>
                </div>
                
                <div className="space-y-3">
                  <button
                    onClick={handleConfirmLogout}
                    className="w-full mobile-button py-4 bg-red-500 text-white rounded-2xl font-medium"
                  >
                    로그아웃
                  </button>
                  <button
                    onClick={() => closeModal(setShowLogoutModal)}
                    className="w-full mobile-button py-4 bg-gray-100 text-gray-700 rounded-2xl font-medium"
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