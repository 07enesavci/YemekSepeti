const { Op, Sequelize } = require('sequelize');
const { Review, Seller, User } = require('../models');

async function recalculateSellerRatings(sellerIds = [], options = {}) {
    const normalizedSellerIds = [...new Set(
        (sellerIds || [])
            .map((id) => parseInt(id, 10))
            .filter((id) => Number.isInteger(id) && id > 0)
    )];

    if (normalizedSellerIds.length === 0) {
        return 0;
    }

    const transaction = options.transaction;

    await Seller.update(
        { rating: 0, total_reviews: 0 },
        { where: { id: { [Op.in]: normalizedSellerIds } }, transaction }
    );

    const groupedRatings = await Review.findAll({
        where: {
            seller_id: { [Op.in]: normalizedSellerIds },
            is_visible: true
        },
        include: [{
            model: User,
            as: 'user',
            attributes: [],
            where: { is_active: true }
        }],
        attributes: [
            'seller_id',
            [Sequelize.fn('COUNT', Sequelize.col('Review.id')), 'review_count'],
            [Sequelize.fn('AVG', Sequelize.col('Review.rating')), 'avg_rating']
        ],
        group: ['seller_id'],
        raw: true,
        transaction
    });

    await Promise.all(groupedRatings.map((row) => {
        const sellerId = parseInt(row.seller_id, 10);
        const reviewCount = parseInt(row.review_count, 10) || 0;
        const avg = row.avg_rating != null ? parseFloat(Number(row.avg_rating).toFixed(2)) : 0;

        return Seller.update(
            { rating: avg, total_reviews: reviewCount },
            { where: { id: sellerId }, transaction }
        );
    }));

    return normalizedSellerIds.length;
}

module.exports = { recalculateSellerRatings };
