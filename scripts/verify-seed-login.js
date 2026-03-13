/**
 * Seed kullanıcılarıyla giriş testi (şifre: 123456)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { User, Seller, sequelize } = require('../models');

const TEST_PASSWORD = '123456';
const EMAILS = [
  'admin@gmail.com',
  'enes@gmail.com',
  'atomsos@gmail.com',
  'köfteciyusuf@gmail.com',
  'burgerpoint@gmail.com',
  'pideciusta@gmail.com',
  'sushiexpress@gmail.com',
  'kurye@gmail.com'
];

async function verify() {
  await sequelize.authenticate();
  console.log('Giriş testi (şifre: 123456)\n');

  for (const email of EMAILS) {
    const user = await User.findOne({ where: { email }, include: [{ model: Seller, as: 'seller', required: false }] });
    if (!user) {
      console.log(`❌ ${email} - Kullanıcı bulunamadı`);
      continue;
    }
    const ok = await bcrypt.compare(TEST_PASSWORD, user.password);
    const shop = user.seller ? user.seller.shop_name : '-';
    console.log(ok ? `✅ ${email} (${user.role}) ${shop !== '-' ? '| Dükkan: ' + shop : ''}` : `❌ ${email} - Şifre yanlış`);
  }

  await sequelize.close();
  process.exit(0);
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});
