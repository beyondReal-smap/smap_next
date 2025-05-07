'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SmapSchedule extends Model {
    static associate(models) {
      // define association here if needed
      // this.belongsTo(models.Member, { foreignKey: 'mt_idx', targetKey: 'mt_idx' });
      // this.belongsTo(models.SmapGroup, { foreignKey: 'sgt_idx', targetKey: 'sgt_idx' });
      // this.belongsTo(models.SmapGroupDetail, { foreignKey: 'sgdt_idx', targetKey: 'sgdt_idx' });
      // this.belongsTo(models.SmapLocation, { foreignKey: 'slt_idx', targetKey: 'slt_idx' });
    }
  }
  SmapSchedule.init({
    sst_idx: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    sst_pidx: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '기준 idx'
    },
    mt_idx: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '회원idx'
    },
    sst_title: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '일정내용'
    },
    sst_sdate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '시작일시'
    },
    sst_edate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '마감일시'
    },
    sst_sedate: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '시작마감일시'
    },
    sst_all_day: {
      type: DataTypes.ENUM('Y', 'N'),
      allowNull: true,
      defaultValue: 'Y',
      comment: '하루종일 체크 Y:하루종일'
    },
    sst_repeat_json: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: '반복 json'
    },
    sst_repeat_json_v: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: '반복'
    },
    sgt_idx: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '그룹idx'
    },
    sgdt_idx: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '그룹원중 1명 선택된 그룹상세idx'
    },
    sgdt_idx_t: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '그룹원상세'
    },
    sst_alram: {
      type: DataTypes.TINYINT,
      allowNull: true,
      comment: '알림 1:시작전, 2:10분전, 3:1시간전, 4:1일전'
    },
    sst_alram_t: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '알림'
    },
    sst_adate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '알림일시'
    },
    slt_idx: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '위치idx'
    },
    slt_idx_t: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '위치'
    },
    sst_location_title: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: '위치명'
    },
    sst_location_add: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '위치 주소(도로명)'
    },
    sst_location_lat: {
      type: DataTypes.DECIMAL(16, 14),
      allowNull: true,
      comment: '위치 gps lat 위도'
    },
    sst_location_long: {
      type: DataTypes.DECIMAL(17, 14),
      allowNull: true,
      comment: '위치 gps long 경도'
    },
    sst_supplies: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: '준비물 100자'
    },
    sst_memo: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '메모 500자'
    },
    sst_show: {
      type: DataTypes.ENUM('Y', 'N'),
      allowNull: true,
      defaultValue: 'Y',
      comment: '노출여부 삭제시 N'
    },
    sst_location_alarm: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 4,
      comment: '위치알림 1:진입알림 2:이탈알림 3:위치알림 안함 4:둘다체크'
    },
    sst_schedule_alarm_chk: {
      type: DataTypes.ENUM('Y', 'N'),
      allowNull: true,
      defaultValue: 'Y',
      comment: '일정알림 여부 체크 Y:일정알림 N:알림X'
    },
    sst_pick_type: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: '일정알림 타입(minute,hour,day)'
    },
    sst_pick_result: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '일정알림 결과'
    },
    sst_schedule_alarm: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '일정알림시간'
    },
    sst_update_chk: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: '수정권한 1:오너 2:리더 3:그룹원'
    },
    sst_wdate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '등록일시'
    },
    sst_udate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '수정일시'
    },
    sst_ddate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '삭제일시'
    },
    sst_in_chk: {
      type: DataTypes.ENUM('Y', 'N'),
      allowNull: true,
      defaultValue: 'N',
      comment: '진입 여부(Y:진입 N:이탈)'
    },
    sst_schedule_chk: {
      type: DataTypes.ENUM('Y', 'N'),
      allowNull: true,
      defaultValue: 'N',
      comment: '스케줄 알림 체크여부 (Y: 알림 전송, N 알림 미전송)'
    },
    sst_entry_cnt: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: '진입발송카운트'
    },
    sst_exit_cnt: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: '이탈발송카운트'
    }
  }, {
    sequelize,
    modelName: 'SmapSchedule',
    tableName: 'smap_schedule_t',
    timestamps: false
  });
  return SmapSchedule;
}; 