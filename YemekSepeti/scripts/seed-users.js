/**
 * Test kullanıcılarını veritabanına ekler.
 * Şifre: 123456 (bcrypt ile hashlenir)
 * Çalıştırma: node scripts/seed-users.js (YemekSepeti klasöründen)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { User, Seller, Meal, sequelize } = require('../models');

const TEST_PASSWORD = '123456';

const USERS = [
  { email: 'admin@gmail.com', fullname: 'Admin', role: 'admin' },
  { email: 'enes@gmail.com', fullname: 'Enes', role: 'buyer' },
  { email: 'atomsos@gmail.com', fullname: 'Atom Sos', role: 'seller', shop_name: 'Atom Sos Döner' },
  { email: 'köfteciyusuf@gmail.com', fullname: 'Köfteci Yusuf', role: 'seller', shop_name: 'Köfteci Yusuf' },
  { email: 'burgerpoint@gmail.com', fullname: 'Burger Point', role: 'seller', shop_name: 'Burger Point' },
  { email: 'pideciusta@gmail.com', fullname: 'Pideci Usta', role: 'seller', shop_name: 'Pideci Usta' },
  { email: 'sushiexpress@gmail.com', fullname: 'Sushi Express', role: 'seller', shop_name: 'Sushi Express' },
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

      // Eğer menü boşsa, bu satıcı için örnek yemekler ekle
      const mealCount = await Meal.count({ where: { seller_id: seller.id } });
      if (mealCount === 0) {
        let mealsToCreate = [];
        switch (u.shop_name) {
          case 'Köfteci Yusuf':
            mealsToCreate = [
              { category: 'Izgara', name: 'Izgara Köfte Porsiyon', description: 'Izgara köfte, pilav ve salata ile.', price: 150.00 },
              { category: 'Izgara', name: 'Kasap Sucuk', description: 'Izgara sucuk, patates ve salata.', price: 135.00 },
              { category: 'İçecekler', name: 'Ayran', description: '300 ml ayran.', price: 20.00 }
            ];
            break;
          case 'Atom Sos Döner':
            mealsToCreate = [
              { category: 'Döner', name: 'Atom Soslu Tavuk Döner Dürüm', description: 'Özel atom soslu tavuk döner dürüm.', price: 115.00 },
              { category: 'Döner', name: 'Pilavüstü Et Döner', description: 'Pilav üstü et döner porsiyon.', price: 175.00 },
              { category: 'Atıştırmalık', name: 'Patates Kızartması', description: 'İnce kesim patates kızartması.', price: 45.00 }
            ];
            break;
          case 'Burger Point':
            mealsToCreate = [
              { category: 'Burger', name: 'Cheeseburger Menü', description: 'Cheeseburger, patates ve içecek.', price: 140.00 },
              { category: 'Burger', name: 'Double Burger', description: 'Çift köfteli burger.', price: 165.00 },
              { category: 'Tatlı', name: 'Brownie', description: 'Sıcak çikolatalı brownie.', price: 70.00 }
            ];
            break;
          case 'Pideci Usta':
            mealsToCreate = [
              { category: 'Pide', name: 'Kıymalı Pide', description: 'Bol kıymalı klasik pide.', price: 110.00 },
              { category: 'Pide', name: 'Karışık Pide', description: 'Sucuk, pastırma, kaşar ve kıymalı.', price: 135.00 },
              { category: 'Çorba', name: 'Mercimek Çorbası', description: 'Terbiye ile hazırlanmış mercimek çorbası.', price: 55.00 }
            ];
            break;
          case 'Sushi Express':
            mealsToCreate = [
              { category: 'Roll', name: 'California Roll (8 parça)', description: 'Yengeç, avokado, salatalık.', price: 180.00 },
              { category: 'Roll', name: 'Philadelphia Roll (8 parça)', description: 'Somon, krem peynir, avokado.', price: 195.00 },
              { category: 'Set Menü', name: 'Karışık Sushi Tabak', description: 'Farklı roll ve nigiri çeşitlerinden oluşan tabak.', price: 260.00 }
            ];
            break;
          default:
            mealsToCreate = [
              { category: 'Ana Yemekler', name: 'Günün Yemeği', description: 'Şefin seçimi günlük yemek.', price: 120.00 }
            ];
        }

        if (mealsToCreate.length > 0) {
          await Meal.bulkCreate(
            mealsToCreate.map(m => ({
              seller_id: seller.id,
              category: m.category,
              name: m.name,
              description: m.description,
              price: m.price,
              is_available: true,
              stock_quantity: -1
            }))
          );
          console.log(`   └─ Menü oluşturuldu (${mealsToCreate.length} yemek): ${u.shop_name}`);
        }
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
