// Satıcı ve kurye raporlarının (Excel) içeriğini üreten paylaşımlı yapıcılar.
// Hem admin panelinden (başka birinin raporu) hem de satıcı/kuryenin kendi
// panelinden aynı içerik üretilsin diye ortaklaştırıldı.
//
// Tüm sorgular tarih aralığı + LIMIT ile sınırlıdır (bkz. excelExport sabitleri),
// böylece geniş aralıkta bile tek isteğin DB/bellek maliyeti sabit kalır.
const { QueryTypes } = require('sequelize');
const { MAX_EXPORT_ROWS, MAX_BREAKDOWN_ROWS, fmtRange } = require('./excelExport');

// Dosya adı için güvenli slug (Türkçe karakterler sadeleştirilir).
function slug(str) {
    const map = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'C', Ğ: 'G', İ: 'I', Ö: 'O', Ş: 'S', Ü: 'U' };
    return String(str || 'rapor')
        .replace(/[çğıöşüÇĞİÖŞÜ]/g, (m) => map[m] || m)
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 40) || 'rapor';
}

const toDay = (d) => (d instanceof Date)
    ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)
    : new Date(`${String(d).slice(0, 10)}T12:00:00`);

const PAYMENT_TR = { credit_card: 'Kredi Kartı', cash: 'Nakit / Kapıda', wallet: 'Cüzdan', iyzico: 'Online Ödeme' };

// ── Satıcı raporu ────────────────────────────────────────────────────────────
async function buildSellerReport(seq, { sellerId, shopName, start, end }) {
    const repl = [sellerId, start, end];

    const [stats] = await seq.query(
        `SELECT
            COUNT(*) as total_orders,
            COUNT(CASE WHEN status='delivered' THEN 1 END) as total_delivered,
            COUNT(CASE WHEN status='cancelled' THEN 1 END) as total_cancelled,
            COALESCE(SUM(CASE WHEN status='delivered' THEN total_amount ELSE 0 END),0) as total_revenue
         FROM orders WHERE seller_id=? AND created_at BETWEEN ? AND ?`,
        { replacements: repl, type: QueryTypes.SELECT }
    );
    const totalOrders = parseInt(stats.total_orders) || 0;
    const delivered = parseInt(stats.total_delivered) || 0;
    const cancelled = parseInt(stats.total_cancelled) || 0;
    const revenue = parseFloat(stats.total_revenue) || 0;
    const avgBasket = delivered > 0 ? revenue / delivered : 0;
    const rate = totalOrders > 0 ? (delivered / totalOrders) * 100 : 0;

    const daily = await seq.query(
        `SELECT DATE(created_at) as day,
            COUNT(*) as orders,
            COUNT(CASE WHEN status='delivered' THEN 1 END) as delivered,
            COALESCE(SUM(CASE WHEN status='delivered' THEN total_amount ELSE 0 END),0) as revenue
         FROM orders WHERE seller_id=? AND created_at BETWEEN ? AND ?
         GROUP BY DATE(created_at) ORDER BY day ASC`,
        { replacements: repl, type: QueryTypes.SELECT }
    );

    const orders = await seq.query(
        `SELECT o.id, o.order_number, o.total_amount, o.status, o.created_at, o.payment_method,
                u.fullname as customer_name, c.fullname as courier_name
         FROM orders o
         LEFT JOIN users u ON o.user_id=u.id
         LEFT JOIN users c ON o.courier_id=c.id
         WHERE o.seller_id=? AND o.created_at BETWEEN ? AND ?
         ORDER BY o.created_at DESC LIMIT ${MAX_EXPORT_ROWS}`,
        { replacements: repl, type: QueryTypes.SELECT }
    );

    return {
        fileName: `Ev-Lezzetleri-Satis-Raporu-${slug(shopName)}-${end.toISOString().slice(0, 10)}.xlsx`,
        title: 'Satış Raporu',
        subtitle: `${shopName} · ${fmtRange(start, end)}`,
        kpis: [
            { label: 'Toplam Sipariş', value: totalOrders, tone: 'primary' },
            { label: 'Teslim Edilen', value: delivered, tone: 'success' },
            { label: 'İptal Edilen', value: cancelled, tone: 'danger' },
            { label: 'Toplam Ciro', value: revenue, money: true, tone: 'success' },
            { label: 'Ort. Sepet', value: avgBasket, money: true, tone: 'neutral' },
            { label: 'Teslim Oranı', value: rate, percent: true, tone: 'primary' }
        ],
        info: [
            ['Rapor Türü', 'Satış Raporu'],
            ['Mağaza', shopName],
            ['Tarih Aralığı', fmtRange(start, end)],
            ['Oluşturulma', new Date().toLocaleString('tr-TR')]
        ],
        sheets: [
            {
                name: 'Günlük Kırılım', heading: 'Günlük Sipariş & Ciro',
                columns: [
                    { header: 'Tarih', key: 'day', width: 14, type: 'date' },
                    { header: 'Sipariş', key: 'orders', width: 12, type: 'int' },
                    { header: 'Teslim', key: 'delivered', width: 12, type: 'int' },
                    { header: 'Ciro', key: 'revenue', width: 18, type: 'money' }
                ],
                rows: daily.map(r => ({
                    day: toDay(r.day),
                    orders: parseInt(r.orders) || 0,
                    delivered: parseInt(r.delivered) || 0,
                    revenue: parseFloat(r.revenue) || 0
                }))
            },
            {
                name: 'Siparişler', heading: 'Sipariş Detayları',
                columns: [
                    { header: 'Sipariş No', key: 'order_number', width: 20 },
                    { header: 'Tarih', key: 'created_at', width: 18, type: 'datetime' },
                    { header: 'Müşteri', key: 'customer_name', width: 22 },
                    { header: 'Kurye', key: 'courier_name', width: 20 },
                    { header: 'Tutar', key: 'total_amount', width: 14, type: 'money' },
                    { header: 'Durum', key: 'status', width: 15, type: 'status' },
                    { header: 'Ödeme', key: 'payment_method', width: 15 }
                ],
                rows: orders.map(o => ({
                    order_number: o.order_number || o.id,
                    created_at: o.created_at,
                    customer_name: o.customer_name,
                    courier_name: o.courier_name,
                    total_amount: parseFloat(o.total_amount) || 0,
                    status: o.status,
                    payment_method: PAYMENT_TR[o.payment_method] || o.payment_method
                })),
                note: orders.length >= MAX_EXPORT_ROWS ? `Sipariş sayısı sınırı (${MAX_EXPORT_ROWS}) aşıldı, daha dar bir tarih aralığı seçin.` : null
            }
        ]
    };
}

