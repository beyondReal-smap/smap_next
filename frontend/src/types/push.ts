export interface PushLog {
  plt_idx: number;
  plt_type: number;
  mt_idx: number;
  sst_idx: number | null;
  plt_condition: string;
  plt_memo: string;
  plt_title: string;
  plt_content: string;
  plt_sdate: string;
  plt_status: number;
  plt_read_chk: 'Y' | 'N';
  plt_show: 'Y' | 'N';
  push_json: string;
  plt_wdate: string;
  plt_rdate: string | null;
}

export interface DeleteAllResponse {
  message: string;
}

export interface ReadAllResponse {
  message: string;
} 