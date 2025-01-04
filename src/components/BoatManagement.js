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
        const boatDoc = await getDoc(doc(db, 'boats', boatId));
        if (!boatDoc.exists()) {
            alert("Boat data not found.");
            return;
        }
        const boatData = boatDoc.data();

        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const softBlue = [32, 149, 174];
        const white = [255, 255, 255];

        pdf.setFillColor(...white);
        pdf.rect(0, 0, 210, 297, 'F');

        // Add header
        pdf.setTextColor(...softBlue);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(36);
        pdf.text(boatData.name, 20, 30);

        // Handle image loading
        if (boatData.images && boatData.images.length > 0) {
            try {
                const storageRef = ref(storage, boatData.images[0]);
                const imageUrl = await getDownloadURL(storageRef);

                await new Promise((resolve, reject) => { // eslint-disable-line no-unused-vars
                    const img = new Image();
                    img.crossOrigin = "Anonymous";
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
                        pdf.addImage(dataUrl, 'JPEG', 20, 40, 170, 75, undefined, 'FAST');
                        resolve();
                    };
                    img.onerror = (error) => {
                        const errorMsg = `Failed to load image for PDF: ${imageUrl}`;
                        console.error(errorMsg, error);
                        pdf.setFontSize(12);
                        pdf.setTextColor(255, 0, 0); // Red color for error
                        pdf.text("Image not available", 20, 70);
                        resolve(); // Still resolve to continue PDF generation
                        // If you wanted to stop PDF generation on image failure, you would call reject:
                        // reject(new Error(errorMsg));
                    };
                    img.src = `${imageUrl}?t=${new Date().getTime()}`; // Add cache-busting
                });

            } catch (error) {
                console.error('Image processing error:', error);
                pdf.setFontSize(12);
                pdf.setTextColor(255, 0, 0); // Red color for error
                pdf.text("Image not available", 20, 70);
            }
        } else {
            pdf.setFontSize(12);
            pdf.setTextColor(100, 100, 100);
            pdf.text("No image available", 20, 40);
        }

        // Add description
        pdf.setTextColor(...softBlue);
        pdf.setFontSize(12);
        const splitDescription = pdf.splitTextToSize(boatData.description || "", 170);
        pdf.text(splitDescription, 20, 130);

        // Add specifications section
        pdf.setFontSize(20);
        pdf.text("SPECIFICATIONS", 20, 180);

        // Create specifications table
        const specs = [
            ["Length", boatData.detailedSpecs?.Length],
            ["Beam", boatData.detailedSpecs?.Beam],
            ["Guests", boatData.detailedSpecs?.Guests],
            ["Cabins", boatData.detailedSpecs?.Cabins],
            ["Crew", boatData.detailedSpecs?.Crew],
            ["Price", boatData.detailedSpecs?.Price],
            ["Cruising Speed", boatData.detailedSpecs?.['Cruising Speed']],
            ["Max Speed", boatData.detailedSpecs?.['Max Speed']],
            ["Class", boatData.detailedSpecs?.Class],
            ["Engine", boatData.detailedSpecs?.Engine]
        ].filter(([, value]) => value);

        pdf.autoTable({
            startY: 190,
            head: [['Specification', 'Details']],
            body: specs,
            theme: 'grid',
            headStyles: {
                fillColor: [...softBlue],
                textColor: [255, 255, 255],
                fontSize: 12,
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 10,
                cellPadding: 5
            },
            columnStyles: {
                0: { fontStyle: 'bold' }
            },
            margin: { left: 20, right: 20 }
        });

        // Add seasonal prices if available
        if (boatData.seasonalPrices && Object.keys(boatData.seasonalPrices).length > 0) {
            const priceData = Object.entries(boatData.seasonalPrices)
                .filter(([, price]) => price)
                .map(([season, price]) => [season, price]);

            if (priceData.length > 0) {
                pdf.autoTable({
                    startY: pdf.previousAutoTable.finalY + 15,
                    head: [['Season', 'Rate']],
                    body: priceData,
                    theme: 'grid',
                    headStyles: {
                        fillColor: [...softBlue],
                        textColor: [255, 255, 255],
                        fontSize: 12,
                        fontStyle: 'bold'
                    },
                    styles: {
                        fontSize: 10,
                        cellPadding: 5
                    },
                    margin: { left: 20, right: 20 }
                });
            }
        }

        // Add footer
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text(
            'For more information or to make a reservation, please contact us',
            pdf.internal.pageSize.width / 2,
            287,
            { align: 'center' }
        );

        // Save the PDF
        const fileName = `${boatData.name.replace(/\s+/g, '-').toLowerCase()}-specification.pdf`;
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