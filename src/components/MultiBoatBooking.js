import React, { useState, useEffect } from "react";
import { Ship, PlusCircle, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import ClientPaymentForm from './ClientPaymentForm'; // Import the existing ClientPaymentForm

function MultiBoatBooking({ onBoatsChange, initialBoats = [] }) {
  const [boats, setBoats] = useState(initialBoats.length > 0 ? initialBoats : [{
    boatCompany: "",
    boatName: "",
    passengers: "",
    date: "",
    startTime: "",
    endTime: "",
    pricing: {
      agreedPrice: "",
      pricingType: "standard",
      firstPayment: {
        useCustomAmount: false,
        percentage: "30",
        amount: "",
        method: "cash",
        received: false,
        date: "",
        excludeVAT: false
      },
      secondPayment: {
        amount: "",
        method: "pos",
        received: false,
        date: "",
        excludeVAT: false
      },
      paymentStatus: "No Payment",
      totalPaid: 0,
    },
    showPaymentDetails: false // Control payment section visibility
  }]);

  // Update parent component when boats change
  useEffect(() => {
    onBoatsChange(boats);
  }, [boats, onBoatsChange]);

  // Add a new boat entry
  const addBoat = () => {
    const lastBoat = boats[boats.length - 1];
    
    // Clone the last boat but with empty name and pricing
    const newBoat = {
      ...lastBoat,
      boatName: "",
      passengers: "",
      pricing: {
        ...lastBoat.pricing,
        agreedPrice: "",
        firstPayment: {
          ...lastBoat.pricing.firstPayment,
          amount: "",
          received: false,
          date: ""
        },
        secondPayment: {
          ...lastBoat.pricing.secondPayment,
          amount: "",
          received: false,
          date: ""
        },
        paymentStatus: "No Payment",
        totalPaid: 0
      },
      showPaymentDetails: false
    };
    
    setBoats([...boats, newBoat]);
  };

  // Remove a boat by index
  const removeBoat = (index) => {
    if (boats.length === 1) {
      // Don't remove the last boat, just clear it
      const clearedBoat = {
        boatCompany: "",
        boatName: "",
        passengers: "",
        date: boats[0].date, // Keep the date
        startTime: "",
        endTime: "",
        pricing: {
          agreedPrice: "",
          pricingType: "standard",
          firstPayment: {
            useCustomAmount: false,
            percentage: "30",
            amount: "",
            method: "cash",
            received: false,
            date: "",
            excludeVAT: false
          },
          secondPayment: {
            amount: "",
            method: "pos",
            received: false,
            date: "",
            excludeVAT: false
          },
          paymentStatus: "No Payment",
          totalPaid: 0,
        },
        showPaymentDetails: false
      };
      setBoats([clearedBoat]);
    } else {
      setBoats(boats.filter((_, i) => i !== index));
    }
  };

  // Handle input changes for a specific boat
  const handleBoatInputChange = (index, field, value) => {
    const updatedBoats = [...boats];
    
    if (field === "startTime") {
      const startHour = parseInt(value.split(':')[0]);
      const startMinutes = value.split(':')[1];
      const endHour = (startHour + 8).toString().padStart(2, '0');
      
      updatedBoats[index] = {
        ...updatedBoats[index],
        startTime: value,
        endTime: `${endHour}:${startMinutes}`
      };
    } else {
      updatedBoats[index] = {
        ...updatedBoats[index],
        [field]: value
      };
    }
    
    setBoats(updatedBoats);
  };

  // Toggle payment details visibility
  const togglePaymentDetails = (index) => {
    const updatedBoats = [...boats];
    updatedBoats[index] = {
      ...updatedBoats[index],
      showPaymentDetails: !updatedBoats[index].showPaymentDetails
    };
    setBoats(updatedBoats);
  };

  // Handle pricing changes for a specific boat
  const handlePricingChange = (index, pricingData) => {
    // Calculate actual monetary values for first payment
    const firstPaymentAmount = pricingData.pricingType === 'standard' && !pricingData.firstPayment.useCustomAmount 
      ? parseFloat(pricingData.agreedPrice) * (parseFloat(pricingData.firstPayment.percentage) / 100)
      : parseFloat(pricingData.firstPayment.amount) || 0;
  
    // Calculate second payment based on the total and first payment
    const secondPaymentAmount = pricingData.pricingType === 'standard'
      ? parseFloat(pricingData.agreedPrice) - firstPaymentAmount
      : parseFloat(pricingData.secondPayment.amount) || 0;
  
    const updatedBoats = [...boats];
    updatedBoats[index] = {
      ...updatedBoats[index],
      pricing: {
        ...pricingData,
        firstPayment: {
          ...pricingData.firstPayment,
          amount: firstPaymentAmount.toFixed(2),
          percentage: pricingData.firstPayment.percentage // Keep the original percentage
        },
        secondPayment: {
          ...pricingData.secondPayment,
          amount: secondPaymentAmount.toFixed(2)
        },
        totalPaid: 
          (pricingData.firstPayment.received ? firstPaymentAmount : 0) +
          (pricingData.secondPayment.received ? secondPaymentAmount : 0),
      }
    };
    
    setBoats(updatedBoats);
  };

  // Apply date to all boats
  const applyDateToAll = (date) => {
    const updatedBoats = boats.map(boat => ({
      ...boat,
      date: date
    }));
    setBoats(updatedBoats);
  };

  // Apply price to all boats
  const applyPriceToAll = (index) => {
    const sourceBoat = boats[index];
    const updatedBoats = boats.map((boat, i) => {
      if (i === index) return boat; // Skip the source boat
      
      // Copy price but maintain boat-specific details
      return {
        ...boat,
        pricing: {
          ...sourceBoat.pricing,
          // Preserve any unique payment receipt status
          firstPayment: {
            ...sourceBoat.pricing.firstPayment,
            received: boat.pricing.firstPayment.received,
            date: boat.pricing.firstPayment.date
          },
          secondPayment: {
            ...sourceBoat.pricing.secondPayment,
            received: boat.pricing.secondPayment.received,
            date: boat.pricing.secondPayment.date
          }
        }
      };
    });
    
    setBoats(updatedBoats);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ship className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold">Multiple Boat Booking</h3>
        </div>
        <span className="text-sm text-gray-500">
          {boats.length} {boats.length === 1 ? 'boat' : 'boats'}
        </span>
      </div>

      {boats.map((boat, index) => (
        <div 
          key={index} 
          className="border rounded-lg p-4 relative"
          style={{ 
            borderColor: index === 0 ? '#4299e1' : '#e2e8f0',
            backgroundColor: index === 0 ? '#ebf8ff' : 'white' 
          }}
        >
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => removeBoat(index)}
              className="text-red-500 hover:text-red-700"
              title="Remove boat"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>

          <h4 className="font-medium mb-4">
            Boat {index + 1} {boat.boatName && `- ${boat.boatName}`}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Boat Company</label>
              <input
                type="text"
                className="mt-1 w-full p-2 border rounded"
                value={boat.boatCompany}
                onChange={(e) => handleBoatInputChange(index, "boatCompany", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Boat Name</label>
              <input
                type="text"
                className="mt-1 w-full p-2 border rounded"
                value={boat.boatName}
                onChange={(e) => handleBoatInputChange(index, "boatName", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Number of Passengers</label>
              <input
                type="number"
                className="mt-1 w-full p-2 border rounded"
                value={boat.passengers}
                onChange={(e) => handleBoatInputChange(index, "passengers", e.target.value)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">Date</label>
                {index === 0 && (
                  <button
                    type="button"
                    onClick={() => applyDateToAll(boat.date)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Apply to all boats
                  </button>
                )}
              </div>
              <input
                type="date"
                className="mt-1 w-full p-2 border rounded"
                value={boat.date}
                onChange={(e) => {
                  handleBoatInputChange(index, "date", e.target.value);
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Start Time</label>
              <input
                type="time"
                className="mt-1 w-full p-2 border rounded"
                value={boat.startTime}
                onChange={(e) => handleBoatInputChange(index, "startTime", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">End Time</label>
              <input
                type="time"
                className="mt-1 w-full p-2 border rounded"
                value={boat.endTime}
                onChange={(e) => handleBoatInputChange(index, "endTime", e.target.value)}
              />
            </div>
          </div>

          {/* Payment section with toggle */}
          <div className="mt-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => togglePaymentDetails(index)}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
              >
                <span>Payment Details</span>
                {boat.showPaymentDetails ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              
              {index === 0 && (
                <button
                  type="button"
                  onClick={() => applyPriceToAll(index)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Apply pricing to all boats
                </button>
              )}
            </div>

            {/* Simplified pricing display when collapsed */}
            {!boat.showPaymentDetails && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Agreed Price (€)</label>
                  <input
                    type="number"
                    className="mt-1 w-full p-2 border rounded"
                    value={boat.pricing.agreedPrice}
                    onChange={(e) => {
                      // Create a copy of the current pricing but update agreedPrice
                      const pricingData = {
                        ...boat.pricing,
                        agreedPrice: e.target.value
                      };
                      handlePricingChange(index, pricingData);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Payment Status</label>
                  <div className="mt-1 p-2 border rounded bg-gray-50">
                    <span className={`text-sm ${
                      boat.pricing.paymentStatus === 'Completed' ? 'text-green-600' :
                      boat.pricing.paymentStatus === 'Partial' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {boat.pricing.paymentStatus}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Full payment form */}
            {boat.showPaymentDetails && (
              <div className="mt-4">
                <ClientPaymentForm 
                  onPricingChange={(pricingData) => handlePricingChange(index, pricingData)}
                  initialData={boat.pricing}
                />
              </div>
            )}
          </div>
        </div>
      ))}

      <div className="flex justify-center mt-4">
        <button
          type="button"
          onClick={addBoat}
          className="flex items-center gap-1 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
        >
          <PlusCircle className="w-4 h-4" />
          Add Another Boat
        </button>
      </div>
    </div>
  );
}

export default MultiBoatBooking;