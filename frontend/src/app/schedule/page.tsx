'use client';

import { useState, useEffect } from 'react';
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
import { IconButton, Box, Typography, Button as MuiButton } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

// 한국어 로케일 설정
dayjs.locale('ko');

// 모의 데이터 (react-day-picker에 맞게 이벤트 날짜만 추출)
const MOCK_EVENTS_DATES = [
  dayjs().add(1, 'day').startOf('day').toDate(),
  dayjs().add(3, 'day').startOf('day').toDate(),
  dayjs().add(5, 'day').startOf('day').toDate(),
  new Date(2025, 4, 3), // 2025년 5월 3일 (0-indexed month)
  new Date(2025, 4, 6), // 2025년 5월 6일
  new Date(2025, 4, 10),
  new Date(2025, 4, 17),
  new Date(2025, 4, 24),
  new Date(2025, 4, 31),
];

interface NewEvent {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  backgroundColor: string;
  location: string;
  description: string;
}

// PickersCalendarHeaderProps에 onGoToToday 추가
interface CustomCalendarHeaderProps extends PickersCalendarHeaderProps {
  onGoToToday: () => void;
}

// 커스텀 캘린더 헤더
function CustomCalendarHeader(props: CustomCalendarHeaderProps) {
  const { currentMonth, onMonthChange, onGoToToday } = props;

  const handlePrevMonth = () => {
    onMonthChange(dayjs(currentMonth).subtract(1, 'month'));
  };

  const handleNextMonth = () => {
    onMonthChange(dayjs(currentMonth).add(1, 'month'));
  };

  // onGoToToday prop을 직접 호출
  const handleGoToTodayFromHeader = () => {
    onGoToToday(); 
  };

  return (
    <Box display="flex" justifyContent="space-between" alignItems="center" p={1} sx={{ borderBottom: '1px solid #e0e0e0' }}>
      <IconButton onClick={handlePrevMonth} size="small" aria-label="Previous month">
        <ChevronLeftIcon />
      </IconButton>
      <Typography variant="subtitle1" component="div" sx={{ fontSize: '1.25rem' }}>
        {dayjs(currentMonth).format('YYYY년 MMMM')}
      </Typography>
      <Box>
        <MuiButton onClick={handleGoToTodayFromHeader} variant="text" size="small" sx={{ marginRight: '8px', fontSize: '0.875rem' }}>
          오늘
        </MuiButton>
        <IconButton onClick={handleNextMonth} size="small" aria-label="Next month">
          <ChevronRightIcon />
        </IconButton>
      </Box>
    </Box>
  );
}

