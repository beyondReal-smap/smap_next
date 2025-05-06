'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Member extends Model {
    static associate(models) {
      // define association here
    }
  }
  Member.init({
    mt_idx: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    mt_type: DataTypes.TINYINT,
    mt_level: DataTypes.TINYINT,
    mt_plan_date: DataTypes.DATE,
    mt_plan_check: {
      type: DataTypes.ENUM('Y', 'N'),
      defaultValue: 'N'
    },
    mt_id: {
      type: DataTypes.STRING(200),
      allowNull: true // Assuming it can be null based on schema
    },
    mt_pwd: DataTypes.STRING(200),
    mt_token_id: DataTypes.STRING(255),
    mt_name: DataTypes.STRING(50),
    mt_nickname: DataTypes.STRING(50),
    mt_hp: DataTypes.STRING(20),
    mt_email: DataTypes.STRING(200),
    mt_birth: DataTypes.DATEONLY,
    mt_gender: DataTypes.TINYINT,
    mt_show: {
        type: DataTypes.ENUM('Y', 'N'),
        defaultValue: 'Y'
    },
    mt_wdate: DataTypes.DATE,
    mt_ldate: DataTypes.DATE,
    mt_udate: DataTypes.DATE
    // Add other fields from db_info.csv as needed
  }, {
    sequelize,
    modelName: 'Member',
    tableName: 'member_t', // Explicitly set table name
    timestamps: false // Disable createdAt/updatedAt if not present in schema
  });
  return Member;
}; 