const Iyzipay = require("iyzipay");
require("dotenv").config();

const iyzipay = new Iyzipay({
    apiKey: process.env.IYZICO_API_KEY || "",
    secretKey: process.env.IYZICO_SECRET_KEY || "",
    uri: process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com"
});

/**
 * Sipariş iptalinde iyzico ödemesini tam iade eder (tüm itemTransactions satırları).
 * @param {object} order Sequelize Order — order_number, iyzico_payment_data
 * @param {string} [clientIp]
 * @returns {Promise<{ skipped?: boolean, results?: object[] }>}
 */
async function refundIyzicoPaymentForOrder(order, clientIp) {
    if (!order || !order.iyzico_payment_data) {
        return { skipped: true };
    }
    if (!process.env.IYZICO_API_KEY || !process.env.IYZICO_SECRET_KEY) {
        throw new Error("iyzico yapılandırması eksik.");
    }

    let data;
    try {
        data = JSON.parse(order.iyzico_payment_data);
    } catch (e) {
        throw new Error("iyzico ödeme verisi okunamadı.");
    }

    const items = data.itemTransactions || [];
    if (items.length === 0) {
        throw new Error("iyzico iade için itemTransactions bulunamadı.");
    }

    const ip = clientIp || "85.34.78.112";
    const baseConv = data.conversationId || `order-${order.id}`;
    const results = [];

    for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const rawPrice = it.paidPrice != null ? it.paidPrice : it.price;
        const price = Number(rawPrice).toFixed(2);

        const result = await new Promise((resolve, reject) => {
            iyzipay.refund.create(
                {
                    locale: Iyzipay.LOCALE.TR,
                    conversationId: `${baseConv}-refund-${order.id}-${i}-${Date.now()}`,
                    paymentTransactionId: String(it.paymentTransactionId),
                    price,
                    currency: Iyzipay.CURRENCY.TRY,
                    ip,
                    reason: Iyzipay.REFUND_REASON.BUYER_REQUEST,
                    description: `Siparis iptal ${order.order_number || order.id}`
                },
                (err, res) => {
                    if (err) return reject(err);
                    if (!res || res.status !== "success") {
                        return reject(new Error(res?.errorMessage || "iyzico iade başarısız."));
                    }
                    resolve(res);
                }
            );
        });
        results.push(result);
    }

    return { ok: true, results };
}

module.exports = { refundIyzicoPaymentForOrder };
