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
    const [recentMembers, setRecentMembers] = useState<any[]>([]);
    const [recentNotices, setRecentNotices] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            // 통계 조회 (건수만)
            const statsRes = await fetch('/api/admin/stats');
            const statsData = await statsRes.json();
            console.log('[Dashboard] Stats API response:', statsData);

            // 최근 가입 회원 5명 조회
            const membersRes = await fetch('/api/admin/members?size=5');
            const membersData = await membersRes.json();

            // 공지사항 조회
            const noticesRes = await fetch('/api/admin/notices?size=5');
            const noticesData = await noticesRes.json();

            const members = Array.isArray(membersData.data) ? membersData.data : [];
            const notices = Array.isArray(noticesData.data) ? noticesData.data : [];

            // 최근 가입 회원 정렬
            const sortedMembers = [...members].sort((a: any, b: any) => {
                const dateA = new Date(a.mt_wdate || 0);
                const dateB = new Date(b.mt_wdate || 0);
                return dateB.getTime() - dateA.getTime();
            }).slice(0, 5);

            // 통계 데이터 설정
            if (statsData.success && statsData.data) {
                setStats({
                    totalMembers: statsData.data.total_members || 0,
                    totalGroups: statsData.data.total_groups || 0,
                    todaySignups: statsData.data.today_signups || 0,
                    pendingInquiries: statsData.data.pending_inquiries || 0,
                });
            }

            setRecentMembers(sortedMembers);
            setRecentNotices(notices.slice(0, 5));
        } catch (error) {
            console.error('Dashboard data load error:', error);
        } finally {
            setIsLoading(false);
        }
    };

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
                        <a href="/admin/members" className="text-indigo-600 text-sm font-medium hover:underline">
                            전체 보기
                        </a>
                    </div>
                    <div className="space-y-4">
                        {recentMembers.length > 0 ? recentMembers.map((member) => (
                            <div key={member.mt_idx} className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                                    <span className="text-indigo-600 font-medium">
                                        {(member.mt_name || member.mt_nickname || 'U')[0]}
                                    </span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-slate-900">
                                        {member.mt_name || member.mt_nickname || '이름 없음'}
                                    </p>
                                    <p className="text-xs text-slate-500">{member.mt_email || member.mt_hp || '-'}</p>
                                </div>
                                <span className="text-xs text-slate-400">
                                    {member.mt_wdate ? new Date(member.mt_wdate).toLocaleDateString('ko-KR') : '-'}
                                </span>
                            </div>
                        )) : (
                            <p className="text-sm text-slate-500 text-center py-4">최근 가입한 회원이 없습니다.</p>
                        )}
                    </div>
                </div>

                {/* 최근 공지사항 */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">최근 공지사항</h2>
                        <a href="/admin/notices" className="text-indigo-600 text-sm font-medium hover:underline">
                            전체 보기
                        </a>
                    </div>
                    <div className="space-y-4">
                        {recentNotices.length > 0 ? recentNotices.map((notice) => (
                            <div key={notice.nt_idx} className="flex items-start space-x-3">
                                <div className={`w-2 h-2 rounded-full mt-2 ${notice.nt_show === 'Y' ? 'bg-green-500' : 'bg-amber-500'}`} />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-slate-900">{notice.nt_title || '제목 없음'}</p>
                                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{notice.nt_content || ''}</p>
                                </div>
                                <span className="text-xs text-slate-400">
                                    {notice.nt_wdate ? new Date(notice.nt_wdate).toLocaleDateString('ko-KR') : '-'}
                                </span>
                            </div>
                        )) : (
                            <p className="text-sm text-slate-500 text-center py-4">최근 공지사항이 없습니다.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
