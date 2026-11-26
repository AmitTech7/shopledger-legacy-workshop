'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('invoice preserves the HSN slab used for the billed order', function () {
  var items = [{ id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var storedOrder = {
    id: 1001, date: '2026-01-01', customer: 'Customer', items: items,
    coupon: '', subtotal: billed.subtotal, discount: billed.discount,
    tax: billed.tax, total: billed.total
  };
  var invoiced = invoice.computeInvoiceFigures(storedOrder);

  assert.deepEqual(
    { tax: invoiced.tax, total: invoiced.total, cgst: invoiced.cgst, sgst: invoiced.sgst },
    { tax: billed.tax, total: billed.total, cgst: billed.cgst, sgst: billed.sgst }
  );
  assert.equal(invoiced.rows[0].gstPercent, 5);
});

test('invoice applies the billed coupon discount and taxable adjustment', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 600, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var storedOrder = {
    id: 1002, date: '2026-01-01', items: items, coupon: 'SAVE10',
    subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total
  };
  var invoiced = invoice.computeInvoiceFigures(storedOrder);

  assert.deepEqual(
    { discount: invoiced.discount, tax: invoiced.tax, total: invoiced.total },
    { discount: billed.discount, tax: billed.tax, total: billed.total }
  );
});

test('reconciliation matches invoice and ledger totals from in-memory orders', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var result = reports.getGstReconciliation({
    orders: [{ id: 1003, date: '2026-01-01', items: items, subtotal: billed.subtotal,
      discount: billed.discount, tax: billed.tax, total: billed.total }]
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(
    { ledgerTax: result.rows[0].ledgerTax, invoiceTax: result.rows[0].invoiceTax,
      ledgerTotal: result.rows[0].ledgerTotal, invoiceTotal: result.rows[0].invoiceTotal,
      delta: result.rows[0].delta, matched: result.rows[0].matched },
    { ledgerTax: 5, invoiceTax: 5, ledgerTotal: 105, invoiceTotal: 105, delta: 0, matched: true }
  );
});

test('rendered invoice shows correct GST and no ledger mismatch notice', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var html = invoice.render({ id: 1004, date: '2026-01-01', items: items, coupon: '', total: 105 });

  assert.match(html, /CGST \+ SGST \(Total GST\)/);
  assert.match(html, /5%/);
  assert.doesNotMatch(html, /Invoice computed total/);
  assert.match(html, /105\.00/);
  assert.doesNotMatch(html, /118\.00/);
});
