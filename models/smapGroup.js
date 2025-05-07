'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SmapGroup extends Model {
    static associate(models) {
      // define association here if needed
      // this.belongsTo(models.Member, { foreignKey: 'mt_idx', targetKey: 'mt_idx' });
      // this.hasMany(models.SmapGroupDetail, { foreignKey: 'sgt_idx', sourceKey: 'sgt_idx' });
    }
  }
  SmapGroup.init({
    sgt_idx: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    mt_idx: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '오너 회원idx'
    },
    sgt_title: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: '그룹명'
    },
    sgt_code: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: '그룹초대코드'
    },
    sgt_show: {
      type: DataTypes.ENUM('Y', 'N'),
      allowNull: true,
      defaultValue: 'Y',
      comment: '그룹노출여부 삭제시 N'
    },
    sgt_wdate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '그룹등록일시'
    },
    sgt_udate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '그룹수정일시'
    }
  }, {
    sequelize,
    modelName: 'SmapGroup',
    tableName: 'smap_group_t',
    timestamps: false
  });
  return SmapGroup;
}; 