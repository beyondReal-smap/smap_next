'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
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

// Loading component for fallbacks (kept for potential future use)
const LoadingFallback = memo(() => (
  <div className="flex items-center justify-center p-4">
    <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
  </div>
));
LoadingFallback.displayName = 'LoadingFallback';

// Utility functions (non-memoized for component external use)
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

// Optimized mobile CSS with better performance
const mobileStyles = `
html, body {
  width: 100%;
  overflow-x: hidden;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-text-size-adjust: 100%;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

/* Performance optimized animations */
@keyframes slideInFromRight {
  from {
    transform: translate3d(30px, 0, 0);
    opacity: 0;
  }
  to {
    transform: translate3d(0, 0, 0);
    opacity: 1;
  }
}

@keyframes slideOutToRight {
  from {
    transform: translate3d(0, 0, 0);
    opacity: 1;
  }
  to {
    transform: translate3d(-30px, 0, 0);
    opacity: 0;
  }
}

@keyframes slideInFromBottom {
  from {
    transform: translate3d(0, 100%, 0);
    opacity: 0;
  }
  to {
    transform: translate3d(0, 0, 0);
    opacity: 1;
  }
}

@keyframes slideOutToBottom {
  from {
    transform: translate3d(0, 0, 0);
    opacity: 1;
  }
  to {
    transform: translate3d(0, 100%, 0);
    opacity: 0;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translate3d(0, 10px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes scaleIn {
  from {
    transform: scale3d(0.95, 0.95, 1);
    opacity: 0;
  }
  to {
    transform: scale3d(1, 1, 1);
    opacity: 1;
  }
}

/* Hardware accelerated classes */
.animate-slideInFromRight {
  animation: slideInFromRight 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  will-change: transform, opacity;
}

.animate-slideOutToRight {
  animation: slideOutToRight 0.4s cubic-bezier(0.55, 0.06, 0.68, 0.19) forwards;
  will-change: transform, opacity;
}

.animate-slideInFromBottom {
  animation: slideInFromBottom 0.3s ease-out forwards;
  will-change: transform, opacity;
}

.animate-slideOutToBottom {
  animation: slideOutToBottom 0.3s ease-in forwards;
  will-change: transform, opacity;
}

.animate-fadeIn {
  animation: fadeIn 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  will-change: transform, opacity;
}

.animate-scaleIn {
  animation: scaleIn 0.2s ease-out forwards;
  will-change: transform, opacity;
}

.initial-hidden {
  opacity: 0;
  transform: translate3d(100%, 0, 0);
  position: relative;
  width: 100%;
  overflow: hidden;
}

/* Touch optimized buttons */
.mobile-button {
  transition: all 0.2s ease;
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  will-change: transform, box-shadow;
}

.mobile-button:active {
  transform: scale3d(0.98, 0.98, 1);
}

/* Memory efficient gradients */
.gradient-bg {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  background-attachment: fixed;
}

/* Optimized scrolling */
.optimized-scroll {
  -webkit-overflow-scrolling: touch;
  overflow-scrolling: touch;
  contain: layout style paint;
}

/* Container queries preparation */
.container-optimized {
  contain: layout style paint;
  content-visibility: auto;
  contain-intrinsic-size: 200px;
}

/* Reduce motion for accessibility */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;

// Validation schema with better performance
const settingsSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(50, '이름은 50자 이내로 입력해주세요'),
  email: z.string().email('올바른 이메일 형식을 입력해주세요').optional().or(z.literal('')),
  phone: z.string().optional(),
  bio: z.string().max(200, '자기소개는 200자 이내로 입력해주세요').optional(),
  notifications: z.boolean().default(true),
  location: z.boolean().default(true),
  marketing: z.boolean().default(false),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

// Memoized Setting Item Component
const SettingItem = memo<{
  icon: React.ReactNode;
  title: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  rightElement?: React.ReactNode;
  badge?: string;
  className?: string;
}>(({ icon, title, description, href, onClick, rightElement, badge, className = '' }) => {
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
      hapticFeedback.menuSelect();
    }
  }, [onClick]);

  const content = (
    <div className={`flex items-center p-4 bg-white rounded-xl border border-gray-100 hover:shadow-md transition-all duration-200 mobile-button ${className}`}>
      <div className="flex-shrink-0 w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mr-4">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center">
          <h3 className="font-medium text-gray-900 truncate">{title}</h3>
          {badge && (
            <span className="ml-2 px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0 ml-4">
        {rightElement || <FiChevronRight className="w-5 h-5 text-gray-400" />}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return (
    <button onClick={handleClick} className="w-full text-left">
      {content}
    </button>
  );
});
SettingItem.displayName = 'SettingItem';

// Memoized Profile Section Component
const ProfileSection = memo<{
  user: any;
  onEditProfile: () => void;
}>(({ user, onEditProfile }) => {
  const loginMethod = useMemo(() => getLoginMethod(user?.mt_type), [user?.mt_type]);
  const userLevel = useMemo(() => getUserLevel(user?.mt_level), [user?.mt_level]);
  const userPlan = useMemo(() => getUserPlan(user?.mt_level), [user?.mt_level]);

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex items-center space-x-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-gray-100">
            <Image
              src={getSafeImageUrl(user?.mt_file1 || null, user?.mt_gender, 0)}
              alt="프로필 사진"
              width={80}
              height={80}
              className="w-full h-full object-cover"
              priority
              placeholder="blur"
              blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
            />
          </div>
          <motion.button
            onClick={onEditProfile}
            className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-lg"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <FiCamera className="w-4 h-4 text-white" />
          </motion.button>
        </div>
        
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <h2 className="text-xl font-bold text-gray-900">
              {user?.mt_nickname || user?.mt_name || '사용자'}
            </h2>
            {user?.mt_level === 5 && (
              <div className="flex items-center px-2 py-1 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full">
                <FiStar className="w-3 h-3 text-white mr-1" />
                <span className="text-xs font-medium text-white">VIP</span>
              </div>
            )}
          </div>
          
          <div className="space-y-1">
            <p className="text-sm text-gray-600">
              {isEmail(user?.mt_id || '') ? user?.mt_id : `${loginMethod.icon} ${loginMethod.method}`}
            </p>
            <p className="text-xs text-gray-500">{userPlan}</p>
          </div>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-lg font-bold text-gray-900">0</p>
            <p className="text-xs text-gray-500">활동 일수</p>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">0</p>
            <p className="text-xs text-gray-500">참여 그룹</p>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">0</p>
            <p className="text-xs text-gray-500">완료 일정</p>
          </div>
        </div>
      </div>
    </div>
  );
});
ProfileSection.displayName = 'ProfileSection';

// Main Settings Page Component
function SettingsPageContent() {
  const router = useRouter();
  const { user, logout } = useAuth();
  
  // Form handling with React Hook Form
  const { control, handleSubmit, formState: { errors } } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: user?.mt_name || '',
      email: user?.mt_email || '',
      phone: user?.mt_hp || '',
      bio: '',
      notifications: true,
      location: true,
      marketing: false,
    },
  });

  // Memoized handlers
  const handleEditProfile = useCallback(() => {
    hapticFeedback.menuSelect();
    router.push('/setting/account');
  }, [router]);

  const handleBack = useCallback(() => {
    hapticFeedback.backButton();
    router.back();
  }, [router]);

  const handleLogout = useCallback(async () => {
    try {
      hapticFeedback.menuSelect();
      await logout();
      router.push('/signin');
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  }, [logout, router]);

  const onSubmit = useCallback(async (data: SettingsFormData) => {
    try {
      console.log('설정 저장:', data);
      hapticFeedback.dataLoadComplete();
    } catch (error) {
      console.error('설정 저장 실패:', error);
      hapticFeedback.dataLoadError();
    }
  }, []);

  // Memoized setting items
  const settingItems = useMemo(() => [
    {
      category: '계정 관리',
      items: [
        {
          icon: <FiUser className="w-5 h-5 text-blue-600" />,
          title: '계정 정보',
          description: '개인정보 및 계정 설정을 관리합니다',
          href: '/setting/account'
        },
        {
          icon: <FiShield className="w-5 h-5 text-green-600" />,
          title: '보안 설정',
          description: '비밀번호 변경 및 보안 설정',
          href: '/setting/security'
        },
        {
          icon: <FiBell className="w-5 h-5 text-orange-600" />,
          title: '알림 설정',
          description: '푸시 알림 및 이메일 알림 설정',
          href: '/setting/notification'
        }
      ]
    },
    {
      category: '서비스',
      items: [
        {
          icon: <FiCreditCard className="w-5 h-5 text-purple-600" />,
          title: '구독 관리',
          description: '플랜 변경 및 결제 관리',
          href: '/setting/subscription',
          badge: user?.mt_level === 5 ? undefined : 'NEW'
        },
        {
          icon: <FiGift className="w-5 h-5 text-pink-600" />,
          title: '쿠폰함',
          description: '사용 가능한 쿠폰을 확인하세요',
          href: '/setting/coupon'
        },
        {
          icon: <FiUserPlus className="w-5 h-5 text-indigo-600" />,
          title: '친구 초대',
          description: '친구를 초대하고 리워드를 받으세요',
          href: '/setting/referrer'
        }
      ]
    },
    {
      category: '고객 지원',
      items: [
        {
          icon: <FiBook className="w-5 h-5 text-teal-600" />,
          title: '사용 가이드',
          description: '앱 사용법을 자세히 알아보세요',
          href: '/setting/manual'
        },
        {
          icon: <FiMessageSquare className="w-5 h-5 text-blue-600" />,
          title: '문의하기',
          description: '궁금한 점이 있으시면 언제든 문의하세요',
          href: '/setting/inquiry'
        },
        {
          icon: <FiFileText className="w-5 h-5 text-gray-600" />,
          title: '공지사항',
          description: '최신 소식과 업데이트를 확인하세요',
          href: '/setting/notice'
        }
      ]
    },
    {
      category: '약관 및 정책',
      items: [
        {
          icon: <FiFileText className="w-5 h-5 text-gray-600" />,
          title: '이용약관',
          description: '서비스 이용약관을 확인하세요',
          href: '/setting/terms/service'
        },
        {
          icon: <FiShield className="w-5 h-5 text-gray-600" />,
          title: '개인정보처리방침',
          description: '개인정보 처리방침을 확인하세요',
          href: '/setting/terms/privacy'
        }
      ]
    }
  ], [user?.mt_level]);

  return (
    <>
      <style jsx global>{mobileStyles}</style>
      
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <AnimatedHeader 
          variant="simple"
          className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="flex items-center justify-between h-14 px-4">
            <div className="flex items-center space-x-3">
              <motion.button
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </motion.button>
              <div>
                <h1 className="text-lg font-bold text-gray-900">설정</h1>
                <p className="text-xs text-gray-500">계정 및 앱 설정을 관리하세요</p>
              </div>
            </div>
          </div>
        </AnimatedHeader>

        {/* Main Content */}
        <div className="pt-16 pb-safe px-4 space-y-6" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 80px)' }}>
          {/* Profile Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <ProfileSection user={user} onEditProfile={handleEditProfile} />
          </motion.div>

          {/* Settings Sections */}
          {settingItems.map((section, sectionIndex) => (
            <motion.div
              key={section.category}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: (sectionIndex + 1) * 0.1 }}
              className="space-y-3"
            >
              <h3 className="text-sm font-medium text-gray-500 px-2">{section.category}</h3>
              <div className="space-y-2">
                {section.items.map((item, itemIndex) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: (sectionIndex + 1) * 0.1 + itemIndex * 0.05 }}
                  >
                    <SettingItem {...item} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}

          {/* Logout Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="pt-4"
          >
            <motion.button
              onClick={handleLogout}
              className="w-full p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 font-medium mobile-button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              로그아웃
            </motion.button>
          </motion.div>

          {/* Version Info */}
          <div className="text-center py-4">
            <p className="text-xs text-gray-400">
              SMAP v1.0.0 • Made with ❤️ in Korea
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// Error Boundary Component
class SettingsErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[SETTINGS] Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">오류가 발생했습니다</h2>
            <p className="text-gray-600 mb-4">페이지를 새로고침해주세요.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Main export with Error Boundary
export default function SettingsPage() {
  return (
    <SettingsErrorBoundary>
      <SettingsPageContent />
    </SettingsErrorBoundary>
  );
} 