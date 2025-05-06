'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer, Card, Button } from '../../components/layout';
import { FaPencil, FaClock, FaArrowsRotate, FaBell, FaMapPin, FaBriefcase, FaFileLines, FaCalendarDays } from 'react-icons/fa6';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ko } from 'date-fns/locale';
import dayjs from 'dayjs';

// 한국어 로케일 등록
registerLocale('ko', ko);

// 요일 정의 (표시용 및 내부 관리용)
const WEEKDAYS = [
  { short: '일', long: '일요일', index: 0 },
  { short: '월', long: '월요일', index: 1 },
  { short: '화', long: '화요일', index: 2 },
  { short: '수', long: '수요일', index: 3 },
  { short: '목', long: '목요일', index: 4 },
  { short: '금', long: '금요일', index: 5 },
  { short: '토', long: '토요일', index: 6 },
];

// 요일별 색상 클래스 정의 (선택 시 오버라이드용)
const weekdaySelectedOverrideClasses = [
  '!bg-red-500 !hover:bg-red-600 !focus:ring-red-300',        // 일
  '!bg-orange-500 !hover:bg-orange-600 !focus:ring-orange-300', // 월
  '!bg-yellow-500 !hover:bg-yellow-600 !focus:ring-yellow-400', // 화
  '!bg-green-500 !hover:bg-green-600 !focus:ring-green-300',     // 수
  '!bg-blue-500 !hover:bg-blue-600 !focus:ring-blue-300',       // 목
  '!bg-indigo-500 !hover:bg-indigo-600 !focus:ring-indigo-300',    // 금
  '!bg-violet-500 !hover:bg-violet-600 !focus:ring-violet-300'   // 토
];

// 폼 데이터 타입 정의
interface ScheduleForm {
  title: string;
  startDate: string; // 시작 날짜
  startTime: string; // 시작 시간
  endDate: string; // 종료 날짜
  endTime: string; // 종료 시간
  allDay: boolean; // 하루 종일 여부
  repeat: string; // 반복 설정 (일단 문자열로)
  alarm: string; // 알림 설정 (일단 문자열로)
  location: string;
  supplies: string; // 준비물 추가
  description: string; // 메모 (기존 description 재활용)
  attendees: string[]; // 예시: 참석자 ID 배열
}

