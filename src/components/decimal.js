import { Decimal } from 'decimal.js';

class PrecisionFinancialUtils {
  static normalizeAmount(amount, precision = 8) {
    if (amount === null || amount === undefined || amount === '') {
      return new Decimal(0);
    }
    
    if (typeof amount === 'number') {
      if (isNaN(amount) || !isFinite(amount)) {
        return new Decimal(0);
      }
      return new Decimal(amount);
    }
    
    if (amount instanceof Decimal) {
      return amount;
    }
    
    if (typeof amount === 'string') {
      let cleanedAmount = amount.replace(/[^0-9.,\-]/g, '');
      
      const lastDotIndex = cleanedAmount.lastIndexOf('.');
      const lastCommaIndex = cleanedAmount.lastIndexOf(',');
      
      if (lastDotIndex > -1 && lastCommaIndex > -1) {
        if (lastDotIndex > lastCommaIndex) {
          cleanedAmount = cleanedAmount.replace(/,/g, '');
        } else {
          cleanedAmount = cleanedAmount.replace(/\./g, '').replace(',', '.');
        }
      } else if (lastCommaIndex > -1 && (lastCommaIndex > cleanedAmount.length - 4)) {
        cleanedAmount = cleanedAmount.replace(',', '.');
      }
      
      try {
        return new Decimal(cleanedAmount);
      } catch (e) {
        console.warn(`Failed to parse amount: ${amount}`, e);
        return new Decimal(0);
      }
    }
    
    return new Decimal(0);
  }
  
  static toNumber(amount, decimalPlaces = 2) {
    const decimal = amount instanceof Decimal ? amount : this.normalizeAmount(amount);
    return decimal.toDecimalPlaces(decimalPlaces).toNumber();
  }
  
