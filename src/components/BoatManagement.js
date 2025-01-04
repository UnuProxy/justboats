import React, { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db,storage } from "../firebase/firebaseConfig";
import { useNavigate } from 'react-router-dom';
import { PenSquare, Trash2, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { ref, getDownloadURL } from 'firebase/storage';

const BoatManagement = () => {
    const [boats, setBoats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pdfLoading, setPdfLoading] = useState({});
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const fetchBoats = async () => {
        try {
            setLoading(true);
            const boatsRef = collection(db, 'boats');
            const boatsSnapshot = await getDocs(boatsRef);
            const boatsList = boatsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setBoats(boatsList);
        } catch (error) {
            console.error('Error fetching boats:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBoats();
    }, []);

    const handleDelete = async (boatId) => {
        if (window.confirm('Are you sure you want to delete this boat?')) {
            try {
                await deleteDoc(doc(db, 'boats', boatId));
                setBoats(boats.filter(boat => boat.id !== boatId));
            } catch (error) {
                console.error('Error deleting boat:', error);
                alert('Error deleting boat');
            }
        }
    };

    const handleEdit = (boatId) => {
        navigate(`/edit-boat/${boatId}`);
    };

   
const handleGeneratePdf = async (boatId) => {
    setPdfLoading(prev => ({ ...prev, [boatId]: true }));
    try {
        const boatDoc = await getDoc(doc(db, 'boats', boatId));
        if (!boatDoc.exists()) {
            alert("Boat data not found.");
            return;
        }
        const boatData = boatDoc.data();

        // Create PDF with A4 format
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Define colors
        const softBlue = [32, 149, 174];   // #2095AE
        const white = [255, 255, 255];

        // First Page - Overview & Specifications
        pdf.setFillColor(...white);
        pdf.rect(0, 0, 210, 297, 'F');

        // Header
        pdf.setTextColor(...softBlue);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(36);
        pdf.text(boatData.name, 20, 30);

        // Add main image
         if (boatData.images && boatData.images.length > 0) {
             try {
                 // Use firebase storage getDownloadURL to ensure you are getting the valid url
                 const storageRef = ref(storage, boatData.images[0])
                 console.log("Fetching image from:", storageRef);
                const url = await getDownloadURL(storageRef);
                  console.log("Resolved image url:", url)
                const imgData = await fetch(url)
                   .then(res => res.blob())
                   .then(blob => new Promise((resolve) => {
                         const reader = new FileReader();
                           reader.onloadend = () => {
                               console.log("Reader finished, result:", reader.result);
                               resolve(reader.result);
                          };
                        reader.readAsDataURL(blob);
                   })
                );
                 pdf.addImage(imgData, 'JPEG', 20, 40, 170, 75);

            } catch (imageError) {
               console.error("Error adding image:", imageError);
             }
         }

        // Overview section
        pdf.setTextColor(...softBlue);
        pdf.setFontSize(12);
        const splitDescription = pdf.splitTextToSize(boatData.description || "", 170);
        pdf.text(splitDescription, 20, 130);

         // Specifications
        pdf.setTextColor(...softBlue);
        pdf.setFontSize(20);
        pdf.text("SPECIFICATIONS", 20, 180);

        // Create specs grid
         const specs = [
            ["Length", boatData.detailedSpecs?.Length],
            ["Beam", boatData.detailedSpecs?.Beam],
            ["Guests", boatData.detailedSpecs?.Guests],
            ["Cabins", boatData.detailedSpecs?.Cabins],
            ["Cruising Speed", boatData.detailedSpecs?.['Cruising Speed']],
            ["Maximum Speed", boatData.detailedSpecs?.['Maximum speed']],
            ["Fuel Consumption", boatData.detailedSpecs?.['Fuel consumption']],
            ["Engines", boatData.detailedSpecs?.Engines]
        ];

        let yPos = 200;
        specs.forEach(([label, value]) => {
            if (value) { // Only display if value exists
                pdf.setTextColor(...softBlue);
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(10);
                pdf.text(label.toUpperCase(), 20, yPos);
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(10);
                pdf.text(value, 100, yPos);
                yPos += 10;
            }
        });

        // Rates Section
        if (boatData.seasonalPrices && Object.keys(boatData.seasonalPrices).length > 0) {
            pdf.addPage(); // Add new page
            pdf.setFillColor(...white);
            pdf.rect(0, 0, 210, 297, 'F');

            pdf.setTextColor(...softBlue);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(20);
            pdf.text("RATES", 20, 20);

            const priceData = Object.entries(boatData.seasonalPrices).map(([season, price]) => [
                season,
                typeof price === 'number' ? `€${price.toLocaleString()}` : price
            ]);

            pdf.autoTable({
                startY: 30,
                head: [['SEASON', 'RATE']],
                body: priceData,
                theme: 'plain',
                styles: {
                    fontSize: 10,
                    textColor: [...softBlue],
                    cellPadding: 8,
                },
                headStyles: {
                    fillColor: [...softBlue],
                    textColor: [...white],
                    fontSize: 12,
                    fontStyle: 'bold'
                },
                columnStyles: {
                    0: { cellWidth: 90 },
                    1: { cellWidth: 80, halign: 'right' }
                },
                margin: { left: 20 }
            });

            pdf.setTextColor(...softBlue);
            pdf.setFont("helvetica", "italic");
            pdf.setFontSize(8);
            pdf.text("* Prices do not include VAT and fuel costs", 20, pdf.internal.pageSize.height - 20);
        }

         // Add footer
         const pageCount = pdf.internal.getNumberOfPages();
         for (let i = 1; i <= pageCount; i++) {
             pdf.setPage(i);

             // Add subtle footer line
             pdf.setDrawColor(...softBlue);
             pdf.setLineWidth(0.5);
             pdf.line(20, pdf.internal.pageSize.height - 15, 190, pdf.internal.pageSize.height - 15);

            // Add footer text
             pdf.setTextColor(...softBlue);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8);
              pdf.text(
                 boatData.name,
                20,
                pdf.internal.pageSize.height - 10
             );

              pdf.text(
                `${i}/${pageCount}`,
                 190,
                 pdf.internal.pageSize.height - 10,
               { align: 'right' }
            );
       }
        // Save the PDF
        pdf.save(`${boatData.name?.replace(/\s+/g, '-').toLowerCase() || 'boat'}-details.pdf`);

    } catch (error) {
        console.error("Error generating PDF: ", error);
        alert("Failed to generate PDF.");
    } finally {
        setPdfLoading(prev => ({ ...prev, [boatId]: false }));
    }
};

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-red-500 p-4">
                Error: {error}
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Boat Fleet Overview</h1>
                <button
                    onClick={() => navigate('/add-boat')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    Add New Boat
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {boats.map((boat) => (
                    <div key={boat.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
                        <div className="relative w-full h-64">
                            <img
                                src={boat.images?.[0] || boat.image}
                                alt={boat.name}
                                className="w-full h-full object-cover rounded-t-lg"
                            />
                            <div className="absolute top-4 right-4 flex space-x-2">
                                <button
                                    onClick={() => handleEdit(boat.id)}
                                    className="p-2.5 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                                    title="Edit boat"
                                >
                                    <PenSquare size={20} className="text-blue-600" />
                                </button>
                                <button
                                    onClick={() => handleDelete(boat.id)}
                                    className="p-2.5 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                                    title="Delete boat"
                                >
                                    <Trash2 size={20} className="text-red-600" />
                                </button>
                                 <button
                                      onClick={() => handleGeneratePdf(boat.id)}
                                        disabled={pdfLoading[boat.id]}
                                      className="p-2.5 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                                    title="Download PDF"
                                  >
                                      {pdfLoading[boat.id] ?
                                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
                                          : <Download size={20} className="text-gray-700" />}
                                </button>
                            </div>
                        </div>
                        <div className="p-6">
                            <h2 className="text-2xl font-semibold mb-4">{boat.name}</h2>
                            <div className="space-y-2 text-gray-600">
                                <p className="text-base">
                                    <span className="font-medium">Specs:</span> {boat.detailedSpecs?.Length}, {boat.detailedSpecs?.Guests} guests, {boat.detailedSpecs?.Crew} crew
                                </p>
                                <p className="text-base">
                                    <span className="font-medium">Price:</span> {boat.detailedSpecs?.Price}
                                </p>
                                <p className="text-base">
                                    <span className="font-medium">Cruising Area:</span> {boat.detailedSpecs?.['Cruising Area']}
                                </p>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <details className="cursor-pointer group">
                                    <summary className="font-medium text-blue-600 hover:text-blue-700 transition-colors">
                                        View Details ▼
                                    </summary>
                                    <div className="mt-3 text-gray-600">
                                        <p className="mb-4">{boat.description}</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            {boat.detailedSpecs && Object.entries(boat.detailedSpecs).map(([key, value]) => (
                                                <p key={key} className="text-sm">
                                                    <span className="font-medium">{key}:</span> {value}
                                                </p>
                                            ))}
                                        </div>
                                        <div className="mt-4">
                                            <h3 className="font-medium mb-2">Seasonal Prices</h3>
                                            {boat.seasonalPrices && Object.entries(boat.seasonalPrices).map(([season, price]) => (
                                                <p key={season} className="text-sm">
                                                    <span className="font-medium">{season}:</span> {price}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                </details>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BoatManagement;