'use client';

import { useState, useEffect, useMemo, useRef, useCallback, memo, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ko';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import isBetween from 'dayjs/plugin/isBetween';
import { v4 as uuidv4 } from 'uuid';
import { 
  FiCalendar, 
  FiPlus, 
  FiClock, 
  FiUsers, 
  FiUser, 
  FiEdit3, 
  FiTrash2, 
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiMoreVertical,
  FiChevronDown,
  FiAlertTriangle,
  FiMapPin,
  FiCheck,
  FiRotateCcw,
  FiCheckCircle,
  FiXCircle,
  FiInfo
} from 'react-icons/fi';
import { HiSparkles, HiCalendarDays, HiArrowPath, HiBell, HiUserGroup } from 'react-icons/hi2';
import { FaTrash, FaCrown } from 'react-icons/fa';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import memberService from '../../services/memberService';
import groupService, { Group } from '../../services/groupService';
import scheduleService, { Schedule, UserPermission } from '../../services/scheduleService';
import pushNotificationService, { ScheduleNotificationContext, GroupMemberInfo } from '../../services/pushNotificationService';
import { useDataCache } from '../../contexts/DataCacheContext';
import { useAuth } from '../../contexts/AuthContext';
import { hapticFeedback } from '../../utils/haptic';
import FloatingButton from '../../components/common/FloatingButton';
import IOSCompatibleSpinner from '../../components/common/IOSCompatibleSpinner';
import { getSafeImageUrl, getDefaultImage, handleImageError } from '@/lib/imageUtils';

// Dynamic Imports for better code splitting
const AnimatedHeader = dynamic(() => import('../../components/common/AnimatedHeader'), {
  loading: () => (
    <div className="h-14 bg-white animate-pulse" />
  ),
  ssr: false
});

const EventCard = dynamic(() => import('../../components/schedule/EventCard'), {
  loading: () => (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-pulse">
      <div className="h-4 bg-gray-200 rounded mb-2"></div>
      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
    </div>
  ),
  ssr: false
});

const MemberSelector = dynamic(() => import('../../components/schedule/MemberSelector'), {
  loading: () => (
    <div className="bg-indigo-50 rounded-xl p-4 animate-pulse">
      <div className="h-6 bg-gray-200 rounded mb-4"></div>
      <div className="grid grid-cols-4 gap-3">
        {[1,2,3,4].map(i => (
          <div key={i} className="flex flex-col items-center">
            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
            <div className="h-3 bg-gray-200 rounded w-12 mt-2"></div>
          </div>
        ))}
      </div>
    </div>
  ),
  ssr: false
});

dayjs.extend(isBetween);
dayjs.locale('ko');



// GroupDropdownPortal 컴포넌트 (activelog의 GroupSelector에서 가져옴)
const GroupDropdownPortal = ({
  children,
  target,
  onClose,
}: {
  children: React.ReactNode;
  target: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        target.current && !target.current.contains(event.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    
    const calculatePosition = () => {
      if (target.current) {
        const rect = target.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      }
    };

    calculatePosition();
    
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', calculatePosition, true);
    };
  }, [target, onClose]);

  if (!position) return null;

  return createPortal(
    <div
      ref={dropdownRef}
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
      className="absolute rounded-xl z-[1000] overflow-hidden bg-white shadow-2xl border border-gray-200/80"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        maxHeight: '40vh',
        overflowY: 'auto'
      }}
      data-group-dropdown-menu="true"
    >
      {children}
    </div>,
    document.body
  );
};

// 모바일 최적화된 CSS 스타일
const pageStyles = `
html, body {
  width: 100%;
  overflow-x: hidden;
  position: relative;
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
  background: linear-gradient(135deg, #0113A3 0%, #001a8a 100%);
}

.glass-effect {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.calendar-day {
  transition: all 0.2s ease;
  cursor: pointer;
  user-select: none;
  position: relative;
  color: #374151;
  font-weight: 500;
}

.calendar-day:hover {
  transform: scale(1.1);
  background-color: #f3f4f6;
  color: #1f2937;
}

.calendar-day.selected {
  background: linear-gradient(135deg, #0113A3 0%, #001a8a 100%);
  color: white;
  transform: scale(1.1);
  font-weight: 600;
}

.calendar-day.has-event::after {
  content: '';
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  background: #ef4444;
  border-radius: 50%;
}

.event-card {
  transition: all 0.2s ease;
  cursor: pointer;
}

.event-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

/* 플로팅 버튼 스타일 제거됨 - 통합 컴포넌트 사용 */

/* 앱 고정 레이아웃 - 전체 스크롤 비활성화 */
html {
  overflow: hidden !important;
  position: fixed !important;
  width: 100% !important;
  height: 100% !important;
  -webkit-overflow-scrolling: touch !important;
  touch-action: manipulation !important;
}

/* floating-button이 보이도록 body에서 overflow 예외 처리 */
body {
  overflow: visible !important; /* floating-button을 위해 visible로 변경 */
  position: relative !important; /* fixed에서 relative로 변경 */
  width: 100% !important;
  height: 100% !important;
  -webkit-overflow-scrolling: touch !important;
  touch-action: manipulation !important;
}

/* 모바일 사파리 bounce 효과 비활성화 */
body {
  overscroll-behavior: none !important;
  -webkit-overflow-scrolling: touch !important;
}

/* 스크롤바 완전히 숨기기 - 모든 브라우저 대응 */
* {
  scrollbar-width: none !important; /* Firefox */
  -ms-overflow-style: none !important; /* Internet Explorer 10+ */
}

*::-webkit-scrollbar {
  display: none !important; /* Safari and Chrome */
  width: 0 !important;
  height: 0 !important;
  background: transparent !important;
}

*::-webkit-scrollbar-track {
  display: none !important;
}

*::-webkit-scrollbar-thumb {
  display: none !important;
}

/* 컨테이너 요소들의 스크롤바 숨김 */
.main-container,
.content-area,
.scroll-container,
div[style*="overflow"],
div[style*="scroll"] {
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}

.main-container::-webkit-scrollbar,
.content-area::-webkit-scrollbar,
.scroll-container::-webkit-scrollbar {
  display: none !important;
}

/* 모바일 앱 최적화 */
* {
  -webkit-tap-highlight-color: transparent !important;
  -webkit-touch-callout: none !important;
  -webkit-user-select: none !important;
  user-select: none !important;
}

@keyframes floatIn {
  from {
    transform: translateY(100px) scale(0.8);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}
`;

const TODAY = dayjs().format('YYYY-MM-DD');
const YESTERDAY = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
const TOMORROW = dayjs().add(1, 'day').format('YYYY-MM-DD');

// Framer Motion 애니메이션 variants
const pageVariants = {
  initial: { 
    opacity: 0, 
    y: 20 
  },
  in: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.6
    }
  },
  out: { 
    opacity: 0, 
    y: -20,
    transition: {
      duration: 0.4
    }
  }
};

const modalVariants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    y: 20
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.3
    }
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 20,
    transition: {
      duration: 0.2
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5
    }
  })
};

const floatingButtonVariants = {
  initial: { scale: 0, rotate: -180, opacity: 0 }, // Added opacity
  animate: { 
    scale: 1, 
    rotate: 0,
    opacity: 1, // Added opacity
    transition: {
      delay: 0.5, // Sync with group/page.tsx
      type: "spring",
      stiffness: 260, // Sync with group/page.tsx
      damping: 20, // Sync with group/page.tsx
      mass: 0.8, // Kept from schedule/page.tsx as it\'s reasonable
      duration: 0.6 // Kept from schedule/page.tsx
    }
  },
  hover: { 
    scale: 1.1, // Sync with group/page.tsx
    transition: { 
      duration: 0.2 // Sync with group/page.tsx
    }
  },
  tap: { 
    scale: 0.9, // Sync with group/page.tsx
    transition: { duration: 0.1 } 
  }
};

// 그룹 관련 인터페이스 추가
interface UserGroup {
  sgt_idx: number;
  sgt_title: string;
}

interface ScheduleGroupMember {
  id: string;
  name: string;
  photo: string | null;
  isSelected: boolean;
  mt_gender?: number | null;
  mt_idx: number;
  mt_name: string;
  mt_nickname?: string;
  mt_file1?: string | null;
  sgdt_owner_chk?: string;
  sgdt_leader_chk?: string;
  sgdt_idx?: number;
  
  // 새로 추가된 위치 정보
  mlt_lat?: number | null;
  mlt_long?: number | null;
  mlt_speed?: number | null;
  mlt_battery?: number | null;
  mlt_gps_time?: string | null;
}

// ScheduleEvent 인터페이스 정의
interface ScheduleEvent {
  id: string;
  sst_idx?: number; // 백엔드 스케줄 ID
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  title: string;
  content?: string;
  groupId?: number;
  groupName?: string;
  groupColor?: string;
  memberName?: string;
  memberPhoto?: string;
  memberGender?: number | null; // 멤버 성별 정보 추가
  memberIdx?: number; // 멤버 인덱스 추가
  canEdit?: boolean; // 편집 권한
  canDelete?: boolean; // 삭제 권한
  locationName?: string;
  locationAddress?: string;
  locationLat?: number; // 위도 추가
  locationLng?: number; // 경도 추가
  hasAlarm?: boolean;
  alarmText?: string;
  alarmTime?: string; // 알림 시간
  repeatText?: string;
  distance?: number | null;
  distanceText?: string;
  tgtMtIdx?: number | null;
  isAllDay?: boolean; // 하루 종일 여부
  repeatJsonV?: string; // 반복 JSON 버전
  tgtSgdtOwnerChk?: string; // 타겟 멤버의 오너 권한
  tgtSgdtLeaderChk?: string; // 타겟 멤버의 리더 권한
  tgtSgdtIdx?: number; // 타겟 멤버의 그룹 상세 인덱스
  sst_pidx?: number; // 반복 일정 인덱스
  memberNickname?: string; // nickname 추가
  memberCurrentLat?: number | null; // current latitude 추가
  memberCurrentLng?: number | null; // current longitude 추가
  memberBattery?: number | null; // battery 추가
  memberGpsTime?: string | null; // gps time 추가
}

// 모의 일정 데이터
const MOCK_SCHEDULE_EVENTS: ScheduleEvent[] = [
  {
    id: '1',
    date: TODAY,
    startTime: '09:00',
    endTime: '10:00',
    title: '아침 스크럼',
    content: '데일리 스크럼 진행 및 이슈 공유',
    groupName: '프론트엔드팀',
    groupColor: 'bg-sky-500',
    memberName: '김민지',
    memberPhoto: '/images/avatar1.png',
  },
  {
    id: '2',
    date: TODAY,
    startTime: '11:00',
    endTime: '12:30',
    title: '백엔드 API 설계 회의',
    content: '신규 기능 관련 API 엔드포인트 및 데이터 구조 설계 논의',
    groupName: '백엔드팀',
    groupColor: 'bg-teal-500',
    memberName: '이준호',
    memberPhoto: '/images/avatar2.png',
  },
  {
    id: '3',
    date: YESTERDAY,
    startTime: '14:00',
    endTime: '15:00',
    title: 'UX/UI 디자인 검토',
    groupName: '디자인팀',
    groupColor: 'bg-amber-500',
    memberName: '박서연',
    memberPhoto: '/images/avatar3.png',
  },
  {
    id: '4',
    date: TOMORROW,
    startTime: '10:00',
    endTime: '11:00',
    title: '주간 전체 회의',
    content: '각 팀별 진행 상황 공유 및 주요 안건 논의',
    groupName: '전체팀',
    groupColor: 'bg-blue-600',
    memberName: '최현우',
    memberPhoto: '/images/avatar4.png',
  },
  {
    id: '5',
    date: TODAY,
    startTime: '15:00',
    endTime: '16:30',
    title: '데이터베이스 마이그레이션 계획',
    content: '기존 DB에서 신규 DB로의 마이그레이션 절차 및 일정 계획 수립',
    groupName: '인프라팀',
    groupColor: 'bg-rose-500',
    memberName: '정다은',
    memberPhoto: '/images/avatar5.png',
  },
  {
    id: '6',
    date: TOMORROW,
    startTime: '16:00',
    endTime: '17:00',
    title: '신규 입사자 OT',
    groupName: 'HR팀',
    groupColor: 'bg-lime-500',
    memberName: '홍길동',
    memberPhoto: '/images/avatar1.png',
  },
  {
    id: '7',
    date: dayjs().add(2, 'day').format('YYYY-MM-DD'),
    startTime: '09:30',
    endTime: '10:30',
    title: '마케팅 캠페인 아이디어 회의',
    groupName: '마케팅팀',
    groupColor: 'bg-purple-500',
    memberName: '김영희',
    memberPhoto: '/images/avatar2.png',
  }
];

interface NewEvent {
  id?: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  repeat: string;
  alarm: string;
  locationName: string;
  locationAddress: string;
  locationLat?: number; // 위도 추가
  locationLng?: number; // 경도 추가
  content?: string;
  groupName?: string;
  groupColor?: string;
  memberName?: string;
  memberPhoto?: string;
  editOption?: 'this' | 'future' | 'all';
}

