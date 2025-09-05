'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { PageContainer, Card, Button } from '../../components/layout';
import { FaPencil, FaClock, FaArrowsRotate, FaBell, FaMapPin, FaBriefcase, FaFileLines, FaCalendarDays, FaUsers } from 'react-icons/fa6';
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

// 그룹 멤버 관련 인터페이스 추가
interface Location {
  lat: number;
  lng: number;
}

interface Schedule {
  id: string;
  title: string;
  date: string;
  location: string;
}

interface GroupMember {
  id: string;
  name: string;
  photo: string;
  isSelected: boolean;
  location: Location;
  schedules: Schedule[];
  mt_idx?: number;
  sgdt_owner_chk?: string;
  sgdt_leader_chk?: string;
  mt_file1?: string;
}

// 목업 데이터 추가
const MOCK_GROUP_MEMBERS_HOME: GroupMember[] = [
  { 
    id: '1', 
    name: '김철수', 
    photo: '/images/avatar3.png', 
    isSelected: false,
    location: { lat: 37.5642 + 0.005, lng: 127.0016 + 0.002 },
    schedules: []
  },
  { 
    id: '2', 
    name: '이영희', 
    photo: '/images/avatar1.png', 
    isSelected: false,
    location: { lat: 37.5642 - 0.003, lng: 127.0016 - 0.005 },
    schedules: []
  },
  { 
    id: '3', 
    name: '박민수', 
    photo: '/images/avatar2.png', 
    isSelected: false,
    location: { lat: 37.5642 + 0.002, lng: 127.0016 - 0.003 },
    schedules: []
  }
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
  const { user } = useAuth();
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
  const startTimeRef = useRef<DatePicker>(null);

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isFromHome, setIsFromHome] = useState(false);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>(MOCK_GROUP_MEMBERS_HOME);
  const [selectedMemberName, setSelectedMemberName] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'owner' | 'leader' | 'member'>('member');
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // 멤버 리스트 정렬 고정 (선택 상태 변경 시에도 순서 유지)
  const sortedGroupMembers = useMemo(() => {
    return [...groupMembers].sort((a, b) => {
      // 관리자 우선
      if (a.sgdt_owner_chk === 'Y' && b.sgdt_owner_chk !== 'Y') return -1;
      if (a.sgdt_owner_chk !== 'Y' && b.sgdt_owner_chk === 'Y') return 1;
      
      // 리더 우선
      if (a.sgdt_leader_chk === 'Y' && b.sgdt_leader_chk !== 'Y') return -1;
      if (a.sgdt_leader_chk !== 'Y' && b.sgdt_leader_chk === 'Y') return 1;
      
      // 이름 순
      return a.name.localeCompare(b.name);
    });
  }, [groupMembers]);

  // 그룹 멤버 데이터 가져오기
  const fetchGroupMembers = async (groupId: string) => {
    try {
      setIsLoadingMembers(true);
      console.log('[SCHEDULE ADD] 그룹 멤버 데이터 가져오기 시작:', groupId);
      
      const response = await fetch(`/api/groups/${groupId}/members`);
      if (!response.ok) {
        throw new Error('그룹 멤버 데이터를 가져올 수 없습니다.');
      }
      
      const membersData = await response.json();
      console.log('[SCHEDULE ADD] 그룹 멤버 데이터:', membersData);
      
      // 멤버 데이터를 GroupMember 형식으로 변환
      const transformedMembers: GroupMember[] = membersData.map((member: any) => ({
        id: member.mt_idx?.toString() || member.id || '',
        name: member.mt_name || member.name || '',
        photo: member.mt_file1 ? `/images/avatars/${member.mt_file1}` : member.photo || '/images/avatar1.png',
        isSelected: false,
        location: {
          lat: member.mt_lat || 37.5642,
          lng: member.mt_long || 127.0016
        },
        schedules: [],
        mt_idx: member.mt_idx,
        sgdt_owner_chk: member.sgdt_owner_chk,
        sgdt_leader_chk: member.sgdt_leader_chk,
        mt_file1: member.mt_file1
      }));
      
      // 현재 사용자의 역할 확인 (로그인된 사용자 정보 사용)
      const currentUserId = user?.mt_idx?.toString();
      const currentUser = transformedMembers.find(m => m.id === currentUserId);
      if (currentUser) {
        if (currentUser.sgdt_owner_chk === 'Y') {
          setCurrentUserRole('owner');
        } else if (currentUser.sgdt_leader_chk === 'Y') {
          setCurrentUserRole('leader');
        } else {
          setCurrentUserRole('member');
        }
        console.log('[SCHEDULE ADD] 현재 사용자 역할 확인:', {
          userId: currentUserId,
          userName: currentUser.name,
          role: currentUser.sgdt_owner_chk === 'Y' ? 'owner' : currentUser.sgdt_leader_chk === 'Y' ? 'leader' : 'member'
        });
      } else {
        console.warn('[SCHEDULE ADD] 현재 사용자를 찾을 수 없음:', currentUserId);
      }
      
      setGroupMembers(transformedMembers);
      console.log('[SCHEDULE ADD] 그룹 멤버 데이터 변환 완료:', transformedMembers.length, '명');
      
    } catch (error) {
      console.error('[SCHEDULE ADD] 그룹 멤버 데이터 가져오기 실패:', error);
      // 에러 시 목업 데이터 사용
      setGroupMembers(MOCK_GROUP_MEMBERS_HOME);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  // URL 파라미터 처리를 위한 useEffect
  useEffect(() => {
    // Next.js 13 App Router에서 URL 파라미터 가져오기
    if (typeof window !== 'undefined' && user) {
      const url = new URL(window.location.href);
      const fromHome = url.searchParams.get('from') === 'home';
      const groupId = url.searchParams.get('groupId');

      console.log('URL Params:', { fromHome, groupId, url: window.location.href }); // 디버깅용

      if (fromHome) {
        setIsFromHome(true);

        // 그룹 ID가 있으면 실제 데이터 가져오기
        if (groupId) {
          fetchGroupMembers(groupId);
        } else {
          // 그룹 ID가 없으면 목업 데이터 사용
          const currentUserId = user.mt_idx?.toString();
          const member = MOCK_GROUP_MEMBERS_HOME.find(m => m.id === currentUserId);
          console.log('Looking for member with ID:', currentUserId); // 디버깅용
          console.log('Available members:', MOCK_GROUP_MEMBERS_HOME); // 디버깅용
          console.log('Found member:', member); // 디버깅용

          if (member) {
            setSelectedMemberId(currentUserId);
            setSelectedMemberName(member.name);
            setGroupMembers(prev => prev.map(m => ({
              ...m,
              isSelected: m.id === currentUserId
            })));
          }
        }
      }
    }
  }, [user]);

  // 디버깅용 useEffect 추가
  useEffect(() => {
    console.log('Current state:', {
      selectedMemberId,
      isFromHome,
      selectedMemberName,
      currentUserRole,
      currentUserId: user?.mt_idx,
      groupMembers: groupMembers.map(m => ({ 
        id: m.id, 
        name: m.name, 
        isSelected: m.isSelected,
        owner: m.sgdt_owner_chk,
        leader: m.sgdt_leader_chk
      }))
    });
  }, [selectedMemberId, isFromHome, selectedMemberName, currentUserRole, user?.mt_idx, groupMembers]);

  // 멤버 선택 핸들러 - 역할에 따른 권한 적용
  const handleMemberSelect = (memberId: string) => {
    const member = sortedGroupMembers.find(m => m.id === memberId);
    const currentUserId = user?.mt_idx?.toString();
    
    console.log('[SCHEDULE ADD] 멤버 선택 시도:', {
      selectedMemberId: memberId,
      currentUserId: currentUserId,
      currentUserRole: currentUserRole,
      memberName: member?.name
    });
    
    // 역할에 따른 권한 확인
    if (currentUserRole === 'member') {
      // 일반 멤버는 자신만 선택 가능
      if (memberId !== currentUserId) {
        console.log('[SCHEDULE ADD] 일반 멤버는 자신의 스케줄만 등록 가능합니다.');
        alert('일반 멤버는 자신의 스케줄만 등록할 수 있습니다.');
        return;
      }
    }
    
    setSelectedMemberId(memberId);
    if (member) {
      setSelectedMemberName(member.name);
    }
    
    // 멤버 리스트 정렬 유지하면서 선택 상태만 업데이트
    setGroupMembers(prev => prev.map(m => ({
      ...m,
      isSelected: m.id === memberId
    })));
  };

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

  // 날짜/시간 유효성 검사 useEffect 수정 (포괄적인 오입력 방지 로직 추가)
  useEffect(() => {
    let hasError = false;
    let errorMessage = '';
    let focusTarget: React.RefObject<any> | null = null;

    // 현재 시간
    const now = dayjs();
    
    // 기본 필수 필드 검사
    if (!scheduleForm.startDate) {
      // 시작 날짜가 없으면 에러 표시하지 않음 (초기 상태)
      setDateTimeError(null);
      return;
    }

    // 날짜 형식 유효성 검사
    const startDate = dayjs(scheduleForm.startDate);
    if (!startDate.isValid()) {
      setDateTimeError('시작 날짜 형식이 올바르지 않습니다.');
      return;
    }

    // 과거 날짜 검사 (오늘 이전 날짜 방지)
    if (startDate.isBefore(now, 'day')) {
      setDateTimeError('과거 날짜로는 일정을 생성할 수 없습니다.');
      focusTarget = startDateRef;
      hasError = true;
    }

    // 너무 먼 미래 날짜 검사 (10년 후까지만 허용)
    if (startDate.isAfter(now.add(10, 'year'))) {
      setDateTimeError('10년 이후의 날짜는 설정할 수 없습니다.');
      focusTarget = startDateRef;
      hasError = true;
    }

    // 하루 종일 일정인 경우
    if (scheduleForm.allDay) {
      if (scheduleForm.endDate) {
        const endDate = dayjs(scheduleForm.endDate);
        
        if (!endDate.isValid()) {
          setDateTimeError('종료 날짜 형식이 올바르지 않습니다.');
          focusTarget = endDateRef;
          hasError = true;
        } else if (endDate.isBefore(startDate)) {
          setDateTimeError('종료 날짜는 시작 날짜보다 빠를 수 없습니다.');
          focusTarget = endDateRef;
          hasError = true;
        } else if (endDate.isAfter(startDate.add(365, 'day'))) {
          setDateTimeError('일정 기간은 1년을 초과할 수 없습니다.');
          focusTarget = endDateRef;
          hasError = true;
        }
      }
    } 
    // 시간이 설정된 일정인 경우
    else {
      if (!scheduleForm.startTime) {
        setDateTimeError('시작 시간을 설정해주세요.');
        focusTarget = startTimeRef;
        hasError = true;
      } else if (!scheduleForm.endTime) {
        setDateTimeError('종료 시간을 설정해주세요.');
        focusTarget = endTimeRef;
        hasError = true;
      } else if (!scheduleForm.endDate) {
        setDateTimeError('종료 날짜를 설정해주세요.');
        focusTarget = endDateRef;
        hasError = true;
      } else {
        // 시간 형식 유효성 검사
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(scheduleForm.startTime)) {
          setDateTimeError('시작 시간 형식이 올바르지 않습니다. (HH:MM)');
          focusTarget = startTimeRef;
          hasError = true;
        } else if (!timeRegex.test(scheduleForm.endTime)) {
          setDateTimeError('종료 시간 형식이 올바르지 않습니다. (HH:MM)');
          focusTarget = endTimeRef;
          hasError = true;
        } else {
          const endDate = dayjs(scheduleForm.endDate);
          if (!endDate.isValid()) {
            setDateTimeError('종료 날짜 형식이 올바르지 않습니다.');
            focusTarget = endDateRef;
            hasError = true;
          } else {
            const startDateTime = dayjs(`${scheduleForm.startDate}T${scheduleForm.startTime}`);
            const endDateTime = dayjs(`${scheduleForm.endDate}T${scheduleForm.endTime}`);

            if (startDateTime.isValid() && endDateTime.isValid()) {
              // 종료 시간이 시작 시간보다 빠른 경우
              if (endDateTime.isBefore(startDateTime)) {
                if (endDate.isBefore(startDate)) {
                  setDateTimeError('종료 날짜는 시작 날짜보다 빠를 수 없습니다.');
                  focusTarget = endDateRef;
                } else {
                  setDateTimeError('종료 시간은 시작 시간보다 빠를 수 없습니다.');
                  focusTarget = endTimeRef;
                }
                hasError = true;
              }
              // 같은 날짜에서 시작 시간과 종료 시간이 같은 경우
              else if (startDate.isSame(endDate, 'day') && scheduleForm.startTime === scheduleForm.endTime) {
                setDateTimeError('시작 시간과 종료 시간이 같을 수 없습니다.');
                focusTarget = endTimeRef;
                hasError = true;
              }
              // 일정 기간이 너무 긴 경우 (7일 초과)
              else if (endDateTime.diff(startDateTime, 'day') > 7) {
                setDateTimeError('일정 기간은 7일을 초과할 수 없습니다.');
                focusTarget = endDateRef;
                hasError = true;
              }
              // 과거 시간 검사 (현재 시간 이전 방지)
              else if (startDateTime.isBefore(now)) {
                setDateTimeError('과거 시간으로는 일정을 생성할 수 없습니다.');
                if (startDate.isBefore(now, 'day')) {
                  focusTarget = startDateRef;
                } else {
                  focusTarget = startTimeRef;
                }
                hasError = true;
              }
              // 너무 짧은 일정 (5분 미만)
              else if (endDateTime.diff(startDateTime, 'minute') < 5) {
                setDateTimeError('일정은 최소 5분 이상이어야 합니다.');
                focusTarget = endTimeRef;
                hasError = true;
              }
              // 너무 긴 일정 (24시간 초과, 단일 날짜)
              else if (startDate.isSame(endDate, 'day') && endDateTime.diff(startDateTime, 'hour') > 24) {
                setDateTimeError('하루 일정은 24시간을 초과할 수 없습니다.');
                focusTarget = endTimeRef;
                hasError = true;
              }
            }
          }
        }
      }
    }

    // 오류가 없으면 에러 상태 초기화
    if (!hasError) {
      setDateTimeError(null);
    } else if (focusTarget?.current?.setFocus) {
      // 포커스 이동 (약간의 지연을 두어 렌더링 완료 후 실행)
      setTimeout(() => {
        focusTarget?.current?.setFocus();
      }, 100);
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
    if (!date) return;
    const newTime = dayjs(date);
    if (name === 'startTime') {
      // 시작 시간 설정 시 종료 시간을 +1시간으로 자동 세팅 (자정 넘김 포함)
      const startDateTime = dayjs(`${scheduleForm.startDate}T${newTime.format('HH:mm')}:00`);
      const endCandidate = startDateTime.add(1, 'hour');

      setScheduleForm(prev => ({
        ...prev,
        startTime: newTime.format('HH:mm'),
        endDate: endCandidate.format('YYYY-MM-DD'),
        endTime: endCandidate.format('HH:mm'),
      }));
    } else {
      // 종료 시간 직접 변경
      setScheduleForm(prev => ({
        ...prev,
        endTime: newTime.format('HH:mm'),
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
    // 유효성 검사
    if (!scheduleForm.title.trim()) {
      alert('일정 제목을 입력해주세요.');
      return;
    }

    if (dateTimeError) {
      alert('날짜/시간 설정에 오류가 있습니다. 확인 후 다시 시도해주세요.');
      return;
    }

    if (!scheduleForm.allDay && (!scheduleForm.startTime || !scheduleForm.endTime)) {
      alert('시작 시간과 종료 시간을 설정해주세요.');
      return;
    }

    setIsSaving(true);
    console.log('저장할 일정 데이터:', scheduleForm);
    // TODO: API 호출 또는 상태 관리 라이브러리를 사용하여 일정 저장 로직 구현
    await new Promise(resolve => setTimeout(resolve, 1000)); // 임시 지연
    setIsSaving(false);
    setDateTimeError(null); // 에러 상태 초기화
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

    const KAKAO_API_KEY = '7fbf60571daf54ca5bee8373a1f31d2d'; // 임시 API 키 (주의!)
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
      title={selectedMemberName && isFromHome ? 
        `${selectedMemberName}의 일정 입력` : 
        "새 일정 입력"} 
      description="" 
      showHeader={false}
      showBackButton={false}
      showTitle={false}
      className="h-full flex flex-col"
    >
      <div className="flex-grow space-y-6 overflow-y-auto py-4 px-2">
        <form onSubmit={(e) => { e.preventDefault(); handleSaveSchedule(); }} className="space-y-6">
          {/* 홈에서 진입하지 않은 경우에만 그룹 멤버 선택 UI 표시 */}
          {!isFromHome && (
            <div className="bg-white rounded-lg shadow-lg p-5 border-t-4 border-indigo-200">
              <div className="flex items-center mb-5">
                <FaUsers className="w-6 h-6 text-indigo-500 mr-3 flex-shrink-0" />
                <h3 className="text-lg font-semibold text-gray-800">그룹 멤버 선택</h3>
              </div>
              <div className="border-t border-gray-100 pt-5">
                {/* 역할 정보 표시 */}
                <div className="mb-3 p-2 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-700">
                    {currentUserRole === 'owner' && '그룹 관리자: 모든 멤버의 스케줄을 등록할 수 있습니다.'}
                    {currentUserRole === 'leader' && '그룹 리더: 모든 멤버의 스케줄을 등록할 수 있습니다.'}
                    {currentUserRole === 'member' && '일반 멤버: 자신의 스케줄만 등록할 수 있습니다.'}
                  </p>
                </div>
                
                {isLoadingMembers ? (
                  <div className="flex flex-col items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mb-2"></div>
                    <span className="text-sm text-gray-500">멤버 정보를 불러오는 중...</span>
                  </div>
                ) : (
                  <div className="flex flex-row flex-nowrap justify-start items-center gap-x-4 mb-2 overflow-x-auto hide-scrollbar px-2 py-3">
                    {sortedGroupMembers.map((member) => {
                      // 역할에 따른 선택 가능 여부 확인
                      const currentUserId = user?.mt_idx?.toString();
                      const canSelect = currentUserRole === 'owner' || 
                                      currentUserRole === 'leader' || 
                                      member.id === currentUserId;
                      
                      return (
                        <div key={member.id} className="flex flex-col items-center p-0 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMemberSelect(member.id)}
                            disabled={!canSelect}
                            className={`flex flex-col items-center focus:outline-none ${
                              !canSelect ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            <div className={`w-12 h-12 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden border-2 transition-all duration-200 transform hover:scale-105 ${
                              member.isSelected ? 'border-indigo-500 ring-2 ring-indigo-300 scale-110' : 'border-transparent'
                            } ${!canSelect ? 'grayscale' : ''}`}>
                              <img 
                                src={member.photo} 
                                alt={member.name} 
                                className="w-full h-full object-cover"
                                draggable="false"
                              />
                            </div>
                            <span className={`block text-xs font-medium mt-1.5 ${
                              member.isSelected ? 'text-indigo-700' : 'text-gray-700'
                            } ${!canSelect ? 'text-gray-400' : ''}`}>
                              {member.name}
                            </span>
                            {/* 역할 표시 */}
                            {member.sgdt_owner_chk === 'Y' && (
                              <span className="text-xs text-red-500 font-medium">관리자</span>
                            )}
                            {member.sgdt_leader_chk === 'Y' && member.sgdt_owner_chk !== 'Y' && (
                              <span className="text-xs text-blue-500 font-medium">리더</span>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {!selectedMemberId && (
                  <p className="text-sm text-red-500 mt-2">
                    일정을 등록할 그룹 멤버를 선택해주세요.
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* 일정 내용 (제목) 카드 */}
          <div className="bg-white rounded-lg shadow-lg p-5 border-t-4 border-indigo-200">
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
                      onChange={(date: Date | null) => {
                        handleDateChange(date, 'startDate');
                        // 시작 날짜가 바뀌면 종료 날짜도 동일하게 맞춤 (시간 로직은 handleTimeChange에서 보정)
                        if (date) {
                          setScheduleForm(prev => ({
                            ...prev,
                            endDate: dayjs(date).format('YYYY-MM-DD'),
                          }));
                        }
                      }}
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
                        ref={startTimeRef}
                        selected={scheduleForm.startTime ? dayjs(`1970-01-01T${scheduleForm.startTime}:00`).toDate() : null}
                        onChange={(date: Date | null) => handleTimeChange(date, 'startTime')}
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
                       onChange={(date: Date | null) => handleDateChange(date, 'endDate')}
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
                         onChange={(date: Date | null) => handleTimeChange(date, 'endTime')}
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
            <Button type="submit" variant="primary" disabled={isSaving || !!dateTimeError}>
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
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-scaleIn flex flex-col h-[70vh] min-h-[400px]" onClick={(e) => e.stopPropagation()}> 
            {/* 모달 헤더 */} 
            <div className="flex justify-between items-center p-6 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-xl font-semibold text-gray-900">주소 검색</h3>
              <button onClick={handleCloseLocationSearchModal} className="text-gray-400 hover:text-gray-500">
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* 모달 본문 */}
            <div className="p-6 flex flex-col flex-grow min-h-[200px]"> {/* overflow-hidden 제거 */} 
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
                  size="md"
                  onClick={() => handleSearchLocation(locationSearchQuery)} // locationSearchQuery 전달
                  disabled={isSearchingLocation}
                  className="flex-shrink-0"
                >
                  {isSearchingLocation ? '검색중' : '검색'}
                </Button>
              </div>
              {/* 검색 결과 목록 (스크롤 가능 영역) */}
              <div className="overflow-y-auto flex-grow min-h-[150px]">
                {isSearchingLocation && <p className="text-center text-gray-500 py-4">검색 중...</p>}
                {!isSearchingLocation && locationSearchResults.length === 0 && (
                  <p className="text-center text-gray-500 py-4">검색 결과가 없습니다.</p>
                )}
                {!isSearchingLocation && locationSearchResults.length > 0 && (
                  <div className="space-y-2">
                    {locationSearchResults.map((place) => (
                      <div key={place.temp_id} className="bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors">
                        <div className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{place.place_name}</p>
                              <p className="text-xs text-gray-500 truncate mt-1">{place.road_address_name || place.address_name}</p>
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
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </PageContainer>
  );
} 