'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FiLoader, FiAlertCircle } from 'react-icons/fi';
import memberService from '@/services/memberService';
import authService from '@/services/authService';

// 타입 정의
interface LocationData {
  id: string;
  name: string;
  address: string;
  category: string;
  coordinates: [number, number];
  memo: string;
  favorite: boolean;
  notifications?: boolean;
}

interface GroupMember {
  id: string;
  name: string;
  photo: string | null;
  isSelected: boolean;
  location: { lat: number; lng: number };
  schedules: any[];
  savedLocations: LocationData[];
  savedLocationCount?: number;
  mt_gender?: number | null;
  original_index: number;
  mlt_lat?: number | null;
  mlt_long?: number | null;
}

interface DataManagerProps {
  onMembersLoaded: (members: GroupMember[]) => void;
  onLocationsLoaded: (locations: LocationData[]) => void;
  onError: (message: string) => void;
}

export default function DataManager({
  onMembersLoaded,
  onLocationsLoaded,
  onError
}: DataManagerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. 현재 사용자 및 그룹 정보 확인
      const userData = authService.getUserData();
      if (!userData) {
        throw new Error('로그인 정보가 없습니다.');
      }

      // 2. 현재 선택된 그룹의 멤버들 가져오기
      const selectedGroupStr = localStorage.getItem('selected_group');
      let groupId = '';
      if (selectedGroupStr) {
        try {
          const selectedGroup = JSON.parse(selectedGroupStr);
          groupId = selectedGroup.sgt_idx || '';
        } catch (e) {
          console.warn('[DataManager] 선택된 그룹 정보 파싱 실패');
        }
      }

      if (!groupId) {
        onMembersLoaded([]);
        setIsLoading(false);
        return;
      }

      // 3. 멤버 서비스에서 실제 멤버 정보 가져오기
      const members = await memberService.getGroupMembers(groupId);

      // 4. UI 타입에 맞게 변환
      const uiMembers: GroupMember[] = members.map((m, index) => {
        // 위치 정보 파싱 (문자열인 경우 숫자로 변환)
        const lat = (typeof m.mt_lat === 'string' ? parseFloat(m.mt_lat) : m.mt_lat) || 37.5665;
        const lng = (typeof m.mt_long === 'string' ? parseFloat(m.mt_long) : m.mt_long) || 126.9780;

        return {
          id: String(m.mt_idx),
          name: m.mt_name,
          photo: m.mt_file1 || null,
          isSelected: index === 0,
          location: { lat, lng },
          schedules: [],
          savedLocations: [],
          savedLocationCount: 0,
          mt_gender: m.mt_gender,
          original_index: index,
          mlt_lat: lat,
          mlt_long: lng
        };
      });

      onMembersLoaded(uiMembers);

      if (uiMembers.length > 0) {
        onLocationsLoaded(uiMembers[0].savedLocations);
      }

      setIsLoading(false);
    } catch (err) {
      console.error('[DataManager] 데이터 로드 오류:', err);
      const errorMessage = err instanceof Error ? err.message : '데이터 로드 중 오류가 발생했습니다.';
      setError(errorMessage);
      onError(errorMessage);
      setIsLoading(false);
    }
  }, [onMembersLoaded, onLocationsLoaded, onError]);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 로딩 상태 표시
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4"
          />
          <p className="text-lg font-medium text-gray-900 mb-2">데이터를 불러오는 중...</p>
          <p className="text-sm text-gray-600">잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  // 에러 상태 표시
  if (error) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiAlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">데이터 로드 실패</h3>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return null;
}
