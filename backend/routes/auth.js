const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const router = express.Router();

// 유틸리티 import
const apiClient = require('../utils/apiClient');

// 데이터베이스 연결 설정 (백업용)
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smap',
  charset: 'utf8mb4'
};

// 헬스 체크 API
router.get('/health', async (req, res) => {
  try {
    console.log('🏥 백엔드 서버 헬스 체크');
    
    // 외부 API 서버 연결 테스트
    const externalApiHealth = await apiClient.testConnection();
    
    // 데이터베이스 연결 테스트
    let dbHealth = false;
    try {
      const connection = await mysql.createConnection(dbConfig);
      await connection.ping();
      await connection.end();
      dbHealth = true;
    } catch (dbError) {
      console.error('데이터베이스 연결 실패:', dbError.message);
    }

    res.json({
      success: true,
      message: '백엔드 서버가 정상 작동 중입니다',
      status: {
        backend: true,
        externalAPI: externalApiHealth,
        database: dbHealth,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('헬스 체크 중 오류:', error);
    res.status(500).json({
      success: false,
      message: '헬스 체크 중 오류가 발생했습니다',
      error: error.message
    });
  }
});

// 로그인 API (기존 호환성 유지)
router.post('/login', async (req, res) => {
  try {
    const { mt_id, mt_pwd } = req.body;

    if (!mt_id || !mt_pwd) {
      return res.status(400).json({
        success: false,
        message: '아이디와 비밀번호를 입력해주세요.'
      });
    }

    console.log(`로그인 시도: ${mt_id}`);

    // 1단계: 외부 API 시도
    try {
      const response = await apiClient.authLogin({ mt_id, mt_pwd });
      
      if (response.success) {
        console.log('외부 API 로그인 성공');
        return res.json(response);
      }
    } catch (error) {
      console.log('외부 API 로그인 실패, 데이터베이스로 폴백');
    }

    // 2단계: 데이터베이스 직접 접근으로 폴백
    let connection;
    try {
      connection = await mysql.createConnection(dbConfig);

      const [rows] = await connection.execute(
        'SELECT mt_idx, mt_id, mt_name, mt_nickname, mt_pwd, mt_type FROM member_t WHERE mt_id = ? AND mt_show = "Y"',
        [mt_id]
      );

      if (rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: '아이디 또는 비밀번호가 일치하지 않습니다.'
        });
      }

      const user = rows[0];
      const isPasswordValid = await bcrypt.compare(mt_pwd, user.mt_pwd);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: '아이디 또는 비밀번호가 일치하지 않습니다.'
        });
      }

      // JWT 토큰 생성
      const token = jwt.sign(
        { 
          mt_idx: user.mt_idx,
          mt_id: user.mt_id,
          mt_name: user.mt_name,
          mt_nickname: user.mt_nickname,
          mt_type: user.mt_type
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // 로그인 시간 업데이트
      await connection.execute(
        'UPDATE member_t SET mt_ldate = NOW() WHERE mt_idx = ?',
        [user.mt_idx]
      );

      console.log('데이터베이스 로그인 성공');
      
      res.json({
        success: true,
        message: '로그인 성공',
        data: {
          access_token: token,
          token_type: 'Bearer',
          user: {
            mt_idx: user.mt_idx,
            mt_id: user.mt_id,
            mt_name: user.mt_name,
            mt_nickname: user.mt_nickname,
            mt_type: user.mt_type
          }
        }
      });

    } catch (dbError) {
      console.error('데이터베이스 로그인 실패:', dbError);
      res.status(500).json({
        success: false,
        message: '로그인 처리 중 오류가 발생했습니다.'
      });
    } finally {
      if (connection) {
        await connection.end();
      }
    }

  } catch (error) {
    console.error('로그인 중 오류:', error);
    res.status(500).json({
      success: false,
      message: '로그인 중 오류가 발생했습니다.'
    });
  }
});

// 토큰 검증 미들웨어
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '액세스 토큰이 없습니다.'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: '유효하지 않은 토큰입니다.'
      });
    }
    req.user = user;
    next();
  });
}

// 사용자 정보 조회 (토큰 기반)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.mt_idx;

    // 1단계: 외부 API 시도
    try {
      const response = await apiClient.getMember(userId);
      
      if (response.success && response.data) {
        // 민감한 정보 제거
        const { mt_pwd, ...safeData } = response.data;
        return res.json({
          success: true,
          data: safeData
        });
      }
    } catch (error) {
      console.log('외부 API 사용자 정보 조회 실패, 데이터베이스로 폴백');
    }

    // 2단계: 데이터베이스 직접 접근으로 폴백
    let connection;
    try {
      connection = await mysql.createConnection(dbConfig);

      const [rows] = await connection.execute(
        'SELECT mt_idx, mt_id, mt_name, mt_nickname, mt_email, mt_hp, mt_type, mt_wdate, mt_ldate FROM member_t WHERE mt_idx = ? AND mt_show = "Y"',
        [userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: '사용자 정보를 찾을 수 없습니다.'
        });
      }

      res.json({
        success: true,
        data: rows[0]
      });

    } catch (dbError) {
      console.error('데이터베이스 사용자 정보 조회 실패:', dbError);
      res.status(500).json({
        success: false,
        message: '사용자 정보 조회에 실패했습니다.'
      });
    } finally {
      if (connection) {
        await connection.end();
      }
    }

  } catch (error) {
    console.error('사용자 정보 조회 중 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 정보 조회 중 오류가 발생했습니다.'
    });
  }
});

// 토큰 새로고침
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    // 새 토큰 생성
    const newToken = jwt.sign(
      { 
        mt_idx: user.mt_idx,
        mt_id: user.mt_id,
        mt_name: user.mt_name,
        mt_nickname: user.mt_nickname,
        mt_type: user.mt_type
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      message: '토큰이 새로고침되었습니다.',
      data: {
        access_token: newToken,
        token_type: 'Bearer'
      }
    });

  } catch (error) {
    console.error('토큰 새로고침 중 오류:', error);
    res.status(500).json({
      success: false,
      message: '토큰 새로고침 중 오류가 발생했습니다.'
    });
  }
});

// 로그아웃 (클라이언트에서 토큰 제거)
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: '로그아웃되었습니다. 클라이언트에서 토큰을 제거해주세요.'
  });
});

module.exports = router; 