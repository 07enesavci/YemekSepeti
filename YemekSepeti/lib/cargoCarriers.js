/**
 * Anlaşmalı kargo firmaları ve takip linki üretimi.
 * API entegrasyonu değil — takip numarasını firmanın takip sayfası URL'ine gömer.
 * Bilinmeyen firma girilirse (serbest metin) link üretilmez, sadece firma adı saklanır.
 */

// key: dropdown/DB değeri, name: görünen ad, trackUrl(no) => takip linki (yoksa null)
const CARRIERS = {
    yurtici: {
        name: 'Yurtiçi Kargo',
        trackUrl: (no) => `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${encodeURIComponent(no)}`
    },
    aras: {
        name: 'Aras Kargo',
        trackUrl: (no) => `https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${encodeURIComponent(no)}`
    },
    mng: {
        name: 'MNG Kargo',
        trackUrl: (no) => `https://service.mngkargo.com.tr/iys/query/${encodeURIComponent(no)}`
    },
    ptt: {
        name: 'PTT Kargo',
        trackUrl: (no) => `https://gonderitakip.ptt.gov.tr/Track/Verify?q=${encodeURIComponent(no)}`
    },
    surat: {
        name: 'Sürat Kargo',
        trackUrl: (no) => `https://www.suratkargo.com.tr/KargoTakip/?kargotakipno=${encodeURIComponent(no)}`
    },
    ups: {
        name: 'UPS Kargo',
        trackUrl: (no) => `https://www.ups.com/track?trackingNumber=${encodeURIComponent(no)}`
    },
    sendeo: {
        name: 'Sendeo',
        trackUrl: (no) => `https://www.sendeo.com.tr/gonderi-takip?kod=${encodeURIComponent(no)}`
    },
    hepsijet: {
        name: 'HepsiJET',
        trackUrl: (no) => `https://www.hepsijet.com/gonderi-takibi?trackingNumber=${encodeURIComponent(no)}`
    }
};

/** Firma anahtarı bilinen listede mi? */
function isKnownCarrier(key) {
    return typeof key === 'string' && Object.prototype.hasOwnProperty.call(CARRIERS, key);
}

/** Dropdown için firma listesi [{ key, name }] */
function listCarriers() {
    return Object.keys(CARRIERS).map((key) => ({ key, name: CARRIERS[key].name }));
}

/**
 * Firma + takip no'dan kaydedilecek alanları üretir.
 * @param {string} carrier  Bilinen firma anahtarı ('yurtici' vb.) veya serbest metin firma adı
 * @param {string} trackingNumber
 * @returns {{ companyName: string, trackingNumber: string|null, trackingUrl: string|null }}
 */
function buildCargoTracking(carrier, trackingNumber) {
    const no = trackingNumber ? String(trackingNumber).trim() : null;
    if (isKnownCarrier(carrier)) {
        const c = CARRIERS[carrier];
        return {
            companyName: c.name,
            trackingNumber: no,
            trackingUrl: no ? c.trackUrl(no) : null
        };
    }
    // Serbest metin firma — link üretilmez
    return {
        companyName: carrier ? String(carrier).trim() : '',
        trackingNumber: no,
        trackingUrl: null
    };
}

module.exports = { CARRIERS, isKnownCarrier, listCarriers, buildCargoTracking };
