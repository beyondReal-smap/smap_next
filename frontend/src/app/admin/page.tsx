"use client";

import React, { useState, useEffect } from 'react';
import {
    FiUsers,
    FiLayers,
    FiMessageSquare,
    FiTrendingUp,
    FiUserPlus,
    FiActivity,
    FiCalendar,
    FiArrowUp,
    FiArrowDown
} from 'react-icons/fi';

interface StatCardProps {
    title: string;
    value: string | number;
    change?: number;
    icon: React.ElementType;
    color: string;
}

const StatCard = ({ title, value, change, icon: Icon, color }: StatCardProps) => (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 hover:shadow-lg transition-shadow">
        <div className="flex items-start justify-between">
            <div>
                <p className="text-slate-500 text-sm font-medium">{title}</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
                {change !== undefined && (
                    <div className={`flex items-center mt-2 text-sm ${change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {change >= 0 ? <FiArrowUp className="w-4 h-4 mr-1" /> : <FiArrowDown className="w-4 h-4 mr-1" />}
                        <span>{Math.abs(change)}% 전월 대비</span>
                    </div>
                )}
            </div>
            <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center`}>
                <Icon className="w-6 h-6 text-white" />
            </div>
        </div>
    </div>
);

export default function AdminDashboardPage() {
    const [stats, setStats] = useState({
        totalMembers: 0,
        totalGroups: 0,
        todaySignups: 0,
        pendingInquiries: 0,
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // TODO: 실제 API 연동
        // 임시 데이터
        setTimeout(() => {
            setStats({
                totalMembers: 1247,
                totalGroups: 328,
                todaySignups: 23,
                pendingInquiries: 8,
            });
            setIsLoading(false);
        }, 500);
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 페이지 타이틀 */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">대시보드</h1>
                <p className="text-slate-500 mt-1">SMAP 서비스 현황을 한눈에 확인하세요</p>
            </div>

            {/* 통계 카드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="전체 회원"
                    value={stats.totalMembers.toLocaleString()}
                    change={12}
                    icon={FiUsers}
                    color="bg-indigo-500"
                />
                <StatCard
                    title="전체 그룹"
                    value={stats.totalGroups.toLocaleString()}
                    change={8}
                    icon={FiLayers}
                    color="bg-emerald-500"
                />
                <StatCard
                    title="오늘 가입자"
                    value={stats.todaySignups}
                    icon={FiUserPlus}
                    color="bg-amber-500"
                />
                <StatCard
                    title="대기 중 문의"
                    value={stats.pendingInquiries}
                    icon={FiMessageSquare}
                    color="bg-rose-500"
                />
            </div>

            {/* 최근 활동 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 최근 가입 회원 */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">최근 가입 회원</h2>
                        <button className="text-indigo-600 text-sm font-medium hover:underline">
                            전체 보기
                        </button>
                    </div>
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                                    <span className="text-slate-600 font-medium">U</span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-slate-900">사용자 {i}</p>
                                    <p className="text-xs text-slate-500">user{i}@example.com</p>
                                </div>
                                <span className="text-xs text-slate-400">방금 전</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 최근 문의 */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">최근 문의</h2>
                        <button className="text-indigo-600 text-sm font-medium hover:underline">
                            전체 보기
                        </button>
                    </div>
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-start space-x-3">
                                <div className={`w-2 h-2 rounded-full mt-2 ${i <= 3 ? 'bg-amber-500' : 'bg-green-500'}`} />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-slate-900">문의 제목 {i}</p>
                                    <p className="text-xs text-slate-500 mt-1">앱 사용 중 문제가 발생했습니다...</p>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full ${i <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                    {i <= 3 ? '대기' : '완료'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
