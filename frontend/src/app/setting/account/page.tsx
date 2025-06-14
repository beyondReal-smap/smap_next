'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { 
  FiUser, 
  FiMail, 
  FiLock, 
  FiLogOut, 
  FiTrash2, 
  FiCamera, 
  FiEdit3,
  FiChevronRight,
  FiShield
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { useAuth } from '@/contexts/AuthContext';

// 기본 이미지 가져오기 함수
const getDefaultImage = (gender: number | null | undefined, index: number): string => {
  if (gender === 2) { // 여성
    const femaleImages = ['/images/female_1.png', '/images/female_2.png', '/images/female_3.png'];
    return femaleImages[index % femaleImages.length];
  } else { // 남성 또는 미정
    const maleImages = ['/images/male_1.png', '/images/male_2.png', '/images/male_3.png'];
    return maleImages[index % maleImages.length];
  }
};

// 안전한 이미지 URL 가져오기 함수
const getSafeImageUrl = (photoUrl: string | null, gender: number | null | undefined, index: number): string => {
  return photoUrl ?? getDefaultImage(gender, index);
};

// 사용자 레벨에 따른 등급 반환 함수
const getUserLevel = (mtLevel: number | null | undefined): string => {
  if (mtLevel === 5) return 'VIP';
  if (mtLevel === 2) return '일반';
  return '일반'; // 기본값
};

// 사용자 레벨에 따른 플랜 반환 함수
const getUserPlan = (mtLevel: number | null | undefined): string => {
  if (mtLevel === 5) return '프리미엄 플랜';
  if (mtLevel === 2) return '베이직 플랜';
  return '베이직 플랜'; // 기본값
};

// 로그인 타입에 따른 로그인 방법 반환 함수
const getLoginMethod = (mtType: number | null | undefined): { method: string; icon: string } => {
  switch (mtType) {
    case 1:
      return { method: '일반 로그인', icon: '🔐' };
    case 2:
      return { method: '카카오 로그인', icon: '💬' };
    case 3:
      return { method: '애플 로그인', icon: '🍎' };
    case 4:
      return { method: '구글 로그인', icon: '🌐' };
    default:
      return { method: '일반 로그인', icon: '🔐' };
  }
};

// 모바일 최적화된 CSS 애니메이션
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

.menu-item-hover {
  transition: all 0.2s ease;
}

.menu-item-hover:hover {
  background: rgba(99, 102, 241, 0.05);
  transform: translateX(2px);
}

