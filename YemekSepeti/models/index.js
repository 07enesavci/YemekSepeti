const {sequelize}=require('../config/sequelize');
const {DataTypes}=require('sequelize');

const User=require('./User')(sequelize, DataTypes);
const Seller=require('./Seller')(sequelize, DataTypes);
const Meal=require('./Meal')(sequelize, DataTypes);
const Address=require('./Address')(sequelize, DataTypes);
const CartItem=require('./CartItem')(sequelize, DataTypes);
const Order=require('./Order')(sequelize, DataTypes);
const OrderItem=require('./OrderItem')(sequelize, DataTypes);
const Coupon=require('./Coupon')(sequelize, DataTypes);
const CouponUsage=require('./CouponUsage')(sequelize, DataTypes);
const Review=require('./Review')(sequelize, DataTypes);
const WalletTransaction=require('./WalletTransaction')(sequelize, DataTypes);
const CourierTask=require('./CourierTask')(sequelize, DataTypes);
const Payment=require('./Payment')(sequelize, DataTypes);
const Notification=require('./Notification')(sequelize, DataTypes);
const EmailVerificationCode=require('./EmailVerificationCode')(sequelize, DataTypes);

User.hasOne(Seller, {foreignKey: 'user_id', as: 'seller'});
Seller.belongsTo(User, {foreignKey: 'user_id', as: 'user'});

Seller.hasMany(Meal, {foreignKey: 'seller_id', as: 'meals'});
Meal.belongsTo(Seller, {foreignKey: 'seller_id', as: 'seller'});

User.hasMany(Address, {foreignKey: 'user_id', as: 'addresses'});
Address.belongsTo(User, {foreignKey: 'user_id', as: 'user'});

User.hasMany(CartItem, {foreignKey: 'user_id', as: 'cartItems'});
CartItem.belongsTo(User, {foreignKey: 'user_id', as: 'user'});
Meal.hasMany(CartItem, {foreignKey: 'meal_id', as: 'cartItems'});
CartItem.belongsTo(Meal, {foreignKey: 'meal_id', as: 'meal'});

User.hasMany(Order, {foreignKey: 'user_id', as: 'orders'});
Order.belongsTo(User, {foreignKey: 'user_id', as: 'buyer'});

Seller.hasMany(Order, {foreignKey: 'seller_id', as: 'orders'});
Order.belongsTo(Seller, {foreignKey: 'seller_id', as: 'seller'});

User.hasMany(Order, {foreignKey: 'courier_id', as: 'courierOrders'});
Order.belongsTo(User, {foreignKey: 'courier_id', as: 'courier'});

Address.hasMany(Order, {foreignKey: 'address_id', as: 'orders'});
Order.belongsTo(Address, {foreignKey: 'address_id', as: 'address'});

Order.hasMany(OrderItem, {foreignKey: 'order_id', as: 'items'});
OrderItem.belongsTo(Order, {foreignKey: 'order_id', as: 'order'});
Meal.hasMany(OrderItem, {foreignKey: 'meal_id', as: 'orderItems'});
OrderItem.belongsTo(Meal, {foreignKey: 'meal_id', as: 'meal'});

Coupon.hasMany(CouponUsage, {foreignKey: 'coupon_id', as: 'usages'});
CouponUsage.belongsTo(Coupon, {foreignKey: 'coupon_id', as: 'coupon'});
Order.hasMany(CouponUsage, {foreignKey: 'order_id', as: 'couponUsages'});
CouponUsage.belongsTo(Order, {foreignKey: 'order_id', as: 'order'});
User.hasMany(CouponUsage, {foreignKey: 'user_id', as: 'couponUsages'});
CouponUsage.belongsTo(User, {foreignKey: 'user_id', as: 'user'});

User.hasMany(Coupon, {foreignKey: 'created_by', as: 'createdCoupons'});
Coupon.belongsTo(User, {foreignKey: 'created_by', as: 'creator'});

Order.hasOne(Review, {foreignKey: 'order_id', as: 'review'});
Review.belongsTo(Order, {foreignKey: 'order_id', as: 'order'});
User.hasMany(Review, {foreignKey: 'user_id', as: 'reviews'});
Review.belongsTo(User, {foreignKey: 'user_id', as: 'user'});
Seller.hasMany(Review, {foreignKey: 'seller_id', as: 'reviews'});
Review.belongsTo(Seller, {foreignKey: 'seller_id', as: 'seller'});

User.hasMany(WalletTransaction, {foreignKey: 'user_id', as: 'walletTransactions'});
WalletTransaction.belongsTo(User, {foreignKey: 'user_id', as: 'user'});
Order.hasMany(WalletTransaction, {foreignKey: 'related_order_id', as: 'walletTransactions'});
WalletTransaction.belongsTo(Order, {foreignKey: 'related_order_id', as: 'relatedOrder'});

Order.hasOne(CourierTask, {foreignKey: 'order_id', as: 'courierTask'});
CourierTask.belongsTo(Order, {foreignKey: 'order_id', as: 'order'});
User.hasMany(CourierTask, {foreignKey: 'courier_id', as: 'courierTasks'});
CourierTask.belongsTo(User, {foreignKey: 'courier_id', as: 'courier'});

Order.hasMany(Payment, {foreignKey: 'order_id', as: 'payments'});
Payment.belongsTo(Order, {foreignKey: 'order_id', as: 'order'});

User.hasMany(Notification, {foreignKey: 'user_id', as: 'notifications'});
Notification.belongsTo(User, {foreignKey: 'user_id', as: 'user'});

module.exports={
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
