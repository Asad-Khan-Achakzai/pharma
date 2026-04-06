#!/usr/bin/env node
/**
 * Seed script for Pharma ERP
 *
 * Populates the database with realistic sample data:
 *   - 1 Company
 *   - 1 Admin + 2 Medical Reps
 *   - 8 Products (medicines)
 *   - 3 Distributors with inventory (via stock transfers)
 *   - 6 Pharmacies
 *   - 8 Doctors
 *   - Doctor activity records
 *   - Med rep monthly targets
 *   - Weekly plans
 *   - 10 Orders (mix of PENDING, DELIVERED, PARTIALLY_DELIVERED, RETURNED)
 *   - Delivery / return records with ledger + transaction entries
 *   - Payments
 *   - Expenses + Payroll
 *   - Audit log entries
 *
 * Usage:
 *   node seed.js          # seeds data
 *   node seed.js --drop   # drops all collections first, then seeds
 *
 * Login credentials after seeding:
 *   Admin:     admin@pharmaplus.pk  / Admin@123
 *   Med Rep 1: ahmed@pharmaplus.pk  / Rep@1234
 *   Med Rep 2: sara@pharmaplus.pk   / Rep@1234
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { roundPKR } = require('./src/utils/currency');
const { generateOrderNumber } = require('./src/utils/orderNumber');

const {
  Company, User, Product, Distributor, DistributorInventory,
  StockTransfer, Pharmacy, Doctor, DoctorActivity, Order,
  DeliveryRecord, ReturnRecord, Ledger, Payment, Transaction,
  MedRepTarget, WeeklyPlan, Expense, Payroll, AuditLog
} = require('./src/models');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma_erp';

const shouldDrop = process.argv.includes('--drop');

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  if (shouldDrop) {
    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const col of collections) {
      await mongoose.connection.db.dropCollection(col.name);
    }
    console.log('Dropped all collections');
  }

  // ─── Company ───
  const company = await Company.create({
    name: 'PharmaPlus Distributors',
    address: 'Plot 45, Industrial Area, Korangi',
    city: 'Karachi',
    state: 'Sindh',
    country: 'Pakistan',
    phone: '+92-21-3456789',
    email: 'info@pharmaplus.pk',
    currency: 'PKR'
  });
  const C = company._id;
  console.log('Created company:', company.name);

  // ─── Users ───
  const admin = await User.create({
    companyId: C, name: 'Bilal Khan', email: 'admin@pharmaplus.pk',
    password: 'Admin@123', role: 'ADMIN', phone: '+92-300-1234567', permissions: []
  });

  const rep1 = await User.create({
    companyId: C, name: 'Ahmed Raza', email: 'ahmed@pharmaplus.pk',
    password: 'Rep@1234', role: 'MEDICAL_REP', phone: '+92-321-9876543',
    createdBy: admin._id,
    permissions: [
      'dashboard.view', 'products.view', 'distributors.view', 'inventory.view',
      'pharmacies.view', 'pharmacies.create', 'doctors.view', 'doctors.create',
      'orders.view', 'orders.create', 'payments.view', 'payments.create',
      'ledger.view', 'targets.view', 'weeklyPlans.view', 'weeklyPlans.create',
      'weeklyPlans.edit', 'reports.view'
    ]
  });

  const rep2 = await User.create({
    companyId: C, name: 'Sara Malik', email: 'sara@pharmaplus.pk',
    password: 'Rep@1234', role: 'MEDICAL_REP', phone: '+92-333-5551234',
    createdBy: admin._id,
    permissions: [
      'dashboard.view', 'products.view', 'distributors.view', 'inventory.view',
      'pharmacies.view', 'pharmacies.create', 'doctors.view', 'doctors.create',
      'orders.view', 'orders.create', 'payments.view', 'payments.create',
      'ledger.view', 'targets.view', 'weeklyPlans.view', 'weeklyPlans.create',
      'weeklyPlans.edit', 'reports.view'
    ]
  });
  console.log('Created 3 users (1 admin, 2 reps)');

  // ─── Products (realistic pharma) ───
  const productsData = [
    { name: 'Amoxicillin 500mg', composition: 'Amoxicillin Trihydrate 500mg', mrp: 320, tp: 250, tpPercent: 21.88, casting: 150, castingPercent: 53.13 },
    { name: 'Omeprazole 20mg',   composition: 'Omeprazole 20mg',              mrp: 180, tp: 140, tpPercent: 22.22, casting: 80,  castingPercent: 55.56 },
    { name: 'Metformin 500mg',   composition: 'Metformin HCl 500mg',          mrp: 250, tp: 195, tpPercent: 22.00, casting: 110, castingPercent: 56.00 },
    { name: 'Ciprofloxacin 250mg', composition: 'Ciprofloxacin HCl 250mg',    mrp: 280, tp: 220, tpPercent: 21.43, casting: 130, castingPercent: 53.57 },
    { name: 'Amlodipine 5mg',   composition: 'Amlodipine Besylate 5mg',       mrp: 200, tp: 155, tpPercent: 22.50, casting: 90,  castingPercent: 55.00 },
    { name: 'Losartan 50mg',    composition: 'Losartan Potassium 50mg',        mrp: 350, tp: 275, tpPercent: 21.43, casting: 160, castingPercent: 54.29 },
    { name: 'Cetirizine 10mg',  composition: 'Cetirizine Dihydrochloride 10mg', mrp: 120, tp: 95,  tpPercent: 20.83, casting: 50,  castingPercent: 58.33 },
    { name: 'Azithromycin 500mg', composition: 'Azithromycin Dihydrate 500mg', mrp: 450, tp: 350, tpPercent: 22.22, casting: 200, castingPercent: 55.56 }
  ];

  const products = await Product.insertMany(
    productsData.map(p => ({ companyId: C, createdBy: admin._id, ...p }))
  );
  console.log(`Created ${products.length} products`);

  // ─── Distributors ───
  const distributorsData = [
    { name: 'City Pharma Distribution', address: 'Saddar, Rawalpindi', city: 'Rawalpindi', state: 'Punjab', phone: '+92-51-1112233', discountOnTP: 5 },
    { name: 'Medline Distributors',     address: 'Model Town, Lahore',  city: 'Lahore',    state: 'Punjab', phone: '+92-42-9998877', discountOnTP: 7 },
    { name: 'Karachi Health Supplies',  address: 'Clifton, Karachi',    city: 'Karachi',   state: 'Sindh',  phone: '+92-21-4445566', discountOnTP: 6 }
  ];

  const distributors = await Distributor.insertMany(
    distributorsData.map(d => ({ companyId: C, createdBy: admin._id, ...d }))
  );
  console.log(`Created ${distributors.length} distributors`);

  // ─── Stock Transfers → Inventory ───
  const shippingPerUnit = 5;
  const inventoryRecords = [];
  const transferRecords = [];

  for (const dist of distributors) {
    const items = [];
    for (const prod of products) {
      const qty = 200 + Math.floor(Math.random() * 300);
      const avgCost = roundPKR(prod.casting + shippingPerUnit);
      items.push({
        productId: prod._id,
        quantity: qty,
        castingAtTime: prod.casting,
        shippingCostPerUnit: shippingPerUnit
      });
      inventoryRecords.push({
        companyId: C,
        distributorId: dist._id,
        productId: prod._id,
        quantity: qty,
        avgCostPerUnit: avgCost,
        lastUpdated: new Date(),
        createdBy: admin._id
      });
    }

    const totalShipping = items.reduce((s, i) => s + i.quantity * i.shippingCostPerUnit, 0);
    transferRecords.push({
      companyId: C,
      distributorId: dist._id,
      items,
      totalShippingCost: totalShipping,
      transferDate: new Date(Date.now() - 30 * 86400000),
      notes: 'Initial stock load',
      createdBy: admin._id
    });
  }

  await DistributorInventory.insertMany(inventoryRecords);
  await StockTransfer.insertMany(transferRecords);
  console.log(`Created inventory for ${distributors.length} distributors (${inventoryRecords.length} records)`);

  // ─── Pharmacies ───
  const pharmaciesData = [
    { name: 'Al-Shifa Pharmacy',        address: 'F-8 Markaz, Islamabad',   city: 'Islamabad',  state: 'ICT',    phone: '+92-51-2223344', discountOnTP: 2 },
    { name: 'Aga Khan Pharmacy',         address: 'Stadium Road, Karachi',   city: 'Karachi',    state: 'Sindh',  phone: '+92-21-5556677', discountOnTP: 3 },
    { name: 'Lahore Medical Store',      address: 'Mall Road, Lahore',       city: 'Lahore',     state: 'Punjab', phone: '+92-42-1119988', discountOnTP: 2 },
    { name: 'Faisal Pharmacy',           address: 'Satellite Town, Rawalpindi', city: 'Rawalpindi', state: 'Punjab', phone: '+92-51-3332211', discountOnTP: 4 },
    { name: 'Medics Pharmacy',           address: 'Gulshan-e-Iqbal, Karachi', city: 'Karachi',   state: 'Sindh',  phone: '+92-21-6667788', discountOnTP: 2 },
    { name: 'Care Plus Pharmacy',        address: 'DHA Phase 5, Lahore',     city: 'Lahore',     state: 'Punjab', phone: '+92-42-7778899', discountOnTP: 3 }
  ];

  const pharmacies = await Pharmacy.insertMany(
    pharmaciesData.map(p => ({ companyId: C, createdBy: admin._id, ...p }))
  );
  console.log(`Created ${pharmacies.length} pharmacies`);

  // ─── Doctors ───
  const doctorsData = [
    { pharmacyIdx: 0, name: 'Dr. Usman Tariq',     specialization: 'General Physician', phone: '+92-300-1111111' },
    { pharmacyIdx: 0, name: 'Dr. Fatima Noor',      specialization: 'Cardiologist',      phone: '+92-300-2222222' },
    { pharmacyIdx: 1, name: 'Dr. Hassan Ali',       specialization: 'Dermatologist',     phone: '+92-300-3333333' },
    { pharmacyIdx: 2, name: 'Dr. Ayesha Khan',      specialization: 'General Physician', phone: '+92-300-4444444' },
    { pharmacyIdx: 2, name: 'Dr. Zain Abbas',       specialization: 'Pulmonologist',     phone: '+92-300-5555555' },
    { pharmacyIdx: 3, name: 'Dr. Hira Mahmood',     specialization: 'ENT Specialist',    phone: '+92-300-6666666' },
    { pharmacyIdx: 4, name: 'Dr. Kamran Sheikh',    specialization: 'Gastroenterologist', phone: '+92-300-7777777' },
    { pharmacyIdx: 5, name: 'Dr. Nadia Hussain',    specialization: 'General Physician', phone: '+92-300-8888888' }
  ];

  const doctors = await Doctor.insertMany(
    doctorsData.map(d => ({
      companyId: C,
      pharmacyId: pharmacies[d.pharmacyIdx]._id,
      name: d.name,
      specialization: d.specialization,
      phone: d.phone,
      createdBy: admin._id
    }))
  );
  console.log(`Created ${doctors.length} doctors`);

  // ─── Doctor Activity ───
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 4, 0);

  const activityRecords = doctors.map((doc, i) => {
    const invested = [50000, 100000, 75000, 80000, 60000, 120000, 45000, 90000][i];
    const commitment = invested * 3;
    const achieved = Math.floor(commitment * (0.3 + Math.random() * 0.5));
    return {
      companyId: C,
      doctorId: doc._id,
      medicalRepId: i % 2 === 0 ? rep1._id : rep2._id,
      investedAmount: invested,
      commitmentAmount: commitment,
      achievedSales: achieved,
      startDate: periodStart,
      endDate: periodEnd,
      status: achieved >= commitment ? 'COMPLETED' : 'ACTIVE',
      createdBy: admin._id
    };
  });

  await DoctorActivity.insertMany(activityRecords);
  console.log(`Created ${activityRecords.length} doctor activity records`);

  // ─── Med Rep Targets ───
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevMonth = now.getMonth() === 0
    ? `${now.getFullYear() - 1}-12`
    : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

  const targetsData = [
    { medicalRepId: rep1._id, month: currentMonth, salesTarget: 500000, packsTarget: 200, achievedSales: 185000, achievedPacks: 72 },
    { medicalRepId: rep1._id, month: prevMonth,    salesTarget: 400000, packsTarget: 180, achievedSales: 375000, achievedPacks: 165 },
    { medicalRepId: rep2._id, month: currentMonth, salesTarget: 450000, packsTarget: 190, achievedSales: 210000, achievedPacks: 88 },
    { medicalRepId: rep2._id, month: prevMonth,    salesTarget: 420000, packsTarget: 170, achievedSales: 410000, achievedPacks: 168 }
  ];

  await MedRepTarget.insertMany(targetsData.map(t => ({ companyId: C, createdBy: admin._id, ...t })));
  console.log('Created med rep targets');

  // ─── Weekly Plans ───
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  await WeeklyPlan.insertMany([
    {
      companyId: C, medicalRepId: rep1._id,
      weekStartDate: weekStart, weekEndDate: weekEnd,
      doctorVisits: [
        { entityId: doctors[0]._id, planned: true, completed: true, notes: 'Discussed new Amoxicillin stock' },
        { entityId: doctors[1]._id, planned: true, completed: false },
        { entityId: doctors[3]._id, planned: true, completed: true }
      ],
      distributorVisits: [
        { entityId: distributors[0]._id, planned: true, completed: true }
      ],
      status: 'SUBMITTED',
      createdBy: rep1._id
    },
    {
      companyId: C, medicalRepId: rep2._id,
      weekStartDate: weekStart, weekEndDate: weekEnd,
      doctorVisits: [
        { entityId: doctors[4]._id, planned: true, completed: true },
        { entityId: doctors[6]._id, planned: true, completed: false },
        { entityId: doctors[7]._id, planned: true, completed: true }
      ],
      distributorVisits: [
        { entityId: distributors[1]._id, planned: true, completed: true },
        { entityId: distributors[2]._id, planned: true, completed: false }
      ],
      status: 'SUBMITTED',
      createdBy: rep2._id
    }
  ]);
  console.log('Created weekly plans');

  // ─── Orders ───
  // We'll create 10 orders and manually handle delivery / return for some
  const orderDefs = [
    // DELIVERED orders
    { pharmacy: 0, doctor: 0, distributor: 0, rep: rep1, items: [{ p: 0, qty: 50 }, { p: 1, qty: 30 }],  status: 'DELIVERED', daysAgo: 20 },
    { pharmacy: 1, doctor: 2, distributor: 2, rep: rep1, items: [{ p: 2, qty: 40 }, { p: 3, qty: 25 }],  status: 'DELIVERED', daysAgo: 15 },
    { pharmacy: 2, doctor: 3, distributor: 1, rep: rep2, items: [{ p: 4, qty: 60 }, { p: 5, qty: 35 }],  status: 'DELIVERED', daysAgo: 10 },
    // PARTIALLY_DELIVERED
    { pharmacy: 3, doctor: 5, distributor: 0, rep: rep2, items: [{ p: 0, qty: 80 }, { p: 6, qty: 45 }],  status: 'PARTIALLY_DELIVERED', daysAgo: 5 },
    // PARTIALLY_RETURNED (was delivered, then partial return)
    { pharmacy: 4, doctor: 6, distributor: 2, rep: rep1, items: [{ p: 7, qty: 30 }, { p: 1, qty: 20 }],  status: 'PARTIALLY_RETURNED', daysAgo: 18 },
    // PENDING orders
    { pharmacy: 0, doctor: 1, distributor: 0, rep: rep1, items: [{ p: 2, qty: 35 }, { p: 5, qty: 20 }],  status: 'PENDING', daysAgo: 2 },
    { pharmacy: 5, doctor: 7, distributor: 1, rep: rep2, items: [{ p: 3, qty: 50 }, { p: 4, qty: 40 }],  status: 'PENDING', daysAgo: 1 },
    { pharmacy: 1, doctor: 2, distributor: 2, rep: rep2, items: [{ p: 6, qty: 60 }, { p: 7, qty: 25 }],  status: 'PENDING', daysAgo: 0 },
    // Another DELIVERED
    { pharmacy: 2, doctor: 4, distributor: 1, rep: rep1, items: [{ p: 0, qty: 25 }, { p: 3, qty: 30 }, { p: 5, qty: 15 }], status: 'DELIVERED', daysAgo: 8 },
    // CANCELLED
    { pharmacy: 4, doctor: 6, distributor: 2, rep: rep2, items: [{ p: 1, qty: 40 }], status: 'CANCELLED', daysAgo: 12 }
  ];

  const createdOrders = [];
  let invoiceSeq = 1;

  for (const def of orderDefs) {
    const dist = distributors[def.distributor];
    const orderItems = def.items.map(it => {
      const prod = products[it.p];
      return {
        productId: prod._id,
        productName: prod.name,
        quantity: it.qty,
        deliveredQty: 0,
        returnedQty: 0,
        tpAtTime: prod.tp,
        castingAtTime: prod.casting,
        distributorDiscount: dist.discountOnTP,
        clinicDiscount: 2
      };
    });

    const totalOrdered = orderItems.reduce((s, i) => {
      const sellingPrice = roundPKR(i.tpAtTime * (1 - i.distributorDiscount / 100) * (1 - i.clinicDiscount / 100));
      return s + roundPKR(sellingPrice * i.quantity);
    }, 0);

    const orderDate = new Date(Date.now() - def.daysAgo * 86400000);
    const orderNumber = await generateOrderNumber(Order, C, 'ORD');

    const order = await Order.create({
      companyId: C,
      orderNumber,
      pharmacyId: pharmacies[def.pharmacy]._id,
      doctorId: doctors[def.doctor]._id,
      distributorId: dist._id,
      medicalRepId: def.rep._id,
      items: orderItems,
      status: 'PENDING',
      totalOrderedAmount: totalOrdered,
      createdAt: orderDate,
      updatedAt: orderDate,
      createdBy: def.rep._id
    });

    createdOrders.push({ order, def });
  }

  console.log(`Created ${createdOrders.length} orders`);

  // ─── Process deliveries / returns ───
  for (const { order, def } of createdOrders) {
    const dist = distributors[def.distributor];

    if (['DELIVERED', 'PARTIALLY_DELIVERED', 'PARTIALLY_RETURNED'].includes(def.status)) {
      const deliverItems = [];
      let totalAmount = 0, totalCost = 0, totalProfit = 0;

      for (let i = 0; i < order.items.length; i++) {
        const item = order.items[i];
        const prod = products[def.items[i].p];

        let deliverQty;
        if (def.status === 'PARTIALLY_DELIVERED') {
          deliverQty = Math.ceil(item.quantity * 0.6);
        } else {
          deliverQty = item.quantity;
        }

        const inv = await DistributorInventory.findOne({
          companyId: C, distributorId: dist._id, productId: prod._id
        });
        const avgCost = inv ? inv.avgCostPerUnit : roundPKR(prod.casting + 5);
        const sellingPrice = roundPKR(item.tpAtTime * (1 - item.distributorDiscount / 100) * (1 - item.clinicDiscount / 100));
        const profitPU = roundPKR(sellingPrice - avgCost);

        deliverItems.push({
          productId: prod._id,
          quantity: deliverQty,
          avgCostAtTime: avgCost,
          finalSellingPrice: sellingPrice,
          profitPerUnit: profitPU,
          totalProfit: roundPKR(profitPU * deliverQty)
        });

        totalAmount += roundPKR(sellingPrice * deliverQty);
        totalCost += roundPKR(avgCost * deliverQty);
        totalProfit += roundPKR(profitPU * deliverQty);

        item.deliveredQty = deliverQty;

        if (inv) {
          inv.quantity = Math.max(0, inv.quantity - deliverQty);
          inv.lastUpdated = new Date();
          await inv.save();
        }
      }

      const invNum = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(invoiceSeq++).padStart(3, '0')}`;
      const deliveryDate = new Date(order.createdAt.getTime() + 86400000);

      await DeliveryRecord.create({
        companyId: C, orderId: order._id, invoiceNumber: invNum,
        items: deliverItems,
        totalAmount: roundPKR(totalAmount), totalCost: roundPKR(totalCost), totalProfit: roundPKR(totalProfit),
        deliveredBy: admin._id, deliveredAt: deliveryDate,
        createdBy: admin._id
      });

      await Ledger.create({
        companyId: C, entityType: 'PHARMACY', entityId: pharmacies[def.pharmacy]._id,
        type: 'DEBIT', amount: roundPKR(totalAmount),
        referenceType: 'ORDER', referenceId: order._id,
        description: `Delivery for order ${order.orderNumber}`,
        date: deliveryDate,
        createdBy: admin._id
      });

      await Transaction.create({
        companyId: C, type: 'SALE', referenceType: 'DeliveryRecord', referenceId: order._id,
        revenue: roundPKR(totalAmount), cost: roundPKR(totalCost), profit: roundPKR(totalProfit),
        date: deliveryDate, description: `Sale - ${order.orderNumber}`,
        createdBy: admin._id
      });

      const allDelivered = order.items.every(it => it.deliveredQty >= it.quantity);
      order.status = allDelivered ? 'DELIVERED' : 'PARTIALLY_DELIVERED';
      await order.save();
    }

    if (def.status === 'PARTIALLY_RETURNED') {
      const returnItems = [];
      let totalRetAmt = 0, totalRetCost = 0, totalRetProfit = 0;

      const firstItem = order.items[0];
      const prod = products[def.items[0].p];
      const returnQty = Math.ceil(firstItem.deliveredQty * 0.3);

      const inv = await DistributorInventory.findOne({
        companyId: C, distributorId: dist._id, productId: prod._id
      });
      const avgCost = inv ? inv.avgCostPerUnit : roundPKR(prod.casting + 5);
      const sellingPrice = roundPKR(firstItem.tpAtTime * (1 - firstItem.distributorDiscount / 100) * (1 - firstItem.clinicDiscount / 100));
      const profitPU = roundPKR(sellingPrice - avgCost);

      returnItems.push({
        productId: prod._id,
        quantity: returnQty,
        avgCostAtTime: avgCost,
        finalSellingPrice: sellingPrice,
        profitPerUnit: profitPU,
        totalProfit: roundPKR(profitPU * returnQty * -1),
        reason: 'Near expiry'
      });

      totalRetAmt = roundPKR(sellingPrice * returnQty);
      totalRetCost = roundPKR(avgCost * returnQty);
      totalRetProfit = roundPKR(profitPU * returnQty * -1);

      firstItem.returnedQty = returnQty;

      if (inv) {
        inv.quantity += returnQty;
        inv.lastUpdated = new Date();
        await inv.save();
      }

      const returnDate = new Date(order.createdAt.getTime() + 5 * 86400000);

      await ReturnRecord.create({
        companyId: C, orderId: order._id,
        items: returnItems,
        totalAmount: roundPKR(totalRetAmt), totalCost: roundPKR(totalRetCost), totalProfit: roundPKR(totalRetProfit),
        returnedBy: admin._id, returnedAt: returnDate,
        createdBy: admin._id
      });

      await Ledger.create({
        companyId: C, entityType: 'PHARMACY', entityId: pharmacies[def.pharmacy]._id,
        type: 'CREDIT', amount: roundPKR(totalRetAmt),
        referenceType: 'RETURN', referenceId: order._id,
        description: `Return for order ${order.orderNumber}`,
        date: returnDate,
        createdBy: admin._id
      });

      await Transaction.create({
        companyId: C, type: 'RETURN', referenceType: 'ReturnRecord', referenceId: order._id,
        revenue: roundPKR(totalRetAmt * -1), cost: roundPKR(totalRetCost * -1), profit: roundPKR(totalRetProfit),
        date: returnDate, description: `Return - ${order.orderNumber}`,
        createdBy: admin._id
      });

      order.status = 'PARTIALLY_RETURNED';
      await order.save();
    }

    if (def.status === 'CANCELLED') {
      order.status = 'CANCELLED';
      await order.save();
    }
  }

  console.log('Processed deliveries and returns');

  // ─── Payments ───
  const paymentDefs = [
    { pharmacy: 0, amount: 15000, method: 'CASH',          ref: null,          daysAgo: 18, collector: rep1 },
    { pharmacy: 0, amount: 5000,  method: 'BANK_TRANSFER', ref: 'TXN-887766', daysAgo: 10, collector: rep1 },
    { pharmacy: 1, amount: 20000, method: 'CHEQUE',        ref: 'CHQ-4455',   daysAgo: 12, collector: rep1 },
    { pharmacy: 2, amount: 12000, method: 'CASH',          ref: null,          daysAgo: 8,  collector: rep2 },
    { pharmacy: 3, amount: 8000,  method: 'BANK_TRANSFER', ref: 'TXN-991122', daysAgo: 3,  collector: rep2 },
    { pharmacy: 4, amount: 10000, method: 'CASH',          ref: null,          daysAgo: 14, collector: rep1 }
  ];

  for (const pd of paymentDefs) {
    const payDate = new Date(Date.now() - pd.daysAgo * 86400000);
    const payment = await Payment.create({
      companyId: C,
      pharmacyId: pharmacies[pd.pharmacy]._id,
      amount: pd.amount,
      paymentMethod: pd.method,
      referenceNumber: pd.ref,
      collectedBy: pd.collector._id,
      date: payDate,
      createdBy: pd.collector._id
    });

    await Ledger.create({
      companyId: C, entityType: 'PHARMACY', entityId: pharmacies[pd.pharmacy]._id,
      type: 'CREDIT', amount: pd.amount,
      referenceType: 'PAYMENT', referenceId: payment._id,
      description: `Payment received - ${pd.method}`,
      date: payDate,
      createdBy: admin._id
    });
  }

  console.log(`Created ${paymentDefs.length} payments with ledger entries`);

  // ─── Expenses ───
  const expenseDefs = [
    { category: 'DOCTOR_INVESTMENT', amount: 50000, description: 'Investment in Dr. Usman Tariq clinic', daysAgo: 25, doctorId: doctors[0]._id },
    { category: 'DOCTOR_INVESTMENT', amount: 30000, description: 'Investment in Dr. Ayesha Khan clinic', daysAgo: 20, doctorId: doctors[3]._id },
    { category: 'LOGISTICS',         amount: 15000, description: 'Delivery truck fuel and maintenance',  daysAgo: 15 },
    { category: 'LOGISTICS',         amount: 8000,  description: 'Courier charges for Lahore shipment',  daysAgo: 10 },
    { category: 'RENT',              amount: 45000, description: 'Office rent - April 2026',              daysAgo: 5 },
    { category: 'OFFICE',            amount: 12000, description: 'Office supplies and internet',          daysAgo: 3 },
    { category: 'OTHER',             amount: 7500,  description: 'Regulatory compliance fees',            daysAgo: 7 }
  ];

  for (const exp of expenseDefs) {
    const expDate = new Date(Date.now() - exp.daysAgo * 86400000);
    const expense = await Expense.create({
      companyId: C,
      category: exp.category,
      amount: exp.amount,
      description: exp.description,
      date: expDate,
      doctorId: exp.doctorId || undefined,
      approvedBy: admin._id,
      createdBy: admin._id
    });

    await Transaction.create({
      companyId: C, type: 'EXPENSE', referenceType: 'Expense', referenceId: expense._id,
      revenue: 0, cost: exp.amount, profit: roundPKR(-exp.amount),
      date: expDate, description: exp.description,
      createdBy: admin._id
    });
  }

  console.log(`Created ${expenseDefs.length} expenses with transaction entries`);

  // ─── Payroll ───
  const payrollMonth = prevMonth;
  const payrollDefs = [
    { employee: rep1, baseSalary: 75000, bonus: 10000, deductions: 2500 },
    { employee: rep2, baseSalary: 70000, bonus: 8000,  deductions: 2000 }
  ];

  for (const pr of payrollDefs) {
    const netSalary = pr.baseSalary + pr.bonus - pr.deductions;
    const payroll = await Payroll.create({
      companyId: C,
      employeeId: pr.employee._id,
      month: payrollMonth,
      baseSalary: pr.baseSalary,
      bonus: pr.bonus,
      deductions: pr.deductions,
      netSalary,
      status: 'PAID',
      paidOn: new Date(Date.now() - 5 * 86400000),
      createdBy: admin._id
    });

    const salaryExpense = await Expense.create({
      companyId: C,
      category: 'SALARY',
      amount: netSalary,
      description: `Salary - ${pr.employee.name} - ${payrollMonth}`,
      date: payroll.paidOn,
      employeeId: pr.employee._id,
      approvedBy: admin._id,
      createdBy: admin._id
    });

    await Transaction.create({
      companyId: C, type: 'EXPENSE', referenceType: 'Expense', referenceId: salaryExpense._id,
      revenue: 0, cost: netSalary, profit: roundPKR(-netSalary),
      date: payroll.paidOn, description: `Salary - ${pr.employee.name}`,
      createdBy: admin._id
    });
  }

  // Also create current month payroll as PENDING
  for (const pr of payrollDefs) {
    const netSalary = pr.baseSalary + pr.bonus - pr.deductions;
    await Payroll.create({
      companyId: C,
      employeeId: pr.employee._id,
      month: currentMonth,
      baseSalary: pr.baseSalary,
      bonus: pr.bonus,
      deductions: pr.deductions,
      netSalary,
      status: 'PENDING',
      createdBy: admin._id
    });
  }

  console.log('Created payroll records');

  // ─── Audit Log ───
  const auditEntries = [
    { userId: admin._id, action: 'CREATE', entityType: 'User', entityId: rep1._id, changes: { name: 'Ahmed Raza', role: 'MEDICAL_REP' } },
    { userId: admin._id, action: 'CREATE', entityType: 'User', entityId: rep2._id, changes: { name: 'Sara Malik', role: 'MEDICAL_REP' } },
    { userId: admin._id, action: 'STOCK_TRANSFER', entityType: 'Distributor', entityId: distributors[0]._id, changes: { items: '8 products transferred' } },
    { userId: rep1._id,  action: 'CREATE', entityType: 'Order', entityId: createdOrders[0].order._id, changes: { orderNumber: createdOrders[0].order.orderNumber } },
    { userId: admin._id, action: 'DELIVER', entityType: 'Order', entityId: createdOrders[0].order._id, changes: { status: 'DELIVERED' } },
    { userId: rep2._id,  action: 'CREATE', entityType: 'Order', entityId: createdOrders[2].order._id, changes: { orderNumber: createdOrders[2].order.orderNumber } },
    { userId: admin._id, action: 'DELIVER', entityType: 'Order', entityId: createdOrders[2].order._id, changes: { status: 'DELIVERED' } },
    { userId: rep1._id,  action: 'PAYMENT', entityType: 'Pharmacy', entityId: pharmacies[0]._id, changes: { amount: 15000, method: 'CASH' } }
  ];

  await AuditLog.insertMany(
    auditEntries.map((e, i) => ({
      companyId: C,
      ...e,
      timestamp: new Date(Date.now() - (auditEntries.length - i) * 3600000)
    }))
  );
  console.log('Created audit log entries');

  // ─── Summary ───
  console.log('\n════════════════════════════════════════════');
  console.log('  SEED COMPLETE');
  console.log('════════════════════════════════════════════');
  console.log(`  Company:       ${company.name}`);
  console.log(`  Products:      ${products.length}`);
  console.log(`  Distributors:  ${distributors.length}`);
  console.log(`  Pharmacies:    ${pharmacies.length}`);
  console.log(`  Doctors:       ${doctors.length}`);
  console.log(`  Orders:        ${createdOrders.length}`);
  console.log(`  Users:         3`);
  console.log('');
  console.log('  Login Credentials:');
  console.log('  ──────────────────');
  console.log('  Admin:     admin@pharmaplus.pk  /  Admin@123');
  console.log('  Med Rep 1: ahmed@pharmaplus.pk  /  Rep@1234');
  console.log('  Med Rep 2: sara@pharmaplus.pk   /  Rep@1234');
  console.log('════════════════════════════════════════════\n');

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