// ── Kurye raporu ─────────────────────────────────────────────────────────────
// Not: orders.courier_id, users.id'yi referans alır (bkz. admin courier-stats).
async function buildCourierReport(seq, { userId, courierName, start, end }) {
    const repl = [userId, start, end];

    const [stats] = await seq.query(
        `SELECT
            COUNT(*) as total_assigned,
            COUNT(CASE WHEN status='delivered' THEN 1 END) as total_delivered,
            COUNT(CASE WHEN status='cancelled' THEN 1 END) as total_cancelled,
            COALESCE(SUM(CASE WHEN status='delivered' THEN delivery_fee ELSE 0 END),0) as total_earnings,
            COUNT(DISTINCT seller_id) as distinct_shops
         FROM orders WHERE courier_id=? AND created_at BETWEEN ? AND ?`,
        { replacements: repl, type: QueryTypes.SELECT }
    );
    const delivered = parseInt(stats.total_delivered) || 0;
    const cancelled = parseInt(stats.total_cancelled) || 0;
    const earnings = parseFloat(stats.total_earnings) || 0;
    const distinctShops = parseInt(stats.distinct_shops) || 0;
    const completed = delivered + cancelled;
    const rate = completed > 0 ? (delivered / completed) * 100 : 0;
    const avgFee = delivered > 0 ? earnings / delivered : 0;

    const shops = await seq.query(
        `SELECT s.shop_name,
            COUNT(CASE WHEN o.status='delivered' THEN 1 END) as delivered,
            COUNT(CASE WHEN o.status='cancelled' THEN 1 END) as cancelled,
            COUNT(*) as total
         FROM orders o JOIN sellers s ON o.seller_id=s.id
         WHERE o.courier_id=? AND o.created_at BETWEEN ? AND ?
         GROUP BY s.id, s.shop_name ORDER BY delivered DESC LIMIT ${MAX_BREAKDOWN_ROWS}`,
        { replacements: repl, type: QueryTypes.SELECT }
    );

    const daily = await seq.query(
        `SELECT DATE(created_at) as day,
            COUNT(CASE WHEN status='delivered' THEN 1 END) as delivered,
            COALESCE(SUM(CASE WHEN status='delivered' THEN delivery_fee ELSE 0 END),0) as earnings
         FROM orders WHERE courier_id=? AND created_at BETWEEN ? AND ?
         GROUP BY DATE(created_at) ORDER BY day ASC`,
        { replacements: repl, type: QueryTypes.SELECT }
    );

    const deliveries = await seq.query(
        `SELECT o.id, o.order_number, o.created_at, s.shop_name, o.total_amount, o.delivery_fee, o.status
         FROM orders o LEFT JOIN sellers s ON o.seller_id=s.id
         WHERE o.courier_id=? AND o.created_at BETWEEN ? AND ?
         ORDER BY o.created_at DESC LIMIT ${MAX_EXPORT_ROWS}`,
        { replacements: repl, type: QueryTypes.SELECT }
    );

    return {
        fileName: `Ev-Lezzetleri-Kurye-Raporu-${slug(courierName)}-${end.toISOString().slice(0, 10)}.xlsx`,
        title: 'Kurye Teslimat Raporu',
        subtitle: `${courierName} · ${fmtRange(start, end)}`,
        kpis: [
            { label: 'Teslim Edilen', value: delivered, tone: 'success' },
            { label: 'İptal Edilen', value: cancelled, tone: 'danger' },
            { label: 'Tahmini Kazanç', value: earnings, money: true, tone: 'success' },
            { label: 'Teslim Oranı', value: rate, percent: true, tone: 'primary' },
            { label: 'Ort. Teslimat Ücreti', value: avgFee, money: true, tone: 'neutral' },
            { label: 'Farklı Mağaza', value: distinctShops, tone: 'neutral' }
        ],
        info: [
            ['Rapor Türü', 'Kurye Teslimat Raporu'],
            ['Kurye', courierName],
            ['Tarih Aralığı', fmtRange(start, end)],
            ['Oluşturulma', new Date().toLocaleString('tr-TR')]
        ],
        sheets: [
            {
                name: 'Mağaza Bazlı Özet', heading: 'Mağaza Bazlı Teslimat',
                columns: [
                    { header: 'Mağaza', key: 'shop', width: 28 },
                    { header: 'Teslim', key: 'delivered', width: 12, type: 'int' },
                    { header: 'İptal', key: 'cancelled', width: 12, type: 'int' },
                    { header: 'Toplam İşlem', key: 'total', width: 14, type: 'int' }
                ],
                rows: shops.map(r => ({
                    shop: r.shop_name || 'Bilinmiyor',
                    delivered: parseInt(r.delivered) || 0,
                    cancelled: parseInt(r.cancelled) || 0,
                    total: parseInt(r.total) || 0
                }))
            },
            {
                name: 'Günlük Kırılım', heading: 'Günlük Teslimat & Kazanç',
                columns: [
                    { header: 'Tarih', key: 'day', width: 14, type: 'date' },
                    { header: 'Teslim', key: 'delivered', width: 12, type: 'int' },
                    { header: 'Kazanç', key: 'earnings', width: 18, type: 'money' }
                ],
                rows: daily.map(r => ({
                    day: toDay(r.day),
                    delivered: parseInt(r.delivered) || 0,
                    earnings: parseFloat(r.earnings) || 0
                }))
            },
            {
                name: 'Teslimatlar', heading: 'Teslimat Detayları',
                columns: [
                    { header: 'Sipariş No', key: 'order_number', width: 20 },
                    { header: 'Tarih', key: 'created_at', width: 18, type: 'datetime' },
                    { header: 'Mağaza', key: 'shop_name', width: 24 },
                    { header: 'Sipariş Tutarı', key: 'total_amount', width: 16, type: 'money' },
                    { header: 'Teslimat Ücreti', key: 'delivery_fee', width: 16, type: 'money' },
                    { header: 'Durum', key: 'status', width: 15, type: 'status' }
                ],
                rows: deliveries.map(d => ({
                    order_number: d.order_number || d.id,
                    created_at: d.created_at,
                    shop_name: d.shop_name,
                    total_amount: parseFloat(d.total_amount) || 0,
                    delivery_fee: parseFloat(d.delivery_fee) || 0,
                    status: d.status
                })),
                note: deliveries.length >= MAX_EXPORT_ROWS ? `Teslimat sayısı sınırı (${MAX_EXPORT_ROWS}) aşıldı, daha dar bir tarih aralığı seçin.` : null
            }
        ]
    };
}

module.exports = { buildSellerReport, buildCourierReport, slug };
