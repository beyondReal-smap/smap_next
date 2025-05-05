const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// 환경 변수 설정
const PORT = process.env.PORT || 5000;
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'smap2';
const DB_PASSWORD = process.env.DB_PASSWORD || 'dmonster';
const DB_NAME = process.env.DB_NAME || 'smap2_db';
const DB_PORT = process.env.DB_PORT || 3306;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

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

// 로그인 API 엔드포인트
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 필수 입력값 검증
    if (!email || !password) {
      return res.status(400).json({ message: '이메일과 비밀번호를 모두 입력해주세요.' });
    }

    // 임시 사용자 정보 (데모 목적으로만 사용, 실제로는 DB에서 조회해야 함)
    // 실제 구현 시에는 아래 주석 처리된 코드를 사용
    /*
    const connection = await pool.getConnection();
    const [users] = await connection.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    connection.release();

    if (users.length === 0) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    */

    // 테스트용 계정 확인 (개발 중에만 사용)
    if (email === 'test@example.com' && password === 'password') {
      // JWT 토큰 생성
      const token = jwt.sign(
        { id: 1, email, username: 'testuser' },
        JWT_SECRET,
        { expiresIn: '1d' }
      );

      return res.json({
        message: '로그인 성공',
        token,
        user: {
          id: 1,
          email,
          username: 'testuser'
        }
      });
    } else {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.', error: error.message });
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
}); 