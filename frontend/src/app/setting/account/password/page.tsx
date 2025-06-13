'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  FiEye, 
  FiEyeOff, 
  FiLock, 
  FiKey, 
  FiShield, 
  FiCheck, 
  FiX, 
  FiAlertTriangle,
  FiSave
} from 'react-icons/fi';
import { HiCheckCircle } from 'react-icons/hi2';

// 비밀번호 강도 검사 함수
const checkPasswordStrength = (password: string) => {
  if (!password) {
    return {
      score: 0,
      level: '매우 약함',
      color: '#ef4444',
      feedback: ['8자 이상', '소문자', '대문자', '숫자', '특수문자'],
      percentage: 0
    };
  }

  let score = 0;
  let feedback = [];

  // 길이 체크
  const hasLength = password.length >= 8;
  if (hasLength) {
    score += 1;
  } else {
    feedback.push('8자 이상');
  }

  // 소문자 체크
  const hasLowercase = /[a-z]/.test(password);
  if (hasLowercase) {
    score += 1;
  } else {
    feedback.push('소문자');
  }

  // 대문자 체크
  const hasUppercase = /[A-Z]/.test(password);
  if (hasUppercase) {
    score += 1;
  } else {
    feedback.push('대문자');
  }

  // 숫자 체크
  const hasNumber = /[0-9]/.test(password);
  if (hasNumber) {
    score += 1;
  } else {
    feedback.push('숫자');
  }

  // 특수문자 체크
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  if (hasSpecial) {
    score += 1;
  } else {
    feedback.push('특수문자');
  }



  const levels = ['매우 약함', '약함', '보통', '강함', '매우 강함'];
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];

  // 안전한 배열 접근 - score가 5일 때는 인덱스 4(매우 강함)를 사용
  const levelIndex = Math.min(score, levels.length - 1);
  const level = levels[levelIndex] || '매우 약함';
  const color = colors[levelIndex] || '#ef4444';

  return {
    score,
    level,
    color,
    feedback,
    percentage: (score / 5) * 100
  };
};

