"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiLock, FiUser, FiEye, FiEyeOff } from 'react-icons/fi';

export default function AdminLoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            // 관리자 인증 API 호출
            const response = await fetch('/api/admin/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (data.success) {
                // 관리자 토큰 저장
                localStorage.setItem('admin-token', data.token);
                router.push('/admin');
            } else {
                setError(data.message || '로그인에 실패했습니다.');
            }
        } catch (err) {
            setError('서버 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* 로고 영역 */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
                        <FiLock className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">SMAP Admin</h1>
                    <p className="text-slate-400 mt-2">관리자 계정으로 로그인하세요</p>
                </div>

                {/* 로그인 폼 */}
                <form onSubmit={handleLogin} className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-8 border border-slate-700">
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-5">
                        {/* 아이디 입력 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                아이디
                            </label>
                            <div className="relative flex items-center bg-slate-700/50 border border-slate-600 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all overflow-hidden">
                                <FiUser className="w-5 h-5 text-slate-400 ml-3 flex-shrink-0" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="flex-1 px-3 py-3 bg-transparent border-none text-white placeholder-slate-400 focus:outline-none focus:ring-0 [&:-webkit-autofill]:bg-transparent [&:-webkit-autofill]:text-white [&:-webkit-autofill]:[background-color:transparent!important] [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_rgb(51_65_85/0.5)_inset!important] [&:-webkit-autofill]:[-webkit-text-fill-color:white!important]"
                                    placeholder="관리자 아이디"
                                    autoComplete="off"
                                    required
                                />
                            </div>
                        </div>

                        {/* 비밀번호 입력 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                비밀번호
                            </label>
                            <div className="relative flex items-center bg-slate-700/50 border border-slate-600 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all overflow-hidden">
                                <FiLock className="w-5 h-5 text-slate-400 ml-3 flex-shrink-0" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="flex-1 px-3 py-3 bg-transparent border-none text-white placeholder-slate-400 focus:outline-none focus:ring-0 [&:-webkit-autofill]:bg-transparent [&:-webkit-autofill]:text-white [&:-webkit-autofill]:[background-color:transparent!important] [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_rgb(51_65_85/0.5)_inset!important] [&:-webkit-autofill]:[-webkit-text-fill-color:white!important]"
                                    placeholder="비밀번호"
                                    autoComplete="off"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="px-3 text-slate-400 hover:text-white transition-colors"
                                >
                                    {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    </div>


                    {/* 로그인 버튼 */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full mt-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center space-x-2"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <span>로그인</span>
                        )}
                    </button>
                </form>

                {/* 푸터 */}
                <p className="text-center text-slate-500 text-sm mt-6">
                    © 2026 SMAP. All rights reserved.
                </p>
            </div>
        </div>
    );
}
