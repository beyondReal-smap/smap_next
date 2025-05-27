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
  FiMoreVertical
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import Image from 'next/image';

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
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.9);
}

.calendar-day {
  transition: all 0.2s ease;
  cursor: pointer;
  user-select: none;
  position: relative;
}

.calendar-day:hover {
  transform: scale(1.1);
}

.calendar-day.selected {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  color: white;
  transform: scale(1.1);
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
  bottom: 80px;
  right: 20px;
  z-index: 40;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
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
  initial: { scale: 0, rotate: -180 },
  animate: { 
    scale: 1, 
    rotate: 0,
    transition: {
      delay: 0.5,
      type: "spring",
      stiffness: 260,
      damping: 20
    }
  },
  hover: { 
    scale: 1.1,
    transition: { duration: 0.2 }
  },
  tap: { scale: 0.9 }
};

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
            ${isToday && !isSelected ? 'bg-indigo-100 text-indigo-600' : ''}
            ${!isSelected && !isToday ? 'hover:bg-gray-100' : ''}
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
          <div key={day} className={`h-6 flex items-center justify-center text-xs font-medium ${
            index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-500'
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

  // 컴포넌트 마운트 감지
  useEffect(() => {
    document.body.style.overflowX = 'hidden';
    document.documentElement.style.overflowX = 'hidden';
    
    return () => {
      document.body.style.overflowX = '';
      document.documentElement.style.overflowX = '';
    };
  }, []);

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

  // 일정 저장
  const handleSaveEvent = () => {
    if (!newEvent.title || !newEvent.date || !newEvent.startTime || !newEvent.endTime) return;

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
        content: selectedEventDetails.content || '',
        groupName: selectedEventDetails.groupName || '',
        groupColor: selectedEventDetails.groupColor || '',
        memberName: selectedEventDetails.memberName || '',
        memberPhoto: selectedEventDetails.memberPhoto || '',
      });
      setIsModalOpen(false);
      setIsAddEventModalOpen(true);
    }
  };

  // 일정 클릭 핸들러
  const handleEventItemClick = (event: ScheduleEvent) => {
    setSelectedEventDetails(event);
    setIsModalOpen(true);
  };

  // 뒤로가기 핸들러
  const handleBack = () => {
    router.back();
  };

  // 모달 닫기 핸들러
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedEventDetails(null);
  };

  const closeAddModal = () => {
    setIsAddEventModalOpen(false);
    setNewEvent(initialNewEventState);
    setSelectedEventDetails(null);
  };

  return (
    <>
      <style jsx global>{pageStyles}</style>
      <div className="bg-indigo-50 min-h-screen pb-20">
        {/* 앱 헤더 - 완전 고정 */}
        <div className="fixed top-0 left-0 right-0 z-50 px-4 bg-white/95 backdrop-blur-md border-b border-gray-200/50">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <FiCalendar className="w-5 h-5 text-indigo-600" />
                <span className="text-lg font-semibold text-gray-900">일정</span>
              </div>
            </div>
          </div>
        </div>

        {/* 메인 컨텐츠 - 애니메이션 적용 */}
        <motion.div
          initial="initial"
          animate="in"
          exit="out"
          variants={pageVariants}
          className="px-4 pt-8 space-y-6"
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
                                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
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
          onClick={() => setIsAddEventModalOpen(true)}
          className="floating-button w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg mobile-button disabled:opacity-50"
          variants={floatingButtonVariants}
          initial="initial"
          animate="animate"
          whileHover="hover"
          whileTap="tap"
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
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
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
                      <p className="text-gray-600">{selectedEventDetails.content}</p>
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
                className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {/* 모달 핸들 */}
                <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-6"></div>
                
                {/* 모달 헤더 */}
                <div className="px-6 pb-4 border-b border-gray-100">
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

                {/* 폼 */}
                <form 
                  className="px-6 py-6 space-y-6" 
                  onSubmit={(e) => { e.preventDefault(); handleSaveEvent(); }}
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
                    <input
                      type="text"
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="일정 제목을 입력하세요"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">날짜</label>
                    <input
                      type="date"
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">시작 시간</label>
                      <input
                        type="time"
                        value={newEvent.startTime}
                        onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">종료 시간</label>
                      <input
                        type="time"
                        value={newEvent.endTime}
                        onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">내용 (선택)</label>
                    <textarea
                      value={newEvent.content || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, content: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="일정에 대한 상세 내용을 입력하세요"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">그룹명 (선택)</label>
                    <input
                      type="text"
                      value={newEvent.groupName || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, groupName: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="그룹명을 입력하세요"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">담당자명 (선택)</label>
                    <input
                      type="text"
                      value={newEvent.memberName || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, memberName: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="담당자명을 입력하세요"
                    />
                  </div>

                  {/* 액션 버튼 */}
                  <div className="pt-4 space-y-3">
                    <button
                      type="submit"
                      disabled={!newEvent.title || !newEvent.date || !newEvent.startTime || !newEvent.endTime}
                      className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-medium mobile-button disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {newEvent.id ? '수정하기' : '저장하기'}
                    </button>
                    
                    <button
                      type="button"
                      onClick={closeAddModal}
                      className="w-full py-3 bg-gray-200 text-gray-700 rounded-2xl font-medium mobile-button"
                    >
                      취소
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
} 