export default function AddSchedulePage() {
  const router = useRouter();
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>({
    title: '',
    startDate: dayjs().format('YYYY-MM-DD'),
    startTime: dayjs().format('HH:mm'), // 현재 시간으로 초기화
    endDate: dayjs().format('YYYY-MM-DD'),
    endTime: dayjs().add(1, 'hour').format('HH:mm'), // 현재 시간 + 1시간으로 초기화
    allDay: false,
    repeat: '안함', // 기본값
    alarm: '없음', // 기본값
    location: '',
    supplies: '',
    description: '',
    attendees: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isRepeatModalOpen, setIsRepeatModalOpen] = useState(false); // 반복 설정 모달 상태 추가

  // --- 모달 내부 설정용 상태 ---
  const [modalRepeatType, setModalRepeatType] = useState('안함');
  const [modalSelectedWeekdays, setModalSelectedWeekdays] = useState<Set<number>>(new Set());
  // --- 모달 상태 끝 ---

  // 모달 상태에 따라 body 스크롤 제어
  useEffect(() => {
    const body = document.body;
    if (isRepeatModalOpen) {
      body.style.overflow = 'hidden'; // 모달 열리면 스크롤 막기
    } else {
      body.style.overflow = 'auto'; // 모달 닫히면 스크롤 허용
    }

    // 컴포넌트 언마운트 시 스크롤 복원 (필수)
    return () => {
      body.style.overflow = 'auto';
    };
  }, [isRepeatModalOpen]); // isRepeatModalOpen 상태 변경 시 실행

  // 입력 변경 핸들러 (글자 수 제한 수정)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setScheduleForm(prev => ({ ...prev, [name]: checked }));
    } else {
      let maxLength = -1; 
      if ('maxLength' in e.target) {
        maxLength = (e.target as HTMLInputElement | HTMLTextAreaElement).maxLength;
      }

      // maxLength 속성이 있고, 값이 0보다 크며, 입력값이 maxLength를 초과하는 경우
      if (maxLength > 0 && value.length > maxLength) {
        return; // 최대 글자 수 초과 시 입력 방지
      }
      setScheduleForm(prev => ({ ...prev, [name]: value }));
    }
  };
  
  // 하루 종일 토글 핸들러
  const handleAllDayToggle = () => {
    setScheduleForm(prev => ({
      ...prev,
      allDay: !prev.allDay,
      // 하루 종일 선택 시 시간 초기화 (선택적)
      startTime: prev.allDay ? prev.startTime : '',
      endTime: prev.allDay ? prev.endTime : '',
    }));
  };

  // DatePicker 변경 핸들러
  const handleDateChange = (date: Date | null, name: 'startDate' | 'endDate') => {
    if (date) {
      setScheduleForm(prev => ({
        ...prev,
        [name]: dayjs(date).format('YYYY-MM-DD'), // Date 객체를 'YYYY-MM-DD' 문자열로 변환하여 저장
      }));
    }
  };

  // DatePicker (시간) 변경 핸들러
  const handleTimeChange = (date: Date | null, name: 'startTime' | 'endTime') => {
    if (date) {
      setScheduleForm(prev => ({
        ...prev,
        [name]: dayjs(date).format('HH:mm'), // Date 객체에서 'HH:mm' 문자열만 추출하여 저장
      }));
    }
  };

  // 반복 설정 모달 열기 핸들러
  const handleOpenRepeatModal = () => {
    const currentRepeat = scheduleForm.repeat;
    const basicOptions = ['안함', '매일', '매주', '매월', '매년'];
    let initialType = '안함';
    let initialDays = new Set<number>();

    if (basicOptions.includes(currentRepeat)) {
      initialType = currentRepeat;
    } else if (currentRepeat.startsWith('매주')) {
      initialType = '매주';
      const matches = currentRepeat.match(/\((.*?)\)/);
      if (matches && matches[1]) {
        const dayShortNames = matches[1].split(', ');
        dayShortNames.forEach(shortName => {
          const day = WEEKDAYS.find(d => d.short === shortName);
          if (day) initialDays.add(day.index);
        });
      }
    }
    // TODO: 다른 사용자 정의 형식 파싱

    setModalRepeatType(initialType);
    setModalSelectedWeekdays(initialDays);
    setIsRepeatModalOpen(true);
  };

  // 반복 설정 모달 닫기 핸들러
  const handleCloseRepeatModal = () => {
    setIsRepeatModalOpen(false);
  };

  // 모달: 반복 유형 변경 핸들러
  const handleModalRepeatTypeChange = (type: string) => {
    setModalRepeatType(type);
    if (type !== '매주') {
      setModalSelectedWeekdays(new Set());
    }
  };

  // 모달: 요일 선택 토글 핸들러
  const handleModalWeekdayToggle = (dayIndex: number) => {
    setModalSelectedWeekdays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dayIndex)) {
        newSet.delete(dayIndex);
      } else {
        newSet.add(dayIndex);
      }
      return newSet;
    });
  };

  // 모달: 설정 저장 핸들러
  const handleConfirmRepeatSettings = () => {
    let finalRepeatString = modalRepeatType;
    if (modalRepeatType === '매주' && modalSelectedWeekdays.size > 0) {
      const sortedDays = Array.from(modalSelectedWeekdays).sort();
      const dayShortNames = sortedDays.map(index => WEEKDAYS[index].short);
      finalRepeatString = `매주 (${dayShortNames.join(', ')})`;
    } else if (modalRepeatType === '매주' && modalSelectedWeekdays.size === 0) {
      finalRepeatString = '매주'; // 요일 선택 안하면 그냥 '매주'로 저장
    }

    setScheduleForm(prev => ({ ...prev, repeat: finalRepeatString }));
    handleCloseRepeatModal();
  };

  // 저장 핸들러 (실제 저장 로직 추가 필요)
  const handleSaveSchedule = async () => {
    setIsSaving(true);
    console.log('저장할 일정 데이터:', scheduleForm);
    // TODO: API 호출 또는 상태 관리 라이브러리를 사용하여 일정 저장 로직 구현
    await new Promise(resolve => setTimeout(resolve, 1000)); // 임시 지연
    setIsSaving(false);
    router.push('/schedule');
  };

  // 취소 핸들러
  const handleCancel = () => {
    router.back();
  };

  return (
    <PageContainer 
      title="" 
      description="" 
      showHeader={false} 
      showBackButton={false} 
      showTitle={false} 
      className="h-full flex flex-col" // 부모 높이(AppLayout의 mainContentWrapper)를 채우고, 내부 div가 flex 아이템으로 동작하도록 변경
    >
      {/* Card 대신 직접 스타일링 */}
      {/* 좌우 패딩을 줄여 카드 너비 확보 (py-4 px-2) */}
      <div className="flex-grow space-y-6 overflow-y-auto py-4 px-2"> 
        {/* 폼 시작 */}
        <form onSubmit={(e) => { e.preventDefault(); handleSaveSchedule(); }} className="space-y-6">
          
          {/* 일정 내용 (제목) 카드 */}
          <div className="bg-white rounded-lg shadow-lg p-5 border-t-4 border-indigo-200"> 
            {/* 카드 제목 및 아이콘 추가 */}
            <div className="flex items-center mb-4">
              <FaPencil className="w-6 h-6 text-blue-500 mr-3 flex-shrink-0" /> 
              <h3 className="text-lg font-semibold text-gray-800">일정 내용</h3>
            </div>
            {/* 내용 영역 - 구분선 및 패딩 추가 */} 
            <div className="border-t border-gray-100 pt-4">
              <label htmlFor="title" className="sr-only">일정 내용</label> 
              <input
                type="text"
                name="title"
                id="title"
                value={scheduleForm.title}
                onChange={handleInputChange}
                required
                maxLength={30}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border placeholder-gray-400 placeholder:text-xs"
                placeholder="일정 내용을 입력해주세요."
              />
              <p className="text-xs text-gray-500 mt-1">예) 학원, 학교, 친구, 병원 예약</p>
              <p className="text-xs text-gray-500 text-right mt-1">({scheduleForm.title.length}/30)</p>
            </div>
          </div>

          {/* 날짜 및 시간 카드 */} 
          <div className="bg-white rounded-lg shadow-lg p-5 space-y-4 border-t-4 border-indigo-200">
            {/* 카드 제목 및 아이콘 추가 */}
            <div className="flex items-center mb-4"> 
              <FaClock className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" /> {/* 아이콘 및 색상 조정 */} 
              <h3 className="text-lg font-semibold text-gray-800">날짜 및 시간</h3>
            </div>

            {/* 하루 종일 토글 */}
            <div className="flex justify-between items-center border-t border-gray-100 pt-4"> {/* 구분선 및 패딩 추가 */} 
              <label htmlFor="allDay" className="text-sm font-medium text-gray-700">하루 종일</label>
              <button
                type="button"
                onClick={handleAllDayToggle}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${scheduleForm.allDay ? 'bg-indigo-600' : 'bg-gray-200'}`}
                role="switch"
                aria-checked={scheduleForm.allDay}
              >
                <span className="sr-only">하루 종일</span>
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${scheduleForm.allDay ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
              <input type="checkbox" name="allDay" id="allDay" checked={scheduleForm.allDay} onChange={() => {}} className="sr-only" /> 
            </div>

            {/* 날짜 및 시간 선택 영역 (구조 변경) */}
            <div className="flex items-start justify-between space-x-2"> {/* items-start 추가 */} 
              {/* 시작 섹션 */} 
              <div className="flex-1 space-y-2"> 
                {/* 시작 날짜 */} 
                <div className="flex items-center p-2 rounded-md border border-gray-300">
                  <FaCalendarDays className="w-4 h-4 text-gray-500 mr-2 flex-shrink-0" />
                  <DatePicker
                    selected={scheduleForm.startDate ? dayjs(scheduleForm.startDate).toDate() : null}
                    onChange={(date) => handleDateChange(date, 'startDate')}
                    dateFormat="yyyy-MM-dd"
                    locale={ko}
                    className="block w-full border-none p-0 text-left text-sm font-medium focus:ring-0 bg-transparent cursor-pointer" // text-left 변경
                    wrapperClassName="flex-grow" // w-full 대신 flex-grow
                  />
                </div>
                {/* 시작 시간 */} 
                {!scheduleForm.allDay && (
                  <div className="flex items-center p-2 rounded-md border border-gray-300">
                    <FaClock className="w-4 h-4 text-gray-500 mr-2 flex-shrink-0" />
                    <DatePicker
                      selected={scheduleForm.startTime ? dayjs(`1970-01-01T${scheduleForm.startTime}:00`).toDate() : null}
                      onChange={(date) => handleTimeChange(date, 'startTime')}
                      showTimeSelect
                      showTimeSelectOnly
                      timeIntervals={5}
                      timeCaption="시간"
                      timeFormat="HH:mm"
                      dateFormat="HH:mm"
                      locale={ko}
                      className="block w-full border-none p-0 text-left text-sm text-gray-600 focus:ring-0 bg-transparent cursor-pointer" // text-left 변경
                      wrapperClassName="flex-grow" // w-full mt-1 대신 flex-grow
                    />
                  </div>
                )}
              </div>
              
              {/* 화살표 아이콘 (가운데 정렬 유지 위해 pt 추가 고려) */}
              <span className="text-gray-400 pt-2">→</span> 
              
              {/* 종료 섹션 */} 
              <div className="flex-1 space-y-2"> 
                {/* 종료 날짜 */} 
                <div className="flex items-center p-2 rounded-md border border-gray-300">
                  <FaCalendarDays className="w-4 h-4 text-gray-500 mr-2 flex-shrink-0" />
                  <DatePicker
                    selected={scheduleForm.endDate ? dayjs(scheduleForm.endDate).toDate() : null}
                    onChange={(date) => handleDateChange(date, 'endDate')}
                    dateFormat="yyyy-MM-dd"
                    locale={ko}
                    className="block w-full border-none p-0 text-left text-sm font-medium focus:ring-0 bg-transparent cursor-pointer" // text-left 변경
                    wrapperClassName="flex-grow" // w-full 대신 flex-grow
                  />
                </div>
                 {/* 종료 시간 */} 
                 {!scheduleForm.allDay && (
                  <div className="flex items-center p-2 rounded-md border border-gray-300">
                    <FaClock className="w-4 h-4 text-gray-500 mr-2 flex-shrink-0" />
                    <DatePicker
                      selected={scheduleForm.endTime ? dayjs(`1970-01-01T${scheduleForm.endTime}:00`).toDate() : null}
                      onChange={(date) => handleTimeChange(date, 'endTime')}
                      showTimeSelect
                      showTimeSelectOnly
                      timeIntervals={5}
                      timeCaption="시간"
                      timeFormat="HH:mm"
                      dateFormat="HH:mm"
                      locale={ko}
                      className="block w-full border-none p-0 text-left text-sm text-gray-600 focus:ring-0 bg-transparent cursor-pointer" // text-left 변경
                      wrapperClassName="flex-grow" // w-full mt-1 대신 flex-grow
                    />
                  </div>
                 )}
              </div>
            </div>

            {/* 반복 설정 (버튼 + 모달 트리거로 변경) */}
            <div className="flex items-center justify-between text-sm text-gray-700 pt-4 border-t border-gray-100 mt-4">
              <div className="flex items-center">
                <FaArrowsRotate className="w-5 h-5 text-teal-500 mr-2 flex-shrink-0" />
                <span className="font-medium">반복</span>
              </div>
              <button 
                type="button" 
                onClick={handleOpenRepeatModal} // 모달 열기 핸들러 연결
                className="text-indigo-600 hover:underline flex items-center cursor-pointer"
              >
                <span>{scheduleForm.repeat}</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* 알림 카드 */} 
          <div className="bg-white rounded-lg shadow-lg p-5 border-t-4 border-indigo-200">
            {/* 카드 제목 및 아이콘 추가 */} 
            <div className="flex items-center mb-4">
              <FaBell className="w-6 h-6 text-amber-500 mr-3 flex-shrink-0" /> 
              <h3 className="text-lg font-semibold text-gray-800">알림</h3>
            </div>
            {/* 내용 영역 - 구분선 및 패딩 추가 */} 
            <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
              <div> {/* 설명 텍스트 */} 
                <p className="text-sm text-gray-600">알림 설정을 선택해주세요.</p> 
              </div>
              {/* 알림 설정 버튼 */} 
              <button type="button" className="text-sm text-indigo-600 hover:underline flex items-center">
                <span>{scheduleForm.alarm}</span> 
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* 장소 카드 */}
          <div className="bg-white rounded-lg shadow-lg p-5 border-t-4 border-indigo-200">
            {/* 카드 제목 및 아이콘 추가 */} 
            <div className="flex items-center mb-4">
              <FaMapPin className="w-6 h-6 text-red-500 mr-3 flex-shrink-0" /> 
              <h3 className="text-lg font-semibold text-gray-800">장소</h3>
            </div>
             {/* 내용 영역 - 구분선 및 패딩 추가 */} 
            <div className="border-t border-gray-100 pt-4">
              <label htmlFor="location" className="sr-only">장소</label>
              <input
                type="text"
                name="location"
                id="location"
                value={scheduleForm.location}
                onChange={handleInputChange}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border placeholder-gray-400 placeholder:text-xs"
                placeholder="일정이 진행될 장소를 입력해주세요."
              />
            </div>
          </div>

          {/* 준비물 카드 */} 
          <div className="bg-white rounded-lg shadow-lg p-5 border-t-4 border-indigo-200">
             {/* 카드 제목 및 아이콘 추가 */} 
            <div className="flex items-center mb-4">
              <FaBriefcase className="w-6 h-6 text-purple-500 mr-3 flex-shrink-0" /> 
              <h3 className="text-lg font-semibold text-gray-800">준비물</h3>
            </div>
            {/* 내용 영역 - 구분선 및 패딩 추가 */} 
            <div className="border-t border-gray-100 pt-4">
              <label htmlFor="supplies" className="sr-only">준비물</label>
              <input
                type="text"
                name="supplies"
                id="supplies"
                value={scheduleForm.supplies}
                onChange={handleInputChange}
                maxLength={100}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border placeholder-gray-400 placeholder:text-xs"
                placeholder="일정 진행에 필요한 준비물을 입력해주세요."
              />
              <p className="text-xs text-gray-500 text-right mt-1">({scheduleForm.supplies.length}/100)</p>
            </div>
          </div>
          
          {/* 메모 카드 */} 
          <div className="bg-white rounded-lg shadow-lg p-5 border-t-4 border-indigo-200">
            {/* 카드 제목 및 아이콘 추가 */} 
            <div className="flex items-center mb-4">
              <FaFileLines className="w-6 h-6 text-sky-500 mr-3 flex-shrink-0" /> 
              <h3 className="text-lg font-semibold text-gray-800">메모</h3>
            </div>
            {/* 내용 영역 - 구분선 및 패딩 추가 */} 
            <div className="border-t border-gray-100 pt-4">
              <label htmlFor="description" className="sr-only">메모</label>
              <textarea
                name="description"
                id="description"
                rows={4}
                maxLength={500}
                value={scheduleForm.description}
                onChange={handleInputChange}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border placeholder-gray-400 placeholder:text-xs"
                placeholder="일정에 대한 추가 정보나 메모를 작성해주세요."
              />
              <p className="text-xs text-gray-500 text-right mt-1">({scheduleForm.description.length}/500)</p>
            </div>
          </div>

          {/* 저장 및 취소 버튼 (카드 밖에 위치) */} 
          <div className="pt-5 flex justify-end space-x-3">
            <Button type="button" variant="secondary" onClick={handleCancel} disabled={isSaving}>
              취소
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving}>
              {isSaving ? '저장 중...' : '일정 저장'}
            </Button>
          </div>
        </form>
      </div>

      {/* 반복 설정 모달 */} 
      {isRepeatModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-start justify-center p-4 pt-20 z-50 transition-opacity duration-300 ease-in-out" onClick={handleCloseRepeatModal}> 
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-scaleIn" onClick={(e) => e.stopPropagation()}> 
             {/* 모달 헤더 */} 
            <div className="flex justify-between items-center mb-6"> {/* mb-6으로 간격 늘림 */} 
              <h3 className="text-xl font-semibold text-gray-900">반복 설정</h3> {/* 폰트 크기/굵기 조정 */} 
              <button 
                onClick={handleCloseRepeatModal}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* --- 반복 설정 UI --- */} 
            <div className="space-y-4">
              {/* 1. 반복 유형 선택 */} 
              <div className="space-y-3"> 
                <label className="block text-sm font-medium text-gray-700">반복 유형</label>
                <div className="p-3 bg-gray-50 rounded-lg space-y-2"> 
                  {/* 상단 4개 버튼 (그리드) */} 
                  <div className="grid grid-cols-4 gap-2">
                    {['매일', '매주', '매월', '매년'].map(option => (
                      <Button
                        key={option}
                        // variant prop 다시 사용
                        variant={modalRepeatType === option ? 'primary' : 'outline'} 
                        onClick={() => handleModalRepeatTypeChange(option)}
                        size="sm"
                        // className으로 필요한 스타일만 덮어쓰기
                        className={`justify-center ${ 
                          modalRepeatType === option 
                            ? '!bg-gray-900 !hover:bg-gray-800 !focus:ring-gray-500' // 선택 시 배경/hover/focus 색상 덮어쓰기
                            : '!text-gray-800' // 비선택 시 텍스트 색상 덮어쓰기
                        }`}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                  {/* 하단 '안함' 버튼 (가로 전체) */} 
                  <Button
                    key="안함"
                    // variant prop 다시 사용
                    variant={modalRepeatType === '안함' ? 'primary' : 'outline'} 
                    onClick={() => handleModalRepeatTypeChange('안함')}
                    size="sm"
                    // className으로 필요한 스타일만 덮어쓰기
                    className={`w-full justify-center ${ 
                      modalRepeatType === '안함' 
                        ? '!bg-gray-900 !hover:bg-gray-800 !focus:ring-gray-500' // 선택 시 배경/hover/focus 색상 덮어쓰기
                        : '!text-gray-800' // 비선택 시 텍스트 색상 덮어쓰기
                    }`}
                  >
                    안함
                  </Button>
                </div>
              </div>

              {/* 2. 요일 선택 (modalRepeatType === '매주' 일 때만 표시) */} 
              {modalRepeatType === '매주' && (
                <div className="space-y-3 border-t border-gray-200 pt-4">
                  <label className="block text-sm font-medium text-gray-700">반복 요일 <span className="text-xs text-gray-500">(요일 미선택 시 매주 반복)</span></label>
                  <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                    {/* 첫 줄: 일월화수 */}
                    <div className="flex justify-start gap-2">
                      {WEEKDAYS.slice(0, 4).map(day => {
                        const isSelected = modalSelectedWeekdays.has(day.index);
                        return (
                          <Button
                            key={day.index}
                            // variant prop 사용 복원
                            variant={isSelected ? 'primary' : 'outline'}
                            onClick={() => handleModalWeekdayToggle(day.index)}
                            size="sm"
                            // 공통 스타일 + 선택/비선택 시 필요한 오버라이드
                            className={`w-10 h-10 flex items-center justify-center p-0 rounded-full ${ 
                              isSelected 
                                ? weekdaySelectedOverrideClasses[day.index] // 선택 시 색상 오버라이드
                                : '!text-gray-800' // 비선택 시 텍스트 색상 오버라이드
                            }`}
                          >
                            {day.short}
                          </Button>
                        )
                      })}
                    </div>
                    {/* 둘째 줄: 목금토 */}
                    <div className="flex justify-start gap-2">
                      {WEEKDAYS.slice(4, 7).map(day => {
                        const isSelected = modalSelectedWeekdays.has(day.index);
                        return (
                          <Button
                            key={day.index}
                            // variant prop 사용 복원
                            variant={isSelected ? 'primary' : 'outline'}
                            onClick={() => handleModalWeekdayToggle(day.index)}
                            size="sm"
                            // 공통 스타일 + 선택/비선택 시 필요한 오버라이드
                            className={`w-10 h-10 flex items-center justify-center p-0 rounded-full ${ 
                              isSelected 
                                ? weekdaySelectedOverrideClasses[day.index] // 선택 시 색상 오버라이드
                                : '!text-gray-800' // 비선택 시 텍스트 색상 오버라이드
                            }`}
                          >
                            {day.short}
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

               {/* 3. 종료 조건 (추후 구현 영역) */} 
               <div className="space-y-3 border-t border-gray-200 pt-4">
                  <label className="block text-sm font-medium text-gray-700">종료 조건</label>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                     <p className="text-sm text-gray-400">종료 조건 설정 (구현 예정)</p>
                     {/* 예: '계속 반복', '종료 날짜 설정', '반복 횟수 설정' 옵션 */} 
                  </div>
               </div>

            </div>
            {/* --- 반복 설정 UI 끝 --- */} 

             {/* 모달 푸터: 취소/저장 버튼 */} 
             {/* 구분선 및 간격 조정 */} 
             <div className="mt-8 flex justify-end space-x-3 border-t border-gray-200 pt-5">
                <Button variant="secondary" onClick={handleCloseRepeatModal}>
                  취소
                </Button>
                <Button variant="primary" onClick={handleConfirmRepeatSettings}>
                  설정 저장
                </Button>
              </div>

          </div>
        </div>
      )}

    </PageContainer>
  );
} 