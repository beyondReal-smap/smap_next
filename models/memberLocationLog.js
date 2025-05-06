'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class MemberLocationLog extends Model {
    static associate(models) {
      // define association here if needed, e.g.:
      // this.belongsTo(models.Member, { foreignKey: 'mt_idx', targetKey: 'mt_idx' });
    }
  }
  MemberLocationLog.init({
    mlt_idx: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    mt_idx: {
      type: DataTypes.INTEGER,
      allowNull: false, // Marked as PRI in CSV
      // primaryKey: true, // Part of composite PK? 
      comment: '회원idx'
    },
    mlt_lat: {
      type: DataTypes.DECIMAL(16, 14),
      allowNull: true,
      comment: '위도'
    },
    mlt_long: {
      type: DataTypes.DECIMAL(17, 14),
      allowNull: true,
      comment: '경도'
    },
    mlt_accuacy: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: '위치값(수평 정확도)'
    },
    mlt_speed: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: '속도(m/s)'
    },
    mlt_battery: {
      type: DataTypes.TINYINT,
      allowNull: true,
      comment: '배터리'
    },
    mlt_fine_location: {
      type: DataTypes.ENUM('Y', 'N'),
      allowNull: true,
      defaultValue: 'Y',
      comment: '위치정확도'
    },
    mlt_location_chk: {
      type: DataTypes.ENUM('Y', 'N'),
      allowNull: true,
      defaultValue: 'Y',
      comment: '위치정보허용여부'
    },
    mt_health_work: {
      type: DataTypes.SMALLINT,
      allowNull: true,
      comment: '걸음수'
    },
    mlt_gps_time: {
      type: DataTypes.DATE,
      allowNull: false, // Marked as PRI in CSV
      // primaryKey: true, // Part of composite PK? 
      comment: 'gps 시간'
    },
    mlt_wdate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '등록일시'
    },
    stay_lat: {
      type: DataTypes.DECIMAL(16, 14),
      allowNull: true,
      comment: '체류 중심위도'
    },
    stay_long: {
      type: DataTypes.DECIMAL(17, 14),
      allowNull: true,
      comment: '체류 중심경도'
    }
  }, {
    sequelize,
    modelName: 'MemberLocationLog',
    tableName: 'member_location_log_t',
    timestamps: false // No createdAt/updatedAt in schema
  });
  return MemberLocationLog;
}; 