// 일정 상태 판단 함수
// Portal 컴포넌트 - 모든 모달을 body에 렌더링
const Portal = memo(({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  return mounted ? createPortal(children, document.body) : null;
});

function getEventStatus(event: ScheduleEvent): { text: string; color: string; bgColor: string } {
  const now = dayjs();
  const eventDate = dayjs(event.date);
  const eventStart = dayjs(`${event.date} ${event.startTime}`);
  const eventEnd = dayjs(`${event.date} ${event.endTime}`);

  if (now.isBefore(eventStart)) {
    return { text: '예정', color: 'text-blue-600', bgColor: 'bg-blue-50' };
  } else if (now.isBetween(eventStart, eventEnd)) {
    return { text: '진행중', color: 'text-green-600', bgColor: 'bg-green-50' };
  } else {
    return { text: '완료', color: 'text-gray-600', bgColor: 'bg-gray-50' };
  }
}

// 커스텀 캘린더 컴포넌트
const MobileCalendar = memo(({ 
  selectedDay, 
  onDayClick, 
  events,
  onMonthChange // 월 변경 콜백 추가
}: { 
  selectedDay: Dayjs | null; 
  onDayClick: (day: Dayjs) => void;
  events: ScheduleEvent[];
  onMonthChange?: (year: number, month: number) => void; // 월 변경 콜백 프롭 추가
}) => {
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationDirection, setAnimationDirection] = useState<'left' | 'right'>('right');
  
  const daysInMonth = currentMonth.daysInMonth();
  const firstDayOfMonth = currentMonth.startOf('month').day();
  const today = dayjs();
  
  const eventDates = useMemo(() => {
    return events.reduce((acc, event) => {
      acc[event.date] = true;
      return acc;
    }, {} as Record<string, boolean>);
  }, [events]);

  const handlePrevMonth = () => {
    setAnimationDirection('left');
    setIsAnimating(true);
    setTimeout(() => {
      const newMonth = currentMonth.subtract(1, 'month');
      setCurrentMonth(newMonth);
      setIsAnimating(false);
      // 월 변경 콜백 호출
      if (onMonthChange) {
        onMonthChange(newMonth.year(), newMonth.month() + 1);
      }
    }, 150);
  };

  const handleNextMonth = () => {
    setAnimationDirection('right');
    setIsAnimating(true);
    setTimeout(() => {
      const newMonth = currentMonth.add(1, 'month');
      setCurrentMonth(newMonth);
      setIsAnimating(false);
      // 월 변경 콜백 호출
      if (onMonthChange) {
        onMonthChange(newMonth.year(), newMonth.month() + 1);
      }
    }, 150);
  };

  const handleToday = () => {
    setAnimationDirection('right');
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentMonth(today);
      onDayClick(today);
      setIsAnimating(false);
    }, 150);
  };

  const renderCalendarDays = () => {
    const days = [];
    
    // 빈 칸 추가 (이전 달 마지막 날들)
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-10"></div>);
    }
    
    // 현재 달의 날짜들
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = currentMonth.date(day);
      const dateString = currentDate.format('YYYY-MM-DD');
      const isSelected = selectedDay?.isSame(currentDate, 'day');
      const isToday = today.isSame(currentDate, 'day');
      const hasEvent = eventDates[dateString];
      
      days.push(
        <button
          key={day}
          onClick={() => onDayClick(currentDate)}
          className={`
            h-10 w-full rounded-lg flex items-center justify-center text-basic font-bold calendar-day mobile-button
            ${isSelected ? 'calendar-day selected' : ''}
            ${isToday && !isSelected ? 'font-semibold' : ''}
            ${!isSelected && !isToday ? 'hover:bg-gray-100 text-gray-800' : ''}
            ${hasEvent ? 'calendar-day has-event' : ''}
          `}
        >
          {day}
        </button>
      );
    }
    
    return days;
  };

  return (
    <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100" style={{ zIndex: 0 }}>
      {/* 캘린더 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <motion.button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-gray-100 rounded-full mobile-button"
          disabled={isAnimating}
        >
          <FiChevronLeft className="w-5 h-5 text-gray-600" />
        </motion.button>
        
        <div className="text-center">
          <motion.h2 
            key={currentMonth.format('YYYY-MM')}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-lg font-bold text-gray-900"
          >
            {currentMonth.format('YYYY년 MM월')}
          </motion.h2>
          <motion.button
            onClick={handleToday}
            className="text-sm mobile-button"
            style={{ color: '#0113A3' }}
            disabled={isAnimating}
          >
            오늘로 이동
          </motion.button>
        </div>
        
        <motion.button
          onClick={handleNextMonth}
          className="p-2 hover:bg-gray-100 rounded-full mobile-button"
          disabled={isAnimating}
        >
          <FiChevronRight className="w-5 h-5 text-gray-600" />
        </motion.button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
          <div key={day} className={`h-6 flex items-center justify-center text-xs font-bold ${
            index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : 'text-gray-700'
          }`}>
            {day}
          </div>
        ))}
      </div>

      {/* 캘린더 그리드 */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={currentMonth.format('YYYY-MM')}
          initial={{ 
            opacity: 0, 
            x: animationDirection === 'right' ? 50 : -50 
          }}
          animate={{ 
            opacity: 1, 
            x: 0 
          }}
          exit={{ 
            opacity: 0, 
            x: animationDirection === 'right' ? -50 : 50 
          }}
          transition={{ 
            duration: 0.3,
            ease: [0.25, 0.46, 0.45, 0.94]
          }}
          className="grid grid-cols-7 gap-1"
          style={{ zIndex: 0 }}
        >
          {renderCalendarDays()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
});

export default function SchedulePage() {
  const router = useRouter();
  const { user } = useAuth();
  
  // DataCache 컨텍스트 사용
  const { invalidateCache } = useDataCache();
  
  // 헤더 상단 패딩 강제 제거 (런타임) - 애니메이션 간섭 방지
  useEffect(() => {
    const forceRemoveHeaderPadding = () => {
      if (typeof document === 'undefined') return;
      
      // 모든 헤더 관련 요소 선택
      const selectors = [
        'header',
        '.header-fixed',
        '.glass-effect',
        '.schedule-header',
        '.register-header-fixed',
        '.activelog-header',
        '.location-header',
        '.group-header',
        '.home-header',
        '[role="banner"]',
        '#schedule-page-container'
      ];
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element: Element) => {
          const htmlElement = element as HTMLElement;
          htmlElement.style.paddingTop = '0px';
          htmlElement.style.marginTop = '0px';
          htmlElement.style.setProperty('padding-top', '0px', 'important');
          htmlElement.style.setProperty('margin-top', '0px', 'important');
          if (selector === 'header' || selector.includes('header')) {
            htmlElement.style.setProperty('top', '0px', 'important');
            htmlElement.style.setProperty('position', 'fixed', 'important');
          }
        });
      });
      
      // body와 html 요소도 확인
      document.body.style.setProperty('padding-top', '0px', 'important');
      document.body.style.setProperty('margin-top', '0px', 'important');
      document.documentElement.style.setProperty('padding-top', '0px', 'important');
      document.documentElement.style.setProperty('margin-top', '0px', 'important');
    };
    
    // 즉시 실행 (애니메이션 간섭 방지)
    forceRemoveHeaderPadding();
  }, []);

  // 페이지 마운트 시 스크롤 설정
  useEffect(() => {
    document.body.style.overflowY = 'auto';
    document.documentElement.style.overflowY = 'auto';
    
    // 🔥 헤더 높이 강제 설정 - 최후의 수단
    const forceHeaderHeight = () => {
      const headers = document.querySelectorAll('.schedule-header, header.schedule-header');
      headers.forEach(header => {
        if (header) {
          (header as HTMLElement).style.setProperty('height', '64px', 'important');
          (header as HTMLElement).style.setProperty('min-height', '64px', 'important');
          (header as HTMLElement).style.setProperty('max-height', 'none', 'important');

        }
      });
    };
    
    // 즉시 실행하고 주기적으로 실행
    forceHeaderHeight();
    const heightInterval = setInterval(forceHeaderHeight, 500);
    
    return () => {
      document.body.style.overflowY = '';
      document.documentElement.style.overflowY = '';
      clearInterval(heightInterval);
    };
  }, []);
  const [selectedDay, setSelectedDay] = useState<Dayjs | null>(dayjs());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);  // 목업 데이터 제거
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [selectedEventDetails, setSelectedEventDetails] = useState<ScheduleEvent | null>(null);

  // 그룹 및 멤버 선택 관련 상태 추가
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [isGroupSelectorOpen, setIsGroupSelectorOpen] = useState(false);
  const groupButtonRef = useRef<HTMLButtonElement>(null);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [scheduleGroupMembers, setScheduleGroupMembers] = useState<ScheduleGroupMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<'owner' | 'leader' | 'member'>('member');

  // 반복 및 알림 모달 상태
  const [isRepeatModalOpen, setIsRepeatModalOpen] = useState(false);
  const [isAlarmModalOpen, setIsAlarmModalOpen] = useState(false);
  
  // 날짜 및 시간 모달 상태
  const [isDateTimeModalOpen, setIsDateTimeModalOpen] = useState(false);
  
  // 날짜/시간 모달용 임시 상태 추가
  const [tempDateTime, setTempDateTime] = useState({
    date: '',
    startTime: '',
    endTime: '',
    allDay: false
  });
  
  // 날짜/시간 백업 상태 (취소 시 복원용)
  const [backupDateTime, setBackupDateTime] = useState({
    date: '',
    startTime: '',
    endTime: '',
    allDay: false
  });
  
  // 커스텀 캘린더 모달 상태 추가
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [calendarCurrentMonth, setCalendarCurrentMonth] = useState(dayjs());
  
  // 커스텀 시간 선택 모달 상태 추가
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [timeModalType, setTimeModalType] = useState<'start' | 'end'>('start');
  const [selectedHour, setSelectedHour] = useState(9);
  const [selectedMinute, setSelectedMinute] = useState(0);
  
  // 시간 스크롤 ref 추가
  const hourScrollRef = useRef<HTMLDivElement>(null);
  const minuteScrollRef = useRef<HTMLDivElement>(null);
  
  // 알림 모달 스크롤 ref 추가
  const alarmScrollRef = useRef<HTMLDivElement>(null);
  
  // 장소 검색 모달 상태
  const [isLocationSearchModalOpen, setIsLocationSearchModalOpen] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState<any[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // 날짜/시간 유효성 검사 상태
  const [dateTimeError, setDateTimeError] = useState<string | null>(null);

  // 로드된 년월 추적 (중복 API 호출 방지)
  const [loadedYearMonth, setLoadedYearMonth] = useState<string | null>(null);

  // 라인 700 근처에 추가
  const [tempSelectedWeekdays, setTempSelectedWeekdays] = useState<Set<number>>(new Set());

  // 임시 상태 저장용 변수들 추가
  const [tempRepeatValue, setTempRepeatValue] = useState('');
  const [tempLocationData, setTempLocationData] = useState({
    name: '',
    address: '',
    lat: undefined as number | undefined,
    lng: undefined as number | undefined
  });

  // 추가 임시 상태 변수
  const [tempShowWeekdaySelector, setTempShowWeekdaySelector] = useState(false);

  // 저장 완료 모달 상태
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [successModalContent, setSuccessModalContent] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
    onConfirm?: () => void;
  } | null>(null);

  // 스케줄 액션 선택 모달 상태
  const [isScheduleActionModalOpen, setIsScheduleActionModalOpen] = useState(false);
  const [selectedEventForAction, setSelectedEventForAction] = useState<ScheduleEvent | null>(null);

  // 반복 일정 처리 모달 상태
  const [isRepeatActionModalOpen, setIsRepeatActionModalOpen] = useState(false);
  const [repeatActionType, setRepeatActionType] = useState<'edit' | 'delete'>('edit');
  const [pendingRepeatEvent, setPendingRepeatEvent] = useState<ScheduleEvent | null>(null);

  // 토스트 모달 상태
  const [toastModal, setToastModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'loading';
    title: string;
    message: string;
    progress: number;
    autoClose: boolean;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
    progress: 0,
    autoClose: true
  });

  // 월 변경 로딩 상태 추가
  const [isMonthChanging, setIsMonthChanging] = useState(false);

  // 월별 데이터 캐시 시스템 추가 (로컬 스토리지 기반)
  const [monthlyCache, setMonthlyCache] = useState<Map<string, ScheduleEvent[]>>(new Map());
  const [loadedMonths, setLoadedMonths] = useState<Set<string>>(new Set());

  // 초기 로딩 상태 추가
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [hasInitialDataLoaded, setHasInitialDataLoaded] = useState(false);

  // 단계별 로딩 상태 추적
  const [loadingSteps, setLoadingSteps] = useState({
    groups: false,
    schedules: false,
    calendar: false,
    ui: false
  });

  // 로컬 스토리지 키 상수
  const CACHE_PREFIX = 'schedule_cache_';
  const LOADED_MONTHS_KEY = 'schedule_loaded_months';

  // 매주 반복 시 요일 선택 상태
  const [selectedWeekdays, setSelectedWeekdays] = useState<Set<number>>(new Set());
  const [showWeekdaySelector, setShowWeekdaySelector] = useState(false);

  // 반복 모달 전용 임시 상태 변수들
  const [tempModalRepeatValue, setTempModalRepeatValue] = useState('');
  const [tempModalSelectedWeekdays, setTempModalSelectedWeekdays] = useState<Set<number>>(new Set());
  const [tempModalShowWeekdaySelector, setTempModalShowWeekdaySelector] = useState(false);

  // 로컬 스토리지에서 캐시 데이터 로드
  const loadCacheFromStorage = () => {
    try {
      // 로드된 월 목록 복원
      const savedLoadedMonths = localStorage.getItem(LOADED_MONTHS_KEY);
      if (savedLoadedMonths) {
        const monthsArray = JSON.parse(savedLoadedMonths);
        setLoadedMonths(new Set(monthsArray));
        
        // 각 월의 캐시 데이터 복원
        const newCache = new Map<string, ScheduleEvent[]>();
        monthsArray.forEach((monthKey: string) => {
          const cacheData = localStorage.getItem(CACHE_PREFIX + monthKey);
          if (cacheData) {
            try {
              const events = JSON.parse(cacheData);
              newCache.set(monthKey, events);
            } catch (error) {
              console.error(`[CACHE] 월 ${monthKey} 캐시 데이터 파싱 실패:`, error);
              // 손상된 캐시 데이터 제거
              localStorage.removeItem(CACHE_PREFIX + monthKey);
            }
          }
        });
        setMonthlyCache(newCache);
        console.log('[CACHE] 로컬 스토리지에서 캐시 복원 완료:', Array.from(newCache.keys()));
      }
    } catch (error) {
      console.error('[CACHE] 로컬 스토리지 캐시 로드 실패:', error);
      // 캐시 초기화
      clearCacheFromStorage();
    }
  };

  // 로컬 스토리지에 캐시 데이터 저장
  const saveCacheToStorage = (monthKey: string, events: ScheduleEvent[]) => {
    try {
      // 월별 데이터 저장
      localStorage.setItem(CACHE_PREFIX + monthKey, JSON.stringify(events));
      
      // 로드된 월 목록 업데이트
      const currentLoadedMonths = Array.from(loadedMonths);
      if (!currentLoadedMonths.includes(monthKey)) {
        currentLoadedMonths.push(monthKey);
        localStorage.setItem(LOADED_MONTHS_KEY, JSON.stringify(currentLoadedMonths));
      }
      
      console.log(`[CACHE] 월 ${monthKey} 데이터 로컬 스토리지에 저장 완료 (${events.length}개 이벤트)`);
    } catch (error) {
      console.error(`[CACHE] 월 ${monthKey} 데이터 저장 실패:`, error);
      // 스토리지 용량 부족 등의 경우 오래된 캐시 정리
      if (error instanceof DOMException && error.code === 22) {
        console.log('[CACHE] 스토리지 용량 부족, 오래된 캐시 정리 시도');
        clearOldCacheFromStorage();
        // 정리 후 다시 시도
        try {
          localStorage.setItem(CACHE_PREFIX + monthKey, JSON.stringify(events));
        } catch (retryError) {
          console.error('[CACHE] 캐시 정리 후에도 저장 실패:', retryError);
        }
      }
    }
  };

  // 로컬 스토리지에서 특정 월 캐시 데이터 로드
  const loadMonthCacheFromStorage = (monthKey: string): ScheduleEvent[] | null => {
    try {
      const cacheData = localStorage.getItem(CACHE_PREFIX + monthKey);
      if (cacheData) {
        return JSON.parse(cacheData);
      }
    } catch (error) {
      console.error(`[CACHE] 월 ${monthKey} 캐시 로드 실패:`, error);
      // 손상된 캐시 데이터 제거
      localStorage.removeItem(CACHE_PREFIX + monthKey);
    }
    return null;
  };

  // 오래된 캐시 정리 (최근 6개월만 유지)
  const clearOldCacheFromStorage = () => {
    try {
      const savedLoadedMonths = localStorage.getItem(LOADED_MONTHS_KEY);
      if (savedLoadedMonths) {
        const monthsArray = JSON.parse(savedLoadedMonths);
        const currentMonth = dayjs();
        const validMonths: string[] = [];
        
        monthsArray.forEach((monthKey: string) => {
          const [year, month] = monthKey.split('-').map(Number);
          const monthDate = dayjs().year(year).month(month - 1);
          
          // 현재 월 기준 6개월 이내의 데이터만 유지
          if (Math.abs(monthDate.diff(currentMonth, 'month')) <= 6) {
            validMonths.push(monthKey);
          } else {
            // 오래된 캐시 삭제
            localStorage.removeItem(CACHE_PREFIX + monthKey);
            console.log(`[CACHE] 오래된 캐시 삭제: ${monthKey}`);
          }
        });
        
        // 유효한 월 목록 업데이트
        localStorage.setItem(LOADED_MONTHS_KEY, JSON.stringify(validMonths));
        setLoadedMonths(new Set(validMonths));
        
        console.log(`[CACHE] 오래된 캐시 정리 완료. 유지된 월: ${validMonths.length}개`);
      }
    } catch (error) {
      console.error('[CACHE] 오래된 캐시 정리 실패:', error);
    }
  };

  // 전체 캐시 초기화
  const clearCacheFromStorage = () => {
    try {
      // 로드된 월 목록 가져오기
      const savedLoadedMonths = localStorage.getItem(LOADED_MONTHS_KEY);
      if (savedLoadedMonths) {
        const monthsArray = JSON.parse(savedLoadedMonths);
        monthsArray.forEach((monthKey: string) => {
          localStorage.removeItem(CACHE_PREFIX + monthKey);
        });
      }
      
      // 메타데이터 삭제
      localStorage.removeItem(LOADED_MONTHS_KEY);
      
      // 상태 초기화
      setMonthlyCache(new Map());
      setLoadedMonths(new Set());
      
      console.log('[CACHE] 전체 캐시 초기화 완료');
    } catch (error) {
      console.error('[CACHE] 캐시 초기화 실패:', error);
    }
  };

  // 컴포넌트 마운트 감지
  useEffect(() => {
    console.log('[useEffect] 스케줄 페이지 초기화 시작');
    
    // 개발 환경에서 페이지 로드 시 캐시 초기화
    if (process.env.NODE_ENV === 'development') {
      console.log('[useEffect] 🔧 개발 환경 감지 - 캐시 초기화 실행');
      clearCacheFromStorage();
      setMonthlyCache(new Map());
      setLoadedMonths(new Set());
      console.log('[useEffect] 🗑️ 개발 환경에서 모든 캐시 초기화 완료');
    } else {
      // 프로덕션 환경에서는 버전 체크를 통한 캐시 무효화
      const currentVersion = '1.0.0'; // 앱 버전
      const storedVersion = localStorage.getItem('scheduleAppVersion');
      
      if (storedVersion !== currentVersion) {
        console.log('[useEffect] 🔄 앱 버전 변경 감지 - 캐시 초기화');
        clearCacheFromStorage();
        setMonthlyCache(new Map());
        setLoadedMonths(new Set());
        localStorage.setItem('scheduleAppVersion', currentVersion);
        console.log('[useEffect] 🗑️ 버전 업데이트로 인한 캐시 초기화 완료');
      }
    }
    
    // 로컬 스토리지에서 캐시 로드
    loadCacheFromStorage();
    
    // 디버그 함수를 window 객체에 추가
    if (typeof window !== 'undefined') {
      (window as any).scheduleCache = {
        getStats: getCacheStats,
        clearCache: clearCache,
        clearOldCache: clearOldCacheFromStorage,
        getLoadedMonths: () => Array.from(loadedMonths),
        getCacheSize: () => monthlyCache.size,
        forceLoad: (year: number, month: number) => loadAllGroupSchedules(year, month)
      };
    }

    const loadData = async () => {
      await fetchUserGroups();
    };
    
    loadData();
    
    // 페이지 가시성 변경 감지 (탭 전환 등)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[visibilityChange] 페이지가 다시 활성화됨');
        // 개발 환경에서는 페이지 활성화 시에도 캐시 체크
        if (process.env.NODE_ENV === 'development') {
          const lastUpdate = localStorage.getItem('scheduleLastUpdate');
          const now = Date.now().toString();
          
          // 마지막 업데이트 후 1분이 지났으면 캐시 초기화
          if (!lastUpdate || (Date.now() - parseInt(lastUpdate)) > 60000) {
            console.log('[visibilityChange] 🔄 개발 환경에서 캐시 갱신');
            clearCacheFromStorage();
            setMonthlyCache(new Map());
            setLoadedMonths(new Set());
            localStorage.setItem('scheduleLastUpdate', now);
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.body.style.overflowX = '';
      document.documentElement.style.overflowX = '';
      // 컴포넌트 언마운트 시 body 스크롤 복원
        document.body.style.overflow = '';
      
      // 이벤트 리스너 정리
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // 디버그 함수 정리
      if (typeof window !== 'undefined') {
        delete (window as any).scheduleCache;
      }
    };
  }, []);

  // userGroups가 로드된 후 스케줄 로드
  useEffect(() => {
    if (userGroups.length > 0) {
      console.log('[useEffect] userGroups 로드 완료, 스케줄 로드 시작');
      // 현재 월의 스케줄을 로드
      const now = dayjs();
      loadAllGroupSchedules(now.year(), now.month() + 1); // dayjs month는 0부터 시작하므로 +1
    }
  }, [userGroups]);

  // 선택된 그룹이 변경될 때 멤버 데이터 로드
  useEffect(() => {
    if (selectedGroupId) {
      fetchGroupMembers(selectedGroupId);
    }
  }, [selectedGroupId]);

  // 선택된 날짜의 일정들
  const eventsForSelectedDay = useMemo(() => {
    if (!selectedDay) {
      console.log('[eventsForSelectedDay] 선택된 날짜가 없음');
      return [];
    }
    
    const dateString = selectedDay.format('YYYY-MM-DD');
    console.log('[eventsForSelectedDay] 선택된 날짜:', dateString);
    console.log('[eventsForSelectedDay] 전체 이벤트 수:', events.length);
    console.log('[eventsForSelectedDay] 전체 이벤트 목록:', events);
    
    const filteredEvents = (events && Array.isArray(events)) ? events
      .filter(event => {
        const matches = event.date === dateString;
        // console.log(`[eventsForSelectedDay] 이벤트 "${event.title}" (${event.date}) - 매칭:`, matches);
        return matches;
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime)) : [];
    
    console.log('[eventsForSelectedDay] 필터링된 이벤트:', filteredEvents);
    return filteredEvents;
  }, [selectedDay, events]);

  const initialNewEventState: NewEvent = useMemo(() => ({
    title: '',
    date: selectedDay ? selectedDay.format('YYYY-MM-DD') : TODAY,
    startTime: '09:00',
    endTime: '10:00',
    allDay: false,
    repeat: '안함',
    alarm: '없음',
    locationName: '',
    locationAddress: '',
    locationLat: undefined, // 위도 초기값
    locationLng: undefined, // 경도 초기값
    content: '',
    groupName: '',
    groupColor: '',
    memberName: '',
    memberPhoto: '',
  }), [selectedDay]);

  const [newEvent, setNewEvent] = useState<NewEvent>(initialNewEventState);

  // 일정 저장 로딩 상태
  const [isSaving, setIsSaving] = useState(false);
  
  // tempDateTime을 newEvent와 동기화
  useEffect(() => {
    if (!isDateTimeModalOpen) {
      setTempDateTime({
        date: newEvent.date,
        startTime: newEvent.startTime,
        endTime: newEvent.endTime,
        allDay: newEvent.allDay
      });
    }
  }, [newEvent.date, newEvent.startTime, newEvent.endTime, newEvent.allDay, isDateTimeModalOpen]);

  useEffect(() => {
      setNewEvent(prev => ({
        ...prev,
      date: selectedDay ? selectedDay.format('YYYY-MM-DD') : TODAY,
      }));
  }, [selectedDay]);

  // 날짜/시간 유효성 검사 - tempDateTime 기반으로 수정
  useEffect(() => {
    // 날짜/시간 모달이 열려있지 않으면 검사하지 않음
    if (!isDateTimeModalOpen) {
      setDateTimeError(null);
      return;
    }

    let hasError = false;
    let focusTarget: string | null = null;

    // 현재 시간
    const now = dayjs();
    
    // 기본 필수 필드 검사
    if (!tempDateTime.date) {
      setDateTimeError(null);
      return;
    }

    // 날짜 형식 유효성 검사
    const eventDate = dayjs(tempDateTime.date);
    if (!eventDate.isValid()) {
      setDateTimeError('날짜 형식이 올바르지 않습니다.');
      return;
    }

    // 너무 먼 미래 날짜 검사 (10년 후까지만 허용)
    if (eventDate.isAfter(now.add(10, 'year'))) {
      setDateTimeError('10년 이후의 날짜는 설정할 수 없습니다.');
      hasError = true;
    }

    // 하루 종일이 아닌 경우 시간 검사
    if (!tempDateTime.allDay) {
      if (!tempDateTime.startTime) {
        setDateTimeError('시작 시간을 설정해주세요.');
        hasError = true;
      } else if (!tempDateTime.endTime) {
        setDateTimeError('종료 시간을 설정해주세요.');
        hasError = true;
      } else {
        // 시간 형식 유효성 검사
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(tempDateTime.startTime)) {
          setDateTimeError('시작 시간 형식이 올바르지 않습니다. (HH:MM)');
          hasError = true;
        } else if (!timeRegex.test(tempDateTime.endTime)) {
          setDateTimeError('종료 시간 형식이 올바르지 않습니다. (HH:MM)');
          hasError = true;
        } else {
          const startDateTime = dayjs(`${tempDateTime.date}T${tempDateTime.startTime}`);
          const endDateTime = dayjs(`${tempDateTime.date}T${tempDateTime.endTime}`);

          if (startDateTime.isValid() && endDateTime.isValid()) {
            // 종료 시간이 시작 시간보다 빠른 경우
            if (endDateTime.isBefore(startDateTime)) {
              setDateTimeError('종료 시간은 시작 시간보다 빠를 수 없습니다.');
              hasError = true;
            }
            // 시작 시간과 종료 시간이 같은 경우
            else if (tempDateTime.startTime === tempDateTime.endTime) {
              setDateTimeError('시작 시간과 종료 시간이 같을 수 없습니다.');
              hasError = true;
            }
            // 너무 짧은 일정 (5분 미만)
            else if (endDateTime.diff(startDateTime, 'minute') < 5) {
              setDateTimeError('일정은 최소 5분 이상이어야 합니다.');
              hasError = true;
            }
            // 너무 긴 일정 (24시간 초과)
            else if (endDateTime.diff(startDateTime, 'hour') > 24) {
              setDateTimeError('일정은 24시간을 초과할 수 없습니다.');
              hasError = true;
            }
          }
        }
      }
    }

    // 오류가 없으면 에러 상태 초기화
    if (!hasError) {
        setDateTimeError(null);
      }

  }, [tempDateTime.date, tempDateTime.startTime, tempDateTime.endTime, tempDateTime.allDay, isDateTimeModalOpen]);

  // 일반적인 경우(모달이 열려있지 않을 때)의 날짜/시간 유효성 검사
  useEffect(() => {
    // 날짜/시간 모달이 열려있으면 검사하지 않음
    if (isDateTimeModalOpen) {
      return;
    }

    let hasError = false;

    // 현재 시간
    const now = dayjs();
    
    // 기본 필수 필드 검사
    if (!newEvent.date) {
      setDateTimeError(null);
      return;
    }

    // 날짜 형식 유효성 검사
    const eventDate = dayjs(newEvent.date);
    if (!eventDate.isValid()) {
      setDateTimeError('날짜 형식이 올바르지 않습니다.');
      return;
    }

    // 너무 먼 미래 날짜 검사 (10년 후까지만 허용)
    if (eventDate.isAfter(now.add(10, 'year'))) {
      setDateTimeError('10년 이후의 날짜는 설정할 수 없습니다.');
      hasError = true;
    }

    // 하루 종일이 아닌 경우 시간 검사
    if (!newEvent.allDay) {
      if (!newEvent.startTime) {
        setDateTimeError('시작 시간을 설정해주세요.');
        hasError = true;
      } else if (!newEvent.endTime) {
        setDateTimeError('종료 시간을 설정해주세요.');
        hasError = true;
      } else {
        // 시간 형식 유효성 검사
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(newEvent.startTime)) {
          setDateTimeError('시작 시간 형식이 올바르지 않습니다. (HH:MM)');
          hasError = true;
        } else if (!timeRegex.test(newEvent.endTime)) {
          setDateTimeError('종료 시간 형식이 올바르지 않습니다. (HH:MM)');
          hasError = true;
        } else {
          const startDateTime = dayjs(`${newEvent.date}T${newEvent.startTime}`);
          const endDateTime = dayjs(`${newEvent.date}T${newEvent.endTime}`);

          if (startDateTime.isValid() && endDateTime.isValid()) {
            // 종료 시간이 시작 시간보다 빠른 경우
            if (endDateTime.isBefore(startDateTime)) {
              setDateTimeError('종료 시간은 시작 시간보다 빠를 수 없습니다.');
              hasError = true;
            }
            // 시작 시간과 종료 시간이 같은 경우
            else if (newEvent.startTime === newEvent.endTime) {
              setDateTimeError('시작 시간과 종료 시간이 같을 수 없습니다.');
              hasError = true;
            }
            // 너무 짧은 일정 (5분 미만)
            else if (endDateTime.diff(startDateTime, 'minute') < 5) {
              setDateTimeError('일정은 최소 5분 이상이어야 합니다.');
              hasError = true;
            }
            // 너무 긴 일정 (24시간 초과)
            else if (endDateTime.diff(startDateTime, 'hour') > 24) {
              setDateTimeError('일정은 24시간을 초과할 수 없습니다.');
              hasError = true;
            }
          }
        }
      }
    }

    // 오류가 없으면 에러 상태 초기화
    if (!hasError) {
        setDateTimeError(null);
      }

  }, [newEvent.date, newEvent.startTime, newEvent.endTime, newEvent.allDay, isDateTimeModalOpen]);

  // 시간 모달 스크롤 자동 조정
  useEffect(() => {
    if (isTimeModalOpen && hourScrollRef.current && minuteScrollRef.current) {
      // 약간의 지연을 두고 스크롤 (모달 애니메이션 완료 후)
      setTimeout(() => {
        if (hourScrollRef.current && minuteScrollRef.current) {
          try {
            // 실제 DOM 요소에서 버튼들 찾기
            const hourButtons = hourScrollRef.current.querySelectorAll('button');
            const minuteButtons = minuteScrollRef.current.querySelectorAll('button');
            
            console.log('[시간 스크롤] DOM 요소 확인:', {
              selectedHour,
              selectedMinute,
              hourButtonsCount: hourButtons.length,
              minuteButtonsCount: minuteButtons.length,
              hourScrollContainer: !!hourScrollRef.current,
              minuteScrollContainer: !!minuteScrollRef.current
            });
            
            if (hourButtons.length > 0 && minuteButtons.length > 0) {
              // 버튼 높이 측정
              const buttonHeight = hourButtons[0].offsetHeight;
              const containerHeight = hourScrollRef.current.clientHeight;
              
              // 시간 스크롤 계산
              const hourScrollTop = Math.max(0, (selectedHour * buttonHeight) - (containerHeight / 2) + (buttonHeight / 2));
              
              // 분 스크롤 계산 (5분 단위)
              const minuteIndex = selectedMinute / 5;
              const minuteScrollTop = Math.max(0, (minuteIndex * buttonHeight) - (containerHeight / 2) + (buttonHeight / 2));
              
              console.log('[시간 스크롤] 스크롤 계산:', {
                buttonHeight,
                containerHeight,
                hourScrollTop,
                minuteIndex,
                minuteScrollTop
              });
              
              // 스크롤 실행
              hourScrollRef.current.scrollTo({
                top: hourScrollTop,
                behavior: 'smooth'
              });
              
              minuteScrollRef.current.scrollTo({
                top: minuteScrollTop,
                behavior: 'smooth'
              });
              
              console.log('[시간 스크롤] 스크롤 실행 완료');
            } else {
              console.log('[시간 스크롤] 버튼을 찾을 수 없음');
            }
          } catch (error) {
            console.error('[시간 스크롤] 오류 발생:', error);
          }
        }
      }, 500); // 더 긴 지연시간으로 변경
    }
  }, [isTimeModalOpen, selectedHour, selectedMinute]);

  // 알림 모달 스크롤 자동 조정
  useEffect(() => {
    if (isAlarmModalOpen && alarmScrollRef.current) {
      // 약간의 지연을 두고 스크롤 (모달 애니메이션 완료 후)
      setTimeout(() => {
        if (alarmScrollRef.current) {
          const alarmOptions = ['없음', '정시', '5분 전', '10분 전', '15분 전', '30분 전', '1시간 전', '1일 전'];
          const selectedIndex = alarmOptions.indexOf(newEvent.alarm);
          
          if (selectedIndex >= 0) {
            // 각 알림 버튼 높이 약 56px (py-3 + 패딩)
            const itemHeight = 56;
            const scrollTop = selectedIndex * itemHeight - 100; // 100px = 컨테이너 높이의 절반 정도
            
            alarmScrollRef.current.scrollTo({
              top: Math.max(0, scrollTop),
              behavior: 'smooth'
            });
          }
        }
      }, 300);
    }
  }, [isAlarmModalOpen, newEvent.alarm]);

  // 그룹 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isGroupSelectorOpen) {
        const target = event.target as HTMLElement;
        if (!target.closest('.group-selector-container')) {
        setIsGroupSelectorOpen(false);
      }
    }
    };

    if (isGroupSelectorOpen) {
    document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isGroupSelectorOpen]);

  // newEvent 장소 정보 상태 변화 모니터링
  useEffect(() => {
    console.log("[newEvent 상태 변화] 📍 장소 정보 업데이트:", {
      locationName: newEvent.locationName,
      locationAddress: newEvent.locationAddress,
      locationLat: newEvent.locationLat,
      locationLng: newEvent.locationLng
    });
  }, [newEvent.locationName, newEvent.locationAddress, newEvent.locationLat, newEvent.locationLng]);
  // locationSearchResults 상태 변화 모니터링
  useEffect(() => {
    console.log('[locationSearchResults 상태 변화] 🔍 검색 결과 업데이트:', {
      length: locationSearchResults.length,
      results: locationSearchResults
    });
  }, [locationSearchResults]);



  // 일정 저장 - 실제 백엔드 API 사용
  const handleSaveEvent = useCallback(async () => {
    // 이미 저장 중이면 중복 실행 방지
    if (isSaving) {
      console.log('[handleSaveEvent] ⚠️ 이미 저장 중입니다. 중복 실행 방지');
      return;
    }

    // 로딩 상태 시작
    setIsSaving(true);

    // selectedEventDetails를 함수 시작 부분에서 미리 저장 (안전성 확보)
    const currentEventDetails = selectedEventDetails;

    console.log('[handleSaveEvent] 🔥 스케줄 저장 시작');
    console.log('[handleSaveEvent] 📝 현재 newEvent 상태:', newEvent);
    console.log('[handleSaveEvent] 📝 현재 selectedEventDetails 상태:', currentEventDetails);
    
    // 유효성 검사
    if (!newEvent.title || !newEvent.date) {
      console.log('[handleSaveEvent] ❌ 유효성 검사 실패: 제목 또는 날짜 없음');
      openSuccessModal('입력 오류', '제목과 날짜는 필수 입력 항목입니다.', 'error');
      setIsSaving(false); // 유효성 검사 실패 시 로딩 해제
      return;
        }

    if (dateTimeError) {
      console.log('[handleSaveEvent] ❌ 날짜/시간 오류:', dateTimeError);
      openSuccessModal('날짜/시간 오류', '날짜/시간 설정에 오류가 있습니다. 확인 후 다시 시도해주세요.', 'error');
      setIsSaving(false); // 날짜/시간 오류 시 로딩 해제
      return;
    }

    if (!newEvent.allDay && (!newEvent.startTime || !newEvent.endTime)) {
      console.log('[handleSaveEvent] ❌ 시간 입력 오류: 시작/종료 시간 없음');
      openSuccessModal('시간 입력 오류', '시작 시간과 종료 시간을 설정해주세요.', 'error');
      setIsSaving(false); // 시간 입력 오류 시 로딩 해제
      return;
    }

    if (!selectedGroupId) {
      console.log('[handleSaveEvent] ❌ 그룹 선택 오류: selectedGroupId 없음');
      openSuccessModal('그룹 선택 오류', '그룹을 선택해주세요.', 'error');
      setIsSaving(false); // 그룹 선택 오류 시 로딩 해제
      return;
    }

    // 현재 사용자의 권한 확인 (로그인한 사용자)
    const currentUser = (scheduleGroupMembers && Array.isArray(scheduleGroupMembers)) ? scheduleGroupMembers.find(member => member.isSelected) : null;
    const isOwnerOrLeader = currentUser && 
      (currentUser.sgdt_owner_chk === 'Y' || currentUser.sgdt_leader_chk === 'Y');

    console.log('[handleSaveEvent] 👤 권한 정보:', {
      currentUser: currentUser?.name,
      selectedMemberId,
      isOwnerOrLeader,
      sgdt_owner_chk: currentUser?.sgdt_owner_chk,
      sgdt_leader_chk: currentUser?.sgdt_leader_chk
    });

    // 다른 멤버의 스케줄을 생성/수정하려는 경우 권한 확인
    if (selectedMemberId && selectedMemberId !== currentUser?.id && !isOwnerOrLeader) {
      console.log('[handleSaveEvent] ❌ 권한 없음: 다른 멤버 스케줄 관리 권한 없음');
      openSuccessModal('권한 오류', '다른 멤버의 스케줄을 관리할 권한이 없습니다.', 'error');
      setIsSaving(false); // 권한 오류 시 로딩 해제
      return;
    }

    try {
      console.log('[handleSaveEvent] ✅ 유효성 검사 통과, 데이터 처리 시작');

      // 날짜/시간 형식 변환
      const startDateTime = newEvent.allDay 
        ? `${newEvent.date}T00:00:00`
        : `${newEvent.date}T${newEvent.startTime}:00`;
      
      const endDateTime = newEvent.allDay 
        ? `${newEvent.date}T23:59:59`
        : `${newEvent.date}T${newEvent.endTime}:00`;

      console.log('[handleSaveEvent] 📅 날짜/시간 변환:', {
        원본_날짜: newEvent.date,
        원본_시작시간: newEvent.startTime,
        원본_종료시간: newEvent.endTime,
        하루종일: newEvent.allDay,
        변환된_시작시간: startDateTime,
        변환된_종료시간: endDateTime
      });

      // 반복 설정 JSON 변환 (사용자 요구사항에 맞게)
      const getRepeatJson = (repeat: string, allDay: boolean): { sst_repeat_json: string, sst_repeat_json_v: string } => {
        console.log('[getRepeatJson] 🔄 반복 설정 처리:', { repeat, allDay });
        
        if (allDay) {
          // 하루종일인 경우: null 값
          console.log('[getRepeatJson] 🔄 하루종일이므로 반복 설정 null로 변경');
          return { sst_repeat_json: '', sst_repeat_json_v: '' };
        }

        switch (repeat) {
          case '매일':
            console.log('[getRepeatJson] 🔄 매일 반복 설정');
            return { sst_repeat_json: '{"r1":"2","r2":""}', sst_repeat_json_v: '매일' };
          case '매주':
            // 현재 날짜의 요일 계산 (일요일=0, 월요일=1, ...)
            const dayOfWeek = dayjs(newEvent.date).day();
            const weekDays = dayOfWeek === 0 ? '7' : dayOfWeek.toString(); // 일요일을 7로 변환
            console.log('[getRepeatJson] 🔄 매주 반복 설정:', { dayOfWeek, weekDays });
            return { sst_repeat_json: `{"r1":"3","r2":"${weekDays}"}`, sst_repeat_json_v: `1주마다 ${['일', '월', '화', '수', '목', '금', '토'][dayOfWeek]}` };
          default:
            // 매주 다중 요일 선택 처리
            if (repeat.startsWith('매주 ')) {
              const selectedDays = repeat.replace('매주 ', '');
              const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
              const selectedWeekdayIndices: string[] = [];
              
              if (selectedDays) {
                selectedDays.split(',').forEach(dayName => {
                  const index = dayNames.indexOf(dayName.trim());
                  if (index !== -1) {
                    // 일요일(0)을 7로 변환, 나머지는 그대로
                    selectedWeekdayIndices.push(index === 0 ? '7' : index.toString());
                  }
                });
              }
              
              const weekdaysString = selectedWeekdayIndices.join(',');
              console.log('[getRepeatJson] 🔄 매주 다중 요일 반복 설정:', { 
                selectedDays, 
                selectedWeekdayIndices, 
                weekdaysString 
              });
              
          return {
                sst_repeat_json: `{"r1":"3","r2":"${weekdaysString}"}`, 
                sst_repeat_json_v: `1주마다 ${selectedDays}` 
              };
            }
            
          case '매월':
            console.log('[getRepeatJson] 🔄 매월 반복 설정');
            return { sst_repeat_json: '{"r1":"4","r2":""}', sst_repeat_json_v: '매월' };
          case '매년':
            console.log('[getRepeatJson] 🔄 매년 반복 설정');
            return { sst_repeat_json: '{"r1":"5","r2":""}', sst_repeat_json_v: '매년' };
          case '안함':
            console.log('[getRepeatJson] 🔄 반복 안함 설정');
            return { sst_repeat_json: '', sst_repeat_json_v: '' };
        }
      };

      const repeatData = getRepeatJson(newEvent.repeat, newEvent.allDay);
      console.log('[handleSaveEvent] 🔄 최종 반복 데이터:', repeatData);

      // 알림 시간 타입과 값 계산 함수
      function getAlarmPickType(alarm: string): string {
        console.log('[getAlarmPickType] 🔔 알림 타입 계산:', alarm);
        if (alarm.includes('분')) return 'minute';
        if (alarm.includes('시간')) return 'hour';
        if (alarm.includes('일')) return 'day';
        return 'minute';
      }

      function getAlarmPickResult(alarm: string): string {
        console.log('[getAlarmPickResult] 🔔 알림 값 계산:', alarm);
        const match = alarm.match(/(\d+)/);
        const result = match ? match[1] : '0';
        console.log('[getAlarmPickResult] 🔔 추출된 숫자:', result);
        return result;
      }

      // 알림 시간 계산 함수 (sst_sdate에서 알림 시간만큼 빼기)
      function calculateAlarmTime(startDateTime: string, alarm: string): string {
        console.log('[calculateAlarmTime] 🔔 알림 시간 계산 시작:', { startDateTime, alarm });
        
        if (alarm === '없음' || alarm === '정시') {
          console.log('[calculateAlarmTime] 🔔 알림 없음 또는 정시');
          return startDateTime;
        }

        const startTime = dayjs(startDateTime);
        let alarmTime = startTime;

        if (alarm.includes('분 전')) {
          const minutes = parseInt(alarm.match(/(\d+)/)?.[1] || '0');
          alarmTime = startTime.subtract(minutes, 'minute');
          console.log('[calculateAlarmTime] 🔔 분 단위 알림:', { minutes, alarmTime: alarmTime.format() });
        } else if (alarm.includes('시간 전')) {
          const hours = parseInt(alarm.match(/(\d+)/)?.[1] || '0');
          alarmTime = startTime.subtract(hours, 'hour');
          console.log('[calculateAlarmTime] 🔔 시간 단위 알림:', { hours, alarmTime: alarmTime.format() });
        } else if (alarm.includes('일 전')) {
          const days = parseInt(alarm.match(/(\d+)/)?.[1] || '0');
          alarmTime = startTime.subtract(days, 'day');
          console.log('[calculateAlarmTime] 🔔 일 단위 알림:', { days, alarmTime: alarmTime.format() });
        }

        const result = alarmTime.format('YYYY-MM-DD HH:mm:ss');
        console.log('[calculateAlarmTime] 🔔 최종 알림 시간:', result);
        return result;
      }

      const alarmPickType = newEvent.alarm === '없음' ? '' : getAlarmPickType(newEvent.alarm);
      const alarmPickResult = newEvent.alarm === '없음' ? '' : getAlarmPickResult(newEvent.alarm);
      const calculatedAlarmTime = calculateAlarmTime(startDateTime, newEvent.alarm);
      
      console.log('[handleSaveEvent] 🔔 알림 설정 처리:', {
        원본_알림: newEvent.alarm,
        알림_여부: newEvent.alarm === '없음' ? 'N' : 'Y',
        알림_시간: newEvent.alarm === '없음' ? '' : newEvent.alarm,
        알림_타입: alarmPickType,
        알림_값: alarmPickResult,
        계산된_알림시간: calculatedAlarmTime,
        스케줄_체크: 'Y'
      });

      // 선택된 멤버 정보 찾기
      let selectedMember: ScheduleGroupMember | undefined;
      
      // 수정 모드인지 확인
      const isEditMode = newEvent.id && currentEventDetails;
      
      if (isEditMode) {
        // 수정 모드: 원래 일정의 담당자 정보 유지
        console.log('[handleSaveEvent] ✏️ 수정 모드 - 원래 담당자 정보 유지');
        console.log('[handleSaveEvent] 🎯 원래 일정 정보:', {
          memberIdx: currentEventDetails.memberIdx,
          tgtMtIdx: currentEventDetails.tgtMtIdx,
          tgtSgdtIdx: currentEventDetails.tgtSgdtIdx,
          memberName: currentEventDetails.memberName
        });
        
        // 원래 일정의 담당자 정보로 selectedMember 구성
        const originalMemberInfo = {
          id: currentEventDetails.tgtMtIdx?.toString() || currentEventDetails.memberIdx?.toString() || '',
          name: currentEventDetails.memberName || '',
          photo: currentEventDetails.memberPhoto || null,
          isSelected: false,
          mt_gender: currentEventDetails.memberGender || null,
          mt_idx: currentEventDetails.tgtMtIdx || currentEventDetails.memberIdx || 0,
          mt_name: currentEventDetails.memberName || '',
          sgdt_idx: currentEventDetails.tgtSgdtIdx,
          sgdt_owner_chk: currentEventDetails.tgtSgdtOwnerChk || 'N',
          sgdt_leader_chk: currentEventDetails.tgtSgdtLeaderChk || 'N',
          mlt_lat: null,
          mlt_long: null,
          mlt_speed: null,
          mlt_battery: null,
          mlt_gps_time: null
        };
        
        selectedMember = originalMemberInfo;
        console.log('[handleSaveEvent] 🎯 원래 담당자 정보 사용:', {
          mt_idx: selectedMember.mt_idx,
          sgdt_idx: selectedMember.sgdt_idx,
          name: selectedMember.name
        });
      } else {
        // 신규 생성 모드: 현재 선택된 멤버 사용
        console.log('[handleSaveEvent] ➕ 신규 생성 모드 - 선택된 멤버 사용');
        
        if (selectedMemberId) {
          // selectedMemberId가 있으면 해당 멤버만 찾기
          selectedMember = (scheduleGroupMembers && Array.isArray(scheduleGroupMembers)) ? scheduleGroupMembers.find(member => member.id === selectedMemberId) : undefined;
          console.log('[handleSaveEvent] 🎯 selectedMemberId로 멤버 찾기:', {
            selectedMemberId,
            foundMember: selectedMember ? {
              id: selectedMember.id,
              name: selectedMember.name,
              mt_idx: selectedMember.mt_idx,
              sgdt_idx: selectedMember.sgdt_idx
            } : null
          });
        } else {
          // selectedMemberId가 없으면 기본 선택된 멤버 사용
          selectedMember = (scheduleGroupMembers && Array.isArray(scheduleGroupMembers)) ? scheduleGroupMembers.find(member => member.isSelected) : undefined;
          console.log('[handleSaveEvent] 🎯 기본 선택된 멤버 사용:', {
            foundMember: selectedMember ? {
              id: selectedMember.id,
              name: selectedMember.name,
              mt_idx: selectedMember.mt_idx,
              sgdt_idx: selectedMember.sgdt_idx
            } : null
          });
        }
        
        // 멤버를 찾지 못한 경우에만 첫 번째 멤버 사용
        if (!selectedMember && scheduleGroupMembers.length > 0) {
          selectedMember = scheduleGroupMembers[0];
          console.log('[handleSaveEvent] 🎯 첫 번째 멤버 사용:', {
            foundMember: {
              id: selectedMember.id,
              name: selectedMember.name,
              mt_idx: selectedMember.mt_idx,
              sgdt_idx: selectedMember.sgdt_idx
            }
          });
        }
      }

      console.log('[handleSaveEvent] 🔍 멤버 선택 디버깅:', {
        selectedMemberId,
        scheduleGroupMembersCount: scheduleGroupMembers.length,
        scheduleGroupMembers: (scheduleGroupMembers && Array.isArray(scheduleGroupMembers)) ? scheduleGroupMembers.map(m => ({
          id: m.id,
          name: m.name,
          mt_idx: m.mt_idx,
          sgdt_idx: m.sgdt_idx,
          isSelected: m.isSelected
        })) : [],
        currentMember: currentUser ? {
          id: currentUser.id,
          name: currentUser.name,
          mt_idx: currentUser.mt_idx,
          sgdt_idx: currentUser.sgdt_idx
        } : null
      });

      console.log('[handleSaveEvent] 👤 선택된 멤버 정보:', {
        selectedMemberId,
        selectedMember: selectedMember?.name,
        mt_idx: selectedMember?.mt_idx,
        sgdt_idx: selectedMember?.sgdt_idx // 실제 sgdt_idx 필드 사용
      });

      // PHP 로직 기반 요청 데이터 구성
      const requestData = {
        sst_title: newEvent.title,
        sst_sdate: startDateTime,
        sst_edate: endDateTime,
        sst_all_day: (newEvent.allDay ? 'Y' : 'N') as 'Y' | 'N',
        sst_location_title: newEvent.locationName || undefined,
        sst_location_add: newEvent.locationAddress || undefined,
        sst_location_lat: newEvent.locationLat, // 위도 추가
        sst_location_long: newEvent.locationLng, // 경도 추가
        sst_memo: newEvent.content || undefined,
        sst_content: newEvent.content || undefined, // PHP에서 memo와 content 둘 다 사용
        sst_alram: newEvent.alarm === '없음' ? 'N' : 'Y',
        sst_schedule_alarm_chk: newEvent.alarm === '없음' ? 'N' : 'Y',
        sst_schedule_chk: 'Y', // 항상 'Y'로 설정
        sst_schedule_alarm: calculatedAlarmTime, // 계산된 알림 시간
        sst_repeat_json: repeatData.sst_repeat_json,
        sst_repeat_json_v: repeatData.sst_repeat_json_v,
        sst_update_chk: 'Y',
        sst_location_alarm: 'N',
        sst_supplies: '', // 준비물 (향후 추가 가능)
        sst_place: newEvent.locationName || '', // 장소명
        // 알림 관련 필드들 - sst_alarm_t에 선택한 알림 시간 저장
        sst_alarm_t: newEvent.alarm === '없음' ? '' : newEvent.alarm,
        sst_pick_type: alarmPickType,
        sst_pick_result: alarmPickResult,
        // 다른 멤버의 스케줄 생성 시
        targetMemberId: selectedMember?.mt_idx || undefined,
        sgdt_idx: selectedMember?.sgdt_idx || undefined, // 실제 sgdt_idx 필드 사용
      };

      console.log('[handleSaveEvent] 📦 최종 요청 데이터:', requestData);

      if (newEvent.id) {
        console.log('[handleSaveEvent] ✏️ 스케줄 수정 모드');
        // 수정
        const updateData = {
          sst_idx: parseInt(newEvent.id!),
          groupId: selectedGroupId,
          sst_title: newEvent.title,
          sst_sdate: startDateTime,
          sst_edate: endDateTime,
          sst_all_day: (newEvent.allDay ? 'Y' : 'N') as 'Y' | 'N',
          sst_location_title: newEvent.locationName || undefined,
          sst_location_add: newEvent.locationAddress || undefined,
          sst_location_lat: newEvent.locationLat,
          sst_location_long: newEvent.locationLng,
          sst_memo: newEvent.content || undefined,
          sst_alram: 0, // 기존 호환성
          // 새로운 필드들
          sst_repeat_json: repeatData.sst_repeat_json,
          sst_repeat_json_v: repeatData.sst_repeat_json_v,
          sst_alram_t: newEvent.alarm === '없음' ? '' : newEvent.alarm,
          sst_schedule_alarm_chk: (newEvent.alarm === '없음' ? 'N' : 'Y') as 'Y' | 'N',
          sst_pick_type: alarmPickType,
          sst_pick_result: alarmPickResult,
          // 반복 일정 처리 옵션
          editOption: newEvent.editOption,
          // 실제 수정한 사람 (현재 로그인한 사용자)
          editorId: user?.mt_idx || undefined,
          editorName: user?.mt_name || undefined,
          // 선택된 멤버 정보 (일정의 대상자)
          targetMemberId: selectedMember?.mt_idx || undefined,
          sgdt_idx: selectedMember?.sgdt_idx || undefined,
        };

        console.log('[handleSaveEvent] 🔄 수정 요청 데이터:', updateData);
        
        let response;
        if (newEvent.editOption && newEvent.editOption !== 'this') {
          // 반복 일정 처리 옵션이 있는 경우
          response = await scheduleService.updateScheduleWithRepeatOption(updateData);
        } else {
          // 일반 수정
          response = await scheduleService.updateSchedule(updateData);
        }
        
        console.log('[handleSaveEvent] 🔄 수정 응답:', response);

        if (response.success) {
          console.log('[handleSaveEvent] ✅ 스케줄 수정 성공');
          
          // currentEventDetails 안전성 검사 및 대안 처리
          let originalEventDetails: ScheduleEvent;
          let originalEventId: string;
          
          if (currentEventDetails) {
            // currentEventDetails가 있는 경우 사용
            originalEventDetails = { ...currentEventDetails };
            originalEventId = originalEventDetails.id;
            console.log('[handleSaveEvent] ✅ currentEventDetails 사용');
          } else {
            // currentEventDetails가 null인 경우 newEvent.id를 사용하여 events에서 찾기
            console.warn('[handleSaveEvent] ⚠️ currentEventDetails가 null, events에서 찾기 시도');
            const foundEvent = (events && Array.isArray(events)) ? events.find(event => event.id === newEvent.id) : null;
            
            if (foundEvent) {
              originalEventDetails = { ...foundEvent };
              originalEventId = foundEvent.id;
              console.log('[handleSaveEvent] ✅ events에서 이벤트 찾음:', foundEvent.title);
            } else {
              console.error('[handleSaveEvent] ❌ events에서도 이벤트를 찾을 수 없음');
              openSuccessModal('수정 오류', '선택된 이벤트 정보를 찾을 수 없습니다.', 'error');
              return;
            }
          }
          
          // 수정된 이벤트 객체 생성
          const updatedEvent: ScheduleEvent = {
            ...originalEventDetails,
            id: originalEventId,
            title: newEvent.title,
            date: newEvent.date,
            startTime: newEvent.startTime,
            endTime: newEvent.endTime,
            content: newEvent.content,
            locationName: newEvent.locationName,
            locationAddress: newEvent.locationAddress,
            locationLat: newEvent.locationLat,
            locationLng: newEvent.locationLng,
            hasAlarm: newEvent.alarm !== '없음',
            alarmText: newEvent.alarm !== '없음' ? `알림 ${newEvent.alarm}` : '알림 OFF',
            alarmTime: newEvent.alarm !== '없음' ? newEvent.alarm : '',
            repeatText: newEvent.repeat === '안함' ? '없음' : newEvent.repeat,
            isAllDay: newEvent.allDay,
            repeatJsonV: repeatData.sst_repeat_json_v
          };
          
          // 로컬 상태에서 즉시 업데이트 (UI 즉시 반영)
          setEvents(prev => (prev && Array.isArray(prev)) ? prev.map(event => 
            event.id === originalEventId ? updatedEvent : event
          ) : []);
          
          // 캐시에서도 업데이트
          updateCacheForEvent(updatedEvent, 'update');
          
          // 수정 성공 시 로컬 스토리지 캐시 완전 초기화
          clearCacheFromStorage();
          console.log('[handleSaveEvent] 🗑️ 수정 후 로컬 스토리지 캐시 완전 초기화');

          // 푸시 알림은 백엔드에서 자동으로 처리됨 (중복 전송 방지)
          console.log('[handleSaveEvent] ℹ️ 푸시 알림은 백엔드에서 자동 처리됨 (수정 시)');

          // 성공적으로 완료되었을 때만 모달 닫기
          setIsAddEventModalOpen(false);
          setNewEvent(initialNewEventState);
          setSelectedEventDetails(null);
          setDateTimeError(null);

          // 로딩 상태 해제
          setIsSaving(false);
          
          // 일정 수정 후 캐시 무효화 및 강제 새로고침
          const currentDate = dayjs();
          const cacheKey = `${currentDate.year()}-${String(currentDate.month() + 1).padStart(2, '0')}`;
          
          console.log('[handleSaveEvent] 🗑️ 일정 수정 후 캐시 무효화:', cacheKey);
          
          // 현재 월의 메모리 캐시 무효화
          setMonthlyCache(prev => {
            const newCache = new Map(prev);
            newCache.delete(cacheKey);
            return newCache;
          });
          
          // 로드된 월 정보 무효화
          setLoadedMonths(prev => {
            const newSet = new Set(prev);
            newSet.delete(cacheKey);
            return newSet;
          });
          
          // 로컬 스토리지 캐시도 완전 초기화
          clearCacheFromStorage();
          
          // DataCacheContext의 스케줄 캐시 무효화
          if (selectedGroupId) {
            console.log('[handleSaveEvent] 🗑️ DataCacheContext 스케줄 캐시 무효화:', selectedGroupId);
            invalidateCache('scheduleData', selectedGroupId);
          }
          
          // 서버에서 최신 데이터 강제 로드
          await loadAllGroupSchedules(undefined, undefined, true, true);
          
          // 성공 토스트 모달 표시 (3초 후 자동 닫기)
          const updateMessage = newEvent.editOption === 'all' 
            ? '모든 반복 일정이 성공적으로 수정되었습니다.'
            : newEvent.editOption === 'future'
            ? '현재 이후의 반복 일정이 성공적으로 수정되었습니다.'
            : '일정이 성공적으로 수정되었습니다.';
          
          showToastModal('success', '일정 수정 완료', updateMessage);
        } else {
          console.log('[handleSaveEvent] ❌ 스케줄 수정 실패:', response.error);
          openSuccessModal('일정 수정 실패', response.error || '일정 수정에 실패했습니다.', 'error');
          setIsSaving(false); // 수정 실패 시 로딩 해제
          return;
        }
      } else {
        console.log('[handleSaveEvent] ➕ 스케줄 생성 모드');
        // 추가
        const createData = {
          groupId: selectedGroupId,
          // 실제 생성한 사람 (현재 로그인한 사용자)
          editorId: user?.mt_idx || undefined,
          editorName: user?.mt_name || undefined,
          // 일정의 대상자
          targetMemberId: selectedMember?.mt_idx || undefined,
          sgdt_idx: selectedMember?.sgdt_idx || undefined, // 타겟 멤버의 그룹 상세 인덱스
          sst_title: newEvent.title,
          sst_sdate: startDateTime,
          sst_edate: endDateTime,
          sst_all_day: (newEvent.allDay ? 'Y' : 'N') as 'Y' | 'N',
          sst_location_title: newEvent.locationName,
          sst_location_add: newEvent.locationAddress,
          sst_location_lat: newEvent.locationLat, // 위도 추가
          sst_location_long: newEvent.locationLng, // 경도 추가
          sst_memo: newEvent.content,
          sst_alram: 0, // 기존 인터페이스 유지
          // 새로운 필드들 추가
          sst_repeat_json: repeatData.sst_repeat_json,
          sst_repeat_json_v: repeatData.sst_repeat_json_v,
          sst_alram_t: newEvent.alarm === '없음' ? '' : newEvent.alarm,
          sst_schedule_alarm_chk: (newEvent.alarm === '없음' ? 'N' : 'Y') as 'Y' | 'N',
          sst_schedule_alarm: calculatedAlarmTime, // 계산된 알림 시간 추가
          sst_pick_type: alarmPickType,
          sst_pick_result: alarmPickResult,
        };

        console.log('[handleSaveEvent] ➕ 생성 요청 데이터:', createData);
        const response = await scheduleService.createSchedule(createData);
        console.log('[handleSaveEvent] ➕ 생성 응답:', response);

        if (response.success && response.data) {
          console.log('[handleSaveEvent] ✅ 스케줄 생성 성공:', response.data);
          
          // 새로 생성된 이벤트를 캐시에 추가
          const newEventForCache: ScheduleEvent = {
            id: response.data.sst_idx?.toString() || `temp-${Date.now()}`,
            sst_idx: response.data.sst_idx,
            date: newEvent.date,
            startTime: newEvent.startTime,
            endTime: newEvent.endTime,
            title: newEvent.title,
            content: newEvent.content,
            groupId: selectedGroupId,
            groupName: newEvent.groupName,
            groupColor: newEvent.groupColor,
            memberName: selectedMember?.mt_name || selectedMember?.name || '',
            memberNickname: selectedMember?.mt_nickname || selectedMember?.mt_name || selectedMember?.name || '',
            memberPhoto: selectedMember?.mt_file1 || selectedMember?.photo || '',
            memberGender: selectedMember?.mt_gender || null,
            memberIdx: selectedMember?.mt_idx || 0,
            canEdit: true,
            canDelete: true,
            locationName: newEvent.locationName,
            locationAddress: newEvent.locationAddress,
            locationLat: newEvent.locationLat,
            locationLng: newEvent.locationLng,
            hasAlarm: newEvent.alarm !== '없음',
            alarmText: newEvent.alarm !== '없음' ? `알림 ${newEvent.alarm}` : '알림 OFF',
            alarmTime: newEvent.alarm !== '없음' ? newEvent.alarm : '',
            repeatText: newEvent.repeat === '안함' ? '없음' : newEvent.repeat,
            isAllDay: newEvent.allDay,
            tgtMtIdx: selectedMember?.mt_idx || null,
            repeatJsonV: repeatData.sst_repeat_json_v,
            tgtSgdtOwnerChk: (selectedMember?.sgdt_owner_chk as 'Y' | 'N') || 'N',
            tgtSgdtLeaderChk: (selectedMember?.sgdt_leader_chk as 'Y' | 'N') || 'N',
            tgtSgdtIdx: selectedMember?.sgdt_idx,
            sst_pidx: undefined
          };
          
          // 로컬 상태에 즉시 추가 (UI 즉시 반영)
          setEvents(prev => [...prev, newEventForCache]);
          
          // 캐시에 새 이벤트 추가
          updateCacheForEvent(newEventForCache, 'add');
          
          // 푸시 알림은 백엔드에서 자동으로 처리됨 (중복 전송 방지)
          console.log('[handleSaveEvent] ℹ️ 푸시 알림은 백엔드에서 자동 처리됨 (생성 시)');

          // 성공적으로 완료되었을 때만 모달 닫기
          setIsAddEventModalOpen(false);
          setNewEvent(initialNewEventState);
          setSelectedEventDetails(null);

          // 로딩 상태 해제
          setIsSaving(false);
          setDateTimeError(null);
          
          // 새 일정 추가 후에는 전체 새로고침 대신 캐시 업데이트만 수행
          console.log('[handleSaveEvent] ✅ 새 일정 추가 완료 - 캐시만 업데이트');
          
          // DataCacheContext의 스케줄 캐시만 무효화 (전체 리로드 방지)
          if (selectedGroupId) {
            console.log('[handleSaveEvent] 🗑️ DataCacheContext 스케줄 캐시 무효화 (생성):', selectedGroupId);
            invalidateCache('scheduleData', selectedGroupId);
          }
          
          // 성공 토스트 모달 표시 (3초 후 자동 닫기)
          showToastModal('success', '일정 등록 완료', '일정이 성공적으로 등록되었습니다.');
        } else {
          console.log('[handleSaveEvent] ❌ 스케줄 생성 실패:', response.error);
          openSuccessModal('일정 등록 실패', response.error || '일정 등록에 실패했습니다.', 'error');
          setIsSaving(false); // 생성 실패 시 로딩 해제
          return;
        }
      }
      
    } catch (error) {
      console.error('[handleSaveEvent] 💥 스케줄 저장 중 예외 발생:', error);

      // 로딩 상태 해제
      setIsSaving(false);

      openSuccessModal('일정 저장 실패', '일정 저장 중 오류가 발생했습니다.', 'error');
    }
  }, [selectedEventDetails, newEvent, selectedGroupId, scheduleGroupMembers, invalidateCache, selectedMemberId]);

  // 일정 삭제 - 권한 확인 포함
  const handleDeleteEvent = async () => {
    if (!selectedEventDetails) {
      return;
    }

    if (!selectedEventDetails.sst_idx) {
      openSuccessModal('삭제 오류', '삭제할 수 없는 스케줄입니다.', 'error');
      return;
    }

    if (!selectedGroupId) {
      openSuccessModal('그룹 오류', '그룹 정보가 없습니다.', 'error');
      return;
    }

    // 현재 사용자의 권한 확인
    const currentMember = (scheduleGroupMembers && Array.isArray(scheduleGroupMembers)) ? scheduleGroupMembers.find(member => member.isSelected) : null;
    const isOwnerOrLeader = currentMember && 
      (currentMember.sgdt_owner_chk === 'Y' || currentMember.sgdt_leader_chk === 'Y');

    // 삭제 권한 확인 - 자신의 스케줄이거나 오너/리더인 경우만 삭제 가능
    if (!selectedEventDetails.canDelete && !isOwnerOrLeader) {
      openSuccessModal('권한 오류', '이 스케줄을 삭제할 권한이 없습니다.', 'error');
      return;
    }

    const confirmDelete = confirm('정말로 이 스케줄을 삭제하시겠습니까?');
    if (!confirmDelete) {
      return;
    }

    try {
      console.log('[handleDeleteEvent] 스케줄 삭제 시작:', {
        sst_idx: selectedEventDetails.sst_idx,
        groupId: selectedGroupId,
        hasPermission: isOwnerOrLeader,
        canDelete: selectedEventDetails.canDelete
      });

      const response = await scheduleService.deleteSchedule(
        selectedEventDetails.sst_idx,
        selectedGroupId,
        {
          editorId: user?.mt_idx || undefined,
          editorName: user?.mt_name || undefined
        }
      );

      if (response.success) {
        console.log('[handleDeleteEvent] 스케줄 삭제 성공');
        
        // 로컬 상태에서 즉시 제거 (UI 즉시 반영)
        setEvents(prev => (prev && Array.isArray(prev)) ? prev.filter(event => event.id !== selectedEventDetails.id) : []);
        setSelectedEventDetails(null);
        
        // 캐시에서도 제거  
        updateCacheForEvent(selectedEventDetails, 'delete');
        
        // 삭제 성공 시 로컬 스토리지 캐시 완전 초기화
        clearCacheFromStorage();
        console.log('[handleDeleteEvent] 🗑️ 삭제 후 로컬 스토리지 캐시 완전 초기화');
        
        // DataCacheContext의 스케줄 캐시 무효화
        if (selectedGroupId) {
          console.log('[handleDeleteEvent] 🗑️ DataCacheContext 스케줄 캐시 무효화 (삭제):', selectedGroupId);
          invalidateCache('scheduleData', selectedGroupId);
        }
        
        // 백그라운드에서 서버 동기화
        await loadAllGroupSchedules(undefined, undefined, true, true);
        
        // 성공 토스트 모달 표시 (3초 후 자동 닫기)
        showToastModal('success', '일정 삭제 완료', '일정이 성공적으로 삭제되었습니다.');
      } else {
        openSuccessModal('일정 삭제 실패', response.error || '일정 삭제에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('[handleDeleteEvent] 스케줄 삭제 실패:', error);
      openSuccessModal('일정 삭제 실패', '일정 삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  // 일정 수정 모달 열기
  const handleOpenEditModal = () => {
    if (selectedEventDetails) {
      // 알림 텍스트 역변환 함수
      const convertAlarmTextToSelect = (alarmTime: string, hasAlarm: boolean): string => {
        if (!hasAlarm || !alarmTime) return '없음';
        return alarmTime; // 백엔드에서 받은 알림 시간 그대로 사용
      };

      setNewEvent({
        id: selectedEventDetails.id,
        title: selectedEventDetails.title,
        date: selectedEventDetails.date,
        startTime: selectedEventDetails.startTime,
        endTime: selectedEventDetails.endTime,
        allDay: selectedEventDetails.isAllDay || false, // 하루종일 설정 로드
        repeat: selectedEventDetails.repeatText || '', // 반복 설정 역변환
        alarm: convertAlarmTextToSelect(selectedEventDetails.alarmTime || '', selectedEventDetails.hasAlarm || false), // 알림 설정 역변환
        locationName: selectedEventDetails.locationName || '',
        locationAddress: selectedEventDetails.locationAddress || '',
        locationLat: selectedEventDetails.locationLat, // 위도 로드
        locationLng: selectedEventDetails.locationLng, // 경도 로드
        content: selectedEventDetails.content || '',
        groupName: selectedEventDetails.groupName || '',
        groupColor: selectedEventDetails.groupColor || '',
        memberName: selectedEventDetails.memberName || '',
        memberPhoto: '', // 빈 문자열로 설정하여 로컬 이미지 사용
      });
      
      // 매주 다중 요일 선택이 된 경우 요일 선택기 상태 설정
      const repeatText = selectedEventDetails.repeatText || '';
      if (repeatText.includes('매주') && repeatText !== '매주') {
        setShowWeekdaySelector(true);

        // 다양한 형식 지원: "매주 (수)", "매주(수)", "매주 수요일", "매주 월,화,수" 등
        let dayPart = '';
        const parenMatch = repeatText.match(/\((.*?)\)/);
        if (parenMatch && parenMatch[1]) {
          dayPart = parenMatch[1];
        } else {
          // 괄호 없는 경우 (예: "매주 수요일")
          const parts = repeatText.split(' ');
          if (parts.length > 1) {
            dayPart = parts.slice(1).join(' ');
          }
        }

        if (dayPart) {
          const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
          const weekdayIndices = new Set<number>();

          // 여러 요일 처리 (쉼표로 구분)
          const dayNamesToProcess = dayPart.split(',').map(name => name.trim());

          dayNamesToProcess.forEach(dayName => {
            // 단일 글자 요일명으로 변환 (예: "수요일" -> "수")
            let shortName = dayName;
            if (dayName.length > 1) {
              // "수요일" -> "수" 변환
              const dayMapping: { [key: string]: string } = {
                '일요일': '일', '월요일': '월', '화요일': '화', '수요일': '수',
                '목요일': '목', '금요일': '금', '토요일': '토'
              };
              shortName = dayMapping[dayName] || dayName.charAt(0);
            }

            const index = dayNames.indexOf(shortName);
            if (index !== -1) {
              weekdayIndices.add(index);
            }
          });

          setSelectedWeekdays(weekdayIndices);
        } else {
          setSelectedWeekdays(new Set());
        }
      } else {
        setShowWeekdaySelector(false);
        setSelectedWeekdays(new Set());
      }
      
      setIsAddEventModalOpen(true);
      // body 스크롤은 이미 비활성화되어 있으므로 유지
    }
  };

  // 일정 클릭 핸들러 - 바로 액션 선택 모달 표시
  const handleEventItemClick = useCallback((event: ScheduleEvent) => {
    setSelectedEventForAction(event);
    setIsScheduleActionModalOpen(true);
    // body 스크롤 비활성화
    document.body.style.overflow = 'hidden';
  }, []);

  // 뒤로가기 핸들러
  const handleBack = useCallback(() => {
    // 뒤로가기 햅틱 피드백
    hapticFeedback.backButton();
    router.back();
  }, [router]);

  // 모달 닫기 핸들러
  const closeModal = () => {
    setSelectedEventDetails(null);
    // body 스크롤 복원
    document.body.style.overflow = '';
  };

  // 새 일정 추가 모달 닫기
  const closeAddModal = () => {
    setIsAddEventModalOpen(false);
    setNewEvent(initialNewEventState);
    setSelectedEventDetails(null);
    setDateTimeError(null);
    
    // 모든 관련 모달들도 함께 닫기
    setIsRepeatModalOpen(false);
    setIsAlarmModalOpen(false);
    setIsCalendarModalOpen(false);
    setIsTimeModalOpen(false);
    setIsLocationSearchModalOpen(false);
    setIsDateTimeModalOpen(false);
    
    // body 스크롤 복원
    document.body.style.overflow = 'auto';
    
    // 검색 관련 상태도 초기화
    setLocationSearchQuery('');
    setLocationSearchResults([]);
    setHasSearched(false);
    setIsSearchingLocation(false);
    
    // body 스크롤 복원
    document.body.style.overflow = '';
  };

  // 로딩 단계 업데이트 함수
  const updateLoadingStep = useCallback((step: 'groups' | 'schedules' | 'calendar' | 'ui', completed: boolean) => {
    setLoadingSteps(prev => {
      const newSteps = {
        ...prev,
        [step]: completed
      };
      
      // 모든 로딩이 완료되었는지 확인
      const allCompleted = Object.values(newSteps).every(stepCompleted => stepCompleted);
      
      // 모든 로딩이 완료되면 햅틱 피드백
      if (allCompleted && !Object.values(prev).every(stepCompleted => stepCompleted)) {
        hapticFeedback.dataLoadComplete();
      }
      
      return newSteps;
    });
  }, []);

  // 그룹 목록 가져오기 - 실제 백엔드 API 사용
  const fetchUserGroups = useCallback(async () => {
    try {
      console.log('[fetchUserGroups] 그룹 목록 조회 시작');
      setIsLoadingGroups(true);
      
      const data = await groupService.getCurrentUserGroups();
      console.log('[fetchUserGroups] API 응답 데이터:', data);
      
      if (Array.isArray(data)) {
        setUserGroups(data);
        console.log('[fetchUserGroups] 그룹 목록 조회 완료:', data.length, '개 그룹');
        console.log('[fetchUserGroups] 그룹 목록:', data.map(g => ({ id: g.sgt_idx, title: g.sgt_title })));
        
        // 그룹 로딩 단계 완료
        updateLoadingStep('groups', true);
        
        // 첫 번째 그룹 선택
        if (data.length > 0) {
          const firstGroup = data[0];
          setSelectedGroupId(firstGroup.sgt_idx);
          console.log('[fetchUserGroups] 첫 번째 그룹 선택:', firstGroup.sgt_title);
          
          // 그룹 멤버 데이터 로드
          await fetchGroupMembers(firstGroup.sgt_idx);
          
          // 현재 월 데이터 로드
          const currentYear = dayjs().year();
          const currentMonth = dayjs().month() + 1;
          await loadAllGroupSchedules(currentYear, currentMonth);
        } else {
          console.log('[fetchUserGroups] 그룹이 없습니다');
          updateLoadingStep('schedules', true);
          updateLoadingStep('calendar', true);
          updateLoadingStep('ui', true);
          setIsInitialLoading(false);
        }
      } else {
        console.error('[fetchUserGroups] API 응답이 배열이 아닙니다:', data);
        setUserGroups([]);
      }
    } catch (error) {
      console.error('[fetchUserGroups] 그룹 목록 조회 오류:', error);
      setUserGroups([]);
      updateLoadingStep('groups', true); // 오류 시에도 다음 단계로 진행
      updateLoadingStep('schedules', true);
      updateLoadingStep('calendar', true);
      updateLoadingStep('ui', true);
      setIsInitialLoading(false);
    } finally {
      setIsLoadingGroups(false);
    }
  }, [updateLoadingStep]);

  // 그룹 멤버 가져오기 - 실제 백엔드 API 사용
  const fetchGroupMembers = async (groupId: number) => {
    setIsFetchingMembers(true);
    try {
      console.log('[fetchGroupMembers] 그룹 멤버 조회 시작:', groupId);
      
      // memberService 대신 groupService 사용
      const memberData = await groupService.getGroupMembers(groupId.toString());
      console.log('[fetchGroupMembers] API 응답:', memberData);

      if (memberData && memberData.length > 0) {
        const convertedMembers: ScheduleGroupMember[] = memberData.map((member: any, index: number) => {
          return {
            id: member.mt_idx.toString(),
            name: member.mt_name || `멤버 ${index + 1}`,
            photo: member.mt_file1 || getDefaultImage(member.mt_gender, member.mt_idx || index), // 서버 이미지가 있으면 사용, 없으면 기본 이미지
            isSelected: index === 0,
            mt_gender: typeof member.mt_gender === 'number' ? member.mt_gender : null,
            mt_idx: member.mt_idx,
            mt_name: member.mt_name,
            mt_file1: member.mt_file1,
            // 권한 정보 추가
            sgdt_owner_chk: member.sgdt_owner_chk || 'N',
            sgdt_leader_chk: member.sgdt_leader_chk || 'N',
            // 그룹 상세 인덱스 추가
            sgdt_idx: member.sgdt_idx,
            
            // 새로 추가된 위치 정보
            mlt_lat: member.mlt_lat,
            mlt_long: member.mlt_long,
            mlt_speed: member.mlt_speed,
            mlt_battery: member.mlt_battery,
            mlt_gps_time: member.mlt_gps_time,
          };
        });

        // 현재 사용자의 역할 확인
        const currentUserId = user?.mt_idx?.toString();
        const currentUser = convertedMembers.find(m => m.id === currentUserId);
        if (currentUser) {
          if (currentUser.sgdt_owner_chk === 'Y') {
            setCurrentUserRole('owner');
          } else if (currentUser.sgdt_leader_chk === 'Y') {
            setCurrentUserRole('leader');
          } else {
            setCurrentUserRole('member');
          }
          console.log('[SCHEDULE PAGE] 현재 사용자 역할 확인:', {
            userId: currentUserId,
            userName: currentUser.name,
            role: currentUser.sgdt_owner_chk === 'Y' ? 'owner' : currentUser.sgdt_leader_chk === 'Y' ? 'leader' : 'member'
          });
        } else {
          console.warn('[SCHEDULE PAGE] 현재 사용자를 찾을 수 없음:', currentUserId);
        }

        setScheduleGroupMembers(convertedMembers);
        
        // 현재 사용자가 선택되도록 초기 설정
        if (currentUser) {
          setSelectedMemberId(currentUser.id);
          setScheduleGroupMembers(prev => prev.map(member => ({
            ...member,
            isSelected: member.id === currentUser.id
          })));
        } else if (convertedMembers.length > 0 && !selectedMemberId) {
          // 현재 사용자를 찾을 수 없는 경우 첫 번째 멤버 선택 (fallback)
          setSelectedMemberId(convertedMembers[0].id);
          setScheduleGroupMembers(prev => prev.map(member => ({
            ...member,
            isSelected: member.id === convertedMembers[0].id
          })));
        }
      } else {
        console.warn('[fetchGroupMembers] 그룹멤버 데이터가 없거나 비어있습니다.');
        setScheduleGroupMembers([]);
      }
    } catch (error) {
      console.error('[fetchGroupMembers] 그룹 멤버 가져오기 실패:', error);
      setScheduleGroupMembers([]);
    } finally {
      setIsFetchingMembers(false);
    }
  };

  // 그룹 선택 핸들러
  const handleGroupSelect = async (groupId: number) => {
    // 일정 수정 모드일 때는 그룹 선택 불가
    if (newEvent.id) {
      console.log('[handleGroupSelect] 일정 수정 모드에서는 그룹 변경 불가');
      return;
    }
    
    setSelectedGroupId(groupId);
    setIsGroupSelectorOpen(false);
    await fetchGroupMembers(groupId);
  };

  // 일정 추가 모달 열기
  const handleOpenAddEventModal = () => {
    setIsAddEventModalOpen(true);
    setIsGroupSelectorOpen(false); // 드롭다운 닫기
    // body 스크롤 비활성화
    document.body.style.overflow = 'hidden';
  };

  // 멤버 선택 핸들러
  const handleScheduleMemberSelect = (memberId: string) => {
    // 일정 수정 모드일 때는 멤버 선택 불가
    if (newEvent.id) {
      console.log('[handleScheduleMemberSelect] 일정 수정 모드에서는 멤버 변경 불가');
      return;
    }
    
    const currentUserId = user?.mt_idx?.toString();
    
    console.log('[handleScheduleMemberSelect] 멤버 선택 시도:', {
      selectedMemberId: memberId,
      currentUserId: currentUserId,
      currentUserRole: currentUserRole,
      previousSelectedMemberId: selectedMemberId
    });
    
    // 역할에 따른 권한 확인
    if (currentUserRole === 'member') {
      // 일반 멤버는 자신만 선택 가능
      if (memberId !== currentUserId) {
        console.log('[handleScheduleMemberSelect] 일반 멤버는 자신의 스케줄만 등록 가능합니다.');
        alert('일반 멤버는 자신의 스케줄만 등록할 수 있습니다.');
        return;
      }
    }
    
    setSelectedMemberId(memberId);
    
    // scheduleGroupMembers의 isSelected 상태 업데이트
    setScheduleGroupMembers(prev => prev.map(member => ({
      ...member,
      isSelected: member.id === memberId
    })));
    
    // 선택된 멤버 정보를 newEvent에 반영
    const selectedMember = scheduleGroupMembers.find(m => m.id === memberId);
    const selectedGroup = userGroups.find(g => g.sgt_idx === selectedGroupId);
    
    console.log('[handleScheduleMemberSelect] 선택된 멤버 정보:', {
      selectedMember: selectedMember ? {
        id: selectedMember.id,
        name: selectedMember.name,
        mt_idx: selectedMember.mt_idx,
        sgdt_idx: selectedMember.sgdt_idx
      } : null
    });
    
    if (selectedMember && selectedGroup && selectedGroupId !== null) {
      // 그룹별 색상 배열 (다양한 색상 제공)
      const groupColors = [
        'bg-sky-500',
        'bg-yellow-500', 
        'bg-amber-500',
        'bg-indigo-500',
        'bg-rose-500',
        'bg-lime-500',
        'bg-purple-500',
        'bg-emerald-500',
        'bg-orange-500',
        'bg-pink-500'
      ];
      
      // 그룹 ID를 기반으로 색상 선택 (일관성 유지)
      const colorIndex = selectedGroupId % groupColors.length;
      const groupColor = groupColors[colorIndex];
      
      setNewEvent(prev => ({
        ...prev,
        memberName: selectedMember.name,
        memberPhoto: '', // 빈 문자열로 설정하여 로컬 이미지 사용
        groupName: selectedGroup.sgt_title,
        groupColor: groupColor
      }));
    }
  };

  // 장소 검색 모달 열기
  const handleOpenLocationSearchModal = () => {
    // 현재 장소 정보를 임시 변수에 저장
    setTempLocationData({
      name: newEvent.locationName,
      address: newEvent.locationAddress,
      lat: newEvent.locationLat,
      lng: newEvent.locationLng
    });
    setIsLocationSearchModalOpen(true);
    setLocationSearchQuery('');
    setLocationSearchResults([]);
    setHasSearched(false);
  };

  // 장소 검색 모달 닫기
  const handleCloseLocationSearchModal = () => {
    // 임시 장소 데이터를 원래 값으로 되돌림
    setNewEvent(prev => ({
      ...prev,
      locationName: tempLocationData.name,
      locationAddress: tempLocationData.address,
      locationLat: tempLocationData.lat,
      locationLng: tempLocationData.lng
    }));
    setIsLocationSearchModalOpen(false);
    setLocationSearchQuery('');
    setLocationSearchResults([]);
    setHasSearched(false);
  };

  // 장소 검색 실행
  const handleSearchLocation = async (query?: string) => {
    const searchQueryValue = query !== undefined ? query : locationSearchQuery;
    const searchQueryString = String(searchQueryValue || '');

    if (!searchQueryString.trim()) return;

    setIsSearchingLocation(true);
    setHasSearched(true);
    setLocationSearchError(false);
    setLocationSearchResults([]);

    try {
      const response = await fetch(`/api/kakao-search?query=${encodeURIComponent(searchQueryString)}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      if (data.documents && data.documents.length > 0) {
        const resultsWithIds = data.documents.map((doc: any, index: number) => ({
          ...doc,
          temp_id: `${doc.x}-${doc.y}-${index}`
        }));
        console.log("[handleSearchLocation] 🔧 setLocationSearchResults 호출 전:", resultsWithIds);
        setLocationSearchResults(resultsWithIds);
      } else {
        setLocationSearchResults([]);
      }

    } catch (error) {
      console.error('[handleSearchLocation] 장소 검색 중 오류 발생:', error);
      setLocationSearchError(true);
      setLocationSearchResults([]);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  // 검색 결과 선택
  const handleSelectLocation = (place: any) => {
    console.log('[handleSelectLocation] 📍 선택된 장소:', place);
    
    setNewEvent(prev => {
      console.log('[handleSelectLocation] 🔧 이전 상태:', {
        locationName: prev.locationName,
        locationAddress: prev.locationAddress
      });
      
      const newLocationName = place.place_name || '';
      const newLocationAddress = place.road_address_name || place.address_name || '';
      
      console.log('[handleSelectLocation] 🔧 설정할 값들:', {
        locationName: newLocationName,
        locationAddress: newLocationAddress
      });
      
      const updatedEvent = {
        ...prev,
        locationName: newLocationName,
        locationAddress: newLocationAddress,
        locationLat: place.y ? parseFloat(place.y) : undefined,
        locationLng: place.x ? parseFloat(place.x) : undefined,
      };
      
      console.log('[handleSelectLocation] 🔄 업데이트된 상태:', {
        locationName: updatedEvent.locationName,
        locationAddress: updatedEvent.locationAddress,
        locationLat: updatedEvent.locationLat,
        locationLng: updatedEvent.locationLng
      });
      
      return updatedEvent;
    });     
    console.log('[handleSelectLocation] 💾 저장된 좌표:', {
      lat: place.y ? parseFloat(place.y) : undefined,
      lng: place.x ? parseFloat(place.x) : undefined
    });
    
    // tempLocationData를 되돌리지 않고 직접 모달 닫기
    setIsLocationSearchModalOpen(false);
    setLocationSearchQuery("");
    setLocationSearchResults([]);
    setHasSearched(false);
  };

  // 커스텀 캘린더 관련 함수들
  const handleOpenCalendarModal = () => {
    // 날짜/시간 모달이 열려있을 때만 임시 상태에서 날짜를 가져옴
    const currentDate = isDateTimeModalOpen ? tempDateTime.date : newEvent.date;
    setSelectedDay(dayjs(currentDate));
    setIsCalendarModalOpen(true);
  };

  const handleCloseCalendarModal = () => {
    setIsCalendarModalOpen(false);
  };

  const handleCalendarDateSelect = (date: Dayjs) => {
    const formattedDate = date.format('YYYY-MM-DD');
    
    // 날짜/시간 모달이 열려있으면 임시 상태 업데이트, 아니면 실제 상태 업데이트
    if (isDateTimeModalOpen) {
      setTempDateTime(prev => ({ ...prev, date: formattedDate }));
    } else {
      setNewEvent(prev => ({ ...prev, date: formattedDate }));
    }
    
    setSelectedDay(date);
    setIsCalendarModalOpen(false);
  };

  const handleCalendarPrevMonth = () => {
    setCalendarCurrentMonth(prev => prev.subtract(1, 'month'));
  };

  const handleCalendarNextMonth = () => {
    setCalendarCurrentMonth(prev => prev.add(1, 'month'));
  };

  const handleCalendarToday = () => {
    const today = dayjs();
    setCalendarCurrentMonth(today);
    setNewEvent(prev => ({
      ...prev,
      date: today.format('YYYY-MM-DD')
    }));
    setIsCalendarModalOpen(false);
  };

  // 커스텀 시간 선택 모달 관련 함수들
  const handleOpenTimeModal = (type: 'start' | 'end') => {
    setTimeModalType(type);
    
    // 날짜/시간 모달이 열려있으면 임시 상태에서, 아니면 실제 상태에서 시간 가져오기
    const currentTime = isDateTimeModalOpen 
      ? (type === 'start' ? tempDateTime.startTime : tempDateTime.endTime)
      : (type === 'start' ? newEvent.startTime : newEvent.endTime);
      
    const [hour, minute] = currentTime.split(':').map(Number);
    setSelectedHour(hour);
    setSelectedMinute(minute);
    setIsTimeModalOpen(true);
    
    // 모달이 열린 후 스크롤 실행 (여러 단계로 시도)
    const performScroll = () => {
      if (hourScrollRef.current && minuteScrollRef.current) {
        try {
          const hourButtons = hourScrollRef.current.querySelectorAll('button');
          const minuteButtons = minuteScrollRef.current.querySelectorAll('button');
          
          console.log('[handleOpenTimeModal] 스크롤 실행:', {
            hour,
            minute,
            hourButtonsCount: hourButtons.length,
            minuteButtonsCount: minuteButtons.length,
            hourContainer: hourScrollRef.current.clientHeight,
            minuteContainer: minuteScrollRef.current.clientHeight
          });
          
          if (hourButtons.length > 0 && minuteButtons.length > 0) {
            const buttonHeight = hourButtons[0].offsetHeight;
            const containerHeight = hourScrollRef.current.clientHeight;
            
            // 시간 스크롤 계산 - 선택된 항목이 중앙에 오도록
            const hourScrollTop = Math.max(0, (hour * buttonHeight) - (containerHeight / 2) + (buttonHeight / 2));
            
            // 분 스크롤 계산 (5분 단위)
            const minuteIndex = minute / 5;
            const minuteScrollTop = Math.max(0, (minuteIndex * buttonHeight) - (containerHeight / 2) + (buttonHeight / 2));
            
            console.log('[handleOpenTimeModal] 스크롤 계산:', {
              buttonHeight,
              containerHeight,
              hourScrollTop,
              minuteIndex,
              minuteScrollTop
            });
            
            // 즉시 스크롤 (smooth 없이)
            hourScrollRef.current.scrollTop = hourScrollTop;
            minuteScrollRef.current.scrollTop = minuteScrollTop;
            
            // 그 다음 smooth 스크롤
            setTimeout(() => {
              if (hourScrollRef.current && minuteScrollRef.current) {
                hourScrollRef.current.scrollTo({
                  top: hourScrollTop,
                  behavior: 'smooth'
                });
                
                minuteScrollRef.current.scrollTo({
                  top: minuteScrollTop,
                  behavior: 'smooth'
                });
              }
            }, 100);
            
            console.log('[handleOpenTimeModal] 스크롤 완료');
          } else {
            console.log('[handleOpenTimeModal] 버튼을 찾을 수 없음, 재시도...');
            // 버튼이 아직 렌더링되지 않았다면 다시 시도
            setTimeout(performScroll, 200);
          }
        } catch (error) {
          console.error('[handleOpenTimeModal] 스크롤 오류:', error);
        }
      } else {
        console.log('[handleOpenTimeModal] 스크롤 컨테이너를 찾을 수 없음, 재시도...');
        setTimeout(performScroll, 200);
      }
    };
    
    // 여러 시점에서 스크롤 시도
    setTimeout(performScroll, 300);
    setTimeout(performScroll, 600);
    setTimeout(performScroll, 1000);
  };

  const handleCloseTimeModal = () => {
    setIsTimeModalOpen(false);
  };

  const handleTimeConfirm = () => {
    const timeString = `${selectedHour.toString().padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')}`;

    // 날짜/시간 모달이 열려있으면 임시 상태 업데이트, 아니면 실제 상태 업데이트
    if (isDateTimeModalOpen) {
      if (timeModalType === 'start') {
        // 시작 시간을 설정하면 종료 시간을 +1시간으로 자동 세팅 (자정 넘어가면 23:59로 클램프)
        setTempDateTime(prev => {
          const start = dayjs(`${prev.date}T${timeString}:00`);
          const endCandidate = start.add(1, 'hour');
          let newEnd = endCandidate.format('HH:mm');
          if (newEnd <= timeString) {
            newEnd = '23:59';
          }
          return { ...prev, startTime: timeString, endTime: newEnd };
        });
      } else {
        setTempDateTime(prev => ({ ...prev, endTime: timeString }));
      }
    } else {
      if (timeModalType === 'start') {
        setNewEvent(prev => {
          const start = dayjs(`${prev.date}T${timeString}:00`);
          const endCandidate = start.add(1, 'hour');
          let newEnd = endCandidate.format('HH:mm');
          if (newEnd <= timeString) {
            newEnd = '23:59';
          }
          return { ...prev, startTime: timeString, endTime: newEnd };
        });
      } else {
        setNewEvent(prev => ({ ...prev, endTime: timeString }));
      }
    }

    setIsTimeModalOpen(false);
  };

  const handleHourChange = (hour: number) => {
    setSelectedHour(hour);
  };

  const handleMinuteChange = (minute: number) => {
    setSelectedMinute(minute);
  };

  // 날짜/시간 모달 열기 함수 추가
  const handleOpenDateTimeModal = () => {
    // 현재 상태를 백업하고 임시 상태에 복사
    const backup = {
      date: newEvent.date,
      startTime: newEvent.startTime,
      endTime: newEvent.endTime,
      allDay: newEvent.allDay
    };
    
    setBackupDateTime(backup);
    setTempDateTime(backup);
    setIsDateTimeModalOpen(true);
    
    // body 스크롤 비활성화
    document.body.style.overflow = 'hidden';
  };

  // 날짜/시간 모달 취소 함수 추가
  const handleCancelDateTimeModal = () => {
    // 백업된 상태로 복원하지 않고 단순히 모달만 닫기
    // (실제 newEvent는 변경되지 않았으므로)
    setIsDateTimeModalOpen(false);
    // body 스크롤은 부모 모달이 열려있으므로 유지
  };

  // 날짜/시간 모달 확인 함수 추가
  const handleConfirmDateTimeModal = () => {
    // 임시 상태를 실제 상태에 반영
    setNewEvent(prev => ({
      ...prev,
      date: tempDateTime.date,
      startTime: tempDateTime.startTime,
      endTime: tempDateTime.endTime,
      allDay: tempDateTime.allDay
    }));
    
    setIsDateTimeModalOpen(false);
    // body 스크롤은 부모 모달이 열려있으므로 유지
  };

  // 모든 그룹의 스케줄 로드 - 실제 백엔드 API 사용
  const loadAllGroupSchedules = async (year?: number, month?: number, keepSelectedDate?: boolean, forceRefresh?: boolean) => {
    try {
      console.log('[SCHEDULE] 스케줄 로드 시작:', { year, month, keepSelectedDate, forceRefresh });
      
      // 캐시 키 생성 (년-월 형태)
      const cacheKey = year && month ? `${year}-${String(month).padStart(2, '0')}` : 
                      `${dayjs().year()}-${String(dayjs().month() + 1).padStart(2, '0')}`;
      
      console.log('[SCHEDULE] 캐시 키:', cacheKey);
      console.log('[SCHEDULE] 로드된 월들:', Array.from(loadedMonths));
      
      // 로컬 스토리지에서 캐시된 데이터 확인
      let cachedData: ScheduleEvent[] | null = null;
      
      // 메모리 캐시 우선 확인
      if (monthlyCache.has(cacheKey)) {
        cachedData = monthlyCache.get(cacheKey) || [];
        console.log('[SCHEDULE] 메모리 캐시에서 데이터 로드:', cacheKey);
      } else if (loadedMonths.has(cacheKey)) {
        // 로컬 스토리지에서 캐시 데이터 로드
        cachedData = loadMonthCacheFromStorage(cacheKey);
        if (cachedData) {
          // 메모리 캐시에도 저장
          setMonthlyCache(prev => new Map(prev).set(cacheKey, cachedData!));
          console.log('[SCHEDULE] 로컬 스토리지에서 데이터 로드:', cacheKey);
        }
      }
      
      // 캐시된 데이터가 있는 경우 (forceRefresh가 false일 때만)
      if (cachedData && cachedData.length >= 0 && !forceRefresh) {
        console.log('[SCHEDULE] 캐시된 데이터 사용:', cacheKey, `(${cachedData.length}개 이벤트)`);
        
        if (keepSelectedDate && selectedDay) {
          // 월 변경 시: 선택된 날짜의 기존 일정을 보존하면서 캐시된 데이터 병합
          const selectedDateString = selectedDay.format('YYYY-MM-DD');
          
          setEvents(prevEvents => {
            // 기존 일정 중 선택된 날짜의 일정만 필터링
            const selectedDateEvents = prevEvents.filter(event => event.date === selectedDateString);
            
            // 캐시된 일정 중 선택된 날짜가 아닌 일정들
            const otherEvents = cachedData!.filter(event => event.date !== selectedDateString);
            
            // 캐시된 일정 중 선택된 날짜의 일정들
            const newSelectedDateEvents = cachedData!.filter(event => event.date === selectedDateString);
            
            console.log('[SCHEDULE] 캐시 병합 - 기존 선택된 날짜 일정:', selectedDateEvents);
            console.log('[SCHEDULE] 캐시 병합 - 새 선택된 날짜 일정:', newSelectedDateEvents);
            
            // 새 데이터가 있으면 새 데이터 사용, 없으면 기존 데이터 유지
            const finalSelectedDateEvents = newSelectedDateEvents.length > 0 ? newSelectedDateEvents : selectedDateEvents;
            
            return [...otherEvents, ...finalSelectedDateEvents];
          });
        } else {
          // 일반 로딩 시: 캐시된 데이터 사용
          setEvents(cachedData);
        }
        
        // 선택된 날짜 처리
        if (!keepSelectedDate && !selectedDay) {
          console.log('[SCHEDULE] 선택된 날짜를 오늘로 초기화');
          setSelectedDay(dayjs());
        } else {
          console.log('[SCHEDULE] 선택된 날짜 유지:', selectedDay?.format('YYYY-MM-DD'));
        }
        
        // 초기 로딩 완료 처리
        if (!hasInitialDataLoaded) {
          setHasInitialDataLoaded(true);
          // 일정 데이터 및 캘린더 단계 완료
          updateLoadingStep('schedules', true);
          updateLoadingStep('calendar', true);
          // UI 단계도 완료하고 로딩 완료
          setTimeout(() => {
            updateLoadingStep('ui', true);
            setIsInitialLoading(false);
          }, 1500);
        }
        
        return; // 캐시된 데이터 사용 시 API 호출 없이 종료
      }

      if (forceRefresh) {
        console.log('[SCHEDULE] 강제 새로고침 모드 - 캐시 무시하고 API 호출');
      } else {
        console.log('[SCHEDULE] 캐시된 데이터 없음, API 호출 시작');
      }
      
      // 새로운 API 사용: 오너 그룹의 모든 멤버 스케줄을 월별로 조회
      const response = await scheduleService.getOwnerGroupsAllSchedules(year, month);
      console.log('[SCHEDULE] API 응답:', response);

      if (response.success && response.data?.schedules) {
        console.log('[SCHEDULE] 조회 성공:', {
          totalSchedules: response.data.totalSchedules,
          queryPeriod: response.data.queryPeriod
        });

        // 모든 그룹의 멤버 정보를 미리 조회
        const allGroupMembers: { [key: number]: any[] } = {};
        
        for (const group of response.data.ownerGroups) {
          try {
            const members = await groupService.getGroupMembers(group.sgt_idx.toString());
            allGroupMembers[group.sgt_idx] = members || [];
          } catch (error) {
            console.error(`[SCHEDULE] 그룹 ${group.sgt_idx} 멤버 조회 실패:`, error);
            allGroupMembers[group.sgt_idx] = [];
          }
        }
        
        const allEvents: ScheduleEvent[] = [];
        
        // 그룹별 색상 배열
        const groupColors = [
          'bg-sky-500', 'bg-teal-500', 'bg-amber-500', 'bg-indigo-500',
          'bg-rose-500', 'bg-lime-500', 'bg-purple-500', 'bg-emerald-500'
        ];
        
        // 반복 주기 텍스트 변환
        const getRepeatText = (repeatJson: string | null): string => {
          if (!repeatJson || repeatJson === 'null' || repeatJson.trim() === '') return '없음';
          try {
            const repeatObj = JSON.parse(repeatJson);
            const r1 = repeatObj.r1;
            const r2 = repeatObj.r2;
            
            switch (r1) {
              case '5':
                return '매년';
              case '4':
                return '매월';
              case '3':
                if (r2) {
                  const days = r2.split(',').map((day: string) => {
                    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                    return dayNames[parseInt(day)] || day;
                  });
                  return `매주 ${days.join(',')}`;
                }
                return '매주';
              case '2':
                return '매일';
              default:
                return '사용자 정의';
            }
          } catch {
            return '없음';
          }
        };
        
        // 백엔드에서 받은 스케줄 데이터를 프론트엔드 형식으로 변환
        response.data.schedules.forEach((schedule: any, index: number) => {
          try {
            // 백엔드 원본 데이터 로깅 (반복 일정인 경우만)
            // if (schedule.sst_repeat_json || schedule.sst_pidx) {
            //   console.log(`[DEBUG] 백엔드 원본 데이터 - 스케줄 ${schedule.sst_idx}:`, {
            //     sst_pidx: schedule.sst_pidx,
            //     sst_repeat_json: schedule.sst_repeat_json,
            //     sst_title: schedule.sst_title
            //   });
            // }
            
            // 시작/종료 시간 파싱
            let startDate: Date;
            let endDate: Date;
            
            if (schedule.sst_sdate) {
              startDate = new Date(schedule.sst_sdate);
            } else {
              startDate = new Date();
            }
            
            if (schedule.sst_edate) {
              endDate = new Date(schedule.sst_edate);
            } else {
              endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1시간 추가
            }
            
            // 그룹 색상 결정
            const groupColor = schedule.sgt_idx ? 
              groupColors[schedule.sgt_idx % groupColors.length] : 
              'bg-gray-500';

            // 알림 여부 및 시간 확인
            const hasAlarm = schedule.sst_schedule_alarm_chk === 'Y';
            
            // 백엔드의 sst_pick_type과 sst_pick_result를 사용하여 알림 시간 계산
            let alarmTime = '';
            if (hasAlarm && schedule.sst_pick_type && schedule.sst_pick_result) {
              const pickType = schedule.sst_pick_type;
              const pickResult = parseInt(schedule.sst_pick_result) || 0;
              
              // console.log('[loadAllGroupSchedules] 알림 계산:', {
              //   pickType,
              //   pickResult,
              //   sst_alram_t: schedule.sst_alram_t
              // });
              
              if (pickResult === 0) {
                alarmTime = '정시';
              } else if (pickType === 'minute') {
                alarmTime = `${pickResult}분 전`;
              } else if (pickType === 'hour') {
                alarmTime = `${pickResult}시간 전`;
              } else if (pickType === 'day') {
                alarmTime = `${pickResult}일 전`;
              } else {
                // 기본값으로 sst_alram_t 사용
                alarmTime = schedule.sst_alram_t || '';
              }
            } else if (hasAlarm && schedule.sst_alram_t) {
              // sst_pick_type이 없는 경우 sst_alram_t 사용
              alarmTime = schedule.sst_alram_t;
            }
            
            // console.log('[loadAllGroupSchedules] 최종 알림 시간:', {
            //   hasAlarm,
            //   alarmTime,
            //   pickType: schedule.sst_pick_type,
            //   pickResult: schedule.sst_pick_result
            // });

            // 하루 종일 여부 확인
            const isAllDay = schedule.sst_all_day === 'Y';

            // 타겟 멤버 정보 설정 (실제 스케줄 대상자 기준)
            let targetMemberName = schedule.member_name || '';
            let targetMemberNickname = '';
            let targetMemberPhoto = schedule.member_photo || '';
            let targetMemberGender = schedule.mt_gender || null;
            let targetMemberIdx = schedule.tgt_mt_idx || schedule.mt_idx || 0; // 타겟 멤버 ID 우선, 없으면 생성자 ID
            
            // 실제 타겟 멤버 정보를 그룹 멤버 리스트에서 찾기
            const targetMtIdx = schedule.tgt_mt_idx || schedule.mt_idx; // 타겟 멤버 ID 우선
            let targetMember = null; // 스코프 밖에서도 접근 가능하도록 선언
            
            // 디버깅 로그 추가
            // if (schedule.tgt_mt_idx && schedule.tgt_mt_idx !== schedule.mt_idx) {
            //   console.log(`[DEBUG] 타겟 멤버 불일치 - 스케줄 ${schedule.sst_idx}: tgt_mt_idx=${schedule.tgt_mt_idx}, mt_idx=${schedule.mt_idx}, 사용할 ID=${targetMtIdx}`);
            // }
            
            if (targetMtIdx && schedule.sgt_idx && allGroupMembers[schedule.sgt_idx]) {
              targetMember = allGroupMembers[schedule.sgt_idx].find(
                (member: any) => member.mt_idx === targetMtIdx
              );
              
              if (targetMember) {
                targetMemberName = targetMember.mt_name || targetMember.name || targetMemberName;
                targetMemberNickname = targetMember.mt_nickname || targetMember.mt_name || targetMember.name || '';
                targetMemberPhoto = targetMember.mt_file1 || targetMemberPhoto;
                targetMemberGender = targetMember.mt_gender || null;
                targetMemberIdx = targetMember.mt_idx;
                
                console.log(`[DEBUG] 타겟 멤버 찾음 - ID: ${targetMtIdx}, 이름: ${targetMemberName}, 닉네임: ${targetMemberNickname}`);
              } else {
                console.log(`[DEBUG] 타겟 멤버 못 찾음 - ID: ${targetMtIdx}, 그룹: ${schedule.sgt_idx}`);
              }
            } else if (!targetMtIdx) {
              // tgt_mt_idx가 없으면 기본 멤버 정보 사용 (생성자 정보)
              // console.log(`[DEBUG] 타겟 멤버 ID 없음, 생성자 정보 사용 - 생성자: ${schedule.mt_idx}, 이름: ${targetMemberName}`);
            }

            const event: ScheduleEvent = {
              id: schedule.sst_idx?.toString() || `temp-${index}`,
              sst_idx: schedule.sst_idx,
              date: schedule.sst_sdate ? schedule.sst_sdate.split(' ')[0] : '',
              startTime: schedule.sst_sdate ? schedule.sst_sdate.split(' ')[1]?.substring(0, 5) || '00:00' : '00:00',
              endTime: schedule.sst_edate ? schedule.sst_edate.split(' ')[1]?.substring(0, 5) || '23:59' : '23:59',
              title: schedule.sst_title || '제목 없음',
              content: schedule.sst_memo || '',
              groupId: schedule.sgt_idx,
              groupName: schedule.group_title || '',
              groupColor: getGroupColor(schedule.sgt_idx || 0),
              memberName: targetMemberName,
              memberNickname: targetMemberNickname,
              memberPhoto: targetMemberPhoto,
              memberGender: targetMemberGender,
              memberIdx: targetMemberIdx,
              canEdit: true,
              canDelete: true,
              locationName: schedule.sst_location_title || '',
              locationAddress: schedule.sst_location_add || '',
              locationLat: schedule.sst_location_lat || undefined,
              locationLng: schedule.sst_location_long || undefined,
              hasAlarm: hasAlarm,
              alarmText: hasAlarm ? (alarmTime ? `알림 ${alarmTime}` : '알림 ON') : '알림 OFF',
              alarmTime: alarmTime, // 알림 시간 추가
              repeatText: getRepeatText(schedule.sst_repeat_json),
              distance: null, // 백엔드 값 대신 프론트엔드에서 계산
              distanceText: '', // 프론트엔드에서 재계산
              // 타겟 멤버 정보 (수정 시 사용)
              tgtMtIdx: schedule.tgt_mt_idx || null, // DB의 실제 타겟 멤버 ID 사용
              isAllDay: isAllDay, // 하루 종일 여부
              repeatJsonV: schedule.sst_repeat_json_v || '', // 반복 JSON 버전
              // 타겟 멤버 권한/식별자는 이벤트의 대상 멤버에서 가져와야 함 (선택된 멤버 아님)
              tgtSgdtOwnerChk: (targetMember?.sgdt_owner_chk as 'Y' | 'N') || 'N',
              tgtSgdtLeaderChk: (targetMember?.sgdt_leader_chk as 'Y' | 'N') || 'N',
              tgtSgdtIdx: targetMember?.sgdt_idx, // 타겟 멤버의 그룹 상세 인덱스
              sst_pidx: undefined
            }
            
            // sst_pidx 디버깅 로그 추가
            // if (schedule.sst_repeat_json || schedule.sst_pidx) {
            //   console.log(`[DEBUG] 스케줄 ${schedule.sst_idx} - sst_pidx: ${schedule.sst_pidx}, repeat_json: ${schedule.sst_repeat_json}, 최종 sst_pidx: ${event.sst_pidx}`);
            // }
            
            // 멤버 위치 정보 매핑 및 거리 계산
            const eventWithLocation = mapMemberLocationToSchedule(event, allGroupMembers[schedule.sgt_idx] || []);
            // 기존 이벤트의 이름이 뒤에서 바뀌지 않도록 최초 매핑된 이름을 잠그는 필드 유지
            if (!eventWithLocation.memberName && targetMemberName) {
              eventWithLocation.memberName = targetMemberName;
            }
            
            allEvents.push(eventWithLocation);
            
          } catch (parseError) {
            console.error(`[loadAllGroupSchedules] 스케줄 ${index} 파싱 실패:`, parseError);
          }
        });
        
        console.log('[loadAllGroupSchedules] 모든 변환된 이벤트:', allEvents);
        console.log('[loadAllGroupSchedules] 총 이벤트 수:', allEvents.length);
        console.log('[loadAllGroupSchedules] keepSelectedDate:', keepSelectedDate);
        console.log('[loadAllGroupSchedules] 현재 selectedDay:', selectedDay?.format('YYYY-MM-DD'));
        
        if (keepSelectedDate && selectedDay) {
          // 월 변경 시: 선택된 날짜의 기존 일정을 보존하면서 새 데이터 병합
          const selectedDateString = selectedDay.format('YYYY-MM-DD');
          
          setEvents(prevEvents => {
            // 기존 일정 중 선택된 날짜의 일정만 필터링
            const selectedDateEvents = prevEvents.filter(event => event.date === selectedDateString);
            
            // 새로운 일정 중 선택된 날짜가 아닌 일정들
            const otherEvents = allEvents.filter(event => event.date !== selectedDateString);
            
            // 새로운 일정 중 선택된 날짜의 일정들 (업데이트된 데이터)
            const newSelectedDateEvents = allEvents.filter(event => event.date === selectedDateString);
            
            console.log('[loadAllGroupSchedules] 월 변경 - 기존 선택된 날짜 일정:', selectedDateEvents);
            console.log('[loadAllGroupSchedules] 월 변경 - 새 선택된 날짜 일정:', newSelectedDateEvents);
            
            // 새 데이터가 있으면 새 데이터 사용, 없으면 기존 데이터 유지
            const finalSelectedDateEvents = newSelectedDateEvents.length > 0 ? newSelectedDateEvents : selectedDateEvents;
            
            return [...otherEvents, ...finalSelectedDateEvents];
          });
        } else {
          // 일반 로딩 시: 전체 교체
          setEvents(allEvents);
        }
        
        // keepSelectedDate가 false이거나 undefined이고, selectedDay가 없는 경우에만 오늘로 초기화
        if (!keepSelectedDate && !selectedDay) {
          console.log('[loadAllGroupSchedules] 선택된 날짜를 오늘로 초기화');
          setSelectedDay(dayjs());
        } else {
          console.log('[loadAllGroupSchedules] 선택된 날짜 유지:', selectedDay?.format('YYYY-MM-DD'));
        }
        
        // 캐시에 저장
        setMonthlyCache(prev => new Map(prev).set(cacheKey, allEvents));
        setLoadedMonths(prev => new Set(prev).add(cacheKey));
        
        // 로컬 스토리지에도 저장
        saveCacheToStorage(cacheKey, allEvents);
        
        // 초기 로딩 완료 처리
        if (!hasInitialDataLoaded) {
          setHasInitialDataLoaded(true);
          // 일정 데이터 및 캘린더 단계 완료
          updateLoadingStep('schedules', true);
          updateLoadingStep('calendar', true);
          // UI 단계도 완료하고 로딩 완료
          setTimeout(() => {
            updateLoadingStep('ui', true);
            setIsInitialLoading(false);
          }, 1500);
        }
        
      } else {
        console.log('[loadAllGroupSchedules] 오너 그룹 스케줄 조회 실패 또는 데이터 없음:', response);
        // keepSelectedDate가 true인 경우(월 변경) 기존 events 유지, 아니면 빈 배열로 설정
        if (!keepSelectedDate) {
        setEvents([]); 
        }
        
        // 초기 로딩 완료 처리 (데이터가 없어도 로딩은 완료)
        if (!hasInitialDataLoaded) {
          setHasInitialDataLoaded(true);
          // 오류 시에도 모든 단계 완료
          updateLoadingStep('schedules', true);
          updateLoadingStep('calendar', true);
          setTimeout(() => {
            updateLoadingStep('ui', true);
            setIsInitialLoading(false);
          }, 1500);
        }
      }
      
    } catch (error) {
      console.error('[loadAllGroupSchedules] 스케줄 로드 실패:', error);
      // keepSelectedDate가 true인 경우(월 변경) 기존 events 유지, 아니면 빈 배열로 설정  
      if (!keepSelectedDate) {
      setEvents([]);
      }
      
      // 초기 로딩 완료 처리 (에러가 발생해도 로딩은 완료)
    if (!hasInitialDataLoaded) {
      setHasInitialDataLoaded(true);
        // 오류 시에도 모든 단계 완료
        updateLoadingStep('schedules', true);
        updateLoadingStep('calendar', true);
        setTimeout(() => {
          updateLoadingStep('ui', true);
          setIsInitialLoading(false);
        }, 1500);
      }
    }
  };

  // 그룹별 색상 생성
  const getGroupColor = (groupId: number): string => {
    const colors = [
      '#4f46e5', '#06b6d4', '#10b981', '#f59e0b', 
      '#ef4444', '#8b5cf6', '#ec4899', '#84cc16'
    ];
    return colors[groupId % colors.length];
  };

  // 저장 완료 모달 열기 (3초 후 자동 닫기 옵션 포함)
  const openSuccessModal = (
    title: string, 
    message: string, 
    type: 'success' | 'error' | 'info', 
    onConfirmCallback?: () => void,
    autoClose?: boolean
  ) => {
    setSuccessModalContent({ title, message, type, onConfirm: onConfirmCallback });
    setIsSuccessModalOpen(true);
    // body 스크롤 방지
    document.body.style.overflow = 'hidden';
    
    // 자동 닫기 옵션이 true이고 onConfirm이 없는 경우 (단순 정보 모달)
    if (autoClose && !onConfirmCallback) {
      setTimeout(() => {
        closeSuccessModal();
      }, 3000);
    }
  };

  // 저장 완료 모달 닫기
  const closeSuccessModal = () => {
    setIsSuccessModalOpen(false);
    setSuccessModalContent(null);
    // body 스크롤 복원
    document.body.style.overflow = '';
  };

  // 토스트 모달 함수들
  const showToastModal = (
    type: 'success' | 'error' | 'loading',
    title: string,
    message: string,
    autoClose: boolean = true,
    duration: number = 3000
  ) => {
    setToastModal({
      isOpen: true,
      type,
      title,
      message,
      progress: 0,
      autoClose
    });

    if (autoClose && type !== 'loading') {
      // 프로그레스 바 애니메이션
      let progress = 0;
      const interval = setInterval(() => {
        progress += (100 / duration) * 50; // 50ms마다 업데이트
        if (progress >= 100) {
          clearInterval(interval);
          setToastModal(prev => ({ ...prev, isOpen: false }));
        } else {
          setToastModal(prev => ({ ...prev, progress }));
        }
      }, 50);
    }
  };

  const hideToastModal = () => {
    setToastModal(prev => ({ ...prev, isOpen: false }));
  };

  // 스케줄 액션 선택 모달 닫기
  const closeScheduleActionModal = () => {
    setIsScheduleActionModalOpen(false);
    setSelectedEventForAction(null);
    // body 스크롤 복원
    document.body.style.overflow = '';
  };

  // 수정 액션 핸들러
  const handleEditAction = async (event: ScheduleEvent) => {
    // 반복 일정인지 확인 (sst_repeat_json이 있는 경우)
    if (event.repeatText && event.repeatText !== '없음') {
      // 반복 일정인 경우 선택 모달 표시
      setPendingRepeatEvent(event);
      setRepeatActionType('edit');
      setIsScheduleActionModalOpen(false);
      setIsRepeatActionModalOpen(true);
      // body 스크롤 방지 유지
      document.body.style.overflow = 'hidden';
      return;
    }

    // 일반 일정 수정 처리
    await executeEditAction(event);
  };

  // 반복 일정 옵션 선택 핸들러
  const handleRepeatOption = async (option: 'this' | 'future' | 'all') => {
    if (!pendingRepeatEvent) return;

    setIsRepeatActionModalOpen(false);
    // body 스크롤 복원
    document.body.style.overflow = '';

    if (repeatActionType === 'delete') {
      await executeDeleteAction(pendingRepeatEvent, option);
    } else if (repeatActionType === 'edit') {
      await executeEditAction(pendingRepeatEvent, option);
    }

    setPendingRepeatEvent(null);
  };

  // 실제 삭제 실행
  const executeDeleteAction = async (event: ScheduleEvent, option: 'single' | 'this' | 'future' | 'all') => {
    if (!selectedGroupId) {
      openSuccessModal('그룹 오류', '그룹 정보가 없습니다.', 'error');
      return;
    }

    try {
      console.log('[executeDeleteAction] 스케줄 삭제 시작:', {
        sst_idx: event.sst_idx,
        sst_pidx: event.sst_pidx || null, // undefined인 경우 null로 설정
        groupId: selectedGroupId,
        option
      });

      let response;
      
      if (option === 'single' || option === 'this') {
        // 일반 삭제 또는 이것만 삭제
        response = await scheduleService.deleteSchedule(
          event.sst_idx!,
          selectedGroupId,
          {
            editorId: user?.mt_idx || undefined,
            editorName: user?.mt_name || undefined
          }
        );
      } else {
        // 반복 일정 처리 옵션이 있는 삭제
        response = await scheduleService.deleteScheduleWithRepeatOption({
          sst_idx: event.sst_idx!,
          sst_pidx: event.sst_pidx || null, // undefined인 경우 null로 설정
          sgdt_idx: event.tgtSgdtIdx || null, // undefined인 경우 null로 설정
          groupId: selectedGroupId,
          deleteOption: option as 'this' | 'future' | 'all',
          // 실제 삭제한 사람 (현재 로그인한 사용자)
          editorId: user?.mt_idx || undefined,
          editorName: user?.mt_name || undefined
        });
      }

      if (response.success) {
        console.log('[executeDeleteAction] 스케줄 삭제 성공');
        
        // 삭제 성공 시 로컬 스토리지 캐시 완전 초기화
        clearCacheFromStorage();
        console.log('[executeDeleteAction] 🗑️ 삭제 후 로컬 스토리지 캐시 완전 초기화');
        
        // DataCacheContext의 스케줄 캐시 무효화
        if (selectedGroupId) {
          console.log('[executeDeleteAction] 🗑️ DataCacheContext 스케줄 캐시 무효화 (반복 삭제):', selectedGroupId);
          invalidateCache('scheduleData', selectedGroupId);
        }
        
        // 모든 관련 모달 상태 초기화
        setIsScheduleActionModalOpen(false);
        setIsRepeatActionModalOpen(false);
        setSelectedEventForAction(null);
        setPendingRepeatEvent(null);
        
        // 로컬 상태에서도 제거
        setEvents(prev => prev.filter(e => e.id !== event.id));
        
        // 스케줄 목록 새로 고침
        await loadAllGroupSchedules(undefined, undefined, true, true);
        
        // 푸시 알림은 백엔드에서 자동으로 처리됨 (중복 전송 방지)
        console.log('[deleteSchedule] ℹ️ 푸시 알림은 백엔드에서 자동 처리됨 (삭제 시)');
        
        // 성공 토스트 모달 표시 (3초 후 자동 닫기)
        const deleteMessage = option === 'single' || option === 'this' 
          ? '일정이 성공적으로 삭제되었습니다.' 
          : option === 'future'
          ? '현재 이후의 반복 일정이 성공적으로 삭제되었습니다.'
          : '모든 반복 일정이 성공적으로 삭제되었습니다.';
        
        showToastModal('success', '일정 삭제 완료', deleteMessage);
      } else {
        openSuccessModal('일정 삭제 실패', response.error || '일정 삭제에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('[executeDeleteAction] 스케줄 삭제 실패:', error);
      openSuccessModal('일정 삭제 실패', '일정 삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  // 실제 수정 실행
  const executeEditAction = async (event: ScheduleEvent, option?: 'this' | 'future' | 'all') => {
    // 알림 텍스트 역변환 함수 - 백엔드 데이터 구조에 맞게 개선
    const convertAlarmTextToSelect = (alarmTime: string, hasAlarm: boolean): string => {
      console.log('[convertAlarmTextToSelect] 입력값:', { alarmTime, hasAlarm });
      
      if (!hasAlarm || !alarmTime) {
        console.log('[convertAlarmTextToSelect] 알림 없음');
        return '없음';
      }
      
      // 백엔드에서 받은 알림 시간이 이미 올바른 형식인지 확인
      const validAlarmOptions = ['없음', '정시', '5분 전', '10분 전', '15분 전', '30분 전', '1시간 전', '1일 전'];
      if (validAlarmOptions.includes(alarmTime)) {
        console.log('[convertAlarmTextToSelect] 유효한 알림 옵션:', alarmTime);
        return alarmTime;
      }
      
      // 알림 시간 텍스트에서 숫자와 단위 추출하여 변환
      if (alarmTime.includes('분 전')) {
        const match = alarmTime.match(/(\d+)분 전/);
        if (match) {
          const minutes = match[1];
          console.log('[convertAlarmTextToSelect] 분 단위 알림:', minutes);
          return `${minutes}분 전`;
        }
      } else if (alarmTime.includes('시간 전')) {
        const match = alarmTime.match(/(\d+)시간 전/);
        if (match) {
          const hours = match[1];
          console.log('[convertAlarmTextToSelect] 시간 단위 알림:', hours);
          return `${hours}시간 전`;
        }
      } else if (alarmTime.includes('일 전')) {
        const match = alarmTime.match(/(\d+)일 전/);
        if (match) {
          const days = match[1];
          console.log('[convertAlarmTextToSelect] 일 단위 알림:', days);
          return `${days}일 전`;
        }
      } else if (alarmTime === '정시' || alarmTime.includes('정시')) {
        console.log('[convertAlarmTextToSelect] 정시 알림');
        return '정시';
      }
      
      // 기본값으로 받은 알림 시간 그대로 반환
      console.log('[convertAlarmTextToSelect] 기본값 반환:', alarmTime);
      return alarmTime;
    };

    // 먼저 해당 일정의 그룹 정보 설정
    if (event.groupId) {
      console.log('[executeEditAction] 그룹 설정:', event.groupId, '멤버:', event.tgtMtIdx);
      setSelectedGroupId(event.groupId);
      
      // 그룹 멤버 정보 로드 및 대기
      await fetchGroupMembers(event.groupId);
      
      // 멤버 정보가 로드된 후 잠시 기다렸다가 멤버 선택
      await new Promise(resolve => {
        setTimeout(() => {
          if (event.tgtMtIdx) {
            console.log('[executeEditAction] 멤버 선택 실행:', event.tgtMtIdx);
            setSelectedMemberId(event.tgtMtIdx.toString());
            setScheduleGroupMembers(prev => {
              const updated = prev.map(member => ({
                ...member,
                isSelected: member.mt_idx === event.tgtMtIdx || member.sgdt_idx === event.tgtSgdtIdx
              }));
              console.log('[executeEditAction] 멤버 업데이트 결과:', updated.filter(m => m.isSelected));
              return updated;
            });
          }
          resolve(true);
        }, 200);
      });
    }

    // 변환된 값들 로깅
    const convertedRepeat = event.repeatText || '';
    const convertedAlarm = convertAlarmTextToSelect(event.alarmTime || '', event.hasAlarm || false);
    
    console.log('[executeEditAction] 변환 결과:', {
      원본_반복: event.repeatText,
      변환된_반복: convertedRepeat,
      원본_알림: event.alarmTime,
      알림_여부: event.hasAlarm,
      변환된_알림: convertedAlarm
    });

    setNewEvent({
      id: event.id,
      title: event.title,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      allDay: event.isAllDay || false, // 하루종일 설정 로드
      repeat: convertedRepeat, // 반복 설정 역변환
      alarm: convertedAlarm, // 알림 설정 역변환
       locationName: (event.locationName && event.locationName.trim()) || '',
       locationAddress: (event.locationAddress && event.locationAddress.trim()) || '',
      locationLat: event.locationLat, // 위도 로드
      locationLng: event.locationLng, // 경도 로드
      content: event.content || '',
      groupName: event.groupName || '',
      groupColor: event.groupColor || '',
      memberName: event.memberName || '',
      memberPhoto: '', // 빈 문자열로 설정하여 로컬 이미지 사용
      editOption: option // 반복 일정 옵션 저장
    });
    
    // 매주 다중 요일 선택이 된 경우 요일 선택기 상태 설정
    const repeatText = event.repeatText || '';
    if (repeatText.includes('매주 ') && repeatText !== '매주') {
      setShowWeekdaySelector(true);
      const selectedDays = repeatText.replace('매주 ', '');
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const weekdayIndices = new Set<number>();
      
      selectedDays.split(',').forEach(dayName => {
        const index = dayNames.indexOf(dayName.trim());
        if (index !== -1) {
          weekdayIndices.add(index);
        }
      });
      
      setSelectedWeekdays(weekdayIndices);
    } else {
      setShowWeekdaySelector(false);
      setSelectedWeekdays(new Set());
    }
    
    setIsScheduleActionModalOpen(false);
    setIsAddEventModalOpen(true);
    // body 스크롤은 이미 비활성화되어 있으므로 유지
  };

  // 삭제 액션 핸들러
  const handleDeleteAction = async (event: ScheduleEvent) => {
    if (!event.sst_idx) {
      openSuccessModal('삭제 오류', '삭제할 수 없는 스케줄입니다.', 'error');
      return;
    }

    // 반복 일정인지 확인 (sst_repeat_json이 있는 경우)
    if (event.repeatText && event.repeatText !== '없음') {
      // 반복 일정인 경우 선택 모달 표시
      setPendingRepeatEvent(event);
      setRepeatActionType('delete');
      setIsScheduleActionModalOpen(false);
      setIsRepeatActionModalOpen(true);
      // body 스크롤 방지 유지
      document.body.style.overflow = 'hidden';
      return;
    }

    // 일반 일정 삭제 처리 - 액션 모달 먼저 닫기
    setIsScheduleActionModalOpen(false);
    await executeDeleteAction(event, 'single');
  };

  // 거리 계산 함수 (Haversine formula)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // 지구 반지름 (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance;
  };

  // 거리 텍스트 포맷팅 함수
  const formatDistance = (distance: number): string => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    } else {
      return `${distance.toFixed(1)}km`;
    }
  };

  // 멤버 위치 정보를 스케줄에 매핑하는 함수
  const mapMemberLocationToSchedule = (
    schedule: ScheduleEvent, 
    groupMembers: any[] // 실제 백엔드 그룹 멤버 데이터
  ): ScheduleEvent => {
    // tgtSgdtIdx와 일치하는 멤버 찾기
    console.log(`[mapMemberLocationToSchedule] 스케줄 "${schedule.title}" 처리 시작, tgtSgdtIdx: ${schedule.tgtSgdtIdx}, tgtMtIdx: ${schedule.tgtMtIdx}`); 
    const targetMember = groupMembers.find(member => 
      member.sgdt_idx === schedule.tgtSgdtIdx || member.mt_idx === schedule.tgtMtIdx
    );
    
    if (!targetMember) {
      return schedule;
    }
    
    // 스케줄에 멤버 정보 추가
    const updatedSchedule = {
      ...schedule,
      // 이미 설정되어 있는 경우 덮어쓰지 않음 (기존 이벤트 이름 보호)
      memberName: schedule.memberName || targetMember.mt_name || targetMember.name,
      memberNickname: schedule.memberNickname || targetMember.mt_nickname || targetMember.mt_name,
      memberCurrentLat: targetMember.mlt_lat,
      memberCurrentLng: targetMember.mlt_long,
      memberBattery: targetMember.mlt_battery,
      memberGpsTime: targetMember.mlt_gps_time,
    };
    
    console.log(`[mapMemberLocationToSchedule] 멤버 정보 업데이트 - 이름: ${updatedSchedule.memberName}, 닉네임: ${updatedSchedule.memberNickname}`);
    
    // 거리 계산 (스케줄 위치와 멤버 현재 위치)
    if (schedule.locationLat && schedule.locationLng && 
        targetMember.mlt_lat && targetMember.mlt_long) {
      const distance = calculateDistance(
        schedule.locationLat,
        schedule.locationLng,
        targetMember.mlt_lat,
        targetMember.mlt_long
      );
      
      updatedSchedule.distance = distance;
      updatedSchedule.distanceText = formatDistance(distance);
      
      // console.log(`[DISTANCE] 스케줄 "${schedule.title}" - 멤버 "${targetMember.mt_name}": ${formatDistance(distance)}`); 
      // console.log(`[DISTANCE] 스케줄 위치: (${schedule.locationLat}, ${schedule.locationLng}), 멤버 위치: (${targetMember.mlt_lat}, ${targetMember.mlt_long})`);
    }
    
    return updatedSchedule;
  };

  // 캐시 관리 함수들
  const updateCacheForEvent = (event: ScheduleEvent, action: 'add' | 'update' | 'delete') => {
    const eventDate = dayjs(event.date);
    const cacheKey = `${eventDate.year()}-${String(eventDate.month() + 1).padStart(2, '0')}`;
    
    if (loadedMonths.has(cacheKey)) {
      const cachedData = monthlyCache.get(cacheKey) || [];
      let updatedData: ScheduleEvent[];
      
      switch (action) {
        case 'add':
          updatedData = [...cachedData, event];
          break;
        case 'update':
          updatedData = cachedData.map(cachedEvent => 
            cachedEvent.id === event.id ? event : cachedEvent
          );
          break;
        case 'delete':
          updatedData = cachedData.filter(cachedEvent => cachedEvent.id !== event.id);
          break;
        default:
          updatedData = cachedData;
      }
      
      // 메모리 캐시 업데이트
      setMonthlyCache(prev => new Map(prev).set(cacheKey, updatedData));
      
      // 로컬 스토리지 캐시에도 저장
      saveCacheToStorage(cacheKey, updatedData);
      
      console.log(`[CACHE] ${action} 작업으로 캐시 업데이트:`, cacheKey);
    }
  };

  const clearCache = () => {
    setMonthlyCache(new Map());
    setLoadedMonths(new Set());
    
    // 로컬 스토리지 캐시도 초기화
    clearCacheFromStorage();
    
    console.log('[CACHE] 캐시 초기화 완료');
  };

  const getCacheStats = () => {
    const loadedMonthsList = Array.from(loadedMonths);
    const totalCachedEvents = Array.from(monthlyCache.values())
      .reduce((total, events) => total + events.length, 0);
    
    console.log('[CACHE] 캐시 통계:', {
      loadedMonths: loadedMonthsList,
      totalCachedEvents,
      cacheSize: monthlyCache.size
    });
    
    return { loadedMonthsList, totalCachedEvents, cacheSize: monthlyCache.size };
  };

  // 푸시 알림 처리 헬퍼 함수
  const handlePushNotification = async (
    action: 'create' | 'update' | 'delete',
    scheduleId: number,
    scheduleTitle: string,
    targetMemberId?: number
  ) => {
    try {
      // 현재 사용자 정보 찾기
      const currentMember = scheduleGroupMembers.find(member => member.isSelected);
      if (!currentMember) {
        console.warn('[PUSH NOTIFICATION] 현재 사용자 정보를 찾을 수 없습니다.');
        return;
      }

      // 타겟 멤버 정보 찾기 (다른 멤버의 일정을 생성/수정/삭제하는 경우)
      let targetMember: GroupMemberInfo | undefined;
      if (targetMemberId) {
        const foundMember = scheduleGroupMembers.find(member => member.mt_idx === targetMemberId);
        if (foundMember) {
                     targetMember = {
             mt_idx: foundMember.mt_idx,
             mt_name: foundMember.mt_name,
             mt_nickname: foundMember.name, // UI에서는 name 필드를 사용
             mt_id: foundMember.id, // UI에서는 id 필드를 사용
             mt_email: foundMember.id, // 임시로 id를 email로 사용
             sgdt_owner_chk: (foundMember.sgdt_owner_chk as 'Y' | 'N') || 'N',
             sgdt_leader_chk: (foundMember.sgdt_leader_chk as 'Y' | 'N') || 'N',
           };
        }
      }

      // 그룹 멤버들 정보 변환
      const groupMembers: GroupMemberInfo[] = scheduleGroupMembers.map(member => ({
        mt_idx: member.mt_idx,
        mt_name: member.mt_name,
        mt_nickname: member.name, // UI에서는 name 필드를 사용
        mt_id: member.id, // UI에서는 id 필드를 사용
        mt_email: member.id, // 임시로 id를 email로 사용
        sgdt_owner_chk: (member.sgdt_owner_chk === 'Y' ? 'Y' : 'N') as 'Y' | 'N',
        sgdt_leader_chk: (member.sgdt_leader_chk === 'Y' ? 'Y' : 'N') as 'Y' | 'N',
      }));

      // 현재 사용자 정보 변환
      const currentUser = {
        mt_idx: currentMember.mt_idx,
        mt_name: currentMember.mt_name,
        mt_nickname: currentMember.name,
        sgdt_owner_chk: (currentMember.sgdt_owner_chk === 'Y' ? 'Y' : 'N') as 'Y' | 'N',
        sgdt_leader_chk: (currentMember.sgdt_leader_chk === 'Y' ? 'Y' : 'N') as 'Y' | 'N',
      };

      // 푸시 알림 컨텍스트 생성
      const notificationContext: ScheduleNotificationContext = {
        scheduleId,
        scheduleTitle,
        currentUser,
        targetMember,
        groupMembers,
        action,
      };

      console.log('[PUSH NOTIFICATION] 알림 처리 시작:', {
        action,
        scheduleId,
        scheduleTitle,
        currentUser: currentUser.mt_name,
        targetMember: targetMember?.mt_name,
        groupMembersCount: groupMembers.length,
      });

      // 푸시 알림 전송
      await pushNotificationService.handleScheduleNotification(notificationContext);
    } catch (error) {
      console.error('[PUSH NOTIFICATION] 알림 처리 실패:', error);
    }
  };

  // 반복 모달 열기 핸들러
  const handleOpenRepeatModal = () => {
    console.log('[handleOpenRepeatModal] 시작 - 현재 newEvent.repeat:', newEvent.repeat);
    console.log('[handleOpenRepeatModal] 현재 selectedWeekdays:', Array.from(selectedWeekdays));
    console.log('[handleOpenRepeatModal] 현재 showWeekdaySelector:', showWeekdaySelector);

    // 현재 반복 설정을 임시 변수에 저장 (복원용)
    setTempRepeatValue(newEvent.repeat);
    setTempSelectedWeekdays(new Set(selectedWeekdays));
    setTempShowWeekdaySelector(showWeekdaySelector);

    // 모달 임시 상태 초기화 - 현재 설정값으로 세팅
    const currentRepeat = newEvent.repeat || '안함';
    let modalRepeatValue = '안함'; // 기본값을 명시적으로 설정
    let modalShowWeekdaySelector = false;
    let modalSelectedWeekdays = new Set<number>();

    console.log('[handleOpenRepeatModal] currentRepeat 분석:', currentRepeat);

    // 기본 옵션 확인
    if (['안함', '매일', '매월', '매년'].includes(currentRepeat)) {
      console.log('[handleOpenRepeatModal] 기본 반복 패턴 매치:', currentRepeat);
      modalRepeatValue = currentRepeat;
      modalShowWeekdaySelector = false;
      modalSelectedWeekdays = new Set();
    }
    // 매주 패턴 파싱 (더 견고하게)
    else if (currentRepeat.includes('매주')) {
      modalRepeatValue = '매주';
      modalShowWeekdaySelector = true;

      // 다양한 형식 지원: "매주 (수)", "매주(수)", "매주 수요일", "매주 월,화,수" 등
      let dayPart = '';
      const parenMatch = currentRepeat.match(/\((.*?)\)/);
      if (parenMatch && parenMatch[1]) {
        dayPart = parenMatch[1];
      } else {
        // 괄호 없는 경우 (예: "매주 수요일")
        const parts = currentRepeat.split(' ');
        if (parts.length > 1) {
          dayPart = parts.slice(1).join(' ');
        }
      }

      console.log('[handleOpenRepeatModal] 추출된 요일 부분:', dayPart);

      if (dayPart) {
        // 여러 요일 처리 (쉼표로 구분)
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const dayNamesToProcess = dayPart.split(',').map(name => name.trim());
        console.log('[handleOpenRepeatModal] 처리할 요일들:', dayNamesToProcess);

        dayNamesToProcess.forEach(dayName => {
          // 단일 글자 요일명으로 변환 (예: "수요일" -> "수")
          let shortName = dayName;
          if (dayName.length > 1) {
            // "수요일" -> "수" 변환
            const dayMapping: { [key: string]: string } = {
              '일요일': '일', '월요일': '월', '화요일': '화', '수요일': '수',
              '목요일': '목', '금요일': '금', '토요일': '토'
            };
            shortName = dayMapping[dayName] || dayName.charAt(0);
          }

          console.log('[handleOpenRepeatModal] 변환된 요일명:', shortName);

          const index = dayNames.indexOf(shortName);
          console.log('[handleOpenRepeatModal] 요일 매칭:', shortName, '-> 인덱스:', index);
          if (index !== -1) {
            modalSelectedWeekdays.add(index);
          }
        });
      }

      // 요일이 선택되지 않은 경우 기존 선택된 요일 사용
      if (modalSelectedWeekdays.size === 0) {
        modalSelectedWeekdays = new Set(selectedWeekdays);
      }
    }
    // 기존 특수 케이스들
    else if (currentRepeat === '매주 월,화,수,목,금') {
      console.log('[handleOpenRepeatModal] 매주 월,화,수,목,금 패턴 매치');
      modalRepeatValue = '매주';
      modalShowWeekdaySelector = true;
      modalSelectedWeekdays = new Set([1, 2, 3, 4, 5]);
    }
    else {
      console.log('[handleOpenRepeatModal] 알 수 없는 패턴, 기본값 사용');
      modalRepeatValue = '안함';
      modalShowWeekdaySelector = false;
      modalSelectedWeekdays = new Set();
    }

    console.log('[handleOpenRepeatModal] 계산된 모달 상태:', {
      modalRepeatValue,
      modalShowWeekdaySelector,
      modalSelectedWeekdays: Array.from(modalSelectedWeekdays)
    });

    // 상태 설정
    setTempModalRepeatValue(modalRepeatValue);
    setTempModalShowWeekdaySelector(modalShowWeekdaySelector);
    setTempModalSelectedWeekdays(modalSelectedWeekdays);

    // 상태 설정 후 로그
    console.log('[handleOpenRepeatModal] 상태 설정 완료');

    setIsRepeatModalOpen(true);
  };

  // 반복 모달 확인 핸들러
  const handleConfirmRepeatModal = () => {
    // 매주 선택이고 요일이 선택되지 않은 경우 경고
    if (tempModalRepeatValue === '매주' && tempModalSelectedWeekdays.size === 0) {
      alert('매주 반복을 선택한 경우 최소 1개의 요일을 선택해주세요.');
      return;
    }
    
    // 임시 모달 상태를 실제 상태에 반영
    let finalRepeatValue = tempModalRepeatValue;
    
    // 매주가 선택된 경우 요일 처리
    if (tempModalRepeatValue === '매주' && tempModalSelectedWeekdays.size > 0) {
      // 월~금이 모두 선택된 경우 특별 처리
      if (tempModalSelectedWeekdays.has(1) && tempModalSelectedWeekdays.has(2) && 
          tempModalSelectedWeekdays.has(3) && tempModalSelectedWeekdays.has(4) && 
          tempModalSelectedWeekdays.has(5) && tempModalSelectedWeekdays.size === 5) {
        finalRepeatValue = '매주 월,화,수,목,금';
      } else {
        // 선택된 요일들을 텍스트로 변환
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const selectedDayNames: string[] = [];
        
        // 요일 순서대로 정렬하여 추가 (일요일=0, 월요일=1, ...)
        for (let i = 0; i <= 6; i++) {
          if (tempModalSelectedWeekdays.has(i)) {
            selectedDayNames.push(dayNames[i]);
          }
        }
        
        finalRepeatValue = `매주 ${selectedDayNames.join(',')}`;
      }
    }
    
    setNewEvent(prev => ({ ...prev, repeat: finalRepeatValue }));
    setSelectedWeekdays(new Set(tempModalSelectedWeekdays));
    setShowWeekdaySelector(tempModalShowWeekdaySelector);
    
    console.log('[handleConfirmRepeatModal] 최종 반영:', {
      finalRepeatValue,
      selectedWeekdays: Array.from(tempModalSelectedWeekdays),
      showWeekdaySelector: tempModalShowWeekdaySelector
    });
    
    setIsRepeatModalOpen(false);
  };

  // 반복 모달 취소 핸들러
  const handleCancelRepeatModal = () => {
    // 임시 설정을 원래 값으로 되돌림 (실제 상태는 변경하지 않음)
    console.log('[handleCancelRepeatModal] 취소 - 원래 상태 유지:', {
      originalRepeat: tempRepeatValue,
      originalSelectedWeekdays: Array.from(tempSelectedWeekdays),
      originalShowWeekdaySelector: tempShowWeekdaySelector
    });

    setIsRepeatModalOpen(false);
  };

  // 전체 로딩 완료 체크
  const isLoadingComplete = loadingSteps.groups && loadingSteps.schedules && loadingSteps.calendar && loadingSteps.ui;

  return (
    <>
      <style jsx global>{pageStyles}</style>
      
      {/* 플로팅 버튼 - 일정 추가 */}
      <FloatingButton
        variant="schedule"
        onClick={handleOpenAddEventModal}
      />
      

      <div 
        className="fixed inset-0 overflow-visible bg-gradient-to-br from-indigo-50 via-white to-purple-50 main-container"
        id="schedule-page-container"
        style={{
          paddingTop: '0px',
          marginTop: '0px',
          top: '0px'
        }}
      >
        {/* 🔥 직접 만든 헤더 - AnimatedHeader 우회 */}
        <header 
          className="fixed top-0 left-0 right-0 z-[2147483647] glass-effect header-fixed schedule-header"
          style={{
            position: 'fixed',
            top: '0px',
            left: '0px', 
            right: '0px',
            zIndex: 2147483647,
            height: '56px',
            minHeight: '56px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(229, 231, 235, 0.8)',
            display: 'flex',
            alignItems: 'stretch',
            width: '100vw',
            margin: '0px',
            padding: '0px',

          }}
        >
          <div 
            ref={(el) => {
              if (el) {
                // 패딩 적용
                el.style.setProperty('padding-top', '8px', 'important');
                el.style.setProperty('padding-bottom', '8px', 'important');

                
                // 부모 헤더 요소 찾아서 높이 강제 변경
                const header = el.closest('header');
                if (header) {
                  header.style.setProperty('height', '64px', 'important');
                  header.style.setProperty('min-height', '64px', 'important');
                  header.style.setProperty('max-height', 'none', 'important');
                  }
              }
            }}
            className="flex items-center justify-between px-4 w-full" 
            style={{
              width: '100%',
              height: '56px',
              maxHeight: '56px',
              minHeight: '56px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div 
                key="schedule-header"
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="flex items-center space-x-3 motion-div"
              >
                <div className="flex items-center space-x-3">
                  <div>
                    <h1 className="text-lg font-bold text-gray-900">일정</h1>
                    <p className="text-xs text-gray-500">그룹 멤버들과 일정을 공유해보세요</p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
            
            <div className="flex items-center space-x-2">
              {/* 필요시 추가 버튼들을 여기에 배치 */}
            </div>
          </div>
        </header>

        {/* 메인 컨텐츠 - 고정 위치 */}
          <motion.div
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            className="absolute inset-0 px-4 space-y-5 pb-24 overflow-y-auto content-area pt-4 safe-area-all"
            style={{
              top: '64px', // 새로운 헤더 높이만큼 아래로
              bottom: '0', // 화면 끝까지 확장
              left: '0',
              right: '0',
              height: 'calc(100vh - 64px)', // 전체 높이에서 헤더만 제외
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain'
            }}
          >
            {/* 캘린더 섹션 */}
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={0}
              style={{ zIndex: 0 }}
            >
              {/* 캘린더 컴포넌트 */}
              <motion.div
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={0}
                style={{ zIndex: 0 }}
              >
                <MobileCalendar 
                  selectedDay={selectedDay} 
                  onDayClick={(day: Dayjs) => {
                    console.log('[onDayClick] 날짜 선택:', day.format('YYYY-MM-DD'));
                    setSelectedDay(day);
                    
                    // 클릭된 날짜의 월이 현재 로드된 월과 다른 경우 해당 월 데이터 로드
                    const clickedMonth = day.month() + 1;
                    const clickedYear = day.year();
                    const clickedCacheKey = `${clickedYear}-${clickedMonth.toString().padStart(2, '0')}`;
                    
                    // 해당 월 데이터가 캐시에 있는지 확인
                    if (loadedMonths.has(clickedCacheKey)) {
                      console.log('[onDayClick] 캐시된 월 데이터 존재:', clickedCacheKey);
                      const cachedData = monthlyCache.get(clickedCacheKey) || [];
                      
                      // 캐시된 데이터를 현재 events와 병합
                      setEvents(prevEvents => {
                        const existingDates = new Set(prevEvents.map(event => event.date));
                        const newEvents = cachedData.filter(event => !existingDates.has(event.date));
                        return [...prevEvents, ...newEvents];
                      });
                    } else {
                      console.log('[onDayClick] 해당 월 데이터 없음, 로드 시작:', clickedCacheKey);
                      loadAllGroupSchedules(day.year(), day.month() + 1, true);
                    }
                  }}
                  events={events}
                  onMonthChange={(year, month) => {
                    console.log('[onMonthChange] 월 변경:', { year, month, selectedDay: selectedDay?.format('YYYY-MM-DD') });
                    // 월 변경 시 캐싱 시스템을 사용하여 데이터 로드
                    loadAllGroupSchedules(year, month, true);
                  }}
                />
              </motion.div>
            </motion.div>

            {/* 선택된 날짜의 일정 목록 */}
            {selectedDay && (
              <motion.div
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={1}
              >
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* 헤더 */}
                  <motion.div 
                    className="px-6 py-4 text-white"
                    style={{ background: 'linear-gradient(to right, #0113A3, #001a8a)' }}
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold">
                          {format(selectedDay.toDate(), 'MM월 dd일 (E)', { locale: ko })}
                        </h3>
                        <p className="text-blue-100 text-sm">
                          {isMonthChanging ? '일정 로딩 중...' : `${eventsForSelectedDay.length}개의 일정`}
                        </p>
                      </div>
                      <motion.div 
                        className="flex items-center space-x-1 bg-white/20 px-3 py-1 rounded-full"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                      >
                        <HiSparkles className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm font-medium">일정</span>
                      </motion.div>
                    </div>
                  </motion.div>

                  {/* 일정 목록 */}
                  <div className="p-4">
                    <AnimatePresence mode="wait">
                      {isMonthChanging ? (
                        /* 개선된 스켈레톤 로딩 */
                        <motion.div 
                          key="skeleton-loading"
                          className="space-y-4"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                        >
                          {[1, 2, 3].map((index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 15 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1, duration: 0.4 }}
                              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200"
                            >
                              {/* 상단: 시간 정보와 상태 배지 스켈레톤 */}
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-pink-100 to-pink-200 rounded-xl animate-pulse flex items-center justify-center">
                                    <div className="w-5 h-5 bg-pink-300 rounded-sm"></div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="h-5 bg-gray-200 rounded w-16 mb-1 animate-pulse"></div>
                                    <div className="h-3 bg-gray-200 rounded w-12 animate-pulse"></div>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end space-y-1">
                                  <div className="h-6 bg-gradient-to-r from-blue-100 to-blue-200 rounded-full w-14 animate-pulse"></div>
                                  <div className="h-4 bg-gray-200 rounded-full w-10 animate-pulse"></div>
                                </div>
                              </div>

                              {/* 제목 스켈레톤 */}
                              <div className="mb-4 space-y-2">
                                <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                                <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                              </div>

                              {/* 멤버 정보 스켈레톤 */}
                              <div className="flex items-center space-x-2 mb-4">
                                <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
                                <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                                <div className="h-3 bg-gray-200 rounded w-12 animate-pulse"></div>
                              </div>

                              {/* 장소 정보 스켈레톤 */}
                              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 animate-pulse">
                                <div className="flex items-start space-x-3">
                                  <div className="w-5 h-5 bg-gray-300 rounded-full mt-0.5"></div>
                                  <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                                  </div>
                                </div>
                              </div>

                              {/* 하단 액션 버튼 스켈레톤 */}
                              <div className="flex justify-end space-x-2 mt-4 pt-3 border-t border-gray-100">
                                <div className="h-8 bg-gray-200 rounded-lg w-16 animate-pulse"></div>
                                <div className="h-8 bg-gray-200 rounded-lg w-16 animate-pulse"></div>
                              </div>
                            </motion.div>
                          ))}
                          
                          {/* 로딩 메시지 */}
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6, duration: 0.5 }}
                            className="text-center py-6"
                          >
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                              <FiCalendar className="w-6 h-6 text-blue-500" />
                            </div>
                            <p className="text-gray-500 text-sm font-medium">일정을 불러오는 중...</p>
                            <p className="text-gray-400 text-xs mt-1">잠시만 기다려주세요</p>
                          </motion.div>
                        </motion.div>
                      ) : eventsForSelectedDay.length > 0 ? (
                        <motion.div 
                          key={selectedDay.format('YYYY-MM-DD')}
                          className="space-y-3"
                          style={{ 
                            WebkitOverflowScrolling: 'touch'
                          }}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ 
                            duration: 0.3
                          }}
                        >
                          {eventsForSelectedDay.map((event, index) => {
                            const status = getEventStatus(event);
                            
                            // 소요 시간 계산
                            const startTime = dayjs(`${event.date} ${event.startTime}`);
                            const endTime = dayjs(`${event.date} ${event.endTime}`);
                            const durationMinutes = endTime.diff(startTime, 'minute');
                            const durationHours = Math.floor(durationMinutes / 60);
                            const remainingMinutes = durationMinutes % 60;
                            const durationText = durationHours > 0 
                              ? `${durationHours}시간 ${remainingMinutes}분`
                              : `${remainingMinutes}분`;

                            // 상태별 색상 설정
                            const getStatusColor = (statusText: string) => {
                              switch (statusText) {
                                case '완료':
                                  return {
                                    color: 'text-green-700',
                                    bgColor: 'bg-green-100',
                                    dotColor: 'bg-green-500'
                                  };
                                case '진행중':
                                  return {
                                    color: 'text-orange-700',
                                    bgColor: 'bg-orange-100',
                                    dotColor: 'bg-orange-500'
                                  };
                                case '예정':
                                  return {
                                    color: 'text-blue-700',
                                    bgColor: 'bg-blue-100',
                                    dotColor: 'bg-blue-500'
                                  };
                                default:
                                  return {
                                    color: 'text-gray-700',
                                    bgColor: 'bg-gray-100',
                                    dotColor: 'bg-gray-500'
                                  };
                              }
                            };

                            const statusColors = getStatusColor(status.text);

                            return (
                              <motion.div
                                key={event.id}
                                onClick={() => handleEventItemClick(event)}
                                className="relative group cursor-pointer"
                                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                                animate={{ 
                                  opacity: 1, 
                                  y: 0,
                                  scale: 1,
                                  transition: {
                                    duration: 0.3,
                                    delay: index * 0.05
                                  }
                                }}
                                whileHover={{ 
                                  scale: 1.02,
                                  y: -4,
                                  transition: { duration: 0.2 }
                                }}

                              >
                                {/* 메인 카드 - 컴팩트 버전 */}
                                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-300 group-hover:shadow-md group-hover:border-gray-200 transition-all duration-200">
                                  
                                  {/* 상단: 시간 정보와 상태 배지 */}
                                  <div className="flex items-start justify-between mb-3">
                                    {/* 왼쪽: 시간 아이콘과 시간 */}
                                    <div className="flex items-center space-x-3">
                                      <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <FiClock className="w-5 h-5 text-pink-600" />
                                      </div>
                                      <div>
                                        {event.isAllDay ? (
                                          <div>
                                            <div className="text-xl font-bold text-gray-900">하루종일</div>
                                            <div className="text-xs text-gray-500">{durationText}</div>
                                          </div>
                                        ) : (
                                          <div>
                                            <div className="flex items-baseline space-x-1">
                                              <span className="text-xl font-bold text-gray-900">{event.startTime}</span>
                                              <span className="text-sm text-gray-400">~</span>
                                              <span className="text-sm font-medium text-gray-500">{event.endTime}</span>
                                            </div>
                                            <div className="text-xs text-gray-500">{durationText}</div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* 오른쪽: 상태 배지와 반복 정보 */}
                                    <div className="flex flex-col items-end space-y-1">
                                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${statusColors.color} ${statusColors.bgColor}`}>
                                        <div className={`w-2 h-2 rounded-full mr-1.5 ${statusColors.dotColor} ${
                                          status.text === '진행중' ? 'animate-pulse' : ''
                                        }`}></div>
                                        {status.text}
                                      </div>

                                      {/* 반복 정보 */}
                                      {event.repeatText && event.repeatText !== '없음' && (
                                        <div className="flex items-center space-x-1 bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-medium">
                                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                          </svg>
                                          <span>{event.repeatText}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* 제목 */}
                                  <div className="mb-4">
                                    <h3 className="pl-2 text-lg font-normal text-gray-900 leading-tight" style={{ wordBreak: 'keep-all' }}>
                                      {event.title}
                                    </h3>
                                    {event.content && (
                                      <p className="pl-3 text-gray-500 leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                                        {event.content}
                                      </p>
                                    )}
                                  </div>

                                  {/* 장소 정보 */}
                                  {event.locationName && (
                                    <div className="mb-4 bg-blue-50 rounded-xl p-4 pl-0 pr-4">
                                      <div className="space-y-1 pl-4">
                                        <div className="text-base font-bold text-blue-900" style={{ wordBreak: 'keep-all' }}>
                                          {event.locationName}
                                        </div>
                                        {event.locationAddress && (
                                          <p className="text-sm text-blue-700" style={{ wordBreak: 'keep-all' }}>
                                            {event.locationAddress}
                                          </p>
                                        )}
                                        
                                        {/* 거리와 GPS 시간 정보 - 컴팩트 디자인 */}
                                        {(event.distanceText || event.memberGpsTime) && (
                                          <div className="space-y-1 mt-2">
                                            {/* 거리 정보 */}
                                            {event.distanceText && (
                                              <div className="flex items-center space-x-1.5 bg-amber-50 px-2 py-1.5 rounded-md border border-amber-200 shadow-sm">
                                                <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                <span className="text-xs font-medium text-amber-700">목적지까지</span>
                                                <span className="text-xs font-bold text-amber-800 bg-amber-200 px-1.5 py-0.5 rounded">
                                                  {event.distanceText}
                                                </span>
                                              </div>
                                            )}

                                            {/* GPS 시간 정보 - 거리 정보와 동일한 스타일 */}
                                            {event.memberGpsTime && (
                                              <div className="flex items-center space-x-1.5 bg-red-50 px-2 py-1.5 rounded-md border border-red-200 shadow-sm">
                                                <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <span className="text-xs font-medium text-red-700">위치 업데이트</span>
                                                <span className="text-xs font-bold text-red-800 bg-red-200 px-1.5 py-0.5 rounded">
                                                  {dayjs(event.memberGpsTime).format('MM/DD HH:mm')}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* 하단: 그룹 및 멤버 정보 */}
                                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                    {/* 왼쪽: 그룹 정보 */}
                                    <div className="flex items-center space-x-2">
                                      {event.groupName && (
                                        <>
                                          <span className="text-xs font-medium text-gray-500">그룹:</span>
                                          <span className="text-xs font-semibold text-indigo-600">{event.groupName}</span>
                                        </>
                                      )}
                                    </div>

                                    {/* 오른쪽: 멤버 정보 */}
                                    {event.memberName && (
                                      <div className="flex items-center space-x-2">
                                        <div className="w-6 h-6 rounded-full overflow-hidden">
                                          <Image
                                            src={getSafeImageUrl(event.memberPhoto || null, event.memberGender, event.tgtSgdtIdx || 0)}
                                            alt={event.memberName}
                                            width={24}
                                            height={24}
                                            className="w-full h-full object-cover"
                                            placeholder="blur"
                                            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+Kic6LbqN1NzKhDFl3HI7L7IlJWK3jKYBaKJmVdJKhg1Qg8yKjfpYZaGu7WZPYwNAR4vTYK5AAAAABJRU5ErkJggg=="
                                            onError={(e) => {
                                              e.currentTarget.src = getDefaultImage(event.memberGender, event.tgtSgdtIdx || 0);
                                            }}
                                          />
                                        </div>
                                        <span className="text-xs font-medium text-gray-700">
                                          {event.memberNickname || event.memberName}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      ) : (
                        <motion.div 
                          key={`empty-${selectedDay.format('YYYY-MM-DD')}`}
                          className="text-center py-12"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                        >
                          <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                            <FiCalendar className="w-10 h-10 text-gray-400" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-700 mb-2">일정이 없습니다</h3>
                          <p className="text-gray-500 text-sm mb-6">새로운 일정을 추가해보세요</p>
                          
                          {/* 일정 추가 버튼 */}
                          <motion.button
                            onClick={handleOpenAddEventModal}
                            className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-[#0113A3] to-[#001a8a] text-white rounded-xl font-medium mobile-button shadow-lg hover:shadow-xl transition-all duration-200"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <FiPlus className="w-4 h-4" />
                            <span>일정 추가</span>
                          </motion.button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 반복 설정 모달 */}
            <AnimatePresence>
              {isRepeatModalOpen && (
                <Portal>
                  <motion.div 
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" 
                  onClick={() => handleCancelRepeatModal()}
                  style={{ zIndex: 9999999 }}
                  data-portal="repeat-modal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.div 
                    className="w-full max-w-sm bg-white rounded-3xl shadow-2xl mx-4"
                    onClick={e => e.stopPropagation()}
                    onWheel={e => e.stopPropagation()}
                    onTouchMove={e => e.stopPropagation()}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="p-6">
                      <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">반복 설정</h3>
                      
                      <div className="space-y-2">
                        {['안함', '매일', '매주', '매월', '매년'].map((option) => (
                          <button
                            key={option}
                            onClick={() => {
                              setTempModalRepeatValue(option);
                              if (option === '매주') {
                                setTempModalShowWeekdaySelector(true);
                              } else {
                                setTempModalShowWeekdaySelector(false);
                                setTempModalSelectedWeekdays(new Set());
                              }
                            }}
                            className={`w-full px-4 py-3 text-left rounded-xl transition-all duration-200 mobile-button ${
                              tempModalRepeatValue === option
                                ? 'bg-amber-100 text-amber-800 font-semibold border-2 border-amber-300'
                                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-transparent'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{option}</span>
                              {tempModalRepeatValue === option && (
                                <span className="text-amber-600">✓</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* 매주 선택 시 요일 선택 UI */}
                      {tempModalShowWeekdaySelector && tempModalRepeatValue === '매주' && (
                        <motion.div 
                          className="mt-6 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 shadow-sm"
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                          <div className="flex items-center space-x-2 mb-3">
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <h4 className="text-sm font-semibold text-gray-900">반복할 요일 선택</h4>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                            매주 반복할 요일을 선택하세요. 여러 요일을 선택할 수 있습니다.
                          </p>
                          <div className="grid grid-cols-7 gap-3 p-2">
                            {[
                              { day: 1, label: '월', color: 'from-red-400 to-red-500' },
                              { day: 2, label: '화', color: 'from-orange-400 to-orange-500' },
                              { day: 3, label: '수', color: 'from-yellow-400 to-yellow-500' },
                              { day: 4, label: '목', color: 'from-green-400 to-green-500' },
                              { day: 5, label: '금', color: 'from-blue-400 to-blue-500' },
                              { day: 6, label: '토', color: 'from-indigo-400 to-indigo-500' },
                              { day: 0, label: '일', color: 'from-purple-400 to-purple-500' }
                            ].map((weekday, index) => (
                              <motion.div
                                key={weekday.day}
                                className="relative flex flex-col items-center"
                                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ 
                                  duration: 0.4, 
                                  delay: index * 0.08,
                                  ease: "easeOut"
                                }}
                              >
                                <motion.button
                                  whileTap={{ scale: 0.92 }}
                                  onClick={() => {
                                    const newSelectedWeekdays = new Set(tempModalSelectedWeekdays);
                                    if (newSelectedWeekdays.has(weekday.day)) {
                                      newSelectedWeekdays.delete(weekday.day);
                                    } else {
                                      newSelectedWeekdays.add(weekday.day);
                                    }
                                    setTempModalSelectedWeekdays(newSelectedWeekdays);
                                  }}
                                  className={`w-8 h-8 rounded-xl text-sm font-bold transition-all duration-300 transform overflow-visible relative grid place-items-center justify-center ${
                                    tempModalSelectedWeekdays.has(weekday.day)
                                      ? `bg-gradient-to-br ${weekday.color} shadow-lg border-2 border-white`
                                      : 'bg-white border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 shadow-sm'
                                  }`}
                                  style={{ padding: 0 }}
                                >
                                  <span
                                    className="font-bold text-center w-full"
                                    style={{
                                      color: tempModalSelectedWeekdays.has(weekday.day) ? '#ffffff' : '#374151',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: '100%',
                                      height: '100%',
                                      transition: 'transform 0.2s',
                                      transform: tempModalSelectedWeekdays.has(weekday.day) ? 'translateY(3px)' : 'none'
                                    }}
                                  >
                                    {weekday.label}
                                  </span>
                                  
                                  {/* 체크박스를 요일 버튼 오른쪽 위에 위치 */}
                                  {tempModalSelectedWeekdays.has(weekday.day) && (
                                    <motion.div
                                      className="absolute -top-7 -right-4 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center border-2 border-white z-10"
                                      initial={{ scale: 0, rotate: -180 }}
                                      animate={{ scale: 1, rotate: 0 }}
                                      transition={{ duration: 0.3 }}
                                    >
                                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    </motion.div>
                                  )}
                                </motion.button>
                              </motion.div>
                            ))}
                          </div>
                          {tempModalSelectedWeekdays.size === 0 && (
                            <motion.div 
                              className="p-3 bg-red-50 border border-red-200 rounded-xl"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.6 }}
                            >
                              <div className="flex items-center space-x-2">
                                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <p className="text-xs text-red-600 font-medium">
                                  최소 1개의 요일을 선택해주세요.
                                </p>
                              </div>
                            </motion.div>
                          )}
                          {tempModalSelectedWeekdays.size > 0 && (
                            <motion.div 
                              className="p-3 bg-green-50 border border-green-200 rounded-xl"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.3 }}
                            >
                              <div className="flex items-center space-x-2">
                                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <p className="text-xs text-green-600 font-medium">
                                  {tempModalSelectedWeekdays.size}개 요일이 선택되었습니다.
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </motion.div>
                      )}

                      <div className="mt-4 space-y-2">
                        <button
                          onClick={() => handleConfirmRepeatModal()}
                          className="w-full py-3 bg-green-600 text-white rounded-xl font-medium mobile-button hover:bg-green-700 transition-colors"
                        >
                          확인
                        </button>
                        <button
                          onClick={() => handleCancelRepeatModal()}
                          className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium mobile-button hover:bg-gray-200 transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
                </Portal>
              )}
            </AnimatePresence>

            {/* 알림 설정 모달 */}
            <AnimatePresence>
                {isAlarmModalOpen && (
                  <Portal>
                    <motion.div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" 
                    onClick={() => setIsAlarmModalOpen(false)}
                    style={{ zIndex: 9999999 }}
                    data-portal="alarm-modal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <motion.div 
                      className="w-full max-w-sm bg-white rounded-3xl shadow-2xl mx-4"
                      onClick={e => e.stopPropagation()}
                      onWheel={e => e.stopPropagation()}
                      onTouchMove={e => e.stopPropagation()}
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">알림 설정</h3>
                        
                        <div ref={alarmScrollRef} className="space-y-2 max-h-64 overflow-y-auto scroll-container">
                          {['없음', '정시', '5분 전', '10분 전', '15분 전', '30분 전', '1시간 전', '1일 전'].map((option) => (
                            <button
                              key={option}
                                  onClick={() => {
                                setNewEvent({ ...newEvent, alarm: option });
                                setIsAlarmModalOpen(false);
                              }}
                              className={`w-full px-4 py-3 text-left rounded-xl transition-all duration-200 mobile-button ${
                                newEvent.alarm === option
                                  ? 'bg-amber-100 text-amber-800 font-semibold border-2 border-amber-300'
                                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-transparent'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span>{option}</span>
                                {newEvent.alarm === option && (
                                  <span className="text-amber-600">✓</span>
                                )}
                              </div>
                                </button>
                              ))}
                            </div>

                        <button
                          onClick={() => setIsAlarmModalOpen(false)}
                          className="w-full mt-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium mobile-button hover:bg-gray-200 transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                  </Portal>
                )}
            </AnimatePresence>

            {/* 날짜 및 시간 설정 모달 */}
            <AnimatePresence>
                {isDateTimeModalOpen && (
                  <Portal>
                    <motion.div 
                      className="modal-overlay-top modal-backdrop flex items-center justify-center bg-black/50 backdrop-blur-sm" 
                      onClick={() => setIsDateTimeModalOpen(false)}
                      style={{ zIndex: 9999999 }}
                      data-portal="datetime-modal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <motion.div 
                      className="modal-content-top w-full max-w-md bg-white rounded-3xl shadow-2xl mx-4"
                      onClick={e => e.stopPropagation()}
                      onWheel={e => e.stopPropagation()}
                      onTouchMove={e => e.stopPropagation()}
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-6 text-center">날짜 및 시간 설정</h3>
                        
                        <div className="space-y-6">
                          {/* 하루 종일 토글 */}
                          <div className="flex justify-between items-center p-4 bg-green-50 rounded-xl border border-green-100">
                            <div>
                              <label className="text-sm font-medium text-gray-900">하루 종일</label>
                              <p className="text-xs text-gray-600 mt-1">시간을 설정하지 않고 하루 전체로 설정</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setTempDateTime(prev => ({ ...prev, allDay: !prev.allDay }))}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${tempDateTime.allDay ? 'bg-green-600' : 'bg-gray-200'}`}
                              role="switch"
                              aria-checked={tempDateTime.allDay}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${tempDateTime.allDay ? 'translate-x-5' : 'translate-x-0'}`}
                              />
                            </button>
                          </div>

                          {/* 날짜 선택 */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                              날짜 <span className="text-red-500">*</span>
                            </label>
                            <button
                              type="button"
                              onClick={handleOpenCalendarModal}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors text-base bg-white text-left flex items-center justify-between hover:bg-gray-50"
                            >
                              <span className="text-gray-900 font-medium">
                                {dayjs(tempDateTime.date).format('YYYY년 MM월 DD일 (ddd)')}
                              </span>
                              <FiCalendar className="w-5 h-5 text-gray-400" />
                            </button>
                          </div>

                          {/* 시간 선택 (하루종일이 아닐 때만) */}
                          {!tempDateTime.allDay && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-3">시작 시간</label>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenTimeModal('start')}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors text-base bg-white text-left flex items-center justify-between hover:bg-gray-50"
                                  >
                                    <span className="text-gray-900 font-medium">
                                      {tempDateTime.startTime}
                                    </span>
                                    <FiClock className="w-5 h-5 text-gray-400" />
                                  </button>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-3">종료 시간</label>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenTimeModal('end')}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors text-base bg-white text-left flex items-center justify-between hover:bg-gray-50"
                                  >
                                    <span className="text-gray-900 font-medium">
                                      {tempDateTime.endTime}
                                    </span>
                                    <FiClock className="w-5 h-5 text-gray-400" />
                                  </button>
                                </div>
                              </div>
                              
                              {/* 시간 미리보기 */}
                              <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-600 text-center">
                                  <span className="font-medium text-gray-900">
                                    {dayjs(tempDateTime.date).format('YYYY년 MM월 DD일')}
                                  </span>
                                  <br />
                                  <span className="text-green-600 font-medium">
                                    {tempDateTime.startTime} ~ {tempDateTime.endTime}
                                  </span>
                                </p>
                              </div>
                            </div>
                          )}

                          {/* 하루 종일일 때 미리보기 */}
                          {tempDateTime.allDay && (
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <p className="text-sm text-gray-600 text-center">
                                <span className="font-medium text-gray-900">
                                  {dayjs(tempDateTime.date).format('YYYY년 MM월 DD일')}
                                </span>
                                <br />
                                <span className="text-green-600 font-medium">하루 종일</span>
                              </p>
                            </div>
                          )}

                          {/* 오류 메시지 표시 영역 */}
                          {dateTimeError && (
                            <div className="mt-2 flex items-center text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                              <FiAlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                              <span>{dateTimeError}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex space-x-3 mt-6">
                          <button
                            onClick={handleCancelDateTimeModal}
                            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium mobile-button hover:bg-gray-200 transition-colors"
                          >
                            취소
                          </button>
                            <button
                              onClick={handleConfirmDateTimeModal}
                              disabled={!!dateTimeError}
                              className={`flex-1 py-3 rounded-xl font-medium mobile-button transition-colors ${
                                dateTimeError 
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                  : 'bg-green-600 text-white hover:bg-green-700'
                              }`}
                            >
                              확인
                            </button>
                        </div>
                      </div>
                    </motion.div>
                    </motion.div>
                  </Portal>
                )}
            </AnimatePresence>

            {/* 커스텀 시간 선택 모달 */}
            <AnimatePresence>
              {isTimeModalOpen && (
                <Portal>
                  <motion.div 
                  className="modal-overlay-top modal-backdrop flex items-center justify-center bg-black/50 backdrop-blur-sm" 
                  onClick={handleCloseTimeModal}
                  style={{ zIndex: 9999999 }}
                  data-portal="time-modal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.div 
                    className="modal-content-top w-full max-w-sm bg-white rounded-3xl shadow-2xl mx-4"
                    onClick={e => e.stopPropagation()}
                    onWheel={e => e.stopPropagation()}
                    onTouchStart={e => e.stopPropagation()}
                    onTouchMove={e => e.stopPropagation()}
                    onTouchEnd={e => e.stopPropagation()}
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="p-6">
                      {/* 시간 선택 헤더 */}
                      <div className="text-center mb-6">
                        <h3 className="text-lg font-bold text-gray-900">
                          {timeModalType === 'start' ? '시작 시간' : '종료 시간'} 선택
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          원하는 시간을 선택해주세요
                        </p>
                      </div>

                      {/* 현재 선택된 시간 표시 */}
                      <div className="text-center mb-6 p-4 bg-green-50 rounded-xl border border-green-100">
                        <div className="text-2xl font-bold text-green-700">
                          {selectedHour.toString().padStart(2, '0')}:{selectedMinute.toString().padStart(2, '0')}
                        </div>
                        <div className="text-sm text-green-600 mt-1">
                          {selectedHour < 12 ? '오전' : '오후'} {selectedHour === 0 ? 12 : selectedHour > 12 ? (selectedHour - 12).toString().padStart(2, '0') : selectedHour.toString().padStart(2, '0')}시 {selectedMinute.toString().padStart(2, '0')}분
                                </div>
                              </div>
                              
                      {/* 시간 선택 영역 */}
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        {/* 시간 선택 */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-3 text-center">시간</label>
                          <div ref={hourScrollRef} className="modal-scroll-area max-h-32 overflow-y-auto border border-gray-200 rounded-lg scroll-container">
                            {Array.from({ length: 24 }, (_, i) => (
                              <motion.button
                                key={i}
                                onClick={() => handleHourChange(i)}
                                className={`w-full px-3 py-2 text-sm transition-all duration-200 mobile-button ${
                                  selectedHour === i
                                    ? 'bg-green-600 text-white font-semibold'
                                    : 'hover:bg-gray-100 text-gray-700'
                                }`}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                {i.toString().padStart(2, '0')}시
                              </motion.button>
                            ))}
                          </div>
                        </div>

                        {/* 분 선택 */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-3 text-center">분</label>
                          <div ref={minuteScrollRef} className="modal-scroll-area max-h-32 overflow-y-auto border border-gray-200 rounded-lg scroll-container">
                            {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => (
                              <motion.button
                                key={minute}
                                onClick={() => handleMinuteChange(minute)}
                                className={`w-full px-3 py-2 text-sm transition-all duration-200 mobile-button ${
                                  selectedMinute === minute
                                    ? 'bg-green-600 text-white font-semibold'
                                    : 'hover:bg-gray-100 text-gray-700'
                                }`}

                              >
                                {minute.toString().padStart(2, '0')}분
                              </motion.button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* 빠른 선택 버튼들 */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-3 text-center">빠른 선택</label>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { label: '9:00', hour: 9, minute: 0 },
                            { label: '12:00', hour: 12, minute: 0 },
                            { label: '14:00', hour: 14, minute: 0 },
                            { label: '18:00', hour: 18, minute: 0 },
                            { label: '9:30', hour: 9, minute: 30 },
                            { label: '12:30', hour: 12, minute: 30 },
                            { label: '14:30', hour: 14, minute: 30 },
                            { label: '18:30', hour: 18, minute: 30 },
                          ].map((preset) => (
                            <motion.button
                              key={preset.label}
                              onClick={() => {
                                setSelectedHour(preset.hour);
                                setSelectedMinute(preset.minute);
                              }}
                              className="px-2 py-2 text-xs bg-gray-100 hover:bg-green-100 text-gray-700 hover:text-green-700 rounded-lg font-medium mobile-button transition-colors"

                            >
                              {preset.label}
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex space-x-3">
                                <button
                          onClick={handleTimeConfirm}
                          className="w-full py-3 bg-green-600 text-white rounded-xl font-medium mobile-button hover:bg-green-700 transition-colors"
                        >
                          확인
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
                </Portal>
              )}
            </AnimatePresence>

            {/* 장소 검색 모달 */}
            <AnimatePresence>
              {isLocationSearchModalOpen && (
                <Portal>
                  <motion.div 
                  className="modal-overlay-top modal-backdrop flex items-center justify-center bg-black/50 backdrop-blur-sm" 
                  onClick={() => setIsLocationSearchModalOpen(false)}
                  style={{ zIndex: 9999999 }}
                  data-portal="location-modal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.div 
                    className="modal-content-top w-full max-w-md bg-white rounded-3xl shadow-2xl mx-4 h-[70vh] min-h-[400px] flex flex-col"
                    onClick={e => e.stopPropagation()}
                    onWheel={e => e.stopPropagation()}
                    onTouchStart={e => e.stopPropagation()}
                    onTouchMove={e => e.stopPropagation()}
                    onTouchEnd={e => e.stopPropagation()}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="p-6 flex-shrink-0">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900">장소 검색</h3>
                        {/* 상단 닫기 버튼 */}
                        <button
                          onClick={handleCloseLocationSearchModal}
                          className="p-2 hover:bg-gray-100 rounded-full transition-colors mobile-button"
                          title="닫기"
                        >
                          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* 장소 검색 입력 */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">장소명 또는 주소 입력</label>
                        <input
                          type="text"
                          value={locationSearchQuery}
                          onChange={(e) => setLocationSearchQuery(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSearchLocation();
                            }
                          }}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                          placeholder="장소명 또는 주소를 입력하세요"
                          autoFocus
                        />
                        <p className="text-xs text-gray-500 mt-2">엔터키를 누르거나 검색 버튼을 클릭하세요</p>
                      </div>

                      {/* 검색 버튼 */}
                      <button
                        onClick={() => handleSearchLocation()}
                        disabled={!locationSearchQuery.trim() || isSearchingLocation}
                        className="w-full py-3 bg-amber-600 text-white rounded-xl font-medium mobile-button hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                      >
                        {isSearchingLocation ? (
                          <span>검색중</span>
                        ) : (
                          <span>검색</span>
                        )}
                      </button>
                    </div>

                    {/* 구분선 */}
                    <div className="border-t border-gray-200"></div>

                    {/* 검색 결과 헤더 - 고정 */}
                    {locationSearchResults.length > 0 && !isSearchingLocation && (
                      <div className="px-6 py-4 flex-shrink-0 bg-gray-50">
                        <div className="flex items-center space-x-2">
                          <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-xs text-green-600">✓</span>
                          </div>
                          <h4 className="text-sm font-semibold text-gray-900">검색 결과 ({locationSearchResults.length}개)</h4>
                        </div>
                      </div>
                    )}

                    {/* 검색 결과 영역 - 스크롤 가능 */}
                    <div className="modal-scroll-area flex-1 overflow-y-auto scroll-container min-h-[200px]">
                      {isSearchingLocation ? (
                        <div className="text-center py-8 px-6">
                          <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <div className="w-5 h-5 border-2 border-amber-200 border-t-amber-600 rounded-full animate-spin"></div>
                          </div>
                          <p className="text-gray-600 font-medium">장소를 검색하는 중입니다...</p>
                          <p className="text-xs text-gray-500 mt-1">잠시만 기다려주세요</p>
                        </div>
                      ) : locationSearchResults.length > 0 ? (
                        <div className="px-6 py-3 space-y-2">
                          {locationSearchResults.map((place, index) => (
                            <motion.div
                              key={place.temp_id}
                              className="w-full bg-amber-50 hover:bg-amber-100 border border-amber-200 hover:border-amber-300 rounded-lg transition-all duration-200"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              whileHover={{ scale: 1.01 }}
                            >
                              <button
                                onClick={() => handleSelectLocation(place)}
                                className="w-full p-3 text-left"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <h5 className="font-semibold text-gray-900 truncate text-sm">{place.place_name}</h5>
                                    <p className="text-xs text-gray-600 truncate mt-1" style={{ wordBreak: 'keep-all' }}>
                                      {place.road_address_name || place.address_name}
                                    </p>
                                  </div>
                                  <div className="flex-shrink-0 ml-3">
                                    <span className="inline-flex items-center px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded-full font-medium hover:bg-amber-200 transition-colors">
                                      선택
                                    </span>
                                  </div>
                                </div>
                              </button>
                            </motion.div>
                          ))}
                        </div>
                      ) : hasSearched && !isSearchingLocation ? (
                        <div className="text-center py-8 px-6">
                          <p className="text-gray-600 font-medium">{locationSearchError ? '장소 검색에 실패했습니다. 다시 시도해주세요.' : '검색 결과가 없습니다'}</p>
                          <p className="text-xs text-gray-500 mt-1">다른 검색어를 입력해보세요</p>
                        </div>
                      ) : (
                        <div className="text-center py-8 px-6">
                          <p className="text-gray-600 font-medium">장소를 검색해보세요</p>
                          <p className="text-xs text-gray-500 mt-1">카페, 음식점, 회사명 등을 입력하세요</p>
                        </div>
                      )}
                    </div>

                  </motion.div>
                </motion.div>
                </Portal>
              )}
            </AnimatePresence>

            {/* 커스텀 캘린더 모달 */}
            <AnimatePresence>
              {isCalendarModalOpen && (
                <Portal>
                  <motion.div 
                  className="modal-overlay-top modal-backdrop flex items-center justify-center bg-black/50 backdrop-blur-sm" 
                  onClick={handleCloseCalendarModal}
                  style={{ zIndex: 9999999 }}
                  data-portal="calendar-modal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.div 
                    className="modal-content-top w-full max-w-md bg-white rounded-3xl shadow-2xl mx-4"
                    onClick={e => e.stopPropagation()}
                    onWheel={e => e.stopPropagation()}
                    onTouchStart={e => e.stopPropagation()}
                    onTouchMove={e => e.stopPropagation()}
                    onTouchEnd={e => e.stopPropagation()}
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="p-6">
                      {/* 캘린더 헤더 */}
                      <div className="flex items-center justify-between mb-6">
                        <motion.button
                          onClick={handleCalendarPrevMonth}
                          className="p-2 hover:bg-gray-100 rounded-full mobile-button"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <FiChevronLeft className="w-5 h-5 text-gray-600" />
                        </motion.button>
                        
                        <div className="text-center">
                          <h3 className="text-lg font-bold text-gray-900">
                            {calendarCurrentMonth.format('YYYY년 MM월')}
                          </h3>
                          <button
                            onClick={handleCalendarToday}
                            className="text-sm text-green-600 hover:text-green-700 mobile-button mt-1"
                          >
                            오늘로 이동
                          </button>
                        </div>
                        
                        <motion.button
                          onClick={handleCalendarNextMonth}
                          className="p-2 hover:bg-gray-100 rounded-full mobile-button"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <FiChevronRight className="w-5 h-5 text-gray-600" />
                        </motion.button>
                      </div>

                      {/* 요일 헤더 */}
                      <div className="grid grid-cols-7 gap-1 mb-3">
                        {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
                          <div key={day} className={`h-8 flex items-center justify-center text-xs font-bold ${
                            index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : 'text-gray-700'
                          }`}>
                            {day}
                          </div>
                        ))}
                      </div>

                      {/* 캘린더 그리드 */}
                      <div className="grid grid-cols-7 gap-1 mb-6">
                        {(() => {
                          const days = [];
                          const daysInMonth = calendarCurrentMonth.daysInMonth();
                          const firstDayOfMonth = calendarCurrentMonth.startOf('month').day();
                          const today = dayjs();
                          const selectedDate = dayjs(newEvent.date);
                          
                          // 빈 칸 추가 (이전 달 마지막 날들)
                          for (let i = 0; i < firstDayOfMonth; i++) {
                            days.push(<div key={`empty-${i}`} className="h-10"></div>);
                          }
                          
                          // 현재 달의 날짜들
                          for (let day = 1; day <= daysInMonth; day++) {
                            const currentDate = calendarCurrentMonth.date(day);
                            const isSelected = selectedDate.isSame(currentDate, 'day');
                            const isToday = today.isSame(currentDate, 'day');
                            const isPast = currentDate.isBefore(today, 'day');
                            
                            days.push(
                              <button
                                key={day}
                                onClick={() => handleCalendarDateSelect(currentDate)}
                                disabled={isPast}
                                className={`
                                  h-10 w-full rounded-lg flex items-center justify-center text-sm font-medium mobile-button transition-all duration-200
                                  ${isSelected ? 'bg-green-600 text-white font-semibold shadow-lg' : ''}
                                  ${isToday && !isSelected ? 'bg-green-100 text-green-800 font-semibold' : ''}
                                  ${!isSelected && !isToday && !isPast ? 'hover:bg-gray-100 text-gray-800' : ''}
                                  ${isPast ? 'text-gray-300 cursor-not-allowed' : ''}
                                `}
                              >
                                {day}
                              </button>
                            );
                          }
                          
                          return days;
                        })()}
                      </div>

                      {/* 선택된 날짜 표시 */}
                      <div className="text-center mb-6 p-4 bg-green-50 rounded-xl border border-green-100">
                        <p className="text-sm text-gray-600">선택된 날짜</p>
                        <p className="text-lg font-bold text-green-700">
                          {dayjs(newEvent.date).format('YYYY년 MM월 DD일 (ddd)')}
                        </p>
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex space-x-3">
                        <button
                          onClick={handleCloseCalendarModal}
                          className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium mobile-button hover:bg-gray-200 transition-colors"
                            >
                              취소
                            </button>
                        <button
                          onClick={handleCloseCalendarModal}
                          className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium mobile-button hover:bg-green-700 transition-colors"
                        >
                          확인
                        </button>
                          </div>
                    </div>
                  </motion.div>
                </motion.div>
                </Portal>
              )}
            </AnimatePresence>

            {/* 저장 완료 모달 */}
            <AnimatePresence>
              {isSuccessModalOpen && successModalContent && (
                <Portal>
                  <motion.div 
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md" 
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                    onClick={closeSuccessModal}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                  <motion.div 
                    className="w-full max-w-sm bg-white rounded-3xl shadow-2xl mx-4"
                    onClick={e => e.stopPropagation()}
                    variants={{
                      hidden: { 
                        opacity: 0, 
                        y: 100,
                        scale: 0.95
                      },
                      visible: { 
                        opacity: 1, 
                        y: 0,
                        scale: 1,
                        transition: {
                          duration: 0.3,
                          ease: [0.25, 0.46, 0.45, 0.94]
                        }
                      },
                      exit: { 
                        opacity: 0, 
                        y: 100,
                        scale: 0.95,
                        transition: {
                          duration: 0.2,
                          ease: [0.55, 0.06, 0.68, 0.19]
                        }
                      }
                    }}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <div className="p-6 pb-8">
                      <div className="text-center mb-6">
                        {/* 아이콘 */}
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                          successModalContent.type === 'success' ? 'bg-green-100' : 
                          successModalContent.type === 'error' ? 'bg-red-100' : 
                          successModalContent.type === 'info' ? 'bg-red-100' : 'bg-blue-100'
                        }`}>
                          {successModalContent.type === 'success' && <FiCheckCircle className="w-8 h-8 text-green-500" />}
                          {successModalContent.type === 'error' && <FiXCircle className="w-8 h-8 text-red-500" />}
                          {successModalContent.type === 'info' && <FaTrash className="w-8 h-8 text-red-500" />}
                        </div>

                        {/* 제목 */}
                        <h3 className="text-lg font-bold text-gray-900 mb-1">
                          {successModalContent.title}
                        </h3>

                        {/* 메시지 */}
                        <div className="text-gray-600 mb-4 leading-relaxed" style={{ wordBreak: 'break-all' }}>
                          {successModalContent.message.split('\\n').map((line, index) => (
                            <div key={index}>
                              {line.includes('"') ? (
                                line.split('"').map((part, partIndex) => (
                                  partIndex % 2 === 1 ? (
                                    <span key={partIndex} className="font-bold text-red-600" style={{ wordBreak: 'break-all' }}>
                                      "{part}"
                                    </span>
                                  ) : (
                                    <span key={partIndex}>{part}</span>
                                  )
                                ))
                              ) : (
                                <span>{line}</span>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* 자동 닫기 진행 바 (자동 닫기인 경우) */}
                        {!successModalContent.onConfirm && successModalContent.type === 'success' && (
                          <>
                            <div className="w-full bg-gray-200 rounded-full h-1 mb-3">
                              <motion.div 
                                className="bg-green-500 h-1 rounded-full"
                                initial={{ width: "0%" }}
                                animate={{ width: "100%" }}
                                transition={{ duration: 3, ease: "linear" }}
                              />
                            </div>
                            <p className="text-sm text-gray-500 mb-2">3초 후 자동으로 닫힙니다</p>
                          </>
                        )}
                      </div>

                      {/* 버튼 영역 */}
                      <div className="flex flex-col gap-3">
                        {successModalContent.onConfirm ? (
                          <>
                            <motion.button
                              onClick={closeSuccessModal}
                              className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-medium transition-all duration-200"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              취소
                            </motion.button>
                            <motion.button
                                  onClick={() => {
                                successModalContent.onConfirm?.();
                                closeSuccessModal();
                              }}
                              className={`w-full py-4 rounded-2xl font-medium flex items-center justify-center transition-all duration-200 ${
                                successModalContent.type === 'info' 
                                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                                  : 'bg-green-500 hover:bg-green-600 text-white'
                              }`}

                            >
                              {successModalContent.type === 'info' ? '삭제하기' : '확인'}
                            </motion.button>
                          </>
                        ) : (
                          <motion.button
                            onClick={closeSuccessModal}
                            className={`w-full py-4 rounded-2xl font-medium flex items-center justify-center transition-all duration-200 ${
                              successModalContent.type === 'success' ? 'bg-green-500 hover:bg-green-600 text-white' :
                              successModalContent.type === 'error' ? 'bg-red-500 hover:bg-red-600 text-white' :
                              'bg-blue-500 hover:bg-blue-600 text-white'
                            }`}

                          >
                            확인
                          </motion.button>
                        )}
                      </div>
                      </div>
                    </motion.div>
                  </motion.div>
                </Portal>
              )}
            </AnimatePresence>

            {/* 컴팩트한 스케줄 액션 선택 모달 */}
            <AnimatePresence>
              {isScheduleActionModalOpen && selectedEventForAction && (
                <Portal>
                  <motion.div 
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={closeScheduleActionModal}
                  >
                    <motion.div 
                      className="bg-white rounded-2xl w-full max-w-sm mx-auto shadow-2xl"
                      variants={{
                        hidden: { 
                          opacity: 0, 
                          y: 50
                        },
                        visible: { 
                          opacity: 1, 
                          y: 0,
                          transition: {
                            duration: 0.25,
                            ease: [0.25, 0.46, 0.45, 0.94]
                          }
                        },
                        exit: { 
                          opacity: 0, 
                          y: 50,
                          transition: {
                            duration: 0.2,
                            ease: [0.55, 0.06, 0.68, 0.19]
                          }
                        }
                      }}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      onClick={(e) => e.stopPropagation()}
                    >
                    <div className="p-5">
                      {/* 컴팩트한 스케줄 정보 */}
                      <div className="text-center mb-4">
                        <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <FiClock className="w-6 h-6 text-indigo-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">{selectedEventForAction.title}</h3>
                        <p className="text-sm text-gray-500">
                          {dayjs(selectedEventForAction.date).format('MM월 DD일')} {selectedEventForAction.startTime} - {selectedEventForAction.endTime}
                        </p>
                        
                        {/* 반복 일정 배지 */}
                        {selectedEventForAction.repeatText && selectedEventForAction.repeatText !== '없음' && (
                          <div className="inline-flex items-center space-x-1 bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-medium mt-2">
                            <FiRotateCcw className="w-3 h-3" />
                            <span>{selectedEventForAction.repeatText}</span>
                          </div>
                        )}
                      </div>

                      {/* 컴팩트한 액션 버튼들 */}
                      <div className="flex space-x-3 mb-3">
                        <motion.button
                          onClick={() => handleEditAction(selectedEventForAction!)}
                          className="flex-1 flex items-center justify-center space-x-2 py-3 bg-blue-50 text-blue-700 rounded-xl font-medium mobile-button hover:bg-blue-100 transition-colors"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <FiEdit3 className="w-4 h-4" />
                          <span>수정</span>
                        </motion.button>
                        
                        <motion.button
                          onClick={() => {
                            // 반복 일정인지 확인하여 처리 방식 결정
                            if (selectedEventForAction?.repeatText && selectedEventForAction.repeatText !== '없음') {
                              // 반복 일정인 경우 바로 handleDeleteAction 호출
                              handleDeleteAction(selectedEventForAction);
                            } else {
                              // 일반 일정인 경우 삭제 확인 모달 표시
                              const eventTitle = selectedEventForAction?.title || '일정';
                              const confirmMessage = `일정 "${eventTitle}"\n정말 삭제하시겠습니까?`;
                              
                              // 먼저 액션 모달을 닫고 삭제 확인 모달을 열기
                              setIsScheduleActionModalOpen(false);
                              
                              openSuccessModal(
                                '일정 삭제 확인', 
                                confirmMessage, 
                                'info', 
                                () => handleDeleteAction(selectedEventForAction!)
                              );
                            }
                          }}
                          className="flex-1 flex items-center justify-center space-x-2 py-3 bg-red-50 text-red-700 rounded-xl font-medium mobile-button hover:bg-red-100 transition-colors"

                        >
                          <FaTrash className="w-4 h-4" />
                          <span>삭제</span>
                        </motion.button>
                      </div>
                      
                      <button
                        onClick={closeScheduleActionModal}
                        className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium mobile-button hover:bg-gray-200 transition-colors"
                      >
                        취소
                      </button>
                    </div>
                    </motion.div>
                  </motion.div>
                </Portal>
              )}
            </AnimatePresence>

            {/* 컴팩트한 반복 일정 처리 모달 */}
            <AnimatePresence>
              {isRepeatActionModalOpen && (
                <Portal>
                  <motion.div 
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" 
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                    onClick={() => {
                      setIsRepeatActionModalOpen(false);
                      setSelectedEventForAction(null);
                      setPendingRepeatEvent(null);
                      // body 스크롤 복원
                      document.body.style.overflow = '';
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <motion.div 
                      className="w-full max-w-sm bg-white rounded-2xl shadow-2xl mx-4"
                      onClick={e => e.stopPropagation()}
                      onWheel={e => e.stopPropagation()}
                      onTouchMove={e => e.stopPropagation()}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 30 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="p-5">
                        <div className="text-center mb-4">
                          <div className={`w-10 h-10 ${repeatActionType === 'edit' ? 'bg-blue-100' : 'bg-red-100'} rounded-full flex items-center justify-center mx-auto mb-3`}>
                            {repeatActionType === 'edit' ? (
                              <FiEdit3 className={`w-5 h-5 ${repeatActionType === 'edit' ? 'text-blue-600' : 'text-red-600'}`} />
                            ) : (
                              <FaTrash className="w-4 h-4 text-red-600" />
                            )}
                          </div>
                          <h3 className="text-lg font-bold text-gray-900">반복 일정 {repeatActionType === 'edit' ? '수정' : '삭제'}</h3>
                          <p className="text-sm text-gray-500 mt-1">어떻게 처리할지 선택하세요</p>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <button
                            onClick={() => handleRepeatOption('this')}
                            className="w-full px-3 py-3 text-left rounded-xl transition-all duration-200 mobile-button bg-gray-50 text-gray-700 hover:bg-gray-100 border border-transparent hover:border-gray-300"
                          >
                            <div className="font-medium text-sm">이것만 {repeatActionType === 'edit' ? '수정' : '삭제'}</div>
                            <div className="text-xs text-gray-500 mt-0.5">선택한 일정만 처리</div>
                          </button>
                          
                          <button
                            onClick={() => handleRepeatOption('future')}
                            className="w-full px-3 py-3 text-left rounded-xl transition-all duration-200 mobile-button bg-blue-50 text-blue-700 hover:bg-blue-100 border border-transparent hover:border-blue-300"
                          >
                            <div className="font-medium text-sm">현재 이후 {repeatActionType === 'edit' ? '수정' : '삭제'}</div>
                            <div className="text-xs text-blue-500 mt-0.5">이후 모든 반복 일정 처리</div>
                          </button>
                          
                          <button
                            onClick={() => handleRepeatOption('all')}
                            className={`w-full px-3 py-3 text-left rounded-xl transition-all duration-200 mobile-button border border-transparent ${
                              repeatActionType === 'edit' 
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300' 
                                : 'bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300'
                            }`}
                          >
                            <div className="font-medium text-sm">모든 반복 {repeatActionType === 'edit' ? '수정' : '삭제'}</div>
                            <div className={`text-xs mt-0.5 ${repeatActionType === 'edit' ? 'text-amber-500' : 'text-red-500'}`}>
                              과거 포함 모든 반복 일정 처리
                            </div>
                          </button>
                        </div>

                        <button
                          onClick={() => {
                            setIsRepeatActionModalOpen(false);
                            setSelectedEventForAction(null);
                            setPendingRepeatEvent(null);
                            // body 스크롤 복원
                            document.body.style.overflow = '';
                          }}
                          className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium mobile-button hover:bg-gray-200 transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                </Portal>
              )}
            </AnimatePresence>
          </motion.div>
      </div>



      {/* 일정 추가/수정 모달 */}
      <AnimatePresence>
        {isAddEventModalOpen && (
                      <motion.div 
            className="add-event-modal fixed inset-0 flex items-end justify-center bg-black/50 backdrop-blur-sm" 
            onClick={closeAddModal}
            style={{ 
              zIndex: 999999, 
              padding: 0, 
              margin: 0,
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh'
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div 
              className="w-full max-w-md bg-white rounded-t-2xl shadow-2xl max-h-[95vh] flex flex-col"
              style={{ 
                marginBottom: 0,
                marginTop: 'auto',
                alignSelf: 'flex-end'
              }}
              onClick={e => e.stopPropagation()}
              onWheel={e => e.stopPropagation()}
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
                             {/* 모달 핸들 - 고정 영역 (드래그 가능) */}
               <motion.div 
                 className="w-12 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-6 flex-shrink-0 cursor-grab active:cursor-grabbing"
                 drag="y"
                 dragElastic={0.1}
                 dragMomentum={false}
                 dragConstraints={{ top: 0, bottom: 0 }}
                 onDrag={(event, info) => {
                   // 핸들 드래그 중 바텀시트 전체에 피드백 적용
                   if (info.offset.y > 20) {
                     const target = event.currentTarget as HTMLElement;
                     if (target) {
                       const modalElement = target.closest('.add-event-modal') as HTMLElement;
                       if (modalElement) {
                         modalElement.style.opacity = String(Math.max(0.5, 1 - info.offset.y / 150));
                         modalElement.style.transform = `translateY(${Math.max(0, info.offset.y)}px)`;
                       }
                     }
                   }
                 }}
                 onDragEnd={(event, info) => {
                   // 핸들 드래그 종료 시 바텀시트 닫기 조건 확인
                   const target = event.currentTarget as HTMLElement;
                   if (target) {
                     const modalElement = target.closest('.add-event-modal') as HTMLElement;
                     
                     if (info.offset.y > 50 || info.velocity.y > 200) {
                       // 바텀시트 닫기
                       closeAddModal();
                     } else {
                       // 원래 위치로 복귀
                       if (modalElement) {
                         modalElement.style.opacity = '1';
                         modalElement.style.transform = 'translateY(0px)';
                       }
                     }
                   }
                 }}
                 whileDrag={{ 
                   scale: 1.2,
                   backgroundColor: '#9CA3AF',
                   transition: { duration: 0.1 }
                 }}
               />
              
                             {/* 모달 헤더 - 고정 영역 (드래그 가능) */}
               <motion.div 
                 className="px-6 pb-4 border-b border-gray-100 flex-shrink-0 cursor-grab active:cursor-grabbing"
                 drag="y"
                 dragElastic={0.1}
                 dragMomentum={false}
                 dragConstraints={{ top: 0, bottom: 0 }}
                 onDrag={(event, info) => {
                   // 헤더 드래그 중 바텀시트 전체에 피드백 적용
                   if (info.offset.y > 20) {
                     const target = event.currentTarget as HTMLElement;
                     if (target) {
                       const modalElement = target.closest('.add-event-modal') as HTMLElement;
                       if (modalElement) {
                         modalElement.style.opacity = String(Math.max(0.5, 1 - info.offset.y / 150));
                         modalElement.style.transform = `translateY(${Math.max(0, info.offset.y)}px)`;
                       }
                     }
                   }
                 }}
                 onDragEnd={(event, info) => {
                   // 헤더 드래그 종료 시 바텀시트 닫기 조건 확인
                   const target = event.currentTarget as HTMLElement;
                   if (target) {
                     const modalElement = target.closest('.add-event-modal') as HTMLElement;
                     
                     if (info.offset.y > 50 || info.velocity.y > 200) {
                       // 바텀시트 닫기
                       closeAddModal();
                     } else {
                       // 원래 위치로 복귀
                       if (modalElement) {
                         modalElement.style.opacity = '1';
                         modalElement.style.transform = 'translateY(0px)';
                       }
                     }
                   }
                 }}
               >
                 <div className="flex items-center justify-between">
                   <h3 className="text-xl font-bold text-gray-900">
                     {newEvent.id ? '일정 수정' : '새 일정 추가'}
                   </h3>
                   <button
                     onClick={closeAddModal}
                     className="p-2 hover:bg-gray-100 rounded-full mobile-button"
                   >
                     <FiX className="w-5 h-5 text-gray-500" />
                   </button>
                 </div>
               </motion.div>

              {/* 스크롤 가능한 폼 영역 */}
              <div 
                className="flex-1 overflow-y-auto scroll-container"
                onTouchStart={(e) => {
                  // 터치 시작점 기록 (스크롤과 드래그 구분용)
                  const touch = e.touches[0];
                  (e.currentTarget as any).touchStartY = touch.clientY;
                  (e.currentTarget as any).touchStartX = touch.clientX;
                  (e.currentTarget as any).scrollTop = (e.currentTarget as HTMLElement).scrollTop;
                }}
                onTouchMove={(e) => {
                  const touch = e.touches[0];
                  const startY = (e.currentTarget as any).touchStartY;
                  const startX = (e.currentTarget as any).touchStartX;
                  const startScrollTop = (e.currentTarget as any).scrollTop;
                  const currentScrollTop = (e.currentTarget as HTMLElement).scrollTop;
                  
                  if (startY && startX) {
                    const deltaY = touch.clientY - startY;
                    const deltaX = touch.clientX - startX;
                    
                    // 수직 스크롤인지 확인 (수직 이동이 수평 이동보다 큰 경우)
                    const isVerticalScroll = Math.abs(deltaY) > Math.abs(deltaX);
                    
                    // 스크롤 가능한 상태인지 확인
                    const element = e.currentTarget as HTMLElement;
                    const canScrollUp = currentScrollTop > 0;
                    const canScrollDown = currentScrollTop < (element.scrollHeight - element.clientHeight);
                    
                    // 수직 스크롤이고 스크롤 가능한 상태라면 스크롤 허용
                    if (isVerticalScroll && (canScrollUp || canScrollDown)) {
                      // 스크롤 영역에서의 정상적인 스크롤 - 이벤트 전파 중지
                      e.stopPropagation();
                    }
                  }
                }}
              >
                <form 
                  className="px-6 py-6 space-y-6" 
                  onSubmit={(e) => { e.preventDefault(); handleSaveEvent(); }}
                >
                  {/* 1. 그룹 및 멤버 선택 */}
                  <div className="bg-indigo-50 rounded-xl p-4">
                  <div className="flex items-center space-x-2 mb-4">
                      <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-white">1</span>
                    </div>
                    <h4 className="font-semibold text-gray-900">그룹 및 멤버 선택</h4>
                  </div>

                  {newEvent.id && (
                      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-700 flex items-center">
                          <span className="mr-2">⚠️</span>
                          일정 수정 시에는 그룹과 멤버를 변경할 수 없습니다
                        </p>
                      </div>
                    )}

                        {/* 그룹 선택 */}
                    <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">그룹 선택</label>
                          <div className="relative group-selector-container" style={{ zIndex: 1000, position: 'relative' }}>
                          <button
                            ref={groupButtonRef}
                            type="button"
                            onClick={() => !newEvent.id && setIsGroupSelectorOpen(!isGroupSelectorOpen)} // newEvent.id가 있으면 클릭 비활성화
                            disabled={!!newEvent.id} // 수정 모드일 때 비활성화
                            className={`w-full px-4 py-3 border border-gray-300 rounded-xl text-left transition-colors flex items-center justify-between ${
                              newEvent.id 
                                ? 'bg-gray-100 text-gray-500 cursor-not-allowed' // 수정 모드 스타일
                                : 'bg-white hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                            }`}
                          >
                              <span className="text-gray-900">
                                {selectedGroupId 
                                  ? userGroups.find(g => g.sgt_idx === selectedGroupId)?.sgt_title || '그룹을 선택하세요'
                                  : '그룹을 선택하세요'
                                }
                                {userGroups.length > 0 && (
                                  <span className="text-xs text-gray-400 ml-2">
                                    ({userGroups.length}개)
                                  </span>
                                )}
                              </span>
                              <FiChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isGroupSelectorOpen ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {/* 그룹 드롭다운 */}
                            <AnimatePresence>
                              {isGroupSelectorOpen && !newEvent.id && ( // newEvent.id가 있으면 드롭다운 숨김
                                <GroupDropdownPortal
                                  target={groupButtonRef}
                                  onClose={() => setIsGroupSelectorOpen(false)}
                                >
                                  {isLoadingGroups ? (
                                    <div className="flex flex-col items-center justify-center p-4 text-gray-500">
                                      <IOSCompatibleSpinner size="md" />
                                      <span className="text-sm">그룹 목록을 불러오는 중...</span>
                                    </div>
                                  ) : userGroups.length > 0 ? (
                                    <>
                                      {/* 디버깅 정보 */}
                                      <div className="p-2 text-xs text-gray-400 border-b border-gray-100">
                                        총 {userGroups.length}개 그룹 로드됨
                                      </div>
                                      {userGroups
                                        .sort((a, b) => a.sgt_title.localeCompare(b.sgt_title, 'ko', { numeric: true }))
                                        .map((group, index) => (
                                      <button
                                        key={group.sgt_idx}
                                        type="button"
                                        onClick={() => handleGroupSelect(group.sgt_idx)}
                                          className={`w-full px-4 py-2 text-left text-sm font-medium hover:bg-gray-50 transition-colors duration-150 ${
                                            selectedGroupId === group.sgt_idx ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <span>{group.sgt_title}</span>
                                            <span className="text-xs text-gray-400">ID: {group.sgt_idx}</span>
                                          </div>
                                      </button>
                                      ))}
                                    </>
                                  ) : (
                                    <div className="p-4 text-center text-gray-500">
                                      <div className="mb-2">참여 중인 그룹이 없습니다</div>
                                      <div className="text-xs text-gray-400">
                                        디버그: userGroups.length = {userGroups.length}
                                      </div>
                                    </div>
                                  )}
                                </GroupDropdownPortal>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>

                    {/* 멤버 선택 */}
                    {selectedGroupId && (
                      <div style={{ zIndex: -2147483647, position: 'relative' }}>
                        <label className="block text-sm font-medium text-gray-700 mb-3">멤버 선택</label>
                        {isFetchingMembers ? (
                          <div className="flex flex-col items-center justify-center py-6 text-gray-500">
                            <IOSCompatibleSpinner size="lg" />
                            <span className="text-sm">멤버 목록을 불러오는 중...</span>
                          </div>
                        ) : scheduleGroupMembers.length > 0 ? (
                          <div className="flex overflow-x-auto space-x-4 pt-2 pb-2 px-3 -mx-1" style={{ zIndex: -2147483647, position: 'relative' }}>
                            {scheduleGroupMembers
                              .sort((a, b) => {
                                // 관리자 우선
                                if (a.sgdt_owner_chk === 'Y' && b.sgdt_owner_chk !== 'Y') return -1;
                                if (a.sgdt_owner_chk !== 'Y' && b.sgdt_owner_chk === 'Y') return 1;
                                
                                // 리더 우선
                                if (a.sgdt_leader_chk === 'Y' && b.sgdt_leader_chk !== 'Y') return -1;
                                if (a.sgdt_leader_chk !== 'Y' && b.sgdt_leader_chk === 'Y') return 1;
                                
                                // 이름순 정렬 (고정된 순서)
                                return a.name.localeCompare(b.name, 'ko', { numeric: true });
                              })
                              .map((member, index) => {
                                // 역할에 따른 선택 가능 여부 확인
                                const currentUserId = user?.mt_idx?.toString();
                                const canSelect = currentUserRole === 'owner' || 
                                                currentUserRole === 'leader' || 
                                                member.id === currentUserId;
                                
                                return (
                                <motion.div 
                                key={member.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: index * 0.1 }}
                                  className="flex flex-col items-center flex-shrink-0"
                                >
                                <button
                                    type="button"
                                    onClick={() => !newEvent.id && handleScheduleMemberSelect(member.id)} // newEvent.id가 있으면 클릭 비활성화
                                    disabled={!!newEvent.id || !canSelect} // 수정 모드이거나 선택 불가능한 경우 비활성화
                                    className={`flex flex-col items-center focus:outline-none mobile-button ${
                                      newEvent.id || !canSelect ? 'cursor-not-allowed opacity-50' : '' // 수정 모드이거나 선택 불가능한 경우 스타일
                                    }`}
                                  >
                                  <div className={`w-10 h-10 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden transition-all duration-300 ${
                                    member.isSelected ? 'ring-4 ring-indigo-500 ring-offset-2' : ''
                                  }`}>
                                    <Image 
                                      src={getSafeImageUrl(member.mt_file1, member.mt_gender, member.sgdt_idx || member.mt_idx || 0)}
                                      alt={member.name}
                                      width={40}
                                      height={40}
                                      className="w-full h-full object-cover"
                                      placeholder="blur"
                                      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+Kic6LbqN1NzKhDFl3HI7L7IlJWK3jKYBaKJmVdJKhg1Qg8yKjfpYZaGu7WZPYwNAR4vTYK5AAAAABJRU5ErkJggg=="
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        const fallbackSrc = getDefaultImage(member.mt_gender, member.sgdt_idx || member.mt_idx || 0);
                                        console.log(`[이미지 오류] ${member.name}의 이미지 로딩 실패, 기본 이미지로 대체:`, fallbackSrc);
                                        target.src = fallbackSrc;
                                        target.onerror = null; // 무한 루프 방지
                                      }}
                                      onLoad={() => {
                                        console.log(`[이미지 성공] ${member.name}의 이미지 로딩 완료:`, member.mt_file1);
                                      }}
                                    />
                        </div>
                                  <span className={`block text-xs font-medium mt-2 transition-colors duration-200 ${
                                    member.isSelected ? 'text-indigo-700' : 'text-gray-700'
                                  }`}>
                                    {member.name}
                                  </span>
                            </button>
                              </motion.div>
                              );
                              })}
                            </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-6 text-gray-500">
                            <div className="w-12 h-12 mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                              <FiUsers className="w-6 h-6 text-gray-300" />
                            </div>
                            <span className="text-sm">그룹에 참여한 멤버가 없습니다</span>
                          </div>
                            )}
                          </div>
                        )}
                        </div>

                  {/* 2. 일정 제목 및 내용 */}
                  <div className="bg-blue-50 rounded-xl p-4">
                  <div className="flex items-center space-x-2 mb-4">
                      <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-white">2</span>
                    </div>
                      <h4 className="font-semibold text-gray-900">일정 제목 및 내용</h4>
                  </div>

                  {/* 제목 입력 */}
                    <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      일정 제목 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="일정 제목을 입력하세요"
                      required
                        maxLength={100}
                      />
                      <div className="flex justify-between mt-2">
                        <p className="text-xs text-gray-500">예) 팀 회의, 프로젝트 미팅 등</p>
                        <p className="text-xs text-gray-500">({newEvent.title.length}/100)</p>
                    </div>
                  </div>

                    {/* 내용 입력 */}
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">일정 내용 (선택)</label>
                    <textarea
                      value={newEvent.content || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, content: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                      placeholder="일정에 대한 상세 내용을 입력하세요"
                        rows={3}
                        maxLength={500}
                    />
                      <div className="flex justify-between mt-2">
                      <p className="text-xs text-gray-500">예) 회의 안건, 준비물, 참고사항 등</p>
                        <p className="text-xs text-gray-500">({(newEvent.content || '').length}/500)</p>
                    </div>
                  </div>
                </div>

                  {/* 3. 날짜 및 시간 */}
                  <div className="bg-green-50 rounded-xl p-4">
                  <div className="flex items-center space-x-2 mb-4">
                      <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-white">3</span>
                    </div>
                    <h4 className="font-semibold text-gray-900">날짜 및 시간</h4>
                  </div>

                    {/* 날짜와 시간 정보 카드 */}
                          <button
                      type="button"
                      onClick={handleOpenDateTimeModal}
                      className="w-full bg-white rounded-xl p-4 mb-4 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 mobile-button"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700 text-sm font-medium">날짜</span>
                          <span className="text-gray-500 text-sm font-normal">
                            {dayjs(tempDateTime.date).format('YYYY년 MM월 DD일')}
                      </span>
                  </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700 text-sm font-medium">시간</span>
                          <span className="text-gray-500 text-sm font-normal">
                            {tempDateTime.allDay ? '하루 종일' : `${tempDateTime.startTime} ~ ${tempDateTime.endTime}`}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700 text-sm font-medium">하루 종일</span>
                          <span className="text-gray-500 text-sm font-normal">
                            {tempDateTime.allDay ? 'ON' : 'OFF'}
                            </span>
                        </div>
                      </div>
                    </button>

                    {/* 설정 안내 텍스트 */}
                    <p className="text-xs text-gray-500 text-center">위 카드를 클릭하여 날짜와 시간을 설정하세요</p>
                      </div>

                  {/* 4. 추가 설정 */}
                  <div className="bg-amber-50 rounded-xl p-4">
                  <div className="flex items-center space-x-2 mb-4">
                      <div className="w-6 h-6 bg-amber-600 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-white">4</span>
                    </div>
                    <h4 className="font-semibold text-gray-900">추가 설정</h4>
                  </div>

                  <div className="space-y-4">
                    {/* 반복 및 알림 설정 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">반복</label>
                        <button
                          type="button"
                            onClick={() => handleOpenRepeatModal()}
                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-left text-sm transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        >
                          {newEvent.repeat}
                        </button>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">알림</label>
                        <button
                          type="button"
                            onClick={() => setIsAlarmModalOpen(true)}
                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-left text-sm transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        >
                          {newEvent.alarm}
                        </button>
                      </div>
                    </div>

                    {/* 장소 정보 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">장소 정보 (선택)</label>
                      <button
                        type="button"
                        onClick={handleOpenLocationSearchModal}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-left transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      >
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700">장소명</span>
                            <span className="text-sm text-gray-500">
                              {(newEvent.locationName && newEvent.locationName.trim()) || '장소를 검색하세요'}
                            </span>
                          </div>
                          {newEvent.locationAddress && newEvent.locationAddress.trim() && (
                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                              <span className="text-sm font-medium text-gray-700">주소</span>
                              <span className="text-sm text-gray-500 truncate max-w-48">
                                {newEvent.locationAddress}
                              </span>
                            </div>
                          )}
                      </button>
                    </div>
                  </div>
                </div>

                  {/* 액션 버튼 */}
                  <div className="pt-2 space-y-3">
                    <button
                      type="submit"
                      disabled={
                        isSaving ||
                        !newEvent.title ||
                        !newEvent.date ||
                        !!dateTimeError ||
                        (!newEvent.allDay && (!newEvent.startTime || !newEvent.endTime))
                      }
                      className="w-full py-4 bg-gradient-to-r from-[#0113A3] to-[#001a8a] text-white rounded-xl font-semibold mobile-button disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 relative"
                    >
                      {isSaving ? (
                        <div className="flex items-center justify-center space-x-2">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>처리 중...</span>
                        </div>
                      ) : (
                        newEvent.id ? '일정 수정' : '일정 추가'
                      )}
                    </button>
                    
                    <button
                      type="button"
                      onClick={closeAddModal}
                      className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium mobile-button hover:bg-gray-200 transition-colors"
                          >
                            취소
                          </button>
                  </div>
                </form>
              </div>
            </motion.div>
                      </motion.div>
                                        )}
                  </AnimatePresence>

            {/* 컴팩트 토스트 모달 */}
            <AnimatePresence>
              {toastModal.isOpen && (
                <Portal>
                  <motion.div 
                    className="fixed left-4 z-[130] w-3/4 max-w-md"
                    style={{ bottom: '71px' }} // 네비게이션바(64px) + 7px
                    initial={{ opacity: 0, x: -100, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -100, scale: 0.9 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                  >
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden w-full">
                      <div className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            toastModal.type === 'success' ? 'bg-green-100' :
                            toastModal.type === 'error' ? 'bg-red-100' : 'bg-blue-100'
                          }`}>
                            {toastModal.type === 'success' && (
                              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                            {toastModal.type === 'error' && (
                              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                            {toastModal.type === 'loading' && (
                              <IOSCompatibleSpinner size="md" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">{toastModal.title}</h4>
                            <p className="text-xs text-gray-600 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{toastModal.message}</p>
                          </div>
                          {toastModal.autoClose && toastModal.type !== 'loading' && (
                            <button
                              onClick={hideToastModal}
                              className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0"
                            >
                              <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* 프로그레스 바 */}
                      {toastModal.autoClose && toastModal.type !== 'loading' && (
                        <div className="h-1 bg-gray-100">
                          <motion.div 
                            className={`h-full ${
                              toastModal.type === 'success' ? 'bg-green-500' :
                              toastModal.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                            }`}
                            initial={{ width: '100%' }}
                            animate={{ width: `${100 - (toastModal.progress || 0)}%` }}
                            transition={{ duration: 0.1, ease: 'linear' }}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                </Portal>
              )}
            </AnimatePresence>
    </>
  );
}