'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { 
  FiUser, 
  FiSettings, 
  FiHelpCircle, 
  FiFileText, 
  FiMessageSquare, 
  FiBell, 
  FiGift, 
  FiUserPlus, 
  FiShoppingBag, 
  FiCreditCard,
  FiCamera,
  FiEdit3,
  FiChevronRight,
  FiStar,
  FiShield,
  FiBook,
  FiMail,
  FiDollarSign
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';

// 모바일 최적화된 CSS 애니메이션
const pageAnimations = `
html, body {
  width: 100%;
  overflow-x: hidden;
  position: relative;
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
  animation: slideInFromRight 0.3s ease-out forwards;
}

.animate-slideOutToRight {
  animation: slideOutToRight 0.3s ease-in forwards;
}

.animate-slideInFromBottom {
  animation: slideInFromBottom 0.3s ease-out forwards;
}

.animate-slideOutToBottom {
  animation: slideOutToBottom 0.3s ease-in forwards;
}

.animate-fadeIn {
  animation: fadeIn 0.4s ease-out forwards;
}

.animate-scaleIn {
  animation: scaleIn 0.2s ease-out forwards;
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

.gradient-bg {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.glass-effect {
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.9);
}

.menu-item-hover {
  transition: all 0.2s ease;
}

.menu-item-hover:hover {
  transform: translateX(4px);
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.profile-glow {
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
}
`;

// 설정 스키마 정의
const settingsSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요.'),
  nickname: z.string().min(1, '닉네임을 입력해주세요.'),
  gender: z.enum(['male', 'female', 'other']),
  email: z.string().email('유효한 이메일 주소를 입력해주세요.'),
  phone: z.string().regex(/^01([0|1|6|7|8|9])-?([0-9]{3,4})-?([0-9]{4})$/, '유효한 전화번호를 입력해주세요.')
});

type SettingsFormData = z.infer<typeof settingsSchema>;

// 모의 데이터
const MOCK_USER_SETTINGS = {
  name: '홍길동',
  nickname: '길동이',
  gender: 'male' as const,
  email: 'user@example.com',
  phone: '010-1234-5678'
};

// 성별 옵션
const GENDER_OPTIONS = [
  { value: 'male', label: '남성' },
  { value: 'female', label: '여성' },
  { value: 'other', label: '선택안함' }
];

