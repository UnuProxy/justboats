import React, { useState, useRef, useEffect } from 'react';
import {
  FileText, Ship, User, Calendar, Euro,
  Check, Trash2, Save, Printer, ChevronDown,
  List, Download, Search, RefreshCw,
  Eye, Edit, ArrowLeft, AlertTriangle
} from 'lucide-react';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, doc, getDoc, deleteDoc } from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { jsPDF } from "jspdf";

// Use the existing Firebase instance from your app
const db = getFirestore();
const storage = getStorage();

const SignatureCanvas = ({ value, onChange, disabled = false }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000000';
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // If there's an existing signature image, draw it
    if (value && !disabled) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = value;
    }
  }, [value, disabled]);
  
  const startDrawing = (e) => {
    if (disabled) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Get mouse position relative to canvas
    let x, y;
    if (e.type.includes('touch')) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };
  
  const draw = (e) => {
    if (!isDrawing || disabled) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Get mouse position relative to canvas
    let x, y;
    if (e.type.includes('touch')) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  
  const stopDrawing = () => {
    if (!isDrawing || disabled) return;
    
    setIsDrawing(false);
    
    // Save canvas as image data URL
    const canvas = canvasRef.current;
    const signature = canvas.toDataURL('image/png');
    onChange(signature);
  };
  
  const clearSignature = () => {
    if (disabled) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };
  
  return (
    <div className="w-full">
      <div className="border-2 border-gray-300 rounded mb-2 bg-gray-50">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className={`w-full ${disabled ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      {!disabled && (
        <div className="flex justify-end">
          <button
            onClick={clearSignature}
            type="button"
            className="text-red-600 text-sm hover:text-red-800"
          >
            Clear Signature
          </button>
        </div>
      )}
    </div>
  );
};

const ContractGenerator = () => {
  const contractRef = useRef(null);

  // UI state
  const [activeTab, setActiveTab] = useState('create'); // 'create', 'preview', 'saved'
  const [savedContracts, setSavedContracts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [contractSaved, setContractSaved] = useState(false);
  const [contractSaveId, setContractSaveId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [withoutSkipper, setWithoutSkipper] = useState(false);
  const [showSkipperSection, setShowSkipperSection] = useState(false);

  // Default skipper information
  const defaultSkipper = {
    name: 'Daniel Valverde',
    address: 'Ibiza',
    addressDuringTrip: 'Ibiza',
    identification: '12408416P',
    phone: '+34 642 453 952',
    navigationTitle: 'PPER',
    navigationNumber: '3698'
  };

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
    skipper: { ...defaultSkipper },
    checkIn: { date: formatDate(new Date()), time: '10:00' },
    checkOut: { date: formatDate(new Date()), time: '18:00' },
    price: { rental: '', otherServices: [], total: '' },
    withoutSkipper: false,
    lesseeSignature: null
  });

  const [otherService, setOtherService] = useState({ name: '', price: '' });

  // Firebase database functions
  const firebaseDb = {
    saveContract: async (contractData) => {
      try {
        // Add contract to Firestore
        const contractRef = await addDoc(collection(db, "contracts"), {
          ...contractData,
          createdAt: new Date().toISOString(),
          lessorSignature: 'Alin Stefan Letca'
        });
        
        return contractRef.id;
      } catch (error) {
        console.error("Error saving contract to Firebase:", error);
        throw error;
      }
    },

    getContracts: async () => {
      try {
        const q = query(collection(db, "contracts"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        const contracts = [];
        querySnapshot.forEach((doc) => {
          contracts.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        return contracts;
      } catch (error) {
        console.error("Error getting contracts from Firebase:", error);
        throw error;
      }
    },
    
    deleteContract: async (id) => {
      try {
        await deleteDoc(doc(db, "contracts", id));
        return true;
      } catch (error) {
        console.error("Error deleting contract:", error);
        throw error;
      }
    },

    getContractById: async (id) => {
      try {
        const docRef = doc(db, "contracts", id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          return {
            id: docSnap.id,
            ...docSnap.data()
          };
        } else {
          console.log("No such contract!");
          return null;
        }
      } catch (error) {
        console.error("Error getting contract by ID from Firebase:", error);
        throw error;
      }
    },
    
    saveContractPDF: async (id, pdfBlob) => {
      try {
        // Create a reference to the PDF file location
        const pdfRef = ref(storage, `contracts/${id}.pdf`);
        
        // Convert blob to base64 string for uploadString
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              // Upload the file to Firebase Storage
              await uploadString(pdfRef, reader.result, 'data_url');
              
              // Get the download URL
              const downloadURL = await getDownloadURL(pdfRef);
              resolve(downloadURL);
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(pdfBlob);
        });
      } catch (error) {
        console.error("Error saving PDF to Firebase Storage:", error);
        throw error;
      }
    }
  };

  // Calculate total price whenever rental price or services change
  useEffect(() => {
    const rentalPrice = parseFloat(contractData.price.rental) || 0;
    const servicesTotal = contractData.price.otherServices.reduce(
      (sum, service) => sum + (parseFloat(service.price) || 0), 0
    );
    
    const total = (rentalPrice + servicesTotal).toFixed(2);
    setContractData(prev => ({
      ...prev,
      price: { ...prev.price, total }
    }));
  }, [contractData.price.rental, contractData.price.otherServices]);

  // Reset skipper to default when without skipper option changes
  useEffect(() => {
    if (!withoutSkipper) {
      setContractData(prev => ({
        ...prev,
        skipper: { ...defaultSkipper },
        withoutSkipper: false
      }));
    } else {
      setContractData(prev => ({
        ...prev,
        withoutSkipper: true
      }));
    }
  }, [withoutSkipper]);

  // Load saved contracts when the saved tab is activated
  useEffect(() => {
    if (activeTab === 'saved') loadSavedContracts();
  }, [activeTab]);

  const loadSavedContracts = async () => {
    setIsLoading(true);
    try {
      const contracts = await firebaseDb.getContracts();
      setSavedContracts(contracts);
    } catch (err) {
      console.error('Error loading saved contracts:', err);
      alert('Error loading contracts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadContract = async (id) => {
    setIsLoading(true);
    try {
      const c = await firebaseDb.getContractById(id);
      if (c) {
        setContractData(c);
        setWithoutSkipper(c.withoutSkipper || false);
        setActiveTab('preview');
        setContractSaved(true);
        setContractSaveId(id);
      }
    } catch (err) {
      console.error('Error loading contract:', err);
      alert('Error loading contract. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveContract = async () => {
    if (!contractData.lessee.name || !contractData.price.rental) {
      alert('Please fill in required fields: Lessee Name and Rental Price');
      return;
    }
    
    if (!contractData.lesseeSignature) {
      alert('Please add the lessee signature');
      return;
    }
    
    setIsLoading(true);
    try {
      const toSave = {
        ...contractData,
        lessorSignature: 'SEA CHARTER IBIZA GESTIÓN Y SERVICIOS',
        createdAt: new Date().toISOString()
      };
      
      const id = await firebaseDb.saveContract(toSave);
      setContractSaved(true);
      setContractSaveId(id);
      
      // Generate and save PDF after contract is saved
      setTimeout(() => {
        generatePDF(id);
      }, 500);
      
      alert('Contract saved successfully to Firebase!');
      setActiveTab('preview');
    } catch (err) {
      console.error('Error saving contract:', err);
      alert('Error saving contract. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetSkipperToDefault = () => {
    setContractData(prev => ({
      ...prev,
      skipper: { ...defaultSkipper }
    }));
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

  const deleteContract = async (id) => {
    if (!confirm('Are you sure you want to delete this contract? This action cannot be undone.')) {
      return;
    }
    
    setIsLoading(true);
    try {
      await firebaseDb.deleteContract(id);
      alert('Contract deleted successfully');
      loadSavedContracts();
    } catch (err) {
      console.error('Error deleting contract:', err);
      alert('Error deleting contract. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

 
const generatePDF = async (contractId) => {
    try {
      // Create a proper PDF directly rather than converting from HTML
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Add title
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text("BOAT RENTAL CONTRACT", pdfWidth / 2, 20, { align: 'center' });
      
      // Set font for content
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      
      // Contract number and date
      pdf.text(`Contract number: ${contractData.contractNumber}`, 20, 30);
      pdf.text(`Date: ${contractData.date}`, pdfWidth - 20, 30, { align: 'right' });
      
      // LESSOR section
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("LESSOR", 20, 40);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.text("Name: Alin Stefan Letca", 20, 46);
      pdf.text("Phone: +34 642 453 952", 20, 52);
      pdf.text("Address: Carrer del suit, n24, San Jordi", 20, 58);
      pdf.text("Email: info@justenjoyibiza.com", 20, 64);
      pdf.text("NIF: Y1347185C", 20, 70);
      
      // Line separator
      pdf.line(20, 76, pdfWidth - 20, 76);
      
      // LESSEE section
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("LESSEE", 20, 84);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.text(`Name / Business name: ${contractData.lessee.name}`, 20, 90);
      pdf.text(`Phone: ${contractData.lessee.phone}`, 20, 96);
      pdf.text(`Address: ${contractData.lessee.address}`, 20, 102);
      pdf.text(`Address during the trip: ${contractData.lessee.addressDuringTrip}`, 20, 108);
      pdf.text(`Passport / NIF: ${contractData.lessee.identification}`, 20, 114);
      
      // Line separator
      pdf.line(20, 120, pdfWidth - 20, 120);
      
      // SKIPPER section
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      
      if (withoutSkipper) {
        pdf.text("RENTAL WITHOUT SKIPPER", 20, 128);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        pdf.setTextColor(255, 0, 0);
        pdf.text("The lessee will operate the boat directly without a skipper provided by the lessor.", 20, 134);
        pdf.text("IMPORTANT: If the driver consumes alcohol or operates the boat above 3,500 revolutions,", 20, 140);
        pdf.text("they will forfeit their right to any deposit refund and may face additional penalties.", 20, 146);
        pdf.setTextColor(0, 0, 0);
      } else {
        pdf.text("SKIPPER", 20, 128);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        pdf.text(`Name: ${contractData.skipper.name}`, 20, 134);
        pdf.text(`Phone: ${contractData.skipper.phone}`, 20, 140);
        pdf.text(`Address: ${contractData.skipper.address}`, 20, 146);
        pdf.text(`Address during the trip: ${contractData.skipper.addressDuringTrip}`, 20, 152);
        pdf.text(`DNI / NIF / Passport: ${contractData.skipper.identification}`, 20, 158);
        pdf.text(`Navigation Title: ${contractData.skipper.navigationTitle}`, 20, 164);
        pdf.text(`Number: ${contractData.skipper.navigationNumber}`, 20, 170);
      }
      
      // Line separator
      const skipperEndY = withoutSkipper ? 152 : 176;
      pdf.line(20, skipperEndY, pdfWidth - 20, skipperEndY);
      
      // BOAT section
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("BOAT", 20, skipperEndY + 8);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.text(`Brand: ${contractData.selectedBoat.brand}`, 20, skipperEndY + 14);
      pdf.text(`Model: ${contractData.selectedBoat.model}`, 20, skipperEndY + 20);
      pdf.text(`Plate: ${contractData.selectedBoat.plate}`, 20, skipperEndY + 26);
      
      const checkInY = skipperEndY + 34;
      pdf.text(`Check-in date: ${contractData.checkIn.date}`, 20, checkInY);
      pdf.text(`Check-in time: ${contractData.checkIn.time}`, pdfWidth/2, checkInY);
      pdf.text(`Check-out date: ${contractData.checkOut.date}`, 20, checkInY + 6);
      pdf.text(`Check-out time: ${contractData.checkOut.time}`, pdfWidth/2, checkInY + 6);
      
      // Line separator
      pdf.line(20, checkInY + 12, pdfWidth - 20, checkInY + 12);
      
      // PRICE section
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("PRICE", 20, checkInY + 20);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      
      let priceY = checkInY + 26;
      pdf.text(`Rental Price: ${parseFloat(contractData.price.rental).toFixed(2)} €`, 20, priceY);
      priceY += 6;
      
      // FIX 1: Add the "Other services" properly
      if (contractData.price.otherServices.length > 0) {
        pdf.text("Other services:", 20, priceY);
        priceY += 6;
        
        // Add each service with its price
        contractData.price.otherServices.forEach((service) => {
          pdf.text(`${service.name}: ${parseFloat(service.price).toFixed(2)} €`, 30, priceY);
          priceY += 6;
        });
      }
      
      pdf.text(`Total: ${contractData.price.total} €`, 20, priceY);
      priceY += 6;
     
      
      // Acceptance text
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "italic");
      const acceptanceY = Math.min(priceY + 20, pdfHeight - 40);
      pdf.text("The signing of this contract by the lessor and the lessee constitutes acceptance of all prices", 20, acceptanceY);
      pdf.text("and conditions herein. The lessee confirms they have read, understood and accepted the general", 20, acceptanceY + 5);
      pdf.text("conditions on the reverse, as well as the local maritime regulations in force.", 20, acceptanceY + 10);
      
      // Signatures
      const signatureY = acceptanceY + 30;
      
      // Lessor signature
      pdf.setFont("helvetica", "normal");
      pdf.text("Alin Stefan Letca", 40, signatureY);
      pdf.line(20, signatureY + 5, 80, signatureY + 5);
      pdf.setFont("helvetica", "bold");
      pdf.text("The lessor", 40, signatureY + 12);
      
      // FIX 2: Improved Lessee signature handling
      pdf.setFont("helvetica", "normal");
      if (contractData.lesseeSignature) {
        try {
          // Convert signature to image and add to PDF
          const img = new Image();
          img.src = contractData.lesseeSignature;
          
          // We'll handle this asynchronously
          await new Promise((resolve) => {
            img.onload = () => {
              try {
                // Calculate aspect ratio with safety check for zero height
                const aspectRatio = img.width / (img.height || 1);
                const targetWidth = 60; // Width in mm
                const targetHeight = targetWidth / aspectRatio;
                
                // Add image in proper position
                pdf.addImage(
                  contractData.lesseeSignature, 
                  'PNG', 
                  pdfWidth - 80, // X position
                  signatureY - targetHeight + 5, // Y position 
                  targetWidth, 
                  targetHeight
                );
                console.log("Signature added successfully");
                resolve();
              } catch (err) {
                console.error("Error adding signature to PDF:", err);
                resolve();
              }
            };
            
            // Add error handler
            img.onerror = () => {
              console.error("Failed to load signature image");
              resolve();
            };
            
            // Set a timeout in case the image never loads
            setTimeout(() => {
              console.log("Signature load timeout - continuing anyway");
              resolve();
            }, 3000);
          });
        } catch (err) {
          console.error("Error in signature processing:", err);
        }
      }
      
      pdf.line(pdfWidth - 80, signatureY + 5, pdfWidth - 20, signatureY + 5);
      pdf.setFont("helvetica", "bold");
      pdf.text("The lessee", pdfWidth - 60, signatureY + 12);
      
      // Terms and conditions page
      pdf.addPage();
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text('GENERAL RENTAL CONDITIONS', pdfWidth / 2, 20, { align: 'center' });
      
      pdf.setFontSize(10);
      const termsText = [
        '1- This contract is only for navigation up to 12 miles from the coasts of Ibiza and Formentera.',
        '2- It is desire of the lessor to deliver the rental boat and it is desire of the lessee to receive it for rent.',
        '3- Deception by the lessee in any of the particular specifications of the contract will lead to the immediate cancellation of the contract, losing the lessee the amounts delivered.',
        '4- This contract will not be valid until the lessor has received the payment for the agreed reservation and provided that payment before the date specified in this document.',
        '5- Before the delivery of the boat, the lessor must have received the totality of the established price, as well as the corresponding deposit. Payment can be made by bank transfer, card payment or cash.',
        '6- If the lessee, for any reason, cancels this contract, will have to pay the lessor the following percentages of the total amount of the contract: More than one month before the start date, 25%; with less than a month and up to seven days before the start date, 50%; less than 7 days before the start date, 100%.',
        '7- The lessor undertakes to deliver the boat in perfect working order and cleanliness at the agreed place, date and time. In the event that, due to force majeure, such as a possible breakdown of the boat, it cannot be delivered, the lessor undertakes to inform the lessee immediately as well as to put all possible means of solving the problem and try to find another boat of the same or higher category. In the event that the agreed conditions cannot definitely be met, the lessor will return the amounts received to the lessee. The lessee agrees not to make an additional claim.',
        '8- The lessee will use and take care of the boat received and all its accessories following good seafaring practices and will use all means to prevent losses, accidents or breakdowns.',
        '9- If the lessor, during the rental period, observes that the skipper performs dangerous maneuvers or shows inexperience, he may cancel the rental contract in advance, returning to the lessee 50% of the rent for the unused days without implying refund on the day the cancellation occurs, or the lesse may change to another skipper that could be provided by the lessor.',
        '10- In the event of an accident or breakdown, the lessee must contact the lessor as soon as possible and in the event of not being able to do so and requiring immediate attention, he will do what is recommended by good seafaring practices, thinking of the safety of those in their charge and of the boat. In the event that the possible breakdown is not due to misuse of the lessor and cannot be solved in a short time, the lessor will return to the lessee the proportional part of the rent not enjoyed, without the lessee being able to make any claim for damages and losses. However, the lessor will carry out all possible procedures, aimed at finding another boat so that the lessee can continue to enjoy the reservation.',
        '11- The boat has an insurance policy with accident coverage, both for the boat itself and for civil liability and occupants with the limitations specified in the general and particular conditions of the policy.',
        '12- In the event that there is an accident and the insurance company is not responsible for all or part of the damages, expenses or civil liability produced, the lessee must deal with all of them, expressly releasing the lessor from any liability.',
        '13- The delay in the return of the boat on the day and time indicated will have a penalty which the lessee will pay to the lessor 50€ for each hour of delay. In the event that the boat is left in a different place than the agreed one, the lessee will pay the lessor all the expenses, damages and losses that this may cause.',
        '14- In the event that children are going to board, he lessee must notify the lessor in advance so that the lessor can replace the adult life jackets with those appropriate for their size.',
        '15- The deposit received by the lessor before the boarding serves to answer for any damage, loss, robbery or theft of any object not covered by the insurance company or delay in the return of the boat. However, if the amount resulting from any of the cases indicated is greater than the amount of the deposit, the lessee is obliged to pay the difference. The deposit will be returned to the lessee once the condition of the boat and the repair have been verified. In the event that the rental has been made without a deposit, the lessee will bear the cost of any loss of object and accessory as well as any damage caused by the rental.',
        '16- At the time set in this contract for the return of the boat, the lessee and all luggage must be off the boat, leaving the boat ready for the lessor\'s review.',
        '17- Provisioning, fuel, mooring and crew costs if any, are responsibility of the lessee. The mooring in the port of departure is included in the price.',
        '18- The fuel consumption costs will be borne by the lessee. They will be calculated from the consumption of liters per hour of navigation of the rented boat. The lessee acknowledges having been informed of the consumption of the boat.',
        '19- The lessee acknowledges having been informed in relation to the use of navigation systems present in the boat, used in order to provide help or assitance, prevent the client from navigating or anchoring through prohibited sites or calculating fuel consumption.',
        '20- It is totally prohibited to ship weapons, narcotics, contraband, merchandise, paying passengers and animals, as well as to participate in regattas, commercial fishing and any activity sanctioned by current legislation.',
        '21- Any cost derived from the misuse of the equipment and security systems (flares, vests, smoke canister, beacon and more) will be borne by the lessee.',
        '22- Subcontracting or subletting are not allowed, committing the lessee to use the boat only for himself, family or friends, which in total may not exceed the maximum number for which the boat is designated. It is not allowed to embark and disembark outside the established schedules or at the base port.',
        '23- In case of non-compliance with the rules established by the maritime authorities or customs, the person responsible will be the skipper of the boat subsidiarily the lessee, expressly releasing the lessor from any responsibility. In the event that, for reasons attributable to the lessee, the skipper or the crew, the boat is detained or sealed by any type of authority and consequently the boat is not returned to the lessor on the date set out in the contract, the lessee will pay as a penalty the amounts that the lessee must pay to the lessor for delay that are specified in clause 13. Any fine received by the lessor and referred to the use of the rented boat for the duration of the lease will be borne by the lessee.',
        '24- The lessee acknowledges having been informed of the areas considered dangerous and undertakes not to navigate near them, being the reason for collecting the deposit deposited what is included in this clause. The following are recognized as dangerous areas: "es freu mitja i es freu petit", "sa barqueta", "es gorrinets", "es pas" "illa d\'es porcs" and passage between "illa d\'es bosc" and "cales of compte" as well as the rest othe areas marked in red on the navigation chart given to the lessee at the time of check-in.',
        '25- In the event that the payment by the lessee is made using a credit or debit card that does not belong to the European Union or Amex, an extra charge of 2.5% will be applied to the total rental price.',
        '26- IMPORTANT: If the boat is rented without a skipper and the driver consumes alcohol while operating the vessel OR operates the boat above 3,500 revolutions, they will forfeit their right to any deposit refund and may be subject to additional penalties.',
        '27- The intervening parties agree that any litigation, discrepancy, question or claim resulting from the execution or interpretation of this contract or related to the rental specified therein, will be definitively resolved by arbitration within the framework of the Court of Arbitration of the Balearic Islands of the Official Chamber of Commerce entrusted with the administration of the arbitration and the appointment of arbitrators in accordance with its regulations and statutes. Likewise, both expressly state their commitment to comply with the arbitration award that is issued.'
      ];
      
      let yPosition = 30;
      const lineHeight = 5;
      
      termsText.forEach((line, index) => {
        // Check if we need to add a new page
        if (yPosition > 270) {
          pdf.addPage();
          
          // Add header on new page
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(14);
          pdf.text('GENERAL RENTAL CONDITIONS', pdfWidth / 2, 20, { align: 'center' });
          pdf.setFontSize(10);
          yPosition = 30;
        }
        
        // Use bold red font for clause 26
        if (index === 25) {
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(255, 0, 0);
        } else {
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(0, 0, 0);
        }
        
        // Split long lines
        const splitLines = pdf.splitTextToSize(line, pdfWidth - 40);
        pdf.text(splitLines, 20, yPosition);
        yPosition += lineHeight * splitLines.length;
      });
      
      // Convert PDF to blob
      const pdfBlob = pdf.output('blob');
      
      // Save PDF to Firebase Storage
      const id = contractId || contractSaveId;
      if (id) {
        const downloadURL = await firebaseDb.saveContractPDF(id, pdfBlob);
        console.log('PDF saved to Firebase Storage:', downloadURL);
      }
      
      return pdfBlob;
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  };

  const handlePrint = async () => {
    setIsLoading(true);
    try {
      const pdfBlob = await generatePDF();
      
      // Create a URL for the blob
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Create a link element to trigger download
      const link = document.createElement('a');
      
      // Set contract number or default name for the download
      const fileName = `contract-${contractData.contractNumber || 'download'}.pdf`;
      
      link.href = pdfUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      setTimeout(() => {
        URL.revokeObjectURL(pdfUrl);
      }, 100);
    } catch (error) {
      console.error('Error handling print:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setIsLoading(false);
    }
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

  // Render the contract form
  const renderContractForm = () => (
    <div className="bg-white rounded-lg shadow p-4 md:p-6">
      <h2 className="text-lg font-medium text-gray-700 mb-4">Contract Details</h2>

      {/* Contract # and Date */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:gap-4 space-y-4 md:space-y-0">
          <div className="w-full md:w-1/2">
            <label className="block text-sm font-medium text-gray-600">Contract #</label>
            <input
              type="text"
              value={contractData.contractNumber}
              readOnly
              className="mt-1 p-2 w-full bg-gray-100 border border-gray-300 rounded-md"
            />
          </div>
          <div className="w-full md:w-1/2">
            <label className="block text-sm font-medium text-gray-600">Date</label>
            <input
              type="text"
              value={contractData.date}
              onChange={(e) => setContractData({ ...contractData, date: e.target.value })}
              className="mt-1 p-2 w-full border border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div className="mt-4">
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

      {/* Without skipper option */}
      <div className="mb-4">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="withoutSkipper"
            checked={withoutSkipper}
            onChange={(e) => setWithoutSkipper(e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="withoutSkipper" className="ml-2 block text-sm font-medium text-red-600">
            Rental without skipper (client will drive the boat)
          </label>
        </div>
        {withoutSkipper && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-600 flex items-start">
            <AlertTriangle size={16} className="mr-1 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-bold">Important:</span> If the client operates the boat under the influence of alcohol or exceeds 3,500 revolutions, they will forfeit their deposit and face potential additional penalties.
            </div>
          </div>
        )}
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
        <div className="flex justify-between items-center mb-2">
          <h3 
            className="text-md font-medium text-gray-700 flex items-center cursor-pointer"
            onClick={() => setShowSkipperSection(!showSkipperSection)}
          >
            <Ship size={16} className="mr-2" /> 
            Skipper Information 
            <ChevronDown size={16} className={`ml-2 transform transition-transform ${showSkipperSection ? 'rotate-180' : ''}`} />
          </h3>
          {showSkipperSection && (
            <div className="flex space-x-2">
              <button
                onClick={resetSkipperToDefault}
                className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                title="Reset to default skipper"
              >
                <RefreshCw size={14} className="mr-1" /> Reset
              </button>
            </div>
          )}
        </div>
        
        {withoutSkipper && (
          <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded-md text-sm">
            Skipper information is not required for rentals without a skipper.
          </div>
        )}
        
        {showSkipperSection && (
          <div className={`transition-all duration-200 ${withoutSkipper ? 'opacity-50' : ''}`}>
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
                  disabled={withoutSkipper}
                />
              </div>
            ))}
          </div>
        )}
        {!showSkipperSection && (
          <div className="border border-gray-300 rounded-md p-4 bg-gray-50 text-sm text-gray-500">
            <p>Default skipper information is set. Click to view and edit.</p>
          </div>
        )}
      </div>

      {/* Rental Period */}
      <div className="mb-6">
        <h3 className="text-md font-medium text-gray-700 mb-2 flex items-center">
          <Calendar size={16} className="mr-2" /> Rental Period
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>

      {/* Signatures */}
      <div className="mb-6">
        <h3 className="text-md font-medium text-gray-700 mb-2">Signatures</h3>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 mb-1">Lessor Signature</label>
          <div className="border border-gray-300 rounded-md bg-white p-3 text-center">
            <p className="font-semibold text-blue-800">Alin Stefan Letca</p>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 mb-1">Lessee Signature (Draw Below)</label>
          <SignatureCanvas
            value={contractData.lesseeSignature}
            onChange={(signature) => setContractData({ ...contractData, lesseeSignature: signature })}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2 mt-6">
        <button
          onClick={() => setActiveTab('preview')}
          className="flex items-center justify-center p-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          disabled={isLoading}
        >
          <Eye size={18} className="mr-2" /> Preview
        </button>
        <button
          onClick={saveContract}
          className="flex items-center justify-center p-3 bg-green-600 text-white rounded-md hover:bg-green-700"
          disabled={isLoading}
        >
          <Save size={18} className="mr-2" /> Save Contract
        </button>
      </div>
    </div>
  );

  // Render contract preview
  const renderContractPreview = () => (
    <div className="bg-white rounded-lg shadow p-4 md:p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-700 flex items-center">
          <FileText className="mr-2" /> Contract Preview
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('create')}
            className="p-2 text-blue-600 border border-blue-600 rounded hover:bg-blue-50"
            title="Edit Contract"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={handlePrint}
            className="p-2 text-green-600 border border-green-600 rounded hover:bg-green-50"
            title="Print/Download"
          >
            <Printer size={18} />
          </button>
        </div>
      </div>

      <div className="border rounded-lg p-4 md:p-6 bg-white overflow-auto" ref={contractRef}>
        {/* TITLE */}
        <h1 className="text-xl font-bold text-center mb-6">BOAT RENTAL CONTRACT</h1>

        {/* HEADER INFO */}
        <div className="flex flex-col md:flex-row justify-between mb-4">
          <p><strong>Contract number:</strong> {contractData.contractNumber}</p>
          <p><strong>Date:</strong> {contractData.date}</p>
        </div>

        {/* LESSOR */}
        <section className="mb-6 border-b pb-4">
          <h2 className="text-lg font-semibold mb-2">LESSOR</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <p><strong>Name:</strong> Alin Stefan Letca</p>
            <p><strong>Phone:</strong> +34 642 453 952</p>
            <p><strong>Address:</strong> Carrer del suit, n24, San Jordi</p>
            <p><strong>Email:</strong> info@justenjoyibiza.com</p>
            <p><strong>NIF:</strong> Y1347185C</p>
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
          <h2 className="text-lg font-semibold mb-2">
            {withoutSkipper ? "RENTAL WITHOUT SKIPPER" : "SKIPPER"}
          </h2>
          {withoutSkipper ? (
            <div className="text-sm text-red-600 font-medium mb-2">
              <p>The lessee will operate the boat directly without a skipper provided by the lessor.</p>
              <p className="mt-2 font-bold">IMPORTANT: According to clause 26, if the driver consumes alcohol while operating the vessel OR operates the boat above 3,500 revolutions, they will forfeit their right to any deposit refund and may face additional penalties.</p>
            </div>
          ) : (
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
          )}
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

        <div className="flex flex-col md:flex-row justify-between items-center mt-8">
          <div className="text-center mb-4 md:mb-0">
            <div className="border-b border-black pb-2 mb-2 h-24 w-48 flex items-center justify-center">
              <p className="font-bold">Alin Stefan Letca</p>
            </div>
            <p><strong>The lessor</strong></p>
          </div>
          <div className="text-center">
            <div className="border-b border-black pb-2 mb-2 h-24 w-48 flex items-center justify-center">
              {contractData.lesseeSignature ? (
                <img src={contractData.lesseeSignature} alt="Lessee Signature" className="max-h-20" />
              ) : (
                <p className="text-gray-400 italic">Lessee Signature</p>
              )}
            </div>
            <p><strong>The lessee</strong></p>
          </div>
        </div>
      </div>

      {contractSaved && (
        <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-md text-green-800">
          <p>This contract is saved with ID: <strong>{contractSaveId}</strong></p>
        </div>
      )}
    </div>
  );

  // Render saved contracts
  const renderSavedContracts = () => (
    <div className="bg-white rounded-lg shadow p-4 md:p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-700 flex items-center">
          <List className="mr-2" /> Saved Contracts
        </h2>
        <button
          onClick={() => setActiveTab('create')}
          className="p-2 text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft size={20} />
        </button>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by client name, contract #, or boat..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md"
          />
        </div>
      </div>

      {filteredContracts.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contract #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Boat
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredContracts.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {c.contractNumber}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {c.lessee.name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {c.selectedBoat?.brand} {c.selectedBoat?.model}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-3">
                      <button
                        onClick={() => loadContract(c.id)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View Contract"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => {
                          loadContract(c.id);
                          setTimeout(handlePrint, 300);
                        }}
                        className="text-green-600 hover:text-green-900"
                        title="Download PDF"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() => deleteContract(c.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete Contract"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          {searchTerm ? 'No contracts match your search' : 'No saved contracts found'}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col w-full p-4 bg-gray-50 min-h-screen">
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <p className="text-lg flex items-center">
              <span className="animate-spin mr-2">⟳</span> Loading...
            </p>
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold text-gray-800 flex items-center">
          <FileText className="mr-2" /> Boat Rental Contract
        </h1>
        <button
          onClick={() => window.location.href = "/"}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center"
        >
          <ArrowLeft size={16} className="mr-2" /> Back to Menu
        </button>
      </div>
      
      {/* Mobile tab navigation */}
      <div className="flex mb-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('create')}
          className={`flex items-center justify-center py-3 px-4 text-sm font-medium ${
            activeTab === 'create' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Edit size={16} className="mr-2" /> Create
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex items-center justify-center py-3 px-4 text-sm font-medium ${
            activeTab === 'preview' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Eye size={16} className="mr-2" /> Preview
        </button>
        <button
          onClick={() => {
            setActiveTab('saved');
            loadSavedContracts();
          }}
          className={`flex items-center justify-center py-3 px-4 text-sm font-medium ${
            activeTab === 'saved' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <List size={16} className="mr-2" /> Saved
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'create' && renderContractForm()}
      {activeTab === 'preview' && renderContractPreview()}
      {activeTab === 'saved' && renderSavedContracts()}
    </div>
  );
};

export default ContractGenerator;
