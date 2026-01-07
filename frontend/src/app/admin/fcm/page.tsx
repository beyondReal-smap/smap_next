"use client";

import React, { useState, useEffect } from 'react';
import { FiSend, FiUsers, FiUser, FiLayers, FiClock, FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';

interface FCMHistory {
    fcm_idx: number;
    fcm_title: string;
    fcm_body: string;
    fcm_target: 'all' | 'group' | 'user';
    fcm_target_name: string;
    fcm_status: 'success' | 'failed' | 'pending';
    fcm_sent_count: number;
    fcm_wdate: string;
}

export default function AdminFCMPage() {
    const [history, setHistory] = useState<FCMHistory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [formData, setFormData] = useState({
        target: 'all' as 'all' | 'group' | 'user',
        targetId: '',
        title: '',
        body: '',
    });

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('admin-token');
            const response = await fetch('/api/admin/fcm', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            const result = await response.json();

            if (result.success && result.data) {
                const mappedHistory = result.data.map((h: any) => ({
                    fcm_idx: h.plt_idx || h.fcm_idx || Date.now(),
                    fcm_title: h.plt_title || h.fcm_title || '',
                    fcm_body: h.plt_content || h.fcm_body || '',
                    fcm_target: 'user' as const,
                    fcm_target_name: `사용자 ${h.mt_idx || ''}`,
                    fcm_status: h.plt_status === 'Y' ? 'success' : 'pending' as const,
                    fcm_sent_count: 1,
                    fcm_wdate: h.plt_wdate ? new Date(h.plt_wdate).toLocaleString('ko-KR') : '',
                }));
                setHistory(mappedHistory);
            }
        } catch (error) {
            console.error('Failed to load FCM history:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendFCM = async () => {
        if (!formData.title.trim() || !formData.body.trim()) {
            alert('제목과 내용을 입력해주세요.');
            return;
        }

        if (formData.target !== 'all' && !formData.targetId) {
            alert('발송 대상 ID를 입력해주세요.');
            return;
        }

        setIsSending(true);
        try {
            const token = localStorage.getItem('admin-token');
            const response = await fetch('/api/admin/fcm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    title: formData.title,
                    content: formData.body,
                    mt_idx: formData.target === 'user' ? parseInt(formData.targetId) : 0,
                    plt_type: 'admin',
                    plt_condition: formData.target,
                }),
            });

            const result = await response.json();

            if (result.success) {
                setFormData({ target: 'all', targetId: '', title: '', body: '' });
                alert('푸시 알림이 발송되었습니다.');
                loadHistory(); // 목록 새로고침
            } else {
                alert(result.message || '발송에 실패했습니다.');
            }
        } catch (error) {
            console.error('FCM send error:', error);
            alert('발송에 실패했습니다.');
        } finally {
            setIsSending(false);
        }
    };

    const getTargetIcon = (target: string) => {
        switch (target) {
            case 'all': return FiUsers;
            case 'group': return FiLayers;
            default: return FiUser;
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'success': return { icon: FiCheck, color: 'text-green-600 bg-green-100' };
            case 'failed': return { icon: FiX, color: 'text-red-600 bg-red-100' };
            default: return { icon: FiClock, color: 'text-amber-600 bg-amber-100' };
        }
    };

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">FCM 푸시 발송</h1>
                <p className="text-slate-500 mt-1">푸시 알림을 발송하고 이력을 관리합니다</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 발송 폼 */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 sticky top-24">
                        <h2 className="font-semibold text-slate-900 mb-4">새 알림 발송</h2>

                        <div className="space-y-4">
                            {/* 발송 대상 */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">발송 대상</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { value: 'all', label: '전체', icon: FiUsers },
                                        { value: 'group', label: '그룹', icon: FiLayers },
                                        { value: 'user', label: '개인', icon: FiUser },
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setFormData(prev => ({ ...prev, target: opt.value as any }))}
                                            className={`flex flex-col items-center p-3 rounded-xl border transition-all ${formData.target === opt.value
                                                ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                                                : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                                }`}
                                        >
                                            <opt.icon className="w-5 h-5 mb-1" />
                                            <span className="text-xs font-medium">{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 대상 ID (그룹/개인 선택 시) */}
                            {formData.target !== 'all' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        {formData.target === 'group' ? '그룹 ID' : '사용자 ID'}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.targetId}
                                        onChange={(e) => setFormData(prev => ({ ...prev, targetId: e.target.value }))}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="ID 입력"
                                    />
                                </div>
                            )}

                            {/* 제목 */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">제목</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="알림 제목"
                                />
                            </div>

                            {/* 내용 */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">내용</label>
                                <textarea
                                    value={formData.body}
                                    onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
                                    rows={4}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                    placeholder="알림 내용"
                                />
                            </div>

                            {/* 발송 버튼 */}
                            <button
                                onClick={handleSendFCM}
                                disabled={isSending}
                                className="w-full py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors flex items-center justify-center space-x-2"
                            >
                                {isSending ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <FiSend className="w-5 h-5" />
                                        <span>발송하기</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 발송 이력 */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100">
                            <h2 className="font-semibold text-slate-900">발송 이력</h2>
                        </div>

                        {isLoading ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                                {history.map((item) => {
                                    const TargetIcon = getTargetIcon(item.fcm_target);
                                    const { icon: StatusIcon, color } = getStatusIcon(item.fcm_status);

                                    return (
                                        <div key={item.fcm_idx} className="p-4 hover:bg-slate-50 transition-colors">
                                            <div className="flex items-start space-x-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
                                                    <StatusIcon className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center space-x-2">
                                                        <h3 className="font-medium text-slate-900 truncate">{item.fcm_title}</h3>
                                                        <span className="flex items-center text-xs text-slate-400">
                                                            <TargetIcon className="w-3 h-3 mr-1" />
                                                            {item.fcm_target_name}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-500 mt-1 line-clamp-1">{item.fcm_body}</p>
                                                    <div className="flex items-center space-x-3 mt-2 text-xs text-slate-400">
                                                        <span>{item.fcm_wdate}</span>
                                                        <span>·</span>
                                                        <span>{item.fcm_sent_count}명 발송</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
