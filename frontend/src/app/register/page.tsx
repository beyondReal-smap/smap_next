'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phoneNumber: '',
    agreeTerms: false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const router = useRouter();

  const formatPhoneNumber = (value: string) => {
    if (!value) return value;
    const phoneNumber = value.replace(/[^0-9]/g, '');
    const phoneNumberLength = phoneNumber.length;

    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
      return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
    }
    if (phoneNumberLength < 11) {
      return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6)}`;
    }
    // 11자리 숫자인 경우 (010-XXXX-XXXX)
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 7)}-${phoneNumber.slice(7, 11)}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    let newFormData = { ...formData };
    let newErrors = { ...errors };

    if (name === 'phoneNumber') {
      const formattedPhoneNumber = formatPhoneNumber(value);
      newFormData = {
        ...newFormData,
        [name]: formattedPhoneNumber
      };
    } else {
      newFormData = {
        ...newFormData,
      [name]: type === 'checkbox' ? checked : value
      };
    }

    setFormData(newFormData);
    
    // 실시간 유효성 검사 및 오류 메시지 업데이트
    if (errors[name]) {
      newErrors = { ...newErrors, [name]: '' }; // 기존 오류 제거
    }

    // 비밀번호 및 비밀번호 확인 실시간 비교
    if (name === 'password' || name === 'confirmPassword') {
      const currentPassword = name === 'password' ? value : newFormData.password;
      const currentConfirmPassword = name === 'confirmPassword' ? value : newFormData.confirmPassword;

      if (currentPassword && currentConfirmPassword && currentPassword !== currentConfirmPassword) {
        newErrors.confirmPassword = '비밀번호가 일치하지 않습니다.';
      } else if (currentConfirmPassword && currentPassword === currentConfirmPassword) {
        // 비밀번호가 일치하면 confirmPassword 에러 메시지 제거
        newErrors.confirmPassword = '';
      }
      // 비밀번호 길이 검사 (password 필드 변경 시)
      if (name === 'password' && currentPassword && currentPassword.length < 8) {
        newErrors.password = '비밀번호는 최소 8자 이상이어야 합니다.';
      } else if (name === 'password' && currentPassword && currentPassword.length >= 8) {
        newErrors.password = ''; // 길이가 충족되면 에러 메시지 제거
      }
    }
    
    // 이름 필드 실시간 유효성 검사
    if (name === 'name' && !newFormData.name.trim()) {
      newErrors.name = '이름을 입력해주세요.';
    } else if (name === 'name' && newFormData.name.trim()) {
      newErrors.name = '';
    }

    // 이메일 필드 실시간 유효성 검사
    if (name === 'email') {
      if (!newFormData.email) {
        newErrors.email = '이메일을 입력해주세요.';
      } else if (!/\\S+@\\S+\\.\\S+/.test(newFormData.email)) {
        newErrors.email = '유효한 이메일 형식이 아닙니다.';
      } else {
        newErrors.email = '';
      }
    }
    
    // 전화번호 필드 실시간 유효성 검사
    if (name === 'phoneNumber') {
      const rawPhoneNumber = newFormData.phoneNumber.replace(/-/g, '');
      if (!rawPhoneNumber.trim()) {
        newErrors.phoneNumber = '전화번호를 입력해주세요.';
      } else if (!/^[0-9]{10,11}$/.test(rawPhoneNumber)) {
        newErrors.phoneNumber = '유효한 전화번호 형식이 아닙니다. (10~11자리 숫자)';
      } else {
        newErrors.phoneNumber = '';
      }
    }

    setErrors(newErrors);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // 이름 검증 (필수)
    if (!formData.name.trim()) {
      newErrors.name = '이름을 입력해주세요.';
    }
    
    // 이메일 검증
    if (!formData.email) {
      newErrors.email = '이메일을 입력해주세요.';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = '유효한 이메일 형식이 아닙니다.';
    }

    // 전화번호 검증 (필수)
    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = '전화번호를 입력해주세요.';
    } else if (!/^[0-9]{10,11}$/.test(formData.phoneNumber.replace(/-/g, ''))) { // 숫자 10~11자리 (하이픈 제외)
      newErrors.phoneNumber = '유효한 전화번호 형식이 아닙니다. (예: 01012345678)';
    }
    
    // 비밀번호 검증
    if (!formData.password) {
      newErrors.password = '비밀번호를 입력해주세요.';
    } else if (formData.password.length < 8) {
      newErrors.password = '비밀번호는 최소 8자 이상이어야 합니다.';
    }
    
    // 비밀번호 확인 검증
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = '비밀번호 확인을 입력해주세요.';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '비밀번호가 일치하지 않습니다.';
    }
    
    // 약관 동의 검증
    if (!formData.agreeTerms) {
      newErrors.agreeTerms = '약관에 동의해주세요.';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    setGeneralError('');
    
    try {
      // Next.js API 라우트를 호출하도록 수정
      const response = await fetch('/api/auth/register-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          phoneNumber: formData.phoneNumber.replace(/-/g, ''),
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '회원가입에 실패했습니다.');
      }
      
      // 회원가입 성공 시 처리
      router.push('/register-success'); // 성공 페이지로 리다이렉트 또는 로그인 페이지로 리다이렉트
    } catch (err: any) {
      setGeneralError(err.message || '회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 animate-fadeIn">
        <div className="text-center mb-6">
          <Image 
            className="mx-auto h-20 w-auto"
            src="/images/smap_logo.webp"
            alt="SMAP Logo"
            width={160}
            height={80}
            priority
          />
          <h2 className="mt-1 text-2xl font-bold text-gray-900 font-suite">회원가입</h2>
          <p className="mt-2 text-sm text-gray-600">계정을 만들고 서비스를 이용하세요</p>
        </div>

        <div className="card bg-white p-8 sm:p-10 rounded-xl shadow-2xl border border-gray-100">
          {generalError && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
              <p className="text-sm">{generalError}</p>
            </div>
          )}
          
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1 font-suite">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                value={formData.name}
                onChange={handleChange}
                className={`appearance-none block w-full px-6 py-3 border ${errors.name ? 'border-red-500' : 'border-gray-300'} rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500`}
                placeholder="홍길동"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1 font-suite">
                이메일 <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                className={`appearance-none block w-full px-6 py-3 border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500`}
                placeholder="name@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1 font-suite">
                전화번호 <span className="text-red-500">*</span>
              </label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                autoComplete="tel"
                value={formData.phoneNumber}
                onChange={handleChange}
                maxLength={13}
                className={`appearance-none block w-full px-6 py-3 border ${errors.phoneNumber ? 'border-red-500' : 'border-gray-300'} rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500`}
                placeholder="01012345678 ('-' 없이 입력)"
              />
              {errors.phoneNumber && (
                <p className="mt-1 text-sm text-red-600">{errors.phoneNumber}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1 font-suite">
                비밀번호 <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={formData.password}
                onChange={handleChange}
                className={`appearance-none block w-full px-6 py-3 border ${errors.password ? 'border-red-500' : 'border-gray-300'} rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500`}
                placeholder="8자 이상 입력해주세요"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1 font-suite">
                비밀번호 확인 <span className="text-red-500">*</span>
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={`appearance-none block w-full px-6 py-3 border ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'} rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500`}
                placeholder="비밀번호를 다시 입력해주세요"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>

            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="agreeTerms"
                  name="agreeTerms"
                  type="checkbox"
                  checked={formData.agreeTerms}
                  onChange={handleChange}
                  className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="agreeTerms" className={`font-medium ${errors.agreeTerms ? 'text-red-600' : 'text-gray-700'} font-suite`}>
                  <span>서비스 이용약관 및 개인정보 처리방침에<br />동의합니다 <span className="text-red-500">*</span></span>
                </label>
                {errors.agreeTerms && (
                  <p className="mt-1 text-sm text-red-600">{errors.agreeTerms}</p>
                )}
                <p className="text-gray-500 mt-1">
                  <Link href="/terms" className="text-indigo-600 hover:text-indigo-500 underline">
                    약관 보기
                  </Link>
                </p>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3 px-6 border border-transparent rounded-xl text-base font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-md transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed font-suite"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    가입 중...
                  </>
                ) : '회원가입'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 font-suite">
              이미 계정이 있으신가요?{' '}
              <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
                로그인하기
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 