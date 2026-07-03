const { Coupon } = require('./models');
Coupon.findAll().then(c => console.log(c.map(x => x.toJSON()))).catch(console.error);
