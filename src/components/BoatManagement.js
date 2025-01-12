import React, { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db, storage } from "../firebase/firebaseConfig";
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
        // 1) Fetch boat data
        const boatDoc = await getDoc(doc(db, 'boats', boatId));
        if (!boatDoc.exists()) {
          throw new Error("Boat data not found");
        }
        const boatData = boatDoc.data();
    
        // 2) Initialise PDF (A4 portrait, minimal margins)
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });
    
        // Colour palette
        const colors = {
          deepBlue: [26, 61, 93], // #1A3D5D
          white: [255, 255, 255],
          charcoal: [50, 50, 50]
        };
    
        // Helper to load images from storage
        const loadImage = async (imageRef) => {
          try {
            const storageRef = ref(storage, imageRef);
            const url = await getDownloadURL(storageRef);
            const imageData = await new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.onload = function() {
                const reader = new FileReader();
                reader.onloadend = function() {
                  resolve(reader.result);
                };
                reader.readAsDataURL(xhr.response);
              };
              xhr.onerror = function() {
                reject(new Error('Failed to load image'));
              };
              xhr.open('GET', url);
              xhr.responseType = 'blob';
              xhr.send();
            });
            return imageData;
          } catch (error) {
            console.error('Image processing error:', error);
            return null;
          }
        };
    
        // --------------------
        // PAGE 1: OVERVIEW
        // --------------------
        // Helper function to generate dynamic key features
const generateKeyFeatures = (boatData) => {
  const features = [];

  // Add features based on boat specifications
  if (boatData.detailedSpecs?.Length && boatData.detailedSpecs?.Guests) {
      features.push(`Magnificent ${boatData.detailedSpecs.Length} vessel accommodating ${boatData.detailedSpecs.Guests} guests`);
  }

  // Add features based on equipment and amenities
  const luxuryFeatures = [];
  if (boatData.equipment?.jacuzziAndPool?.deckJacuzzi) luxuryFeatures.push("deck jacuzzi");
  if (boatData.amenities?.comfort?.stabilizers) luxuryFeatures.push("stabilizers");
  if (luxuryFeatures.length > 0) {
      features.push(`Ultimate luxury with ${luxuryFeatures.join(" and ")}`);
  }

  // Add water sports features
  const waterToys = [];
  if (boatData.waterSports?.seaBobs?.hasSeaBobs) waterToys.push("SeaBobs");
  if (boatData.waterSports?.jetSkis?.waverunners) waterToys.push("Wave Runners");
  if (waterToys.length > 0) {
      features.push(`Complete water sports experience including ${waterToys.join(" and ")}`);
  }

  // Add comfort and entertainment features
  const entertainmentFeatures = [];
  if (boatData.amenities?.entertainment?.wifi) entertainmentFeatures.push("WiFi");
  if (boatData.amenities?.entertainment?.satellite) entertainmentFeatures.push("Satellite TV");
  if (entertainmentFeatures.length > 0) {
      features.push(`Full entertainment package with ${entertainmentFeatures.join(" and ")}`);
  }

  // Default features if we need more
  const defaultFeatures = [
      "Experienced crew providing exceptional service",
      "Prime locations throughout the Balearics",
      "Customized itineraries for your perfect journey",
      "Unforgettable Mediterranean experience"
  ];

  // Fill remaining slots with default features
  while (features.length < 4) {
      features.push(defaultFeatures[features.length]);
  }

  return features.slice(0, 4);
};

// Front page generation
pdf.setFont('helvetica', 'normal');

// Background
pdf.setFillColor(...colors.deepBlue);
pdf.rect(0, 0, 210, 297, 'F');


// Boat name
pdf.setTextColor(...colors.white);
pdf.setFontSize(28);
pdf.text(
  (boatData.name || "BOAT").toUpperCase(),
  105,
  25,
  { align: 'center' }
);

