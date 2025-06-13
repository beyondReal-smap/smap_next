const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const router = express.Router();
const apiClient = require('../utils/apiClient');

// 데이터베이스 연결 설정 (백업용)
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smap',
  charset: 'utf8mb4'
};

/**
 * JWT 토큰에서 사용자 ID 추출
 */
function extractUserIdFromToken(token) {
  try {
    const decoded = jwt.decode(token);
    console.log('Decoded token:', decoded);
    return decoded?.mt_idx || decoded?.sub || decoded?.id;
  } catch (error) {
    console.error('토큰 디코딩 실패:', error);
    return null;
  }
}

/**
 * 외부 API로 현재 비밀번호 확인
 */
async function verifyPasswordExternalAPI(memberId, currentPassword) {
  try {
    // 먼저 회원 정보 조회
    const memberResponse = await apiClient.get(`/api/v1/members/${memberId}`);
    
    if (!memberResponse.success || !memberResponse.data) {
      throw new Error('회원 정보를 찾을 수 없습니다.');
    }

    // 로그인 시도로 비밀번호 확인
    const loginResponse = await apiClient.post('/api/v1/members/login', {
      mt_id: memberResponse.data.mt_id,
      mt_pwd: currentPassword
    });

    return loginResponse.success;
  } catch (error) {
    console.error('외부 API 비밀번호 확인 실패:', error);
    return false;
  }
}

/**
 * 외부 API로 비밀번호 업데이트
 */
async function updatePasswordExternalAPI(memberId, newPassword) {
  try {
    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    const response = await apiClient.put(`/api/v1/members/${memberId}`, {
      mt_pwd: hashedPassword
    });

    return response.success;
  } catch (error) {
    console.error('외부 API 비밀번호 업데이트 실패:', error);
    return false;
  }
}

/**
 * 데이터베이스에서 직접 현재 비밀번호 확인 (백업)
 */
async function verifyPasswordDatabase(memberId, currentPassword) {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const [rows] = await connection.execute(
      'SELECT mt_pwd FROM member_t WHERE mt_idx = ? AND mt_show = "Y"',
      [memberId]
    );

    if (rows.length === 0) {
      throw new Error('회원 정보를 찾을 수 없습니다.');
    }

    const storedPassword = rows[0].mt_pwd;
    return await bcrypt.compare(currentPassword, storedPassword);
  } catch (error) {
    console.error('데이터베이스 비밀번호 확인 실패:', error);
    return false;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * 데이터베이스에서 직접 비밀번호 업데이트 (백업)
 */
async function updatePasswordDatabase(memberId, newPassword) {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    const [result] = await connection.execute(
      'UPDATE member_t SET mt_pwd = ?, mt_udate = NOW() WHERE mt_idx = ? AND mt_show = "Y"',
      [hashedPassword, memberId]
    );

    return result.affectedRows > 0;
  } catch (error) {
    console.error('데이터베이스 비밀번호 업데이트 실패:', error);
    return false;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * 현재 비밀번호 확인
 * POST /api/member/verify-password
 */
router.post('/verify-password', async (req, res) => {
  try {
    const { currentPassword } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '인증 토큰이 필요합니다.'
      });
    }

    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message: '현재 비밀번호를 입력해주세요.'
      });
    }

    const memberId = extractUserIdFromToken(token);
    if (!memberId) {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 토큰입니다.'
      });
    }

    console.log(`비밀번호 확인 시도 - 회원 ID: ${memberId}`);

    // 1단계: 외부 API 시도
    let isValid = false;
    try {
      isValid = await verifyPasswordExternalAPI(memberId, currentPassword);
      console.log('외부 API 비밀번호 확인 결과:', isValid);
    } catch (error) {
      console.log('외부 API 실패, 데이터베이스로 폴백');
      // 2단계: 데이터베이스 직접 접근으로 폴백
      isValid = await verifyPasswordDatabase(memberId, currentPassword);
      console.log('데이터베이스 비밀번호 확인 결과:', isValid);
    }

    if (isValid) {
      res.json({
        success: true,
        message: '비밀번호가 확인되었습니다.'
      });
    } else {
      res.status(400).json({
        success: false,
        message: '현재 비밀번호가 일치하지 않습니다.'
      });
    }

  } catch (error) {
    console.error('비밀번호 확인 중 오류:', error);
    res.status(500).json({
      success: false,
      message: '비밀번호 확인 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 비밀번호 변경
 * POST /api/member/change-password
 */
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '인증 토큰이 필요합니다.'
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.'
      });
    }

    // 비밀번호 강도 검사
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: '새 비밀번호는 8자 이상, 대소문자, 숫자, 특수문자를 포함해야 합니다.'
      });
    }

    const memberId = extractUserIdFromToken(token);
    if (!memberId) {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 토큰입니다.'
      });
    }

    console.log(`비밀번호 변경 시도 - 회원 ID: ${memberId}`);

    // 먼저 현재 비밀번호 확인
    let isCurrentPasswordValid = false;
    try {
      isCurrentPasswordValid = await verifyPasswordExternalAPI(memberId, currentPassword);
      console.log('외부 API 현재 비밀번호 확인 결과:', isCurrentPasswordValid);
    } catch (error) {
      console.log('외부 API 실패, 데이터베이스로 폴백');
      isCurrentPasswordValid = await verifyPasswordDatabase(memberId, currentPassword);
      console.log('데이터베이스 현재 비밀번호 확인 결과:', isCurrentPasswordValid);
    }

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: '현재 비밀번호가 일치하지 않습니다.'
      });
    }

    // 비밀번호 업데이트
    let updateSuccess = false;
    try {
      updateSuccess = await updatePasswordExternalAPI(memberId, newPassword);
      console.log('외부 API 비밀번호 업데이트 결과:', updateSuccess);
    } catch (error) {
      console.log('외부 API 실패, 데이터베이스로 폴백');
      updateSuccess = await updatePasswordDatabase(memberId, newPassword);
      console.log('데이터베이스 비밀번호 업데이트 결과:', updateSuccess);
    }

    if (updateSuccess) {
      res.json({
        success: true,
        message: '비밀번호가 성공적으로 변경되었습니다.'
      });
    } else {
      res.status(500).json({
        success: false,
        message: '비밀번호 변경에 실패했습니다.'
      });
    }

  } catch (error) {
    console.error('비밀번호 변경 중 오류:', error);
    res.status(500).json({
      success: false,
      message: '비밀번호 변경 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 회원 정보 조회 (디버깅용)
 * GET /api/member/info
 */
router.get('/info', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '인증 토큰이 필요합니다.'
      });
    }

    const memberId = extractUserIdFromToken(token);
    if (!memberId) {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 토큰입니다.'
      });
    }

    // 외부 API로 회원 정보 조회
    try {
      const response = await apiClient.get(`/api/v1/members/${memberId}`);
      
      if (response.success && response.data) {
        // 민감한 정보 제거
        const { mt_pwd, ...safeData } = response.data;
        
        res.json({
          success: true,
          data: safeData
        });
      } else {
        res.status(404).json({
          success: false,
          message: '회원 정보를 찾을 수 없습니다.'
        });
      }
    } catch (error) {
      console.error('회원 정보 조회 실패:', error);
      res.status(500).json({
        success: false,
        message: '회원 정보 조회에 실패했습니다.'
      });
    }

  } catch (error) {
    console.error('회원 정보 조회 중 오류:', error);
    res.status(500).json({
      success: false,
      message: '회원 정보 조회 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router; 