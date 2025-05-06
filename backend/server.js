const express = require('express');
const cors = require('cors');
const { pool, testConnection } = require('./db');

const app = express();
const PORT = 3001;

// 미들웨어 설정
app.use(cors());
app.use(express.json());

// 데이터베이스 연결 테스트 API
app.get('/api/test-connection', async (req, res) => {
  const success = await testConnection();
  if (success) {
    res.json({ success: true, message: '데이터베이스 연결 성공!' });
  } else {
    res.status(500).json({ success: false, message: '데이터베이스 연결 실패' });
  }
});

// 사용자 위치 정보 가져오기 API
app.get('/api/user-location/:userId', async (req, res) => {
  const userId = req.params.userId;
  
  try {
    // member_t 테이블에서 사용자의 위치 정보 조회
    const [rows] = await pool.query(
      'SELECT mt_idx, mt_id, mt_sido, mt_gu, mt_dong, mt_lat, mt_long FROM member_t WHERE mt_idx = ?',
      [userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }
    
    res.json({
      success: true,
      data: {
        userId: rows[0].mt_idx,
        username: rows[0].mt_id,
        location: {
          sido: rows[0].mt_sido || '서울시',
          gu: rows[0].mt_gu || '강남구',
          dong: rows[0].mt_dong || '',
          latitude: rows[0].mt_lat,
          longitude: rows[0].mt_long
        }
      }
    });
  } catch (error) {
    console.error('사용자 위치 정보 조회 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 모든 사용자 목록 가져오기 API
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT mt_idx, mt_id, mt_name, mt_nickname, mt_sido, mt_gu FROM member_t LIMIT 10'
    );
    
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
}); 