import apiClient from './apiClient';
import { 
    AllDayCheckEnum, ShowEnum, ScheduleAlarmCheckEnum, InCheckEnum, ScheduleCheckEnum 
} from '../types/enums'; // 생성한 Enum 타입 임포트

// Schedule 인터페이스를 home/page.tsx와 동일하게 확장
interface Schedule {
  id: string; // sst_idx
  sst_pidx?: number | null;
  memberId?: string | null; // mt_idx
  mt_schedule_idx?: number | null; // 새로 추가된 필드
  title?: string | null; // sst_title
  date?: string | null; // sst_sdate
  sst_edate?: string | null;
  sst_sedate?: string | null;
  sst_all_day?: AllDayCheckEnum | null;
  sst_repeat_json?: string | null;
  sst_repeat_json_v?: string | null;
  sgt_idx?: number | null;
  sgdt_idx?: number | null;
  sgdt_idx_t?: string | null;
  sst_alram?: number | null;
  sst_alram_t?: string | null;
  sst_adate?: string | null;
  slt_idx?: number | null;
  slt_idx_t?: string | null;
  location?: string | null; // sst_location_title
  sst_location_add?: string | null;
  sst_location_lat?: number | null;
  sst_location_long?: number | null;
  sst_supplies?: string | null;
  sst_memo?: string | null;
  sst_show?: ShowEnum | null;
  sst_location_alarm?: number | null;
  sst_schedule_alarm_chk?: ScheduleAlarmCheckEnum | null;
  sst_pick_type?: string | null;
  sst_pick_result?: number | null;
  sst_schedule_alarm?: string | null;
  sst_update_chk?: string | null;
  sst_wdate?: string | null;
  sst_udate?: string | null;
  sst_ddate?: string | null;
  sst_in_chk?: InCheckEnum | null;
  sst_schedule_chk?: ScheduleCheckEnum | null;
  sst_entry_cnt?: number | null;
  sst_exit_cnt?: number | null;
}

