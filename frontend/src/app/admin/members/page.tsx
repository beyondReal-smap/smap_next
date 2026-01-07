"use client";

import React, { useState, useEffect } from 'react';
import { FiSearch, FiFilter, FiMoreVertical, FiEdit2, FiTrash2, FiEye, FiX, FiCheck } from 'react-icons/fi';

interface Member {
    mt_idx: number;
    mt_id: string;
    mt_name: string;
    mt_nickname: string;
    mt_hp: string;
    mt_email: string;
    mt_status: string;
    mt_wdate: string;
}

export default function AdminMembersPage() {
    const [members, setMembers] = useState<Member[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        loadMembers();
    }, []);

    const loadMembers = async () => {
        setIsLoading(true);
        try {
            // TODO: 실제 API 연동
            // 임시 데이터
            const mockMembers: Member[] = Array.from({ length: 50 }, (_, i) => ({
                mt_idx: i + 1,
                mt_id: `user${i + 1}`,
                mt_name: `사용자${i + 1}`,
                mt_nickname: `닉네임${i + 1}`,
                mt_hp: `010-${String(1000 + i).padStart(4, '0')}-${String(1000 + i).padStart(4, '0')}`,
                mt_email: `user${i + 1}@example.com`,
                mt_status: i % 10 === 0 ? 'N' : 'Y',
                mt_wdate: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
            }));
            setMembers(mockMembers);
        } catch (error) {
            console.error('Failed to load members:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredMembers = members.filter(member =>
        member.mt_name.includes(searchQuery) ||
        member.mt_nickname.includes(searchQuery) ||
        member.mt_email.includes(searchQuery) ||
        member.mt_hp.includes(searchQuery)
    );

    const paginatedMembers = filteredMembers.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);

    const handleDelete = async (member: Member) => {
        if (!confirm(`${member.mt_name} 회원을 삭제하시겠습니까?`)) return;

        // TODO: 실제 삭제 API 호출
        setMembers(prev => prev.filter(m => m.mt_idx !== member.mt_idx));
    };

    return (
        <div className="space-y-6">
            {/* 페이지 타이틀 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">회원 관리</h1>
                    <p className="text-slate-500 mt-1">전체 회원 {members.length}명</p>
                </div>
            </div>

            {/* 검색 및 필터 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="이름, 닉네임, 이메일, 전화번호로 검색"
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>
                    <button className="flex items-center space-x-2 px-4 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                        <FiFilter className="w-5 h-5 text-slate-500" />
                        <span className="text-slate-600">필터</span>
                    </button>
                </div>
            </div>

            {/* 회원 테이블 */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">회원</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">연락처</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">이메일</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">상태</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">가입일</th>
                                        <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {paginatedMembers.map((member) => (
                                        <tr key={member.mt_idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                                                        <span className="text-indigo-600 font-medium">{member.mt_name[0]}</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-900">{member.mt_name}</p>
                                                        <p className="text-sm text-slate-500">@{member.mt_nickname}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">{member.mt_hp}</td>
                                            <td className="px-6 py-4 text-slate-600">{member.mt_email}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${member.mt_status === 'Y'
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {member.mt_status === 'Y' ? '활성' : '비활성'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">{member.mt_wdate}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end space-x-2">
                                                    <button
                                                        onClick={() => { setSelectedMember(member); setShowModal(true); }}
                                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    >
                                                        <FiEye className="w-4 h-4" />
                                                    </button>
                                                    <button className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                                                        <FiEdit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(member)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <FiTrash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 페이지네이션 */}
                        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                            <p className="text-sm text-slate-500">
                                {filteredMembers.length}명 중 {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredMembers.length)}명 표시
                            </p>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                                >
                                    이전
                                </button>
                                <span className="text-sm text-slate-600">{currentPage} / {totalPages}</span>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                                >
                                    다음
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* 회원 상세 모달 */}
            {showModal && selectedMember && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-900">회원 상세 정보</h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                <FiX className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center space-x-4">
                                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                                    <span className="text-indigo-600 font-bold text-xl">{selectedMember.mt_name[0]}</span>
                                </div>
                                <div>
                                    <p className="text-lg font-semibold text-slate-900">{selectedMember.mt_name}</p>
                                    <p className="text-slate-500">@{selectedMember.mt_nickname}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                                <div>
                                    <p className="text-xs text-slate-400 uppercase">이메일</p>
                                    <p className="text-slate-900 mt-1">{selectedMember.mt_email}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 uppercase">전화번호</p>
                                    <p className="text-slate-900 mt-1">{selectedMember.mt_hp}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 uppercase">상태</p>
                                    <p className="text-slate-900 mt-1">{selectedMember.mt_status === 'Y' ? '활성' : '비활성'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 uppercase">가입일</p>
                                    <p className="text-slate-900 mt-1">{selectedMember.mt_wdate}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex space-x-3 mt-6 pt-6 border-t border-slate-100">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                닫기
                            </button>
                            <button className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
                                수정하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
