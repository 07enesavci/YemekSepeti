const { sequelize, Sequelize } = require('./models');
async function run() {
    try {
        const query = `
            SELECT 
                s.shop_name,
                COUNT(CASE WHEN t.status = 'delivered' THEN 1 END) as delivered_count,
                COUNT(CASE WHEN t.status = 'cancelled' THEN 1 END) as cancelled_count,
                COUNT(t.id) as total_tasks
            FROM courier_tasks t
            JOIN orders o ON t.order_id = o.id
            JOIN sellers s ON o.seller_id = s.id
            WHERE t.courier_id = 1
            AND t.created_at BETWEEN '2026-03-29 00:00:00' AND '2026-04-05 23:59:59'
            GROUP BY s.id, s.shop_name
            ORDER BY delivered_count DESC
        `;
        const results = await sequelize.query(query, { type: Sequelize.QueryTypes.SELECT });
        console.log("SUCCESS:", results);
    } catch (e) {
        console.error("ERROR:", e.message);
    }
    process.exit(0);
}
run();