const scheduleService = {
  // 특정 그룹의 스케줄 목록 가져오기 (기간 필터링 추가)
  async getGroupSchedules(groupId: string, days?: number): Promise<Schedule[]> {
    try {
      let url = `/api/schedules/group/${groupId}`;
      if (days !== undefined && days > 0) {
        url += `?days=${days}`;
      }
      const response = await apiClient.get(url);
      return response.data.map((item: any) => ({
        id: item.sst_idx?.toString(), // Optional chaining and nullish coalescing for safety
        sst_pidx: item.sst_pidx ?? null,
        memberId: item.mt_idx?.toString() ?? null,
        mt_schedule_idx: item.mt_schedule_idx ?? null, // 매핑 추가
        title: item.sst_title ?? null,
        date: item.sst_sdate ?? null, 
        sst_edate: item.sst_edate ?? null,
        sst_sedate: item.sst_sedate ?? null,
        sst_all_day: item.sst_all_day ?? null,
        sst_repeat_json: item.sst_repeat_json ?? null,
        sst_repeat_json_v: item.sst_repeat_json_v ?? null,
        sgt_idx: item.sgt_idx ?? null,
        sgdt_idx: item.sgdt_idx ?? null,
        sgdt_idx_t: item.sgdt_idx_t ?? null,
        sst_alram: item.sst_alram ?? null,
        sst_alram_t: item.sst_alram_t ?? null,
        sst_adate: item.sst_adate ?? null,
        slt_idx: item.slt_idx ?? null,
        slt_idx_t: item.slt_idx_t ?? null,
        location: item.sst_location_title ?? null,
        sst_location_add: item.sst_location_add ?? null,
        sst_location_lat: item.sst_location_lat ? parseFloat(item.sst_location_lat) : null, // Decimal to number
        sst_location_long: item.sst_location_long ? parseFloat(item.sst_location_long) : null, // Decimal to number
        sst_supplies: item.sst_supplies ?? null,
        sst_memo: item.sst_memo ?? null,
        sst_show: item.sst_show ?? null,
        sst_location_alarm: item.sst_location_alarm ?? null,
        sst_schedule_alarm_chk: item.sst_schedule_alarm_chk ?? null,
        sst_pick_type: item.sst_pick_type ?? null,
        sst_pick_result: item.sst_pick_result ?? null,
        sst_schedule_alarm: item.sst_schedule_alarm ?? null,
        sst_update_chk: item.sst_update_chk ?? null,
        sst_wdate: item.sst_wdate ?? null,
        sst_udate: item.sst_udate ?? null,
        sst_ddate: item.sst_ddate ?? null,
        sst_in_chk: item.sst_in_chk ?? null,
        sst_schedule_chk: item.sst_schedule_chk ?? null,
        sst_entry_cnt: item.sst_entry_cnt ?? null,
        sst_exit_cnt: item.sst_exit_cnt ?? null,
      } as Schedule)) as Schedule[];
    } catch (error) {
      console.error(`Error fetching group schedules for group ${groupId}:`, error);
      return [];
    }
  },

  // 특정 스케줄 상세 정보 가져오기 (예시)
  async getScheduleById(scheduleId: string): Promise<Schedule | null> {
    try {
      const response = await apiClient.get(`/schedules/${scheduleId}`);
      const item = response.data;
      if (!item) return null;
      return {
        id: item.sst_idx?.toString(),
        sst_pidx: item.sst_pidx ?? null,
        memberId: item.mt_idx?.toString() ?? null,
        mt_schedule_idx: item.mt_schedule_idx ?? null, // 매핑 추가
        title: item.sst_title ?? null,
        date: item.sst_sdate ?? null,
        sst_edate: item.sst_edate ?? null,
        sst_sedate: item.sst_sedate ?? null,
        sst_all_day: item.sst_all_day ?? null,
        sst_repeat_json: item.sst_repeat_json ?? null,
        sst_repeat_json_v: item.sst_repeat_json_v ?? null,
        sgt_idx: item.sgt_idx ?? null,
        sgdt_idx: item.sgdt_idx ?? null,
        sgdt_idx_t: item.sgdt_idx_t ?? null,
        sst_alram: item.sst_alram ?? null,
        sst_alram_t: item.sst_alram_t ?? null,
        sst_adate: item.sst_adate ?? null,
        slt_idx: item.slt_idx ?? null,
        slt_idx_t: item.slt_idx_t ?? null,
        location: item.sst_location_title ?? null,
        sst_location_add: item.sst_location_add ?? null,
        sst_location_lat: item.sst_location_lat ? parseFloat(item.sst_location_lat) : null,
        sst_location_long: item.sst_location_long ? parseFloat(item.sst_location_long) : null,
        sst_supplies: item.sst_supplies ?? null,
        sst_memo: item.sst_memo ?? null,
        sst_show: item.sst_show ?? null,
        sst_location_alarm: item.sst_location_alarm ?? null,
        sst_schedule_alarm_chk: item.sst_schedule_alarm_chk ?? null,
        sst_pick_type: item.sst_pick_type ?? null,
        sst_pick_result: item.sst_pick_result ?? null,
        sst_schedule_alarm: item.sst_schedule_alarm ?? null,
        sst_update_chk: item.sst_update_chk ?? null,
        sst_wdate: item.sst_wdate ?? null,
        sst_udate: item.sst_udate ?? null,
        sst_ddate: item.sst_ddate ?? null,
        sst_in_chk: item.sst_in_chk ?? null,
        sst_schedule_chk: item.sst_schedule_chk ?? null,
        sst_entry_cnt: item.sst_entry_cnt ?? null,
        sst_exit_cnt: item.sst_exit_cnt ?? null,
      } as Schedule;
    } catch (error) {
      console.error(`Error fetching schedule ${scheduleId}:`, error);
      return null;
    }
  },
  
  // 다른 스케줄 관련 API 함수들...
};

export default scheduleService; 