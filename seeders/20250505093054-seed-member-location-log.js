'use strict';

// Helper functions
const parseDateOrNull = (dateString) => {
  if (!dateString || dateString.trim() === '') return null;
  // Handle potential extra quotes from CSV
  const cleanDateString = dateString.replace(/^"|"$/g, '');
  const date = new Date(cleanDateString);
  return isNaN(date.getTime()) ? null : date;
};
const parseFloatOrNull = (numString) => {
    if (numString === null || numString === undefined || numString === '') return null;
    const cleanNumString = String(numString).replace(/^"|"$/g, '');
    if (cleanNumString.trim() === '') return null;
    const num = parseFloat(cleanNumString);
    return isNaN(num) ? null : num;
};
const parseIntOrNull = (numString) => {
    if (numString === null || numString === undefined || numString === '') return null;
    const cleanNumString = String(numString).replace(/^"|"$/g, '');
     if (cleanNumString.trim() === '') return null;
    const num = parseInt(cleanNumString, 10);
    return isNaN(num) ? null : num;
};
const parseDecimalOrNull = (numString) => {
    if (numString === null || numString === undefined || numString === '') return null;
    const cleanNumString = String(numString).replace(/^"|"$/g, '');
    if (cleanNumString.trim() === '') return null;
    // Basic validation for decimal format
    if (isNaN(parseFloat(cleanNumString))) return null;
    return cleanNumString;
};
const parseEnumOrNull = (enumString) => {
    if (!enumString || typeof enumString !== 'string') return null;
    const cleanEnumString = enumString.replace(/^"|"$/g, '').trim();
    return cleanEnumString === 'Y' || cleanEnumString === 'N' ? cleanEnumString : null;
};


/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Data parsed from member_location_log_t.csv
    await queryInterface.bulkInsert('member_location_log_t', [
      {
        mlt_idx: 112939708,
        mt_idx: 1186,
        mlt_lat: parseDecimalOrNull("37.51866000000000"),
        mlt_long: parseDecimalOrNull("126.88499000000000"),
        mlt_accuacy: parseFloatOrNull("5.000000"),
        mlt_speed: parseFloatOrNull("0.000000"),
        mlt_battery: parseIntOrNull("91"),
        mlt_fine_location: parseEnumOrNull("Y"),
        mlt_location_chk: parseEnumOrNull("Y"),
        mt_health_work: parseIntOrNull(""), // Empty in CSV
        mlt_gps_time: parseDateOrNull("2025-05-05 18:18:48.000"),
        mlt_wdate: parseDateOrNull("2025-05-05 18:18:51.000"),
        stay_lat: parseDecimalOrNull("37.51866000000000"),
        stay_long: parseDecimalOrNull("126.88499000000000")
      },
      {
        mlt_idx: 112940354,
        mt_idx: 282,
        mlt_lat: parseDecimalOrNull("37.34021000000000"),
        mlt_long: parseDecimalOrNull("126.93486000000000"),
        mlt_accuacy: parseFloatOrNull("19.708000"),
        mlt_speed: parseFloatOrNull("0.000000"),
        mlt_battery: parseIntOrNull("98"),
        mlt_fine_location: parseEnumOrNull("Y"),
        mlt_location_chk: parseEnumOrNull("Y"),
        mt_health_work: parseIntOrNull(""),
        mlt_gps_time: parseDateOrNull("2025-05-05 18:19:34.000"),
        mlt_wdate: parseDateOrNull("2025-05-05 18:19:37.000"),
        stay_lat: parseDecimalOrNull("37.34021000000000"),
        stay_long: parseDecimalOrNull("126.93486000000000")
      },
      {
        mlt_idx: 112940482,
        mt_idx: 1194,
        mlt_lat: parseDecimalOrNull("37.52893000000000"),
        mlt_long: parseDecimalOrNull("126.96566000000000"),
        mlt_accuacy: parseFloatOrNull("17.989000"),
        mlt_speed: parseFloatOrNull("0.000000"),
        mlt_battery: parseIntOrNull("83"),
        mlt_fine_location: parseEnumOrNull("Y"),
        mlt_location_chk: parseEnumOrNull("Y"),
        mt_health_work: parseIntOrNull(""),
        mlt_gps_time: parseDateOrNull("2025-05-05 18:19:49.000"),
        mlt_wdate: parseDateOrNull("2025-05-05 18:19:52.000"),
        stay_lat: parseDecimalOrNull("37.52893000000000"),
        stay_long: parseDecimalOrNull("126.96566000000000")
      },
      {
        mlt_idx: 112941000,
        mt_idx: 1200,
        mlt_lat: parseDecimalOrNull("37.56668050000000"),
        mlt_long: parseDecimalOrNull("126.97841470000000"),
        mlt_accuacy: parseFloatOrNull("20.000000"),
        mlt_speed: parseFloatOrNull("0.000000"),
        mlt_battery: parseIntOrNull("89"),
        mlt_fine_location: parseEnumOrNull("Y"),
        mlt_location_chk: parseEnumOrNull("Y"),
        mt_health_work: parseIntOrNull(""),
        mlt_gps_time: parseDateOrNull("2025-05-05 18:20:09.000"),
        mlt_wdate: parseDateOrNull("2025-05-05 18:20:10.000"),
        stay_lat: parseDecimalOrNull("37.56668050000000"),
        stay_long: parseDecimalOrNull("126.97841470000000")
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
     // Delete only the specific records inserted by this seeder
     await queryInterface.bulkDelete('member_location_log_t', { mlt_idx: [112939708, 112940354, 112940482, 112941000] }, {});
  }
};
