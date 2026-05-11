const express = require('express');
const router = express.Router();
const { getCities, getDistricts } = require('../../data/turkey-addresses');
const { nearestCityFromLatLng, getCityCoordinates } = require('../../data/turkey-coordinates');

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function defaultDistrictForIl(ilKey) {
    const districts = getDistricts(ilKey);
    if (!districts.length) return null;
    return districts.find((d) => /merkez/i.test(d)) || districts[0];
}

/** DB / kullanıcı girişinde büyük-küçük harf farkı için kanonik il adı */
function resolveCanonicalCity(ilRaw) {
    const il = typeof ilRaw === 'string' ? ilRaw.trim() : '';
    if (!il) return null;
    const cities = getCities();
    for (const c of cities) {
        if (c === il) return c;
    }
    const lower = il.toLocaleLowerCase('tr-TR');
    for (const c of cities) {
        if (c.toLocaleLowerCase('tr-TR') === lower) return c;
    }
    return null;
}

/**
 * Kayıtlı adreslerdeki ilçe metni (birleşik, eski ad, yanlış alan vb.) ile liste eşlemesi.
 */
function resolveCanonicalDistrict(ilKey, ilceRaw) {
    const ilce = typeof ilceRaw === 'string' ? ilceRaw.trim() : '';
    if (!ilce || !ilKey) return null;
    const districts = getDistricts(ilKey);
    if (districts.length === 0) return null;

    if (districts.includes(ilce)) return ilce;

    let found = districts.find((d) => d.toLocaleLowerCase('tr-TR') === ilce.toLocaleLowerCase('tr-TR'));
    if (found) return found;

    if (/merkez/i.test(ilce) && districts.includes('Merkez')) return 'Merkez';

    const parts = ilce.split(/[/,|–\-]/).map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
        if (districts.includes(part)) return part;
        found = districts.find((d) => d.toLocaleLowerCase('tr-TR') === part.toLocaleLowerCase('tr-TR'));
        if (found) return found;
    }

    const stripped = ilce.replace(new RegExp('^' + escapeRegex(ilKey) + '\\s*', 'i'), '').trim();
    if (stripped && stripped !== ilce) {
        if (districts.includes(stripped)) return stripped;
        found = districts.find((d) => d.toLocaleLowerCase('tr-TR') === stripped.toLocaleLowerCase('tr-TR'));
        if (found) return found;
    }

    const ilceLower = ilce.toLocaleLowerCase('tr-TR');
    const sorted = [...districts].sort((a, b) => b.length - a.length);
    for (const d of sorted) {
        if (ilceLower.includes(d.toLocaleLowerCase('tr-TR'))) return d;
    }

    return null;
}

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

