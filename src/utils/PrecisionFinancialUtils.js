// Import Decimal.js for high-precision calculations
// You'll need to run: npm install decimal.js
import { Decimal } from 'decimal.js';

/**
 * Utility functions for precise financial calculations
 * Eliminates floating-point errors and ensures consistent handling
 */
class PrecisionFinancialUtils {
  /**
   * Normalizes any amount to a Decimal object for precise calculations
   * 
   * @param {any} amount - The amount to normalize (string, number, etc.)
   * @returns {Decimal} A Decimal.js object representing the normalized amount
   */
  static normalizeAmount(amount) {
    // Return zero for null, undefined, or empty values
    if (amount === null || amount === undefined || amount === '') {
      return new Decimal(0);
    }
    
    // If already a number, convert directly to Decimal
    if (typeof amount === 'number') {
      if (isNaN(amount) || !isFinite(amount)) {
        return new Decimal(0);
      }
      return new Decimal(amount);
    }
    
    // If already a Decimal instance, return as is
    if (amount instanceof Decimal) {
      return amount;
    }
    
    // Handle string values with comprehensive formatting support
    if (typeof amount === 'string') {
      // Remove any currency symbols, spaces, and other non-numeric chars
      // except for . and , which could be decimal or thousand separators
      // Fix: Moved hyphen to the end of the character class to avoid escape
      let cleanedAmount = amount.replace(/[^0-9.,-]/g, '');
      
      // Determine the decimal separator by the position of the last . or ,
      const lastDotIndex = cleanedAmount.lastIndexOf('.');
      const lastCommaIndex = cleanedAmount.lastIndexOf(',');
      
      // If both are present, the last one is the decimal separator
      if (lastDotIndex > -1 && lastCommaIndex > -1) {
        if (lastDotIndex > lastCommaIndex) {
          // US/UK format: 1,234.56
          cleanedAmount = cleanedAmount.replace(/,/g, '');
        } else {
          // European format: 1.234,56
          cleanedAmount = cleanedAmount.replace(/\./g, '').replace(',', '.');
        }
      } else if (lastCommaIndex > -1 && (lastCommaIndex > cleanedAmount.length - 4)) {
        // If comma is near the end, it's likely a decimal separator
        cleanedAmount = cleanedAmount.replace(',', '.');
      }
      
      // Parse the cleaned value, default to 0 if parsing fails
      try {
        return new Decimal(cleanedAmount);
      } catch (e) {
        console.warn(`Failed to parse amount: ${amount}`, e);
        return new Decimal(0);
      }
    }
    
    // Default fallback for any other type
    return new Decimal(0);
  }
  
  /**
   * Format a currency value with proper locale and symbol
   * 
   * @param {Decimal|number|string} amount - The amount to format
   * @param {string} locale - The locale to use for formatting (default: 'en-US')
   * @param {string} currency - The currency code to use (default: 'EUR')
   * @returns {string} Formatted currency string
   */
  static formatCurrency(amount, locale = 'en-US', currency = 'EUR') {
    let value;
    
    // If amount is a Decimal instance, convert to number
    if (amount instanceof Decimal) {
      value = amount.toNumber();
    } else if (typeof amount === 'number') {
      value = amount;
    } else {
      // Try to normalize the amount
      value = this.normalizeAmount(amount).toNumber();
    }
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }
  
  /**
   * Calculate percentage change between current and previous values
   * 
   * @param {Decimal|number|string} current - Current value
   * @param {Decimal|number|string} previous - Previous value
   * @returns {Object} Change data including value, isIncrease flag and displayValue
   */
  static calculatePercentChange(current, previous) {
    const currentDecimal = this.normalizeAmount(current);
    const previousDecimal = this.normalizeAmount(previous);
    
    // Handle cases where previous is zero or close to zero
    if (previousDecimal.isZero() || previousDecimal.abs().lessThan('0.00001')) {
      return { 
        value: 0, 
        isIncrease: false, 
        displayValue: "0%" 
      };
    }
    
    // Calculate change percentage
    const change = currentDecimal
      .minus(previousDecimal)
      .dividedBy(previousDecimal.abs())
      .times(100);
    
    const formattedChange = change.abs().toDecimalPlaces(1);
    
    return {
      value: formattedChange.toNumber(),
      isIncrease: change.greaterThanOrEqualTo(0),
      displayValue: `${change.greaterThanOrEqualTo(0) ? '+' : '-'}${formattedChange.toFixed(1)}%`
    };
  }
  
