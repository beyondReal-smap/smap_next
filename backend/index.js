const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const helmet = require('helmet');
const morgan = require('morgan');

// 환경 변수 설정
const PORT = process.env.PORT || 5000;
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'smap2';
const DB_PASSWORD = process.env.DB_PASSWORD || 'dmonster';
const DB_NAME = process.env.DB_NAME || 'smap2_db';
const DB_PORT = process.env.DB_PORT || 3306;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3001';

// Express 앱 생성
const app = express();

// 미들웨어 설정
app.use(helmet());
app.use(morgan('dev'));
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MySQL 연결 풀 생성
const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  port: DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// 데이터베이스 연결 테스트 엔드포인트
app.get('/api/db-test', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT 1 as result');
    connection.release();
    res.json({ message: '데이터베이스 연결 성공', data: rows });
  } catch (error) {
    console.error('데이터베이스 연결 오류:', error);
    res.status(500).json({ message: '데이터베이스 연결 실패', error: error.message });
  }
});

// 기본 API 엔드포인트
app.get('/api', (req, res) => {
  res.json({ message: 'SMAP Next API 서버에 오신 것을 환영합니다!' });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
}); 