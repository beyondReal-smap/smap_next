'use client';

import { useState, useEffect, useCallback } from 'react';
import memberService from '@/services/memberService';
import locationService from '@/services/locationService';
import groupService from '@/services/groupService';
import { retryDataFetch } from '@/utils/retryUtils';

interface GroupMember {
  id: string;
  name: string;
  photo: string | null;
  mt_file1?: string | null;
  isSelected: boolean;
  location: {
    lat: number;
    lng: number;
  };
  schedules: any[];
  savedLocations: any[];
  savedLocationCount?: number;
  mt_gender?: number | null;
  original_index: number;
  mlt_lat?: number | null;
  mlt_long?: number | null;
  mlt_speed?: number | null;
  mlt_battery?: number | null;
  mlt_gps_time?: string | null;
  sgdt_owner_chk?: string;
  sgdt_leader_chk?: string;
}

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

interface ServiceMember {
  mt_idx: number;
  mt_name: string;
  mt_nickname?: string;
  mt_file1?: string;
  mlt_lat?: number;
  mlt_long?: number;
  mt_gender?: number;
  sgdt_owner_chk?: string;
  sgdt_leader_chk?: string;
}

export const useLocationData = () => {
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);
  const [otherMembersLocations, setOtherMembersLocations] = useState<any[]>([]);
  const [selectedMemberLocations, setSelectedMemberLocations] = useState<LocationData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);

  // 데이터 새로고침
  const refreshData = useCallback(async () => {
    if (!currentGroupId) return;

    try {
      setIsLoading(true);
      setError(null);

      // 그룹 멤버 정보 가져오기
      const members = await retryDataFetch(() => memberService.getGroupMembers(currentGroupId), 'GROUP_MEMBERS');
      const convertedMembers: GroupMember[] = members.map((member: ServiceMember, index: number) => ({
        id: member.mt_idx.toString(),
        name: member.mt_name || member.mt_nickname || '이름 없음',
        photo: member.mt_file1 || null,
        mt_file1: member.mt_file1 || null,
        isSelected: index === 0,
        location: {
          lat: parseFloat(String(member.mlt_lat || '37.5665')) || 37.5665,
          lng: parseFloat(String(member.mlt_long || '126.9780')) || 126.9780
        },
        schedules: [],
        savedLocations: [],
        savedLocationCount: 0,
        mt_gender: member.mt_gender || null,
        original_index: index,
        mlt_lat: member.mlt_lat || null,
        mlt_long: member.mlt_long || null,
        mlt_speed: null,
        mlt_battery: null,
        mlt_gps_time: null,
        sgdt_owner_chk: member.sgdt_owner_chk,
        sgdt_leader_chk: member.sgdt_leader_chk,
      }));
      setGroupMembers(convertedMembers);

      // 다른 멤버들의 위치 정보 가져오기
      const otherLocations = await retryDataFetch(() => locationService.getOtherMembersLocations(currentGroupId), 'OTHER_LOCATIONS');
      setOtherMembersLocations(otherLocations);

      // 선택된 멤버의 저장된 위치 정보 가져오기
      if (selectedMember) {
        const savedLocations = await retryDataFetch(() => locationService.getOtherMembersLocations(selectedMember.id), 'MEMBER_LOCATIONS');
        setSelectedMemberLocations(savedLocations);
      }

    } catch (err) {
      console.error('데이터 새로고침 실패:', err);
      setError(err instanceof Error ? err.message : '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [currentGroupId, selectedMember]);

  // 그룹 변경
  const changeGroup = useCallback(async (groupId: string) => {
    try {
      setCurrentGroupId(groupId);
      setSelectedMember(null);
      setSelectedMemberLocations([]);

      // 새 그룹의 데이터 로드
      await refreshData();

    } catch (err) {
      console.error('그룹 변경 실패:', err);
      setError(err instanceof Error ? err.message : '그룹을 변경하는 중 오류가 발생했습니다.');
    }
  }, [refreshData]);

  // 멤버 선택
  const selectMember = useCallback(async (memberId: string) => {
    try {
      const member = groupMembers.find(m => m.id === memberId);
      if (!member) return;

      setSelectedMember(member);

      // 선택된 멤버의 저장된 위치 정보 가져오기
      const savedLocations = await retryDataFetch(() => locationService.getOtherMembersLocations(memberId), 'SELECTED_MEMBER_LOCATIONS');
      setSelectedMemberLocations(savedLocations);

    } catch (err) {
      console.error('멤버 선택 실패:', err);
      setError(err instanceof Error ? err.message : '멤버를 선택하는 중 오류가 발생했습니다.');
    }
  }, [groupMembers]);

  // 위치 저장
  const saveLocation = useCallback(async (locationData: LocationData) => {
    try {
      if (!selectedMember) {
        throw new Error('멤버를 먼저 선택해주세요.');
      }

      const savedLocation = await locationService.createLocation({
        ...locationData,
        memberId: selectedMember.id
      });

      // 저장된 위치를 목록에 추가
      setSelectedMemberLocations(prev => [...prev, savedLocation]);

      return savedLocation;

    } catch (err) {
      console.error('위치 저장 실패:', err);
      throw err;
    }
  }, [selectedMember]);

  // 위치 업데이트
  const updateLocation = useCallback(async (locationId: string, updateData: Partial<LocationData>) => {
    try {
      const updatedLocation = await locationService.updateLocationNotification(parseInt(locationId), updateData.notifications || false);

      // 목록에서 위치 업데이트
      setSelectedMemberLocations(prev =>
        prev.map(loc => loc.id === locationId ? { ...loc, ...updateData } : loc)
      );

      return updatedLocation;

    } catch (err) {
      console.error('위치 업데이트 실패:', err);
      throw err;
    }
  }, []);

  // 위치 삭제
  const deleteLocation = useCallback(async (locationId: string) => {
    try {
      await locationService.deleteLocation(parseInt(locationId));

      // 목록에서 위치 제거
      setSelectedMemberLocations(prev => prev.filter(loc => loc.id !== locationId));

    } catch (err) {
      console.error('위치 삭제 실패:', err);
      throw err;
    }
  }, []);

  // 초기 데이터 로드
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // 사용자의 기본 그룹 정보 가져오기
        const userGroups = await groupService.getCurrentUserGroups();
        if (userGroups.length > 0) {
          await changeGroup(userGroups[0].sgt_idx.toString());
        }
      } catch (err) {
        console.error('초기 데이터 로드 실패:', err);
        setError(err instanceof Error ? err.message : '초기 데이터를 불러오는 중 오류가 발생했습니다.');
      }
    };

    loadInitialData();
  }, []); // changeGroup 의존성 제거

  return {
    // 상태
    groupMembers,
    selectedMember,
    otherMembersLocations,
    selectedMemberLocations,
    isLoading,
    error,
    currentGroupId,

    // 함수
    refreshData,
    changeGroup,
    selectMember,
    saveLocation,
    updateLocation,
    deleteLocation
  };
};