.menu-item-hover:active {
  background: rgba(99, 102, 241, 0.1);
  transform: scale(0.99);
}
`;

export default function AccountSettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [profileImg, setProfileImg] = useState(getSafeImageUrl(user?.mt_file1 || null, user?.mt_gender, user?.mt_idx || 0));
  const [showSheet, setShowSheet] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 사용자 정보 업데이트
  useEffect(() => {
    if (user) {
      setProfileImg(getSafeImageUrl(user.mt_file1 || null, user.mt_gender, user.mt_idx || 0));
    }
  }, [user]);

  // 프로필 데이터
  const loginInfo = getLoginMethod(user?.mt_type);
  const profile = {
    avatar: getSafeImageUrl(user?.mt_file1 || null, user?.mt_gender, user?.mt_idx || 0),
    name: user?.mt_name || user?.mt_nickname || '사용자',
    plan: getUserPlan(user?.mt_level),
    loginMethod: loginInfo.method,
    loginIcon: loginInfo.icon,
    memberSince: user?.mt_wdate ? new Date(user.mt_wdate).getFullYear() + '년 ' + (new Date(user.mt_wdate).getMonth() + 1) + '월' : '2024년 1월',
    level: getUserLevel(user?.mt_level)
  };

  // 계정 관리 메뉴 섹션들
  const menuSections = [
    {
      title: '개인정보 관리',
      items: [
        { 
          label: '프로필 편집', 
          href: '/setting/account/profile', 
          icon: FiUser,
          color: 'bg-blue-500',
          description: '이름, 닉네임, 생년월일, 성별 변경'
        },
        { 
          label: '연락처 정보', 
          href: '/setting/account/contact', 
          icon: FiMail,
          color: 'bg-green-500',
          description: '이메일, 전화번호 관리'
        },
      ]
    },
    {
      title: '보안 설정',
      items: [
        { 
          label: '비밀번호 변경', 
          href: '/setting/account/password', 
          icon: FiLock,
          color: 'bg-orange-500',
          description: '계정 비밀번호 변경'
        },
      ]
    },
    {
      title: '계정 관리',
      items: [
        { 
          label: '로그아웃', 
          href: '#', 
          icon: FiLogOut,
          color: 'bg-yellow-500',
          description: '현재 계정에서 로그아웃',
          onClick: () => setShowLogoutModal(true)
        },
        { 
          label: '회원탈퇴', 
          href: '/setting/account/withdraw', 
          icon: FiTrash2,
          color: 'bg-red-500',
          description: '계정 영구 삭제'
        },
      ]
    }
  ];

  // 파일 선택 핸들러
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setProfileImg(ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
    setShowSheet(false);
  };

  // 카메라/앨범 선택 트리거
  const handleSelect = (mode: 'camera' | 'album') => {
    if (fileInputRef.current) {
      if (mode === 'camera') {
        fileInputRef.current.setAttribute('capture', 'environment');
      } else {
        fileInputRef.current.removeAttribute('capture');
      }
      fileInputRef.current.click();
    }
    setShowSheet(false);
  };

  // 모달 닫기 핸들러
  const closeModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowSheet(false);
      setIsClosing(false);
    }, 300);
  };

  // 로그아웃 처리
  const handleLogout = async () => {
    try {
      setShowLogoutModal(false);
      
      // AuthContext의 logout 호출
      await logout();
      
      console.log('[LOGOUT] 로그아웃 완료, signin으로 이동');
      router.push('/signin');
    } catch (error) {
      console.error('[LOGOUT] 로그아웃 실패:', error);
      // 실패해도 signin으로 이동
      router.push('/signin');
    }
  };

  // 뒤로가기 핸들러
  const handleBack = () => {
    router.back();
  };

  // 메뉴 아이템 클릭 핸들러
  const handleMenuClick = (item: any) => {
    if (item.onClick) {
      item.onClick();
    } else {
      router.push(item.href);
    }
  };

  return (
    <>
      <style jsx global>{pageAnimations}</style>
      <div className="schedule-page-container bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        {/* 헤더 - 위에서 슬라이드 내려오는 애니메이션 */}
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
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6, duration: 0.4 }}
                className="flex items-center space-x-3"
              >
                <div>
                  <h1 className="text-lg font-bold text-gray-900">계정설정</h1>
                  <p className="text-xs text-gray-500">프로필 및 개인정보 관리</p>
                </div>
              </motion.div>
            </div>

          </motion.div>
        </motion.header>

        {/* 스크롤 가능한 메인 컨텐츠 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="schedule-page-content px-4 pt-20 space-y-6 pb-20"
        >
          {/* 계정 정보 카드 - 파란색 테마 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <div className="bg-[#3C82F6] rounded-3xl p-6 text-white shadow-xl">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <button 
                    type="button" 
                    onClick={() => setShowSheet(true)} 
                    className="mobile-button group"
                  >
                    <div className="relative">
                      <Image
                        src={profileImg}
                        alt="프로필 이미지"
                        width={80}
                        height={80}
                        className="rounded-full border-4 border-white/30 bg-white/20 profile-glow"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          const fallbackSrc = getDefaultImage(user?.mt_gender, user?.mt_idx || 0);
                          console.log(`[프로필 이미지 오류] 이미지 로딩 실패, 기본 이미지로 대체:`, fallbackSrc);
                          target.src = fallbackSrc;
                          setProfileImg(fallbackSrc);
                        }}
                      />
                      <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-2 shadow-lg group-hover:scale-110 transition-transform">
                        <FiCamera className="w-4 h-4 text-blue-600" />
                      </div>
                    </div>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h2 className="text-xl font-bold">계정 정보</h2>
                    <div className="flex items-center space-x-1 bg-white/20 px-2 py-1 rounded-full">
                      <HiSparkles className="w-3 h-3 text-blue-100" />
                      <span className="text-xs font-medium text-blue-100">{profile.level}</span>
                    </div>
                  </div>
                  <p className="text-blue-100 text-sm mb-1">{profile.name || '사용자'}</p>
                  <p className="text-blue-200 text-xs">{user?.mt_email || '이메일 정보 없음'}</p>
                  <p className="text-blue-200 text-xs">{user?.mt_id ? user.mt_id.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : '전화번호 정보 없음'}</p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-white/20">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <FiShield className="w-4 h-4 text-blue-200" />
                      <span className="text-sm text-blue-100">가입일</span>
                    </div>
                    <p className="text-lg font-bold">{profile.memberSince}</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <span className="text-sm text-blue-200">{profile.loginIcon}</span>
                      <span className="text-sm text-blue-100">로그인</span>
                    </div>
                    <p className="text-lg font-bold">{profile.loginMethod}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 메뉴 섹션들 */}
          <div className="space-y-6">
            {menuSections.map((section, sectionIdx) => (
              <motion.div 
                key={sectionIdx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + (sectionIdx * 0.1), duration: 0.6 }}
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-3 px-2 flex items-center">
                  <span>{section.title}</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent ml-3"></div>
                </h3>
                
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {section.items.map((item, itemIdx) => {
                    const IconComponent = item.icon;
                    return (
                      <button
                        key={item.label}
                        onClick={() => handleMenuClick(item)}
                        className={`w-full flex items-center px-4 py-4 menu-item-hover mobile-button ${itemIdx !== section.items.length - 1 ? 'border-b border-gray-50' : ''}`}
                      >
                        <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center mr-4 shadow-sm`}>
                          <IconComponent className="w-5 h-5 text-white" />
                        </div>
                        
                        <div className="flex-1 text-left">
                          <h4 className="font-medium text-gray-900 mb-0.5">{item.label}</h4>
                          <p className="text-xs text-gray-500">{item.description}</p>
                        </div>
                        
                        <FiChevronRight className="w-5 h-5 text-gray-400" />
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* 프로필 사진 변경 모달 */}
        {showSheet && (
          <div 
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" 
            onClick={closeModal}
          >
            <div 
              className={`w-full max-w-md bg-white rounded-t-3xl p-6 pb-8 shadow-2xl ${
                isClosing ? 'animate-slideOutToBottom' : 'animate-slideInFromBottom'
              }`}
              onClick={e => e.stopPropagation()}
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
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium shadow-lg mobile-button flex items-center justify-center space-x-2"
                  onClick={() => handleSelect('camera')}
                >
                  <FiCamera className="w-5 h-5" />
                  <span>카메라로 촬영</span>
                </button>
                
                <button
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium shadow-lg mobile-button flex items-center justify-center space-x-2"
                  onClick={() => handleSelect('album')}
                >
                  <FiEdit3 className="w-5 h-5" />
                  <span>앨범에서 선택</span>
                </button>
                
                <button
                  className="w-full py-4 rounded-2xl bg-gray-100 text-gray-700 font-medium mobile-button"
                  onClick={closeModal}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 로그아웃 확인 모달 - 컴팩트 버전 */}
        {showLogoutModal && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowLogoutModal(false)}
          >
            <div 
              className="bg-white rounded-2xl w-full max-w-xs mx-auto animate-slideInFromBottom"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5">
                <div className="text-center mb-4">
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FiLogOut className="w-6 h-6 text-yellow-500" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">로그아웃</h3>
                  <p className="text-sm text-gray-600">
                    정말 로그아웃 하시겠습니까?
                  </p>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowLogoutModal(false)}
                    className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex-1 py-3 bg-yellow-500 text-white rounded-xl text-sm font-medium hover:bg-yellow-600 transition-colors"
                  >
                    로그아웃
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
} 