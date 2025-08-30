'use client';

import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { FiCamera, FiUpload, FiX, FiRotateCcw } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

interface ProfileImageUploaderProps {
  currentImage?: string;
  onImageChange: (file: File) => void;
  onClose: () => void;
  mtIdx: string;
}

const ProfileImageUploader: React.FC<ProfileImageUploaderProps> = ({
  currentImage,
  onImageChange,
  onClose,
  mtIdx
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 100,
    height: 100,
    x: 0,
    y: 0
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [rotation, setRotation] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // 이미지 선택 핸들러
  const handleImageSelect = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        setRotation(0);
      };
      reader.readAsDataURL(file);
    }
  };

  // 파일 선택
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImageSelect(file);
    }
  };

  // 카메라 촬영
  const handleCameraCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.click();
    }
  };

  // 갤러리에서 선택
  const handleGallerySelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.click();
    }
  };

  // 회전
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // 크롭된 이미지 생성
  const getCroppedImg = useCallback(async (
    image: HTMLImageElement,
    crop: PixelCrop,
    fileName: string
  ): Promise<File> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas context를 생성할 수 없습니다.');
    }

    // 1:1 비율의 정사각형 캔버스 생성
    const size = Math.min(crop.width, crop.height);
    canvas.width = size;
    canvas.height = size;

    // 회전 적용
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // 이미지 그리기
    ctx.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      size,
      size
    );

    ctx.restore();

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], fileName, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(file);
        }
      }, 'image/jpeg', 0.95);
    });
  }, [rotation]);

  // 저장
  const handleSave = async () => {
    if (!selectedImage || !completedCrop || !imageRef.current) return;

    setIsProcessing(true);
    try {
      const croppedImage = await getCroppedImg(
        imageRef.current,
        completedCrop,
        `${mtIdx}_profile.jpg`
      );

      onImageChange(croppedImage);
      onClose();
    } catch (error) {
      console.error('이미지 처리 중 오류:', error);
      alert('이미지 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">프로필 사진 변경</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <FiX className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* 컨텐츠 */}
          <div className="p-4">
            {!selectedImage ? (
              // 이미지 선택 화면
              <div className="space-y-4">
                {/* 현재 프로필 사진 미리보기 */}
                {currentImage && (
                  <div className="flex justify-center">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200">
                      <img
                        src={currentImage}
                        alt="현재 프로필"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}

                {/* 선택 옵션 */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleCameraCapture}
                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    <FiCamera className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm font-medium text-gray-700">사진 촬영</span>
                  </button>

                  <button
                    onClick={handleGallerySelect}
                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    <FiUpload className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm font-medium text-gray-700">갤러리 선택</span>
                  </button>
                </div>

                {/* 힌트 텍스트 */}
                <p className="text-xs text-gray-500 text-center">
                  선택한 이미지는 1:1 비율로 자동 크롭됩니다
                </p>
              </div>
            ) : (
              // 이미지 크롭 화면
              <div className="space-y-4">
                {/* 크롭 영역 */}
                <div className="relative">
                  <ReactCrop
                    crop={crop}
                    onChange={setCrop}
                    onComplete={setCompletedCrop}
                    aspect={1}
                    circularCrop
                    className="max-h-64 overflow-hidden rounded-lg"
                  >
                    <img
                      ref={imageRef}
                      src={selectedImage}
                      alt="크롭할 이미지"
                      className="max-w-full max-h-64 object-contain"
                      style={{
                        transform: `rotate(${rotation}deg)`,
                        maxHeight: '256px'
                      }}
                    />
                  </ReactCrop>
                </div>

                {/* 컨트롤 버튼 */}
                <div className="flex items-center justify-center space-x-4">
                  <button
                    onClick={handleRotate}
                    className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                    title="회전"
                  >
                    <FiRotateCcw className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                {/* 액션 버튼 */}
                <div className="flex space-x-3">
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                    disabled={isProcessing}
                  >
                    다시 선택
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 py-3 px-4 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50"
                    disabled={!completedCrop || isProcessing}
                  >
                    {isProcessing ? '처리 중...' : '저장'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 파일 입력 (숨김) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProfileImageUploader;
