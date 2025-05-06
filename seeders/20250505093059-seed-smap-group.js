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
    await queryInterface.bulkInsert('smap_group_t', [
      {
        sgt_idx: 641,
        mt_idx: 1186,
        sgt_title: 'family',
        sgt_code: 'G84A24',
        sgt_show: 'Y',
        sgt_wdate: parseDateOrNull('2024-10-11 17:42:17.000'),
        sgt_udate: null // CSV has empty
      }
      // Add more group data if available in the CSV
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('smap_group_t', { sgt_idx: [641] }, {});
  }
};
