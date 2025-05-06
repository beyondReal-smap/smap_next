'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('member_t', [
      {
        mt_type: 1,
        mt_level: 2,
        mt_id: 'testuser1@example.com',
        mt_pwd: 'hashed_password', // 실제로는 해시된 비밀번호를 사용해야 합니다.
        mt_name: '테스트 사용자1',
        mt_nickname: '테스터1',
        mt_hp: '010-1111-1111',
        mt_email: 'testuser1@example.com',
        mt_birth: '1995-01-15',
        mt_gender: 1,
        mt_show: 'Y',
        mt_wdate: new Date(),
        mt_ldate: new Date()
      },
      {
        mt_type: 2,
        mt_level: 5,
        mt_id: 'kakao_12345',
        mt_name: '카카오 사용자',
        mt_nickname: '카카오테스터',
        mt_hp: '010-2222-2222',
        mt_email: 'kakao@example.com',
        mt_plan_date: new Date(new Date().setDate(new Date().getDate() + 30)), // 30일 후 만료되는 플랜
        mt_plan_check: 'Y',
        mt_gender: 2,
        mt_show: 'Y',
        mt_wdate: new Date(),
        mt_ldate: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('member_t', null, {});
  }
};
