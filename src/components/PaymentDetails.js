import React from 'react';
import PropTypes from 'prop-types';
import { format } from 'date-fns';

const PaymentDetails = ({ 
  payments = [],
  pricingType,
  agreedPrice,
  totalPaid,
  paymentStatus,
  isEditing,
  onPaymentChange 
}) => {
  return (
    <div className="p-4 border rounded-lg">
      <h4 className="text-lg font-bold mb-4">Payment Details</h4>
      
      {/* First Payment */}
      <div className="bg-blue-50 p-4 rounded-lg mb-4">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-lg font-semibold">First Payment</h4>
          
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Amount:</label>
            <p className="text-lg font-semibold">
              €{Number(payments[0]?.amount || 0).toFixed(2)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Method:</label>
            {isEditing ? (
              <select
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                value={payments[0]?.method || 'cash'}
                onChange={(e) => onPaymentChange(0, { method: e.target.value })}
              >
                <option value="cash">Cash</option>
                <option value="pos">POS</option>
                <option value="transfer">Bank Transfer</option>
                <option value="Sabadell_link">Sabadell Link</option>
              </select>
            ) : (
              <p className="mt-1 capitalize">{payments[0]?.method || 'N/A'}</p>
            )}
          </div>
          

          <div>
            <label className="block text-sm font-medium text-gray-700">Payment Date:</label>
            {isEditing ? (
              <input
                type="date"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                value={payments[0]?.date || ''}
                onChange={(e) => onPaymentChange(0, { date: e.target.value })}
                disabled={!payments[0]?.received}
              />
            ) : (
              <p className="mt-1">
                {payments[0]?.date ? 
                  format(new Date(payments[0].date), 'dd/MM/yyyy') : 
                  'N/A'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">VAT Status:</label>
            {isEditing ? (
              <label className="flex items-center space-x-2 mt-1">
                <input
                  type="checkbox"
                  checked={payments[0]?.excludeVAT || false}
                  onChange={(e) => onPaymentChange(0, { excludeVAT: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">Exclude VAT</span>
              </label>
            ) : (
              <p className="mt-1">
                {payments[0]?.excludeVAT ? 'VAT Excluded' : 'VAT Included'}
              </p>
            )}
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">Status:</label>
            {isEditing ? (
              <label className="flex items-center space-x-2 mt-1">
                <input
                  type="checkbox"
                  checked={payments[0]?.received || false}
                  onChange={(e) => onPaymentChange(0, { 
                    received: e.target.checked,
                    date: e.target.checked ? new Date().toISOString().split('T')[0] : ''
                  })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">Payment Received</span>
              </label>
            ) : (
              <div className="mt-1">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                  ${payments[0]?.received ? 
                    'bg-green-100 text-green-800' : 
                    'bg-yellow-100 text-yellow-800'}`}>
                  {payments[0]?.received ? 'Received' : 'Pending'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Second Payment */}
      <div className="bg-green-50 p-4 rounded-lg mb-4">
        <h4 className="text-lg font-semibold mb-4">Second Payment</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Amount:</label>
            <p className="text-lg font-semibold">
              €{Number(payments[1]?.amount || 0).toFixed(2)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Method:</label>
            {isEditing ? (
              <select
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                value={payments[1]?.method || 'pos'}
                onChange={(e) => onPaymentChange(1, { method: e.target.value })}
              >
                <option value="pos">POS</option>
                <option value="cash">Cash</option>
                <option value="transfer">Bank Transfer</option>
                <option value="Sabadell_link">Sabadell Link</option>
              </select>
            ) : (
              <p className="mt-1 capitalize">{payments[1]?.method || 'N/A'}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Payment Date:</label>
            {isEditing ? (
              <input
                type="date"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                value={payments[1]?.date || ''}
                onChange={(e) => onPaymentChange(1, { date: e.target.value })}
                disabled={!payments[1]?.received}
              />
            ) : (
              <p className="mt-1">
                {payments[1]?.date ? 
                  format(new Date(payments[1].date), 'dd/MM/yyyy') : 
                  'N/A'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">VAT Status:</label>
            {isEditing ? (
              <label className="flex items-center space-x-2 mt-1">
                <input
                  type="checkbox"
                  checked={payments[1]?.excludeVAT || false}
                  onChange={(e) => onPaymentChange(1, { excludeVAT: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">Exclude VAT</span>
              </label>
            ) : (
              <p className="mt-1">
                {payments[1]?.excludeVAT ? 'VAT Excluded' : 'VAT Included'}
              </p>
            )}
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">Status:</label>
            {isEditing ? (
              <label className="flex items-center space-x-2 mt-1">
                <input
                  type="checkbox"
                  checked={payments[1]?.received || false}
                  onChange={(e) => onPaymentChange(1, { 
                    received: e.target.checked,
                    date: e.target.checked ? new Date().toISOString().split('T')[0] : ''
                  })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">Payment Received</span>
              </label>
            ) : (
              <div className="mt-1">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                  ${payments[1]?.received ? 
                    'bg-green-100 text-green-800' : 
                    'bg-yellow-100 text-yellow-800'}`}>
                  {payments[1]?.received ? 'Received' : 'Pending'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Summary */}
<div className="bg-gray-50 p-4 rounded-lg">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label className="block text-sm font-medium text-gray-700">Pricing Type:</label>
      <p className="text-lg font-semibold capitalize">{pricingType || 'Standard'}</p>
    </div>

    <div>
  <label className="block text-sm font-medium text-gray-700">Total Agreed Price:</label>
  <p className="text-lg font-semibold">
    €{pricingType === 'custom' 
      ? Number(payments.reduce((sum, payment) => sum + (Number(payment?.amount) || 0), 0)).toFixed(2)
      : Number(agreedPrice || payments.reduce((sum, payment) => sum + (Number(payment?.amount) || 0), 0)).toFixed(2)}
  </p>
</div>

    <div>
      <label className="block text-sm font-medium text-gray-700">Total Paid:</label>
      <p className="text-lg font-semibold">€{Number(totalPaid || 0).toFixed(2)}</p>
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700">Payment Status:</label>
      <div className="mt-1">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
          ${paymentStatus === 'Completed' ? 'bg-green-100 text-green-800' :
            paymentStatus === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'}`}>
          {paymentStatus || "No Payment"}
        </span>
      </div>
    </div>
  </div>
</div>
      </div>
    
  );
};

PaymentDetails.propTypes = {
  payments: PropTypes.arrayOf(PropTypes.shape({
    amount: PropTypes.number,
    method: PropTypes.string,
    received: PropTypes.bool,
    date: PropTypes.string,
    excludeVAT: PropTypes.bool,
    percentage: PropTypes.number,
    type: PropTypes.string
  })),
  pricingType: PropTypes.string,
  agreedPrice: PropTypes.number,
  totalPaid: PropTypes.number,
  paymentStatus: PropTypes.string,
  isEditing: PropTypes.bool.isRequired,
  onPaymentChange: PropTypes.func.isRequired
};

export default PaymentDetails;