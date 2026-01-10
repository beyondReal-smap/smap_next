'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FiTrash2, FiShield, FiInfo, FiArrowRight, FiMail, FiSmartphone } from 'react-icons/fi';

export default function AccountDeletionPage() {
    const appName = "SMAP";
    const supportEmail = "admin@smap.site"; // 실제 고객센터 이메일로 수정 필요

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <img
                            src="/images/smap_logo_nobackground.png"
                            alt="SMAP Logo"
                            className="w-8 h-8 object-contain"
                        />
                        <span className="font-bold text-xl tracking-tight">{appName}</span>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-12">
                {/* Hero Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <h1 className="text-4xl font-extrabold text-gray-900 mb-4 leading-tight">
                        앱 계정 삭제 및 데이터 관리
                    </h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                        {appName}은 사용자의 개인정보 보호를 최우선으로 생각합니다.<br />
                        언제든지 계정 및 관련 데이터의 삭제를 요청하실 수 있습니다.
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-2 gap-8 mb-16">
                    {/* Method 1: App Deletion */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2, duration: 0.6 }}
                        className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                    >
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                            <FiSmartphone size={24} />
                        </div>
                        <h2 className="text-2xl font-bold mb-4">앱 내에서 즉시 탈퇴</h2>
                        <p className="text-gray-600 mb-6 leading-relaxed">
                            {appName} 앱에 로그인되어 있다면 설정 메뉴를 통해 즉시 계정을 삭제할 수 있습니다.
                        </p>
                        <ol className="space-y-3 mb-8 text-sm text-gray-700">
                            <li className="flex items-start">
                                <span className="font-bold mr-2">1.</span> 앱 우측 하단 [설정] 아이콘 클릭
                            </li>
                            <li className="flex items-start">
                                <span className="font-bold mr-2">2.</span> [계정 관리] 메뉴 선택
                            </li>
                            <li className="flex items-start">
                                <span className="font-bold mr-2">3.</span> [회원탈퇴] 버튼 클릭 후 절차 진행
                            </li>
                        </ol>
                        <a
                            href="/account-deletion/withdraw"
                            className="inline-flex items-center text-blue-600 font-semibold hover:underline group"
                        >
                            온라인 탈퇴 페이지 바로가기
                            <FiArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                        </a>
                    </motion.div>

                    {/* Method 2: Manual Request */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4, duration: 0.6 }}
                        className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                    >
                        <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-6">
                            <FiMail size={24} />
                        </div>
                        <h2 className="text-2xl font-bold mb-4">수동 삭제 요청</h2>
                        <p className="text-gray-600 mb-6 leading-relaxed">
                            앱 접속이 불가능하거나 로그인이 안 되는 경우 이메일을 통해 데이터 삭제를 요청하실 수 있습니다.
                        </p>
                        <div className="bg-gray-50 p-4 rounded-xl mb-6">
                            <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-2">고객센터 이메일</p>
                            <p className="text-lg font-mono text-gray-800">{supportEmail}</p>
                        </div>
                        <p className="text-sm text-gray-500 italic">
                            * 요청 시 계정 식별을 위해 가입하신 이메일 또는 전화번호를 반드시 기재해 주세요.
                        </p>
                    </motion.div>
                </div>

                {/* Data Policy Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.6 }}
                    className="bg-gray-900 text-white rounded-3xl p-10 shadow-xl overflow-hidden relative"
                >
                    <div className="relative z-10">
                        <h2 className="text-2xl font-bold mb-8 flex items-center">
                            <FiShield className="mr-3 text-blue-400" />
                            데이터 삭제 및 보관 정책
                        </h2>

                        <div className="grid md:grid-cols-2 gap-10">
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-blue-400 font-bold text-lg mb-2 flex items-center">
                                        <FiTrash2 className="mr-2" size={18} /> 삭제되는 데이터
                                    </h3>
                                    <ul className="text-gray-300 text-sm space-y-2 list-disc list-inside">
                                        <li>사용자 프로필 (이름, 이메일, 전화번호, 사진)</li>
                                        <li>모든 위치 추적 기록 및 장소 데이터</li>
                                        <li>활동 로그 및 서비스 이용 기록</li>
                                        <li>소셜 로그인 연동 정보</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-yellow-400 font-bold text-lg mb-2 flex items-center">
                                        <FiInfo className="mr-2" size={18} /> 보관 정책
                                    </h3>
                                    <p className="text-gray-300 text-sm leading-relaxed mb-3">
                                        탈퇴 완료 시 개인정보는 즉시 파기됩니다. 단, 아래의 경우 법령 및 약관에 따라 일정 기간 보관됩니다.
                                    </p>
                                    <ul className="text-gray-300 text-xs space-y-2">
                                        <li>• 중복 가입 방지 및 부정 이용 확인 정보: 탈퇴 후 30일 보관</li>
                                        <li>• 전자상거래 소비자 보호 법령에 따른 기록: 5년 보관</li>
                                        <li>• 서비스 로그 기록 (통신비밀보호법): 3개월 보관</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Subtle background decoration */}
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-600 opacity-10 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-purple-600 opacity-10 rounded-full blur-3xl"></div>
                </motion.div>

                <footer className="mt-16 text-center text-gray-500 text-sm">
                    <p>© {new Date().getFullYear()} {appName}. All rights reserved.</p>
                    <div className="mt-4 space-x-4">
                        <a href="/setting/terms/service" className="hover:text-gray-800 underline">이용약관</a>
                        <a href="/setting/terms/privacy" className="hover:text-gray-800 underline">개인정보처리방침</a>
                    </div>
                </footer>
            </main>
        </div>
    );
}
