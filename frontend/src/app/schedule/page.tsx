'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ko';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { PickersCalendarHeader, PickersCalendarHeaderProps } from '@mui/x-date-pickers/PickersCalendarHeader';
import { PickersDay, PickersDayProps } from '@mui/x-date-pickers/PickersDay';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { PageContainer, Card, Button } from '../components/layout';
import { IconButton, Box, Typography, Button as MuiButton, ListItemText, List, ListItemButton, Paper, Chip, Avatar, Badge } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import isBetween from 'dayjs/plugin/isBetween';
import { v4 as uuidv4 } from 'uuid';

dayjs.extend(isBetween);
dayjs.locale('ko');

const TODAY = dayjs().format('YYYY-MM-DD');
const YESTERDAY = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
const TOMORROW = dayjs().add(1, 'day').format('YYYY-MM-DD');

// ScheduleEvent 인터페이스 정의 (컴포넌트 외부)
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

// 모의 일정 데이터 (컴포넌트 외부)
const MOCK_SCHEDULE_EVENTS: ScheduleEvent[] = [
  {
    id: '1',
    date: TODAY,
    startTime: '09:00',
    endTime: '10:00',
    title: '아침 스크럼',
    content: '데일리 스크럼 진행 및 이슈 공유',
    groupName: '프론트엔드팀',
    groupColor: 'bg-sky-200', // Changed color and name
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
    groupColor: 'bg-teal-200', // Changed color and name
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
    groupColor: 'bg-amber-200', // Changed color and name
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
    groupColor: 'bg-indigo-200', // Changed color and name
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
    groupColor: 'bg-rose-200', // Changed color and name
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
    groupColor: 'bg-lime-200', // Changed color and name
    memberName: '홍길동',
    memberPhoto: '/images/avar1.png',
  },
  {
    id: '7',
    date: dayjs().add(2, 'day').format('YYYY-MM-DD'),
    startTime: '09:30',
    endTime: '10:30',
    title: '마케팅 캠페인 아이디어 회의',
    groupName: '마케팅팀',
    groupColor: 'bg-fuchsia-200', // Changed color and name
    memberName: '고은별',
    memberPhoto: '/images/avar2.png',
  },
];

// NewEvent 폼 데이터용 인터페이스 (컴포넌트 외부)
interface NewEvent {
  id?: string; // 수정 시 사용
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  content?: string;
  groupName?: string;
  groupColor?: string;
  memberName?: string;
  memberPhoto?: string;
}

// 이벤트 상태에 따른 MUI 색상 이름 반환
function getEventStatus(event: ScheduleEvent): { text: string; color: 'success' | 'warning' | 'error' | 'info' | 'default' } {
  const now = dayjs();
  // Ensure event.date and event.startTime are valid before parsing
  if (!event.date || !event.startTime || !event.endTime) {
    // Handle cases where date or time might be missing, though ideally they shouldn't be
    return { text: '시간 정보 부족', color: 'error' };
  }
  const eventStartDateTime = dayjs(`${event.date}T${event.startTime}`);
  const eventEndDateTime = dayjs(`${event.date}T${event.endTime}`);

  if (!eventStartDateTime.isValid() || !eventEndDateTime.isValid()) {
    return { text: '잘못된 시간 형식', color: 'error' };
  }

  if (now.isAfter(eventEndDateTime)) { return { text: '완료', color: 'success' }; }
  if (now.isBetween(eventStartDateTime, eventEndDateTime, null, '[]')) { return { text: '진행 중', color: 'warning' }; }
  if (now.isBefore(eventStartDateTime)) { return { text: '예정', color: 'default' }; }
  return { text: '확인 필요', color: 'default' };
}

// 상태 보더 색상 매핑
const statusColorMap = { success: '#22c55e', warning: '#f97316', error: '#ef4444', info: '#3b82f6', default: '#6b7280' };

// 상태 배경 색상 매핑 (연한 버전)
const statusBgColorMap = {
  success: '#f0fdf4', // green-50
  warning: '#fff7ed', // orange-50
  error: '#fef2f2',   // red-50
  info: '#eff6ff',    // blue-50
  default: '#f9fafb' // gray-50 (예정)
};

