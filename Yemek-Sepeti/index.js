// index.js

const express = require('express');
const path = require('path');
const cors = require('cors'); // Frontend ve Backend aynı portta çalışmayacağı için gerekli

// Veritabanı bağlantısını import et (Bağlantı kontrolü için)
const db = require('./config/db');

// Uygulama ayarları
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware'ler
app.use(cors()); // Tüm gelen isteklere izin ver (Geliştirme için)
app.use(express.json()); // JSON formatındaki isteği gövdesini (body) okumak için

// 1. STATIC DOSYALARI SUNMA (Frontend Dosyaları)
// Tarayıcıdaki /assets, /components, /pages istekleri ilgili klasörlere yönlendirilir
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/components', express.static(path.join(__dirname, 'components')));
app.use('/pages', express.static(path.join(__dirname, 'pages')));

// 2. ANA SAYFA ROTASI
// index.html dosyasını tarayıcıya gönderir
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 3. API ROTLARINI KULLANMA
// auth.js dosyasındaki tüm rotalar /api/v1/auth altında çalışacak
// const authRoutes = require('./routes/auth');
// app.use('/api/v1/auth', authRoutes);


// Server'ı Başlat
app.listen(PORT, () => {
  console.log(`🚀 Sunucu http://localhost:${PORT} adresinde çalışıyor...`);
});