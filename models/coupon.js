'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Coupon extends Model {
    static associate(models) {
      // define association here if needed
    }
  }
  Coupon.init({
    ct_idx: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    ct_title: DataTypes.STRING(255),
    ct_subtitle: DataTypes.STRING(255),
    ct_code: {
      type: DataTypes.STRING(50),
      unique: true // Assuming coupon codes should be unique
    },
    ct_type1: {
        type: DataTypes.TINYINT,
        defaultValue: 1,
        comment: '1:기간, 2:발급일기준'
    },
    ct_sdate: DataTypes.DATEONLY,
    ct_edate: DataTypes.DATEONLY,
    ct_days: DataTypes.TINYINT,
    ct_use: {
        type: DataTypes.ENUM('Y', 'N'),
        defaultValue: 'Y'
    },
    ct_show: {
        type: DataTypes.ENUM('Y', 'N'),
        defaultValue: 'Y'
    },
    ct_wdate: DataTypes.DATE,
    ct_udate: DataTypes.DATE,
    ct_member: DataTypes.STRING(50)
    // Add other fields from db_info.csv for coupon_t as needed
  }, {
    sequelize,
    modelName: 'Coupon',
    tableName: 'coupon_t', 
    timestamps: false // Disable createdAt/updatedAt if not present in schema
  });
  return Coupon;
}; 