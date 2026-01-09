"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    FiHome,
    FiUsers,
    FiLayers,
    FiBell,
    FiMessageSquare,
    FiSend,
    FiLogOut,
    FiMenu,
    FiX,
    FiChevronRight
} from 'react-icons/fi';

interface AdminLayoutProps {
    children: React.ReactNode;
}

const menuItems = [
    { href: '/admin', icon: FiHome, label: '대시보드' },
    { href: '/admin/members', icon: FiUsers, label: '회원 관리' },
    { href: '/admin/groups', icon: FiLayers, label: '그룹 관리' },
    { href: '/admin/notices', icon: FiBell, label: '공지사항' },
    { href: '/admin/inquiries', icon: FiMessageSquare, label: '문의 관리' },
    { href: '/admin/fcm', icon: FiSend, label: 'FCM 발송' },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // 로그인 페이지는 레이아웃 적용 안함
    const isLoginPage = pathname === '/admin/login';

    useEffect(() => {
        // 관리자 인증 체크
        const token = localStorage.getItem('admin-token');

        if (!token && !isLoginPage) {
            router.push('/admin/login');
        } else if (token) {
            setIsAuthenticated(true);
        }
        setIsLoading(false);
    }, [pathname, router, isLoginPage]);

    const handleLogout = () => {
        localStorage.removeItem('admin-token');
        router.push('/admin/login');
    };

    // 로그인 페이지는 레이아웃 없이 렌더링
    if (isLoginPage) {
        return <>{children}</>;
    }

    // 로딩 중
    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
        );
    }

    // 인증되지 않은 경우
    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="h-screen bg-slate-100 overflow-hidden">
            {/* 모바일 메뉴 오버레이 */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* 사이드바 - 고정 */}
            <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
                {/* 로고 */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
                    <Link href="/admin" className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">S</span>
                        </div>
                        <span className="text-white font-semibold">SMAP Admin</span>
                    </Link>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden text-slate-400 hover:text-white"
                    >
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                {/* 메뉴 */}
                <nav className="p-4 space-y-1">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href ||
                            (item.href !== '/admin' && pathname?.startsWith(item.href));

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={`
                  flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200
                  ${isActive
                                        ? 'bg-indigo-600 text-white'
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }
                `}
                            >
                                <item.icon className="w-5 h-5" />
                                <span className="font-medium">{item.label}</span>
                                {isActive && <FiChevronRight className="w-4 h-4 ml-auto" />}
                            </Link>
                        );
                    })}
                </nav>

                {/* 로그아웃 버튼 */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
                    <button
                        onClick={handleLogout}
                        className="flex items-center space-x-3 w-full px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-all duration-200"
                    >
                        <FiLogOut className="w-5 h-5" />
                        <span className="font-medium">로그아웃</span>
                    </button>
                </div>
            </aside>

            {/* 메인 콘텐츠 - 헤더 고정, 본문만 스크롤 */}
            <div className="lg:ml-64 h-screen flex flex-col">
                {/* 헤더 - 고정 */}
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden text-slate-600 hover:text-slate-900"
                    >
                        <FiMenu className="w-6 h-6" />
                    </button>

                    <div className="flex items-center space-x-4 ml-auto">
                        <span className="text-sm text-slate-600">관리자</span>
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                            <span className="text-indigo-600 font-medium text-sm">A</span>
                        </div>
                    </div>
                </header>

                {/* 페이지 콘텐츠 - 스크롤 가능 */}
                <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
