"use client";

import React, { useState, useEffect } from 'react';
import { FiSearch, FiUsers, FiCalendar, FiMapPin, FiMoreVertical, FiEye, FiTrash2, FiX } from 'react-icons/fi';

interface Group {
    sgt_idx: number;
    sgt_title: string;
    sgt_memo: string;
    member_count: number;
    schedule_count: number;
    location_count: number;
    sgt_wdate: string;
    owner_name: string;
}

export default function AdminGroupsPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('admin-token');
            const response = await fetch('/api/admin/groups?show_hidden=true', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            const result = await response.json();

            if (result.success && result.data) {
                // API 응답 데이터를 Group 인터페이스에 맞게 변환
                const mappedGroups = result.data.map((g: any) => ({
                    sgt_idx: g.sgt_idx,
                    sgt_title: g.sgt_title || '제목 없음',
                    sgt_memo: g.sgt_memo || '',
                    member_count: g.member_count || 0,
                    schedule_count: g.schedule_count || 0,
                    location_count: g.location_count || 0,
                    sgt_wdate: g.sgt_wdate ? new Date(g.sgt_wdate).toLocaleDateString('ko-KR') : '',
                    owner_name: g.owner_name || `사용자 ${g.mt_idx || ''}`,
                }));
                setGroups(mappedGroups);
            } else {
                console.error('Failed to load groups:', result.message);
            }
        } catch (error) {
            console.error('Failed to load groups:', error);
        } finally {
            setIsLoading(false);
        }
    };


    const filteredGroups = groups.filter(group =>
        group.sgt_title.includes(searchQuery) ||
        group.owner_name.includes(searchQuery)
    );

    return (
        <div className="space-y-6">
            {/* 페이지 타이틀 */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">그룹 관리</h1>
                <p className="text-slate-500 mt-1">전체 그룹 {groups.length}개</p>
            </div>

            {/* 검색 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="그룹명, 소유자로 검색"
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* 그룹 목록 */}
            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredGroups.map((group) => (
                        <div
                            key={group.sgt_idx}
                            className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg transition-shadow cursor-pointer"
                            onClick={() => { setSelectedGroup(group); setShowModal(true); }}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                                    <FiUsers className="w-6 h-6 text-indigo-600" />
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); }}
                                    className="text-slate-400 hover:text-slate-600"
                                >
                                    <FiMoreVertical className="w-5 h-5" />
                                </button>
                            </div>

                            <h3 className="font-semibold text-slate-900 text-lg">{group.sgt_title}</h3>
                            <p className="text-sm text-slate-500 mt-1 line-clamp-1">{group.sgt_memo || '설명 없음'}</p>

                            <div className="flex items-center space-x-4 mt-4 pt-4 border-t border-slate-100">
                                <div className="flex items-center text-sm text-slate-500">
                                    <FiUsers className="w-4 h-4 mr-1" />
                                    <span>{group.member_count}</span>
                                </div>
                                <div className="flex items-center text-sm text-slate-500">
                                    <FiCalendar className="w-4 h-4 mr-1" />
                                    <span>{group.schedule_count}</span>
                                </div>
                                <div className="flex items-center text-sm text-slate-500">
                                    <FiMapPin className="w-4 h-4 mr-1" />
                                    <span>{group.location_count}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between mt-4">
                                <span className="text-xs text-slate-400">소유자: {group.owner_name}</span>
                                <span className="text-xs text-slate-400">{group.sgt_wdate}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 그룹 상세 모달 */}
            {showModal && selectedGroup && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-900">그룹 상세 정보</h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                <FiX className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center space-x-4">
                                <div className="w-16 h-16 bg-indigo-100 rounded-xl flex items-center justify-center">
                                    <FiUsers className="w-8 h-8 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-lg font-semibold text-slate-900">{selectedGroup.sgt_title}</p>
                                    <p className="text-slate-500">소유자: {selectedGroup.owner_name}</p>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-xl">
                                <p className="text-sm text-slate-600">{selectedGroup.sgt_memo || '설명 없음'}</p>
                            </div>

                            <div className="grid grid-cols-3 gap-4 pt-4">
                                <div className="text-center p-4 bg-indigo-50 rounded-xl">
                                    <p className="text-2xl font-bold text-indigo-600">{selectedGroup.member_count}</p>
                                    <p className="text-xs text-slate-500 mt-1">멤버</p>
                                </div>
                                <div className="text-center p-4 bg-emerald-50 rounded-xl">
                                    <p className="text-2xl font-bold text-emerald-600">{selectedGroup.schedule_count}</p>
                                    <p className="text-xs text-slate-500 mt-1">일정</p>
                                </div>
                                <div className="text-center p-4 bg-amber-50 rounded-xl">
                                    <p className="text-2xl font-bold text-amber-600">{selectedGroup.location_count}</p>
                                    <p className="text-xs text-slate-500 mt-1">장소</p>
                                </div>
                            </div>

                            <p className="text-xs text-slate-400 text-center">생성일: {selectedGroup.sgt_wdate}</p>
                        </div>

                        <div className="flex space-x-3 mt-6 pt-6 border-t border-slate-100">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                닫기
                            </button>
                            <button className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center space-x-2">
                                <FiTrash2 className="w-4 h-4" />
                                <span>삭제</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
