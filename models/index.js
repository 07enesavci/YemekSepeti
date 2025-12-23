const { sequelize } = require('../config/sequelize');
const { DataTypes } = require('sequelize');

// Model dosyalarını import et
const User = require('./User')(sequelize, DataTypes);
const Seller = require('./Seller')(sequelize, DataTypes);
const Meal = require('./Meal')(sequelize, DataTypes);
const Address = require('./Address')(sequelize, DataTypes);
const CartItem = require('./CartItem')(sequelize, DataTypes);
const Order = require('./Order')(sequelize, DataTypes);
const OrderItem = require('./OrderItem')(sequelize, DataTypes);
const Coupon = require('./Coupon')(sequelize, DataTypes);
const CouponUsage = require('./CouponUsage')(sequelize, DataTypes);
const Review = require('./Review')(sequelize, DataTypes);
const WalletTransaction = require('./WalletTransaction')(sequelize, DataTypes);
const CourierTask = require('./CourierTask')(sequelize, DataTypes);
const Payment = require('./Payment')(sequelize, DataTypes);
const Notification = require('./Notification')(sequelize, DataTypes);
const EmailVerificationCode = require('./EmailVerificationCode')(sequelize, DataTypes);

// İlişkileri tanımla
// User -> Seller (1:1)
User.hasOne(Seller, { foreignKey: 'user_id', as: 'seller' });
Seller.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Seller -> Meal (1:N)
Seller.hasMany(Meal, { foreignKey: 'seller_id', as: 'meals' });
Meal.belongsTo(Seller, { foreignKey: 'seller_id', as: 'seller' });

// User -> Address (1:N)
User.hasMany(Address, { foreignKey: 'user_id', as: 'addresses' });
Address.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User -> CartItem (1:N)
User.hasMany(CartItem, { foreignKey: 'user_id', as: 'cartItems' });
CartItem.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Meal.hasMany(CartItem, { foreignKey: 'meal_id', as: 'cartItems' });
CartItem.belongsTo(Meal, { foreignKey: 'meal_id', as: 'meal' });

// User -> Order (1:N) - buyer
User.hasMany(Order, { foreignKey: 'user_id', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'user_id', as: 'buyer' });

// Seller -> Order (1:N)
Seller.hasMany(Order, { foreignKey: 'seller_id', as: 'orders' });
Order.belongsTo(Seller, { foreignKey: 'seller_id', as: 'seller' });

// User -> Order (1:N) - courier
User.hasMany(Order, { foreignKey: 'courier_id', as: 'courierOrders' });
Order.belongsTo(User, { foreignKey: 'courier_id', as: 'courier' });

// Address -> Order (1:N)
Address.hasMany(Order, { foreignKey: 'address_id', as: 'orders' });
Order.belongsTo(Address, { foreignKey: 'address_id', as: 'address' });

// Order -> OrderItem (1:N)
Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
Meal.hasMany(OrderItem, { foreignKey: 'meal_id', as: 'orderItems' });
OrderItem.belongsTo(Meal, { foreignKey: 'meal_id', as: 'meal' });

// Coupon -> CouponUsage (1:N)
Coupon.hasMany(CouponUsage, { foreignKey: 'coupon_id', as: 'usages' });
CouponUsage.belongsTo(Coupon, { foreignKey: 'coupon_id', as: 'coupon' });
Order.hasMany(CouponUsage, { foreignKey: 'order_id', as: 'couponUsages' });
CouponUsage.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
User.hasMany(CouponUsage, { foreignKey: 'user_id', as: 'couponUsages' });
CouponUsage.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User -> Coupon (1:N) - created_by
User.hasMany(Coupon, { foreignKey: 'created_by', as: 'createdCoupons' });
Coupon.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// Order -> Review (1:1)
Order.hasOne(Review, { foreignKey: 'order_id', as: 'review' });
Review.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
User.hasMany(Review, { foreignKey: 'user_id', as: 'reviews' });
Review.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Seller.hasMany(Review, { foreignKey: 'seller_id', as: 'reviews' });
Review.belongsTo(Seller, { foreignKey: 'seller_id', as: 'seller' });

// User -> WalletTransaction (1:N)
User.hasMany(WalletTransaction, { foreignKey: 'user_id', as: 'walletTransactions' });
WalletTransaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Order.hasMany(WalletTransaction, { foreignKey: 'related_order_id', as: 'walletTransactions' });
WalletTransaction.belongsTo(Order, { foreignKey: 'related_order_id', as: 'relatedOrder' });

// Order -> CourierTask (1:1)
Order.hasOne(CourierTask, { foreignKey: 'order_id', as: 'courierTask' });
CourierTask.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
User.hasMany(CourierTask, { foreignKey: 'courier_id', as: 'courierTasks' });
CourierTask.belongsTo(User, { foreignKey: 'courier_id', as: 'courier' });

// Order -> Payment (1:N)
Order.hasMany(Payment, { foreignKey: 'order_id', as: 'payments' });
Payment.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// User -> Notification (1:N)
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// EmailVerificationCode - no relationships needed

module.exports = {
    sequelize,
    User,
    Seller,
    Meal,
    Address,
    CartItem,
    Order,
    OrderItem,
    Coupon,
    CouponUsage,
    Review,
    WalletTransaction,
    CourierTask,
    Payment,
    Notification,
    EmailVerificationCode
};

