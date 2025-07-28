'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiPhone, FiMail } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import AnimatedHeader from '../../../../components/common/AnimatedHeader';

interface UserContact {
  mt_hp: string;
  mt_email: string;
}

export default function ContactPage() {
  const router = useRouter();
  const [contact, setContact] = useState<UserContact>({
    mt_hp: '',
    mt_email: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingContact, setIsLoadingContact] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // 기존 사용자 데이터 로드
    loadUserContact();
  }, []);

  const loadUserContact = async () => {
    try {
      const token = localStorage.getItem('auth-token');
      if (!token) {
        console.log('⚠️ 토큰이 없지만 페이지 로드 계속 진행');
        setIsLoadingContact(false);
        return;
      }

      console.log('🔄 사용자 연락처 정보 로드 시작');

      // 데이터베이스에서 실시간으로 사용자 정보 가져오기
      const response = await fetch('/api/auth/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('📡 /api/auth/profile 응답 상태:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('📄 연락처 데이터 수신:', data);
        
        if (data.success && data.data) {
          const userData = data.data;
          
          // 전화번호에 하이픈 포맷팅 적용
          const formattedPhone = userData.mt_hp ? formatPhoneNumber(userData.mt_hp) : '';
          
          setContact({
            mt_hp: formattedPhone,
            mt_email: userData.mt_email || ''
          });
          console.log('✅ 연락처 데이터 설정 완료:', {
            phone: formattedPhone,
            email: userData.mt_email
          });
        }
      } else {
        console.error('❌ 연락처 조회 실패:', response.status);
        // 401 오류가 발생해도 즉시 리디렉션하지 않고 기본값으로 진행
        // 사용자가 직접 로그인 상태를 확인할 수 있도록 함
        console.log('⚠️ API 호출 실패, 기본값으로 진행');
      }
    } catch (error) {
      console.error('❌ 사용자 연락처 로드 실패:', error);
    } finally {
      setIsLoadingContact(false);
    }
  };

  // 뒤로가기 핸들러
  const handleBack = () => {
    router.push('/setting/account');
  };

  const formatPhoneNumber = (value: string) => {
    // 숫자만 추출
    const numbers = value.replace(/[^\d]/g, '');
    
    // 최대 11자리까지만 허용
    const limitedNumbers = numbers.slice(0, 11);
    
    // 010-xxxx-xxxx 형식으로 포맷팅
    if (limitedNumbers.length <= 3) {
      return limitedNumbers;
    } else if (limitedNumbers.length <= 7) {
      return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3)}`;
    } else {
      return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3, 7)}-${limitedNumbers.slice(7)}`;
    }
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setContact(prev => ({
      ...prev,
      mt_hp: formatted
    }));
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string) => {
    const phoneRegex = /^010-\d{4}-\d{4}$/;
    return phoneRegex.test(phone);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!contact.mt_hp.trim() || !contact.mt_email.trim()) {
      setMessage('전화번호와 이메일을 모두 입력해주세요.');
      return;
    }

    if (!validatePhone(contact.mt_hp)) {
      setMessage('올바른 전화번호 형식을 입력해주세요. (예: 010-1234-5678)');
      return;
    }

    if (!validateEmail(contact.mt_email)) {
      setMessage('올바른 이메일 형식을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const token = localStorage.getItem('auth-token');
      
      // 서버로 전송할 때는 하이픈 제거
      const contactForSubmit = {
        mt_hp: contact.mt_hp.replace(/[^\d]/g, ''), // 숫자만 남기기
        mt_email: contact.mt_email
      };
      
      const response = await fetch('/api/auth/update-contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(contactForSubmit),
      });

      const data = await response.json();

      if (data.success) {
        setMessage('연락처가 성공적으로 업데이트되었습니다.');
        setTimeout(() => {
          router.push('/setting/account');
        }, 2000);
      } else {
        setMessage(data.message || '연락처 업데이트에 실패했습니다.');
      }
    } catch (error) {
      console.error('연락처 업데이트 실패:', error);
      setMessage('서버 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50" data-page="/setting/account/contact">
      {/* 통일된 헤더 애니메이션 */}
      <AnimatedHeader 
        variant="simple"
        className="fixed top-0 left-0 right-0 z-50 glass-effect header-fixed setting-header"
        style={{ 
          paddingTop: '0px',
          marginTop: '0px',
          top: '0px',
          position: 'fixed',
          zIndex: 2147483647,
          height: '62px',
          minHeight: '62px',
          maxHeight: '62px',
          width: '100vw',
          left: '0px',
          right: '0px',
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(229, 231, 235, 0.8)',
          boxShadow: '0 2px 16px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          alignItems: 'center',
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
          willChange: 'transform',
          visibility: 'visible',
          opacity: 1,
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'manipulation',
          pointerEvents: 'auto',
          overflow: 'visible',
          clip: 'auto',
          clipPath: 'none',
          WebkitClipPath: 'none'
        }}
      >
        <div className="flex items-center justify-between h-14" style={{ paddingLeft: '0px', paddingRight: '16px' }}>
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex items-center space-x-3 motion-div"
          >
            <motion.button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </motion.button>
            <div className="flex items-center space-x-3">
              <div>
                <h1 className="text-lg font-bold text-gray-900">연락처 수정</h1>
                <p className="text-xs text-gray-500">전화번호와 이메일을 업데이트하세요</p>
              </div>
            </div>
          </motion.div>
        </div>
      </AnimatedHeader>

      {/* 스크롤 가능한 메인 컨텐츠 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="px-4 pt-20 space-y-6 pb-24"
      >
        {/* 연락처 정보 안내 카드 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="bg-green-50 border border-green-200 rounded-2xl p-4"
        >
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <FiPhone className="w-4 h-4" style={{ color: '#22C55E' }} />
            </div>
            <div>
              <h3 className="font-semibold text-green-900 mb-1" >연락처 정보</h3>
              <ul className="text-sm text-green-700 space-y-1">
                <li >• 전화번호는 010으로 시작하는 11자리 번호입니다</li>
                <li >• 다른 사용자와 중복될 수 없습니다</li>
                <li >• 정확한 연락처 정보를 입력해주세요</li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* 연락처 수정 폼 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6"
        >
          {isLoadingContact ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center space-y-3">
                                        <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full unified-animate-spin"></div>
                <p className="text-sm text-gray-500" >연락처 정보를 불러오는 중...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 전화번호 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2" >
                  전화번호 *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiPhone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    value={contact.mt_hp}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 transition-all duration-200"
                    placeholder="010-1234-5678"
                    maxLength={13}
                    required
                    onFocus={(e) => {
                      e.target.style.borderColor = '#22C55E';
                      e.target.style.boxShadow = `0 0 0 2px rgba(34, 197, 94, 0.2)`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#D1D5DB';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500" >
                  010으로 시작하는 휴대폰 번호를 입력하세요
                </p>
              </div>

              {/* 이메일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2" >
                  이메일 *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiMail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    value={contact.mt_email}
                    onChange={(e) => setContact(prev => ({ ...prev, mt_email: e.target.value }))}
                    className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 transition-all duration-200"
                    placeholder="example@email.com"
                    required
                    onFocus={(e) => {
                      e.target.style.borderColor = '#22C55E';
                      e.target.style.boxShadow = `0 0 0 2px rgba(34, 197, 94, 0.2)`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#D1D5DB';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500" >
                  유효한 이메일 주소를 입력하세요
                </p>
              </div>

              {/* 메시지 */}
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-xl text-sm flex items-center space-x-2 ${
                    message.includes('성공')
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {message.includes('성공') ? (
                    <FiMail className="w-4 h-4" />
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span >{message}</span>
                </motion.div>
              )}

              {/* 버튼 */}
              <motion.button
                type="submit"
                disabled={isLoading}
                className="w-full text-white py-3 px-4 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
                style={{
                  background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)'
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)';
                  }
                }}
                whileHover={{ scale: isLoading ? 1 : 1.02 }}
                whileTap={{ scale: isLoading ? 1 : 0.98 }}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                                                <div className="w-4 h-4 border-2 border-gray-300 border-t-white rounded-full unified-animate-spin"></div>
                    <span >업데이트 중...</span>
                  </div>
                ) : (
                  <span >연락처 업데이트</span>
                )}
              </motion.button>
            </form>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
} 