// Add decorative lines under the title
pdf.setLineWidth(0.5);
pdf.line(50, 30, 160, 30);
pdf.setLineWidth(0.3);
pdf.line(70, 32, 140, 32);

// Main image
const imageWidth = 180;
const imageHeight = 110;
let imageX = (210 - imageWidth) / 2;
let imageY = 40;

if (boatData.images?.[0]) {
  const mainImageData = await loadImage(boatData.images[0]);
  if (mainImageData) {
      // Add subtle shadow effect
      pdf.setFillColor(0, 0, 0);
      pdf.setGState(new pdf.GState({ opacity: 0.1 }));
      pdf.rect(imageX + 2, imageY + 2, imageWidth, imageHeight, 'F');
      
      // Reset opacity for image
      pdf.setGState(new pdf.GState({ opacity: 1 }));
      pdf.addImage(
          mainImageData,
          'JPEG',
          imageX,
          imageY,
          imageWidth,
          imageHeight,
          undefined,
          'FAST'
      );
      imageY += imageHeight + 15;
  }
}

// Overview section
pdf.setFontSize(20);
pdf.setTextColor(...colors.white);
const overviewTitle = "OVERVIEW";
pdf.text(overviewTitle, 20, imageY);
imageY += 10;

// Description
if (boatData.description) {
  pdf.setFontSize(12);
  const maxWidth = 170;
  const wrappedText = pdf.splitTextToSize(boatData.description, maxWidth);
  pdf.text(wrappedText, 20, imageY);
  imageY += wrappedText.length * 5 + 15;
}

// Key Features section with dynamic content
const dynamicFeatures = generateKeyFeatures(boatData);

pdf.setFontSize(20);
pdf.text("KEY FEATURES", 20, imageY);
imageY += 12;

