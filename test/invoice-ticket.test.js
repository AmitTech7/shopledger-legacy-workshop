'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('invoice uses the billed GST slab and coupon calculation', function () {
  var items = [{ id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 600, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var order = {
    id: 1001, date: '2026-01-01', customer: 'Customer', items: items,
    coupon: 'SAVE10', subtotal: billed.subtotal, discount: billed.discount,
    tax: billed.tax, total: billed.total
  };
  var invoiced = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: invoiced.subtotal, discount: invoiced.discount, tax: invoiced.tax,
      total: invoiced.total, gstPercent: invoiced.rows[0].gstPercent,
      lineTax: invoiced.rows[0].lineTax },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax,
      total: billed.total, gstPercent: 5, lineTax: 27 }
  );
});

test('invoice rendering and reconciliation agree with the billed order', function () {
  var items = [{ id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var order = {
    id: 1002, date: '2026-01-01', items: items, coupon: '',
    subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total
  };
  var html = invoice.render(order);
  var reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /5%/);
  assert.match(html, /105\.00/);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});
