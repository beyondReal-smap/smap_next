'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ko';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import isBetween from 'dayjs/plugin/isBetween';
import { v4 as uuidv4 } from 'uuid';
import Calendar from 'react-calendar';
// Calendar CSS는 globals.css에서 import됨
import 'react-calendar/dist/Calendar.css';
import { 
  Clock, 
  MapPin, 
  User, 
  Users, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle2,
  Clock3,
  X,
  Package,
  AlertCircle,
  Save,
  MoreVertical,
  Edit3,
  Trash2,
  Bell,
  BellOff,
  Plus,
  UserPlus,
  Group,
  AlertTriangle
} from 'lucide-react';
import { 
  FiCalendar, 
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
  FiAlertTriangle
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import memberService from '@/services/memberService';
import groupService, { Group as GroupType } from '@/services/groupService';
import scheduleService, { Schedule, UserPermission } from '@/services/scheduleService';

export const dynamic = 'force-dynamic';

dayjs.extend(isBetween);
dayjs.locale('ko');

// 기본 이미지 가져오기 함수 (location/page.tsx에서 가져옴)
const getDefaultImage = (gender: number | null | undefined, index: number): string => {
  const maleImages = ['/images/male_1.png', '/images/male_2.png', '/images/male_3.png', '/images/male_4.png'];
  const femaleImages = ['/images/female_1.png', '/images/female_2.png', '/images/female_3.png', '/images/female_4.png'];
  const defaultImages = ['/images/avatar1.png', '/images/avatar2.png', '/images/avatar3.png', '/images/avatar4.png'];
  
  if (gender === 1) return maleImages[index % maleImages.length];
  if (gender === 2) return femaleImages[index % femaleImages.length];
  return defaultImages[index % defaultImages.length];
};

// 안전한 이미지 URL 가져오기 함수 (location/page.tsx에서 가져옴)
const getSafeImageUrl = (photoUrl: string | null, gender: number | null | undefined, index: number): string => {
  // URL이 null이거나 빈 문자열인 경우 기본 이미지 사용
  if (!photoUrl || photoUrl.trim() === '') {
    return getDefaultImage(gender, index);
  }
  
  // 이미 완전한 URL인 경우 그대로 사용
  if (photoUrl.startsWith('http')) {
    return photoUrl;
  }
  
  // 파일명만 있는 경우 프론트엔드 public/images 폴더 참조
  // console.log(`[getSafeImageUrl] 프론트엔드 public/images 폴더에서 이미지 사용: ${photoUrl}`);
  return `/images/${photoUrl}`;
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
  background: linear-gradient(135deg, #0ea5e9 0%, #ec4899 100%);
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

.floating-button {
  position: fixed;
  bottom: 96px;
  right: 24px;
  z-index: 40;
  background: linear-gradient(135deg, #0ea5e9 0%, #ec4899 100%);
  box-shadow: 0 8px 25px rgba(14, 165, 233, 0.3);
}

.floating-button:hover {
  transform: scale(1.1);
  box-shadow: 0 12px 35px rgba(14, 165, 233, 0.4);
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
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  },
  out: { 
    opacity: 0, 
    y: -20,
    transition: {
      duration: 0.4,
      ease: [0.55, 0.06, 0.68, 0.19]
    }
  }
};

const modalVariants = {
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
      duration: 0.25,
      ease: [0.55, 0.06, 0.68, 0.19]
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
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  })
};

const floatingButtonVariants = {
  initial: { 
    scale: 1 
  },
  animate: { 
    scale: [1, 1.1, 1],
    boxShadow: [
      "0 8px 25px rgba(14, 165, 233, 0.3)",
      "0 12px 35px rgba(14, 165, 233, 0.4)",
      "0 8px 25px rgba(14, 165, 233, 0.3)"
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  },
  hover: { 
    scale: 1.1,
    boxShadow: "0 12px 35px rgba(14, 165, 233, 0.4)",
    transition: {
      duration: 0.2
    }
  },
  tap: { 
    scale: 0.95,
    transition: {
      duration: 0.1
    }
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
  mt_file1?: string;
  sgdt_owner_chk?: string;
  sgdt_leader_chk?: string;
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
  canEdit?: boolean; // 편집 권한
  canDelete?: boolean; // 삭제 권한
  locationName?: string;
  locationAddress?: string;
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
}

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
  content?: string;
  groupName?: string;
  groupColor?: string;
  memberName?: string;
  memberPhoto?: string;
}

// 일정 상태 판단 함수
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
    return { text: '완료', color: 'text-amber-600', bgColor: 'bg-amber-50' };
  }
}

