/**
 * Test kullanıcılarını veritabanına ekler.
 * Şifre: 123456 (bcrypt ile hashlenir)
 * Çalıştırma: node scripts/seed-users.js (YemekSepeti klasöründen)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { User, Seller, sequelize } = require('../models');

const TEST_PASSWORD = '123456';

const USERS = [
  { email: 'admin@gmail.com', fullname: 'Admin', role: 'admin' },
  { email: 'enes@gmail.com', fullname: 'Enes', role: 'buyer' },
  { email: 'atomsos@gmail.com', fullname: 'Atom Sos', role: 'seller', shop_name: 'Atom Sos Döner' },
  { email: 'köfteciyusuf@gmail.com', fullname: 'Köfteci Yusuf', role: 'seller', shop_name: 'Köfteci Yusuf' },
  { email: 'kurye@gmail.com', fullname: 'Kurye', role: 'courier' }
];

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('✅ Veritabanı bağlantısı başarılı.');
  } catch (err) {
    console.error('❌ Veritabanı bağlantı hatası:', err.message);
    process.exit(1);
  }

  const hashedPassword = await hashPassword(TEST_PASSWORD);
  console.log('🔐 Şifre hash\'lendi (123456).');

  for (const u of USERS) {
    const [user, created] = await User.findOrCreate({
      where: { email: u.email },
      defaults: {
        email: u.email,
        password: hashedPassword,
        fullname: u.fullname,
        role: u.role,
        email_verified: true,
        is_active: true
      }
    });

    if (created) {
      console.log(`✅ Kullanıcı oluşturuldu: ${u.email} (${u.role})`);
    } else {
      await user.update({
        password: hashedPassword,
        fullname: u.fullname,
        role: u.role,
        email_verified: true,
        is_active: true
      });
      console.log(`🔄 Kullanıcı güncellendi: ${u.email} (${u.role})`);
    }

    if (u.role === 'seller' && u.shop_name) {
      const [seller, sellerCreated] = await Seller.findOrCreate({
        where: { user_id: user.id },
        defaults: {
          user_id: user.id,
          shop_name: u.shop_name,
          location: 'İstanbul',
          is_active: true
        }
      });
      if (sellerCreated) {
        console.log(`   └─ Dükkan: ${u.shop_name}`);
      }
    }
  }

  console.log('\n✅ Tüm test kullanıcıları hazır. Şifre: 123456');
  await sequelize.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed hatası:', err);
  process.exit(1);
});