// CustomCalendarHeaderProps 및 CustomCalendarHeader 함수 (컴포넌트 외부 또는 SchedulePage 내부 상단)
interface CustomCalendarHeaderProps extends PickersCalendarHeaderProps<Dayjs> { onGoToToday: () => void; }
function CustomCalendarHeader(props: CustomCalendarHeaderProps) {
  const { currentMonth, onMonthChange, onGoToToday } = props;
  const handlePrevMonth = () => { onMonthChange(dayjs(currentMonth).subtract(1, 'month'), 'left'); };
  const handleNextMonth = () => { onMonthChange(dayjs(currentMonth).add(1, 'month'), 'right'); };
  const monthName = dayjs(currentMonth).format('YYYY년 MMMM');

  return (
    <Box display="flex" justifyContent="space-between" alignItems="center" p={1} sx={{ borderBottom: '1px solid #e0e0e0' }}>
      <IconButton onClick={handlePrevMonth} size="small" aria-label="Previous month"><ChevronLeftIcon /></IconButton>
      <Typography variant="subtitle1" component="div" sx={{ fontSize: '1.25rem' }}>{monthName}</Typography>
      <Box>
        <MuiButton onClick={onGoToToday} variant="text" size="small" sx={{ marginRight: '8px', fontSize: '0.875rem' }}>오늘</MuiButton>
        <IconButton onClick={handleNextMonth} size="small" aria-label="Next month"><ChevronRightIcon /></IconButton>
      </Box>
    </Box>
  );
}

// CustomDay Props 정의에 hasEvent 추가
interface CustomDayProps extends PickersDayProps<Dayjs> {
  hasEvent?: boolean;
}

// CustomDay 컴포넌트 정의 (Badge 추가)
function CustomDay(props: CustomDayProps) {
  const { day, outsideCurrentMonth, hasEvent, ...other } = props;

  const isSaturday = day.day() === 6;
  const isSunday = day.day() === 0;
  const sxProps: any = { fontSize: '1.1rem' }; // 날짜 숫자 크기

  if (!outsideCurrentMonth) {
    if (isSaturday) sxProps.color = 'blue';
    else if (isSunday) sxProps.color = 'red';
  }

  return (
    <Badge
      key={day.toString()}
      overlap="circular"
      variant="dot"
      invisible={!hasEvent || outsideCurrentMonth}
      sx={{
        '& .MuiBadge-dot': {
          backgroundColor: '#FF3333', // 형광 느낌의 밝은 빨강 (예: 네온 레드 계열)
          width: '6px',  // 점 크기 (정원으로 보이도록 width/height 동일하게 유지)
          height: '6px', // 점 크기
          borderRadius: '50%', // 원형 유지
          minWidth: '6px', // 최소 크기 보장
          position: 'absolute', 
          bottom: '10%', 
          right: '48%',  // 오른쪽으로 이동 (값 감소)
        }
      }}
    >
      <PickersDay {...other} day={day} outsideCurrentMonth={outsideCurrentMonth} sx={sxProps} />
    </Badge>
  );
}

