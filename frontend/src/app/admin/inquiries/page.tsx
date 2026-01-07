"use client";

import React, { useState, useEffect } from 'react';
import { FiMessageSquare, FiClock, FiCheck, FiX, FiSend } from 'react-icons/fi';

interface Inquiry {
    qt_idx: number;
    qt_title: string;
    qt_content: string;
    qt_answer: string | null;
    qt_status: 'pending' | 'answered';
    qt_wdate: string;
    member_name: string;
    member_email: string;
}

export default function AdminInquiriesPage() {
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'answered'>('all');
    const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [answer, setAnswer] = useState('');

    useEffect(() => {
        loadInquiries();
    }, []);

    const loadInquiries = async () => {
        setIsLoading(true);
        try {
            // TODO: 실제 API 연동
            const mockInquiries: Inquiry[] = Array.from({ length: 20 }, (_, i) => ({
                qt_idx: i + 1,
                qt_title: `문의 제목 ${i + 1}`,
                qt_content: `안녕하세요. 앱 사용 중 문제가 발생했습니다. 상세 내용: 문의 ${i + 1}에 대한 상세 내용입니다.`,
                qt_answer: i % 3 === 0 ? `안녕하세요. 문의주셔서 감사합니다. 문의 ${i + 1}에 대한 답변입니다.` : null,
                qt_status: i % 3 === 0 ? 'answered' : 'pending',
                qt_wdate: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
                member_name: `사용자${i + 1}`,
                member_email: `user${i + 1}@example.com`,
            }));
            setInquiries(mockInquiries);
        } catch (error) {
            console.error('Failed to load inquiries:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredInquiries = inquiries.filter(inq => {
        if (filter === 'pending') return inq.qt_status === 'pending';
        if (filter === 'answered') return inq.qt_status === 'answered';
        return true;
    });

    const handleOpenModal = (inquiry: Inquiry) => {
        setSelectedInquiry(inquiry);
        setAnswer(inquiry.qt_answer || '');
        setShowModal(true);
    };

    const handleSubmitAnswer = async () => {
        if (!selectedInquiry || !answer.trim()) return;

        // TODO: 실제 API 호출
        setInquiries(prev => prev.map(inq =>
            inq.qt_idx === selectedInquiry.qt_idx
                ? { ...inq, qt_answer: answer, qt_status: 'answered' as const }
                : inq
        ));
        setShowModal(false);
    };

    const pendingCount = inquiries.filter(i => i.qt_status === 'pending').length;

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">문의 관리</h1>
                <p className="text-slate-500 mt-1">
                    전체 {inquiries.length}건 · 대기 중 {pendingCount}건
                </p>
            </div>

            {/* 필터 */}
            <div className="flex space-x-2">
                {(['all', 'pending', 'answered'] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter === f
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        {f === 'all' ? '전체' : f === 'pending' ? '대기 중' : '답변 완료'}
                    </button>
                ))}
            </div>

            {/* 문의 목록 */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filteredInquiries.map((inquiry) => (
                            <div
                                key={inquiry.qt_idx}
                                onClick={() => handleOpenModal(inquiry)}
                                className="p-5 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start space-x-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${inquiry.qt_status === 'pending' ? 'bg-amber-100' : 'bg-green-100'
                                            }`}>
                                            {inquiry.qt_status === 'pending'
                                                ? <FiClock className="w-5 h-5 text-amber-600" />
                                                : <FiCheck className="w-5 h-5 text-green-600" />
                                            }
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-900">{inquiry.qt_title}</h3>
                                            <p className="text-sm text-slate-500 mt-1 line-clamp-1">{inquiry.qt_content}</p>
                                            <div className="flex items-center space-x-3 mt-2 text-xs text-slate-400">
                                                <span>{inquiry.member_name}</span>
                                                <span>·</span>
                                                <span>{inquiry.qt_wdate}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${inquiry.qt_status === 'pending'
                                            ? 'bg-amber-100 text-amber-700'
                                            : 'bg-green-100 text-green-700'
                                        }`}>
                                        {inquiry.qt_status === 'pending' ? '대기' : '완료'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 문의 상세/답변 모달 */}
            {showModal && selectedInquiry && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-900">문의 상세</h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                <FiX className="w-6 h-6" />
                            </button>
                        </div>

                        {/* 문의 정보 */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-500">{selectedInquiry.member_name} · {selectedInquiry.member_email}</p>
                                    <p className="text-xs text-slate-400 mt-1">{selectedInquiry.qt_wdate}</p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${selectedInquiry.qt_status === 'pending'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-green-100 text-green-700'
                                    }`}>
                                    {selectedInquiry.qt_status === 'pending' ? '대기 중' : '답변 완료'}
                                </span>
                            </div>

                            <div>
                                <h3 className="font-semibold text-slate-900 text-lg">{selectedInquiry.qt_title}</h3>
                                <p className="text-slate-600 mt-2 whitespace-pre-wrap">{selectedInquiry.qt_content}</p>
                            </div>

                            <hr className="border-slate-200" />

                            {/* 답변 영역 */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    <FiMessageSquare className="inline w-4 h-4 mr-1" />
                                    답변
                                </label>
                                <textarea
                                    value={answer}
                                    onChange={(e) => setAnswer(e.target.value)}
                                    rows={5}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                    placeholder="답변을 입력하세요..."
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
                                onClick={handleSubmitAnswer}
                                disabled={!answer.trim()}
                                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors flex items-center justify-center space-x-2"
                            >
                                <FiSend className="w-4 h-4" />
                                <span>답변 등록</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
