'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer, Card, Button } from '../../components/layout';
import { FaPencil, FaClock, FaArrowsRotate, FaBell, FaMapPin, FaBriefcase, FaFileLines, FaCalendarDays } from 'react-icons/fa6';
import { FaSearch, FaExclamationTriangle } from 'react-icons/fa';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ko } from 'date-fns/locale';
import dayjs from 'dayjs';
import ReactDOM from 'react-dom';

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
  endDate: string; // 종료 일자
  endTime: string; // 종료 시간
  allDay: boolean; // 하루 종일 여부
  repeat: string; // 반복 설정 (일단 문자열로)
  alarm: string; // 알림 설정 (일단 문자열로)
  locationName: string; // 장소 이름 추가
  locationAddress: string; // 주소 추가
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
    locationName: '', // 초기값 추가
    locationAddress: '', // 초기값 추가
    supplies: '',
    description: '',
    attendees: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isRepeatModalOpen, setIsRepeatModalOpen] = useState(false); // 반복 설정 모달 상태 추가
  const [isAlarmModalOpen, setIsAlarmModalOpen] = useState(false); // 알림 모달 상태 추가

  // --- 모달 내부 설정용 상태 ---
  const [modalRepeatType, setModalRepeatType] = useState('안함');
  const [modalSelectedWeekdays, setModalSelectedWeekdays] = useState<Set<number>>(new Set());
  const [modalEndDate, setModalEndDate] = useState<Date | null>(null);
  const [modalAlarmSetting, setModalAlarmSetting] = useState('없음'); // 알림 모달 상태 추가
  // --- 모달 상태 끝 ---

  const [isLocationSearchModalOpen, setIsLocationSearchModalOpen] = useState(false); // 주소 검색 모달 상태
  const [locationSearchQuery, setLocationSearchQuery] = useState(''); // 주소 검색어 상태
  const [locationSearchResults, setLocationSearchResults] = useState<any[]>([]); // 주소 검색 결과 상태
  const [isSearchingLocation, setIsSearchingLocation] = useState(false); // 주소 검색 로딩 상태

  const [portalContainer, setPortalContainer] = useState<Element | null>(null);
  const [dateTimeError, setDateTimeError] = useState<string | null>(null);

  // Ref 생성
  const endDateRef = useRef<DatePicker>(null);
  const endTimeRef = useRef<DatePicker>(null);
  const startDateRef = useRef<DatePicker>(null);

  useEffect(() => {
    // 클라이언트 측에서만 document.body에 접근하여 portal 컨테이너 설정
    setPortalContainer(document.body);

    // body 스크롤 제어 (기존 로직 유지)
    const body = document.body;
    if (isRepeatModalOpen || isAlarmModalOpen || isLocationSearchModalOpen) {
      body.style.overflow = 'hidden';
    } else {
      body.style.overflow = 'auto';
    }
    // 컴포넌트 언마운트 시 또는 모달 상태 변경 시 overflow 복원
    return () => {
      body.style.overflow = 'auto';
    };
  }, [isRepeatModalOpen, isAlarmModalOpen, isLocationSearchModalOpen]); // isLocationSearchModalOpen 의존성 추가

  // 날짜/시간 유효성 검사 useEffect 수정 (포커스 로직 추가)
  useEffect(() => {
    let hasError = false; // 오류 발생 여부 추적

    // allDay일 경우 날짜만 비교
    if (scheduleForm.allDay) {
      if (scheduleForm.startDate && scheduleForm.endDate) {
        const start = dayjs(scheduleForm.startDate);
        const end = dayjs(scheduleForm.endDate);
        if (end.isBefore(start)) {
          setDateTimeError('종료일자는 시작일자보다 빠를 수 없습니다.');
          endDateRef.current?.setFocus(); // 종료일자 필드로 포커스 이동
          hasError = true;
        }
      }
    }
    // allDay가 아닐 경우 날짜와 시간 모두 비교
    else {
      if (
        scheduleForm.startDate &&
        scheduleForm.startTime &&
        scheduleForm.endDate &&
        scheduleForm.endTime
      ) {
        const startDateTime = dayjs(`${scheduleForm.startDate}T${scheduleForm.startTime}`);
        const endDateTime = dayjs(`${scheduleForm.endDate}T${scheduleForm.endTime}`);

        if (startDateTime.isValid() && endDateTime.isValid()) {
          if (endDateTime.isBefore(startDateTime)) {
            setDateTimeError('종료일시는 시작일시보다 빠를 수 없습니다.');
            // 종료 '일자'가 시작 '일자'보다 명확히 이전이면 종료일자 필드에 포커스
            if (dayjs(scheduleForm.endDate).isBefore(dayjs(scheduleForm.startDate))) {
              endDateRef.current?.setFocus();
            } else {
              // 날짜는 같거나 이후인데 시간이 문제면 종료시간 필드에 포커스
              endTimeRef.current?.setFocus();
            }
            hasError = true;
          }
        }
      }
    }

    // 이번 실행에서 오류가 감지되지 않았으면 에러 상태 초기화
    if (!hasError) {
      setDateTimeError(null);
    }

  }, [
    scheduleForm.startDate,
    scheduleForm.startTime,
    scheduleForm.endDate,
    scheduleForm.endTime,
    scheduleForm.allDay,
  ]);

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
      // 하루 종일 선택 시 시간 초기화 로직 제거
      // startTime: prev.allDay ? prev.startTime : '',
      // endTime: prev.allDay ? prev.endTime : '',
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

  // 반복 설정 모달 열기 핸들러 (종료 일자 초기화)
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
    // 종료 일자 초기화
    // TODO: 실제 구현 시 scheduleForm에서 종료 일자 정보 파싱 필요
    setModalEndDate(null);

    setIsRepeatModalOpen(true);
  };

  // 반복 설정 모달 닫기 핸들러
  const handleCloseRepeatModal = () => {
    setIsRepeatModalOpen(false);
  };

  // 모달: 반복 유형 변경
  const handleModalRepeatTypeChange = (type: string) => { 
    setModalRepeatType(type);
    if (type !== '매주') {
      setModalSelectedWeekdays(new Set());
    }
  }; 
  // 모달: 요일 선택 토글
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
  // 모달: 종료 일자 변경
  const handleModalEndDateChange = (date: Date | null) => {
    setModalEndDate(date);
  };

  // 모달: 설정 저장 핸들러 (종료 조건 로직 간소화)
  const handleConfirmRepeatSettings = () => {
    let finalRepeatString = modalRepeatType;
    if (modalRepeatType === '매주' && modalSelectedWeekdays.size > 0) { 
      const sortedDays = Array.from(modalSelectedWeekdays).sort();
      const dayShortNames = sortedDays.map(index => WEEKDAYS[index].short);
      finalRepeatString = `매주 (${dayShortNames.join(', ')})`;
    } else if (modalRepeatType === '매주' && modalSelectedWeekdays.size === 0) {
      finalRepeatString = '매주'; 
    }

    // 종료 조건 처리 (예시: 로그 출력)
    console.log('종료 일자:', modalEndDate ? dayjs(modalEndDate).format('YYYY-MM-DD') : '설정 안함 (계속 반복)');

    // TODO: 실제 저장 시에는 종료 일자 정보(modalEndDate)도 함께 저장해야 함.
    //       (예: scheduleForm 상태에 endDate 필드 추가 또는 repeat 문자열 포맷 확장)
    setScheduleForm(prev => ({ ...prev, repeat: finalRepeatString }));
    handleCloseRepeatModal();
  };

  // --- 알림 모달 핸들러들 --- 
  const handleOpenAlarmModal = () => {
    setModalAlarmSetting(scheduleForm.alarm); // 현재 설정값으로 초기화
    setIsAlarmModalOpen(true);
  };
  const handleCloseAlarmModal = () => {
    setIsAlarmModalOpen(false);
  };
  const handleModalAlarmChange = (alarmValue: string) => {
    setModalAlarmSetting(alarmValue);
  };
  const handleConfirmAlarmSettings = () => {
    setScheduleForm(prev => ({ ...prev, alarm: modalAlarmSetting }));
    handleCloseAlarmModal();
  };
  // --- 알림 모달 핸들러들 끝 --- 

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

  // 주소 검색 모달 열기 핸들러 수정 (문자열 변환 추가)
  const handleOpenLocationSearchModal = () => {
    const currentName = scheduleForm.locationName;
    setLocationSearchResults([]);

    // currentName이 문자열인지 확인하고 변환
    const currentNameString = String(currentName || ''); // null/undefined 시 빈 문자열로

    if (currentNameString.trim()) {
      setLocationSearchQuery(currentNameString);
      handleSearchLocation(currentNameString); // 문자열 버전 전달
    } else {
      setLocationSearchQuery('');
    }

    setIsLocationSearchModalOpen(true);
  };

  // 주소 검색 모달 닫기 핸들러
  const handleCloseLocationSearchModal = () => {
    setIsLocationSearchModalOpen(false);
  };

  // 주소 검색 실행 핸들러 수정 (문자열 변환 추가)
  const handleSearchLocation = async (query?: string) => {
    // query가 제공되면 사용, 아니면 상태 값 사용
    const searchQueryValue = query !== undefined ? query : locationSearchQuery;

    // 항상 문자열로 처리하도록 명시적 변환 추가
    const searchQueryString = String(searchQueryValue || ''); // null/undefined 시 빈 문자열로

    // 문자열로 변환된 값으로 trim() 및 API 호출
    if (!searchQueryString.trim()) return;

    setIsSearchingLocation(true);
    setLocationSearchResults([]);

    const KAKAO_API_KEY = 'bc7899314df5dc2bebcb2a7960ac89bf'; // 임시 API 키 (주의!)
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(searchQueryString)}`; // 변환된 문자열 사용

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
      console.error('주소 검색 중 오류 발생:', error);
      setLocationSearchResults([]);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  // 검색 결과 선택 핸들러
  const handleSelectLocation = (place: any) => {
    setScheduleForm(prev => ({
      ...prev,
      locationName: place.place_name || '', // 장소 이름 설정
      locationAddress: place.road_address_name || place.address_name || '', // 주소 설정
    }));
    handleCloseLocationSearchModal();
  };

  // 모달 렌더링 함수 (Portal 사용)
  const renderModal = (modalContent: React.ReactNode) => {
    if (!portalContainer) return null; // 컨테이너가 준비되지 않으면 렌더링하지 않음
    return ReactDOM.createPortal(modalContent, portalContainer);
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

            {/* 날짜 및 시간 선택 영역 (상하 배치로 변경) */}
            <div className="space-y-4"> {/* 기존 flex 컨테이너 제거하고 새로운 div 또는 space-y 사용 */}
              {/* 시작 섹션 */}
              <div className="space-y-2"> {/* mb-4 추가하여 아래 섹션과 간격 부여 */}
                <label className="block text-sm font-medium text-gray-500">시작</label>
                {/* 날짜와 시간을 좌우로 배치하기 위한 flex 컨테이너 */}
                <div className="flex items-center space-x-2"> 
                  {/* 시작 날짜 */}
                  <div className="flex-1 flex items-center p-2 rounded-md border border-gray-300"> {/* flex-1 추가 */} 
                    <FaCalendarDays className="w-4 h-4 text-gray-500 mr-2 flex-shrink-0" />
                    <DatePicker
                      ref={startDateRef}
                      selected={scheduleForm.startDate ? dayjs(scheduleForm.startDate).toDate() : null}
                      onChange={(date) => handleDateChange(date, 'startDate')}
                      dateFormat="yyyy-MM-dd"
                      locale={ko}
                      className="block w-full border-none p-0 text-left text-sm font-medium focus:ring-0 bg-transparent cursor-pointer"
                      wrapperClassName="flex-grow"
                      portalId="root-portal"
                      closeOnScroll={false}
                      calendarClassName="font-sans"
                    />
                  </div>
                  {/* 시작 시간 (flex-1 추가 및 조건부 렌더링) */} 
                  {!scheduleForm.allDay && (
                    <div className="flex-1 flex items-center p-2 rounded-md border border-gray-300"> {/* flex-1 추가 */} 
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
                        className="block w-full border-none p-0 text-left text-sm text-gray-600 focus:ring-0 bg-transparent cursor-pointer"
                        wrapperClassName="flex-grow"
                        portalId="root-portal"
                        closeOnScroll={false}
                        calendarClassName="font-sans"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 종료 섹션 */}
              <div className="space-y-2"> {/* mt-4 추가하여 위 섹션과 간격 부여 */}
                 <label className="block text-sm font-medium text-gray-500">종료</label>
                 {/* 날짜와 시간을 좌우로 배치하기 위한 flex 컨테이너 */}
                 <div className="flex items-center space-x-2">
                   {/* 종료 일자 */}
                   <div className="flex-1 flex items-center p-2 rounded-md border border-gray-300"> {/* flex-1 추가 */} 
                     <FaCalendarDays className="w-4 h-4 text-gray-500 mr-2 flex-shrink-0" />
                     <DatePicker
                       ref={endDateRef}
                       selected={scheduleForm.endDate ? dayjs(scheduleForm.endDate).toDate() : null}
                       onChange={(date) => handleDateChange(date, 'endDate')}
                       dateFormat="yyyy-MM-dd"
                       locale={ko}
                       className="block w-full border-none p-0 text-left text-sm font-medium focus:ring-0 bg-transparent cursor-pointer"
                       wrapperClassName="flex-grow"
                       portalId="root-portal"
                       closeOnScroll={false}
                       calendarClassName="font-sans"
                     />
                   </div>
                    {/* 종료 시간 (flex-1 추가 및 조건부 렌더링) */}
                    {!scheduleForm.allDay && (
                     <div className="flex-1 flex items-center p-2 rounded-md border border-gray-300"> {/* flex-1 추가 */} 
                       <FaClock className="w-4 h-4 text-gray-500 mr-2 flex-shrink-0" />
                       <DatePicker
                         ref={endTimeRef}
                         selected={scheduleForm.endTime ? dayjs(`1970-01-01T${scheduleForm.endTime}:00`).toDate() : null}
                         onChange={(date) => handleTimeChange(date, 'endTime')}
                         showTimeSelect
                         showTimeSelectOnly
                         timeIntervals={5}
                         timeCaption="시간"
                         timeFormat="HH:mm"
                         dateFormat="HH:mm"
                         locale={ko}
                         className="block w-full border-none p-0 text-left text-sm text-gray-600 focus:ring-0 bg-transparent cursor-pointer"
                         wrapperClassName="flex-grow"
                         portalId="root-portal"
                         closeOnScroll={false}
                         calendarClassName="font-sans"
                       />
                     </div>
                    )}
                 </div>
              </div>
            </div>

            {/* 오류 메시지 표시 영역 추가 */} 
            {dateTimeError && (
              <div className="mt-2 flex items-center text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                <FaExclamationTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>{dateTimeError}</span>
              </div>
            )}

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
              {/* 알림 설정 버튼 (모달 트리거로 변경) */} 
              <button 
                type="button" 
                onClick={handleOpenAlarmModal} // 모달 열기 핸들러 연결
                className="text-sm text-indigo-600 hover:underline flex items-center cursor-pointer"
              >
                <span>{scheduleForm.alarm}</span> 
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* 장소 카드 */}
          <div className="bg-white rounded-lg shadow-lg p-5 border-t-4 border-indigo-200">
            <div className="flex items-center mb-4">
              <FaMapPin className="w-6 h-6 text-red-500 mr-3 flex-shrink-0" /> 
              <h3 className="text-lg font-semibold text-gray-800">장소</h3>
              {/* 검색 버튼을 헤더 오른쪽으로 이동 */} 
              <Button
                type="button"
                variant="outline"
                onClick={handleOpenLocationSearchModal}
                className="ml-auto flex-shrink-0 !p-1.5" // size prop 대신 className 사용
                aria-label="주소 검색"
              >
                <FaSearch className="w-4 h-4" />
              </Button>
            </div>
            {/* 내용 영역 수정 */} 
            <div className="border-t border-gray-100 pt-4 space-y-3">
              {/* 장소 이름 입력 (편집 가능) */} 
              <div>
                <label htmlFor="locationName" className="sr-only">장소 이름</label>
                <input
                  type="text"
                  name="locationName"
                  id="locationName"
                  value={scheduleForm.locationName}
                  onChange={handleInputChange}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border placeholder-gray-400 placeholder:text-xs"
                  placeholder="장소 이름 (예: 스타벅스 강남점)"
                />

              </div>
              {/* 주소 표시 (읽기 전용) */} 
              {scheduleForm.locationAddress && ( // 주소가 있을 때만 표시
                <div className="p-2 bg-gray-50 rounded-md text-sm text-gray-700 border border-gray-200">
                  {scheduleForm.locationAddress}
                </div>
              )}
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

      {/* 반복 설정 모달 (Portal 사용) */} 
      {isRepeatModalOpen && renderModal(
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out" onClick={handleCloseRepeatModal}> 
           {/* 모달 컨텐츠 (max-h, flex, flex-col 추가, 내부 패딩 제거) */} 
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-scaleIn flex flex-col max-h-[calc(100vh-8rem)]" onClick={(e) => e.stopPropagation()}> 
             {/* 모달 헤더 (패딩 p-6, border-b 추가) */} 
            <div className="flex justify-between items-center p-6 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-xl font-semibold text-gray-900">반복 설정</h3>
              <button 
                onClick={handleCloseRepeatModal}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* 모달 본문 (스크롤 및 패딩 적용, flex-grow 추가) */} 
            <div className="p-6 overflow-y-auto flex-grow">
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
                          variant={modalRepeatType === option ? 'primary' : 'outline'} 
                          onClick={() => handleModalRepeatTypeChange(option)}
                          size="sm"
                          className={`justify-center ${ 
                            modalRepeatType === option 
                              ? '!bg-gray-900 !hover:bg-gray-800 !focus:ring-gray-500' 
                              : '!text-gray-800' 
                          }`}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                    {/* 하단 '안함' 버튼 (가로 전체) */} 
                    <Button
                      key="안함"
                      variant={modalRepeatType === '안함' ? 'primary' : 'outline'} 
                      onClick={() => handleModalRepeatTypeChange('안함')}
                      size="sm"
                      className={`w-full justify-center ${ 
                        modalRepeatType === '안함' 
                          ? '!bg-gray-900 !hover:bg-gray-800 !focus:ring-gray-500' 
                          : '!text-gray-800' 
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
                              variant={isSelected ? 'primary' : 'outline'}
                              onClick={() => handleModalWeekdayToggle(day.index)}
                              size="sm"
                              className={`w-10 h-10 flex items-center justify-center p-0 rounded-full ${ 
                                isSelected 
                                  ? weekdaySelectedOverrideClasses[day.index] 
                                  : '!text-gray-800' 
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
                              variant={isSelected ? 'primary' : 'outline'}
                              onClick={() => handleModalWeekdayToggle(day.index)}
                              size="sm"
                              className={`w-10 h-10 flex items-center justify-center p-0 rounded-full ${ 
                                isSelected 
                                  ? weekdaySelectedOverrideClasses[day.index] 
                                  : '!text-gray-800' 
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

                 {/* 3. 종료 조건 (날짜만) */} 
                 {modalRepeatType !== '안함' && (
                   <div className="space-y-3 border-t border-gray-200 pt-4">
                      <label className="block text-sm font-medium text-gray-700">종료 일자</label> 
                      {/* 종료 일자 선택 */} 
                      <div className="flex items-center p-2 rounded-md border border-gray-300">
                        <FaCalendarDays className="w-4 h-4 text-gray-500 mr-2 flex-shrink-0" /> 
                        <DatePicker
                          selected={modalEndDate}
                          onChange={handleModalEndDateChange}
                          dateFormat="yyyy-MM-dd"
                          locale={ko}
                          isClearable 
                          placeholderText="설정 안함 (계속 반복)"
                          className="block w-full border-none p-0 text-left text-sm font-medium focus:ring-0 bg-transparent cursor-pointer"
                          wrapperClassName="flex-grow"
                          portalId="root-portal"
                          closeOnScroll={false}
                        />
                      </div>
                   </div>
                 )}
              </div>
              {/* --- 반복 설정 UI 끝 --- */} 
            </div>

             {/* 모달 푸터 (패딩 p-6, border-t 추가) */} 
             <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 flex-shrink-0">
                <Button variant="secondary" onClick={handleCloseRepeatModal}>취소</Button>
                <Button variant="primary" onClick={handleConfirmRepeatSettings}>설정 저장</Button>
              </div>
          </div>
        </div>
      )}

      {/* 알림 설정 모달 (Portal 사용) */} 
      {isAlarmModalOpen && renderModal(
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out" onClick={handleCloseAlarmModal}> 
           {/* 모달 컨텐츠 (max-h, flex, flex-col 추가, 내부 패딩 제거) */} 
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-scaleIn flex flex-col max-h-[calc(100vh-8rem)]" onClick={(e) => e.stopPropagation()}> 
             {/* 모달 헤더 (패딩 p-6, border-b 추가) */} 
            <div className="flex justify-between items-center p-6 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-xl font-semibold text-gray-900">알림 설정</h3>
              <button onClick={handleCloseAlarmModal} className="text-gray-400 hover:text-gray-500">
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

             {/* 모달 본문 (스크롤 및 패딩 적용, flex-grow 추가) */} 
            <div className="p-6 overflow-y-auto flex-grow">
              {/* --- 알림 설정 UI --- */} 
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">알림 시간</label>
                <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-lg">
                  {['없음', '정시', '5분 전', '10분 전', '30분 전', '1시간 전', '2시간 전', '3시간 전', '6시간 전', '12시간 전', '1일 전', '2일 전'].map(option => (
                    <Button
                      key={option}
                      variant={modalAlarmSetting === option ? 'primary' : 'outline'}
                      onClick={() => handleModalAlarmChange(option)}
                      size="sm"
                      className={`justify-center ${ 
                        modalAlarmSetting === option 
                          ? '!bg-gray-900 !hover:bg-gray-800 !focus:ring-gray-500' 
                          : '!text-gray-800'
                      }`}
                    >
                      {option}
                    </Button>
                  ))}
                  {/* TODO: 사용자 지정 알림 시간 추가 */} 
                </div>
                {/* TODO: 그룹원 위치 변동 알림 설정 추가 */} 
              </div>
              {/* --- 알림 설정 UI 끝 --- */} 
            </div>

            {/* 모달 푸터 (패딩 p-6, border-t 추가) */} 
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 flex-shrink-0">
              <Button variant="secondary" onClick={handleCloseAlarmModal}>취소</Button>
              <Button variant="primary" onClick={handleConfirmAlarmSettings}>설정 저장</Button>
            </div>
          </div>
        </div>
      )}

      {/* 주소 검색 모달 (Portal 사용) - 기본 구조 */} 
      {isLocationSearchModalOpen && renderModal(
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-[60] transition-opacity duration-300 ease-in-out" onClick={handleCloseLocationSearchModal}> {/* z-index 조정 */} 
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-scaleIn flex flex-col max-h-[calc(100vh-8rem)]" onClick={(e) => e.stopPropagation()}> 
            {/* 모달 헤더 */} 
            <div className="flex justify-between items-center p-6 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-xl font-semibold text-gray-900">주소 검색</h3>
              <button onClick={handleCloseLocationSearchModal} className="text-gray-400 hover:text-gray-500">
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* 모달 본문 */} 
            <div className="p-6 flex flex-col flex-grow"> {/* overflow-hidden 제거 */} 
              {/* 검색 입력 */} 
              <div className="flex items-center space-x-2 mb-4 flex-shrink-0">
                <input
                  type="search"
                  value={locationSearchQuery}
                  onChange={(e) => setLocationSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchLocation(locationSearchQuery)} // locationSearchQuery 전달
                  className="flex-grow w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border placeholder-gray-400"
                  placeholder="도로명, 지번, 건물명 검색"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => handleSearchLocation(locationSearchQuery)} // locationSearchQuery 전달
                  disabled={isSearchingLocation}
                  className="flex-shrink-0"
                >
                  {isSearchingLocation ? '검색중...' : '검색'}
                </Button>
              </div>
              {/* 검색 결과 목록 (스크롤 가능 영역) */} 
              <div className="overflow-y-auto flex-grow">
                {isSearchingLocation && <p className="text-center text-gray-500 py-4">검색 중...</p>}
                {!isSearchingLocation && locationSearchResults.length === 0 && (
                  <p className="text-center text-gray-500 py-4">검색 결과가 없습니다.</p>
                )}
                {!isSearchingLocation && locationSearchResults.length > 0 && (
                  <ul className="divide-y divide-gray-200">
                    {locationSearchResults.map((place) => (
                      <li key={place.temp_id} className="py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{place.place_name}</p>
                          <p className="text-xs text-gray-500">{place.road_address_name || place.address_name}</p> {/* 지번 주소도 고려 */} 
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleSelectLocation(place)}
                          className="ml-3 flex-shrink-0"
                        >
                          선택
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </PageContainer>
  );
} 