'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SmapLocation extends Model {
    static associate(models) {
      // define association here if needed
      // this.belongsTo(models.Member, { foreignKey: 'mt_idx', targetKey: 'mt_idx' });
      // this.belongsTo(models.SmapGroup, { foreignKey: 'sgt_idx', targetKey: 'sgt_idx' });
      // this.belongsTo(models.SmapGroupDetail, { foreignKey: 'sgdt_idx', targetKey: 'sgdt_idx' });
    }
  }
  SmapLocation.init({
    slt_idx: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    insert_mt_idx: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '등록 회원 idx'
    },
    mt_idx: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '회원idx'
    },
    sgt_idx: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '그룹idx'
    },
    sgdt_idx: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '그룹상세idx'
    },
    slt_title: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: '위치명'
    },
    slt_add: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '주소'
    },
    slt_lat: {
      type: DataTypes.DECIMAL(16, 14),
      allowNull: true,
      comment: 'gps lat'
    },
    slt_long: {
      type: DataTypes.DECIMAL(17, 14),
      allowNull: true,
      comment: 'gps long'
    },
    slt_show: {
      type: DataTypes.ENUM('Y', 'N'),
      allowNull: true,
      defaultValue: 'Y',
      comment: '노출여부 삭제시 N'
    },
    slt_enter_chk: {
      type: DataTypes.ENUM('Y', 'N'),
      allowNull: true,
      defaultValue: 'N',
      comment: '진입여부'
    },
    slt_enter_alarm: {
        type: DataTypes.ENUM('Y', 'N'),
        allowNull: true,
        defaultValue: 'Y',
        comment: '진입알람체크 Y:알람 N:알람안옴'
    },
    slt_wdate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '등록일시'
    },
    slt_udate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '수정일시'
    },
    slt_ddate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '삭제일시'
    }
  }, {
    sequelize,
    modelName: 'SmapLocation',
    tableName: 'smap_location_t',
    timestamps: false
  });
  return SmapLocation;
}; 