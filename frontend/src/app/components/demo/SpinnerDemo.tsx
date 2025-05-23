import React from 'react';
import LoadingSpinner from '../common/LoadingSpinner';

const SpinnerDemo: React.FC = () => {
  const spinnerTypes: Array<'spinner' | 'dots' | 'pulse' | 'bounce' | 'ripple' | 'wave'> = [
    'spinner', 'dots', 'pulse', 'bounce', 'ripple', 'wave'
  ];
  
  const colors: Array<'indigo' | 'blue' | 'green' | 'purple' | 'pink' | 'yellow'> = [
    'indigo', 'blue', 'green', 'purple', 'pink', 'yellow'
  ];

  const sizes: Array<'sm' | 'md' | 'lg'> = ['sm', 'md', 'lg'];

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900 text-center">로딩 스피너 데모</h1>
      
      {/* 스피너 타입별 데모 */}
      <section>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">스피너 타입</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {spinnerTypes.map((type) => (
            <div key={type} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-700 mb-4 capitalize text-center">{type}</h3>
              <div className="flex justify-center items-center h-20">
                <LoadingSpinner 
                  type={type}
                  fullScreen={false}
                  message=""
                  size="md"
                  color="indigo"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 크기별 데모 */}
      <section>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">크기 옵션 (Pulse 타입)</h2>
        <div className="grid grid-cols-3 gap-6">
          {sizes.map((size) => (
            <div key={size} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-700 mb-4 capitalize text-center">{size}</h3>
              <div className="flex justify-center items-center h-20">
                <LoadingSpinner 
                  type="pulse"
                  fullScreen={false}
                  message=""
                  size={size}
                  color="indigo"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 색상별 데모 */}
      <section>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">색상 옵션 (Ripple 타입)</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {colors.map((color) => (
            <div key={color} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-700 mb-4 capitalize text-center">{color}</h3>
              <div className="flex justify-center items-center h-20">
                <LoadingSpinner 
                  type="ripple"
                  fullScreen={false}
                  message=""
                  size="md"
                  color={color}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 메시지와 함께 사용 예시 */}
      <section>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">메시지와 함께 사용 예시</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-700 mb-4 text-center">데이터 로딩 중</h3>
            <div className="flex justify-center items-center">
              <LoadingSpinner 
                type="wave"
                fullScreen={false}
                message="데이터를 불러오는 중입니다..."
                size="sm"
                color="blue"
              />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-700 mb-4 text-center">업로드 중</h3>
            <div className="flex justify-center items-center">
              <LoadingSpinner 
                type="dots"
                fullScreen={false}
                message="파일을 업로드하는 중입니다..."
                size="sm"
                color="green"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 추천 조합 */}
      <section>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">추천 조합</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-700 mb-2 text-center">지도 로딩</h3>
            <p className="text-sm text-gray-500 mb-4 text-center">pulse + indigo + lg</p>
            <div className="flex justify-center items-center h-16">
              <LoadingSpinner 
                type="pulse"
                fullScreen={false}
                message=""
                size="lg"
                color="indigo"
              />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-700 mb-2 text-center">데이터 처리</h3>
            <p className="text-sm text-gray-500 mb-4 text-center">ripple + purple + md</p>
            <div className="flex justify-center items-center h-16">
              <LoadingSpinner 
                type="ripple"
                fullScreen={false}
                message=""
                size="md"
                color="purple"
              />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-700 mb-2 text-center">재미있는 로딩</h3>
            <p className="text-sm text-gray-500 mb-4 text-center">bounce + pink + md</p>
            <div className="flex justify-center items-center h-16">
              <LoadingSpinner 
                type="bounce"
                fullScreen={false}
                message=""
                size="md"
                color="pink"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SpinnerDemo; 