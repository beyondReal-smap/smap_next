import { NextRequest, NextResponse } from 'next/server';
import { pool } from '../../../lib/db';
import { verifyJWT } from '../../../lib/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    const user = token ? verifyJWT(token) : null;
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { act, ...params } = body;

    if (act === 'get_line') {
      if (!params.sgdt_idx || !params.event_start_date) {
        return NextResponse.json({ error: 'sgdt_idx, event_start_date required' }, { status: 400 });
      }
      // 그룹 상세 정보
      const [sgdt_rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM smap_group_detail_t WHERE sgdt_idx = ?`, [params.sgdt_idx]
      );
      const sgdt_row = sgdt_rows[0];
      if (!sgdt_row) return NextResponse.json({ error: 'Group detail not found' }, { status: 404 });
      
      // 멤버 정보
      const [mem_rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM member_t WHERE mt_idx = ?`, [sgdt_row.mt_idx]
      );
      const mem_row = mem_rows[0];
      
      // 일정 마커(해당 날짜의 일정)
      const [schedules] = await pool.query<RowDataPacket[]>(
        `SELECT sst_location_lat, sst_location_long, sst_title FROM smap_schedule_t WHERE mt_idx = ? AND DATE(sst_sdate) = ? AND sst_show = 'Y'`,
        [sgdt_row.mt_idx, params.event_start_date]
      );
      // 내장소 마커
      const [locations] = await pool.query<RowDataPacket[]>(
        `SELECT slt_lat, slt_long, slt_title FROM smap_location_t WHERE (mt_idx = ? OR sgdt_idx = ?) AND slt_show = 'Y' ORDER BY slt_wdate ASC LIMIT 10`,
        [sgdt_row.mt_idx, params.sgdt_idx]
      );
      // 이동로그(해당 날짜)
      const [moveLogs] = await pool.query<RowDataPacket[]>(
        `SELECT mlt_lat, mlt_long, mlt_gps_time FROM member_location_log_t WHERE mt_idx = ? AND mlt_gps_time BETWEEN ? AND ? ORDER BY mlt_gps_time ASC`,
        [sgdt_row.mt_idx, params.event_start_date + ' 00:00:00', params.event_start_date + ' 23:59:59']
      );
      // 체류로그(해당 날짜, 예시: 5분 이상 머문 위치)
      const [stayLogs] = await pool.query<RowDataPacket[]>(
        `SELECT mlt_lat, mlt_long, MIN(mlt_gps_time) as start_time, MAX(mlt_gps_time) as end_time
         FROM member_location_log_t
         WHERE mt_idx = ? AND mlt_gps_time BETWEEN ? AND ? AND mlt_speed < 1
         GROUP BY mlt_lat, mlt_long
         HAVING TIMESTAMPDIFF(MINUTE, start_time, end_time) >= 5`,
        [sgdt_row.mt_idx, params.event_start_date + ' 00:00:00', params.event_start_date + ' 23:59:59']
      );
      return NextResponse.json({
        schedules,
        locations,
        moveLogs,
        stayLogs
      });
    }

    if (act === 'input_location') {
      if (!params.sgdt_idx || !params.sst_location_add) {
        return NextResponse.json({ error: 'sgdt_idx, sst_location_add required' }, { status: 400 });
      }
      // 기존 장소 중복 체크
      const [slt_rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM smap_location_t WHERE mt_idx = ? AND sgdt_idx = ? AND slt_add = ? AND slt_show = 'Y'`,
        [user.mt_idx, params.sgdt_idx, params.sst_location_add]
      );
      const row_slt = slt_rows[0];
      let last_idx;
      if (row_slt?.slt_idx) {
        // 이미 있으면 slt_show = 'N'으로 업데이트
        await pool.query(
          `UPDATE smap_location_t SET slt_show = 'N' WHERE slt_idx = ?`,
          [row_slt.slt_idx]
        );
        last_idx = row_slt.slt_idx;
      } else {
        // 없으면 새로 insert
        const [result] = await pool.query<ResultSetHeader>(
          `INSERT INTO smap_location_t (mt_idx, slt_title, sgt_idx, sgdt_idx, slt_add, slt_lat, slt_long, slt_show, slt_enter_alarm, slt_wdate)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'Y', 'Y', NOW())`,
          [user.mt_idx, params.slt_title, params.sgt_idx, params.sgdt_idx, params.sst_location_add, params.sst_location_lat, params.sst_location_long]
        );
        last_idx = result.insertId;
      }
      return NextResponse.json('Y');
    }

    if (act === 'location_map_list') {
      const sgdt_idx = params.sgdt_idx;
      const sgt_idx = params.sgt_idx;
      const mt_idx = params.mt_idx || user.mt_idx;
      // 내장소 리스트
      const [slt_list] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM smap_location_t WHERE (sgdt_idx = ? OR mt_idx = ?) AND slt_show = 'Y' ORDER BY slt_wdate ASC LIMIT 10`,
        [sgdt_idx, mt_idx]
      );
      // 오너인 그룹수
      const [row1_rows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as cnt FROM smap_group_t WHERE mt_idx = ? AND sgt_show = 'Y'`, [mt_idx]
      );
      const row1 = row1_rows[0];
      // 리더인 그룹수
      const [row2_rows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as cnt FROM smap_group_detail_t WHERE mt_idx = ? AND sgdt_leader_chk = 'Y' AND sgdt_show = 'Y' AND sgdt_discharge = 'N' AND sgdt_exit = 'N'`, [mt_idx]
      );
      const row2 = row2_rows[0];
      // 추천장소
      const [rlt_list] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM recomand_location_t WHERE rlt_show = 'Y'`,
      );
      return NextResponse.json({
        result: 'success',
        data: {
          slt_list,
          sgt_cnt: row1?.cnt || 0,
          sgdt_leader_cnt: row2?.cnt || 0,
          rlt_list
        }
      });
    }

    if (act === 'location_delete') {
      if (!params.slt_idx) {
        return NextResponse.json({ error: 'slt_idx required' }, { status: 400 });
      }
      await pool.query(
        `UPDATE smap_location_t SET slt_show = 'N', slt_ddate = NOW() WHERE slt_idx = ?`,
        [params.slt_idx]
      );
      return NextResponse.json('Y');
    }

    if (act === 'location_alarm_chk') {
      if (!params.slt_idx) {
        return NextResponse.json({ error: 'slt_idx required' }, { status: 400 });
      }
      // 현재 상태 확인
      const [alarm_rows] = await pool.query<RowDataPacket[]>(
        `SELECT slt_enter_alarm FROM smap_location_t WHERE slt_idx = ?`, [params.slt_idx]
      );
      const row = alarm_rows[0];
      const newValue = row?.slt_enter_alarm === 'Y' ? 'N' : 'Y';
      await pool.query(
        `UPDATE smap_location_t SET slt_enter_alarm = ?, slt_udate = NOW() WHERE slt_idx = ?`,
        [newValue, params.slt_idx]
      );
      return NextResponse.json('Y');
    }

    if (act === 'location_add') {
      if (!params.sgdt_idx || !params.slt_title || !params.slt_add || !params.slt_lat || !params.slt_long) {
        return NextResponse.json('N');
      }
      // 회원 정보
      const [mem_rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM member_t WHERE mt_idx = ?`, [user.mt_idx]
      );
      const mem_row = mem_rows[0];
      if (!mem_row) return NextResponse.json('N');
      
      // 그룹 정보
      const [sgdt_rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM smap_group_detail_t WHERE sgdt_idx = ?`, [params.sgdt_idx]
      );
      const sgdt_row = sgdt_rows[0];
      if (!sgdt_row) return NextResponse.json('N');
      
      // 내장소 개수 제한
      const [slt_list] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM smap_location_t WHERE mt_idx = ? AND sgdt_idx = ? AND slt_show = 'Y'`,
        [sgdt_row.mt_idx, sgdt_row.sgdt_idx]
      );
      if ((slt_list.length < 4 && mem_row.mt_level == 2) || mem_row.mt_level == 5) {
        await pool.query<ResultSetHeader>(
          `INSERT INTO smap_location_t (insert_mt_idx, mt_idx, sgt_idx, sgdt_idx, slt_title, slt_add, slt_lat, slt_long, slt_show, slt_enter_alarm, slt_wdate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Y', 'Y', NOW())`,
          [user.mt_idx, sgdt_row.mt_idx, sgdt_row.sgt_idx, sgdt_row.sgdt_idx, params.slt_title, params.slt_add, params.slt_lat, params.slt_long]
        );
        return NextResponse.json('Y');
      } else {
        return NextResponse.json('E');
      }
    }

    if (act === 'group_member_list') {
      try {
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT mt_idx, mt_name, mt_file1 
           FROM member_t 
           WHERE mt_show = 'Y' 
           ORDER BY mt_name ASC`
        );
        return NextResponse.json(rows);
      } catch (err: any) {
        console.error('[API/location][group_member_list] DB 쿼리 에러:', err);
        return NextResponse.json({ error: 'DB error', detail: err.message }, { status: 500 });
      }
    }

    if (act === 'marker_reload') {
      if (!params.sgdt_idx) {
        return NextResponse.json({ error: 'sgdt_idx required' }, { status: 400 });
      }
      // 그룹 상세 정보
      const [sgdt_rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM smap_group_detail_t WHERE sgdt_idx = ?`, [params.sgdt_idx]
      );
      const sgdt_row = sgdt_rows[0];
      
      // 멤버 정보
      const [mem_rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM member_t WHERE mt_idx = ?`, [sgdt_row.mt_idx]
      );
      const mem_row = mem_rows[0];
      
      // 최근 위치 정보
      const [location_rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM member_location_log_t WHERE mt_idx = ? ORDER BY mlt_gps_time DESC LIMIT 1`, [sgdt_row.mt_idx]
      );
      const mt_location_info = location_rows[0];
      
      const my_lat = mt_location_info?.mlt_lat || mem_row?.mt_lat || 37.5665;
      const mt_long = mt_location_info?.mlt_long || mem_row?.mt_long || 126.9780;
      const my_profile = mem_row?.mt_file1 || '';
      
      return NextResponse.json({
        my_lat,
        mt_long,
        my_profile,
        mem_row,
        mt_location_info
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Location API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 