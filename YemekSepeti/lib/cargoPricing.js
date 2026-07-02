/**
 * Uzak Mesafe Kargo ücret hesaplama.
 * Sunucuda otoriter olarak (routes/api/orders.js) kullanılır; aynı mantık
 * checkout görünümü için cart.js içinde de aynalanmıştır.
 *
 * Modlar:
 *   'free'      → kargo her zaman ücretsiz
 *   'flat'      → sabit kargo ücreti (eşik üstü ücretsiz olabilir)
 *   'by_region' → taban ücret + mesafe başına ek (her 100 km için feePer100km)
 *   'by_weight' → taban ücret + toplam desi × feePerDesi
 */

const CARGO_PRICING_MODES = ['free', 'flat', 'by_region', 'by_weight'];

/**
 * @param {Object} opts
 * @param {string} opts.mode           Kargo ücretlendirme modu
 * @param {number|string} opts.cargoFee        Taban/sabit kargo ücreti (TL)
 * @param {number|string} opts.freeThreshold   Ücretsiz kargo eşiği (0 = kapalı)
 * @param {number|string} opts.subtotal        Ürünler ara toplamı (TL)
 * @param {number|string} [opts.distanceKm]    Satıcı-alıcı mesafesi (by_region için)
 * @param {number|string} [opts.feePer100km]   Her 100 km için ek ücret (by_region için)
 * @param {number|string} [opts.totalDesi]     Sepetteki toplam desi (by_weight için)
 * @param {number|string} [opts.feePerDesi]    Desi başına ek ücret (by_weight için)
 * @returns {number} Alıcıdan alınacak kargo ücreti (2 ondalık)
 */
function computeCargoFee({ mode, cargoFee, freeThreshold, subtotal, distanceKm, feePer100km, totalDesi, feePerDesi }) {
    const fee = Math.max(0, parseFloat(cargoFee) || 0);
    const threshold = Math.max(0, parseFloat(freeThreshold) || 0);
    const sub = Math.max(0, parseFloat(subtotal) || 0);
    const m = CARGO_PRICING_MODES.includes(mode) ? mode : 'free';

    if (m === 'free') return 0;

    // Eşik üstü siparişlerde her modda ücretsiz
    if (threshold > 0 && sub >= threshold) return 0;

    let total = fee;
    if (m === 'by_region') {
        const dist = Math.max(0, parseFloat(distanceKm) || 0);
        const per100 = Math.max(0, parseFloat(feePer100km) || 0);
        total = fee + Math.ceil(dist / 100) * per100;
    } else if (m === 'by_weight') {
        const desi = Math.max(0, parseFloat(totalDesi) || 0);
        const perDesi = Math.max(0, parseFloat(feePerDesi) || 0);
        total = fee + desi * perDesi;
    }
    return Math.round(total * 100) / 100;
}

module.exports = { computeCargoFee, CARGO_PRICING_MODES };
