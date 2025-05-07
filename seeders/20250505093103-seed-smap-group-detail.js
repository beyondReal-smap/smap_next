'use strict';

// Helper function to safely parse dates or return null
const parseDateOrNull = (dateString) => {
  if (!dateString || dateString.trim() === '') return null;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('smap_group_detail_t', [
      {
        sgdt_idx: 983,
        sgt_idx: 641,
        mt_idx: 1186,
        sgdt_owner_chk: 'Y',
        sgdt_leader_chk: 'N',
        sgdt_discharge: 'N',
        sgdt_group_chk: 'D',
        sgdt_exit: 'N',
        sgdt_show: 'Y',
        sgdt_push_chk: 'Y',
        sgdt_wdate: parseDateOrNull('2024-10-11 17:42:17.000'),
        sgdt_udate: null,
        sgdt_ddate: null,
        sgdt_xdate: null,
        sgdt_adate: null
      },
      {
        sgdt_idx: 990,
        sgt_idx: 641,
        mt_idx: 1194,
        sgdt_owner_chk: 'N',
        sgdt_leader_chk: 'Y',
        sgdt_discharge: 'N',
        sgdt_group_chk: 'Y',
        sgdt_exit: 'N',
        sgdt_show: 'Y',
        sgdt_push_chk: 'Y',
        sgdt_wdate: parseDateOrNull('2024-10-12 00:51:05.000'),
        sgdt_udate: parseDateOrNull('2024-10-23 17:14:34.000'),
        sgdt_ddate: null,
        sgdt_xdate: null,
        sgdt_adate: parseDateOrNull('2024-10-24 09:00:00.000')
      },
      {
        sgdt_idx: 991,
        sgt_idx: 641,
        mt_idx: 282,
        sgdt_owner_chk: 'N',
        sgdt_leader_chk: 'N',
        sgdt_discharge: 'N',
        sgdt_group_chk: 'Y',
        sgdt_exit: 'N',
        sgdt_show: 'Y',
        sgdt_push_chk: 'Y',
        sgdt_wdate: parseDateOrNull('2024-10-12 01:08:11.000'),
        sgdt_udate: parseDateOrNull('2024-10-23 16:25:58.000'),
        sgdt_ddate: null,
        sgdt_xdate: null,
        sgdt_adate: null
      },
      {
        sgdt_idx: 995,
        sgt_idx: 641,
        mt_idx: 1200,
        sgdt_owner_chk: 'N',
        sgdt_leader_chk: 'N',
        sgdt_discharge: 'N',
        sgdt_group_chk: 'Y',
        sgdt_exit: 'N',
        sgdt_show: 'Y',
        sgdt_push_chk: 'Y',
        sgdt_wdate: parseDateOrNull('2024-10-12 20:34:54.000'),
        sgdt_udate: parseDateOrNull('2024-10-12 20:35:03.000'),
        sgdt_ddate: null,
        sgdt_xdate: null,
        sgdt_adate: null
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('smap_group_detail_t', { sgdt_idx: [983, 990, 991, 995] }, {});
  }
};
