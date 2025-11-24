import Decimal from 'decimal.js';

/**
 * Profit Calculation Utilities
 *
 * Calculates profit for individual bookings by matching booking revenue
 * with corresponding expenses from the ExpenseTracker
 */

/**
 * Calculate profit for a single booking
 * @param {Object} booking - Booking document with pricing information
 * @param {Object} expense - Matching expense document (optional)
 * @returns {Object} Profit breakdown
 */
export const calculateBookingProfit = (booking, expense = null) => {
  try {
    // Revenue from booking
    const revenue = new Decimal(booking?.pricing?.agreedPrice || booking?.pricing?.finalPrice || 0);

    // If no expense found, we can't calculate full profit
    if (!expense) {
      return {
        revenue: revenue.toNumber(),
        expenses: 0,
        ownerPayments: 0,
        grossProfit: revenue.toNumber(),
        netProfit: revenue.toNumber(),
        profitMargin: 100,
        hasExpenseData: false,
        error: null
      };
    }

    // Calculate total expenses
    const suma1 = new Decimal(expense.suma1 || 0);
    const suma2 = new Decimal(expense.suma2 || 0);
    const sumaIntegral = new Decimal(expense.sumaIntegral || 0);
    const skipperCost = new Decimal(expense.skipperCost || 0);
    const transferCost = new Decimal(expense.transferCost || 0);
    const fuelCost = new Decimal(expense.fuelCost || 0);
    const boatExpense = new Decimal(expense.boatExpense || 0);
    const comisioane = new Decimal(expense.comisioane || 0);
    const colaboratori = new Decimal(expense.colaboratori || 0);

    // Total owner payments (what we pay to boat owners)
    const ownerPayments = suma1.plus(suma2).plus(sumaIntegral);

    // Total operational expenses (skipper, transfer, fuel, boat, commissions, collaborators)
    const operationalExpenses = skipperCost
      .plus(transferCost)
      .plus(fuelCost)
      .plus(boatExpense)
      .plus(comisioane)
      .plus(colaboratori);

    // Total expenses
    const totalExpenses = ownerPayments.plus(operationalExpenses);

    // Gross profit (revenue - expenses)
    const grossProfit = revenue.minus(totalExpenses);

    // Net profit (after owner payments)
    const netProfit = revenue.minus(ownerPayments).minus(operationalExpenses);

    // Profit margin percentage
    const profitMargin = revenue.isZero()
      ? new Decimal(0)
      : netProfit.dividedBy(revenue).times(100);

    return {
      revenue: revenue.toNumber(),
      expenses: totalExpenses.toNumber(),
      ownerPayments: ownerPayments.toNumber(),
      operationalExpenses: operationalExpenses.toNumber(),
      grossProfit: grossProfit.toNumber(),
      netProfit: netProfit.toNumber(),
      profitMargin: profitMargin.toNumber(),
      hasExpenseData: true,
      breakdown: {
        suma1: suma1.toNumber(),
        suma2: suma2.toNumber(),
        sumaIntegral: sumaIntegral.toNumber(),
        skipperCost: skipperCost.toNumber(),
        transferCost: transferCost.toNumber(),
        fuelCost: fuelCost.toNumber(),
        boatExpense: boatExpense.toNumber(),
        comisioane: comisioane.toNumber(),
        colaboratori: colaboratori.toNumber()
      },
      error: null
    };
  } catch (error) {
    console.error('Error calculating booking profit:', error);
    return {
      revenue: 0,
      expenses: 0,
      ownerPayments: 0,
      grossProfit: 0,
      netProfit: 0,
      profitMargin: 0,
      hasExpenseData: false,
      error: error.message
    };
  }
};

/**
 * Match a booking with its corresponding expense entry
 * @param {Object} booking - Booking document
 * @param {Array} expenses - Array of all expense documents
 * @returns {Object|null} Matching expense or null
 */
export const findMatchingExpense = (booking, expenses) => {
  if (!booking || !expenses || expenses.length === 0) {
    return null;
  }

  // Try to find by bookingId first (most accurate)
  if (booking.id) {
    const exactMatch = expenses.find(exp => exp.bookingId === booking.id);
    if (exactMatch) return exactMatch;
  }

  // Try to match by date and boat name
  const bookingDate = booking.bookingDetails?.date;
  const boatName = booking.bookingDetails?.boatName;

  if (bookingDate && boatName) {
    const dateMatch = expenses.find(exp => {
      const expenseDate = exp.data || exp.dataCompanie;
      const expenseBoat = exp.numeleBarci;

      return expenseDate === bookingDate &&
             expenseBoat?.toLowerCase() === boatName?.toLowerCase();
    });

    if (dateMatch) return dateMatch;
  }

  return null;
};

