/**
 * Add PIC names (batch March 2026).
 */
const NEW_PICS = [
  'Rismawati',
  'Chica Melani Azizah',
  'Restira Nadra',
  'Aprizal',
  'Dita Santiara',
  'Eka Pratiwi',
  'Ahmad Dira Saputra',
  'Imam Priyadi',
  'Revania Ai Zhafirah',
  'Siti Selvi Nurviani',
  'Bayu Permana',
  'Aulya Sesilia Febryanti Hutapea',
  'Elsa Sulaeman',
  'Sri Wulandari',
  'Sulistiawati',
  'Galih Fahrul Roji',
  'Fauziatu Rahmah',
  'Farras Nur Aulia',
  'Revly Mutiara Cantik',
  'Agi Cahyadi',
  'Rahmat Saputra',
  'Ika Purnama',
  'Agung Setya Budi',
  'Rudi Irma',
  'Arbela',
  'Muhamad Mashur',
  'Desi Antika',
  'Devi Amelia',
  'Ferdi',
];

module.exports = {
  async up(client) {
    for (const name of NEW_PICS) {
      await client.query(
        'INSERT INTO pic_list (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [name]
      );
    }
  },
};
