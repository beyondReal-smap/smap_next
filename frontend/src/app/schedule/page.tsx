'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { DayPicker, Modifiers } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import { ko, Locale } from 'date-fns/locale';
import { PageContainer, Card, Button } from '../components/layout';
import { FaPlus } from 'react-icons/fa6';
import { RiKakaoTalkFill } from 'react-icons/ri';
import { FiLink, FiChevronRight } from 'react-icons/fi';
import { MdOutlineMessage } from 'react-icons/md';

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

export default function SchedulePage() {
  const [eventDates, setEventDates] = useState<Date[]>(MOCK_EVENTS_DATES);
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());
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
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const router = useRouter();

  const handleDayClick = (
    day: Date | undefined,
    selectedDay: Date,
    modifiers: Modifiers,
    e: React.MouseEvent
  ) => {
    if (!day) return;

    setSelectedDay(day);
    const clickedDateStr = dayjs(day).format('YYYY-MM-DDTHH:mm');
    setNewEvent(prev => ({
        ...prev,
        start: clickedDateStr,
        end: dayjs(day).add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
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
  
  const weekendStyles = {
    saturday: { color: 'blue' },
    sunday: { color: 'red' },
  };

  const eventModifiers = {
    event: eventDates,
    saturday: (day: Date) => day.getDay() === 6,
    sunday: (day: Date) => day.getDay() === 0,
  };

  const eventModifiersStyles = {
    event: { position: 'relative' } as React.CSSProperties,
    ...weekendStyles,
  };

  const formatDay = (day: Date): string => format(day, 'd');
  const formatCaption = (date: Date, options?: { locale?: Locale }): string => format(date, 'yyyy.MM', { locale: options?.locale });
  const formatWeekdayName = (day: Date): string => format(day, 'EEE', { locale: ko });

  const AddEventButton = (
    <Button
      onClick={() => {
        const todayStr = dayjs().format('YYYY-MM-DDTHH:mm');
        setNewEvent({
            title: '',
            start: todayStr,
            end: dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
            allDay: false,
            backgroundColor: '#4f46e5',
            location: '',
            description: ''
        });
        setIsAddEventModalOpen(true);
      }}
      icon={<FaPlus className="h-5 w-5" />}
    >
      새 일정
    </Button>
  );

  const ShareButton = (
    <Button
      onClick={() => setIsShareModalOpen(true)}
      className="ml-2"
    >
      그룹원 초대
    </Button>
  );

  const handleGoToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDay(today);
    const todayStr = dayjs(today).format('YYYY-MM-DDTHH:mm');
    setNewEvent(prev => ({
        ...prev,
        start: todayStr,
        end: dayjs(today).add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
        allDay: false
    }));
  };
  
  const handleShareKakao = () => {
    console.log("Share via Kakao: Not yet implemented. URL: ", window.location.href);
    alert('카카오톡 공유 기능은 준비 중입니다.');
  };

  const handleCopyLink = () => {
    const urlToCopy = window.location.href; 
    navigator.clipboard.writeText(urlToCopy)
      .then(() => {
        alert('초대 링크가 복사되었습니다!');
        setIsShareModalOpen(false);
      })
      .catch(err => {
        console.error('Failed to copy link: ', err);
        alert('링크 복사에 실패했습니다.');
      });
  };

  const handleShareSms = () => {
    console.log("Share via SMS: Not yet implemented. URL: ", window.location.href);
    alert('문자 공유 기능은 준비 중입니다.');
  };

  return (
    <PageContainer 
      title="일정 관리" 
      description="일정을 생성하고 관리하세요"
      showHeader={false}
      showBackButton={false}
      actions={<div className="flex space-x-2">{AddEventButton}{ShareButton}</div>}
      className="bg-gray-50"
    >
      <Card className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center">
        <style>{`
          .day-with-event::after {
            content: "";
            position: absolute;
            bottom: 4px;
            left: 50%;
            transform: translateX(-50%);
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background-color: #f87171;
          }
          
          .rdp-day_outside .rdp-day_button { 
            color: #d1d5db; 
            pointer-events: none; 
          }
          .rdp-day_today .rdp-day_button { 
            position: relative; 
            overflow: visible; 
          }
          .rdp-day_today .rdp-day_button::after { 
            content: "Today";
            position: absolute;
            top: -10px; 
            left: 50%;
            transform: translateX(-50%);
            background-color: #3b82f6; 
            color: white;
            padding: 1px 4px;
            border-radius: 4px;
            font-size: 0.6rem; 
            line-height: 1;
            z-index: 1; 
          }
        `}</style>
        <div className="w-full flex justify-end mb-2 px-2 sm:px-3 md:px-4">
            <Button onClick={handleGoToToday} variant="outline" size="sm">
                오늘
            </Button>
        </div>
        <div className="w-full">
          <DayPicker
            mode="single"
            required
            selected={selectedDay}
            onSelect={handleDayClick}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            locale={ko}
            defaultMonth={currentMonth}
            modifiers={eventModifiers}
            modifiersClassNames={{ event: 'day-with-event' }}
            modifiersStyles={eventModifiersStyles}
            showOutsideDays
            formatters={{ formatDay, formatCaption, formatWeekdayName }}
          />
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
                      (selectedEventDetails.end ? ' ~ ' + dayjs(selectedEventDetails.end).format('HH:mm') : '')
                  }
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
                  onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
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
                    onChange={(e) => setNewEvent({...newEvent, start: e.target.value})}
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
                    onChange={(e) => setNewEvent({...newEvent, end: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="event-allday"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  checked={newEvent.allDay}
                  onChange={(e) => setNewEvent({...newEvent, allDay: e.target.checked})}
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
                  onChange={(e) => setNewEvent({...newEvent, location: e.target.value})}
                />
              </div>

              <div>
                <label htmlFor="event-description" className="block text-sm font-medium text-gray-700">설명</label>
                <textarea
                  id="event-description"
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
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

      {isShareModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900 font-suite">어떻게 초대장을 보낼까요?</h3>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-2">
              <ul className="space-y-1">
                <li>
                  <button
                    onClick={handleShareKakao}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-100 rounded-md text-left"
                  >
                    <div className="flex items-center">
                      <RiKakaoTalkFill className="h-7 w-7 mr-3 text-[#3C1E1E] bg-[#FEE500] rounded-full p-0.5" />
                      <span className="text-sm font-medium text-gray-700">카카오톡으로 공유</span>
                    </div>
                    <FiChevronRight className="h-5 w-5 text-gray-400" />
                  </button>
                </li>
                <li>
                  <button
                    onClick={handleCopyLink}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-100 rounded-md text-left"
                  >
                    <div className="flex items-center">
                      <FiLink className="h-7 w-7 mr-3 text-white bg-gray-500 rounded-full p-1.5" />
                      <span className="text-sm font-medium text-gray-700">초대 링크 복사</span>
                    </div>
                    <FiChevronRight className="h-5 w-5 text-gray-400" />
                  </button>
                </li>
                <li>
                  <button
                    onClick={handleShareSms}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-100 rounded-md text-left"
                  >
                    <div className="flex items-center">
                      <MdOutlineMessage className="h-7 w-7 mr-3 text-white bg-green-500 rounded-full p-1.5" />
                      <span className="text-sm font-medium text-gray-700">문자/주소록으로 공유</span>
                    </div>
                    <FiChevronRight className="h-5 w-5 text-gray-400" />
                  </button>
                </li>
              </ul>
            </div>
            <div className="p-4 border-t text-right">
                <Button variant="outline" onClick={() => setIsShareModalOpen(false)}>
                  닫기
                </Button>
              </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
} 