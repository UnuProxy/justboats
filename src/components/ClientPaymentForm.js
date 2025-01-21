import React, { useState, useEffect, useCallback } from 'react';

const VAT_RATE = 0.21;

const calculateVATExcluded = (amount) => amount / (1 + VAT_RATE);
const calculateVATIncluded = (amount) => amount * (1 + VAT_RATE);

const determinePaymentStatus = (editedBooking) => {
  const firstReceived = editedBooking.firstPayment?.received || false;
  const secondReceived = editedBooking.secondPayment?.received || false;

  if (firstReceived && secondReceived) {
    return "Completed";
  } else if (firstReceived || secondReceived) {
    return "Partial";
  } else {
    return "No Payment";
  }
};

const getStatusStyles = (status) => {
  const baseStyles = "inline-flex px-2 py-1 rounded-full text-sm font-medium ";
  switch (status) {
    case 'Completed':
      return baseStyles + 'bg-green-100 text-green-800';
    case 'Partial':
      return baseStyles + 'bg-yellow-100 text-yellow-800';
    default:
      return baseStyles + 'bg-red-100 text-red-800';
  }
};

const ClientPaymentForm = ({ onPricingChange = () => {}, initialData }) => {
  const [pricingDetails, setPricingDetails] = useState({
    agreedPrice: initialData?.agreedPrice || '',
    pricingType: initialData?.pricingType || 'standard',
    firstPayment: {
      useCustomAmount: initialData?.firstPayment?.useCustomAmount || false,
      percentage: initialData?.firstPayment?.percentage || '50',
      amount: initialData?.firstPayment?.amount || '',
      method: initialData?.firstPayment?.method || 'cash',
      received: initialData?.firstPayment?.received || false,
      date: initialData?.firstPayment?.date || '',
      excludeVAT: initialData?.firstPayment?.excludeVAT || false
    },
    secondPayment: {
      amount: initialData?.secondPayment?.amount || '',
      method: initialData?.secondPayment?.method || 'pos',
      received: initialData?.secondPayment?.received || false,
      date: initialData?.secondPayment?.date || '',
      excludeVAT: initialData?.secondPayment?.excludeVAT || false
    }
  });

  const calculatePaymentAmounts = useCallback((details) => {
    // Case 1: Custom pricing type
    if (details.pricingType === 'custom') {
      return {
        firstPaymentAmount: parseFloat(details.firstPayment.amount) || 0,
        secondPaymentAmount: parseFloat(details.secondPayment.amount) || 0
      };
    }
  
    const agreedPrice = parseFloat(details.agreedPrice) || 0;
    let firstPaymentAmount = 0;
    let secondPaymentAmount = 0;
    let effectiveFirstAmount = 0;
  
    // If using custom amount in any mode, prioritize it
    if (details.firstPayment.useCustomAmount) {
      firstPaymentAmount = parseFloat(details.firstPayment.amount) || 0;
    } else {
      // Otherwise use percentage calculation
      const percentage = parseFloat(details.firstPayment.percentage) / 100;
      
      switch (details.pricingType) {
        case 'full-vat-discount':
          firstPaymentAmount = calculateVATExcluded(agreedPrice * percentage);
          secondPaymentAmount = calculateVATExcluded(agreedPrice) - firstPaymentAmount;
          break;
  
        case 'split-vat':
          firstPaymentAmount = agreedPrice * percentage;
          if (details.firstPayment.excludeVAT) {
            firstPaymentAmount = calculateVATExcluded(firstPaymentAmount);
          }
          effectiveFirstAmount = details.firstPayment.excludeVAT
            ? calculateVATIncluded(firstPaymentAmount)
            : firstPaymentAmount;
          secondPaymentAmount = agreedPrice - effectiveFirstAmount;
          break;
  
        default: // standard
          firstPaymentAmount = agreedPrice * percentage;
          secondPaymentAmount = agreedPrice - firstPaymentAmount;
          break;
      }
    }
  
    // If using custom amount, recalculate second payment
    if (details.firstPayment.useCustomAmount) {
      secondPaymentAmount = Math.max(0, agreedPrice - firstPaymentAmount);
    }
  
    // Save both the calculated amounts and the original percentage
    return {
      firstPaymentAmount: Number(firstPaymentAmount.toFixed(2)),
      secondPaymentAmount: Number(secondPaymentAmount.toFixed(2)),
      originalPercentage: details.firstPayment.percentage // Keep track of the percentage
    };
  }, []);

  useEffect(() => {
    // Skip for custom pricing type
    if (pricingDetails.pricingType === 'custom') {
      return;
    }
  
    const { firstPaymentAmount, secondPaymentAmount } = calculatePaymentAmounts(pricingDetails);
  
    setPricingDetails(prev => {
      // If we're using a custom amount in standard mode
      if (prev.firstPayment.useCustomAmount) {
        const customFirstAmount = parseFloat(prev.firstPayment.amount) || 0;
        const customSecondAmount = Math.max(0, parseFloat(prev.agreedPrice || 0) - customFirstAmount);
        
        return {
          ...prev,
          firstPayment: {
            ...prev.firstPayment,
            amount: customFirstAmount.toString()
          },
          secondPayment: {
            ...prev.secondPayment,
            amount: customSecondAmount.toString()
          }
        };
      }
  
      // For percentage-based calculations
      const newFirstAmount = firstPaymentAmount.toString();
      const newSecondAmount = secondPaymentAmount.toString();
  
      // Skip update if no actual changes
      if (prev.firstPayment.amount === newFirstAmount && 
          prev.secondPayment.amount === newSecondAmount) {
        return prev;
      }
  
      return {
        ...prev,
        firstPayment: {
          ...prev.firstPayment,
          amount: newFirstAmount
        },
        secondPayment: {
          ...prev.secondPayment,
          amount: newSecondAmount
        }
      };
    });
  }, [
    pricingDetails.pricingType,
    pricingDetails.agreedPrice,
    pricingDetails.firstPayment.percentage,
    pricingDetails.firstPayment.useCustomAmount, // Add this dependency
    pricingDetails.firstPayment.amount, // Add this dependency
    calculatePaymentAmounts
  ]);

// Replace the second effect with a debounced version
useEffect(() => {
  const debouncedUpdate = setTimeout(() => {
    const status = determinePaymentStatus(pricingDetails);
    // Only notify parent if status has actually changed
    onPricingChange({
      ...pricingDetails,
      paymentStatus: status
    });
  }, 300);

  return () => clearTimeout(debouncedUpdate);
}, [pricingDetails, onPricingChange]);

const handlePricingTypeChange = (e) => {
  const newType = e.target.value;
  setPricingDetails(prev => ({
    ...prev,
    pricingType: newType,
    // Clear agreed price and reset payments for custom type
    ...(newType === 'custom' ? {
      agreedPrice: '',
      firstPayment: {
        ...prev.firstPayment,
        amount: '',
        excludeVAT: false,
        useCustomAmount: false
      },
      secondPayment: {
        ...prev.secondPayment,
        amount: '',
        excludeVAT: false
      }
    } : {})
  }));
};

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">Pricing Type</label>
        <select
        value={pricingDetails.pricingType}
        onChange={handlePricingTypeChange}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
      >
        <option value="standard">Standard (Full VAT)</option>
        <option value="custom">Custom Payments</option>
      </select>
      </div>

      
{pricingDetails.pricingType !== 'custom' && (
  <div>
    <label className="block text-sm font-medium text-gray-700">
      Agreed Total Price (€) {pricingDetails.pricingType !== 'full-vat-discount' && '(VAT Included)'}
    </label>
    <input
      type="number"
      value={pricingDetails.agreedPrice}
      onChange={(e) => setPricingDetails(prev => ({
        ...prev,
        agreedPrice: e.target.value
      }))}
      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
      placeholder="Enter agreed price"
    />
  </div>
)}

      {/* First Payment Section */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-medium mb-4">First Payment</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pricingDetails.pricingType !== 'custom' && (
            <div className="col-span-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={pricingDetails.firstPayment.useCustomAmount}
                  onChange={(e) => setPricingDetails(prev => ({
                    ...prev,
                    firstPayment: {
                      ...prev.firstPayment,
                      useCustomAmount: e.target.checked,
                      amount: ''
                    }
                  }))}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">Use Custom Amount</span>
              </label>
            </div>
          )}

          {(pricingDetails.pricingType === 'split-vat' || pricingDetails.pricingType === 'custom') && (
            <div className="col-span-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={pricingDetails.firstPayment.excludeVAT}
                  onChange={(e) => setPricingDetails(prev => ({
                    ...prev,
                    firstPayment: {
                      ...prev.firstPayment,
                      excludeVAT: e.target.checked
                    }
                  }))}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">Exclude VAT from First Payment</span>
              </label>
            </div>
          )}

          {(pricingDetails.firstPayment.useCustomAmount || pricingDetails.pricingType === 'custom') ? (
            <div>
              <label className="block text-sm font-medium text-gray-700">Amount (€)</label>
              <input
                type="number"
                value={pricingDetails.firstPayment.amount}
                onChange={(e) => setPricingDetails(prev => ({
                  ...prev,
                  firstPayment: {
                    ...prev.firstPayment,
                    amount: e.target.value
                  }
                }))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700">Percentage</label>
              <select
                value={pricingDetails.firstPayment.percentage}
                onChange={(e) => setPricingDetails(prev => ({
                  ...prev,
                  firstPayment: {
                    ...prev.firstPayment,
                    percentage: e.target.value
                  }
                }))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="30">30%</option>
                <option value="50">50%</option>
                <option value="70">70%</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Payment Method</label>
            <select
              value={pricingDetails.firstPayment.method}
              onChange={(e) => setPricingDetails(prev => ({
                ...prev,
                firstPayment: {
                  ...prev.firstPayment,
                  method: e.target.value
                }
              }))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="cash">Cash</option>
              <option value="pos">POS</option>
              <option value="transfer">Bank Transfer</option>
              <option value="payment_link">Payment Link</option>
              <option value="Sabadell_link">Sabadell Link</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Payment Date</label>
            <input
              type="date"
              value={pricingDetails.firstPayment.date}
              onChange={(e) => setPricingDetails(prev => ({
                ...prev,
                firstPayment: {
                  ...prev.firstPayment,
                  date: e.target.value
                }
              }))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              disabled={!pricingDetails.firstPayment.received}
            />
          </div>

          <div className="flex items-center">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={pricingDetails.firstPayment.received}
                onChange={(e) => setPricingDetails(prev => ({
                  ...prev,
                  firstPayment: {
                    ...prev.firstPayment,
                    received: e.target.checked,
                    date: e.target.checked ? new Date().toISOString().split('T')[0] : ''
                  }
                }))}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">Payment Received</span>
            </label>
          </div>

          <div className="col-span-2">
            <div className="bg-white p-3 rounded-md">
              <span className="text-sm text-gray-500">Amount to collect:</span>
              <p className="text-lg font-semibold">€{pricingDetails.firstPayment.amount || '0'}</p>
              {pricingDetails.firstPayment.excludeVAT && (
                <p className="text-sm text-gray-500">
                  (VAT excluded - Full amount with VAT: €{(parseFloat(pricingDetails.firstPayment.amount || 0) * 1.21).toFixed(2)})
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Second Payment Section */}
      <div className="bg-green-50 p-4 rounded-lg">
        <h3 className="text-lg font-medium mb-4">Second Payment</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pricingDetails.pricingType === 'custom' && (
            <>
              <div className="col-span-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={pricingDetails.secondPayment.excludeVAT}
                    onChange={(e) => setPricingDetails(prev => ({
                      ...prev,
                      secondPayment: {
                        ...prev.secondPayment,
                        excludeVAT: e.target.checked
                      }
                    }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">Exclude VAT from Second Payment</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Amount (€)</label>
                <input
                  type="number"
                  value={pricingDetails.secondPayment.amount}
                  onChange={(e) => setPricingDetails(prev => ({
                    ...prev,
                    secondPayment: {
                      ...prev.secondPayment,
                      amount: e.target.value
                    }
                  }))}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Payment Method</label>
            <select
              value={pricingDetails.secondPayment.method}
              onChange={(e) => setPricingDetails(prev => ({
                ...prev,
                secondPayment: {
                  ...prev.secondPayment,
                  method: e.target.value
                }
              }))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="pos">POS</option>
              <option value="cash">Cash</option>
              <option value="transfer">Bank Transfer</option>
              <option value="payment_link">Payment Link</option>
              <option value="Sabadell_link">Sabadell Link</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Payment Date</label>
            <input
              type="date"
              value={pricingDetails.secondPayment.date}
              onChange={(e) => setPricingDetails(prev => ({
                ...prev,
                secondPayment: {
                  ...prev.secondPayment,
                  date: e.target.value
                }
              }))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              disabled={!pricingDetails.secondPayment.received}
            />
          </div>

          <div className="flex items-center">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={pricingDetails.secondPayment.received}
                onChange={(e) => setPricingDetails(prev => ({
                  ...prev,
                  secondPayment: {
                    ...prev.secondPayment,
                    received: e.target.checked,
                    date: e.target.checked ? new Date().toISOString().split('T')[0] : ''
                  }
                }))}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">Payment Received</span>
            </label>
          </div>

          <div className="col-span-2">
            <div className="bg-white p-3 rounded-md">
              <span className="text-sm text-gray-500">Amount to collect:</span>
              <p className="text-lg font-semibold">€{pricingDetails.secondPayment.amount || '0'}</p>
              {pricingDetails.secondPayment.excludeVAT && pricingDetails.pricingType === 'custom' && (
                <p className="text-sm text-gray-500">
                  (VAT excluded - Full amount with VAT: €{(parseFloat(pricingDetails.secondPayment.amount || 0) * 1.21).toFixed(2)})
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Total Amount:</label>
            <p className="text-lg font-semibold">
              €{pricingDetails.pricingType === 'custom' 
                ? (parseFloat(pricingDetails.firstPayment.amount || 0) + parseFloat(pricingDetails.secondPayment.amount || 0)).toFixed(2)
                : pricingDetails.agreedPrice || '0'}
            </p>
            {pricingDetails.pricingType === 'full-vat-discount' && (
              <p className="text-sm text-gray-500">
                (VAT excluded - Original amount with VAT: €{(parseFloat(pricingDetails.agreedPrice || 0) * 1.21).toFixed(2)})
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Payment Status:</label>
            <span className={getStatusStyles(determinePaymentStatus(pricingDetails))}>
              {determinePaymentStatus(pricingDetails)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientPaymentForm;