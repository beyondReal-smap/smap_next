'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import koLocale from '@fullcalendar/core/locales/ko';
import axios from 'axios';
import { PageContainer, Card, Button } from '../components/layout';

// 모의 데이터 (실제 구현 시에는 API에서 가져옵니다)
const MOCK_EVENTS = [
  {
    id: '1',
    title: '미팅',
    start: dayjs().add(1, 'day').hour(10).minute(0).second(0).format('YYYY-MM-DD HH:mm:ss'),
    end: dayjs().add(1, 'day').hour(12).minute(0).second(0).format('YYYY-MM-DD HH:mm:ss'),
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
    textColor: '#ffffff',
    allDay: false,
    extendedProps: {
      location: '강남구 역삼동',
      description: '프로젝트 개발 회의',
      participants: ['김철수', '이영희']
    }
  },
  {
    id: '2',
    title: '프로젝트 데드라인',
    start: dayjs().add(3, 'day').format('YYYY-MM-DD'),
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
    textColor: '#ffffff',
    allDay: true,
    extendedProps: {
      description: '최종 결과물 제출'
    }
  },
  {
    id: '3',
    title: '팀 회식',
    start: dayjs().add(5, 'day').hour(19).minute(0).second(0).format('YYYY-MM-DD HH:mm:ss'),
    end: dayjs().add(5, 'day').hour(22).minute(0).second(0).format('YYYY-MM-DD HH:mm:ss'),
    backgroundColor: '#10b981',
    borderColor: '#10b981',
    textColor: '#ffffff',
    allDay: false,
    extendedProps: {
      location: '서울 강남구 소재 식당',
      description: '월간 프로젝트 완료 기념 회식'
    }
  }
];

export default function SchedulePage() {
  const [events, setEvents] = useState(MOCK_EVENTS);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    start: '',
    end: '',
    allDay: false,
    backgroundColor: '#4f46e5',
    location: '',
    description: ''
  });
  const router = useRouter();

  // 실제 구현 시에는 API에서 일정 데이터를 가져옵니다
  useEffect(() => {
    // 예시: 실제 API 호출
    /*
    const fetchEvents = async () => {
      try {
        const response = await axios.get('/api/schedule');
        if (response.data.success) {
          setEvents(response.data.events);
        }
      } catch (error) {
        console.error('일정을 불러오는 중 오류가 발생했습니다.', error);
      }
    };

    fetchEvents();
    */
  }, []);

  // 이벤트 클릭 시 상세 정보 표시
  const handleEventClick = (clickInfo: any) => {
    setSelectedEvent(clickInfo.event);
    setIsModalOpen(true);
  };

  // 날짜 클릭 시 이벤트 추가 모달
  const handleDateClick = (info: any) => {
    const clickedDate = dayjs(info.date);
    
    setNewEvent({
      ...newEvent,
      start: clickedDate.format('YYYY-MM-DDTHH:mm'),
      end: clickedDate.add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
      allDay: info.allDay
    });
    
    setIsAddEventModalOpen(true);
  };

  // 새 이벤트 추가
  const handleAddEvent = () => {
    const eventToAdd = {
      id: String(events.length + 1),
      title: newEvent.title,
      start: newEvent.start,
      end: newEvent.end,
      backgroundColor: newEvent.backgroundColor,
      borderColor: newEvent.backgroundColor,
      textColor: '#ffffff',
      allDay: newEvent.allDay,
      extendedProps: {
        location: newEvent.location,
        description: newEvent.description
      }
    };

    // 실제 구현 시에는 API에 저장합니다
    /*
    axios.post('/api/schedule', eventToAdd)
      .then(response => {
        if (response.data.success) {
          setEvents([...events, eventToAdd]);
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
        }
      })
      .catch(error => {
        console.error('일정 추가 중 오류가 발생했습니다.', error);
      });
    */
    
    // 모의 데이터 저장 (API 연동 전 테스트용)
    setEvents([...events, eventToAdd]);
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

  // 이벤트 삭제
  const handleDeleteEvent = () => {
    if (!selectedEvent) return;
    
    // 실제 구현 시에는 API에서 삭제합니다
    /*
    axios.delete(`/api/schedule/${selectedEvent.id}`)
      .then(response => {
        if (response.data.success) {
          setEvents(events.filter(event => event.id !== selectedEvent.id));
          setIsModalOpen(false);
          setSelectedEvent(null);
        }
      })
      .catch(error => {
        console.error('일정 삭제 중 오류가 발생했습니다.', error);
      });
    */
    
    // 모의 데이터 삭제 (API 연동 전 테스트용)
    setEvents(events.filter(event => event.id !== selectedEvent.id));
    setIsModalOpen(false);
    setSelectedEvent(null);
  };

  // 이벤트 수정 페이지로 이동
  const handleEditEvent = () => {
    if (!selectedEvent) return;
    router.push(`/schedule/edit/${selectedEvent.id}`);
  };

  // 추가 버튼 렌더링
  const AddEventButton = (
    <Button
      onClick={() => setIsAddEventModalOpen(true)}
      icon={
        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
      }
    >
      새 일정
    </Button>
  );

  return (
    <PageContainer 
      title="일정 관리" 
      description="일정을 생성하고 관리하세요"
      actions={AddEventButton}
    >
      <Card noPadding>
        <div className="h-[calc(100vh-280px)] w-full">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay'
            }}
            events={events}
            eventClick={handleEventClick}
            dateClick={handleDateClick}
            editable={true}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={true}
            weekends={true}
            locale={koLocale}
            allDayText="종일"
            buttonText={{
              today: '오늘',
              month: '월',
              week: '주',
              day: '일',
              list: '목록'
            }}
          />
        </div>
      </Card>

      {/* 이벤트 상세 정보 모달 */}
      {isModalOpen && selectedEvent && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <Card className="max-w-lg w-full" title={selectedEvent.title}>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">일시</h4>
                <p className="mt-1">
                  {selectedEvent.allDay 
                    ? dayjs(selectedEvent.start).format('YYYY년 MM월 DD일') + ' (종일)'
                    : dayjs(selectedEvent.start).format('YYYY년 MM월 DD일 HH:mm') + ' ~ ' + 
                      (selectedEvent.end ? dayjs(selectedEvent.end).format('HH:mm') : '')
                  }
                </p>
              </div>
              
              {selectedEvent.extendedProps.location && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500">장소</h4>
                  <p className="mt-1">{selectedEvent.extendedProps.location}</p>
                </div>
              )}
              
              {selectedEvent.extendedProps.description && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500">설명</h4>
                  <p className="mt-1">{selectedEvent.extendedProps.description}</p>
                </div>
              )}
              
              {selectedEvent.extendedProps.participants && selectedEvent.extendedProps.participants.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500">참석자</h4>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {selectedEvent.extendedProps.participants.map((participant: string, index: number) => (
                      <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {participant}
                      </span>
                    ))}
                  </div>
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

      {/* 새 이벤트 추가 모달 */}
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
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={newEvent.end}
                    onChange={(e) => setNewEvent({...newEvent, end: e.target.value})}
                    required
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
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({...newEvent, location: e.target.value})}
                />
              </div>

              <div>
                <label htmlFor="event-description" className="block text-sm font-medium text-gray-700">설명</label>
                <textarea
                  id="event-description"
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                ></textarea>
              </div>

              <div>
                <label htmlFor="event-color" className="block text-sm font-medium text-gray-700">색상</label>
                <div className="mt-1 flex space-x-2">
                  {['#4f46e5', '#ef4444', '#10b981', '#f59e0b', '#6366f1'].map((color) => (
                    <div 
                      key={color}
                      className={`h-8 w-8 rounded-full cursor-pointer ${newEvent.backgroundColor === color ? 'ring-2 ring-offset-2 ring-gray-500' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewEvent({...newEvent, backgroundColor: color})}
                    ></div>
                  ))}
                </div>
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