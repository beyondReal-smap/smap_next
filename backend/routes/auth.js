const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const router = express.Router();

// 데이터베이스 연결 설정
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smap_db',
  charset: 'utf8'
};

// 비밀번호 변경 API
router.post('/change-password', async (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;

  if (!userId || !currentPassword || !newPassword) {
    return res.status(400).json({
      error: '필수 정보가 누락되었습니다'
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      error: '새 비밀번호는 8자 이상이어야 합니다'
    });
  }

  let connection;
  try {
    // 데이터베이스 연결
    connection = await mysql.createConnection(dbConfig);

    // 현재 사용자 정보 조회
    const [rows] = await connection.execute(
      'SELECT mt_id, mt_pwd FROM member_t WHERE mt_id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: '사용자를 찾을 수 없습니다'
      });
    }

    const user = rows[0];

    // 현재 비밀번호 확인
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.mt_pwd);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        error: '현재 비밀번호가 일치하지 않습니다'
      });
    }

    // 새 비밀번호 해시화
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // 데이터베이스에서 비밀번호 업데이트
    await connection.execute(
      'UPDATE member_t SET mt_pwd = ?, mt_update_date = NOW() WHERE mt_id = ?',
      [hashedNewPassword, userId]
    );

    res.json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다'
    });

  } catch (error) {
    console.error('비밀번호 변경 오류:', error);
    res.status(500).json({
      error: '서버 오류가 발생했습니다'
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

module.exports = router; 