// 커스텀 캘린더 컴포넌트
function MobileCalendar({ 
  selectedDay, 
  onDayClick, 
  events,
  onMonthChange // 월 변경 콜백 추가
}: { 
  selectedDay: Dayjs | null; 
  onDayClick: (day: Dayjs) => void;
  events: ScheduleEvent[];
  onMonthChange?: (year: number, month: number) => void; // 월 변경 콜백 프롭 추가
}) {
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
      // 월 변경 콜백 호출
      if (onMonthChange) {
        onMonthChange(newMonth.year(), newMonth.month() + 1); // dayjs month는 0부터 시작하므로 +1
      }
      setIsAnimating(false);
    }, 150);
  };

  const handleNextMonth = () => {
    setAnimationDirection('right');
    setIsAnimating(true);
    setTimeout(() => {
      const newMonth = currentMonth.add(1, 'month');
      setCurrentMonth(newMonth);
      // 월 변경 콜백 호출
      if (onMonthChange) {
        onMonthChange(newMonth.year(), newMonth.month() + 1); // dayjs month는 0부터 시작하므로 +1
      }
      setIsAnimating(false);
    }, 150);
  };

  const handleToday = () => {
    setAnimationDirection('right');
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentMonth(today);
      onDayClick(today);
      // 오늘로 이동 시에도 월 변경 콜백 호출
      if (onMonthChange) {
        onMonthChange(today.year(), today.month() + 1);
      }
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
            h-10 w-full rounded-lg flex items-center justify-center text-sm font-medium calendar-day mobile-button
            ${isSelected ? 'calendar-day selected' : ''}
            ${isToday && !isSelected ? 'bg-gradient-to-r from-sky-200 to-pink-200 text-sky-800 font-semibold' : ''}
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
    <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
      {/* 캘린더 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <motion.button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-gray-100 rounded-full mobile-button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
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
            className="text-sm text-sky-600 hover:text-purple-600 mobile-button transition-colors duration-200"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={isAnimating}
          >
            오늘로 이동
          </motion.button>
        </div>
        
        <motion.button
          onClick={handleNextMonth}
          className="p-2 hover:bg-gray-100 rounded-full mobile-button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
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
        >
          {renderCalendarDays()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function SchedulePage() {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState<Dayjs | null>(dayjs());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);  // 목업 데이터 제거
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEventDetails, setSelectedEventDetails] = useState<ScheduleEvent | null>(null);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);

  // 그룹 및 멤버 선택 관련 상태 추가
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [isGroupSelectorOpen, setIsGroupSelectorOpen] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [scheduleGroupMembers, setScheduleGroupMembers] = useState<ScheduleGroupMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);

  // 반복 및 알림 모달 상태
  const [isRepeatModalOpen, setIsRepeatModalOpen] = useState(false);
  const [isAlarmModalOpen, setIsAlarmModalOpen] = useState(false);
  
  // 날짜 및 시간 모달 상태
  const [isDateTimeModalOpen, setIsDateTimeModalOpen] = useState(false);
  
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
  
  // 장소 검색 모달 상태
  const [isLocationSearchModalOpen, setIsLocationSearchModalOpen] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState<any[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // 날짜/시간 유효성 검사 상태
  const [dateTimeError, setDateTimeError] = useState<string | null>(null);

  // 현재 로드된 데이터의 년월 추적
  const [loadedYearMonth, setLoadedYearMonth] = useState<string | null>(null);

  // 컴포넌트 마운트 감지
  useEffect(() => {
    document.body.style.overflowX = 'hidden';
    document.documentElement.style.overflowX = 'hidden';
    
    // 그룹 데이터 로드 (스케줄 로드는 별도 useEffect에서 처리)
    const loadData = async () => {
      await fetchUserGroups();
    };
    
    loadData();
    
    return () => {
      document.body.style.overflowX = '';
      document.documentElement.style.overflowX = '';
      // 컴포넌트 언마운트 시 body 스크롤 복원
      document.body.style.overflow = '';
    };
  }, []);

  // userGroups가 로드된 후 스케줄 로드 - 최초 1회만
  useEffect(() => {
    if (userGroups.length > 0 && !loadedYearMonth) {
      console.log('[useEffect] userGroups 로드 완료, 최초 스케줄 로드 시작');
      // 현재 월의 스케줄을 로드
      const now = dayjs();
      const year = now.year();
      const month = now.month() + 1; // dayjs month는 0부터 시작하므로 +1
      loadAllGroupSchedules(year, month);
    }
  }, [userGroups, loadedYearMonth]);

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
    const selectedYearMonth = selectedDay.format('YYYY-MM');
    
    console.log('[eventsForSelectedDay] 선택된 날짜:', dateString);
    console.log('[eventsForSelectedDay] 선택된 년월:', selectedYearMonth);
    console.log('[eventsForSelectedDay] 로드된 년월:', loadedYearMonth);
    console.log('[eventsForSelectedDay] 전체 이벤트 수:', events.length);
    
    // 선택된 날짜의 년월과 현재 로드된 년월이 다른 경우 해당 월 데이터 로드
    if (loadedYearMonth && selectedYearMonth !== loadedYearMonth.substring(0, 7)) {
      console.log('[eventsForSelectedDay] ⚠️ 선택된 날짜와 로드된 년월이 다름. 추가 로드 필요');
      // 선택된 날짜의 년월 데이터 로드
      const [year, month] = selectedYearMonth.split('-').map(Number);
      loadAllGroupSchedules(year, month).then(() => {
        console.log('[eventsForSelectedDay] ✅ 선택된 날짜 년월 데이터 로드 완료');
      });
    }
    
    const filteredEvents = events
      .filter(event => {
        const matches = event.date === dateString;
        // console.log(`[eventsForSelectedDay] 이벤트 "${event.title}" (${event.date}) - 매칭:`, matches);
        return matches;
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    console.log('[eventsForSelectedDay] 필터링된 이벤트:', filteredEvents);
    return filteredEvents;
  }, [selectedDay, events, loadedYearMonth]);

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
    content: '',
    groupName: '',
    groupColor: '',
    memberName: '',
    memberPhoto: '',
  }), [selectedDay]);

  const [newEvent, setNewEvent] = useState<NewEvent>(initialNewEventState);
  
  useEffect(() => {
    setNewEvent(prev => ({
      ...prev,
      date: selectedDay ? selectedDay.format('YYYY-MM-DD') : TODAY,
    }));
  }, [selectedDay]);

  // 날짜/시간 유효성 검사
  useEffect(() => {
    let hasError = false;
    let focusTarget: string | null = null;

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

  }, [newEvent.date, newEvent.startTime, newEvent.endTime, newEvent.allDay]);

  // 시간 모달 스크롤 자동 조정
  useEffect(() => {
    if (isTimeModalOpen && hourScrollRef.current && minuteScrollRef.current) {
      // 약간의 지연을 두고 스크롤 (모달 애니메이션 완료 후)
      setTimeout(() => {
        if (hourScrollRef.current && minuteScrollRef.current) {
          // 시간 스크롤 위치 계산 (각 버튼 높이 약 36px)
          const hourScrollTop = selectedHour * 36 - 64; // 64px = 컨테이너 높이의 절반 정도
          const minuteIndex = selectedMinute / 5; // 5분 단위 인덱스
          const minuteScrollTop = minuteIndex * 36 - 64;
          
          hourScrollRef.current.scrollTo({
            top: Math.max(0, hourScrollTop),
            behavior: 'smooth'
          });
          
          minuteScrollRef.current.scrollTo({
            top: Math.max(0, minuteScrollTop),
            behavior: 'smooth'
          });
        }
      }, 300);
    }
  }, [isTimeModalOpen, selectedHour, selectedMinute]);

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

  // 일정 저장 - 실제 백엔드 API 사용
  const handleSaveEvent = async () => {
    // 유효성 검사
    if (!newEvent.title || !newEvent.date) {
      alert('제목과 날짜는 필수 입력 항목입니다.');
      return;
    }

    if (dateTimeError) {
      alert('날짜/시간 설정에 오류가 있습니다. 확인 후 다시 시도해주세요.');
      return;
    }

    if (!newEvent.allDay && (!newEvent.startTime || !newEvent.endTime)) {
      alert('시작 시간과 종료 시간을 설정해주세요.');
      return;
    }

    if (!selectedGroupId) {
      alert('그룹을 선택해주세요.');
      return;
    }

    // 현재 사용자의 권한 확인
    const currentMember = scheduleGroupMembers.find(member => member.isSelected);
    const isOwnerOrLeader = currentMember && 
      (currentMember.sgdt_owner_chk === 'Y' || currentMember.sgdt_leader_chk === 'Y');

    // 다른 멤버의 스케줄을 생성/수정하려는 경우 권한 확인
    if (selectedMemberId && selectedMemberId !== currentMember?.id && !isOwnerOrLeader) {
      alert('다른 멤버의 스케줄을 관리할 권한이 없습니다.');
      return;
    }

    try {
      console.log('[handleSaveEvent] 스케줄 저장 시작:', {
        isEdit: !!newEvent.id,
        groupId: selectedGroupId,
        memberId: selectedMemberId,
        hasPermission: isOwnerOrLeader
      });

      // 날짜/시간 형식 변환
      const startDateTime = newEvent.allDay 
        ? `${newEvent.date}T00:00:00`
        : `${newEvent.date}T${newEvent.startTime}:00`;
      
      const endDateTime = newEvent.allDay 
        ? `${newEvent.date}T23:59:59`
        : `${newEvent.date}T${newEvent.endTime}:00`;

      if (newEvent.id) {
        // 수정
        const response = await scheduleService.updateSchedule({
          sst_idx: parseInt(newEvent.id),
          groupId: selectedGroupId,
          sst_title: newEvent.title,
          sst_sdate: startDateTime,
          sst_edate: endDateTime,
          sst_all_day: newEvent.allDay ? 'Y' : 'N',
          sst_location_title: newEvent.locationName || undefined,
          sst_location_add: newEvent.locationAddress || undefined,
          sst_memo: newEvent.content || undefined,
          sst_alram: 0 // 기본값
        });

        if (response.success) {
          console.log('[handleSaveEvent] 스케줄 수정 성공');
          alert('스케줄이 수정되었습니다.');
        } else {
          alert(response.error || '스케줄 수정에 실패했습니다.');
          return;
        }
      } else {
        // 추가
        const response = await scheduleService.createSchedule({
          groupId: selectedGroupId,
          targetMemberId: selectedMemberId && selectedMemberId !== currentMember?.id 
            ? parseInt(selectedMemberId) 
            : undefined,
          sst_title: newEvent.title,
          sst_sdate: startDateTime,
          sst_edate: endDateTime,
          sst_all_day: newEvent.allDay ? 'Y' : 'N',
          sst_location_title: newEvent.locationName,
          sst_location_add: newEvent.locationAddress,
          sst_memo: newEvent.content,
          sst_alram: 0 // 기본값
        });

        if (response.success && response.data) {
          console.log('[handleSaveEvent] 스케줄 생성 성공:', response.data);
          alert('스케줄이 생성되었습니다.');
        } else {
          alert(response.error || '스케줄 생성에 실패했습니다.');
          return;
        }
      }

      // 성공적으로 완료되었을 때만 모달 닫기
      setIsAddEventModalOpen(false);
      setNewEvent(initialNewEventState);
      setSelectedEventDetails(null);
      setDateTimeError(null);
      
      // 스케줄 목록 스마트 새로 고침 - 현재 월만
      const eventDate = dayjs(newEvent.date);
      await loadAllGroupSchedules(eventDate.year(), eventDate.month() + 1);
      
    } catch (error) {
      console.error('[handleSaveEvent] 스케줄 저장 실패:', error);
      alert('스케줄 저장 중 오류가 발생했습니다.');
    }
  };

  // 일정 삭제 - 권한 확인 포함
  const handleDeleteEvent = async () => {
    if (!selectedEventDetails) {
      return;
    }

    if (!selectedEventDetails.sst_idx) {
      alert('삭제할 수 없는 스케줄입니다.');
      return;
    }

    if (!selectedGroupId) {
      alert('그룹 정보가 없습니다.');
      return;
    }

    // 현재 사용자의 권한 확인
    const currentMember = scheduleGroupMembers.find(member => member.isSelected);
    const isOwnerOrLeader = currentMember && 
      (currentMember.sgdt_owner_chk === 'Y' || currentMember.sgdt_leader_chk === 'Y');

    // 삭제 권한 확인 - 자신의 스케줄이거나 오너/리더인 경우만 삭제 가능
    if (!selectedEventDetails.canDelete && !isOwnerOrLeader) {
      alert('이 스케줄을 삭제할 권한이 없습니다.');
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
        selectedGroupId
      );

      if (response.success) {
        console.log('[handleDeleteEvent] 스케줄 삭제 성공');
        alert('스케줄이 삭제되었습니다.');
        
        // 로컬 상태에서도 제거
        setEvents(prev => prev.filter(event => event.id !== selectedEventDetails.id));
        setIsModalOpen(false);
        setSelectedEventDetails(null);
        
        // 스케줄 목록 스마트 새로 고침 - 현재 월만
        const eventDate = dayjs(selectedEventDetails.date);
        await loadAllGroupSchedules(eventDate.year(), eventDate.month() + 1);
        
      } else {
        alert(response.error || '스케줄 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('[handleDeleteEvent] 스케줄 삭제 실패:', error);
      alert('스케줄 삭제 중 오류가 발생했습니다.');
    }
  };

  // 일정 수정 모달 열기
  const handleOpenEditModal = () => {
    if (selectedEventDetails) {
      setNewEvent({
        id: selectedEventDetails.id,
        title: selectedEventDetails.title,
        date: selectedEventDetails.date,
        startTime: selectedEventDetails.startTime,
        endTime: selectedEventDetails.endTime,
        allDay: false,
        repeat: '안함',
        alarm: '없음',
        locationName: '',
        locationAddress: '',
        content: selectedEventDetails.content || '',
        groupName: selectedEventDetails.groupName || '',
        groupColor: selectedEventDetails.groupColor || '',
        memberName: selectedEventDetails.memberName || '',
        memberPhoto: selectedEventDetails.memberPhoto || '',
      });
      setIsModalOpen(false);
      setIsAddEventModalOpen(true);
      // body 스크롤은 이미 비활성화되어 있으므로 유지
    }
  };

  // 일정 클릭 핸들러
  const handleEventItemClick = (event: ScheduleEvent) => {
    setSelectedEventDetails(event);
    setIsModalOpen(true);
    // body 스크롤 비활성화
    document.body.style.overflow = 'hidden';
  };

  // 뒤로가기 핸들러
  const handleBack = () => {
    router.back();
  };

  // 모달 닫기 핸들러
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedEventDetails(null);
    // body 스크롤 복원
    document.body.style.overflow = '';
  };

  const closeAddModal = () => {
    setIsAddEventModalOpen(false);
    setNewEvent(initialNewEventState);
    setSelectedEventDetails(null);
    // body 스크롤 복원
    document.body.style.overflow = '';
  };

  // 그룹 목록 가져오기 - scheduleService 사용
  const fetchUserGroups = async () => {
    setIsLoadingGroups(true);
    try {
      console.log('[fetchUserGroups] 현재 사용자의 그룹 목록 조회 시작');
      
      // scheduleService의 getCurrentUserGroups 메서드 사용
      const response = await scheduleService.getCurrentUserGroups();
      console.log('[fetchUserGroups] API 응답:', response);
      
      if (response.success && response.data?.groups) {
        const groups = response.data.groups.map(group => ({
          sgt_idx: group.sgt_idx,
          sgt_title: group.sgt_title
        }));
        
        console.log('[fetchUserGroups] 변환된 그룹 목록:', groups);
      setUserGroups(groups);
      
      // 첫 번째 그룹을 기본 선택
      if (groups.length > 0 && !selectedGroupId) {
        setSelectedGroupId(groups[0].sgt_idx);
        console.log('[fetchUserGroups] 첫 번째 그룹 자동 선택:', groups[0].sgt_title);
        }
      } else {
        console.warn('[fetchUserGroups] 그룹 데이터가 없거나 API 실패');
        setUserGroups([]);
      }
    } catch (error) {
      console.error('[fetchUserGroups] 그룹 목록 조회 실패:', error);
      setUserGroups([]);
    } finally {
      setIsLoadingGroups(false);
    }
  };

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
          // 이미지 URL 안전하게 처리
          let photoUrl = null;
          if (member.mt_file1 && member.mt_file1.trim() !== '') {
            if (member.mt_file1.startsWith('http')) {
              photoUrl = member.mt_file1;
            } else {
              photoUrl = `/${member.mt_file1}`;
            }
            console.log(`[fetchGroupMembers] ${member.mt_name}의 이미지 URL:`, photoUrl);
          }
          
          return {
            id: member.mt_idx.toString(),
            name: member.mt_name || `멤버 ${index + 1}`,
            photo: photoUrl,
            isSelected: index === 0,
            mt_gender: typeof member.mt_gender === 'number' ? member.mt_gender : null,
            mt_idx: member.mt_idx,
            mt_name: member.mt_name,
            mt_file1: member.mt_file1,
            // 권한 정보 추가
            sgdt_owner_chk: member.sgdt_owner_chk || 'N',
            sgdt_leader_chk: member.sgdt_leader_chk || 'N'
          };
        });

        setScheduleGroupMembers(convertedMembers);
        
        if (convertedMembers.length > 0 && !selectedMemberId) {
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
    setSelectedMemberId(memberId);
    setScheduleGroupMembers(prev => prev.map(member => ({
      ...member,
      isSelected: member.id === memberId
    })));
    
    // 선택된 멤버 정보를 newEvent에 반영
    const selectedMember = scheduleGroupMembers.find(m => m.id === memberId);
    const selectedGroup = userGroups.find(g => g.sgt_idx === selectedGroupId);
    
    if (selectedMember && selectedGroup && selectedGroupId !== null) {
      // 그룹별 색상 배열 (다양한 색상 제공)
      const groupColors = [
        'bg-sky-500',
        'bg-teal-500', 
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
        memberPhoto: selectedMember.photo || '',
        groupName: selectedGroup.sgt_title,
        groupColor: groupColor
      }));
    }
  };

  // 장소 검색 모달 열기
  const handleOpenLocationSearchModal = () => {
    const currentName = newEvent.locationName;
    setLocationSearchResults([]);
    setHasSearched(false);

    const currentNameString = String(currentName || '');

    if (currentNameString.trim()) {
      setLocationSearchQuery(currentNameString);
      handleSearchLocation(currentNameString);
    } else {
      setLocationSearchQuery('');
    }

    setIsLocationSearchModalOpen(true);
    // body 스크롤은 이미 비활성화되어 있으므로 유지
  };

  // 장소 검색 모달 닫기
  const handleCloseLocationSearchModal = () => {
    setIsLocationSearchModalOpen(false);
    // body 스크롤은 부모 모달이 열려있으므로 유지
  };

  // 장소 검색 실행
  const handleSearchLocation = async (query?: string) => {
    const searchQueryValue = query !== undefined ? query : locationSearchQuery;
    const searchQueryString = String(searchQueryValue || '');

    if (!searchQueryString.trim()) return;

    setIsSearchingLocation(true);
    setHasSearched(true);
    setLocationSearchResults([]);

    try {
      // 먼저 프록시를 통한 카카오 API 호출 시도
      const proxyUrl = `/api/kakao-search?query=${encodeURIComponent(searchQueryString)}`;
      let response = await fetch(proxyUrl);
      let data;

      if (response.ok) {
        data = await response.json();
        console.log('[handleSearchLocation] 프록시를 통한 카카오 API 호출 성공:', data);
      } else {
        console.warn('[handleSearchLocation] 프록시 API 실패, 직접 호출 시도');
        
        // 프록시 실패 시 직접 카카오 API 호출
    const KAKAO_API_KEY = 'bc7899314df5dc2bebcb2a7960ac89bf';
        const directUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(searchQueryString)}`;

        response = await fetch(directUrl, {
        headers: {
          Authorization: `KakaoAK ${KAKAO_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

        data = await response.json();
        console.log('[handleSearchLocation] 직접 카카오 API 호출 성공:', data);
      }

      if (data.documents && data.documents.length > 0) {
        const resultsWithIds = data.documents.map((doc: any, index: number) => ({
          ...doc,
          temp_id: `${doc.x}-${doc.y}-${index}`
        }));
        setLocationSearchResults(resultsWithIds);
      } else {
        console.log('[handleSearchLocation] 검색 결과가 없어 목업 데이터 제공');
        // 검색 결과가 없을 때 목업 데이터 제공
        const mockResults = [
          {
            place_name: `${searchQueryString} 관련 장소 1`,
            road_address_name: '서울특별시 강남구 테헤란로 123',
            address_name: '서울특별시 강남구 역삼동 123-45',
            x: '127.0276',
            y: '37.4979',
            temp_id: 'mock-1'
          },
          {
            place_name: `${searchQueryString} 관련 장소 2`, 
            road_address_name: '서울특별시 서초구 서초대로 456',
            address_name: '서울특별시 서초구 서초동 456-78',
            x: '127.0145',
            y: '37.4837',
            temp_id: 'mock-2'
          }
        ];
        setLocationSearchResults(mockResults);
      }

    } catch (error) {
      console.error('[handleSearchLocation] 장소 검색 중 오류 발생:', error);
      console.log('[handleSearchLocation] 오류로 인해 목업 데이터 제공');
      
      // 오류 발생 시 목업 데이터 제공
      const mockResults = [
        {
          place_name: `${searchQueryString} (샘플 장소 1)`,
          road_address_name: '서울특별시 강남구 테헤란로 123',
          address_name: '서울특별시 강남구 역삼동 123-45',
          x: '127.0276',
          y: '37.4979',
          temp_id: 'mock-error-1'
        },
        {
          place_name: `${searchQueryString} (샘플 장소 2)`,
          road_address_name: '서울특별시 서초구 서초대로 456', 
          address_name: '서울특별시 서초구 서초동 456-78',
          x: '127.0145',
          y: '37.4837',
          temp_id: 'mock-error-2'
        }
      ];
      setLocationSearchResults(mockResults);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  // 검색 결과 선택
  const handleSelectLocation = (place: any) => {
    setNewEvent(prev => ({
      ...prev,
      locationName: place.place_name || '',
      locationAddress: place.road_address_name || place.address_name || '',
    }));
    handleCloseLocationSearchModal();
  };

  // 커스텀 캘린더 관련 함수들
  const handleOpenCalendarModal = () => {
    setCalendarCurrentMonth(dayjs(newEvent.date));
    setIsCalendarModalOpen(true);
  };

  const handleCloseCalendarModal = () => {
    setIsCalendarModalOpen(false);
  };

  const handleCalendarDateSelect = (date: Dayjs) => {
    setNewEvent(prev => ({
      ...prev,
      date: date.format('YYYY-MM-DD')
    }));
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
    const currentTime = type === 'start' ? newEvent.startTime : newEvent.endTime;
    const [hour, minute] = currentTime.split(':').map(Number);
    setSelectedHour(hour);
    setSelectedMinute(minute);
    setIsTimeModalOpen(true);
  };

  const handleCloseTimeModal = () => {
    setIsTimeModalOpen(false);
  };

  const handleTimeConfirm = () => {
    const timeString = `${selectedHour.toString().padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')}`;
    
    if (timeModalType === 'start') {
      setNewEvent(prev => ({
        ...prev,
        startTime: timeString
      }));
    } else {
      setNewEvent(prev => ({
        ...prev,
        endTime: timeString
      }));
    }
    
    setIsTimeModalOpen(false);
  };

  const handleHourChange = (hour: number) => {
    setSelectedHour(hour);
  };

  const handleMinuteChange = (minute: number) => {
    setSelectedMinute(minute);
  };

  // 캘린더 월 변경 핸들러 - 실제 월이 변경될 때만 API 호출
  const handleCalendarMonthChange = async (year: number, month: number) => {
    const yearMonthKey = `${year}-${month.toString().padStart(2, '0')}`;
    
    // 이미 로드된 년월과 동일하면 API 호출하지 않음
    if (loadedYearMonth === yearMonthKey) {
      console.log('[CALENDAR] 동일한 년월이므로 API 호출 생략:', yearMonthKey);
      return;
    }
    
    console.log('[CALENDAR] 월 변경으로 새로운 데이터 로드:', { year, month, previousLoaded: loadedYearMonth });
    await loadAllGroupSchedules(year, month);
    setLoadedYearMonth(yearMonthKey);
  };

  // 그룹별 색상 생성 - 더 세련된 색상 조합
  const getGroupColor = (groupId: number): string => {
    const colors = [
      '#0ea5e9', '#ec4899', '#22c55e', '#f59e0b', 
      '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16'
    ];
    return colors[groupId % colors.length];
  };

  // 모든 그룹의 스케줄 로드 - 실제 백엔드 API 사용 (함수 hoisting을 위해 미리 선언)
  const loadAllGroupSchedules = useCallback(async (year?: number, month?: number) => {
    try {
      console.log('[SCHEDULE] 스케줄 로드 시작:', { year, month });
      
      // 년월 키 설정 (현재 시간 기준으로 기본값 설정)
      const currentYear = year || dayjs().year();
      const currentMonth = month || (dayjs().month() + 1);
      const yearMonthKey = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
      