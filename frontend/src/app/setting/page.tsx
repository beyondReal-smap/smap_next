'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { motion } from 'framer-motion';
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
import { useAuth } from '@/contexts/AuthContext';
import { hapticFeedback, triggerHapticFeedback, HapticFeedbackType } from '@/utils/haptic';
import AnimatedHeader from '../../components/common/AnimatedHeader';


// 기본 이미지 가져오기 함수 (schedule/page.tsx에서 가져옴)
const getDefaultImage = (gender: number | null | undefined, index: number): string => {
  // frontend/public/images/ 폴더의 기본 이미지 사용
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
  // 실제 사진이 있으면 사용하고, 없으면 기본 이미지 사용
  return photoUrl ?? getDefaultImage(gender, index);
};

// 이메일 형식 확인 함수
const isEmail = (str: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(str);
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
  background: rgba(255, 255, 255, 0.7);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
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

// 기본값 (로딩 중일 때 사용)
const DEFAULT_USER_SETTINGS = {
  name: '',
  nickname: '',
  gender: 'other' as const,
  email: '',
  phone: ''
};

// 성별 옵션
const GENDER_OPTIONS = [
  { value: 'male', label: '남성' },
  { value: 'female', label: '여성' },
  { value: 'other', label: '선택안함' }
];

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const { control, handleSubmit, reset, formState: { errors, isDirty } } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: DEFAULT_USER_SETTINGS
  });

  // 사용자 설정 가져오기
  useEffect(() => {
    if (user) {
      const userSettings: SettingsFormData = {
        name: user.mt_name || user.mt_nickname || '',
        nickname: user.mt_nickname || user.mt_name || '',
        gender: user.mt_gender === 1 ? 'male' : user.mt_gender === 2 ? 'female' : 'other',
        email: user.mt_email || '',
        phone: user.mt_id || '' // mt_id가 전화번호로 사용됨
      };
      reset(userSettings);
      

    }
  }, [user, reset]);

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
      // 설정 저장 완료 햅틱 피드백
      hapticFeedback.dataLoadComplete();
    }
  };

  // 프로필 데이터 (실제 사용자 정보 기반)
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
      ]
    },
    {
      title: '약관 & 정책',
      items: [
        { 
          label: '약관 및 정책', 
          href: '/setting/terms', 
          icon: FiFileText,
          color: 'bg-yellow-500',
          description: '이용약관 및 개인정보처리방침'
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
        // { 
        //   label: '쿠폰함', 
        //   href: '/setting/coupon', 
        //   icon: FiGift,
        //   color: 'bg-pink-500',
        //   description: '사용 가능한 쿠폰 확인'
        // },
        // { 
        //   label: '친구 초대', 
        //   href: '/setting/referrer', 
        //   icon: FiUserPlus,
        //   color: 'bg-indigo-500',
        //   description: '친구 초대하고 혜택 받기'
        // },
        { 
          label: '구독 내역', 
          href: '/setting/purchase', 
          icon: FiShoppingBag,
          color: 'bg-emerald-500',
          description: '결제 및 구독 이력'
        },
      ]
    },
  ];



  // 뒤로가기 핸들러
  const handleBack = () => {
    // 🎮 뒤로가기 햅틱 피드백
    triggerHapticFeedback(HapticFeedbackType.SELECTION, '설정 페이지 뒤로가기', { 
      component: 'setting', 
      action: 'back-navigation' 
    });
    router.back();
  };

  return (
    <>
      <style jsx global>{pageAnimations}</style>
      <div className="flex-1 flex flex-col">
        {/* 헤더 */}
        <AnimatedHeader 
          variant="enhanced"
          className="fixed top-0 left-0 right-0 glass-effect header-fixed z-50"
          style={{ 
            paddingTop: '0px !important',
            marginTop: '0px !important',
            padding: '0px !important',
            margin: '0px !important',
            top: '0px !important',
            position: 'fixed'
          } as React.CSSProperties}
        >
          <div 
            className="flex items-center justify-between" 
            style={{ 
              paddingLeft: '16px', 
              paddingRight: '16px',
              paddingTop: '0px !important',
              paddingBottom: '0px !important',
              height: '56px',
              width: '100%',
              boxSizing: 'border-box'
            }}
          >
            {/* 왼쪽 - 뒤로가기 버튼과 제목 */}
            <div className="flex items-center space-x-3">
              <button
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">설정</h1>
                <p className="text-xs text-gray-500">계정 및 앱 설정을 관리하세요</p>
              </div>
            </div>
          </div>
        </AnimatedHeader>
        
        {/* 메인 컨텐츠 */}
        <div className="flex-1 flex flex-col pt-20 pb-24 px-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="space-y-6"
          >


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
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`flex items-center px-4 py-4 menu-item-hover mobile-button ${itemIdx !== section.items.length - 1 ? 'border-b border-gray-50' : ''}`}
                      onClick={() => {
                        // 🎮 설정 메뉴 진입 햅틱 피드백
                        triggerHapticFeedback(HapticFeedbackType.SELECTION, `${item.label} 메뉴 진입`, { 
                          component: 'setting', 
                          action: 'navigate-to-menu',
                          menu: item.label 
                        });
                      }}
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
            </motion.div>
          ))}
          
          {/* 앱 정보 카드 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="bg-gray-50 rounded-2xl p-4 text-center"
          >
            <div className="text-sm text-gray-600 mb-1">SMAP</div>
            <div className="text-xs text-gray-500">버전 1.0.0</div>
          </motion.div>
          </div>
          </motion.div>
        </div>
      </div>
    </>
  );
} 