/**
 * Calculate aggregated profit for multiple bookings
 * @param {Array} bookingsWithExpenses - Array of {booking, expense} objects
 * @returns {Object} Aggregated profit metrics
 */
export const calculateAggregatedProfit = (bookingsWithExpenses) => {
  if (!Array.isArray(bookingsWithExpenses) || bookingsWithExpenses.length === 0) {
    return {
      totalRevenue: 0,
      totalExpenses: 0,
      totalOwnerPayments: 0,
      totalOperationalExpenses: 0,
      totalGrossProfit: 0,
      totalNetProfit: 0,
      averageProfitMargin: 0,
      bookingCount: 0,
      bookingsWithExpenses: 0,
      bookingsWithoutExpenses: 0
    };
  }

  let totalRevenue = new Decimal(0);
  let totalExpenses = new Decimal(0);
  let totalOwnerPayments = new Decimal(0);
  let totalOperationalExpenses = new Decimal(0);
  let countWithExpenses = 0;
  let totalMargin = new Decimal(0);

  bookingsWithExpenses.forEach(({ booking, expense }) => {
    const profit = calculateBookingProfit(booking, expense);

    totalRevenue = totalRevenue.plus(profit.revenue);
    totalExpenses = totalExpenses.plus(profit.expenses);
    totalOwnerPayments = totalOwnerPayments.plus(profit.ownerPayments);
    totalOperationalExpenses = totalOperationalExpenses.plus(profit.operationalExpenses || 0);

    if (profit.hasExpenseData) {
      countWithExpenses++;
      totalMargin = totalMargin.plus(profit.profitMargin);
    }
  });

  const totalGrossProfit = totalRevenue.minus(totalExpenses);
  const totalNetProfit = totalRevenue.minus(totalOwnerPayments).minus(totalOperationalExpenses);
  const averageProfitMargin = countWithExpenses > 0
    ? totalMargin.dividedBy(countWithExpenses)
    : new Decimal(0);

  return {
    totalRevenue: totalRevenue.toNumber(),
    totalExpenses: totalExpenses.toNumber(),
    totalOwnerPayments: totalOwnerPayments.toNumber(),
    totalOperationalExpenses: totalOperationalExpenses.toNumber(),
    totalGrossProfit: totalGrossProfit.toNumber(),
    totalNetProfit: totalNetProfit.toNumber(),
    averageProfitMargin: averageProfitMargin.toNumber(),
    bookingCount: bookingsWithExpenses.length,
    bookingsWithExpenses: countWithExpenses,
    bookingsWithoutExpenses: bookingsWithExpenses.length - countWithExpenses
  };
};

/**
 * Format currency for display
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: EUR)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currency = 'EUR') => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Get profit status color based on profit margin
 * @param {number} profitMargin - Profit margin percentage
 * @returns {string} Tailwind color class
 */
export const getProfitStatusColor = (profitMargin) => {
  if (profitMargin >= 30) return 'text-green-600';
  if (profitMargin >= 15) return 'text-blue-600';
  if (profitMargin >= 5) return 'text-yellow-600';
  if (profitMargin >= 0) return 'text-orange-600';
  return 'text-red-600';
};

/**
 * Get profit status badge
 * @param {number} profitMargin - Profit margin percentage
 * @returns {Object} Badge configuration
 */
export const getProfitBadge = (profitMargin) => {
  if (profitMargin >= 30) {
    return { label: 'Excellent', color: 'bg-green-100 text-green-800' };
  }
  if (profitMargin >= 15) {
    return { label: 'Good', color: 'bg-blue-100 text-blue-800' };
  }
  if (profitMargin >= 5) {
    return { label: 'Fair', color: 'bg-yellow-100 text-yellow-800' };
  }
  if (profitMargin >= 0) {
    return { label: 'Low', color: 'bg-orange-100 text-orange-800' };
  }
  return { label: 'Loss', color: 'bg-red-100 text-red-800' };
};
