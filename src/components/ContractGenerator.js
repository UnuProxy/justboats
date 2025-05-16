import React, { useState, useRef, useEffect } from 'react';
import {
  FileText, Ship, User, Calendar, Euro,
  Check, Trash2, Save, Printer, ChevronDown,
  List, Download, XCircle, Search
} from 'lucide-react';

// Mock database functions – replace with your real implementation
const db = {
  saveContract: async (contractData) => {
    const savedContracts = JSON.parse(localStorage.getItem('savedContracts') || '[]');
    const contractId = `contract-${Date.now()}`;
    const contractWithId = {
      id: contractId,
      ...contractData,
      createdAt: new Date().toISOString(),
      lessorSignature: 'SEA CHARTER IBIZA GESTIÓN Y SERVICIOS'
    };
    savedContracts.push(contractWithId);
    localStorage.setItem('savedContracts', JSON.stringify(savedContracts));
    return contractId;
  },

  getContracts: async () => {
    const savedContracts = JSON.parse(localStorage.getItem('savedContracts') || '[]');
    return savedContracts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  getContractById: async (id) => {
    const savedContracts = JSON.parse(localStorage.getItem('savedContracts') || '[]');
    return savedContracts.find(c => c.id === id);
  }
};

const ContractGenerator = () => {
  const contractRef = useRef(null);

  // UI state
  const [showSavedContracts, setShowSavedContracts] = useState(false);
  const [savedContracts, setSavedContracts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [contractSaved, setContractSaved] = useState(false);
  const [contractSaveId, setContractSaveId] = useState(null);

  // Boat options
  const boatOptions = [
    { id: 'monterey268',   brand: 'Monterey',     model: '268', plate: 'IB-12345', fuelConsumption: '30–40 litres' },
    { id: 'seaRay290',     brand: 'Sea Ray',      model: '290', plate: 'IB-67890', fuelConsumption: '35–45 litres' },
    { id: 'quicksilver607', brand: 'QuickSilver', model: '607', plate: 'IB-24680', fuelConsumption: '20–25 litres' }
  ];

  // Helpers
  function generateContractNumber() {
    const prefix = 'JEI';
    const year = new Date().getFullYear();
    const random = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}-${year}-${random}`;
  }

  function formatDate(date) {
    return date.toLocaleDateString('en-GB');
  }

  // Form data state
  const [contractData, setContractData] = useState({
    contractNumber: generateContractNumber(),
    date: formatDate(new Date()),
    selectedBoat: boatOptions[0],
    lessee: { name: '', address: '', addressDuringTrip: '', identification: '', phone: '' },
    skipper: {
      name: '', address: '', addressDuringTrip: '',
      identification: '', phone: '', navigationTitle: '', navigationNumber: ''
    },
    checkIn: { date: formatDate(new Date()), time: '10:00' },
    checkOut: { date: formatDate(new Date(Date.now() + 86400000)), time: '18:00' },
    price: { rental: '', otherServices: [], total: '', deposit: '' }
  });

  const [otherService, setOtherService] = useState({ name: '', price: '' });

  // Load saved contracts when requested
  useEffect(() => {
    if (showSavedContracts) loadSavedContracts();
  }, [showSavedContracts]);

  const loadSavedContracts = async () => {
    try {
      const contracts = await db.getContracts();
      setSavedContracts(contracts);
    } catch (err) {
      console.error('Error loading saved contracts:', err);
    }
  };

  const loadContract = async (id) => {
    try {
      const c = await db.getContractById(id);
      if (c) {
        setContractData(c);
        setShowSavedContracts(false);
        setContractSaved(true);
        setContractSaveId(id);
      }
    } catch (err) {
      console.error('Error loading contract:', err);
    }
  };

  const saveContract = async () => {
    if (!contractData.lessee.name || !contractData.price.rental || !contractData.price.deposit) {
      alert('Please fill in required fields: Lessee Name, Rental Price and Deposit');
      return;
    }
    try {
      const toSave = {
        ...contractData,
        lessorSignature: 'SEA CHARTER IBIZA GESTIÓN Y SERVICIOS',
        createdAt: new Date().toISOString()
      };
      const id = await db.saveContract(toSave);
      setContractSaved(true);
      setContractSaveId(id);
      alert('Contract saved successfully!');
      if (showSavedContracts) loadSavedContracts();
    } catch (err) {
      console.error('Error saving contract:', err);
      alert('Error saving contract. Please try again.');
    }
  };

  const handleChange = (section, field, value) => {
    setContractData(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }));
  };

  const handleBoatChange = (boatId) => {
    const b = boatOptions.find(x => x.id === boatId);
    setContractData(prev => ({ ...prev, selectedBoat: b }));
  };

  const handleAddService = () => {
    if (otherService.name && otherService.price) {
      setContractData(prev => ({
        ...prev,
        price: {
          ...prev.price,
          otherServices: [...prev.price.otherServices, otherService]
        }
      }));
      setOtherService({ name: '', price: '' });
    }
  };

  const handleRemoveService = (i) => {
    setContractData(prev => ({
      ...prev,
      price: {
        ...prev.price,
        otherServices: prev.price.otherServices.filter((_, idx) => idx !== i)
      }
    }));
  };

  const handlePrint = () => {
    if (!contractRef.current) return;
    const printContents = contractRef.current.innerHTML;
    const original = document.body.innerHTML;
    document.body.innerHTML = `
      <html>
        <head>
          <title>Boat Rental Contract - ${contractData.contractNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: .5in; }
            h1 { text-align: center; }
            .page-break { page-break-before: always; }
            table { width:100%; border-collapse:collapse; }
            th,td { text-align:left; padding:8px; border-bottom:1px solid #ddd; }
            @media print { .no-print { display:none; } }
          </style>
        </head>
        <body>${printContents}</body>
      </html>
    `;
    window.print();
    document.body.innerHTML = original;
    setTimeout(() => window.location.reload(), 100);
  };

  // Filter logic for saved contracts
  const filteredContracts = savedContracts.filter(c => {
    const term = searchTerm.toLowerCase();
    const boatName = `${c.selectedBoat?.brand} ${c.selectedBoat?.model}`.toLowerCase();
    return (
      c.lessee.name.toLowerCase().includes(term) ||
      c.contractNumber.toLowerCase().includes(term) ||
      boatName.includes(term)
    );
  });

  return (
    <div className="flex flex-col w-full p-6 bg-gray-50">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
        <FileText className="mr-2" /> Boat Rental Contract Generator
      </h1>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Form Section */}
        <div className="w-full lg:w-1/3 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-medium text-gray-700 mb-4">Contract Details</h2>

          {/* Contract # and Date */}
          <div className="mb-6">
            <div className="flex justify-between gap-4">
              <div className="w-1/2">
                <label className="block text-sm font-medium text-gray-600">Contract #</label>
                <input
                  type="text"
                  value={contractData.contractNumber}
                  readOnly
                  className="mt-1 p-2 w-full bg-gray-100 border border-gray-300 rounded-md"
                />
              </div>
              <div className="w-1/2">
                <label className="block text-sm font-medium text-gray-600">Date</label>
                <input
                  type="text"
                  value={contractData.date}
                  onChange={(e) => setContractData({ ...contractData, date: e.target.value })}
                  className="mt-1 p-2 w-full border border-gray-300 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600">Select Boat</label>
              <div className="relative">
                <select
                  value={contractData.selectedBoat.id}
                  onChange={(e) => handleBoatChange(e.target.value)}
                  className="mt-1 p-2 w-full border border-gray-300 rounded-md appearance-none"
                >
                  {boatOptions.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.brand} {b.model}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>
          </div>

          {/* Lessee Info */}
          <div className="mb-6">
            <h3 className="text-md font-medium text-gray-700 mb-2 flex items-center">
              <User size={16} className="mr-2" /> Lessee Information
            </h3>
            {[
              ['Name / Business Name', 'name'],
              ['Address', 'address'],
              ['Address During Trip', 'addressDuringTrip'],
              ['Passport / NIF', 'identification'],
              ['Phone', 'phone']
            ].map(([label, field], idx) => (
              <div key={idx} className="mb-4">
                <label className="block text-sm font-medium text-gray-600">{label}</label>
                <input
                  type="text"
                  value={contractData.lessee[field]}
                  onChange={(e) => handleChange('lessee', field, e.target.value)}
                  className="mt-1 p-2 w-full border border-gray-300 rounded-md"
                />
              </div>
            ))}
          </div>

          {/* Skipper Info */}
          <div className="mb-6">
            <h3 className="text-md font-medium text-gray-700 mb-2 flex items-center">
              <Ship size={16} className="mr-2" /> Skipper Information
            </h3>
            {[
              ['Name', 'name'],
              ['Address', 'address'],
              ['Address During Trip', 'addressDuringTrip'],
              ['DNI / NIF / Passport', 'identification'],
              ['Phone', 'phone'],
              ['Navigation Title', 'navigationTitle'],
              ['Navigation Number', 'navigationNumber']
            ].map(([label, field], idx) => (
              <div key={idx} className="mb-4">
                <label className="block text-sm font-medium text-gray-600">{label}</label>
                <input
                  type="text"
                  value={contractData.skipper[field]}
                  onChange={(e) => handleChange('skipper', field, e.target.value)}
                  className="mt-1 p-2 w-full border border-gray-300 rounded-md"
                />
              </div>
            ))}
          </div>

          {/* Rental Period */}
          <div className="mb-6">
            <h3 className="text-md font-medium text-gray-700 mb-2 flex items-center">
              <Calendar size={16} className="mr-2" /> Rental Period
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600">Check-in Date</label>
                <input
                  type="text"
                  value={contractData.checkIn.date}
                  onChange={(e) => handleChange('checkIn', 'date', e.target.value)}
                  className="mt-1 p-2 w-full border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Check-in Time</label>
                <input
                  type="text"
                  value={contractData.checkIn.time}
                  onChange={(e) => handleChange('checkIn', 'time', e.target.value)}
                  className="mt-1 p-2 w-full border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Check-out Date</label>
                <input
                  type="text"
                  value={contractData.checkOut.date}
                  onChange={(e) => handleChange('checkOut', 'date', e.target.value)}
                  className="mt-1 p-2 w-full border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Check-out Time</label>
                <input
                  type="text"
                  value={contractData.checkOut.time}
                  onChange={(e) => handleChange('checkOut', 'time', e.target.value)}
                  className="mt-1 p-2 w-full border border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>

          {/* Price */}
          <div className="mb-6">
            <h3 className="text-md font-medium text-gray-700 mb-2 flex items-center">
              <Euro size={16} className="mr-2" /> Price Information
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600">Rental Price (€)</label>
              <input
                type="number"
                value={contractData.price.rental}
                onChange={(e) => handleChange('price', 'rental', e.target.value)}
                className="mt-1 p-2 w-full border border-gray-300 rounded-md"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600">Other Services</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Service name"
                  value={otherService.name}
                  onChange={(e) => setOtherService({ ...otherService, name: e.target.value })}
                  className="p-2 flex-grow border border-gray-300 rounded-md"
                />
                <input
                  type="number"
                  placeholder="Price"
                  value={otherService.price}
                  onChange={(e) => setOtherService({ ...otherService, price: e.target.value })}
                  className="p-2 w-24 border border-gray-300 rounded-md"
                />
                <button
                  onClick={handleAddService}
                  className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  <Check size={18} />
                </button>
              </div>
              {contractData.price.otherServices.length > 0 && (
                <ul className="mt-2 border rounded-md divide-y">
                  {contractData.price.otherServices.map((svc, i) => (
                    <li key={i} className="flex justify-between items-center p-2">
                      <span>{svc.name}</span>
                      <div className="flex items-center">
                        <span className="mr-2">{parseFloat(svc.price).toFixed(2)} €</span>
                        <button
                          onClick={() => handleRemoveService(i)}
                          className="p-1 text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600">Total Price (€)</label>
              <input
                type="text"
                value={contractData.price.total}
                readOnly
                className="mt-1 p-2 w-full bg-gray-100 border border-gray-300 rounded-md font-semibold"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600">Deposit (€)</label>
              <input
                type="number"
                value={contractData.price.deposit}
                onChange={(e) => handleChange('price', 'deposit', e.target.value)}
                className="mt-1 p-2 w-full border border-gray-300 rounded-md"
              />
            </div>
          </div>

          {/* Signatures */}
          <div className="mb-6">
            <h3 className="text-md font-medium text-gray-700 mb-2">Signatures</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1">Lessor Signature</label>
              <div className="border border-gray-300 rounded-md bg-white p-3 text-center">
                <p className="font-semibold text-blue-800">SEA CHARTER IBIZA GESTIÓN Y SERVICIOS</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1">Lessee Signature</label>
              <div className="border border-gray-300 rounded-md bg-white">
                <input
                  type="text"
                  placeholder="Enter lessee full name as signature"
                  value={contractData.lesseeSignature || ''}
                  onChange={(e) => setContractData({ ...contractData, lesseeSignature: e.target.value })}
                  className="mt-1 p-3 w-full border-0 focus:ring-0"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex mt-6 gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex-1"
            >
              <Printer size={18} className="mr-2" /> Print/Download
            </button>
            <button
              onClick={saveContract}
              className="flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex-1"
            >
              <Save size={18} className="mr-2" /> Save
            </button>
            <button
              onClick={() => setShowSavedContracts(true)}
              className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex-1"
            >
              <List size={18} className="mr-2" /> View Saved
            </button>
          </div>

          {contractSaved && (
            <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-md text-green-800">
              <p>This contract is saved with ID: <strong>{contractSaveId}</strong></p>
            </div>
          )}
        </div>

        {/* Preview / Saved Contracts Section */}
        <div className="w-full lg:w-2/3 bg-white rounded-lg shadow-md p-6 overflow-auto">
          {showSavedContracts ? (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-gray-700 flex items-center">
                  <List className="mr-2" /> Saved Contracts
                </h2>
                <button
                  onClick={() => setShowSavedContracts(false)}
                  className="p-1 text-gray-500 hover:text-red-500"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search by client name, contract number or boat..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              {filteredContracts.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contract #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Client
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Boat
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredContracts.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {c.contractNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {c.date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {c.lessee.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {c.selectedBoat?.brand} {c.selectedBoat?.model}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => loadContract(c.id)}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                          >
                            View
                          </button>
                          <button
                            onClick={() => {
                              loadContract(c.id);
                              setTimeout(handlePrint, 300);
                            }}
                            className="text-green-600 hover:text-green-900"
                          >
                            <Download size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? 'No contracts match your search' : 'No saved contracts found'}
                </div>
              )}
            </div>
          ) : (
            <>
              <h2 className="text-lg font-medium text-gray-700 mb-4 flex items-center">
                <FileText className="mr-2" /> Contract Preview
              </h2>

              <div className="border rounded-lg p-6 bg-white" ref={contractRef}>
                {/* TITLE */}
                <h1 className="text-xl font-bold text-center mb-6">BOAT RENTAL CONTRACT</h1>

                {/* HEADER INFO */}
                <div className="flex justify-between mb-4">
                  <p><strong>Contract number:</strong> {contractData.contractNumber}</p>
                  <p><strong>Date:</strong> {contractData.date}</p>
                </div>

                {/* LESSOR */}
                <section className="mb-6 border-b pb-4">
                  <h2 className="text-lg font-semibold mb-2">LESSOR</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <p><strong>Company:</strong> SEA CHARTER IBIZA GESTIÓN Y SERVICIOS</p>
                    <p><strong>Phone:</strong> 0034 699198065</p>
                    <p><strong>Address:</strong> C/ Agapito Llobet, 20 Bajos</p>
                    <p><strong>Email:</strong> info@seacharteribiza.com</p>
                    <p><strong>NIF:</strong> B16665580</p>
                  </div>
                </section>

                {/* LESSEE */}
                <section className="mb-6 border-b pb-4">
                  <h2 className="text-lg font-semibold mb-2">LESSEE</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <p><strong>Name / Business name:</strong> {contractData.lessee.name}</p>
                    <p><strong>Phone:</strong> {contractData.lessee.phone}</p>
                    <p><strong>Address:</strong> {contractData.lessee.address}</p>
                    <p><strong>Address during the trip:</strong> {contractData.lessee.addressDuringTrip}</p>
                    <p><strong>Passport / NIF:</strong> {contractData.lessee.identification}</p>
                  </div>
                </section>

                {/* SKIPPER */}
                <section className="mb-6 border-b pb-4">
                  <h2 className="text-lg font-semibold mb-2">SKIPPER</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <p><strong>Name:</strong> {contractData.skipper.name}</p>
                    <p><strong>Phone:</strong> {contractData.skipper.phone}</p>
                    <p><strong>Address:</strong> {contractData.skipper.address}</p>
                    <p><strong>Address during the trip:</strong> {contractData.skipper.addressDuringTrip}</p>
                    <p><strong>DNI / NIF / Passport:</strong> {contractData.skipper.identification}</p>
                    <div className="col-span-2">
                      <p><strong>Navigation Title:</strong> {contractData.skipper.navigationTitle}</p>
                      <p><strong>Number:</strong> {contractData.skipper.navigationNumber}</p>
                    </div>
                  </div>
                </section>

                {/* BOAT */}
                <section className="mb-6 border-b pb-4">
                  <h2 className="text-lg font-semibold mb-2">BOAT</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                    <p><strong>Brand:</strong> {contractData.selectedBoat.brand}</p>
                    <p><strong>Model:</strong> {contractData.selectedBoat.model}</p>
                    <p><strong>Plate:</strong> {contractData.selectedBoat.plate}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-sm">
                    <div>
                      <p><strong>Check-in date:</strong> {contractData.checkIn.date}</p>
                      <p><strong>Check-out date:</strong> {contractData.checkOut.date}</p>
                    </div>
                    <div>
                      <p><strong>Check-in time:</strong> {contractData.checkIn.time}</p>
                      <p><strong>Check-out time:</strong> {contractData.checkOut.time}</p>
                    </div>
                  </div>
                </section>

                {/* PRICE */}
                <section className="mb-6 border-b pb-4 text-sm">
                  <h2 className="text-lg font-semibold mb-2">PRICE</h2>
                  <p><strong>Rental Price:</strong> {contractData.price.rental && `${parseFloat(contractData.price.rental).toFixed(2)} €`}</p>
                  {contractData.price.otherServices.length > 0 && (
                    <div className="mt-2">
                      <p><strong>Other services:</strong></p>
                      <ul className="list-inside pl-4">
                        {contractData.price.otherServices.map((svc, i) => (
                          <li key={i}>
                            {svc.name}: {parseFloat(svc.price).toFixed(2)} €
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-4">
                    <p><strong>Total:</strong> {contractData.price.total && `${parseFloat(contractData.price.total).toFixed(2)} €`}</p>
                    <p><strong>Deposit:</strong> {contractData.price.deposit && `${parseFloat(contractData.price.deposit).toFixed(2)} €`}</p>
                    <p><strong>Estimated fuel consumption per hour:</strong> {contractData.selectedBoat.fuelConsumption}</p>
                  </div>
                </section>

                {/* Acceptance */}
                <div className="mb-8 text-sm italic">
                  <p>
                    The signing of this contract by the lessor and the lessee constitutes acceptance of all prices
                    and conditions herein. The lessee confirms they have read, understood and accepted the general
                    conditions on the reverse, as well as the local maritime regulations in force.
                  </p>
                </div>

                {/* Signatures */}
                <div className="flex justify-between items-center mt-8">
                  <div className="text-center">
                    <div className="border-b border-black pb-2 mb-2 h-24 w-48 flex items-center justify-center">
                      <p className="font-bold">SEA CHARTER IBIZA GESTIÓN Y SERVICIOS</p>
                    </div>
                    <p><strong>The lessor</strong></p>
                  </div>
                  <div className="text-center">
                    <div className="border-b border-black pb-2 mb-2 h-24 w-48 flex items-center justify-center">
                      {contractData.lesseeSignature
                        ? <p className="font-bold">{contractData.lesseeSignature}</p>
                        : <p className="text-gray-400 italic">Lessee Signature</p>
                      }
                    </div>
                    <p><strong>The lessee</strong></p>
                  </div>
                </div>

                {/* General Conditions (backside) */}
                <div className="mt-12 page-break-before text-xs">
                  <h2 className="text-xl font-bold text-center mb-4">GENERAL RENTAL CONDITIONS</h2>
                  <ol className="pl-6 list-decimal space-y-1">
                    <li>Navigation is limited to 12 miles from the coasts of Ibiza and Formentera.</li>
                    <li>The lessor agrees to rent and the lessee agrees to charter the vessel under these terms.</li>
                    <li>Misrepresentation by the lessee invalidates the contract and forfeits any payments.</li>
                    <li>This contract is binding once the lessor has received full payment and deposit.</li>
                    <li>Payment must be made by bank transfer, card or cash prior to embarkation.</li>
                    {/* …add any further clauses here… */}
                    <li>
                      Any dispute arising from this contract shall be finally settled by arbitration
                      under the Court of Arbitration of the Balearic Islands of the Official Chamber
                      of Commerce, whose award is binding.
                    </li>
                  </ol>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractGenerator;