  /**
   * Extract payment data from booking object
   * 
   * @param {Object} booking - Booking object with pricing and payment data
   * @returns {Object} Extracted payment data
   */
  static extractBookingPayments(booking) {
    // Initialize with default values
    const result = {
      totalAgreedPrice: new Decimal(0),
      totalPaid: new Decimal(0),
      totalOutstanding: new Decimal(0),
      receivedPayments: [],
      pendingPayments: []
    };
    
    // Early return if no booking or missing pricing/payments
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
    
    // Get agreed price if available
    if (booking.pricing && booking.pricing.agreedPrice !== undefined) {
      result.totalAgreedPrice = this.normalizeAmount(booking.pricing.agreedPrice);
    }
    
    // Process all possible payment sources
    let paymentsArray = [];
    
    // Check for payments in pricing object
    if (booking.pricing && Array.isArray(booking.pricing.payments)) {
      paymentsArray = paymentsArray.concat(booking.pricing.payments);
    }
    
    // Check for payments in root object
    if (Array.isArray(booking.payments)) {
      paymentsArray = paymentsArray.concat(booking.payments);
    }
    
    // Process all discovered payments
    paymentsArray.forEach(payment => {
      const amount = this.normalizeAmount(payment.amount);
      
      // Track received vs pending payments based on received flag
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
    
    // Process any linked orders - this will properly account for catering/additional services
    if (booking.linkedOrders && Array.isArray(booking.linkedOrders)) {
      booking.linkedOrders.forEach(linkedOrder => {
        // If the order is paid, add the amount to totalPaid
        if (linkedOrder.paymentStatus === 'paid') {
          const orderAmount = this.normalizeAmount(linkedOrder.amount);
          result.totalPaid = result.totalPaid.plus(orderAmount);
          
          // Add to received payments
          result.receivedPayments.push({
            amount: orderAmount,
            amountNumber: orderAmount.toNumber(),
            date: linkedOrder.updatedAt || new Date().toISOString(),
            method: 'order-payment',
            type: 'linked-order',
            orderId: linkedOrder.orderDocId,
            orderAmount: orderAmount // Add order amount for tracking in calculateCompanyMargin
          });
        } 
        // If partially paid, add the appropriate amount
        else if (linkedOrder.paymentStatus === 'partially_paid' && linkedOrder.amount) {
          // Assume 50% paid if no detailed payment info
          const paidAmount = this.normalizeAmount(linkedOrder.amount).dividedBy(2);
          result.totalPaid = result.totalPaid.plus(paidAmount);
          
          const outstandingAmount = this.normalizeAmount(linkedOrder.amount).minus(paidAmount);
          result.totalOutstanding = result.totalOutstanding.plus(outstandingAmount);
          
          // Add to received payments
          result.receivedPayments.push({
            amount: paidAmount,
            amountNumber: paidAmount.toNumber(),
            date: linkedOrder.updatedAt || new Date().toISOString(),
            method: 'order-payment',
            type: 'linked-order-partial',
            orderId: linkedOrder.orderDocId,
            orderAmount: paidAmount // Add order amount for tracking in calculateCompanyMargin
          });
          
          // Add to pending payments
          result.pendingPayments.push({
            amount: outstandingAmount,
            amountNumber: outstandingAmount.toNumber(),
            date: linkedOrder.updatedAt || new Date().toISOString(),
            method: 'order-payment',
            type: 'linked-order-remaining',
            orderId: linkedOrder.orderDocId
          });
        }
        // If unpaid, add to outstanding amount
        else if (linkedOrder.amount) {
          const orderAmount = this.normalizeAmount(linkedOrder.amount);
          result.totalOutstanding = result.totalOutstanding.plus(orderAmount);
          
          // Add to pending payments
          result.pendingPayments.push({
            amount: orderAmount,
            amountNumber: orderAmount.toNumber(),
            date: linkedOrder.updatedAt || new Date().toISOString(),
            method: 'order-payment',
            type: 'linked-order-unpaid',
            orderId: linkedOrder.orderDocId
          });
        }
      });
    }
    
    // If no payments detected but totalPaid is available, use that
    if (result.totalPaid.isZero()) {
      if (booking.totalPaid !== undefined) {
        result.totalPaid = this.normalizeAmount(booking.totalPaid);
      } else if (booking.pricing && booking.pricing.totalPaid !== undefined) {
        result.totalPaid = this.normalizeAmount(booking.pricing.totalPaid);
      }
    }
    
    // If outstanding is still 0, calculate it based on agreed price minus paid
    if (result.totalOutstanding.isZero() && result.totalAgreedPrice.greaterThan(result.totalPaid)) {
      result.totalOutstanding = result.totalAgreedPrice.minus(result.totalPaid);
    }
    
    // Return both Decimal objects and numbers for easy use
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
  
  /**
   * Extract payment data from order object
   * 
   * @param {Object} order - Order object with payment data
   * @returns {Object} Extracted payment data
   */
  static extractOrderPayments(order) {
    // Initialize with default values
    const result = {
      totalAmount: new Decimal(0),
      amountPaid: new Decimal(0),
      amountDue: new Decimal(0)
    };
    
    // Early return if no order
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
    
    // Get total amount if available
    if (order.amount !== undefined) {
      result.totalAmount = this.normalizeAmount(order.amount);
    } else if (order.amount_total !== undefined) {
      result.totalAmount = this.normalizeAmount(order.amount_total);
    }
    
    // Process payment details if available
    if (order.payment_details) {
      result.amountPaid = this.normalizeAmount(order.payment_details.amountPaid || 0);
      result.amountDue = this.normalizeAmount(order.payment_details.amountDue || 0);
      
      // If both are 0 but totalAmount is set, assume full payment or due based on status
      if (result.amountPaid.isZero() && result.amountDue.isZero() && !result.totalAmount.isZero()) {
        if (order.paymentStatus === 'paid') {
          result.amountPaid = result.totalAmount;
        } else if (order.paymentStatus === 'unpaid') {
          result.amountDue = result.totalAmount;
        }
      }
      
      // Another safety check - if amountDue is 0 but totalAmount > amountPaid
      if (result.amountDue.isZero() && result.totalAmount.greaterThan(result.amountPaid)) {
        result.amountDue = result.totalAmount.minus(result.amountPaid);
      }
    } else {
      // No payment details, infer from payment status
      if (order.paymentStatus === 'paid') {
        result.amountPaid = result.totalAmount;
      } else if (order.paymentStatus === 'partially_paid' && !result.totalAmount.isZero()) {
        // Default to 50% paid if partially paid without specific details
        result.amountPaid = result.totalAmount.dividedBy(2);
        result.amountDue = result.totalAmount.minus(result.amountPaid);
      } else {
        result.amountDue = result.totalAmount;
      }
    }
    
    // Return both Decimal objects and numbers for easy use
    return {
      totalAmount: result.totalAmount,
      totalAmountNumber: result.totalAmount.toNumber(),
      
      amountPaid: result.amountPaid,
      amountPaidNumber: result.amountPaid.toNumber(),
      
      amountDue: result.amountDue,
      amountDueNumber: result.amountDue.toNumber()
    };
  }
  
  /**
   * Calculate company financial margin with high precision
   * 
   * @param {Array} orders - Array of order objects
   * @param {Array} bookings - Array of booking objects
   * @param {Array} expenses - Array of expense objects
   * @param {Array} payments - Array of standalone payment objects
   * @param {Object} options - Additional calculation options
   * @returns {Object} Comprehensive financial metrics
   */
  static calculateCompanyMargin(orders = [], bookings = [], expenses = [], payments = [], options = {}) {
    // Initialize totals with Decimal for maximum precision
    const totals = {
      revenue: new Decimal(0),
      costs: new Decimal(0),
      outstanding: new Decimal(0),
      
      // Add this new property to track owner payments
      ownerPayments: new Decimal(0),
      
      // Detailed breakdown
      bookingRevenue: new Decimal(0),
      orderRevenue: new Decimal(0),
      otherRevenue: new Decimal(0),
      
      bookingOutstanding: new Decimal(0),
      orderOutstanding: new Decimal(0),
      
      // For time-based analysis
      dailyAvgRevenue: new Decimal(0),
      dailyAvgExpense: new Decimal(0),
      
      // Tracking individual sources
      sources: {
        bookings: [],
        orders: [],
        expenses: [],
        otherPayments: [],
        ownerPayments: [] // Add this new array to track owner payment details
      }
    };
    
    // Track linked order IDs to prevent double-counting
    const processedLinkedOrderIds = new Set();
    
    // Process bookings
    if (Array.isArray(bookings)) {
      bookings.forEach(booking => {
        const paymentData = this.extractBookingPayments(booking);
        
        // Track booking revenue excluding linked orders
        let bookingOnlyRevenue = paymentData.totalPaid;
        let linkedOrderRevenue = new Decimal(0);
        
        // Extract linked order revenue from the receivedPayments
        if (paymentData.receivedPayments) {
          paymentData.receivedPayments.forEach(payment => {
            if (payment.type === 'linked-order' || payment.type === 'linked-order-partial') {
              if (payment.orderAmount) {
                linkedOrderRevenue = linkedOrderRevenue.plus(payment.orderAmount);
                
                // Subtract from booking revenue to avoid double counting
                bookingOnlyRevenue = bookingOnlyRevenue.minus(payment.amount);
              }
              
              // Track order ID to avoid double-counting
              if (payment.orderId) {
                processedLinkedOrderIds.add(payment.orderId);
              }
            }
          });
        }
        
        // Add to respective totals
        totals.bookingRevenue = totals.bookingRevenue.plus(bookingOnlyRevenue);
        totals.orderRevenue = totals.orderRevenue.plus(linkedOrderRevenue);
        totals.bookingOutstanding = totals.bookingOutstanding.plus(paymentData.totalOutstanding);
        
        // *** NEW CODE FOR OWNER PAYMENTS ***
        // Process owner payments from this booking
        if (booking.ownerPayments) {
          // Track owner payment totals for this booking
          let bookingOwnerPayments = new Decimal(0);
          const ownerPaymentDetails = [];
          
          // First payment
          if (booking.ownerPayments.firstPayment && booking.ownerPayments.firstPayment.signature) {
            const amount = this.normalizeAmount(booking.ownerPayments.firstPayment.amount);
            bookingOwnerPayments = bookingOwnerPayments.plus(amount);
            
            // Add to details
            ownerPaymentDetails.push({
              type: 'first',
              amount: amount,
              date: booking.ownerPayments.firstPayment.date,
              signature: true
            });
          }
          
          // Second payment
          if (booking.ownerPayments.secondPayment && booking.ownerPayments.secondPayment.signature) {
            const amount = this.normalizeAmount(booking.ownerPayments.secondPayment.amount);
            bookingOwnerPayments = bookingOwnerPayments.plus(amount);
            
            // Add to details
            ownerPaymentDetails.push({
              type: 'second',
              amount: amount,
              date: booking.ownerPayments.secondPayment.date,
              signature: true
            });
          }
          
          // Transfer payment
          if (booking.ownerPayments.transferPayment && booking.ownerPayments.transferPayment.signature) {
            const amount = this.normalizeAmount(booking.ownerPayments.transferPayment.amount);
            bookingOwnerPayments = bookingOwnerPayments.plus(amount);
            
            // Add to details
            ownerPaymentDetails.push({
              type: 'transfer',
              amount: amount,
              date: booking.ownerPayments.transferPayment.date,
              signature: true
            });
          }
          
          // Add to total owner payments
          totals.ownerPayments = totals.ownerPayments.plus(bookingOwnerPayments);
          
          // Add to owner payment sources if there are any payments
          if (bookingOwnerPayments.greaterThan(0)) {
            totals.sources.ownerPayments.push({
              id: booking.id,
              bookingId: booking.id,
              clientName: booking.clientName || booking.clientDetails?.name || 'Unknown',
              boatName: booking.bookingDetails?.boatName || 'Unknown Boat',
              totalPaid: bookingOwnerPayments,
              payments: ownerPaymentDetails
            });
          }
        }
        // *** END NEW CODE FOR OWNER PAYMENTS ***
        
        // Track source for reconciliation
        totals.sources.bookings.push({
          id: booking.id,
          paid: bookingOnlyRevenue,
          linkedOrderAmount: linkedOrderRevenue,
          outstanding: paymentData.totalOutstanding,
          clientName: booking.clientName || booking.clientDetails?.name || 'Unknown'
        });
      });
    }
    
    // Process orders - skip any orders that are already counted via linked orders
    if (Array.isArray(orders)) {
      orders.forEach(order => {
        // Skip if this order is already counted as a linked order
        if (processedLinkedOrderIds.has(order.id)) {
          // Log that we're skipping a double-counted order
          console.log(`Skipping double-counting of order ${order.id} that was processed as a linked order`);
          return;
        }
        
        const paymentData = this.extractOrderPayments(order);
        
        totals.orderRevenue = totals.orderRevenue.plus(paymentData.amountPaid);
        totals.orderOutstanding = totals.orderOutstanding.plus(paymentData.amountDue);
        
        // Track source for reconciliation
        totals.sources.orders.push({
          id: order.id,
          paid: paymentData.amountPaid,
          outstanding: paymentData.amountDue,
          status: order.paymentStatus
        });
      });
    }
    
    // Process expenses
    if (Array.isArray(expenses)) {
      expenses.forEach(expense => {
        // Only count paid expenses
        if (expense.paymentStatus === 'paid') {
          const amount = this.normalizeAmount(expense.amount);
          totals.costs = totals.costs.plus(amount);
          
          // Track source
          totals.sources.expenses.push({
            id: expense.id,
            amount,
            category: expense.category || 'Uncategorized'
          });
        }
      });
    }
    
    // Process other payments
    if (Array.isArray(payments)) {
      payments.forEach(payment => {
        // Skip payments tied to bookings/orders to avoid double counting
        if (!payment.bookingId && !payment.orderId) {
          const amount = this.normalizeAmount(payment.amount);
          totals.otherRevenue = totals.otherRevenue.plus(amount);
          
          // Track source
          totals.sources.otherPayments.push({
            id: payment.id,
            amount,
            date: payment.date
          });
        }
      });
    }
    
    // Calculate total revenue and outstanding
    totals.revenue = totals.bookingRevenue.plus(totals.orderRevenue).plus(totals.otherRevenue);
    totals.outstanding = totals.bookingOutstanding.plus(totals.orderOutstanding);
    
    // *** NEW CODE: Add owner payments to costs ***
    totals.costs = totals.costs.plus(totals.ownerPayments);
    // *** END NEW CODE ***
    
    // Calculate net profit
    const netProfit = totals.revenue.minus(totals.costs);
    
    // Calculate profit margin
    let marginPercentage = new Decimal(0);
    if (!totals.revenue.isZero()) {
      marginPercentage = netProfit.dividedBy(totals.revenue).times(100).toDecimalPlaces(2);
    }
    
    // Calculate daily averages if date range is provided
    if (options.startDate && options.endDate) {
      const startDate = new Date(options.startDate);
      const endDate = new Date(options.endDate);
      const daysDifference = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
      
      totals.dailyAvgRevenue = totals.revenue.dividedBy(daysDifference).toDecimalPlaces(2);
      totals.dailyAvgExpense = totals.costs.dividedBy(daysDifference).toDecimalPlaces(2);
    }
    
    // Return comprehensive results
    return {
      // High precision Decimal objects
      revenue: totals.revenue,
      costs: totals.costs,
      netProfit,
      profitMargin: marginPercentage,
      outstanding: totals.outstanding,
      
      // Detailed breakdowns
      bookingRevenue: totals.bookingRevenue,
      orderRevenue: totals.orderRevenue,
      otherRevenue: totals.otherRevenue,
      bookingOutstanding: totals.bookingOutstanding,
      orderOutstanding: totals.orderOutstanding,
      
      // *** NEW CODE: Add owner payments to returned data ***
      ownerPayments: totals.ownerPayments,
      // *** END NEW CODE ***
      
      // Daily averages
      dailyAvgRevenue: totals.dailyAvgRevenue,
      dailyAvgExpense: totals.dailyAvgExpense,
      
      // Number values for display
      revenueNumber: totals.revenue.toNumber(),
      costsNumber: totals.costs.toNumber(),
      netProfitNumber: netProfit.toNumber(),
      profitMarginNumber: marginPercentage.toNumber(),
      outstandingNumber: totals.outstanding.toNumber(),
      
      bookingRevenueNumber: totals.bookingRevenue.toNumber(),
      orderRevenueNumber: totals.orderRevenue.toNumber(),
      otherRevenueNumber: totals.otherRevenue.toNumber(),
      bookingOutstandingNumber: totals.bookingOutstanding.toNumber(),
      orderOutstandingNumber: totals.orderOutstanding.toNumber(),
      
      // *** NEW CODE: Add owner payments as number to returned data ***
      ownerPaymentsNumber: totals.ownerPayments.toNumber(),
      // *** END NEW CODE ***
      
      dailyAvgRevenueNumber: totals.dailyAvgRevenue.toNumber(),
      dailyAvgExpenseNumber: totals.dailyAvgExpense.toNumber(),
      
      // Formatted values for display
      displayValues: {
        revenue: this.formatCurrency(totals.revenue),
        costs: this.formatCurrency(totals.costs),
        netProfit: this.formatCurrency(netProfit),
        profitMargin: `${marginPercentage.toFixed(2)}%`,
        outstanding: this.formatCurrency(totals.outstanding),
        // *** NEW CODE: Add formatted owner payments ***
        ownerPayments: this.formatCurrency(totals.ownerPayments)
        // *** END NEW CODE ***
      },
      
      // Source data for reconciliation
      sources: totals.sources
    };
  }
  
  /**
   * Sum multiple values with precise decimal handling
   * 
   * @param {...any} values - Values to sum
   * @returns {Decimal} Sum as a Decimal object
   */
  static sum(...values) {
    let result = new Decimal(0);
    values.forEach(value => {
      result = result.plus(this.normalizeAmount(value));
    });
    return result;
  }
}

export default PrecisionFinancialUtils;