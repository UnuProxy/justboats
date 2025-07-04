import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const InvoiceGenerator = () => {
  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).split('/').join('.');
  
  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    description: '',
    unitPrice: '',
    discount: '0',
  });

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

  const total = items.reduce((sum, item) => {
    const discountedPriceInclVat = item.unitPrice - (item.unitPrice * item.discount / 100);
    return sum + discountedPriceInclVat;
  }, 0);

  const vat = Math.round((total * 0.21 / 1.21) * 100) / 100;
  const subtotal = Math.round((total / 1.21) * 100) / 100;
  
  const formatCurrency = (amount) => {
    const roundedAmount = Math.round(amount * 100) / 100;
    return `€ ${roundedAmount.toFixed(2)}`;
  };
  
  const invoiceRef = useRef(null);
  
  const downloadInvoice = async () => {
    if (!invoiceRef.current) return;
    
    const button = document.getElementById('download-btn');
    if (!button) return;
    
    const originalText = button.innerText;
    button.innerText = 'Processing...';
    button.disabled = true;
    
    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        ignoreElements: (element) => {
          return element.classList?.contains('no-print');
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
      let heightLeft = imgHeight;
      let position = 0;
      
      while (heightLeft > pageHeight) {
        position = heightLeft - pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      const filename = invoiceData.invoiceNumber 
        ? `just-enjoy-ibiza-invoice-${invoiceData.invoiceNumber}.pdf` 
        : `just-enjoy-ibiza-invoice-${currentDate.replace(/\./g, '-')}.pdf`;
        
      pdf.save(filename);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('An error occurred while generating the PDF. Please try again.');
    } finally {
      if (button) {
        button.innerText = originalText;
        button.disabled = false;
      }
    }
  };
  
  const printInvoice = () => {
    window.print();
  };

  const toggleClientForm = () => {
    setShowClientForm(!showClientForm);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* Control Panel */}
      <div style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '16px 0' }} className="no-print">
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', margin: 0 }}>Invoice Generator</h1>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={toggleClientForm}
              style={{ 
                padding: '8px 16px', 
                border: '1px solid #d1d5db', 
                backgroundColor: '#ffffff', 
                color: '#374151',
                cursor: 'pointer',
                fontSize: '14px',
                borderRadius: '6px'
              }}
            >
              {showClientForm ? 'Hide Client' : 'Add Client'}
            </button>
            <button 
              onClick={printInvoice}
              style={{ 
                padding: '8px 16px', 
                border: '1px solid #d1d5db', 
                backgroundColor: '#ffffff', 
                color: '#374151',
                cursor: 'pointer',
                fontSize: '14px',
                borderRadius: '6px'
              }}
            >
              Print
            </button>
            <button 
              id="download-btn"
              onClick={downloadInvoice}
              style={{ 
                padding: '8px 16px', 
                border: 'none', 
                backgroundColor: '#2563eb', 
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '14px',
                borderRadius: '6px'
              }}
            >
              Download PDF
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        
        {/* Client Form */}
        {showClientForm && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', marginBottom: '24px', borderRadius: '8px' }} className="no-print">
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '500', color: '#111827', margin: 0 }}>Client Details</h2>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Client Name</label>
                  <input
                    type="text"
                    name="name"
                    value={clientData.name}
                    onChange={handleClientInputChange}
                    placeholder="Full Name"
                    style={{ 
                      width: '100%', 
                      padding: '8px 12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                      color: '#111827'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Company</label>
                  <input
                    type="text"
                    name="companyName"
                    value={clientData.companyName}
                    onChange={handleClientInputChange}
                    placeholder="Company Name"
                    style={{ 
                      width: '100%', 
                      padding: '8px 12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                      color: '#111827'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Tax ID</label>
                  <input
                    type="text"
                    name="taxId"
                    value={clientData.taxId}
                    onChange={handleClientInputChange}
                    placeholder="Tax/VAT Number"
                    style={{ 
                      width: '100%', 
                      padding: '8px 12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                      color: '#111827'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={clientData.email}
                    onChange={handleClientInputChange}
                    placeholder="email@example.com"
                    style={{ 
                      width: '100%', 
                      padding: '8px 12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                      color: '#111827'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Phone</label>
                  <input
                    type="text"
                    name="phone"
                    value={clientData.phone}
                    onChange={handleClientInputChange}
                    placeholder="Phone Number"
                    style={{ 
                      width: '100%', 
                      padding: '8px 12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                      color: '#111827'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Address</label>
                  <input
                    type="text"
                    name="address"
                    value={clientData.address}
                    onChange={handleClientInputChange}
                    placeholder="Street Address"
                    style={{ 
                      width: '100%', 
                      padding: '8px 12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                      color: '#111827'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>City</label>
                  <input
                    type="text"
                    name="city"
                    value={clientData.city}
                    onChange={handleClientInputChange}
                    placeholder="City"
                    style={{ 
                      width: '100%', 
                      padding: '8px 12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                      color: '#111827'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Postal Code</label>
                  <input
                    type="text"
                    name="postalCode"
                    value={clientData.postalCode}
                    onChange={handleClientInputChange}
                    placeholder="Postal Code"
                    style={{ 
                      width: '100%', 
                      padding: '8px 12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                      color: '#111827'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Country</label>
                  <input
                    type="text"
                    name="country"
                    value={clientData.country}
                    onChange={handleClientInputChange}
                    placeholder="Country"
                    style={{ 
                      width: '100%', 
                      padding: '8px 12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                      color: '#111827'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Invoice */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', minHeight: '297mm' }}>
          <div ref={invoiceRef} className="invoice-to-print">
            
            {/* Header */}
            <div style={{ padding: '48px 48px 32px 48px', borderBottom: '3px solid #2563eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                    <div style={{ width: '8px', height: '8px', backgroundColor: '#2563eb', borderRadius: '50%', marginRight: '12px' }}></div>
                    <h1 style={{ fontSize: '28px', fontWeight: '300', color: '#111827', margin: 0 }}>Just Enjoy Ibiza</h1>
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
                    <p style={{ margin: '0 0 4px 0' }}>Av. Sant Jordi 48/52</p>
                    <p style={{ margin: '0 0 4px 0' }}>CIF: B56880875</p>
                    <p style={{ margin: '0' }}>Ibiza, Spain</p>
                  </div>
                </div>
                
                <div style={{ textAlign: 'right' }}>
                  <h2 style={{ fontSize: '48px', fontWeight: '300', color: '#111827', margin: '0 0 16px 0' }}>INVOICE</h2>
                  <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>{currentDate}</p>
                </div>
              </div>
            </div>

            {/* Details */}
            <div style={{ padding: '32px 48px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', marginBottom: '32px' }}>
                
                {/* Invoice Details */}
                <div>
                  <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>Invoice Details</h3>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Invoice Date</label>
                    <input 
                      type="date" 
                      name="invoiceDate" 
                      value={invoiceData.invoiceDate} 
                      onChange={handleInputChange} 
                      style={{ 
                        display: 'block',
                        width: '100%',
                        maxWidth: '300px',
                        padding: '10px 12px', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '6px',
                        fontSize: '14px',
                        backgroundColor: '#ffffff',
                        color: '#111827'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Invoice Number</label>
                    <input 
                      type="text" 
                      name="invoiceNumber" 
                      value={invoiceData.invoiceNumber} 
                      onChange={handleInputChange} 
                      placeholder="JEI-00000" 
                      style={{ 
                        display: 'block',
                        width: '100%',
                        maxWidth: '300px',
                        padding: '10px 12px', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '6px',
                        fontSize: '14px',
                        backgroundColor: '#ffffff',
                        color: '#111827'
                      }}
                    />
                  </div>
                </div>

                {/* Client Info */}
                {(clientData.name || clientData.companyName) && (
                  <div>
                    <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>Bill To</h3>
                    <div style={{ color: '#374151', fontSize: '14px', lineHeight: '1.6' }}>
                      {clientData.name && <p style={{ fontWeight: '600', color: '#111827', margin: '0 0 8px 0' }}>{clientData.name}</p>}
                      {clientData.companyName && <p style={{ fontWeight: '500', margin: '0 0 8px 0' }}>{clientData.companyName}</p>}
                      {clientData.taxId && <p style={{ margin: '0 0 8px 0' }}>Tax ID: {clientData.taxId}</p>}
                      {clientData.address && <p style={{ margin: '0 0 4px 0' }}>{clientData.address}</p>}
                      {(clientData.city || clientData.postalCode) && (
                        <p style={{ margin: '0 0 4px 0' }}>
                          {clientData.city}
                          {clientData.city && clientData.postalCode && ', '}
                          {clientData.postalCode}
                        </p>
                      )}
                      {clientData.country && <p style={{ margin: '0 0 8px 0' }}>{clientData.country}</p>}
                      {clientData.email && <p style={{ margin: '0 0 4px 0' }}>{clientData.email}</p>}
                      {clientData.phone && <p style={{ margin: '0' }}>{clientData.phone}</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* Add Item Form */}
              <div style={{ padding: '24px', backgroundColor: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '32px' }} className="no-print">
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 120px', gap: '16px', alignItems: 'end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Description</label>
                    <input
                      type="text"
                      placeholder="Yacht charter service..."
                      name="description"
                      value={invoiceData.description}
                      onChange={handleInputChange}
                      style={{ 
                        width: '100%', 
                        padding: '8px 12px', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '6px',
                        fontSize: '14px',
                        backgroundColor: '#ffffff',
                        color: '#111827'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Price (VAT incl.)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      name="unitPrice"
                      value={invoiceData.unitPrice}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      style={{ 
                        width: '100%', 
                        padding: '8px 12px', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '6px',
                        fontSize: '14px',
                        backgroundColor: '#ffffff',
                        color: '#111827'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Discount %</label>
                    <input
                      type="number"
                      placeholder="0"
                      name="discount"
                      value={invoiceData.discount}
                      onChange={handleInputChange}
                      min="0"
                      max="100"
                      style={{ 
                        width: '100%', 
                        padding: '8px 12px', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '6px',
                        fontSize: '14px',
                        backgroundColor: '#ffffff',
                        color: '#111827'
                      }}
                    />
                  </div>
                  <button 
                    onClick={addItem}
                    disabled={!invoiceData.description || !invoiceData.unitPrice}
                    style={{ 
                      padding: '9px 16px', 
                      border: 'none', 
                      backgroundColor: !invoiceData.description || !invoiceData.unitPrice ? '#9ca3af' : '#2563eb', 
                      color: '#ffffff',
                      cursor: !invoiceData.description || !invoiceData.unitPrice ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      borderRadius: '6px'
                    }}
                  >
                    Add Item
                  </button>
                </div>
              </div>

              {/* Items */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', marginBottom: '32px' }}>
                <div style={{ backgroundColor: '#f9fafb', padding: '16px 24px', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 120px 80px 120px 120px', gap: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <div>#</div>
                    <div>Description</div>
                    <div style={{ textAlign: 'right' }}>Price (VAT incl.)</div>
                    <div style={{ textAlign: 'right' }}>Discount</div>
                    <div style={{ textAlign: 'right' }}>VAT (21%)</div>
                    <div style={{ textAlign: 'right' }}>Total</div>
                  </div>
                </div>
                
                {items.length === 0 ? (
                  <div style={{ padding: '48px 24px', textAlign: 'center', color: '#9ca3af' }}>
                    <p style={{ margin: '0 0 4px 0' }}>No items added yet</p>
                    <p style={{ fontSize: '12px', margin: 0 }}>Add your first service using the form above</p>
                  </div>
                ) : (
                  items.map((item, index) => {
                    const discountedPriceInclVat = item.unitPrice - (item.unitPrice * item.discount / 100);
                    const itemVat = Math.round((discountedPriceInclVat * 0.21 / 1.21) * 100) / 100;
                    const totalAmount = discountedPriceInclVat;
                    
                    return (
                      <div key={`item-${item.id}`} style={{ padding: '16px 24px', borderBottom: '1px solid #f3f4f6', backgroundColor: '#ffffff' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 120px 80px 120px 120px', gap: '16px', alignItems: 'center', fontSize: '14px' }}>
                          <div style={{ color: '#111827', fontWeight: '500' }}>{index + 1}</div>
                          <div style={{ color: '#111827' }}>{item.description}</div>
                          <div style={{ textAlign: 'right', color: '#111827', fontWeight: '500' }}>{formatCurrency(item.unitPrice)}</div>
                          <div style={{ textAlign: 'right', color: '#6b7280' }}>{item.discount > 0 ? `${item.discount}%` : '—'}</div>
                          <div style={{ textAlign: 'right', color: '#6b7280' }}>{formatCurrency(itemVat)}</div>
                          <div style={{ textAlign: 'right', color: '#111827', fontWeight: '600' }}>{formatCurrency(totalAmount)}</div>
                          <div className="no-print" style={{ textAlign: 'center' }}>
                            <button 
                              onClick={() => removeItem(item.id)} 
                              style={{ 
                                color: '#ef4444', 
                                backgroundColor: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '18px',
                                padding: '4px'
                              }}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              
              {/* Totals */}
              {items.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
                  <div style={{ width: '320px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px' }}>
                    <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: '#6b7280' }}>Subtotal (excl. VAT)</span>
                      <span style={{ color: '#111827', fontWeight: '500' }}>{formatCurrency(subtotal)}</span>
                    </div>
                    <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: '#6b7280' }}>VAT (21%)</span>
                      <span style={{ color: '#111827', fontWeight: '500' }}>{formatCurrency(vat)}</span>
                    </div>
                    <div style={{ paddingTop: '12px', borderTop: '1px solid #d1d5db', display: 'flex', justifyContent: 'space-between', fontSize: '18px' }}>
                      <span style={{ color: '#111827', fontWeight: '600' }}>Total Amount</span>
                      <span style={{ color: '#2563eb', fontWeight: '700' }}>{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ marginTop: 'auto', padding: '32px 48px', backgroundColor: '#f8fafc', borderTop: '1px solid #e5e7eb' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>Payment Information</h3>
                  <div style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
                    
                    <p style={{ margin: '0 0 8px 0', fontWeight: '500' }}>Payment terms: Net 30 days from invoice date</p>
                    <p style={{ margin: '0' }}>All payments should include the invoice number as reference</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>Thank You</h3>
                  <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6', margin: '0' }}>Thank you for choosing Just Enjoy Ibiza for your luxury yacht experience.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceGenerator;