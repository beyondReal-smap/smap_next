'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PushFcm extends Model {
    static associate(models) {
      // define association here if needed
    }
  }
  PushFcm.init({
    pft_idx: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    pft_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: '푸시 고유번호 영문숫자코드 10자'
    },
    pft_title: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '제목 40자'
    },
    pft_content: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: '내용 140자'
    },
    pft_file1: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: '이미지 푸시에 표시'
    },
    pft_file1_ori: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: '원본파일명'
    },
    pft_file1_size: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: '파일사이즈'
    },
    pft_send_type: {
      type: DataTypes.TINYINT,
      allowNull: true,
      comment: '푸시대상 1:전체, 2:특정사용자, 3:그룹'
    },
    pft_send_mt_idx: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '푸시대상자 mt_idx'
    },
    pft_rdate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '발송예약일시'
    },
    pft_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '링크'
    },
    pft_status: {
      type: DataTypes.TINYINT,
      allowNull: true,
      comment: '상태 1:발송대기, 2:발송중, 3:발송완료'
    },
    pft_show: {
      type: DataTypes.ENUM('Y', 'N'),
      allowNull: true,
      defaultValue: 'Y',
      comment: '노출여부 관리자 삭제시 N'
    },
    pft_sdate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '발송시작일시'
    },
    pft_edate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '발송종료일시'
    },
    pft_wdate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '등록일시'
    }
  }, {
    sequelize,
    modelName: 'PushFcm',
    tableName: 'push_fcm_t',
    timestamps: false
  });
  return PushFcm;
}; 