export default function PasswordChangePage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // 비밀번호 강도 계산
  const passwordStrength = checkPasswordStrength(newPassword);

  // 뒤로가기 핸들러
  const handleBack = () => {
    router.back();
  };

  // 저장 핸들러
  const handleSave = async () => {
    setErrors({});
    
    // 유효성 검사
    const newErrors: {[key: string]: string} = {};
    
    if (!currentPassword) {
      newErrors.currentPassword = '현재 비밀번호를 입력해주세요';
    }
    
    if (!newPassword) {
      newErrors.newPassword = '새 비밀번호를 입력해주세요';
    } else if (newPassword.length < 8) {
      newErrors.newPassword = '비밀번호는 8자 이상이어야 합니다';
    }
    
    if (!confirmPassword) {
      newErrors.confirmPassword = '비밀번호 확인을 입력해주세요';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = '비밀번호가 일치하지 않습니다';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    
    try {
      // JWT 토큰 디버깅
      const token = localStorage.getItem('auth-token');
      console.log('[PASSWORD CHANGE] JWT 토큰 확인:', token);
      console.log('[PASSWORD CHANGE] 토큰 존재:', !!token);
      console.log('[PASSWORD CHANGE] 토큰 길이:', token ? token.length : 0);
      
      if (!token || token === 'null' || token === 'undefined') {
        setErrors({ general: '로그인이 필요합니다. 다시 로그인해주세요.' });
        setIsLoading(false);
        return;
      }
      
      // 백엔드 API로 비밀번호 변경 요청
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // JWT 토큰
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setErrors({ currentPassword: '현재 비밀번호가 일치하지 않습니다' });
        } else if (response.status === 400) {
          setErrors({ general: data.message || '잘못된 요청입니다' });
        } else {
          throw new Error(data.message || '비밀번호 변경에 실패했습니다');
        }
        return;
      }

      setShowSuccessModal(true);
    } catch (error) {
      console.error('비밀번호 변경 오류:', error);
      setErrors({ general: '비밀번호 변경에 실패했습니다. 다시 시도해주세요.' });
    } finally {
      setIsLoading(false);
    }
  };

  // 성공 모달 확인
  const handleSuccessConfirm = () => {
    setShowSuccessModal(false);
    router.back();
  };

  // 비밀번호 강도 색상
  const getStrengthColor = (score: number) => {
    const colors = ['#ef4444', '#F97315', '#eab308', '#22c55e', '#10b981'];
    const colorIndex = Math.min(score, colors.length - 1);
    return colors[colorIndex] || '#ef4444';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* 헤더 - 위에서 슬라이드 내려오는 애니메이션 */}
      <motion.header 
        initial={{ y: -100, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ 
          delay: 0.2, 
          duration: 0.8, 
          ease: [0.25, 0.46, 0.45, 0.94],
          opacity: { duration: 0.6 },
          scale: { duration: 0.6 }
        }}
        className="fixed top-0 left-0 right-0 z-20 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm"
      >
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex items-center justify-between h-16 px-4"
        >
          <div className="flex items-center space-x-3">
            <motion.button 
              onClick={handleBack}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </motion.button>
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              className="flex items-center space-x-3"
            >
              <div>
                <h1 className="text-lg font-bold text-gray-900">비밀번호 변경</h1>
                <p className="text-xs text-gray-500">계정 보안을 위해 주기적으로 변경하세요</p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </motion.header>

      {/* 스크롤 가능한 메인 컨텐츠 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="px-4 pt-20 space-y-6 pb-20"
      >
        {/* 보안 안내 카드 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="bg-orange-50 border border-orange-200 rounded-2xl p-4"
          style={{ backgroundColor: '#FFF7ED', borderColor: '#FDBA74' }}
        >
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                 style={{ backgroundColor: '#FED7AA' }}>
              <FiShield className="w-4 h-4" style={{ color: '#F97315' }} />
            </div>
            <div>
              <h3 className="font-semibold mb-1" style={{ color: '#9A3412' }}>보안 권장사항</h3>
              <ul className="text-sm space-y-1" style={{ color: '#C2410C' }}>
                <li>• 8자 이상의 비밀번호를 사용하세요</li>
                <li>• 대문자, 소문자, 숫자, 특수문자를 조합하세요</li>
                <li>• 다른 사이트와 다른 비밀번호를 사용하세요</li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* 비밀번호 변경 폼 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6"
        >
          <div className="space-y-6">
            {/* 현재 비밀번호 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                현재 비밀번호
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiLock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={`block w-full pl-10 pr-12 py-3 border ${
                    errors.currentPassword ? 'border-red-300' : 'border-gray-300'
                  } rounded-xl focus:ring-2 transition-all duration-200`}
                  style={{ 
                    '--tw-ring-color': '#F97315',
                    '--tw-border-opacity': '1'
                  } as any}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#F97315';
                    e.target.style.boxShadow = '0 0 0 2px rgba(249, 115, 21, 0.2)';
                  }}
                  onBlur={(e) => {
                    if (!errors.currentPassword) {
                      e.target.style.borderColor = '#D1D5DB';
                    }
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="현재 비밀번호를 입력하세요"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showCurrentPassword ? 
                    <FiEyeOff className="h-5 w-5 text-gray-400" /> : 
                    <FiEye className="h-5 w-5 text-gray-400" />
                  }
                </button>
              </div>
              {errors.currentPassword && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <FiX className="w-4 h-4 mr-1" />
                  {errors.currentPassword}
                </p>
              )}
            </div>

            {/* 새 비밀번호 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                새 비밀번호
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiKey className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`block w-full pl-10 pr-12 py-3 border ${
                    errors.newPassword ? 'border-red-300' : 'border-gray-300'
                  } rounded-xl focus:ring-2 transition-all duration-200`}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#F97315';
                    e.target.style.boxShadow = '0 0 0 2px rgba(249, 115, 21, 0.2)';
                  }}
                  onBlur={(e) => {
                    if (!errors.newPassword) {
                      e.target.style.borderColor = '#D1D5DB';
                    }
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="새 비밀번호를 입력하세요"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showNewPassword ? 
                    <FiEyeOff className="h-5 w-5 text-gray-400" /> : 
                    <FiEye className="h-5 w-5 text-gray-400" />
                  }
                </button>
              </div>
              {errors.newPassword && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <FiX className="w-4 h-4 mr-1" />
                  {errors.newPassword}
                </p>
              )}

              {/* 비밀번호 강도 표시 */}
              {newPassword && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">비밀번호 강도</span>
                    <span 
                      className="text-sm font-medium"
                      style={{ color: getStrengthColor(passwordStrength.score) }}
                    >
                      {passwordStrength.level}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${passwordStrength.percentage}%`,
                        backgroundColor: getStrengthColor(passwordStrength.score)
                      }}
                    />
                  </div>
                  {passwordStrength.feedback.length > 0 && (
                    <p className="mt-2 text-xs text-gray-500">
                      필요한 조건: {passwordStrength.feedback.join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                비밀번호 확인
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiCheck className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`block w-full pl-10 pr-12 py-3 border ${
                    errors.confirmPassword ? 'border-red-300' : 
                    confirmPassword && newPassword === confirmPassword ? 'border-green-300' :
                    'border-gray-300'
                  } rounded-xl focus:ring-2 transition-all duration-200`}
                  onFocus={(e) => {
                    if (!errors.confirmPassword && !(confirmPassword && newPassword === confirmPassword)) {
                      e.target.style.borderColor = '#F97315';
                      e.target.style.boxShadow = '0 0 0 2px rgba(249, 115, 21, 0.2)';
                    }
                  }}
                  onBlur={(e) => {
                    if (!errors.confirmPassword && !(confirmPassword && newPassword === confirmPassword)) {
                      e.target.style.borderColor = '#D1D5DB';
                    }
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="새 비밀번호를 다시 입력하세요"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showConfirmPassword ? 
                    <FiEyeOff className="h-5 w-5 text-gray-400" /> : 
                    <FiEye className="h-5 w-5 text-gray-400" />
                  }
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <FiX className="w-4 h-4 mr-1" />
                  {errors.confirmPassword}
                </p>
              )}
              {confirmPassword && newPassword === confirmPassword && (
                <p className="mt-1 text-sm text-green-600 flex items-center">
                  <FiCheck className="w-4 h-4 mr-1" />
                  비밀번호가 일치합니다
                </p>
              )}
            </div>

            {/* 에러 메시지 */}
            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-700 flex items-center">
                  <FiAlertTriangle className="w-4 h-4 mr-2" />
                  {errors.general}
                </p>
              </div>
            )}

            {/* 저장 버튼 */}
            <button
              onClick={handleSave}
              disabled={isLoading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              className="w-full py-4 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              style={{ 
                backgroundColor: '#F97315',
                background: 'linear-gradient(135deg, #F97315 0%, #EA580C 100%)'
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #EA580C 0%, #DC2626 100%)';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #F97315 0%, #EA580C 100%)';
                }
              }}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>변경 중...</span>
                </>
              ) : (
                <>
                  <FiSave className="w-4 h-4" />
                  <span>비밀번호 변경</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>

      {/* 성공 모달 */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl w-full max-w-xs mx-auto"
          >
            <div className="p-6">
              <div className="text-center mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <HiCheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">변경 완료</h3>
                <p className="text-sm text-gray-600">
                  비밀번호가 성공적으로 변경되었습니다.
                </p>
              </div>
              
              <button
                onClick={handleSuccessConfirm}
                className="w-full py-3 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors"
              >
                확인
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
} 