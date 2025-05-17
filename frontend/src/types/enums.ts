export type AllDayCheckEnum = 'Y' | 'N';
export type ShowEnum = 'Y' | 'N';
export type ScheduleAlarmCheckEnum = 'Y' | 'N';
export type InCheckEnum = 'Y' | 'N';
export type ScheduleCheckEnum = 'Y' | 'N';
 
// 필요에 따라 다른 Enum들도 추가 (예: sst_alram, sst_location_alarm 관련 타입 등)
// 예시:
// export type ScheduleAlarmTimeEnum = 1 | 2 | 3 | 4; // sst_alram (1:시작전, 2:10분전, ...)
// export type LocationAlarmEnum = 1 | 2 | 3 | 4;     // sst_location_alarm 