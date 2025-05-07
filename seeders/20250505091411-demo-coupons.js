'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('coupon_t', [
      {
        ct_title: '신규가입 환영 쿠폰',
        ct_subtitle: '가입 즉시 7일 무료 체험',
        ct_code: 'WELCOME2025',
        ct_type1: 2, // 발급일 기준
        ct_days: 7,
        ct_use: 'Y',
        ct_show: 'Y',
        ct_wdate: new Date()
      },
      {
        ct_title: '가정의 달 특별 할인',
        ct_subtitle: '5월 한정 10% 할인',
        ct_code: 'FAMILYMAY',
        ct_type1: 1, // 기간
        ct_sdate: '2025-05-01',
        ct_edate: '2025-05-31',
        ct_use: 'Y',
        ct_show: 'Y',
        ct_wdate: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('coupon_t', null, {});
  }
};
