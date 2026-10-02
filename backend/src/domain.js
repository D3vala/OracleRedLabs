"use strict";

const ENGAGEMENT_TRANSITIONS = Object.freeze({
  pending: Object.freeze(["scoping", "cancelled"]),
  scoping: Object.freeze(["active", "cancelled"]),
  active: Object.freeze(["completed", "cancelled"]),
  completed: Object.freeze([]),
  cancelled: Object.freeze([]),
});

const INVOICE_TRANSITIONS = Object.freeze({
  not_issued: Object.freeze(["outstanding", "cancelled"]),
  outstanding: Object.freeze(["paid", "cancelled"]),
  paid: Object.freeze([]),
  cancelled: Object.freeze([]),
});

function canTransition(matrix, from, to, allowSame = false) {
  if (allowSame && from === to) return true;
  return Boolean(matrix[from]?.includes(to));
}

module.exports = {
  ENGAGEMENT_TRANSITIONS,
  INVOICE_TRANSITIONS,
  canTransition,
};