export default function SchedulePage() {
  const [eventDates, setEventDates] = useState<ScheduleEvent[]>(MOCK_SCHEDULE_EVENTS);
  const [selectedDay, setSelectedDay] = useState<Dayjs | null>(dayjs());
  const [eventsForSelectedDay, setEventsForSelectedDay] = useState<ScheduleEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEventDetails, setSelectedEventDetails] = useState<ScheduleEvent | null>(null);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);

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
    // selectedDay가 변경될 때 newEvent의 date 필드를 업데이트
    setNewEvent(prev => ({
      ...prev,
      date: selectedDay ? selectedDay.format('YYYY-MM-DD') : TODAY,
    }));
  }, [selectedDay]);

  const router = useRouter();

  // 이벤트가 있는 날짜 Set 생성 (YYYY-MM-DD 형식)
  const eventDays = useMemo(() => {
    const daysWithEvents = new Set<string>();
    eventDates.forEach(event => {
      daysWithEvents.add(event.date); // event.date는 이미 YYYY-MM-DD 형식
    });
    return daysWithEvents;
  }, [eventDates]);

  useEffect(() => { /* Filter and sort events for selectedDay */
    if (selectedDay) {
      const filteredEvents = eventDates
        .filter(event => event.date === selectedDay.format('YYYY-MM-DD'))
        .sort((a, b) => {
          // startTime을 비교하여 정렬 (HH:mm 형식)
          return a.startTime.localeCompare(b.startTime);
        });
      setEventsForSelectedDay(filteredEvents);
    } else { setEventsForSelectedDay([]); }
  }, [selectedDay, eventDates]);

  const handleDayClick = (newValue: Dayjs | null) => { if (newValue) setSelectedDay(newValue.startOf('day')); };

  const handleSaveEvent = () => {
    if (!newEvent.title || !newEvent.date || !newEvent.startTime || !newEvent.endTime) return;
    
    const eventToSave: ScheduleEvent = {
      id: newEvent.id || uuidv4(),
      title: newEvent.title,
      date: newEvent.date,
      startTime: newEvent.startTime,
      endTime: newEvent.endTime,
      content: newEvent.content || undefined,
      groupName: newEvent.groupName || undefined,
      groupColor: newEvent.groupColor || undefined,
      memberName: newEvent.memberName || undefined,
      memberPhoto: newEvent.memberPhoto || undefined,
    };

    if (newEvent.id) {
      setEventDates(eventDates.map(event => event.id === newEvent.id ? eventToSave : event));
    } else {
      setEventDates([...eventDates, eventToSave]);
    }
    setIsAddEventModalOpen(false);
    setNewEvent(initialNewEventState); // Reset form to initial state for the current selectedDay
    setSelectedEventDetails(null);
  };

  const handleDeleteEvent = () => {
    if (!selectedEventDetails || !selectedEventDetails.id) return;
    setEventDates(eventDates.filter(event => event.id !== selectedEventDetails.id));
    setIsModalOpen(false);
    setSelectedEventDetails(null);
  };

  const handleOpenEditModal = () => {
    if (!selectedEventDetails) return;
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
    setIsAddEventModalOpen(true);
    setIsModalOpen(false);
  };
  
  const handleGoToToday = () => { if (dayjs()) setSelectedDay(dayjs().startOf('day')); };

  const handleEventItemClick = (event: ScheduleEvent) => { setSelectedEventDetails(event); setIsModalOpen(true); };

  return (
    <PageContainer title="일정 관리" description="일정을 생성하고 관리하세요" showHeader={false} showBackButton={false} className="bg-gray-50 pb-2">
      {/* Calendar Card - 오른쪽 보더 굵기 수정 */}
      <Card className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center font-['Line_Seed'] mb-6 border-r-4 border-black">
        <div className="w-full p-2">
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ko">
            <DateCalendar 
              value={selectedDay} 
              onChange={handleDayClick}
              slots={{ 
                // day 슬롯 수정: hasEvent prop 전달
                day: (props) => {
                  const dayStr = props.day.format('YYYY-MM-DD');
                  const hasEvent = eventDays.has(dayStr);
                  return <CustomDay {...props} hasEvent={hasEvent} />;
                },
                calendarHeader: (headerProps) => <CustomCalendarHeader {...headerProps} onGoToToday={handleGoToToday} /> 
              }}
              sx={{
                '& .MuiDayCalendar-weekDayLabel': { fontSize: '0.9rem', textTransform: 'none', margin: '0 0.5rem' },
                '& .MuiDayCalendar-monthContainer': { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
                '& .MuiDayCalendar-weekContainer': { display: 'flex', gap: '0.4rem' },
              }}
            />
          </LocalizationProvider>
        </div>
      </Card>

      {/* Selected Day Events Card - 오른쪽 보더로 변경 */}
      {selectedDay && (
        <Card 
          className="w-full max-w-6xl mx-auto font-['Line_Seed'] mt-6 border-r-4 border-yellow-500"
          title={
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <Typography variant="h6" component="span" sx={{ fontWeight: 'bold' }}>
                {selectedDay.format('YYYY년 MM월 DD일')} 일정
              </Typography>
              <Chip label={`${eventsForSelectedDay.length}개 일정`} size="small" color="primary" variant="outlined" />
            </Box>
          }
        >
          <div className="p-2 pt-2">
            {eventsForSelectedDay.length > 0 ? (
              <List sx={{paddingTop: 0}}>
                {eventsForSelectedDay.map((event) => {
                  const status = getEventStatus(event);
                  const borderColor = statusColorMap[status.color] || statusColorMap.default;
                  const bgColor = statusBgColorMap[status.color] || statusBgColorMap.default;
                  return (
                    <ListItemButton 
                      key={event.id} 
                      onClick={() => handleEventItemClick(event)}
                      sx={{
                        mb: 1.5, p: 2, 
                        borderLeft: '1px solid #eee', borderRight: '1px solid #eee', borderBottom: '1px solid #eee',
                        borderRadius: '4px', alignItems: 'flex-start', 
                        backgroundColor: bgColor,
                        transition: 'box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out, background-color 0.2s ease-in-out',
                        '&:hover': { 
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)', 
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', width: '100%', gap: 0 }}>
                        <Box sx={{ 
                          mr: 2,
                          pr: 2,
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center', 
                          flexShrink: 0, 
                          minWidth: '75px',
                          borderRight: '1px solid #e0e0e0'
                        }}>
                          <Typography variant="subtitle1" component="div" sx={{ fontWeight: 'bold', color: '#374151' }}>
                            {event.startTime}
                          </Typography>
                          {event.endTime && (
                            <Typography variant="caption" component="div" color="text.secondary" sx={{lineHeight: 1.2}}>
                              {`~ ${event.endTime}`}
                            </Typography>
                          )}
                          <Chip label={status.text} color={status.color} size="small" sx={{ mt: 0.75, fontWeight: 500 }} />
                        </Box>
                        <Box sx={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          flexGrow: 1, 
                          pl: 2
                        }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.3, mb: 0.5, color: '#111827' }}>
                            {event.title}
                          </Typography>
                          {(event.groupName || event.memberName || event.content) && (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                              {event.groupName && (
                                <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                  {event.groupName}
                                </Typography>
                              )}
                              {event.memberName && (
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Avatar src={event.memberPhoto} sx={{ width: 20, height: 20, mr: 1, fontSize: '0.7rem', bgcolor: '#e0e0e0' }}>
                                    {!event.memberPhoto && event.memberName.substring(0,1)}
                                  </Avatar>
                                  <Typography variant="body2" color="text.secondary">
                                    {event.memberName}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </ListItemButton>
                  );
                })}
              </List>
            ) : (
              <Paper elevation={0} sx={{ textAlign: 'center', py: 4, backgroundColor: 'transparent', borderRadius: '8px' }}>
                <Typography variant="subtitle1" color="text.secondary">선택된 날짜에 일정이 없습니다.</Typography>
              </Paper>
            )}
          </div>
           <div className="p-4 border-t border-gray-200 text-right">
            <Button 
              variant="primary" 
              onClick={() => {
                if (selectedDay) {
                  const dateQueryParam = selectedDay.format('YYYY-MM-DD');
                  router.push(`/schedule/add?date=${dateQueryParam}`);
                }
              }}
              disabled={!selectedDay}
            >
              새 일정 추가
            </Button>
          </div>
        </Card>
      )}

      {/* 상세 정보 모달 (isModalOpen) */}
      {isModalOpen ? selectedEventDetails && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <Card className="max-w-lg w-full" title={selectedEventDetails.title || '일정 상세'}>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">일시</h4>
                <p className="mt-1">
                  {dayjs(selectedEventDetails.date).format('YYYY년 MM월 DD일')} {selectedEventDetails.startTime}
                  {selectedEventDetails.endTime ? ` ~ ${selectedEventDetails.endTime}` : ''}
                </p>
              </div>
              {selectedEventDetails.groupName && ( 
                <div>
                  <h4 className="text-sm font-medium text-gray-500">그룹</h4>
                  <Chip 
                    label={selectedEventDetails.groupName} 
                    size="small" 
                    sx={{ 
                      backgroundColor: selectedEventDetails.groupColor || 'default', 
                      color: selectedEventDetails.groupColor ? 'black': 'inherit', 
                      mt: 0.5 
                    }} 
                  />
                </div>
              )}
              {selectedEventDetails.memberName && ( 
                 <div>
                  <h4 className="text-sm font-medium text-gray-500">담당자</h4>
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                    {selectedEventDetails.memberPhoto && (
                      <Avatar 
                        alt={selectedEventDetails.memberName} 
                        src={selectedEventDetails.memberPhoto} 
                        sx={{ width: 24, height: 24, mr: 1 }} 
                      />
                    )}
                    <p>{selectedEventDetails.memberName}</p>
                  </Box>
                </div>
              )}
              {selectedEventDetails.content && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500">내용</h4>
                  <p className="mt-1 whitespace-pre-wrap">{selectedEventDetails.content}</p>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>닫기</Button>
              <Button variant="primary" onClick={handleOpenEditModal}>수정</Button>
              <Button variant="danger" onClick={handleDeleteEvent}>삭제</Button>
            </div>
          </Card>
        </div>
      ) : null}

      {/* 추가/수정 모달 (isAddEventModalOpen) */}
      {isAddEventModalOpen ? (
         <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-medium text-gray-900 font-suite">{newEvent.id ? '일정 수정' : '새 일정 추가'}</h3>
              <button onClick={() => { setIsAddEventModalOpen(false); setNewEvent(initialNewEventState); setSelectedEventDetails(null); }} className="text-gray-400 hover:text-gray-500">
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); handleSaveEvent(); }}>
              <div>
                <label htmlFor="event-title" className="block text-sm font-medium text-gray-700">제목</label>
                <input type="text" id="event-title" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} required />
              </div>
              <div>
                <label htmlFor="event-date" className="block text-sm font-medium text-gray-700">날짜</label>
                <input type="date" id="event-date" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" value={newEvent.date} onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="event-startTime" className="block text-sm font-medium text-gray-700">시작 시간</label>
                  <input type="time" id="event-startTime" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" value={newEvent.startTime} onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })} required />
                </div>
                <div>
                  <label htmlFor="event-endTime" className="block text-sm font-medium text-gray-700">종료 시간</label>
                  <input type="time" id="event-endTime" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" value={newEvent.endTime} onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })} required />
                </div>
              </div>
              <div>
                <label htmlFor="event-content" className="block text-sm font-medium text-gray-700">내용 (선택)</label>
                <textarea id="event-content" rows={3} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" value={newEvent.content || ''} onChange={(e) => setNewEvent({ ...newEvent, content: e.target.value })}></textarea>
              </div>
              {/* Group/Member fields - 필요시 아래 주석 해제하여 사용 */}
              <div>
                <label htmlFor="event-groupName" className="block text-sm font-medium text-gray-700">그룹명 (선택)</label>
                <input type="text" id="event-groupName" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" value={newEvent.groupName || ''} onChange={(e) => setNewEvent({ ...newEvent, groupName: e.target.value })} />
              </div>
              <div>
                <label htmlFor="event-groupColor" className="block text-sm font-medium text-gray-700">그룹 색상 (선택, Tailwind 클래스 예: bg-blue-200)</label>
                <input type="text" id="event-groupColor" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" value={newEvent.groupColor || ''} onChange={(e) => setNewEvent({ ...newEvent, groupColor: e.target.value })} />
              </div>
              <div>
                <label htmlFor="event-memberName" className="block text-sm font-medium text-gray-700">담당자명 (선택)</label>
                <input type="text" id="event-memberName" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" value={newEvent.memberName || ''} onChange={(e) => setNewEvent({ ...newEvent, memberName: e.target.value })} />
              </div>
               <div>
                <label htmlFor="event-memberPhoto" className="block text-sm font-medium text-gray-700">담당자 사진 URL (선택)</label>
                <input type="text" id="event-memberPhoto" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" value={newEvent.memberPhoto || ''} onChange={(e) => setNewEvent({ ...newEvent, memberPhoto: e.target.value })} />
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={() => { setIsAddEventModalOpen(false); setNewEvent(initialNewEventState); setSelectedEventDetails(null);}} className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">취소</button>
                <button type="submit" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" disabled={!newEvent.title || !newEvent.date || !newEvent.startTime || !newEvent.endTime}>저장</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
} 