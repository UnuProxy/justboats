import {
  calculateBookingProfit,
  findMatchingExpense,
  calculateAggregatedProfit,
  formatCurrency,
  getProfitStatusColor,
  getProfitBadge
} from './profitCalculations';

describe('profitCalculations', () => {
  describe('calculateBookingProfit', () => {
    it('should calculate profit correctly with expense data', () => {
      const booking = {
        pricing: {
          agreedPrice: 1000
        }
      };

      const expense = {
        suma1: 400,
        suma2: 200,
        sumaIntegral: 0,
        skipperCost: 50,
        transferCost: 30,
        fuelCost: 20,
        boatExpense: 10,
        comisioane: 40,
        colaboratori: 50
      };

      const result = calculateBookingProfit(booking, expense);

      expect(result.revenue).toBe(1000);
      expect(result.ownerPayments).toBe(600); // 400 + 200
      expect(result.operationalExpenses).toBe(200); // 50 + 30 + 20 + 10 + 40 + 50
      expect(result.expenses).toBe(800); // 600 + 200
      expect(result.netProfit).toBe(200); // 1000 - 800
      expect(result.profitMargin).toBe(20); // (200 / 1000) * 100
      expect(result.hasExpenseData).toBe(true);
    });

    it('should handle booking without expense data', () => {
      const booking = {
        pricing: {
          agreedPrice: 1000
        }
      };

      const result = calculateBookingProfit(booking, null);

      expect(result.revenue).toBe(1000);
      expect(result.expenses).toBe(0);
      expect(result.netProfit).toBe(1000);
      expect(result.profitMargin).toBe(100);
      expect(result.hasExpenseData).toBe(false);
    });

    it('should handle missing pricing data', () => {
      const booking = {};
      const result = calculateBookingProfit(booking, null);

      expect(result.revenue).toBe(0);
      expect(result.netProfit).toBe(0);
    });

    it('should use finalPrice if agreedPrice is missing', () => {
      const booking = {
        pricing: {
          finalPrice: 1500
        }
      };

      const result = calculateBookingProfit(booking, null);

      expect(result.revenue).toBe(1500);
    });

    it('should handle negative profit scenarios', () => {
      const booking = {
        pricing: {
          agreedPrice: 500
        }
      };

      const expense = {
        suma1: 600, // More than revenue
        suma2: 0,
        skipperCost: 0,
        transferCost: 0,
        fuelCost: 0,
        boatExpense: 0,
        comisioane: 0,
        colaboratori: 0
      };

      const result = calculateBookingProfit(booking, expense);

      expect(result.netProfit).toBe(-100); // 500 - 600
      expect(result.profitMargin).toBe(-20); // (-100 / 500) * 100
    });
  });

  describe('findMatchingExpense', () => {
    const expenses = [
      {
        id: 'exp1',
        bookingId: 'booking123',
        data: '2024-01-15',
        numeleBarci: 'Sunseeker'
      },
      {
        id: 'exp2',
        data: '2024-01-20',
        numeleBarci: 'Princess'
      }
    ];

    it('should find expense by bookingId', () => {
      const booking = {
        id: 'booking123',
        bookingDetails: {
          date: '2024-01-15',
          boatName: 'Sunseeker'
        }
      };

      const result = findMatchingExpense(booking, expenses);

      expect(result).toBeDefined();
      expect(result.id).toBe('exp1');
    });

    it('should find expense by date and boat name', () => {
      const booking = {
        id: 'booking456',
        bookingDetails: {
          date: '2024-01-20',
          boatName: 'Princess'
        }
      };

      const result = findMatchingExpense(booking, expenses);

      expect(result).toBeDefined();
      expect(result.id).toBe('exp2');
    });

    it('should return null if no match found', () => {
      const booking = {
        id: 'booking999',
        bookingDetails: {
          date: '2024-01-25',
          boatName: 'Unknown'
        }
      };

      const result = findMatchingExpense(booking, expenses);

      expect(result).toBeNull();
    });

    it('should handle empty expenses array', () => {
      const booking = { id: 'booking123' };
      const result = findMatchingExpense(booking, []);

      expect(result).toBeNull();
    });

    it('should be case-insensitive for boat name matching', () => {
      const booking = {
        id: 'booking999',
        bookingDetails: {
          date: '2024-01-20',
          boatName: 'PRINCESS' // Uppercase
        }
      };

      const result = findMatchingExpense(booking, expenses);

      expect(result).toBeDefined();
      expect(result.id).toBe('exp2');
    });
  });

  describe('calculateAggregatedProfit', () => {
    it('should aggregate profit across multiple bookings', () => {
      const bookingsWithExpenses = [
        {
          booking: { pricing: { agreedPrice: 1000 } },
          expense: { suma1: 500, suma2: 200, skipperCost: 50, transferCost: 0, fuelCost: 0, boatExpense: 0, comisioane: 0, colaboratori: 0 }
        },
        {
          booking: { pricing: { agreedPrice: 1500 } },
          expense: { suma1: 700, suma2: 300, skipperCost: 100, transferCost: 0, fuelCost: 0, boatExpense: 0, comisioane: 0, colaboratori: 0 }
        }
      ];

      const result = calculateAggregatedProfit(bookingsWithExpenses);

      expect(result.totalRevenue).toBe(2500); // 1000 + 1500
      expect(result.totalOwnerPayments).toBe(1700); // (500+200) + (700+300)
      expect(result.totalOperationalExpenses).toBe(150); // 50 + 100
      expect(result.totalNetProfit).toBe(650); // 2500 - 1700 - 150
      expect(result.bookingCount).toBe(2);
      expect(result.bookingsWithExpenses).toBe(2);
    });

    it('should handle empty array', () => {
      const result = calculateAggregatedProfit([]);

      expect(result.totalRevenue).toBe(0);
      expect(result.totalProfit).toBe(0);
      expect(result.bookingCount).toBe(0);
    });
  });

  describe('formatCurrency', () => {
    it('should format currency in EUR', () => {
      const result = formatCurrency(1234.56);
      expect(result).toMatch(/€1,234\.56|1.234,56 €/); // Handles different locale formats
    });

    it('should handle zero', () => {
      const result = formatCurrency(0);
      expect(result).toMatch(/€0\.00|0,00 €/);
    });

    it('should handle negative values', () => {
      const result = formatCurrency(-500);
      expect(result).toMatch(/-€500\.00|-500,00 €/);
    });
  });

  describe('getProfitStatusColor', () => {
    it('should return green for excellent profit margins', () => {
      expect(getProfitStatusColor(35)).toBe('text-green-600');
      expect(getProfitStatusColor(30)).toBe('text-green-600');
    });

    it('should return blue for good profit margins', () => {
      expect(getProfitStatusColor(20)).toBe('text-blue-600');
      expect(getProfitStatusColor(15)).toBe('text-blue-600');
    });

    it('should return yellow for fair profit margins', () => {
      expect(getProfitStatusColor(10)).toBe('text-yellow-600');
      expect(getProfitStatusColor(5)).toBe('text-yellow-600');
    });

    it('should return orange for low profit margins', () => {
      expect(getProfitStatusColor(3)).toBe('text-orange-600');
      expect(getProfitStatusColor(0)).toBe('text-orange-600');
    });

    it('should return red for losses', () => {
      expect(getProfitStatusColor(-5)).toBe('text-red-600');
      expect(getProfitStatusColor(-20)).toBe('text-red-600');
    });
  });

  describe('getProfitBadge', () => {
    it('should return correct badge for excellent profit', () => {
      const badge = getProfitBadge(35);
      expect(badge.label).toBe('Excellent');
      expect(badge.color).toBe('bg-green-100 text-green-800');
    });

    it('should return correct badge for good profit', () => {
      const badge = getProfitBadge(20);
      expect(badge.label).toBe('Good');
      expect(badge.color).toBe('bg-blue-100 text-blue-800');
    });

    it('should return correct badge for fair profit', () => {
      const badge = getProfitBadge(10);
      expect(badge.label).toBe('Fair');
      expect(badge.color).toBe('bg-yellow-100 text-yellow-800');
    });

    it('should return correct badge for low profit', () => {
      const badge = getProfitBadge(2);
      expect(badge.label).toBe('Low');
      expect(badge.color).toBe('bg-orange-100 text-orange-800');
    });

    it('should return correct badge for loss', () => {
      const badge = getProfitBadge(-10);
      expect(badge.label).toBe('Loss');
      expect(badge.color).toBe('bg-red-100 text-red-800');
    });
  });
});
