'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
    FiUser,
    FiLock,
    FiEye,
    FiEyeOff,
    FiAlertTriangle,
    FiArrowRight,
    FiArrowLeft,
    FiTrash2,
    FiCheck,
    FiX
} from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';

// 탈퇴 사유 리스트
const reasonList = [
    { id: 1, icon: '😴', text: '자주 사용하지 않아요' },
    { id: 2, icon: '🚫', text: '원하는 기능 부족' },
    { id: 3, icon: '😕', text: '서비스가 불편해요' },
    { id: 4, icon: '🔒', text: '개인정보 우려' },
    { id: 5, icon: '❓', text: '기타 이유' }
];

export default function OnlineWithdrawPage() {
    const router = useRouter();
    const appName = "SMAP";

    // Auth states
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [loginType, setLoginType] = useState<'phone' | 'google'>('phone');

    // Login form states
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Withdraw process states
    const [currentStep, setCurrentStep] = useState(1); // 1: 사유선택, 2: 최종확인
    const [reasons, setReasons] = useState<string[]>([]);
    const [etcReason, setEtcReason] = useState('');
    const [agreement, setAgreement] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // 페이지 로드 시 인증 상태 확인
    useEffect(() => {
        checkAuthStatus();
    }, []);

    const checkAuthStatus = async () => {
        try {
            const token = localStorage.getItem('auth-token') ||
                localStorage.getItem('smap_auth_token') ||
                localStorage.getItem('authToken');

            if (token && token !== 'null' && token !== 'undefined') {
                // 토큰 유효성 검증
                const response = await fetch('/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    setIsLoggedIn(true);
                }
            }
        } catch (error) {
            console.error('Auth check error:', error);
        } finally {
            setIsCheckingAuth(false);
        }
    };

    // 전화번호 포맷팅
    const formatPhoneNumber = (value: string) => {
        const numbers = value.replace(/[^\d]/g, '');
        if (numbers.length <= 3) return numbers;
        if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
        return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPhoneNumber(formatPhoneNumber(e.target.value));
    };

    // 전화번호 로그인
    const handlePhoneLogin = async () => {
        if (!phoneNumber || !password) {
            setError('전화번호와 비밀번호를 입력해주세요');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const cleanPhone = phoneNumber.replace(/-/g, '');

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mt_id: cleanPhone,
                    mt_pwd: password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || '로그인에 실패했습니다');
                return;
            }

            // 로그인 성공 - 토큰 저장
            if (data.token) {
                localStorage.setItem('auth-token', data.token);
                localStorage.setItem('smap_auth_token', data.token);
            }
            if (data.user) {
                localStorage.setItem('user-data', JSON.stringify(data.user));
                localStorage.setItem('smap_user_data', JSON.stringify(data.user));
            }

            setIsLoggedIn(true);
        } catch (error) {
            console.error('Login error:', error);
            setError('로그인 중 오류가 발생했습니다');
        } finally {
            setIsLoading(false);
        }
    };

    // 구글 로그인
    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError('');

        try {
            // 구글 로그인 팝업 또는 리다이렉트
            window.location.href = `/api/auth/google?redirect=${encodeURIComponent('/account-deletion/withdraw')}`;
        } catch (error) {
            console.error('Google login error:', error);
            setError('구글 로그인 중 오류가 발생했습니다');
            setIsLoading(false);
        }
    };

    // 탈퇴 사유 선택
    const handleReasonChange = (reason: string) => {
        setReasons(prev =>
            prev.includes(reason)
                ? prev.filter(r => r !== reason)
                : [...prev, reason]
        );
    };

    // 회원 탈퇴 실행
    const handleWithdraw = async () => {
        if (!agreement) {
            setError('안내사항에 동의해주세요');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('auth-token') ||
                localStorage.getItem('smap_auth_token') ||
                localStorage.getItem('authToken');

            const response = await fetch('/api/members/withdraw', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    reasons: reasons,
                    etcReason: etcReason
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || '회원탈퇴 처리에 실패했습니다');
            }

            // 성공
            setShowSuccessModal(true);

            // 로컬 스토리지 정리
            localStorage.removeItem('auth-token');
            localStorage.removeItem('smap_auth_token');
            localStorage.removeItem('authToken');
            localStorage.removeItem('user-data');
            localStorage.removeItem('smap_user_data');

            // 3초 후 메인 페이지로 이동
            setTimeout(() => {
                router.push('/');
            }, 3000);

        } catch (error) {
            console.error('Withdraw error:', error);
            setError(error instanceof Error ? error.message : '회원탈퇴 처리 중 오류가 발생했습니다');
        } finally {
            setIsLoading(false);
        }
    };

    // 로딩 중
    if (isCheckingAuth) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-lg mx-auto px-6 h-16 flex items-center justify-between">
                    <button
                        onClick={() => router.push('/account-deletion')}
                        className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <FiArrowLeft size={24} />
                    </button>
                    <span className="font-bold text-lg">온라인 회원탈퇴</span>
                    <div className="w-10"></div>
                </div>
            </header>

            <main className="max-w-lg mx-auto px-6 py-8">
                {!isLoggedIn ? (
                    // 로그인 폼
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <FiTrash2 size={32} />
                            </div>
                            <h1 className="text-2xl font-bold mb-2">회원탈퇴</h1>
                            <p className="text-gray-600">
                                본인 확인을 위해 로그인이 필요합니다
                            </p>
                        </div>

                        {/* 로그인 타입 선택 */}
                        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                            <button
                                onClick={() => setLoginType('phone')}
                                className={`flex-1 py-3 rounded-lg font-medium transition-all ${loginType === 'phone'
                                    ? 'bg-white shadow text-gray-900'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                전화번호 로그인
                            </button>
                            <button
                                onClick={() => setLoginType('google')}
                                className={`flex-1 py-3 rounded-lg font-medium transition-all ${loginType === 'google'
                                    ? 'bg-white shadow text-gray-900'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                소셜 로그인
                            </button>
                        </div>

                        {loginType === 'phone' ? (
                            <div className="space-y-4">
                                {/* 전화번호 입력 */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        전화번호
                                    </label>
                                    <div className="relative">
                                        <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <input
                                            type="tel"
                                            value={phoneNumber}
                                            onChange={handlePhoneChange}
                                            placeholder="010-1234-5678"
                                            className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                {/* 비밀번호 입력 */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        비밀번호
                                    </label>
                                    <div className="relative">
                                        <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="비밀번호 입력"
                                            className="w-full pl-12 pr-12 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                                        </button>
                                    </div>
                                </div>

                                {/* 에러 메시지 */}
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg"
                                    >
                                        <FiAlertTriangle size={18} />
                                        <span className="text-sm">{error}</span>
                                    </motion.div>
                                )}

                                {/* 로그인 버튼 */}
                                <button
                                    onClick={handlePhoneLogin}
                                    disabled={isLoading}
                                    className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                                >
                                    {isLoading ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    ) : (
                                        <>
                                            로그인 후 탈퇴 진행
                                            <FiArrowRight size={18} />
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* 구글 로그인 버튼 */}
                                <button
                                    onClick={handleGoogleLogin}
                                    disabled={isLoading}
                                    className="w-full py-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 shadow-sm"
                                >
                                    <FcGoogle size={24} />
                                    Google 계정으로 로그인
                                </button>

                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg"
                                    >
                                        <FiAlertTriangle size={18} />
                                        <span className="text-sm">{error}</span>
                                    </motion.div>
                                )}
                            </div>
                        )}

                        <p className="text-center text-sm text-gray-500 mt-6">
                            회원탈퇴를 위해 본인 확인이 필요합니다.<br />
                            가입 시 사용한 방법으로 로그인해주세요.
                        </p>
                    </motion.div>
                ) : (
                    // 탈퇴 프로세스
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                    >
                        {currentStep === 1 ? (
                            // Step 1: 탈퇴 사유 선택
                            <>
                                <div className="text-center mb-6">
                                    <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <FiAlertTriangle size={32} />
                                    </div>
                                    <h2 className="text-xl font-bold mb-2">탈퇴 사유를 선택해주세요</h2>
                                    <p className="text-gray-600 text-sm">
                                        서비스 개선에 소중한 의견으로 활용됩니다
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    {reasonList.map((reason) => (
                                        <button
                                            key={reason.id}
                                            onClick={() => handleReasonChange(reason.text)}
                                            className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-3 text-left ${reasons.includes(reason.text)
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 bg-white hover:border-gray-300'
                                                }`}
                                        >
                                            <span className="text-2xl">{reason.icon}</span>
                                            <span className="font-medium">{reason.text}</span>
                                            {reasons.includes(reason.text) && (
                                                <FiCheck className="ml-auto text-blue-600" size={20} />
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {reasons.includes('기타 이유') && (
                                    <textarea
                                        value={etcReason}
                                        onChange={(e) => setEtcReason(e.target.value)}
                                        placeholder="기타 사유를 입력해주세요"
                                        className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none h-24"
                                    />
                                )}

                                {error && (
                                    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                                        <FiAlertTriangle size={18} />
                                        <span className="text-sm">{error}</span>
                                    </div>
                                )}

                                <button
                                    onClick={() => {
                                        if (reasons.length === 0) {
                                            setError('탈퇴 사유를 선택해주세요');
                                            return;
                                        }
                                        setError('');
                                        setCurrentStep(2);
                                    }}
                                    className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                                >
                                    다음
                                    <FiArrowRight size={18} />
                                </button>
                            </>
                        ) : (
                            // Step 2: 최종 확인
                            <>
                                <div className="text-center mb-6">
                                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <FiTrash2 size={32} />
                                    </div>
                                    <h2 className="text-xl font-bold mb-2">정말 탈퇴하시겠습니까?</h2>
                                    <p className="text-gray-600 text-sm">
                                        아래 내용을 확인하신 후 진행해주세요
                                    </p>
                                </div>

                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2 text-sm">
                                    <p className="flex items-start gap-2">
                                        <FiX className="text-red-500 mt-0.5 flex-shrink-0" />
                                        <span>계정 정보 및 모든 데이터가 <strong>영구 삭제</strong>됩니다</span>
                                    </p>
                                    <p className="flex items-start gap-2">
                                        <FiX className="text-red-500 mt-0.5 flex-shrink-0" />
                                        <span>삭제된 데이터는 <strong>복구가 불가능</strong>합니다</span>
                                    </p>
                                    <p className="flex items-start gap-2">
                                        <FiX className="text-red-500 mt-0.5 flex-shrink-0" />
                                        <span>탈퇴 후 <strong>30일간 재가입이 제한</strong>됩니다</span>
                                    </p>
                                </div>

                                <label className="flex items-center gap-3 p-4 bg-gray-100 rounded-xl cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={agreement}
                                        onChange={(e) => setAgreement(e.target.checked)}
                                        className="w-5 h-5 text-blue-600 rounded"
                                    />
                                    <span className="text-sm">
                                        위 내용을 확인했으며, 회원탈퇴에 동의합니다
                                    </span>
                                </label>

                                {error && (
                                    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                                        <FiAlertTriangle size={18} />
                                        <span className="text-sm">{error}</span>
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            setCurrentStep(1);
                                            setError('');
                                        }}
                                        className="flex-1 py-4 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-all"
                                    >
                                        이전
                                    </button>
                                    <button
                                        onClick={handleWithdraw}
                                        disabled={isLoading || !agreement}
                                        className="flex-1 py-4 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                                    >
                                        {isLoading ? (
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        ) : (
                                            '회원탈퇴'
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
            </main>

            {/* 성공 모달 */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white rounded-2xl p-8 max-w-sm w-full text-center"
                    >
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FiCheck size={32} />
                        </div>
                        <h3 className="text-xl font-bold mb-2">탈퇴 완료</h3>
                        <p className="text-gray-600 mb-4">
                            그동안 {appName}을 이용해주셔서 감사합니다.<br />
                            잠시 후 메인 페이지로 이동합니다.
                        </p>
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