// Add features with custom styling
pdf.setFontSize(12);
dynamicFeatures.forEach((feature) => {
  // Add custom bullet point
  pdf.circle(22, imageY - 2, 1, 'F');
  pdf.text(feature, 26, imageY);
  imageY += 8;
});
        // --------------------
        // PAGE 2: GALLERY (since people like seeing images first)
        // --------------------
        if (boatData.images && boatData.images.length > 1) {
          pdf.addPage();
    
          // Title bar
          pdf.setFillColor(...colors.deepBlue);
          pdf.rect(0, 0, 210, 25, 'F');
    
          pdf.setFontSize(16);
          pdf.setTextColor(...colors.white);
          pdf.text("GALLERY", 10, 15);
    
          // Gallery images
          pdf.setFontSize(11);
          pdf.setTextColor(...colors.charcoal);
    
          let pageWidth = 210;
          let pageHeight = 297;
          let margin = 10;
          let imagesPerRow = 2;
          let maxImageWidth = (pageWidth - margin * 2 - 5) / imagesPerRow;
          let maxImageHeight = 70; 
    
          let xPos = margin;
          let yPosImg = 30;
    
          // images.slice(1) because the first was used on the Overview page
          const galleryImages = boatData.images.slice(1);
    
          for (let i = 0; i < galleryImages.length; i++) {
            const imageData = await loadImage(galleryImages[i]);
            if (imageData) {
              pdf.addImage(imageData, 'JPEG', xPos, yPosImg, maxImageWidth, maxImageHeight, undefined, 'FAST');
            }
            // Move xPos for next image
            xPos += maxImageWidth + 5;
    
            // If we've placed imagesPerRow images, wrap to next row
            if ((i + 1) % imagesPerRow === 0) {
              xPos = margin;
              yPosImg += maxImageHeight + 5;
            }
    
            // If we are near the bottom, add another page
            if (yPosImg + maxImageHeight + 20 > pageHeight) {
              pdf.addPage();
              pdf.setFillColor(...colors.deepBlue);
              pdf.rect(0, 0, 210, 25, 'F');
              pdf.setFontSize(16);
              pdf.setTextColor(...colors.white);
              pdf.text("GALLERY", 10, 15);
    
              xPos = margin;
              yPosImg = 30;
            }
          }
        }
    
        // --------------------
        // PAGE 3: SPECIFICATIONS
        // --------------------
        pdf.addPage();
        // Title bar
        pdf.setFillColor(...colors.deepBlue);
        pdf.rect(0, 0, 210, 25, 'F');
    
        pdf.setFontSize(16);
        pdf.setTextColor(...colors.white);
        pdf.text("SPECIFICATIONS", 10, 15);
    
        // Collect specifications
        // We'll put them in a consistent table to match the Seasonal Prices design
        pdf.setFontSize(11);
        pdf.setTextColor(...colors.charcoal);
    
        // Specs array: label, value
        // We'll unify everything inside a single table to maintain consistency
        const specsData = [
          ["Class", boatData.detailedSpecs?.Class || boatData.Class || ""],
          ["Length", boatData.detailedSpecs?.Length || boatData.Length || ""],
          ["Beam", boatData.detailedSpecs?.Beam || ""],
          ["Guests", boatData.detailedSpecs?.Guests || boatData.Guests || ""],
          ["Cabins", boatData.detailedSpecs?.Cabins || ""],
          ["Crew", boatData.detailedSpecs?.Crew || boatData.Crew || ""],
          ["Cruising Area", boatData.detailedSpecs?.["Cruising Area"] || boatData["Cruising Area"] || ""],
          ["Cruising Speed", boatData.detailedSpecs?.["Cruising Speed"] || boatData["Cruising Speed"] || ""],
          ["Engine", boatData.detailedSpecs?.Engine || boatData.Engine || ""],
          ["HP", boatData.detailedSpecs?.HP || boatData.HP || ""],
          ["Max Speed", boatData.detailedSpecs?.["Max Speed"] || boatData["Max Speed"] || ""],
          ["Price", boatData.detailedSpecs?.Price || boatData.Price || ""]
        ].filter(([, val]) => val); // Only rows with non-empty values
    
        // Convert to the format for autoTable
        const specsTableBody = specsData.map(([label, value]) => ([
          label,
          value
        ]));
    
        let startY = 35; 
        pdf.autoTable({
          startY,
          head: [['Specification', 'Value']],
          body: specsTableBody,
          theme: 'grid',
          styles: {
            cellPadding: 2,
            fontSize: 10,
            textColor: colors.charcoal
          },
          headStyles: {
            fillColor: colors.deepBlue,
            textColor: colors.white
          },
          margin: { left: 10, right: 10 }
        });
    
        // Move below the specs table
        startY = pdf.autoTable.previous.finalY + 10;
    
        // If Seasonal Prices exist, show them in a separate table 
        if (boatData.seasonalPrices) {
          // Title
          pdf.setFontSize(12);
          pdf.setTextColor(...colors.deepBlue);
          pdf.text("SEASONAL PRICES", 10, startY);
          startY += 5;
    
          // Convert seasonalPrices into table format
          const priceTableData = Object.entries(boatData.seasonalPrices).map(([season, price]) => [season, price]);
    
          pdf.setFontSize(10);
          pdf.setTextColor(...colors.charcoal);
          pdf.autoTable({
            startY,
            head: [['Season', 'Price']],
            body: priceTableData,
            theme: 'grid',
            styles: {
              fontSize: 10,
              textColor: colors.charcoal
            },
            headStyles: {
              fillColor: colors.deepBlue,
              textColor: colors.white
            },
            margin: { left: 10, right: 10 }
          });
        }
    
        // Finally, save
        const fileName = (boatData.name || "boat")
          .replace(/\s+/g, '-')
          .toLowerCase() + "-details.pdf";
        pdf.save(fileName);
    
      } catch (error) {
        console.error("PDF generation error:", error);
        alert("Failed to generate PDF. Please try again.");
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