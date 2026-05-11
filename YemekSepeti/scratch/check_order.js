const { Order, Seller } = require('./models');

async function checkOrder() {
    try {
        const order = await Order.findOne({
            where: { order_number: 'ORD-2026-746281374' },
            include: [{ model: Seller, as: 'seller' }]
        });
        
        if (order) {
            console.log('Order ID:', order.id);
            console.log('Order Number:', order.order_number);
            console.log('Delivery Type:', order.delivery_type);
            console.log('Status:', order.status);
            console.log('Seller Name:', order.seller?.shop_name);
            console.log('Seller Uzak Mesafe Enabled:', order.seller?.uzak_mesafe_enabled);
        } else {
            console.log('Order not found');
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkOrder();