export default function SchedulePage() {
  const [eventDates, setEventDates] = useState<Date[]>(MOCK_EVENTS_DATES);
  const [selectedDay, setSelectedDay] = useState<Dayjs | null>(dayjs());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEventDetails, setSelectedEventDetails] = useState<any>(null);
  
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState<NewEvent>({
    title: '',
    start: '',
    end: '',
    allDay: false,
    backgroundColor: '#4f46e5',
    location: '',
    description: ''
  });
  const router = useRouter();

  const handleDayClick = (
    newValue: Dayjs | null
  ) => {
    if (!newValue) return;
    const newSelectedDay = newValue.startOf('day');
    setSelectedDay(newSelectedDay);
    const clickedDateStr = newValue.format('YYYY-MM-DDTHH:mm');
    setNewEvent(prev => ({
        ...prev,
        start: clickedDateStr,
        end: newValue.add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
        allDay: true
    }));
    setIsAddEventModalOpen(true);
  };

  const handleAddEvent = () => {
    if (!newEvent.start || !newEvent.title) return;
    const newEventDate = dayjs(newEvent.start).startOf('day').toDate();
    setEventDates([...eventDates, newEventDate]);
    setIsAddEventModalOpen(false);
    setNewEvent({
      title: '',
      start: '',
      end: '',
      allDay: false,
      backgroundColor: '#4f46e5',
      location: '',
      description: ''
    });
  };

  const handleDeleteEvent = () => {
    if (!selectedEventDetails || !selectedEventDetails.start) return;
    const eventToDeleteDate = dayjs(selectedEventDetails.start).startOf('day').toDate();
    setEventDates(eventDates.filter(date => !dayjs(date).isSame(eventToDeleteDate, 'day')));
    setIsModalOpen(false);
    setSelectedEventDetails(null);
  };

  const handleEditEvent = () => {
    if (!selectedEventDetails) return;
    console.log("Edit event (not implemented for DayPicker yet):", selectedEventDetails);
    setIsModalOpen(false);
  };
  
  const handleGoToToday = () => {
    const today = dayjs();
    setSelectedDay(today.startOf('day'));
    const todayStr = dayjs(today).format('YYYY-MM-DDTHH:mm');
    setNewEvent(prev => ({
        ...prev,
        start: todayStr,
        end: dayjs(today).add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
        allDay: false
    }));
  };

  // 커스텀 Day 컴포넌트 정의 (주말 스타일링)
  function CustomDay(props: PickersDayProps) {
    const { day, outsideCurrentMonth, ...other } = props;
    
    const isSaturday = day.day() === 6; // 토요일 (0: 일요일, 6: 토요일)
    const isSunday = day.day() === 0; // 일요일
  
    const sxProps: any = { // sx prop을 위한 객체
      fontSize: '1.1rem', // 날짜 숫자 폰트 크기 키움
      // margin: '0.3rem', // 사용자 설정값, 컨테이너 gap으로 대체 예정이므로 주석 처리
    };

    if (!outsideCurrentMonth) { // 현재 월의 날짜에만 스타일 적용
      if (isSaturday) {
        sxProps.color = 'blue'; // 토요일 색상
      } else if (isSunday) {
        sxProps.color = 'red'; // 일요일 색상
      }
    }
  
    return (
      <PickersDay {...other} day={day} outsideCurrentMonth={outsideCurrentMonth} sx={sxProps} />
    );
  }

  return (
    <PageContainer 
      title="일정 관리" 
      description="일정을 생성하고 관리하세요"
      showHeader={false}
      showBackButton={false}
      className="bg-gray-50"
    >
      <Card className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center font-['Line_Seed']">
        <div className="w-full p-2">
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ko">
            <DateCalendar 
              value={selectedDay} 
              onChange={handleDayClick}
              slots={{ 
                day: CustomDay, 
                calendarHeader: (headerProps) => (
                  <CustomCalendarHeader 
                    {...headerProps} 
                    onGoToToday={handleGoToToday}
                  />
                )
              }}
              sx={{
                '& .MuiDayCalendar-weekDayLabel': {
                  fontSize: '0.9rem',
                  textTransform: 'none',
                  margin: '0 0.5rem',
                },
                '& .MuiDayCalendar-monthContainer': {
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                },
                '& .MuiDayCalendar-weekContainer': {
                  display: 'flex',
                  gap: '0.4rem',
                },
              }}
            />
          </LocalizationProvider>
        </div>
      </Card>

      {isModalOpen && selectedEventDetails && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <Card className="max-w-lg w-full" title={selectedEventDetails.title || '일정 상세'}>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">일시</h4>
                <p className="mt-1">
                  {selectedEventDetails.allDay
                    ? dayjs(selectedEventDetails.start).format('YYYY년 MM월 DD일') + ' (종일)'
                    : dayjs(selectedEventDetails.start).format('YYYY년 MM월 DD일 HH:mm') +
                      (selectedEventDetails.end ? ' ~ ' + dayjs(selectedEventDetails.end).format('HH:mm') : '')}
                </p>
              </div>

              {selectedEventDetails.extendedProps?.location && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500">장소</h4>
                  <p className="mt-1">{selectedEventDetails.extendedProps.location}</p>
                </div>
              )}

              {selectedEventDetails.extendedProps?.description && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500">설명</h4>
                  <p className="mt-1">{selectedEventDetails.extendedProps.description}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                닫기
              </Button>
              <Button variant="primary" onClick={handleEditEvent}>
                수정
              </Button>
              <Button variant="danger" onClick={handleDeleteEvent}>
                삭제
              </Button>
            </div>
          </Card>
        </div>
      )}

      {isAddEventModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-medium text-gray-900 font-suite">새 일정 추가</h3>
              <button
                onClick={() => setIsAddEventModalOpen(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form className="mt-4 space-y-4">
              <div>
                <label htmlFor="event-title" className="block text-sm font-medium text-gray-700">제목</label>
                <input
                  type="text"
                  id="event-title"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="event-start" className="block text-sm font-medium text-gray-700">시작 시간</label>
                  <input
                    type="datetime-local"
                    id="event-start"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                    value={newEvent.start}
                    onChange={(e) => setNewEvent({ ...newEvent, start: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="event-end" className="block text-sm font-medium text-gray-700">종료 시간</label>
                  <input
                    type="datetime-local"
                    id="event-end"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                    value={newEvent.end}
                    onChange={(e) => setNewEvent({ ...newEvent, end: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="event-allday"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  checked={newEvent.allDay}
                  onChange={(e) => setNewEvent({ ...newEvent, allDay: e.target.checked })}
                />
                <label htmlFor="event-allday" className="ml-2 block text-sm text-gray-700">하루 종일</label>
              </div>

              <div>
                <label htmlFor="event-location" className="block text-sm font-medium text-gray-700">위치</label>
                <input
                  type="text"
                  id="event-location"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="event-description" className="block text-sm font-medium text-gray-700">설명</label>
                <textarea
                  id="event-description"
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                ></textarea>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddEventModalOpen(false)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleAddEvent}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  disabled={!newEvent.title || !newEvent.start}
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  );
} 