  static formatCurrency(amount, locale = 'en-US', currency = 'EUR', decimalPlaces = 2) {
    const decimal = amount instanceof Decimal ? amount : this.normalizeAmount(amount);
    const value = decimal.toDecimalPlaces(decimalPlaces).toNumber();
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces
    }).format(value);
  }
  
  static sum(...amounts) {
    let total = new Decimal(0);
    for (const amount of amounts) {
      total = total.plus(this.normalizeAmount(amount));
    }
    return total;
  }
  
  static subtract(a, b) {
    return this.normalizeAmount(a).minus(this.normalizeAmount(b));
  }
  
  static multiply(a, b) {
    return this.normalizeAmount(a).times(this.normalizeAmount(b));
  }
  
  static divide(a, b, decimalPlaces = 8) {
    const divisor = this.normalizeAmount(b);
    
    if (divisor.isZero()) {
      console.warn('Division by zero attempted', { a, b });
      return new Decimal(0);
    }
    
    return this.normalizeAmount(a).dividedBy(divisor).toDecimalPlaces(decimalPlaces);
  }
  
  static percentage(value, total, decimalPlaces = 2) {
    const totalDecimal = this.normalizeAmount(total);
    
    if (totalDecimal.isZero()) {
      return new Decimal(0);
    }
    
    return this.normalizeAmount(value)
      .dividedBy(totalDecimal)
      .times(100)
      .toDecimalPlaces(decimalPlaces);
  }
  
  static calculatePercentChange(current, previous, decimalPlaces = 1) {
    const currentDecimal = this.normalizeAmount(current);
    const previousDecimal = this.normalizeAmount(previous);
    
    if (previousDecimal.isZero() || previousDecimal.abs().lessThan('0.00001')) {
      return { 
        value: new Decimal(0), 
        rawValue: 0,
        isIncrease: false, 
        displayValue: "0%" 
      };
    }
    
    const change = currentDecimal
      .minus(previousDecimal)
      .dividedBy(previousDecimal.abs())
      .times(100);
    
    const formattedChange = change.abs().toDecimalPlaces(decimalPlaces);
    
    return {
      value: formattedChange, 
      rawValue: formattedChange.toNumber(),
      isIncrease: change.greaterThanOrEqualTo(0),
      displayValue: `${formattedChange.toFixed(decimalPlaces)}%`
    };
  }
  
  static extractBookingPayments(booking) {
    const result = {
      totalAgreedPrice: new Decimal(0),
      totalPaid: new Decimal(0),
      totalOutstanding: new Decimal(0),
      receivedPayments: [],
      pendingPayments: []
    };
    
    if (!booking || (!booking.pricing && !booking.payments)) {
      return {
        totalAgreedPrice: result.totalAgreedPrice,
        totalAgreedPriceNumber: 0,
        totalPaid: result.totalPaid,
        totalPaidNumber: 0,
        totalOutstanding: result.totalOutstanding,
        totalOutstandingNumber: 0,
        receivedPayments: result.receivedPayments,
        pendingPayments: result.pendingPayments
      };
    }
    
    if (booking.pricing && booking.pricing.agreedPrice !== undefined) {
      result.totalAgreedPrice = this.normalizeAmount(booking.pricing.agreedPrice);
    }
    
    let paymentsArray = [];
    
    if (booking.pricing && Array.isArray(booking.pricing.payments)) {
      paymentsArray = paymentsArray.concat(booking.pricing.payments);
    }
    
    if (Array.isArray(booking.payments)) {
      paymentsArray = paymentsArray.concat(booking.payments);
    }
    
    paymentsArray.forEach(payment => {
      const amount = this.normalizeAmount(payment.amount);
      
      if (payment.received === true) {
        result.receivedPayments.push({
          amount,
          amountNumber: amount.toNumber(),
          date: payment.date,
          method: payment.method,
          type: payment.type
        });
        result.totalPaid = result.totalPaid.plus(amount);
      } else {
        result.pendingPayments.push({
          amount,
          amountNumber: amount.toNumber(),
          date: payment.date,
          method: payment.method,
          type: payment.type
        });
        result.totalOutstanding = result.totalOutstanding.plus(amount);
      }
    });
    
    if (result.totalPaid.isZero()) {
      if (booking.totalPaid !== undefined) {
        result.totalPaid = this.normalizeAmount(booking.totalPaid);
      } else if (booking.pricing && booking.pricing.totalPaid !== undefined) {
        result.totalPaid = this.normalizeAmount(booking.pricing.totalPaid);
      }
    }
    
    if (result.totalOutstanding.isZero() && result.totalAgreedPrice.greaterThan(result.totalPaid)) {
      result.totalOutstanding = result.totalAgreedPrice.minus(result.totalPaid);
    }
    
    return {
      totalAgreedPrice: result.totalAgreedPrice,
      totalAgreedPriceNumber: result.totalAgreedPrice.toNumber(),
      
      totalPaid: result.totalPaid,
      totalPaidNumber: result.totalPaid.toNumber(),
      
      totalOutstanding: result.totalOutstanding,
      totalOutstandingNumber: result.totalOutstanding.toNumber(),
      
      receivedPayments: result.receivedPayments,
      pendingPayments: result.pendingPayments
    };
  }
  
  static extractOrderPayments(order) {
    const result = {
      totalAmount: new Decimal(0),
      amountPaid: new Decimal(0),
      amountDue: new Decimal(0)
    };
    
    if (!order) {
      return {
        totalAmount: result.totalAmount,
        totalAmountNumber: 0,
        amountPaid: result.amountPaid,
        amountPaidNumber: 0,
        amountDue: result.amountDue,
        amountDueNumber: 0
      };
    }
    
    if (order.amount_total !== undefined) {
      result.totalAmount = this.normalizeAmount(order.amount_total);
    }
    
    if (order.payment_details) {
      result.amountPaid = this.normalizeAmount(order.payment_details.amountPaid || 0);
      result.amountDue = this.normalizeAmount(order.payment_details.amountDue || 0);
      
      if (result.amountPaid.isZero() && result.amountDue.isZero() && !result.totalAmount.isZero()) {
        if (order.paymentStatus === 'paid') {
          result.amountPaid = result.totalAmount;
        } else if (order.paymentStatus === 'unpaid') {
          result.amountDue = result.totalAmount;
        }
      }
      
      if (result.amountDue.isZero() && result.totalAmount.greaterThan(result.amountPaid)) {
        result.amountDue = result.totalAmount.minus(result.amountPaid);
      }
    } else {
      if (order.paymentStatus === 'paid') {
        result.amountPaid = result.totalAmount;
      } else if (order.paymentStatus === 'partially_paid' && !result.totalAmount.isZero()) {
        result.amountPaid = result.totalAmount.dividedBy(2);
        result.amountDue = result.totalAmount.minus(result.amountPaid);
      } else {
        result.amountDue = result.totalAmount;
      }
    }
    
    return {
      totalAmount: result.totalAmount,
      totalAmountNumber: result.totalAmount.toNumber(),
      
      amountPaid: result.amountPaid,
      amountPaidNumber: result.amountPaid.toNumber(),
      
      amountDue: result.amountDue,
      amountDueNumber: result.amountDue.toNumber()
    };
  }
  
  static calculateProfitMargin(income, expenses, decimalPlaces = 2) {
    const incomeDecimal = this.normalizeAmount(income);
    const expensesDecimal = this.normalizeAmount(expenses);
    
    const netProfit = incomeDecimal.minus(expensesDecimal);
    
    if (incomeDecimal.isZero()) {
      return {
        netProfit,
        netProfitNumber: 0,
        marginPercentage: new Decimal(0),
        marginPercentageNumber: 0,
        displayValue: "0.00%"
      };
    }
    
    const marginPercentage = netProfit
      .dividedBy(incomeDecimal)
      .times(100)
      .toDecimalPlaces(decimalPlaces);
    
    return {
      netProfit,
      netProfitNumber: netProfit.toNumber(),
      marginPercentage,
      marginPercentageNumber: marginPercentage.toNumber(),
      displayValue: `${marginPercentage.toFixed(decimalPlaces)}%`,
      isPositive: marginPercentage.greaterThanOrEqualTo(0)
    };
  }
  
  static calculateCompanyMargin(orders, bookings, expenses, payments, options = {}) {
    const totals = {
      revenue: new Decimal(0),
      costs: new Decimal(0),
      outstanding: new Decimal(0),
      
      bookingRevenue: new Decimal(0),
      orderRevenue: new Decimal(0),
      otherRevenue: new Decimal(0),
      
      bookingOutstanding: new Decimal(0),
      orderOutstanding: new Decimal(0),
      
      dailyAvgRevenue: new Decimal(0),
      dailyAvgExpense: new Decimal(0),
      
      sources: {
        bookings: [],
        orders: [],
        expenses: [],
        otherPayments: []
      }
    };
    
    if (Array.isArray(bookings)) {
      bookings.forEach(booking => {
        const paymentData = this.extractBookingPayments(booking);
        
        totals.bookingRevenue = totals.bookingRevenue.plus(paymentData.totalPaid);
        totals.bookingOutstanding = totals.bookingOutstanding.plus(paymentData.totalOutstanding);
        
        totals.sources.bookings.push({
          id: booking.id,
          paid: paymentData.totalPaid,
          outstanding: paymentData.totalOutstanding,
          clientName: booking.clientName || booking.clientDetails?.name || 'Unknown'
        });
      });
    }
    
    if (Array.isArray(orders)) {
      orders.forEach(order => {
        const paymentData = this.extractOrderPayments(order);
        
        totals.orderRevenue = totals.orderRevenue.plus(paymentData.amountPaid);
        totals.orderOutstanding = totals.orderOutstanding.plus(paymentData.amountDue);
        
        totals.sources.orders.push({
          id: order.id,
          paid: paymentData.amountPaid,
          outstanding: paymentData.amountDue,
          status: order.paymentStatus
        });
      });
    }
    
    if (Array.isArray(expenses)) {
      expenses.forEach(expense => {
        if (expense.paymentStatus === 'paid') {
          const amount = this.normalizeAmount(expense.amount);
          totals.costs = totals.costs.plus(amount);
          
          totals.sources.expenses.push({
            id: expense.id,
            amount,
            category: expense.category || 'Uncategorized'
          });
        }
      });
    }
    
    if (Array.isArray(payments)) {
      payments.forEach(payment => {
        if (!payment.bookingId && !payment.orderId) {
          const amount = this.normalizeAmount(payment.amount);
          totals.otherRevenue = totals.otherRevenue.plus(amount);
          
          totals.sources.otherPayments.push({
            id: payment.id,
            amount,
            date: payment.date
          });
        }
      });
    }
    
    totals.revenue = this.sum(totals.bookingRevenue, totals.orderRevenue, totals.otherRevenue);
    totals.outstanding = this.sum(totals.bookingOutstanding, totals.orderOutstanding);
    
    const netProfit = totals.revenue.minus(totals.costs);
    
    const marginData = this.calculateProfitMargin(totals.revenue, totals.costs);
    
    if (options.startDate && options.endDate) {
      const startDate = new Date(options.startDate);
      const endDate = new Date(options.endDate);
      const daysDifference = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
      
      totals.dailyAvgRevenue = totals.revenue.dividedBy(daysDifference);
      totals.dailyAvgExpense = totals.costs.dividedBy(daysDifference);
    }
    
    return {
      revenue: totals.revenue,
      costs: totals.costs,
      netProfit,
      profitMargin: marginData.marginPercentage,
      outstanding: totals.outstanding,
      
      bookingRevenue: totals.bookingRevenue,
      orderRevenue: totals.orderRevenue,
      otherRevenue: totals.otherRevenue,
      bookingOutstanding: totals.bookingOutstanding,
      orderOutstanding: totals.orderOutstanding,
      
      dailyAvgRevenue: totals.dailyAvgRevenue,
      dailyAvgExpense: totals.dailyAvgExpense,
      
      revenueNumber: totals.revenue.toNumber(),
      costsNumber: totals.costs.toNumber(),
      netProfitNumber: netProfit.toNumber(),
      profitMarginNumber: marginData.marginPercentageNumber,
      outstandingNumber: totals.outstanding.toNumber(),
      
      bookingRevenueNumber: totals.bookingRevenue.toNumber(),
      orderRevenueNumber: totals.orderRevenue.toNumber(),
      otherRevenueNumber: totals.otherRevenue.toNumber(),
      bookingOutstandingNumber: totals.bookingOutstanding.toNumber(),
      orderOutstandingNumber: totals.orderOutstanding.toNumber(),
      
      dailyAvgRevenueNumber: totals.dailyAvgRevenue.toNumber(),
      dailyAvgExpenseNumber: totals.dailyAvgExpense.toNumber(),
      
      displayValues: {
        revenue: this.formatCurrency(totals.revenue),
        costs: this.formatCurrency(totals.costs),
        netProfit: this.formatCurrency(netProfit),
        profitMargin: marginData.displayValue,
        outstanding: this.formatCurrency(totals.outstanding)
      },
      
      sources: totals.sources
    };
  }
}

export default PrecisionFinancialUtils;