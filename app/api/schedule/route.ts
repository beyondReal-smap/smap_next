import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
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

    if (act === 'event_source') {
      // 일정 소스(캘린더)
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM smap_schedule_t WHERE mt_idx = ? AND sst_show = 'Y' AND sst_sdate >= ? AND sst_edate <= ?`,
        [user.mt_idx, params.start, params.end]
      );
      return NextResponse.json(rows);
    }

    if (act === 'member_schedule_list') {
      if (!params.sgdt_idx || !params.event_start_date) {
        return NextResponse.json({ result: 'N', message: 'sgdt_idx, event_start_date required' });
      }
      // 그룹 멤버 리스트
      const [members] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM smap_group_detail_t WHERE sgdt_idx = ? AND sgdt_discharge = 'N' AND sgdt_exit = 'N'`, [params.sgdt_idx]
      );
      // 각 멤버별 일정
      const memberSchedules: any = {};
      for (const member of members) {
        const [schedules] = await pool.query<RowDataPacket[]>(
          `SELECT * FROM smap_schedule_t WHERE mt_idx = ? AND DATE(sst_sdate) = ? AND sst_show = 'Y'`,
          [member.mt_idx, params.event_start_date]
        );
        memberSchedules[member.sgdt_idx] = {
          member_info: member,
          schedules
        };
      }
      return NextResponse.json({ result: 'Y', members: memberSchedules });
    }

    if (act === 'group_schedule_list') {
      if (!params.sgt_idx || !params.event_start_date) {
        return NextResponse.json({ result: 'N', message: 'sgt_idx, event_start_date required' });
      }
      // 그룹 멤버 리스트
      const [members] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM smap_group_detail_t WHERE sgt_idx = ? AND sgdt_discharge = 'N' AND sgdt_exit = 'N'`, [params.sgt_idx]
      );
      // 각 멤버별 일정
      const memberSchedules: any = {};
      for (const member of members) {
        const [schedules] = await pool.query<RowDataPacket[]>(
          `SELECT * FROM smap_schedule_t WHERE mt_idx = ? AND DATE(sst_sdate) = ? AND sst_show = 'Y'`,
          [member.mt_idx, params.event_start_date]
        );
        memberSchedules[member.sgdt_idx] = {
          member_info: member,
          schedules
        };
      }
      return NextResponse.json({ result: 'Y', members: memberSchedules });
    }

    if (act === 'schedule_add') {
      if (!params.sst_title || !params.sst_sdate || !params.sst_edate) {
        return NextResponse.json('N');
      }
      await pool.query<ResultSetHeader>(
        `INSERT INTO smap_schedule_t (mt_idx, sst_title, sst_sdate, sst_edate, sst_show, sst_wdate)
         VALUES (?, ?, ?, ?, 'Y', NOW())`,
        [user.mt_idx, params.sst_title, params.sst_sdate, params.sst_edate]
      );
      return NextResponse.json('Y');
    }

    if (act === 'schedule_update') {
      if (!params.sst_idx || !params.sst_title || !params.sst_sdate || !params.sst_edate) {
        return NextResponse.json('N');
      }
      await pool.query<ResultSetHeader>(
        `UPDATE smap_schedule_t SET sst_title = ?, sst_sdate = ?, sst_edate = ?, sst_udate = NOW() WHERE sst_idx = ? AND mt_idx = ?`,
        [params.sst_title, params.sst_sdate, params.sst_edate, params.sst_idx, user.mt_idx]
      );
      return NextResponse.json('Y');
    }

    if (act === 'schedule_delete') {
      if (!params.sst_idx) {
        return NextResponse.json('N');
      }
      await pool.query<ResultSetHeader>(
        `UPDATE smap_schedule_t SET sst_show = 'N', sst_ddate = NOW() WHERE sst_idx = ? AND mt_idx = ?`,
        [params.sst_idx, user.mt_idx]
      );
      return NextResponse.json('Y');
    }

    if (act === 'schedule_detail') {
      if (!params.sst_idx) {
        return NextResponse.json('N');
      }
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM smap_schedule_t WHERE sst_idx = ? AND mt_idx = ? AND sst_show = 'Y'`,
        [params.sst_idx, user.mt_idx]
      );
      const row = rows[0];
      if (!row) return NextResponse.json('N');
      return NextResponse.json(row);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Schedule API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 