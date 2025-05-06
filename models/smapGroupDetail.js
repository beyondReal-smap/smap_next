'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SmapGroupDetail extends Model {
    static associate(models) {
      // define association here if needed
      // this.belongsTo(models.SmapGroup, { foreignKey: 'sgt_idx', targetKey: 'sgt_idx' });
      // this.belongsTo(models.Member, { foreignKey: 'mt_idx', targetKey: 'mt_idx' });
    }
  }
  SmapGroupDetail.init({
    sgdt_idx: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    sgt_idx: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '그룹idx'
    },
    mt_idx: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '회원idx'
    },
    sgdt_owner_chk: {
      type: DataTypes.ENUM('Y', 'N'),
      allowNull: true,
      defaultValue: 'N',
      comment: '오너여부'
    },
    sgdt_leader_chk: {
      type: DataTypes.ENUM('Y', 'N'),
      allowNull: true,
      defaultValue: 'N',
      comment: '리더여부'
    },
    sgdt_discharge: {
      type: DataTypes.ENUM('Y', 'N'),
      allowNull: true,
      defaultValue: 'N',
      comment: '방출 여부'
    },
    sgdt_group_chk: {
      type: DataTypes.ENUM('Y', 'N', 'D'),
      allowNull: true,
      defaultValue: 'D',
      comment: '그룹활동기한 설정 여부'
    },
    sgdt_exit: {
      type: DataTypes.ENUM('Y', 'N'),
      allowNull: true,
      defaultValue: 'N',
      comment: '나가기여부'
    },
    sgdt_show: {
      type: DataTypes.ENUM('Y', 'N'),
      allowNull: true,
      defaultValue: 'Y',
      comment: '노출여부 삭제하면 N'
    },
    sgdt_push_chk: {
      type: DataTypes.ENUM('Y', 'N'),
      allowNull: true,
      defaultValue: 'Y',
      comment: '그룹 알림 받기여부 N이면 안받음'
    },
    sgdt_wdate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '등록일시'
    },
    sgdt_udate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '수정일시'
    },
    sgdt_ddate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '방출일시'
    },
    sgdt_xdate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '나가기 일시'
    },
    sgdt_adate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '그룹활동기한 일시'
    }
  }, {
    sequelize,
    modelName: 'SmapGroupDetail',
    tableName: 'smap_group_detail_t',
    timestamps: false
  });
  return SmapGroupDetail;
}; 