// GET /api/address/near-city?lat=&lng= — GPS'e en yakın il + önerilen ilçe
router.get('/near-city', async (req, res) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lng = parseFloat(req.query.lng);
        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            return res.status(400).json({ success: false, message: 'Geçersiz koordinat.' });
        }

        let addressData = {
            il: null,
            ilce: null,
            mahalle: '',
            cadde: ''
        };

        // 1. Gerçek Reverse Geocoding Dene (Nominatim) - İnternet gerektirir
        try {
            const osmUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=tr`;
            const osmRes = await fetch(osmUrl, {
                headers: {
                    'User-Agent': 'YemekSepetiClone/1.0 (contact: evlezzetleri.site@gmail.com)'
                }
            });
            if (osmRes.ok) {
                const osmData = await osmRes.json();
                if (osmData && osmData.address) {
                    const addr = osmData.address;
                    // OSM'den gelen verileri ayıkla
                    const rawIl = addr.province || addr.state || '';
                    const rawIlce = addr.town || addr.city_district || addr.county || addr.district || '';
                    
                    const canonicalIl = resolveCanonicalCity(rawIl);
                    if (canonicalIl) {
                        addressData.il = canonicalIl;
                        addressData.ilce = resolveCanonicalDistrict(canonicalIl, rawIlce) || defaultDistrictForIl(canonicalIl) || 'Merkez';
                        addressData.mahalle = addr.suburb || addr.neighbourhood || addr.village || addr.hamlet || '';
                        addressData.cadde = addr.road || '';
                    }
                }
            }
        } catch (err) {
            console.error('OSM Reverse Geocode hatası:', err);
        }

        // 2. Fallback: Eğer Nominatim sonucu gelmediyse (çevrimdışı vb.) eski "en yakın şehir merkezi" mantığına dön
        if (!addressData.il) {
            const near = nearestCityFromLatLng(lat, lng);
            if (near && near.il) {
                addressData.il = near.il;
                const districts = getDistricts(near.il);
                addressData.ilce =
                    (districts || []).find((d) => /merkez/i.test(d)) ||
                    (districts && districts.length ? districts[0] : null) ||
                    'Merkez';
            }
        }

        if (!addressData.il) {
            return res.status(500).json({ success: false, message: 'İl bulunamadı.' });
        }

        return res.json({
            success: true,
            ...addressData,
            lat,
            lng
        });
    } catch (error) {
        console.error('near-city hatası:', error);
        return res.status(500).json({ success: false, message: 'Konum çözümlenemedi.' });
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

// POST /api/address/delivery-context — Teslimat il/ilçe/mahalle/cadde (oturuma yazar; sipariş doğruluğu için)
router.post('/delivery-context', (req, res) => {
    try {
        const il = typeof req.body.il === 'string' ? req.body.il.trim() : '';
        const ilce = typeof req.body.ilce === 'string' ? req.body.ilce.trim() : '';
        const mahalle = typeof req.body.mahalle === 'string' ? req.body.mahalle.trim() : '';
        const cadde = typeof req.body.cadde === 'string' ? req.body.cadde.trim() : '';
        if (!il || !ilce || !mahalle || !cadde) {
            return res.status(400).json({
                success: false,
                message: 'İl, ilçe, mahalle ve cadde alanları zorunludur.'
            });
        }
        let lat = req.body.lat != null && req.body.lat !== '' ? parseFloat(req.body.lat) : null;
        let lng = req.body.lng != null && req.body.lng !== '' ? parseFloat(req.body.lng) : null;
        if (lat !== null && Number.isNaN(lat)) lat = null;
        if (lng !== null && Number.isNaN(lng)) lng = null;
        const hasGps = lat != null && lng != null;

        let ilKey = resolveCanonicalCity(il);
        if (!ilKey && ilce) {
            ilKey = resolveCanonicalCity(ilce);
        }
        if (!ilKey && hasGps) {
            const near = nearestCityFromLatLng(lat, lng);
            if (near && near.il) ilKey = near.il;
        }

        let ilceKey = ilKey ? resolveCanonicalDistrict(ilKey, ilce) : null;
        if (ilKey && !ilceKey && il) {
            ilceKey = resolveCanonicalDistrict(ilKey, il);
        }
        if (ilKey && !ilceKey && hasGps) {
            const near = nearestCityFromLatLng(lat, lng);
            if (near && near.il === ilKey) {
                ilceKey = defaultDistrictForIl(ilKey);
            }
        }

        if (!ilKey || !ilceKey) {
            return res.status(400).json({
                success: false,
                message: 'Seçilen il ve ilçe eşleşmiyor.'
            });
        }
        if ((lat == null || lng == null) && ilKey) {
            const cc = getCityCoordinates(ilKey);
            if (cc && cc.lat != null && cc.lng != null) {
                lat = cc.lat;
                lng = cc.lng;
            }
        }
        req.session.deliveryArea = {
            il: ilKey,
            ilce: ilceKey,
            mahalle,
            cadde,
            ...(lat != null && lng != null ? { lat, lng } : {}),
            updatedAt: Date.now()
        };
        const payload = { success: true };
        if (lat != null && lng != null) {
            payload.lat = lat;
            payload.lng = lng;
        }
        return res.json(payload);
    } catch (error) {
        console.error('delivery-context hatası:', error);
        return res.status(500).json({ success: false, message: 'Kaydedilemedi.' });
    }
});

module.exports = router;
