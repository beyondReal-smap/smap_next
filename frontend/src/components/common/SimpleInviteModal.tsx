import React from 'react';

interface SimpleInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupTitle: string;
  inviteCode: string;
}

const SimpleInviteModal: React.FC<SimpleInviteModalProps> = ({
  isOpen,
  onClose,
  groupTitle,
  inviteCode
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
        <h2 className="text-lg font-bold mb-4">그룹 초대</h2>
        <p className="text-sm text-gray-600 mb-2">그룹: {groupTitle}</p>
        <p className="text-sm text-gray-600 mb-4">초대 코드: {inviteCode}</p>
        <button
          onClick={onClose}
          className="w-full bg-blue-500 text-white py-2 rounded-lg"
        >
          닫기
        </button>
      </div>
    </div>
  );
};

export default SimpleInviteModal; 