export default function SettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  const { control, handleSubmit, reset, formState: { errors, isDirty } } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: MOCK_USER_SETTINGS
  });

  // 컴포넌트 마운트 감지
  useEffect(() => {
    setIsMounted(true);
    // 초기 레이아웃 안정화
    document.body.style.overflowX = 'hidden';
    document.documentElement.style.overflowX = 'hidden';
    
    return () => {
      // 클린업
      document.body.style.overflowX = '';
      document.documentElement.style.overflowX = '';
    };
  }, []);

  // 페이지 로드 애니메이션 트리거
  useEffect(() => {
    if (!isMounted) return;
    
    // 뒤로가기가 아닌 경우에만 애니메이션 활성화
    const skipAnimation = sessionStorage.getItem('skipEnterAnimation') === 'true';
    
    if (skipAnimation) {
      sessionStorage.removeItem('skipEnterAnimation');
      setIsPageLoaded(true);
      setShouldAnimate(false);
    } else {
      setShouldAnimate(true);
      // 레이아웃 안정화를 위해 약간의 지연 추가
      const timer = setTimeout(() => {
        setIsPageLoaded(true);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isMounted]);

  // 레이아웃 안정화를 위한 추가 useEffect
  useEffect(() => {
    // 페이지 로드 완료 후 레이아웃 강제 재계산
    if (isPageLoaded) {
      const forceReflow = () => {
        document.body.style.height = 'auto';
        // 강제 리플로우 트리거
        document.body.offsetHeight;
        // 스크롤 위치 초기화
        window.scrollTo(0, 0);
      };
      
      // 다음 프레임에서 실행
      requestAnimationFrame(forceReflow);
    }
  }, [isPageLoaded]);

  // 사용자 설정 가져오기
  useEffect(() => {
    // 모의 데이터 로드
    reset(MOCK_USER_SETTINGS);
  }, [reset]);

  // 설정 저장
  const onSubmit = async (data: SettingsFormData) => {
    setIsLoading(true);
    setSaveSuccess(false);
    
    try {
      // 모의 저장 (API 연동 전 테스트용)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('설정 저장 중 오류가 발생했습니다.', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 프로필 mock 데이터
  const profile = {
    avatar: '/images/avatar1.png',
    name: 'jin(진)',
    plan: '프리미엄 플랜',
    phone: '010-2956-5435',
    memberSince: '2024년 1월',
    level: 'VIP'
  };

  // 개선된 메뉴 데이터 (아이콘과 색상 포함)
  const menuSections = [
    {
      title: '계정 관리',
      items: [
        { 
          label: '계정설정', 
          href: '/setting/account', 
          icon: FiUser,
          color: 'bg-blue-500',
          description: '프로필 및 개인정보 관리'
        },
        { 
          label: '보안 설정', 
          href: '/setting/security', 
          icon: FiShield,
          color: 'bg-green-500',
          description: '비밀번호 및 보안 관리'
        },
      ]
    },
    {
      title: '고객 지원',
      items: [
        { 
          label: '사용 가이드', 
          href: '/setting/manual', 
          icon: FiBook,
          color: 'bg-purple-500',
          description: '앱 사용법 및 도움말'
        },
        { 
          label: '1:1 문의', 
          href: '/setting/inquiry', 
          icon: FiMail,
          color: 'bg-orange-500',
          description: '궁금한 점을 문의하세요'
        },
        { 
          label: '공지사항', 
          href: '/setting/notice', 
          icon: FiBell,
          color: 'bg-red-500',
          description: '최신 소식 및 업데이트'
        },
      ]
    },
    {
      title: '혜택 & 결제',
      items: [
        { 
          label: '쿠폰함', 
          href: '/setting/coupon', 
          icon: FiGift,
          color: 'bg-pink-500',
          description: '사용 가능한 쿠폰 확인'
        },
        { 
          label: '친구 초대', 
          href: '/setting/referrer', 
          icon: FiUserPlus,
          color: 'bg-indigo-500',
          description: '친구 초대하고 혜택 받기'
        },
        { 
          label: '구매 내역', 
          href: '/setting/purchase', 
          icon: FiShoppingBag,
          color: 'bg-teal-500',
          description: '결제 및 구매 이력'
        },
        { 
          label: '구독 관리', 
          href: '/setting/subscription', 
          icon: FiCreditCard,
          color: 'bg-yellow-500',
          description: '플랜 변경 및 구독 관리'
        },
      ]
    },
    {
      title: '약관 & 정책',
      items: [
        { 
          label: '약관 및 정책', 
          href: '/setting/terms', 
          icon: FiFileText,
          color: 'bg-gray-500',
          description: '이용약관 및 개인정보처리방침'
        },
      ]
    }
  ];

  // 프로필 이미지 관련 상태 및 ref
  const [profileImg, setProfileImg] = useState(profile.avatar);
  const [showSheet, setShowSheet] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // 뒤로가기 핸들러 (애니메이션 포함)
  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => {
      router.back();
    }, 300);
  };

  return (
    <>
      <style jsx global>{pageAnimations}</style>
      <div className={`bg-gradient-to-br from-indigo-50 via-white to-purple-50 min-h-screen pb-10 ${
        isExiting ? 'animate-slideOutToRight' : 
        (shouldAnimate && isPageLoaded) ? 'animate-slideInFromRight' : 
        shouldAnimate ? 'initial-hidden' : ''
      }`} style={{ 
        position: 'relative',
        width: '100%',
        overflow: shouldAnimate && !isPageLoaded ? 'hidden' : 'visible'
      }}>
        {/* 앱 헤더 */}
        <div className="sticky top-0 z-10 px-4 bg-white/80 backdrop-blur-md border-b border-gray-200/50">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-3">
              <button 
                onClick={handleBack}
                disabled={isExiting}
                className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 mobile-button disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex items-center space-x-2">
                <FiSettings className="w-5 h-5 text-indigo-600" />
                <span className="text-lg font-semibold text-gray-900">설정</span>
              </div>
            </div>
          </div>
        </div>

        {/* 프로필 영역 - 개선된 디자인 */}
        <div className="px-4 pt-6 pb-6">
          <div className="bg-indigo-700 rounded-3xl p-6 text-white shadow-xl">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <button 
                  type="button" 
                  onClick={() => setShowSheet(true)} 
                  className="mobile-button group"
                  disabled={isExiting}
                >
                  <div className="relative">
                    <Image
                      src={profileImg}
                      alt="프로필 이미지"
                      width={80}
                      height={80}
                      className="rounded-full border-4 border-white/30 bg-white/20 profile-glow"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-2 shadow-lg group-hover:scale-110 transition-transform">
                      <FiCamera className="w-4 h-4 text-indigo-600" />
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
                  <h2 className="text-xl font-bold">{profile.name}</h2>
                  <div className="flex items-center space-x-1 bg-yellow-400/20 px-2 py-1 rounded-full">
                    <HiSparkles className="w-3 h-3 text-yellow-300" />
                    <span className="text-xs font-medium text-yellow-100">{profile.level}</span>
                  </div>
                </div>
                <p className="text-indigo-100 text-sm mb-1">{profile.plan}</p>
                <p className="text-indigo-200 text-xs">{profile.memberSince} 가입</p>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-white/20">
              <div className="flex items-center justify-between text-sm">
                <span className="text-indigo-100">연락처</span>
                <span className="text-white font-medium">{profile.phone}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 메뉴 섹션들 */}
        <div className="px-4 space-y-6 pb-20">
          {menuSections.map((section, sectionIdx) => (
            <div key={sectionIdx} className="animate-fadeIn" style={{ animationDelay: `${sectionIdx * 0.1}s` }}>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 px-2 flex items-center">
                <span>{section.title}</span>
                <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent ml-3"></div>
              </h3>
              
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {section.items.map((item, itemIdx) => {
                  const IconComponent = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`flex items-center px-4 py-4 menu-item-hover mobile-button ${
                        isExiting ? 'pointer-events-none' : ''
                      } ${itemIdx !== section.items.length - 1 ? 'border-b border-gray-50' : ''}`}
                    >
                      <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center mr-4 shadow-sm`}>
                        <IconComponent className="w-5 h-5 text-white" />
                      </div>
                      
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-0.5">{item.label}</h4>
                        <p className="text-xs text-gray-500">{item.description}</p>
                      </div>
                      
                      <FiChevronRight className="w-5 h-5 text-gray-400" />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          
          {/* 앱 정보 카드 */}
          <div className="bg-gray-50 rounded-2xl p-4 text-center animate-fadeIn" style={{ animationDelay: '0.4s' }}>
            <div className="text-sm text-gray-600 mb-1">SMAP</div>
            <div className="text-xs text-gray-500">버전 1.0.0</div>
          </div>
        </div>

        {/* 개선된 프로필 사진 변경 모달 */}
        {showSheet && !isExiting && (
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
              {/* 모달 핸들 */}
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
      </div>
    </>
  );
} 