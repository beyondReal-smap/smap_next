"use client";

import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiX, FiCalendar } from 'react-icons/fi';

interface Notice {
    nt_idx: number;
    nt_title: string;
    nt_content: string;
    nt_show: string;
    nt_wdate: string;
    view_count: number;
}

export default function AdminNoticesPage() {
    const [notices, setNotices] = useState<Notice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
    const [formData, setFormData] = useState({ title: '', content: '' });

    useEffect(() => {
        loadNotices();
    }, []);

    const loadNotices = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('admin-token');
            const response = await fetch('/api/admin/notices?show_only=false', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            const result = await response.json();

            if (result.success && result.data) {
                const mappedNotices = result.data.map((n: any) => ({
                    nt_idx: n.nt_idx,
                    nt_title: n.nt_title || '',
                    nt_content: n.nt_content || '',
                    nt_show: n.nt_show || 'Y',
                    nt_wdate: n.nt_wdate ? new Date(n.nt_wdate).toLocaleDateString('ko-KR') : '',
                    view_count: n.nt_hit || n.view_count || 0,
                }));
                setNotices(mappedNotices);
            }
        } catch (error) {
            console.error('Failed to load notices:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = () => {
        setEditMode(false);
        setFormData({ title: '', content: '' });
        setShowModal(true);
    };

    const handleEdit = (notice: Notice) => {
        setEditMode(true);
        setSelectedNotice(notice);
        setFormData({ title: notice.nt_title, content: notice.nt_content });
        setShowModal(true);
    };

    const handleSubmit = async () => {
        const token = localStorage.getItem('admin-token');

        try {
            if (editMode && selectedNotice) {
                // 수정 API 호출
                await fetch('/api/admin/notices', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        nt_idx: selectedNotice.nt_idx,
                        nt_title: formData.title,
                        nt_content: formData.content,
                    }),
                });
            } else {
                // 작성 API 호출
                await fetch('/api/admin/notices', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        nt_title: formData.title,
                        nt_content: formData.content,
                        nt_show: 'Y',
                    }),
                });
            }
            setShowModal(false);
            loadNotices(); // 목록 새로고침
        } catch (error) {
            console.error('Failed to save notice:', error);
            alert('공지사항 저장에 실패했습니다.');
        }
    };

    const handleDelete = async (notice: Notice) => {
        if (!confirm(`"${notice.nt_title}" 공지를 삭제하시겠습니까?`)) return;

        try {
            const token = localStorage.getItem('admin-token');
            await fetch(`/api/admin/notices?nt_idx=${notice.nt_idx}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            loadNotices(); // 목록 새로고침
        } catch (error) {
            console.error('Failed to delete notice:', error);
            alert('공지사항 삭제에 실패했습니다.');
        }
    };

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">공지사항 관리</h1>
                    <p className="text-slate-500 mt-1">전체 공지 {notices.length}개</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                >
                    <FiPlus className="w-5 h-5" />
                    <span>새 공지 작성</span>
                </button>
            </div>

            {/* 공지 목록 */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {notices.map((notice) => (
                            <div key={notice.nt_idx} className="p-5 hover:bg-slate-50 transition-colors">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2">
                                            <h3 className="font-semibold text-slate-900">{notice.nt_title}</h3>
                                            {notice.nt_show === 'N' && (
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full">비공개</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-500 mt-1 line-clamp-1">{notice.nt_content}</p>
                                        <div className="flex items-center space-x-4 mt-2 text-xs text-slate-400">
                                            <span className="flex items-center"><FiCalendar className="w-3 h-3 mr-1" />{notice.nt_wdate}</span>
                                            <span className="flex items-center"><FiEye className="w-3 h-3 mr-1" />{notice.view_count}회</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2 ml-4">
                                        <button
                                            onClick={() => handleEdit(notice)}
                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        >
                                            <FiEdit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(notice)}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <FiTrash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 작성/수정 모달 */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-900">
                                {editMode ? '공지 수정' : '새 공지 작성'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                <FiX className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">제목</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="공지 제목을 입력하세요"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">내용</label>
                                <textarea
                                    value={formData.content}
                                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                                    rows={6}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                    placeholder="공지 내용을 입력하세요"
                                />
                            </div>
                        </div>

                        <div className="flex space-x-3 mt-6">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                            >
                                {editMode ? '수정하기' : '등록하기'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
