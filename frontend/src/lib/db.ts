import mysql from 'mysql2/promise';

// 환경 변수에서 DB 정보 가져오기
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smap',
};

// DB 연결 풀 생성
export const pool = mysql.createPool({
  ...dbConfig,
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
});

// DB 쿼리 실행 유틸리티 함수
export async function executeQuery<T>(query: string, params: any[] = []): Promise<T> {
  try {
    const [rows] = await pool.query(query, params);
    return rows as T;
  } catch (error: any) {
    console.error('Database error:', error.message);
    throw new Error(`Database query failed: ${error.message}`);
  }
} 