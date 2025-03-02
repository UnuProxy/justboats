import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const InvoiceGenerator = () => {
  // Format current date in DD.MM.YYYY format for default invoice date
  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).split('/').join('.');
  
  // Format a date string from yyyy-mm-dd to dd-mm-yyyy
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
  };
  
  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0], // ISO format for date input
    description: '',
    unitPrice: '',
    discount: '0',
  });

  // Add client details state
  const [clientData, setClientData] = useState({
    name: '',
    companyName: '',
    address: '',
    city: '',
    postalCode: '',
    country: '',
    email: '',
    phone: '',
    taxId: ''
  });

  const [items, setItems] = useState([]);
  const [showClientForm, setShowClientForm] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInvoiceData({
      ...invoiceData,
      [name]: value
    });
  };

  const handleClientInputChange = (e) => {
    const { name, value } = e.target;
    setClientData({
      ...clientData,
      [name]: value
    });
  };

  const addItem = () => {
    if (!invoiceData.description || !invoiceData.unitPrice) return;
    
    const newItem = {
      id: Date.now(),
      description: invoiceData.description,
      unitPrice: parseFloat(invoiceData.unitPrice),
      discount: parseFloat(invoiceData.discount) || 0,
    };
    
    setItems([...items, newItem]);
    
    // Clear form fields
    setInvoiceData({
      ...invoiceData,
      description: '',
      unitPrice: '',
      discount: '0',
    });
  };

  const removeItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  // Calculate subtotal, VAT, and total
  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice - (item.unitPrice * item.discount / 100)), 0);
  const vat = subtotal * 0.21;
  const total = subtotal + vat;
  
  // Reference to the invoice content for PDF generation
  const invoiceRef = useRef(null);
  
  // Function to generate and download PDF
  const downloadInvoice = async () => {
    if (invoiceRef.current) {
      // Show loading indication
      const button = document.getElementById('download-btn');
      const originalText = button.innerText;
      button.innerText = 'Processing...';
      button.disabled = true;
      
      // Find all elements to hide in PDF and save their original display state
      const elementsToHide = invoiceRef.current.querySelectorAll('.no-print');
      const originalDisplays = [];
      
      try {
        // Hide elements that shouldn't be in the PDF
        elementsToHide.forEach(el => {
          originalDisplays.push(el.style.display);
          el.style.display = 'none';
        });
        
        // Make sure print-only elements are visible
        const printElements = invoiceRef.current.querySelectorAll('.print-only');
        printElements.forEach(el => {
          el.style.display = 'block';
        });
        
        const canvas = await html2canvas(invoiceRef.current, {
          scale: 2,
          useCORS: true,
          logging: false
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });
        
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        
        // If content exceeds a page, add more pages
        let heightLeft = imgHeight;
        let position = 0;
        
        while (heightLeft > pageHeight) {
          position = heightLeft - pageHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, -position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
        
        // Generate filename based on invoice number or date
        const filename = invoiceData.invoiceNumber 
          ? `just-enjoy-ibiza-invoice-${invoiceData.invoiceNumber}.pdf` 
          : `just-enjoy-ibiza-invoice-${currentDate.replace(/\./g, '-')}.pdf`;
          
        pdf.save(filename);
      } catch (error) {
        console.error('Error generating PDF:', error);
        alert('An error occurred while generating the PDF. Please try again.');
      } finally {
        // Restore visibility of hidden elements
        elementsToHide.forEach((el, index) => {
          el.style.display = originalDisplays[index] || '';
        });
        
        // Reset button
        button.innerText = originalText;
        button.disabled = false;
      }
    }
  };
  
  // Function to handle direct printing
  const printInvoice = () => {
    window.print();
  };

  // Toggle client form visibility
  const toggleClientForm = () => {
    setShowClientForm(!showClientForm);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 w-full mx-auto">
      {/* Action buttons for printing and downloading */}
      <div className="flex flex-col sm:flex-row sm:justify-end mb-4 gap-2 sm:gap-4 no-print">
        <button 
          onClick={toggleClientForm}
          className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition-colors w-full sm:w-auto"
        >
          {showClientForm ? 'Hide Client Details' : 'Add Client Details'}
        </button>
        <button 
          onClick={printInvoice} 
          className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors w-full sm:w-auto"
        >
          Print Invoice
        </button>
        <button 
          id="download-btn"
          onClick={downloadInvoice} 
          className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors w-full sm:w-auto"
        >
          Download as PDF
        </button>
      </div>
      
      {/* Client Details Form */}
      {showClientForm && (
        <div className="mb-6 p-4 border border-gray-200 rounded-md bg-gray-50 no-print">
          <h2 className="text-lg font-bold mb-4">Client Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Client Name</label>
              <input
                type="text"
                name="name"
                value={clientData.name}
                onChange={handleClientInputChange}
                className="border p-2 w-full rounded"
                placeholder="Full Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Company Name</label>
              <input
                type="text"
                name="companyName"
                value={clientData.companyName}
                onChange={handleClientInputChange}
                className="border p-2 w-full rounded"
                placeholder="Company Name (optional)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tax ID / VAT Number</label>
              <input
                type="text"
                name="taxId"
                value={clientData.taxId}
                onChange={handleClientInputChange}
                className="border p-2 w-full rounded"
                placeholder="Tax ID / VAT Number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={clientData.email}
                onChange={handleClientInputChange}
                className="border p-2 w-full rounded"
                placeholder="Email Address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                type="text"
                name="phone"
                value={clientData.phone}
                onChange={handleClientInputChange}
                className="border p-2 w-full rounded"
                placeholder="Phone Number"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Address</label>
              <input
                type="text"
                name="address"
                value={clientData.address}
                onChange={handleClientInputChange}
                className="border p-2 w-full rounded"
                placeholder="Street Address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">City</label>
              <input
                type="text"
                name="city"
                value={clientData.city}
                onChange={handleClientInputChange}
                className="border p-2 w-full rounded"
                placeholder="City"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Postal Code</label>
              <input
                type="text"
                name="postalCode"
                value={clientData.postalCode}
                onChange={handleClientInputChange}
                className="border p-2 w-full rounded"
                placeholder="Postal / Zip Code"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Country</label>
              <input
                type="text"
                name="country"
                value={clientData.country}
                onChange={handleClientInputChange}
                className="border p-2 w-full rounded"
                placeholder="Country"
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Invoice content to be captured for PDF */}
      <div ref={invoiceRef} className="bg-white p-4 sm:p-6 invoice-to-print">
        <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Invoice</h1>
        <p className="mb-4">{currentDate}</p>
        
        <div className="flex flex-col sm:flex-row sm:justify-between mb-6 sm:mb-8 gap-4">
          {/* Sender Information */}
          <div>
            <h1 className="text-lg sm:text-xl font-bold">Just Enjoy Ibiza</h1>
            <p>Av. Sant Jordi 48/52</p>
            <p>CIF: B56880875</p>
            <p>Ibiza, Spain</p>
          </div>
          
          {/* Invoice Details */}
          <div className="sm:text-right mt-4 sm:mt-0">
            <p className="mb-2">Invoice Date</p>
            <div className="mb-4 relative">
              <input 
                type="date" 
                name="invoiceDate" 
                value={invoiceData.invoiceDate} 
                onChange={handleInputChange} 
                className="border p-1 w-full sm:w-48 no-print" 
              />
              <p className="block no-print">
                {formatDateForDisplay(invoiceData.invoiceDate)}
              </p>
              <p className="hidden print-only">
                {formatDateForDisplay(invoiceData.invoiceDate)}
              </p>
            </div>
            <p className="mb-2">Invoice Number</p>
            <div>
              <input 
                type="text" 
                name="invoiceNumber" 
                value={invoiceData.invoiceNumber} 
                onChange={handleInputChange} 
                placeholder="JEI-00000" 
                className="border p-1 w-full sm:w-48" 
              />
            </div>
          </div>
        </div>

        {/* Client Information - This will display whether or not the client form is visible */}
        {(clientData.name || clientData.companyName) && (
          <div className="mb-6 border-t border-gray-200 pt-4">
            <h2 className="text-lg font-bold mb-2">Bill To:</h2>
            {clientData.name && <p>{clientData.name}</p>}
            {clientData.companyName && <p>{clientData.companyName}</p>}
            {clientData.taxId && <p>Tax ID: {clientData.taxId}</p>}
            {clientData.address && <p>{clientData.address}</p>}
            {(clientData.city || clientData.postalCode) && (
              <p>
                {clientData.city}
                {clientData.city && clientData.postalCode && ', '}
                {clientData.postalCode}
              </p>
            )}
            {clientData.country && <p>{clientData.country}</p>}
            {clientData.email && <p>Email: {clientData.email}</p>}
            {clientData.phone && <p>Phone: {clientData.phone}</p>}
          </div>
        )}

        {/* Responsive Table for Items */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-full">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-3 px-2">Item</th>
                <th className="text-left py-3 px-2">Description</th>
                <th className="text-right py-3 px-2">Unit price</th>
                <th className="text-right py-3 px-2">Discount</th>
                <th className="text-right py-3 px-2">VAT (21%)</th>
                <th className="text-right py-3 px-2">Amount EUR</th>
                <th className="text-center py-3 px-2 no-print">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const itemAmount = item.unitPrice - (item.unitPrice * item.discount / 100);
                const itemVat = itemAmount * 0.21;
                
                return (
                  <tr key={item.id} className="border-b border-gray-200">
                    <td className="py-3 px-2">{index + 1}</td>
                    <td className="py-3 px-2">{item.description}</td>
                    <td className="py-3 px-2 text-right">€ {item.unitPrice.toFixed(2)}</td>
                    <td className="py-3 px-2 text-right">{item.discount > 0 ? `${item.discount}%` : '-'}</td>
                    <td className="py-3 px-2 text-right">€ {itemVat.toFixed(2)}</td>
                    <td className="py-3 px-2 text-right">€ {itemAmount.toFixed(2)}</td>
                    <td className="py-3 px-2 text-center no-print">
                      <button onClick={() => removeItem(item.id)} className="text-red-500">
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Mobile-friendly Add item form */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 no-print">
          <input
            type="text"
            placeholder="Description"
            name="description"
            value={invoiceData.description}
            onChange={handleInputChange}
            className="border p-2 sm:col-span-2"
          />
          <input
            type="number"
            placeholder="Unit Price"
            name="unitPrice"
            value={invoiceData.unitPrice}
            onChange={handleInputChange}
            className="border p-2"
            min="0"
            step="0.01"
          />
          <input
            type="number"
            placeholder="Discount %"
            name="discount"
            value={invoiceData.discount}
            onChange={handleInputChange}
            className="border p-2"
            min="0"
            max="100"
          />
          <button 
            onClick={addItem} 
            className="bg-blue-500 text-white py-2 px-4 rounded"
          >
            Add Item
          </button>
        </div>

        {/* Totals Section */}
        <div className="mt-8 flex justify-end">
          <div className="w-full sm:w-64">
            <div className="flex justify-between border-t border-gray-300 pt-3 pb-2">
              <span className="font-medium">Subtotal</span>
              <span className="pl-4">€ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-300 pt-3 pb-2">
              <span className="font-medium">VAT</span>
              <span className="pl-4">€ {vat.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-b border-gray-300 py-3">
              <span className="font-bold">Total</span>
              <span className="font-bold pl-4">€ {total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer Section */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
          <div>
            <h3 className="font-bold mb-2">Contact Information:</h3>
            <p>For any queries regarding this invoice, please contact us at:</p>
            <p>Email: info@justenjoyibiza.com</p>
            <p>Phone: +34 692 688 348</p>
            <p>Address: 48/52 Av.Sant Jordi,</p>
            <p>Ibiza, 07800, Spain</p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p>Thank you for your business and we look forward to working with you soon.</p>
        </div>
      </div>
    </div>
  );
};

export default InvoiceGenerator;