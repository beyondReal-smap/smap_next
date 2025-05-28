'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useRef } from 'react';
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
  FiAlertTriangle
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import Image from 'next/image';
import memberService from '@/services/memberService';
import groupService, { Group } from '@/services/groupService';

dayjs.extend(isBetween);
dayjs.locale('ko');

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
  background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
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
  background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
  box-shadow: 0 8px 25px rgba(79, 70, 229, 0.3);
}

.floating-button:hover {
  transform: scale(1.1);
  box-shadow: 0 12px 35px rgba(79, 70, 229, 0.4);
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
      duration: 0.2,
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
  initial: { scale: 0, rotate: -180, opacity: 0 },
  animate: { 
    scale: 1, 
    rotate: 0,
    opacity: 1,
    transition: {
      delay: 0.3,
      type: "spring",
      stiffness: 400,
      damping: 25,
      mass: 0.8,
      duration: 0.6
    }
  },
  hover: { 
    scale: 1.05,
    transition: { 
      type: "spring",
      stiffness: 400,
      damping: 15,
      duration: 0.15
    }
  },
  tap: { 
    scale: 0.95,
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
  mt_file1?: string;
}

// ScheduleEvent 인터페이스 정의
interface ScheduleEvent {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  title: string;
  content?: string;
  groupName?: string;
  groupColor?: string;
  memberName?: string;
  memberPhoto?: string;
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
    groupColor: 'bg-indigo-500',
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
    return { text: '완료', color: 'text-gray-600', bgColor: 'bg-gray-50' };
  }
}

// 커스텀 캘린더 컴포넌트
function MobileCalendar({ 
  selectedDay, 
  onDayClick, 
  events 
}: { 
  selectedDay: Dayjs | null; 
  onDayClick: (day: Dayjs) => void;
  events: ScheduleEvent[];
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
      setCurrentMonth(prev => prev.subtract(1, 'month'));
      setIsAnimating(false);
    }, 150);
  };

  const handleNextMonth = () => {
    setAnimationDirection('right');
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentMonth(prev => prev.add(1, 'month'));
      setIsAnimating(false);
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
            h-10 w-full rounded-lg flex items-center justify-center text-sm font-medium calendar-day mobile-button
            ${isSelected ? 'calendar-day selected' : ''}
            ${isToday && !isSelected ? 'bg-indigo-200 text-indigo-800 font-semibold' : ''}
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
            className="text-sm text-indigo-600 hover:text-indigo-700 mobile-button"
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
  const [events, setEvents] = useState<ScheduleEvent[]>(MOCK_SCHEDULE_EVENTS);
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

  // 날짜/시간 유효성 검사 상태
  const [dateTimeError, setDateTimeError] = useState<string | null>(null);

  // 컴포넌트 마운트 감지
  useEffect(() => {
    document.body.style.overflowX = 'hidden';
    document.documentElement.style.overflowX = 'hidden';
    
    // 그룹 데이터 로드
    fetchUserGroups();
    
    return () => {
      document.body.style.overflowX = '';
      document.documentElement.style.overflowX = '';
      // 컴포넌트 언마운트 시 body 스크롤 복원
      document.body.style.overflow = '';
    };
  }, []);

  // 선택된 그룹이 변경될 때 멤버 데이터 로드
  useEffect(() => {
    if (selectedGroupId) {
      fetchGroupMembers(selectedGroupId);
    }
  }, [selectedGroupId]);

  // 선택된 날짜의 일정들
  const eventsForSelectedDay = useMemo(() => {
    if (!selectedDay) return [];
    const dateString = selectedDay.format('YYYY-MM-DD');
    return events
      .filter(event => event.date === dateString)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
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

    // 과거 날짜 검사 (오늘 이전 날짜 방지)
    if (eventDate.isBefore(now, 'day')) {
      setDateTimeError('과거 날짜로는 일정을 생성할 수 없습니다.');
      hasError = true;
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
            // 과거 시간 검사 (현재 시간 이전 방지)
            else if (startDateTime.isBefore(now)) {
              setDateTimeError('과거 시간으로는 일정을 생성할 수 없습니다.');
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

  // 일정 저장
  const handleSaveEvent = () => {
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

    const eventToSave: ScheduleEvent = {
      id: newEvent.id || uuidv4(),
      title: newEvent.title,
      date: newEvent.date,
      startTime: newEvent.startTime,
      endTime: newEvent.endTime,
      content: newEvent.content,
      groupName: newEvent.groupName,
      groupColor: newEvent.groupColor,
      memberName: newEvent.memberName,
      memberPhoto: newEvent.memberPhoto,
    };

    if (newEvent.id) {
      // 수정
      setEvents(prev => prev.map(event => 
        event.id === newEvent.id ? eventToSave : event
      ));
    } else {
      // 추가
      setEvents(prev => [...prev, eventToSave]);
    }

    setIsAddEventModalOpen(false);
    setNewEvent(initialNewEventState);
    setSelectedEventDetails(null);
    setDateTimeError(null); // 에러 상태 초기화
  };

  // 일정 삭제
  const handleDeleteEvent = () => {
    if (selectedEventDetails) {
      setEvents(prev => prev.filter(event => event.id !== selectedEventDetails.id));
      setIsModalOpen(false);
      setSelectedEventDetails(null);
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

  // 그룹 목록 가져오기
  const fetchUserGroups = async () => {
    setIsLoadingGroups(true);
    try {
      const groups = await groupService.getCurrentUserGroups();
      console.log('[fetchUserGroups] 그룹 목록 조회:', groups);
      setUserGroups(groups);
      
      // 첫 번째 그룹을 기본 선택
      if (groups.length > 0 && !selectedGroupId) {
        setSelectedGroupId(groups[0].sgt_idx);
        console.log('[fetchUserGroups] 첫 번째 그룹 자동 선택:', groups[0].sgt_title);
      }
    } catch (error) {
      console.error('[fetchUserGroups] 그룹 목록 조회 실패:', error);
      setUserGroups([]);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  // 그룹 멤버 가져오기
  const fetchGroupMembers = async (groupId: number) => {
    setIsFetchingMembers(true);
    try {
      const memberData = await memberService.getGroupMembers(groupId.toString());
      console.log('[fetchGroupMembers] API 응답:', memberData);

      if (memberData && memberData.length > 0) {
        const convertedMembers: ScheduleGroupMember[] = memberData.map((member: any, index: number) => {
          // 이미지 URL 안전하게 처리
          let photoUrl = null;
          if (member.mt_file1 && member.mt_file1.trim() !== '') {
            if (member.mt_file1.startsWith('http')) {
              photoUrl = member.mt_file1;
            } else {
              photoUrl = `http://118.67.130.71:8000/storage/${member.mt_file1}`;
            }
            console.log(`[fetchGroupMembers] ${member.mt_name}의 이미지 URL:`, photoUrl);
          } else {
            console.log(`[fetchGroupMembers] ${member.mt_name}의 이미지가 없어 기본 이미지 사용`);
          }
          
          return {
            id: member.mt_idx.toString(),
            name: member.mt_name || `멤버 ${index + 1}`,
            photo: photoUrl,
            isSelected: index === 0, // 첫 번째 멤버를 기본 선택
            mt_gender: typeof member.mt_gender === 'number' ? member.mt_gender : null,
            mt_idx: member.mt_idx,
            mt_name: member.mt_name,
            mt_file1: member.mt_file1
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

  // 멤버 선택 핸들러
  const handleScheduleMemberSelect = (memberId: string) => {
    setSelectedMemberId(memberId);
    setScheduleGroupMembers(prev => prev.map(member => ({
      ...member,
      isSelected: member.id === memberId
    })));
    
    // 선택된 멤버 정보를 newEvent에 반영
    const selectedMember = scheduleGroupMembers.find(m => m.id === memberId);
    if (selectedMember) {
      setNewEvent(prev => ({
        ...prev,
        memberName: selectedMember.name,
        memberPhoto: selectedMember.photo || '',
        groupName: userGroups.find(g => g.sgt_idx === selectedGroupId)?.sgt_title || ''
      }));
    }
  };

  // 장소 검색 모달 열기
  const handleOpenLocationSearchModal = () => {
    const currentName = newEvent.locationName;
    setLocationSearchResults([]);

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
    setLocationSearchResults([]);

    const KAKAO_API_KEY = 'bc7899314df5dc2bebcb2a7960ac89bf';
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(searchQueryString)}`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `KakaoAK ${KAKAO_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.documents && data.documents.length > 0) {
        const resultsWithIds = data.documents.map((doc: any, index: number) => ({
          ...doc,
          temp_id: `${doc.x}-${doc.y}-${index}`
        }));
        setLocationSearchResults(resultsWithIds);
      } else {
        setLocationSearchResults([]);
      }

    } catch (error) {
      console.error('장소 검색 중 오류 발생:', error);
      setLocationSearchResults([]);
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

  return (
    <>
      <style jsx global>{pageStyles}</style>
      <div className="bg-indigo-50 min-h-screen pb-20">
        {/* 개선된 헤더 */}
        <motion.header 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="fixed top-0 left-0 right-0 z-20 glass-effect"
        >
          <div className="flex items-center justify-between h-16 px-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-3">
                <motion.div
                  initial={{ rotate: -180, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                  className="p-2 bg-indigo-600 rounded-xl"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-white stroke-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </motion.div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">일정</h1>
                  <p className="text-xs text-gray-500">그룹 멤버들과 일정을 공유해보세요</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* 필요시 추가 버튼들을 여기에 배치 */}
            </div>
          </div>
        </motion.header>

        {/* 메인 컨텐츠 - 애니메이션 적용 */}
        <motion.div
          initial="initial"
          animate="in"
          exit="out"
          variants={pageVariants}
          className="px-4 pt-20 space-y-6"
        >
          {/* 캘린더 섹션 */}
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            custom={0}
          >
            <MobileCalendar 
              selectedDay={selectedDay}
              onDayClick={setSelectedDay}
              events={events}
            />
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
                <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold">
                        {format(selectedDay.toDate(), 'MM월 dd일 (E)', { locale: ko })}
                      </h3>
                      <p className="text-indigo-100 text-sm">
                        {eventsForSelectedDay.length}개의 일정
                      </p>
                    </div>
                    <div className="flex items-center space-x-1 bg-white/20 px-3 py-1 rounded-full">
                      <HiSparkles className="w-4 h-4" />
                      <span className="text-sm font-medium">일정</span>
                    </div>
                  </div>
                </div>

                {/* 일정 목록 */}
                <div className="p-4">
                  {eventsForSelectedDay.length > 0 ? (
                    <motion.div 
                      className="space-y-3"
                      initial="hidden"
                      animate="visible"
                      variants={{
                        hidden: {},
                        visible: {
                          transition: {
                            staggerChildren: 0.1
                          }
                        }
                      }}
                    >
                      {eventsForSelectedDay.map((event, index) => {
                        const status = getEventStatus(event);
                        return (
                          <motion.div
                            key={event.id}
                            onClick={() => handleEventItemClick(event)}
                            className="event-card bg-white border border-gray-200 rounded-2xl p-4 mobile-button"
                            variants={{
                              hidden: { opacity: 0, y: 20 },
                              visible: { 
                                opacity: 1, 
                                y: 0,
                                transition: {
                                  duration: 0.4,
                                  ease: [0.25, 0.46, 0.45, 0.94]
                                }
                              }
                            }}
                            whileHover={{ 
                              y: -4,
                              transition: { duration: 0.2 }
                            }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="flex items-start space-x-3">
                              {/* 시간 표시 */}
                              <div className="flex-shrink-0 text-center">
                                <div className="text-sm font-bold text-gray-900">
                                  {event.startTime}
                                </div>
                                {event.endTime && (
                                  <div className="text-xs text-gray-500">
                                    ~ {event.endTime}
                                  </div>
                                )}
                                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${status.color} ${status.bgColor}`}>
                                  {status.text}
                                </div>
                              </div>

                              {/* 일정 내용 */}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-900 mb-1 truncate">
                                  {event.title}
                                </h4>
                                
                                {event.content && (
                                  <p className="text-sm text-gray-600 mb-2 line-clamp-2" style={{ wordBreak: 'keep-all' }}>
                                    {event.content}
                                  </p>
                                )}

                                <div className="flex items-center space-x-3">
                                  {event.groupName && (
                                    <div className="flex items-center space-x-1">
                                      <div className={`w-3 h-3 rounded-full ${event.groupColor || 'bg-gray-400'}`}></div>
                                      <span className="text-xs text-gray-600">{event.groupName}</span>
                                    </div>
                                  )}
                                  
                                  {event.memberName && (
                                    <div className="flex items-center space-x-1">
                                      {event.memberPhoto ? (
                                        <Image
                                          src={event.memberPhoto}
                                          alt={event.memberName}
                                          width={16}
                                          height={16}
                                          className="rounded-full"
                                        />
                                      ) : (
                                        <div className="w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center">
                                          <FiUser className="w-2 h-2 text-gray-600" />
                                        </div>
                                      )}
                                      <span className="text-xs text-gray-600">{event.memberName}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* 더보기 버튼 */}
                              <button className="flex-shrink-0 p-1 hover:bg-gray-100 rounded-full mobile-button">
                                <FiMoreVertical className="w-4 h-4 text-gray-400" />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiCalendar className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-1">일정이 없습니다</h3>
                      <p className="text-gray-500 text-sm">새로운 일정을 추가해보세요</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* 플로팅 추가 버튼 */}
        <motion.button
          onClick={() => {
            setIsAddEventModalOpen(true);
            // body 스크롤 비활성화
            document.body.style.overflow = 'hidden';
          }}
          className="fixed bottom-24 right-6 z-40 w-14 h-14 bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-full flex items-center justify-center text-white shadow-lg mobile-button disabled:opacity-50"
          variants={floatingButtonVariants}
          initial="initial"
          animate="animate"
          whileHover="hover"
          whileTap="tap"
          style={{
            filter: 'drop-shadow(0 4px 12px rgba(79, 70, 229, 0.4))'
          }}
        >
          <FiPlus className="w-6 h-6 stroke-2" />
        </motion.button>

        {/* 일정 상세 모달 */}
        <AnimatePresence>
          {isModalOpen && selectedEventDetails && (
            <motion.div 
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" 
              onClick={closeModal}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div 
                className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl"
                onClick={e => e.stopPropagation()}
                onWheel={e => e.stopPropagation()}
                onTouchMove={e => e.stopPropagation()}
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                drag="y"
                dragElastic={0.1}
                dragMomentum={false}
                onDrag={(event, info) => {
                  // 드래그 중 실시간 피드백
                  if (info.offset.y > 20) {
                    const target = event.currentTarget as HTMLElement;
                    if (target) {
                      target.style.opacity = String(Math.max(0.5, 1 - info.offset.y / 150));
                    }
                  }
                }}
                onDragEnd={(event, info) => {
                  // 매우 민감한 조건으로 설정
                  if (info.offset.y > 25 || info.velocity.y > 150) {
                    closeModal();
                  } else {
                    // 원래 위치로 복귀
                    const target = event.currentTarget as HTMLElement;
                    if (target) {
                      target.style.opacity = '1';
                    }
                  }
                }}
                whileDrag={{ 
                  scale: 0.99,
                  transition: { duration: 0.05 }
                }}
              >
                {/* 모달 핸들 */}
                <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-6"></div>
                
                {/* 모달 헤더 */}
                <div className="px-6 pb-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-gray-900">일정 상세</h3>
                    <button
                      onClick={closeModal}
                      className="p-2 hover:bg-gray-100 rounded-full mobile-button"
                    >
                      <FiX className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                </div>

                {/* 모달 내용 */}
                <div className="px-6 py-6 space-y-6">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">
                      {selectedEventDetails.title}
                    </h4>
                    {selectedEventDetails.content && (
                      <p className="text-gray-600" style={{ wordBreak: 'keep-all' }}>{selectedEventDetails.content}</p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <FiClock className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {dayjs(selectedEventDetails.date).format('YYYY년 MM월 DD일')}
                        </p>
                        <p className="text-sm text-gray-600">
                          {selectedEventDetails.startTime} ~ {selectedEventDetails.endTime}
                        </p>
                      </div>
                    </div>

                    {selectedEventDetails.groupName && (
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <FiUsers className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">그룹</p>
                          <div className="flex items-center space-x-2">
                            <div className={`w-3 h-3 rounded-full ${selectedEventDetails.groupColor || 'bg-gray-400'}`}></div>
                            <span className="text-sm text-gray-600">{selectedEventDetails.groupName}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedEventDetails.memberName && (
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <FiUser className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">담당자</p>
                          <div className="flex items-center space-x-2">
                            {selectedEventDetails.memberPhoto ? (
                              <Image
                                src={selectedEventDetails.memberPhoto}
                                alt={selectedEventDetails.memberName}
                                width={20}
                                height={20}
                                className="rounded-full"
                              />
                            ) : (
                              <div className="w-5 h-5 bg-gray-300 rounded-full"></div>
                            )}
                            <span className="text-sm text-gray-600">{selectedEventDetails.memberName}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 모달 액션 버튼 */}
                <div className="px-6 py-4 bg-gray-50 rounded-t-3xl space-y-3">
                  <button
                    onClick={handleOpenEditModal}
                    className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-medium mobile-button flex items-center justify-center space-x-2"
                  >
                    <FiEdit3 className="w-4 h-4" />
                    <span>수정하기</span>
                  </button>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={handleDeleteEvent}
                      className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-medium mobile-button flex items-center justify-center space-x-2"
                    >
                      <FiTrash2 className="w-4 h-4" />
                      <span>삭제</span>
                    </button>
                    
                    <button
                      onClick={closeModal}
                      className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-2xl font-medium mobile-button"
                    >
                      닫기
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 일정 추가/수정 모달 */}
        <AnimatePresence>
          {isAddEventModalOpen && (
            <motion.div 
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" 
              onClick={closeAddModal}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div 
                className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
                onWheel={e => e.stopPropagation()}
                onTouchMove={e => e.stopPropagation()}
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                drag="y"
                dragElastic={0.1}
                dragMomentum={false}
                onDrag={(event, info) => {
                  // 드래그 중 실시간 피드백
                  if (info.offset.y > 20) {
                    const target = event.currentTarget as HTMLElement;
                    if (target) {
                      target.style.opacity = String(Math.max(0.5, 1 - info.offset.y / 150));
                    }
                  }
                }}
                onDragEnd={(event, info) => {
                  // 매우 민감한 조건으로 설정
                  if (info.offset.y > 25 || info.velocity.y > 150) {
                    closeAddModal();
                  } else {
                    // 원래 위치로 복귀
                    const target = event.currentTarget as HTMLElement;
                    if (target) {
                      target.style.opacity = '1';
                    }
                  }
                }}
                whileDrag={{ 
                  scale: 0.99,
                  transition: { duration: 0.05 }
                }}
              >
                {/* 모달 핸들 - 고정 영역 */}
                <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-6 flex-shrink-0"></div>
                
                {/* 모달 헤더 - 고정 영역 */}
                <div className="px-6 pb-4 border-b border-gray-100 flex-shrink-0">
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
                </div>

                {/* 스크롤 가능한 폼 영역 */}
                <div className="flex-1 overflow-y-auto">
                  <form 
                    className="px-6 py-6 space-y-6" 
                    onSubmit={(e) => { e.preventDefault(); handleSaveEvent(); }}
                  >
                    {/* 일정 내용 (선택) */}
                    <div className="bg-blue-50 rounded-xl p-4">
                      <h4 className="font-semibold text-gray-900 mb-4">일정 내용 (선택)</h4>

                      {/* 제목 입력 */}
                      <div className="mb-4">
                        <input
                          type="text"
                          value={newEvent.title}
                          onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          placeholder="일정에 대한 상세 내용을 입력하세요"
                          required
                          maxLength={200}
                        />
                        <div className="flex justify-between mt-2">
                          <p className="text-xs text-gray-500">예) 회의 안건, 준비물, 참고사항 등</p>
                          <p className="text-xs text-gray-500">({newEvent.title.length}/200)</p>
                        </div>
                      </div>
                    </div>

                    {/* 날짜 및 시간 */}
                    <div className="bg-green-50 rounded-xl p-4">
                      <div className="flex items-center space-x-2 mb-4">
                        <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-white">3</span>
                        </div>
                        <h4 className="font-semibold text-gray-900">날짜 및 시간</h4>
                      </div>

                      {/* 날짜와 시간 정보 카드 */}
                      <div className="bg-white rounded-xl p-4 mb-4 border border-gray-200">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-700 font-medium">날짜</span>
                            <span className="text-gray-900 font-normal">
                              {dayjs(newEvent.date).format('YYYY년 MM월 DD일')}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-700 font-medium">시간</span>
                            <span className="text-gray-900 font-normal">
                              {newEvent.allDay ? '하루 종일' : `${newEvent.startTime} ~ ${newEvent.endTime}`}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-700 font-medium">하루 종일</span>
                            <span className="text-gray-900 font-normal">
                              {newEvent.allDay ? 'ON' : 'OFF'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 날짜/시간 설정 버튼 */}
                      <button
                        type="button"
                        onClick={() => setIsDateTimeModalOpen(true)}
                        className="w-full px-4 py-3 bg-green-600 text-white rounded-xl font-medium mobile-button hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                      >
                        <FiCalendar className="w-4 h-4" />
                        <span>날짜 및 시간 설정</span>
                      </button>
                    </div>

                    {/* 추가 설정 */}
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
                              onClick={() => setIsRepeatModalOpen(true)}
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
                              <span className="text-sm text-blue-600">
                                {newEvent.locationName || '장소를 검색하세요'}
                              </span>
                            </div>
                            {newEvent.locationAddress && (
                              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                                <span className="text-sm font-medium text-gray-700">주소</span>
                                <span className="text-xs text-gray-600 truncate max-w-48">
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
                          !newEvent.title || 
                          !newEvent.date || 
                          !!dateTimeError ||
                          (!newEvent.allDay && (!newEvent.startTime || !newEvent.endTime))
                        }
                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-semibold mobile-button disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200"
                      >
                        {newEvent.id ? '일정 수정' : '일정 추가'}
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

        {/* 반복 설정 모달 */}
        <AnimatePresence>
          {isRepeatModalOpen && (
            <motion.div 
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" 
              onClick={() => setIsRepeatModalOpen(false)}
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
                  <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">반복 설정</h3>
                  
                  <div className="space-y-2">
                    {['안함', '매일', '매주', '매월', '매년'].map((option) => (
                      <button
                        key={option}
                        onClick={() => {
                          setNewEvent({ ...newEvent, repeat: option });
                          setIsRepeatModalOpen(false);
                        }}
                        className={`w-full px-4 py-3 text-left rounded-xl transition-all duration-200 mobile-button ${
                          newEvent.repeat === option
                            ? 'bg-amber-100 text-amber-800 font-semibold border-2 border-amber-300'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{option}</span>
                          {newEvent.repeat === option && (
                            <span className="text-amber-600">✓</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setIsRepeatModalOpen(false);
                      // body 스크롤은 부모 모달이 열려있으므로 유지
                    }}
                    className="w-full mt-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium mobile-button hover:bg-gray-200 transition-colors"
                  >
                    취소
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 알림 설정 모달 */}
        <AnimatePresence>
          {isAlarmModalOpen && (
            <motion.div 
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" 
              onClick={() => setIsAlarmModalOpen(false)}
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
                  
                  <div className="space-y-2 max-h-64 overflow-y-auto">
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
                    onClick={() => {
                      setIsAlarmModalOpen(false);
                      // body 스크롤은 부모 모달이 열려있으므로 유지
                    }}
                    className="w-full mt-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium mobile-button hover:bg-gray-200 transition-colors"
                  >
                    취소
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 날짜 및 시간 설정 모달 */}
        <AnimatePresence>
          {isDateTimeModalOpen && (
            <motion.div 
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" 
              onClick={() => setIsDateTimeModalOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div 
                className="w-full max-w-md bg-white rounded-3xl shadow-2xl mx-4"
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
                        onClick={() => setNewEvent({ ...newEvent, allDay: !newEvent.allDay })}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${newEvent.allDay ? 'bg-green-600' : 'bg-gray-200'}`}
                        role="switch"
                        aria-checked={newEvent.allDay}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${newEvent.allDay ? 'translate-x-5' : 'translate-x-0'}`}
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
                          {dayjs(newEvent.date).format('YYYY년 MM월 DD일 (ddd)')}
                        </span>
                        <FiCalendar className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>

                    {/* 시간 선택 (하루종일이 아닐 때만) */}
                    {!newEvent.allDay && (
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
                                {newEvent.startTime}
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
                                {newEvent.endTime}
                              </span>
                              <FiClock className="w-5 h-5 text-gray-400" />
                            </button>
                          </div>
                        </div>
                        
                        {/* 시간 미리보기 */}
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600 text-center">
                            <span className="font-medium text-gray-900">
                              {dayjs(newEvent.date).format('YYYY년 MM월 DD일')}
                            </span>
                            <br />
                            <span className="text-green-600 font-medium">
                              {newEvent.startTime} ~ {newEvent.endTime}
                            </span>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 하루 종일일 때 미리보기 */}
                    {newEvent.allDay && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 text-center">
                          <span className="font-medium text-gray-900">
                            {dayjs(newEvent.date).format('YYYY년 MM월 DD일')}
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
                      onClick={() => {
                        setIsDateTimeModalOpen(false);
                        // body 스크롤은 부모 모달이 열려있으므로 유지
                      }}
                      disabled={!!dateTimeError}
                      className={`flex-1 py-3 rounded-xl font-medium mobile-button transition-colors ${
                        dateTimeError 
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      확인
                    </button>
                    <button
                      onClick={() => {
                        setIsDateTimeModalOpen(false);
                        // body 스크롤은 부모 모달이 열려있으므로 유지
                      }}
                      className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium mobile-button hover:bg-gray-200 transition-colors"
                    >
                      취소
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 커스텀 시간 선택 모달 */}
        <AnimatePresence>
          {isTimeModalOpen && (
            <motion.div 
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" 
              onClick={handleCloseTimeModal}
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
                      {selectedHour < 12 ? '오전' : '오후'} {selectedHour === 0 ? 12 : selectedHour > 12 ? selectedHour - 12 : selectedHour}시 {selectedMinute}분
                    </div>
                  </div>

                  {/* 시간 선택 영역 */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {/* 시간 선택 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3 text-center">시간</label>
                      <div ref={hourScrollRef} className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg">
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
                      <div ref={minuteScrollRef} className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg">
                        {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => (
                          <motion.button
                            key={minute}
                            onClick={() => handleMinuteChange(minute)}
                            className={`w-full px-3 py-2 text-sm transition-all duration-200 mobile-button ${
                              selectedMinute === minute
                                ? 'bg-green-600 text-white font-semibold'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
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
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
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
                      className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium mobile-button hover:bg-green-700 transition-colors"
                    >
                      확인
                    </button>
                    <button
                      onClick={handleCloseTimeModal}
                      className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium mobile-button hover:bg-gray-200 transition-colors"
                    >
                      취소
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 장소 검색 모달 */}
        <AnimatePresence>
          {isLocationSearchModalOpen && (
            <motion.div 
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" 
              onClick={() => setIsLocationSearchModalOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div 
                className="w-full max-w-md bg-white rounded-3xl shadow-2xl mx-4"
                onClick={e => e.stopPropagation()}
                onWheel={e => e.stopPropagation()}
                onTouchMove={e => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6 text-center">장소 검색</h3>
                  
                  <div className="space-y-6">
                    {/* 장소 검색 입력 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">장소명 또는 주소 입력</label>
                      <input
                        type="text"
                        value={locationSearchQuery}
                        onChange={(e) => setLocationSearchQuery(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="장소명 또는 주소를 입력하세요"
                      />
                    </div>

                    {/* 검색 버튼 */}
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleSearchLocation()}
                        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium mobile-button hover:bg-indigo-700 transition-colors"
                      >
                        검색
                      </button>
                    </div>

                    {/* 검색 결과 표시 */}
                    {isSearchingLocation ? (
                      <div className="text-center py-6">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </div>
                        <p className="text-gray-600">장소를 검색하는 중입니다...</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {locationSearchResults.length > 0 ? (
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900 mb-2">검색 결과</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {locationSearchResults.map((place) => (
                                <div key={place.temp_id} className="bg-white rounded-lg shadow-md p-4 transition-transform hover:scale-105">
                                  <h5 className="text-lg font-semibold mb-2">{place.place_name}</h5>
                                  <p className="text-gray-600 mb-2">{place.road_address_name || place.address_name}</p>
                                  <button
                                    onClick={() => handleSelectLocation(place)}
                                    className="w-full py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                                  >
                                    선택
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <FiAlertTriangle className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-gray-600">검색 결과가 없습니다. 다른 검색어를 입력해보세요.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 커스텀 캘린더 모달 */}
        <AnimatePresence>
          {isCalendarModalOpen && (
            <motion.div 
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" 
              onClick={handleCloseCalendarModal}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div 
                className="w-full max-w-md bg-white rounded-3xl shadow-2xl mx-4"
                onClick={e => e.stopPropagation()}
                onWheel={e => e.stopPropagation()}
                onTouchMove={e => e.stopPropagation()}
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
                      className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium mobile-button hover:bg-green-700 transition-colors"
                    >
                      확인
                    </button>
                    <button
                      onClick={handleCloseCalendarModal}
                      className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium mobile-button hover:bg-gray-200 transition-colors"
                    >
                      취소
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}