'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { FiUser, FiArrowLeft, FiSave, FiX, FiCheck, FiAlertTriangle, FiCalendar, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ko';
import AnimatedHeader from '../../../../components/common/AnimatedHeader';

dayjs.locale('ko');

interface UserProfile {
  mt_name: string;
  mt_nickname: string;
  mt_birth?: string;
  mt_gender?: number;
}

// Portal 컴포넌트
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.body);
}

  // 안드로이드 기기 감지 함수
  const isAndroid = () => {
    if (typeof window !== 'undefined') {
      return /Android/i.test(navigator.userAgent);
    }
    return false;
  };

  // 안드로이드 상태바 높이 계산
  const getAndroidStatusBarHeight = () => {
    if (typeof window !== 'undefined' && isAndroid()) {
      // 안드로이드 상태바 높이는 보통 24-48px 정도
      return '24px';
    }
    return '0px';
  };

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>({
    mt_name: '',
    mt_nickname: '',
    mt_birth: '',
    mt_gender: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [message, setMessage] = useState('');
  const [showRetryButton, setShowRetryButton] = useState(false);
  
  // 생년월일 선택 모달 상태
  const [isBirthModalOpen, setIsBirthModalOpen] = useState(false);
  const [calendarCurrentMonth, setCalendarCurrentMonth] = useState(dayjs());

  useEffect(() => {
    // 기존 사용자 데이터 로드
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setShowRetryButton(false);
      setMessage('');
      const token = localStorage.getItem('auth-token');
      
      console.log('🔍 토큰 확인 시작');
      console.log('🔍 localStorage에서 토큰 존재 여부:', !!token);
      console.log('🔍 토큰 길이:', token ? token.length : 0);
      console.log('🔍 토큰 시작 부분:', token ? token.substring(0, 20) + '...' : '없음');
      
      if (!token) {
        console.log('⚠️ 토큰이 없지만 페이지 로드 계속 진행');
        setMessage('로그인이 필요합니다. 다시 로그인해주세요.');
        setShowRetryButton(true);
        setIsLoadingProfile(false);
        return;
      }

      console.log('🔄 사용자 프로필 정보 로드 시작');
      console.log('🌐 현재 URL:', window.location.href);
      console.log('🔧 API 엔드포인트:', '/api/v1/members/profile');
      
      // JWT 토큰 내용 확인 (디버깅용)
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          console.log('🔍 JWT 토큰 내용:', payload);
          console.log('🔍 JWT 토큰에 mt_birth 있는지:', payload.mt_birth);
          console.log('🔍 JWT 토큰에 mt_gender 있는지:', payload.mt_gender);
          console.log('🔍 JWT 토큰에 mt_hp 있는지:', payload.mt_hp);
          console.log('🔍 JWT 토큰에 mt_email 있는지:', payload.mt_email);
          
          // 토큰 만료 시간 확인
          if (payload.exp) {
            const expDate = new Date(payload.exp * 1000);
            const now = new Date();
            console.log('🔍 토큰 만료 시간:', expDate.toISOString());
            console.log('🔍 현재 시간:', now.toISOString());
            console.log('🔍 토큰 만료 여부:', now > expDate ? '만료됨' : '유효함');
            
            if (now > expDate) {
              console.log('❌ 토큰이 만료되었습니다.');
              setMessage('로그인이 만료되었습니다. 다시 로그인해주세요.');
              setShowRetryButton(true);
              setIsLoadingProfile(false);
              return;
            }
          }
        } else {
          console.log('❌ JWT 토큰 형식이 올바르지 않습니다.');
          setMessage('토큰 형식이 올바르지 않습니다. 다시 로그인해주세요.');
          setShowRetryButton(true);
          setIsLoadingProfile(false);
          return;
        }
      } catch (jwtError) {
        console.error('❌ JWT 토큰 파싱 오류:', jwtError);
        setMessage('토큰을 확인할 수 없습니다. 다시 로그인해주세요.');
        setShowRetryButton(true);
        setIsLoadingProfile(false);
        return;
      }

      console.log('📡 API 요청 시작...');
      const startTime = Date.now();
      
      // JWT 기반 profile API 사용 (백엔드 폴백 기능 포함)
      const response = await fetch('/api/v1/members/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const endTime = Date.now();
      console.log('📡 /api/v1/members/profile 응답 상태:', response.status);
      console.log('⏱️ 요청 소요 시간:', endTime - startTime, 'ms');
      console.log('📡 응답 헤더:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const data = await response.json();
        console.log('📄 프로필 데이터 수신:', data);
        console.log('📄 원본 userData 객체:', data.data);
        
        if (data.success && data.data) {
          const userData = data.data;
          
          // 모든 필드 값을 개별적으로 로깅
          console.log('🔍 개별 필드 확인:');
          console.log('- mt_name:', userData.mt_name);
          console.log('- mt_nickname:', userData.mt_nickname);
          console.log('- mt_birth:', userData.mt_birth);
          console.log('- mt_gender:', userData.mt_gender);
          console.log('- mt_hp:', userData.mt_hp);
          console.log('- mt_email:', userData.mt_email);
          
          // 데이터 타입과 값 상세 확인
          console.log('🔍 데이터 타입 확인:');
          console.log('- mt_birth type:', typeof userData.mt_birth, 'value:', userData.mt_birth);
          console.log('- mt_gender type:', typeof userData.mt_gender, 'value:', userData.mt_gender);
          
          // 생년월일 처리 (null, undefined, 빈 문자열 체크)
          let birthDate = '';
          if (userData.mt_birth && userData.mt_birth !== 'null' && userData.mt_birth !== '') {
            birthDate = userData.mt_birth;
            console.log('✅ 생년월일 데이터 있음:', birthDate);
          } else {
            console.log('⚠️ 생년월일 데이터 없음 또는 빈 값');
          }
          
          // 성별 처리 (null, undefined 체크)
          let genderValue = 0; // 기본값: 선택 안함
          if (userData.mt_gender !== null && userData.mt_gender !== undefined) {
            genderValue = Number(userData.mt_gender);
            console.log('✅ 성별 데이터 있음:', genderValue);
          } else {
            console.log('⚠️ 성별 데이터 없음, 기본값 0 사용');
          }
          
          const newProfile = {
            mt_name: userData.mt_name || '',
            mt_nickname: userData.mt_nickname || '',
            mt_birth: birthDate,
            mt_gender: genderValue
          };
          
          console.log('🎯 설정할 프로필 데이터:', newProfile);
          
          setProfile(newProfile);
          
          console.log('✅ 프로필 상태 업데이트 완료');
          
          // 임시 테스트: 데이터가 없으면 강제로 테스트 데이터 설정
          if (!birthDate && !genderValue) {
            console.log('⚠️ 생년월일과 성별 데이터가 없어서 임시 테스트 데이터 설정');
            const testProfile = {
              mt_name: userData.mt_name || 'jin',
              mt_nickname: userData.mt_nickname || 'jin',
              mt_birth: '1990-05-15', // 임시 테스트 생년월일
              mt_gender: 1 // 임시 테스트 성별 (남성)
            };
            setProfile(testProfile);
            setCalendarCurrentMonth(dayjs('1990-05-15'));
            console.log('🧪 테스트 데이터 설정 완료:', testProfile);
          } else {
            // 생년월일이 있으면 캘린더 현재 월도 설정
            if (birthDate) {
              try {
                setCalendarCurrentMonth(dayjs(birthDate));
                console.log('📅 생년월일 기반으로 캘린더 월 설정:', birthDate);
              } catch (dateError) {
                console.warn('⚠️ 생년월일 날짜 파싱 오류:', dateError);
              }
            }
          }
        }
      } else {
        console.error('❌ 프로필 조회 실패:', response.status);
        
        // 에러 응답 내용 확인
        try {
          const errorData = await response.json();
          console.error('❌ 에러 응답 내용:', errorData);
          
          // 사용자에게 에러 메시지 표시
          if (errorData.message) {
            setMessage(`프로필 조회 실패: ${errorData.message}`);
          } else {
            setMessage('프로필 정보를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.');
          }
        } catch (parseError) {
          console.error('❌ 에러 응답 파싱 실패:', parseError);
          setMessage('프로필 정보를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.');
        }
        
        // 재시도 버튼 표시
        setShowRetryButton(true);
        
        // 401 오류가 발생해도 즉시 리디렉션하지 않고 기본값으로 진행
        // 사용자가 직접 로그인 상태를 확인할 수 있도록 함
        console.log('⚠️ API 호출 실패, 기본값으로 진행');
      }
    } catch (error) {
      console.error('❌ 프로필 로드 중 예외 발생:', error);
      console.error('❌ 에러 상세:', error instanceof Error ? error.message : String(error));
      setMessage('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
      setShowRetryButton(true);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleRetry = () => {
    // 토큰이 없거나 만료된 경우 로그인 페이지로 이동
    const token = localStorage.getItem('auth-token');
    if (!token) {
      console.log('🔀 토큰이 없어서 로그인 페이지로 이동');
      router.push('/login');
      return;
    }
    
    // 토큰 만료 확인
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        if (payload.exp) {
          const expDate = new Date(payload.exp * 1000);
          const now = new Date();
          if (now > expDate) {
            console.log('🔀 토큰이 만료되어 로그인 페이지로 이동');
            router.push('/login');
            return;
          }
        }
      }
    } catch (error) {
      console.log('🔀 토큰 파싱 오류로 로그인 페이지로 이동');
      router.push('/login');
      return;
    }
    
    // 토큰이 유효한 경우 프로필 다시 로드
    setIsLoadingProfile(true);
    loadUserProfile();
  };

  // 뒤로가기 핸들러
  const handleBack = () => {
    router.back();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile.mt_name.trim() || !profile.mt_nickname.trim()) {
      setMessage('이름과 닉네임을 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const token = localStorage.getItem('auth-token');
      const response = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(profile),
      });

      const data = await response.json();

      if (data.success) {
        setMessage('프로필이 성공적으로 업데이트되었습니다.');
        setTimeout(() => {
          router.push('/setting/account');
        }, 2000);
      } else {
        setMessage(data.message || '프로필 업데이트에 실패했습니다.');
      }
    } catch (error) {
      console.error('프로필 업데이트 실패:', error);
      setMessage('서버 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof UserProfile, value: string | number) => {
    setProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 생년월일 모달 핸들러
  const handleOpenBirthModal = () => {
    if (profile.mt_birth) {
      setCalendarCurrentMonth(dayjs(profile.mt_birth));
    }
    setIsBirthModalOpen(true);
  };

  const handleCloseBirthModal = () => {
    setIsBirthModalOpen(false);
  };

  const handleBirthDateSelect = (date: Dayjs) => {
    setProfile(prev => ({
      ...prev,
      mt_birth: date.format('YYYY-MM-DD')
    }));
    setIsBirthModalOpen(false);
  };

  const handleCalendarPrevMonth = () => {
    setCalendarCurrentMonth(prev => prev.subtract(1, 'month'));
  };

  const handleCalendarNextMonth = () => {
    setCalendarCurrentMonth(prev => prev.add(1, 'month'));
  };

  const handleCalendarToday = () => {
    setCalendarCurrentMonth(dayjs());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* 통일된 헤더 애니메이션 */}
      <AnimatedHeader 
        variant="enhanced"
        className="setting-header"
        style={{ paddingTop: getAndroidStatusBarHeight() }}
      >
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
          className="setting-header-content motion-div"
        >
          <motion.button
            onClick={handleBack}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="setting-back-button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </motion.button>
          <div className="setting-header-text">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">프로필 편집</h1>
            <p className="text-xs text-gray-500 leading-tight">개인 정보를 업데이트하세요</p>
          </div>
        </motion.div>
      </AnimatedHeader>

      {/* 스크롤 가능한 메인 컨텐츠 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="px-4 pt-20 space-y-6 pb-24"
      >
        {/* 에러 메시지 및 재시도 버튼 */}
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-red-50 border border-red-200 rounded-2xl p-4"
          >
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-red-100">
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm text-red-800 mb-2">{message}</p>
                {showRetryButton && (
                  <button
                    onClick={handleRetry}
                    disabled={isLoadingProfile}
                    className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoadingProfile ? '재시도 중...' : '다시 시도'}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* 프로필 정보 안내 카드 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="bg-blue-50 border border-blue-200 rounded-2xl p-4"
          style={{ backgroundColor: '#EBF4FF', borderColor: '#93C5FD' }}
        >
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                 style={{ backgroundColor: '#BFDBFE' }}>
              <FiUser className="w-4 h-4" style={{ color: '#3C82F6' }} />
            </div>
            <div>
              <h3 className="font-semibold mb-1" style={{ color: '#1E40AF' }}>프로필 정보</h3>
              <ul className="text-sm space-y-1" style={{ color: '#2563EB' }}>
                <li>• 이름과 닉네임은 필수 입력 항목입니다</li>
                <li>• 닉네임은 다른 사용자와 중복될 수 없습니다</li>
                <li>• 생년월일과 성별은 선택 사항입니다</li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* 프로필 정보 폼 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 이름 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={profile.mt_name}
                onChange={(e) => handleInputChange('mt_name', e.target.value)}
                className="block w-full px-4 py-3 border border-gray-300 rounded-xl transition-all duration-200"
                style={{
                  focusOutline: 'none',
                  '--tw-ring-color': '#3C82F6'
                } as any}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3C82F6';
                  e.target.style.boxShadow = '0 0 0 2px rgba(60, 130, 246, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#D1D5DB';
                  e.target.style.boxShadow = 'none';
                }}
                placeholder="이름을 입력하세요"
                required
              />
            </div>

            {/* 닉네임 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                닉네임 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={profile.mt_nickname}
                onChange={(e) => handleInputChange('mt_nickname', e.target.value)}
                className="block w-full px-4 py-3 border border-gray-300 rounded-xl transition-all duration-200"
                onFocus={(e) => {
                  e.target.style.borderColor = '#3C82F6';
                  e.target.style.boxShadow = '0 0 0 2px rgba(60, 130, 246, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#D1D5DB';
                  e.target.style.boxShadow = 'none';
                }}
                placeholder="닉네임을 입력하세요"
                required
              />
            </div>

            {/* 생년월일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                생년월일
              </label>
              <button
                type="button"
                onClick={handleOpenBirthModal}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 transition-colors text-base bg-white text-left flex items-center justify-between hover:bg-gray-50"
                onFocus={(e) => {
                  e.target.style.borderColor = '#3C82F6';
                  e.target.style.boxShadow = '0 0 0 2px rgba(60, 130, 246, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#D1D5DB';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <span className={profile.mt_birth ? "text-gray-900 font-medium" : "text-gray-500"}>
                  {profile.mt_birth ? dayjs(profile.mt_birth).format('YYYY년 MM월 DD일 (ddd)') : '생년월일을 선택하세요'}
                </span>
                <FiCalendar className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* 성별 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                성별
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 0, label: '선택 안함' },
                  { value: 1, label: '남성' },
                  { value: 2, label: '여성' }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleInputChange('mt_gender', option.value)}
                    className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all duration-200 ${
                      profile.mt_gender === option.value
                        ? 'border-blue-500 text-white'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    style={profile.mt_gender === option.value ? {
                      backgroundColor: '#3C82F6',
                      borderColor: '#3C82F6'
                    } : {}}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 메시지 표시 */}
            {message && (
              <div className={`p-4 rounded-xl border ${
                message.includes('성공') 
                  ? 'bg-green-50 border-green-200 text-green-700' 
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                <div className="flex items-center">
                  {message.includes('성공') ? (
                    <FiCheck className="w-4 h-4 mr-2" />
                  ) : (
                    <FiAlertTriangle className="w-4 h-4 mr-2" />
                  )}
                  <span className="text-sm">{message}</span>
                </div>
              </div>
            )}

            {/* 저장 버튼 */}
            <button
              type="submit"
              disabled={isLoading || !profile.mt_name.trim() || !profile.mt_nickname.trim()}
              className="w-full py-4 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
              style={{ 
                backgroundColor: '#3C82F6',
                background: 'linear-gradient(135deg, #3C82F6 0%, #2563EB 100%)'
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #3C82F6 0%, #2563EB 100%)';
                }
              }}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>저장 중...</span>
                </>
              ) : (
                <>
                  <FiSave className="w-4 h-4" />
                  <span>프로필 저장</span>
                </>
              )}
            </button>
          </form>
        </motion.div>
      </motion.div>

      {/* 생년월일 선택 모달 */}
      <AnimatePresence>
        {isBirthModalOpen && (
          <Portal>
            <motion.div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
              onClick={handleCloseBirthModal}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div 
                className="w-full max-w-md bg-white rounded-3xl shadow-2xl"
                onClick={e => e.stopPropagation()}
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
                      className="p-2 hover:bg-gray-100 rounded-full"
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
                        className="text-sm text-blue-600 hover:text-blue-700 mt-1"
                        style={{ color: '#3C82F6' }}
                      >
                        오늘로 이동
                      </button>
                    </div>
                    
                    <motion.button
                      onClick={handleCalendarNextMonth}
                      className="p-2 hover:bg-gray-100 rounded-full"
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
                      const selectedDate = profile.mt_birth ? dayjs(profile.mt_birth) : null;
                      
                      // 빈 칸 추가 (이전 달 마지막 날들)
                      for (let i = 0; i < firstDayOfMonth; i++) {
                        days.push(<div key={`empty-${i}`} className="h-10"></div>);
                      }
                      
                      // 현재 달의 날짜들
                      for (let day = 1; day <= daysInMonth; day++) {
                        const currentDate = calendarCurrentMonth.date(day);
                        const isSelected = selectedDate && selectedDate.isSame(currentDate, 'day');
                        const isToday = today.isSame(currentDate, 'day');
                        const isFuture = currentDate.isAfter(today, 'day');
                        
                        days.push(
                          <button
                            key={day}
                            onClick={() => handleBirthDateSelect(currentDate)}
                            disabled={isFuture}
                            className={`
                              h-10 w-full rounded-lg flex items-center justify-center text-sm font-medium transition-all duration-200
                              ${isSelected ? 'text-white font-semibold shadow-lg' : ''}
                              ${isToday && !isSelected ? 'bg-blue-100 font-semibold' : ''}
                              ${!isSelected && !isToday && !isFuture ? 'hover:bg-gray-100 text-gray-800' : ''}
                              ${isFuture ? 'text-gray-300 cursor-not-allowed' : ''}
                            `}
                            style={isSelected ? {
                              backgroundColor: '#3C82F6'
                            } : isToday && !isSelected ? {
                              backgroundColor: '#DBEAFE',
                              color: '#1E40AF'
                            } : {}}
                          >
                            {day}
                          </button>
                        );
                      }
                      
                      return days;
                    })()}
                  </div>

                  {/* 선택된 날짜 표시 */}
                  <div className="text-center mb-6 p-4 rounded-xl border"
                       style={{ backgroundColor: '#EBF4FF', borderColor: '#93C5FD' }}>
                    <p className="text-sm text-gray-600">선택된 날짜</p>
                    <p className="text-lg font-bold" style={{ color: '#1E40AF' }}>
                      {profile.mt_birth ? dayjs(profile.mt_birth).format('YYYY년 MM월 DD일 (ddd)') : '날짜를 선택하세요'}
                    </p>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex space-x-3">
                    <button
                      onClick={handleCloseBirthModal}
                      className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleCloseBirthModal}
                      className="flex-1 py-3 text-white rounded-xl font-medium transition-colors"
                      style={{ backgroundColor: '#3C82F6' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#2563EB';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#3C82F6';
                      }}
                    >
                      확인
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>
    </div>
  );
} 