'use client';

import { FiUser, FiFileText, FiBook, FiMail, FiBell, FiShoppingBag, FiChevronRight } from 'react-icons/fi';
import { motion } from 'framer-motion';
import AnimatedHeader from '../../components/common/AnimatedHeader';

const SECTIONS = [
  {
    title: '계정 관리',
    items: [
      { label: '계정설정', icon: FiUser, description: '프로필 및 개인정보 관리' },
    ],
  },
  {
    title: '약관 & 정책',
    items: [
      { label: '약관 및 정책', icon: FiFileText, description: '이용약관 및 개인정보처리방침' },
    ],
  },
  {
    title: '고객 지원',
    items: [
      { label: '사용 가이드', icon: FiBook, description: '앱 사용법 및 도움말' },
      { label: '1:1 문의', icon: FiMail, description: '궁금한 점을 문의하세요' },
      { label: '공지사항', icon: FiBell, description: '최신 소식 및 업데이트' },
    ],
  },
  {
    title: '혜택 & 결제',
    items: [
      { label: '구독 내역', icon: FiShoppingBag, description: '결제 및 구독 이력' },
    ],
  },
];

export default function SettingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <AnimatedHeader>
        <div className="flex items-center h-16 px-4">
          <h1 className="text-lg font-bold text-gray-900">설정</h1>
        </div>
      </AnimatedHeader>
      <main className="pt-16 pb-24 px-4 max-w-md mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          {SECTIONS.map((section, idx) => (
            <section key={section.title}>
              <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center">
                {section.title}
                <span className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent ml-3"></span>
              </h2>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {section.items.map((item, itemIdx) => (
                  <div
                    key={item.label}
                    className={`flex items-center px-4 py-4 ${itemIdx !== section.items.length - 1 ? 'border-b border-gray-50' : ''}`}
                  >
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mr-4">
                      <item.icon className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-0.5">{item.label}</h4>
                      <p className="text-xs text-gray-500">{item.description}</p>
                    </div>
                    <FiChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                ))}
              </div>
            </section>
          ))}
          <div className="bg-gray-50 rounded-2xl p-4 text-center mt-8">
            <div className="text-sm text-gray-600 mb-1">SMAP</div>
            <div className="text-xs text-gray-500">버전 1.0.0</div>
          </div>
        </motion.div>
      </main>
    </div>
  );
} 