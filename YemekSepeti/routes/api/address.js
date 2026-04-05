const express = require('express');
const router = express.Router();
const { getCities, getDistricts } = require('../../data/turkey-addresses');

// GET /api/address/cities — Tüm illeri döndür
router.get('/cities', (req, res) => {
    try {
        const cities = getCities();
        res.json({ success: true, cities });
    } catch (error) {
        console.error('Cities endpoint hatası:', error);
        res.status(500).json({ success: false, message: 'İller yüklenemedi.' });
    }
});

// GET /api/address/districts/:city — Belirli ilin ilçelerini döndür
router.get('/districts/:city', (req, res) => {
    try {
        const city = decodeURIComponent(req.params.city);
        const districts = getDistricts(city);
        if (districts.length === 0) {
            return res.status(404).json({ success: false, message: 'İl bulunamadı.' });
        }
        res.json({ success: true, city, districts });
    } catch (error) {
        console.error('Districts endpoint hatası:', error);
        res.status(500).json({ success: false, message: 'İlçeler yüklenemedi.' });
    }
});

module.exports = router;
