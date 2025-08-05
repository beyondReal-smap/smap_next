import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiShare2, FiCopy, FiDownload } from 'react-icons/fi';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupTitle: string;
  inviteCode: string;
  inviteLink?: string;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  groupTitle,
  inviteCode,
  inviteLink
}) => {
  const [copied, setCopied] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // SSR에서 렌더링하지 않음
  if (typeof window === 'undefined') {
    return null;
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('클립보드 복사 실패:', error);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('클립보드 복사 실패:', error);
    }
  };

  const handleShare = async () => {
    if (!inviteLink) return;

    const shareData = {
      title: `${groupTitle} 그룹 초대`,
      text: `${groupTitle} 그룹에 초대되었습니다!\n\n초대 코드: ${inviteCode}\n\n아래 링크를 클릭하여 참여해보세요:`,
      url: inviteLink
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Web Share API가 지원되지 않는 경우 클립보드에 복사
        await handleCopyLink();
      }
    } catch (error) {
      console.error('공유 실패:', error);
    }
  };

  if (!isOpen || !isClient) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* 배경 오버레이 */}
        <motion.div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* 모달 컨테이너 */}
        <motion.div
          className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          {/* 헤더 */}
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-6 text-white relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/20 transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>

            <div className="text-center">
              <h2 className="text-xl font-bold mb-1">그룹 초대</h2>
              <p className="text-sm opacity-90">{groupTitle}</p>
            </div>
          </div>

          {/* 초대 정보 섹션 */}
          <div className="p-6">
            <div className="flex flex-col items-center space-y-4">
              {/* 초대 코드 */}
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">초대 코드</p>
                <div className="flex items-center justify-center space-x-2">
                  <code className="bg-gray-100 px-4 py-2 rounded-lg font-mono text-lg font-bold text-gray-800">
                    {inviteCode}
                  </code>
                  <button
                    onClick={handleCopyCode}
                    className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                    title="초대 코드 복사"
                  >
                    <FiCopy className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* 초대 링크 */}
              {inviteLink && (
                <div className="text-center w-full">
                  <p className="text-sm text-gray-600 mb-2">초대 링크</p>
                  <div className="bg-gray-50 p-3 rounded-lg break-all">
                    <p className="text-xs text-gray-600">{inviteLink}</p>
                  </div>
                </div>
              )}

              {/* 액션 버튼들 */}
              <div className="flex flex-col space-y-3 w-full">
                <button
                  onClick={handleShare}
                  className="flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-4 rounded-xl font-medium hover:shadow-lg transition-all"
                >
                  <FiShare2 className="w-5 h-5" />
                  <span>공유하기</span>
                </button>

                {inviteLink && (
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center justify-center space-x-2 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-medium hover:bg-gray-200 transition-all"
                  >
                    <FiCopy className="w-5 h-5" />
                    <span>링크 복사</span>
                  </button>
                )}
              </div>

              {/* 복사 완료 메시지 */}
              <AnimatePresence>
                {copied && (
                  <motion.div
                    className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    복사되었습니다!
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default QRCodeModal; 