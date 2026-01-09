"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { FiSearch, FiUsers, FiCalendar, FiMapPin, FiMoreVertical, FiTrash2, FiX, FiUser, FiClock } from 'react-icons/fi';

interface Group {
    sgt_idx: number;
    sgt_title: string;
    sgt_memo: string;
    sgt_code: string;
    mt_idx: number;
    member_count: number;
    schedule_count: number;
    location_count: number;
    sgt_wdate: string;
    sgt_wdate_raw: number;
    owner_name: string;
}

interface GroupMember {
    mt_idx: number;
    mt_name: string;
    mt_nickname: string;
    mt_email: string;
    mt_hp: string;
    sgdt_owner_chk: string;
    sgdt_leader_chk: string;
    sgdt_wdate: string;
}

export default function AdminGroupsPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const itemsPerPage = 60;

    useEffect(() => {
        loadGroups();
    }, []);

    // 검색어 변경 시 1페이지로 리셋
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

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
                const mappedGroups = result.data.map((g: any) => ({
                    sgt_idx: g.sgt_idx,
                    sgt_title: g.sgt_title || '제목 없음',
                    sgt_memo: g.sgt_memo || '',
                    sgt_code: g.sgt_code || '',
                    mt_idx: g.mt_idx || 0,
                    member_count: g.member_count || 0,
                    schedule_count: g.schedule_count || 0,
                    location_count: g.location_count || 0,
                    sgt_wdate: g.sgt_wdate ? new Date(g.sgt_wdate).toLocaleDateString('ko-KR') : '',
                    sgt_wdate_raw: g.sgt_wdate ? new Date(g.sgt_wdate).getTime() : 0,
                    owner_name: g.owner_name || `사용자 ${g.mt_idx || ''}`,
                }));
                mappedGroups.sort((a: any, b: any) => b.sgt_wdate_raw - a.sgt_wdate_raw);
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

    const loadGroupMembers = async (groupId: number) => {
        setLoadingMembers(true);
        setGroupMembers([]);
        try {
            const token = localStorage.getItem('admin-token');
            const response = await fetch(`/api/admin/groups/${groupId}/members`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            const result = await response.json();
            if (result.success && Array.isArray(result.data)) {
                setGroupMembers(result.data);
            }
        } catch (error) {
            console.error('Failed to load group members:', error);
        } finally {
            setLoadingMembers(false);
        }
    };

    const handleGroupClick = (group: Group) => {
        setSelectedGroup(group);
        setGroupMembers([]);
        setLoadingMembers(true);
        setShowModal(true);
        // 모달이 열린 후에 멤버 조회 시작
        setTimeout(() => {
            loadGroupMembers(group.sgt_idx);
        }, 100);
    };

    // 필터링된 그룹 (검색)
    const filteredGroups = useMemo(() => {
        if (!searchQuery) return groups;
        return groups.filter(group =>
            group.sgt_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            group.owner_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            group.sgt_code?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [groups, searchQuery]);

    // 페이지네이션된 그룹
    const paginatedGroups = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredGroups.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredGroups, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredGroups.length / itemsPerPage) || 1;

    return (
        <div className="space-y-6">
            {/* 페이지 타이틀 */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">그룹 관리</h1>
                <p className="text-slate-500 mt-1">전체 그룹 {filteredGroups.length}개</p>
            </div>

            {/* 검색 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="그룹명, 소유자, 그룹코드로 검색"
                        className="w-96 pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* 그룹 목록 */}
            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {paginatedGroups.map((group) => (
                            <div
                                key={group.sgt_idx}
                                className="bg-white rounded-xl border border-slate-200 p-3 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer"
                                onClick={() => handleGroupClick(group)}
                            >
                                <div className="flex items-center space-x-3">
                                    <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <FiUsers className="w-4 h-4 text-indigo-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-2">
                                            <h3 className="font-medium text-slate-900 text-sm truncate">{group.sgt_title}</h3>
                                            {group.sgt_code && (
                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded flex-shrink-0">{group.sgt_code}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center space-x-3 mt-1">
                                            <span className="text-xs text-slate-400 flex items-center">
                                                <FiUsers className="w-3 h-3 mr-0.5" />{group.member_count}
                                            </span>
                                            <span className="text-xs text-slate-400 flex items-center">
                                                <FiCalendar className="w-3 h-3 mr-0.5" />{group.schedule_count}
                                            </span>
                                            <span className="text-xs text-slate-400 flex items-center">
                                                <FiMapPin className="w-3 h-3 mr-0.5" />{group.location_count}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 페이지네이션 */}
                    <div className="bg-white rounded-2xl border border-slate-200 px-6 py-4 flex items-center justify-between">
                        <p className="text-sm text-slate-500">
                            총 {filteredGroups.length}개 중 {Math.min((currentPage - 1) * itemsPerPage + 1, filteredGroups.length)}-{Math.min(currentPage * itemsPerPage, filteredGroups.length)}개 표시
                        </p>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                            >
                                처음
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                            >
                                이전
                            </button>
                            <span className="text-sm text-slate-600 px-2">{currentPage} / {totalPages}</span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                            >
                                다음
                            </button>
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                            >
                                마지막
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* 그룹 상세 모달 */}
            {showModal && selectedGroup && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        {/* 모달 헤더 */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <h2 className="text-xl font-bold text-slate-900">그룹 상세 정보</h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                <FiX className="w-6 h-6" />
                            </button>
                        </div>

                        {/* 모달 콘텐츠 */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* 그룹 기본 정보 */}
                            <div className="flex items-start space-x-4">
                                <div className="w-16 h-16 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <FiUsers className="w-8 h-8 text-indigo-600" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                        <p className="text-lg font-semibold text-slate-900">{selectedGroup.sgt_title}</p>
                                        {selectedGroup.sgt_code && (
                                            <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded-lg">{selectedGroup.sgt_code}</span>
                                        )}
                                    </div>
                                    <p className="text-slate-500 mt-1">소유자: {selectedGroup.owner_name}</p>
                                    <div className="flex items-center text-xs text-slate-400 mt-2">
                                        <FiClock className="w-3 h-3 mr-1" />
                                        <span>생성일: {selectedGroup.sgt_wdate}</span>
                                    </div>
                                </div>
                            </div>

                            {/* 그룹 설명 */}
                            {selectedGroup.sgt_memo && (
                                <div className="p-4 bg-slate-50 rounded-xl">
                                    <p className="text-sm text-slate-600">{selectedGroup.sgt_memo}</p>
                                </div>
                            )}

                            {/* 통계 */}
                            <div className="grid grid-cols-3 gap-4">
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

                            {/* 멤버 목록 */}
                            <div>
                                <h3 className="font-semibold text-slate-900 mb-3 flex items-center">
                                    <FiUser className="w-4 h-4 mr-2" />
                                    그룹 멤버 ({groupMembers.length}명)
                                </h3>
                                {loadingMembers ? (
                                    <div className="flex items-center justify-center h-24">
                                        <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                                    </div>
                                ) : groupMembers.length > 0 ? (
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {groupMembers.map((member) => (
                                            <div key={member.mt_idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                                                        <span className="text-indigo-600 text-sm font-medium">
                                                            {(member.mt_name || member.mt_nickname || '?')[0]}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-900">
                                                            {member.mt_name || member.mt_nickname || `사용자 ${member.mt_idx}`}
                                                        </p>
                                                        <p className="text-xs text-slate-500">{member.mt_email || member.mt_hp || ''}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    {member.sgdt_owner_chk === 'Y' && (
                                                        <span className="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full">그룹장</span>
                                                    )}
                                                    {member.sgdt_leader_chk === 'Y' && member.sgdt_owner_chk !== 'Y' && (
                                                        <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full">리더</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-400 text-center py-4">멤버가 없습니다</p>
                                )}
                            </div>
                        </div>

                        {/* 모달 푸터 */}
                        <div className="flex space-x-3 p-6 border-t border-slate-100">
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
