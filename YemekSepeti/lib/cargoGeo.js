/**
 * Uzak Mesafe Kargo — bölge/mesafe uygunluğu ve mesafe bazlı ücret değerlendirmesi (Faz 2).
 * Satıcının konumu (il) ile alıcı adresinin ili arasındaki Haversine mesafesini kullanır.
 */

const { getCityCoordinates, haversineDistance, cityCoordinates } = require("../data/turkey-coordinates");
const { computeCargoFee } = require("./cargoPricing");

/** Türkçe "İ" küçük harfe çevrilince eklenen birleşik noktayı (U+0307) da temizler */
function trLower(s) {
    return String(s).toLowerCase().replace(/̇/g, '').trim();
}

/** cargo_regions alanını normalize eder → geçerli il adları dizisi (boş = tüm Türkiye) */
function normalizeRegions(regions) {
    let arr = regions;
    if (typeof arr === 'string') {
        try { arr = JSON.parse(arr); } catch (e) { arr = arr.split(',').map(s => s.trim()); }
    }
    if (!Array.isArray(arr)) return [];
    const validCities = Object.keys(cityCoordinates);
    const lowerMap = {};
    validCities.forEach(c => { lowerMap[trLower(c)] = c; });
    const out = [];
    for (const item of arr) {
        if (!item) continue;
        const key = trLower(item);
        if (lowerMap[key] && !out.includes(lowerMap[key])) out.push(lowerMap[key]);
    }
    return out;
}

/**
 * Satıcı ve alıcı adresine göre kargo uygunluğunu ve ücretini değerlendirir.
 * @param {Object} seller  Kargo alanlarını içeren satıcı kaydı
 * @param {Object} dest    { city, lat, lng } — alıcı adresi
 * @param {number} subtotal Ürünler ara toplamı
 * @param {number} [totalDesi] Sepetteki toplam desi (by_weight modu için)
 * @returns {{ eligible: boolean, message: string|null, distanceKm: number|null, fee: number, city: string|null }}
 */
function evaluateCargo(seller, dest, subtotal, totalDesi) {
    const mode = seller.cargo_pricing_mode || 'free';

    // Alıcı koordinatı: önce GPS, yoksa il merkezinden
    let destLat = dest && dest.lat != null ? Number(dest.lat) : null;
    let destLng = dest && dest.lng != null ? Number(dest.lng) : null;
    const destCity = dest && dest.city ? String(dest.city).trim() : null;
    if ((destLat == null || Number.isNaN(destLat)) && destCity) {
        const c = getCityCoordinates(destCity);
        if (c) { destLat = c.lat; destLng = c.lng; }
    }

    // Satıcı koordinatı: önce kayıtlı lat/lng, yoksa location ilinden
    let sLat = seller.latitude != null ? Number(seller.latitude) : null;
    let sLng = seller.longitude != null ? Number(seller.longitude) : null;
    if ((sLat == null || Number.isNaN(sLat)) && seller.location) {
        const c = getCityCoordinates(seller.location);
        if (c) { sLat = c.lat; sLng = c.lng; }
    }

    let distanceKm = null;
    if (sLat != null && sLng != null && destLat != null && destLng != null &&
        !Number.isNaN(sLat) && !Number.isNaN(destLat)) {
        distanceKm = Math.round(haversineDistance(sLat, sLng, destLat, destLng) * 10) / 10;
    }

    // 1) Bölge kısıtı — cargo_regions boş değilse, alıcı ili listede olmalı
    const regions = normalizeRegions(seller.cargo_regions);
    if (regions.length > 0) {
        // Alıcı ilini normalize et (örn "Kadıköy, İstanbul" → "İstanbul")
        let matchedCity = null;
        if (destCity) {
            const lower = trLower(destCity);
            matchedCity = regions.find(r => lower.includes(trLower(r))) || null;
        }
        if (!matchedCity) {
            return {
                eligible: false,
                message: `Bu satıcı yalnızca şu illere kargo gönderiyor: ${regions.join(', ')}.`,
                distanceKm, fee: 0, city: destCity
            };
        }
    }

    // 2) Azami mesafe kısıtı
    const maxDist = parseInt(seller.cargo_max_distance_km) || 0;
    if (maxDist > 0 && distanceKm != null && distanceKm > maxDist) {
        return {
            eligible: false,
            message: `Teslimat noktası satıcının kargo menzili dışında (${distanceKm} km > ${maxDist} km).`,
            distanceKm, fee: 0, city: destCity
        };
    }

    // 3) Ücret hesabı
    const fee = computeCargoFee({
        mode,
        cargoFee: seller.cargo_fee,
        freeThreshold: seller.cargo_free_threshold,
        subtotal,
        distanceKm,
        feePer100km: seller.cargo_fee_per_100km,
        totalDesi,
        feePerDesi: seller.cargo_fee_per_desi
    });

    return { eligible: true, message: null, distanceKm, fee, city: destCity };
}

module.exports = { evaluateCargo, normalizeRegions };
