import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, storage } from "../firebase/firebaseConfig";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PenSquare, Trash2, Download, Eye, EyeOff } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { ref, getDownloadURL } from 'firebase/storage';

const PDF_COLORS = {
    navy: [4, 34, 57],
    accent: [0, 138, 168],
    text: [42, 55, 68],
    muted: [117, 127, 140],
    pale: [247, 249, 252]
};

const LABEL_OVERRIDES = {
    wifi: 'Wi-Fi',
    appleTV: 'Apple TV',
    sonos: 'Sonos Sound System',
    ipodDockingStation: 'iPod Docking Station',
    bbqGrill: 'BBQ Grill',
    epirb: 'EPIRB',
    hasSeaBobs: 'SeaBobs',
    seaBobCount: 'SeaBob Count',
    hasEFoils: 'E-Foils',
    eFoilCount: 'E-Foil Count',
    hasInflatables: 'Inflatables',
    waverunners: 'WaveRunners',
    waverunnerCount: 'WaveRunner Count',
    standUpJetskis: 'Stand-up Jet Skis',
    standUpJetskiCount: 'Stand-up Jet Ski Count',
    paddleboardCount: 'Paddleboard Count',
    tenderCount: 'Tender Count',
    deckJacuzzi: 'Deck Jacuzzi',
    antiJellyfishPool: 'Anti-Jellyfish Pool',
    aquapark: 'Aqua Park',
    profesionalGalley: 'Professional Galley',
    outdoorLounge: 'Outdoor Lounge Area',
    sundeckShower: 'Sundeck Shower',
    childFriendly: 'Child Friendly',
    toysAndGames: 'Toys & Games',
    barService: 'Bar Service'
};

const formatFeatureLabel = (key = '') => {
    if (!key) return '';
    if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key];
    const spaced = key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!spaced) return '';
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const normalizeSectionItems = (source) => {
    if (!source || typeof source !== 'object') return [];
    return Object.entries(source)
        .filter(([, value]) => value)
        .map(([key, value]) => {
            if (typeof value === 'boolean') {
                return formatFeatureLabel(key);
            }
            const stringValue = value?.toString().trim();
            if (!stringValue) return null;
            return `${formatFeatureLabel(key)}: ${stringValue}`;
        })
        .filter(Boolean);
};

const buildAmenitySections = (boat = {}) => {
    const sections = [];
    const { amenities = {}, waterSports = {}, equipment = {}, additional = {} } = boat;

    const addSection = (title, data) => {
        const items = normalizeSectionItems(data);
        if (items.length) {
            sections.push({ title, items });
        }
    };

    const comfort = amenities.comfort || {};
    const { deck = {}, ...indoorComfort } = comfort;

    addSection('Entertainment', amenities.entertainment);
    addSection('Indoor Comfort', indoorComfort);
    addSection('Deck Living', deck);
    addSection('Dining', amenities.dining);
    addSection('Wellness & Fitness', amenities.wellness);
    addSection('Family & Kids', amenities.kids);
    addSection('Accessibility', amenities.access);

    addSection('Tenders', equipment.tenders);
    addSection('Jacuzzi & Pools', equipment.jacuzziAndPool);

    addSection('Jet Skis & Watercraft', waterSports.jetSkis);
    addSection('SeaBobs', waterSports.seaBobs);
    addSection('E-Foils', waterSports.eFoils);
    addSection('Water Toys', waterSports.waterToys);
    addSection('Diving & Fishing', waterSports.diving);
    addSection('Inflatables', waterSports.inflatables);

    addSection('Crew', additional.crew);
    addSection('Guest Services', additional.services);
    addSection('Safety', additional.safety);

    return sections;
};

const createSeasonalEntries = (seasonalPrices = {}) => {
    const entries = Object.entries(seasonalPrices)
        .map(([label, price]) => ({ label, price: price || '—' }))
        .filter(({ label }) => label);
    if (entries.length) return entries;
    return [
        { label: 'May – October', price: '—' },
        { label: 'June – September', price: '—' },
        { label: 'July – August', price: '—' }
    ];
};

const buildHeroHighlights = (boat = {}) => {
    const specs = boat.detailedSpecs || {};
    const highlights = [];
    if (specs.Length) highlights.push(specs.Length);
    if (specs.Beam) highlights.push(`Beam ${specs.Beam}`);
    if (specs.Guests) highlights.push(`Capacity ${specs.Guests} pax`);
    if (specs.Crew) highlights.push(`Crew ${specs.Crew}`);
    if (specs['Cruising Speed']) highlights.push(`Cruising ${specs['Cruising Speed']}`);
    if (specs['Max Speed']) highlights.push(`Top ${specs['Max Speed']}`);
    if (specs.Consumption) highlights.push(`Consumption ${specs.Consumption}`);
    return highlights.slice(0, 4);
};

const slugify = (value = 'boat') =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const getImageFormat = (dataUrl = '') =>
    dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';

const BoatManagement = () => {
    const [boats, setBoats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pdfLoading, setPdfLoading] = useState({});
    const [error, setError] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [bulkModalOpen, setBulkModalOpen] = useState(false);
    const [bulkUpdating, setBulkUpdating] = useState(false);
    const [boatToDelete, setBoatToDelete] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const fetchBoats = async () => {
        try {
            setLoading(true);
            const boatsRef = collection(db, 'boats');
            const boatsSnapshot = await getDocs(boatsRef);
            const boatsList = boatsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                // Set default visibility to true if not specified
                visible: doc.data().visible !== undefined ? doc.data().visible : true
            }));
            setBoats(boatsList);
        } catch (error) {
            console.error('Error fetching boats:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBulkVisibilityConfirm = async () => {
        setBulkUpdating(true);
        try {
            const boatsRef = collection(db, 'boats');
            const snapshot = await getDocs(boatsRef);
            const updates = [];
            snapshot.forEach((boatDoc) => {
                updates.push(updateDoc(boatDoc.ref, { visible: true }));
            });
            const total = updates.length;
            await Promise.all(updates);
            setFeedback({
                type: 'success',
                message: total === 0
                    ? 'There were no boats to update.'
                    : `Success! ${total} boat${total === 1 ? '' : 's'} are now visible on the website.`
            });
            await fetchBoats();
        } catch (err) {
            console.error('Error updating boats:', err);
            setFeedback({ type: 'error', message: 'Failed to update boat visibility. Please try again.' });
        } finally {
            setBulkUpdating(false);
            setBulkModalOpen(false);
        }
    };

    

    useEffect(() => {
        fetchBoats();
    }, []);

    useEffect(() => {
        const searchValue = searchParams.get('search') || '';
        if (searchValue && searchValue !== searchTerm) {
            setSearchTerm(searchValue);
        }
        if (!searchValue && searchTerm) {
            setSearchTerm('');
        }
    }, [searchParams, searchTerm]);

    useEffect(() => {
        if (!feedback) return;
        const timer = setTimeout(() => setFeedback(null), 5000);
        return () => clearTimeout(timer);
    }, [feedback]);

    const filteredBoats = useMemo(() => {
        if (!searchTerm.trim()) return boats;
        const term = searchTerm.trim().toLowerCase();
        return boats.filter((boat) => {
            const nameMatch = boat.name?.toLowerCase().includes(term);
            const descriptionMatch = boat.description?.toLowerCase().includes(term);
            const specMatch = Object.values(boat.detailedSpecs || {}).some((value) =>
                String(value).toLowerCase().includes(term)
            );
            return nameMatch || descriptionMatch || specMatch;
        });
    }, [boats, searchTerm]);

    const requestDeleteBoat = (boat) => {
        setBoatToDelete(boat);
        setDeleteLoading(false);
    };

    const confirmDeleteBoat = async () => {
        if (!boatToDelete) return;

        setDeleteLoading(true);
        try {
            await deleteDoc(doc(db, 'boats', boatToDelete.id));
            setBoats(prev => prev.filter(boat => boat.id !== boatToDelete.id));
            setFeedback({ type: 'success', message: `${boatToDelete.name} was removed from the fleet.` });
            setBoatToDelete(null);
        } catch (error) {
            console.error('Error deleting boat:', error);
            setFeedback({ type: 'error', message: 'Failed to delete the boat. Please try again.' });
            setDeleteLoading(false);
        }
    };

    const handleEdit = (boatId) => {
        navigate(`/edit-boat/${boatId}`);
    };

    const handleToggleVisibility = async (boatId, currentVisibility) => {
        try {
            // Update visibility in Firestore
            const boatRef = doc(db, 'boats', boatId);
            await updateDoc(boatRef, {
                visible: !currentVisibility
            });
            
            // Update local state
            setBoats(boats.map(boat => 
                boat.id === boatId 
                    ? { ...boat, visible: !currentVisibility } 
                    : boat
            ));
            const targetBoat = boats.find(boat => boat.id === boatId);
            if (targetBoat) {
                setFeedback({
                    type: 'success',
                    message: `${targetBoat.name} is now ${!currentVisibility ? 'visible' : 'hidden'} on the website.`
                });
            }
        } catch (error) {
            console.error('Error updating boat visibility:', error);
            setFeedback({ type: 'error', message: 'Failed to update visibility. Please try again.' });
        }
    };

    const handleGeneratePdf = async (boatId) => {
        setPdfLoading(prev => ({ ...prev, [boatId]: true }));

        try {
            const boatDoc = await getDoc(doc(db, 'boats', boatId));
            if (!boatDoc.exists()) {
                throw new Error('Boat data not found.');
            }
            const boatData = boatDoc.data();

            const loadImage = async (imageRef) => {
                if (!imageRef) return null;
                if (imageRef.startsWith('data:image')) {
                    return imageRef;
                }
                try {
                    let url = imageRef;
                    if (!/^https?:\/\//i.test(imageRef)) {
                        const storageRef = ref(storage, imageRef);
                        url = await getDownloadURL(storageRef);
                    }
                    const response = await fetch(url);
                    const blob = await response.blob();
                    return await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = () => reject(new Error('Failed to read image.'));
                        reader.readAsDataURL(blob);
                    });
                } catch (error) {
                    console.error('Image processing error:', error);
                    return null;
                }
            };

            const imageData = await Promise.all(
                (boatData.images || []).map((imageRef) => loadImage(imageRef))
            );
            const galleryImages = imageData.filter(Boolean);

            if (!galleryImages.length) {
                throw new Error('Please upload at least one image before exporting the brochure.');
            }

            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 12;
            const headerHeight = 24;
            const seasonalEntries = createSeasonalEntries(boatData.seasonalPrices);
            const heroHighlights = buildHeroHighlights(boatData);

            const drawTopBar = (title, subtitle) => {
                pdf.setFillColor(...PDF_COLORS.navy);
                pdf.rect(0, 0, pageWidth, headerHeight, 'F');
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(22);
                pdf.setTextColor(255, 255, 255);
                pdf.text(title, margin, headerHeight / 2 + 6);
                if (subtitle) {
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(11);
                    pdf.text(subtitle, pageWidth - margin, headerHeight / 2 + 4, { align: 'right' });
                }
            };

            const drawHeroPage = () => {
                drawTopBar(
                    (boatData.name || 'Luxury Yacht').toUpperCase(),
                    boatData.tagline || 'Bespoke charter quotation'
                );

                let currentY = headerHeight + 8;
                const heroImage = galleryImages[0];
                if (heroImage) {
                    const heroHeight = 110;
                    pdf.addImage(
                        heroImage,
                        getImageFormat(heroImage),
                        margin,
                        currentY,
                        pageWidth - margin * 2,
                        heroHeight,
                        undefined,
                        'FAST'
                    );
                    currentY += heroHeight + 8;
                }

                const secondaryImages = galleryImages.slice(1, 5);
                if (secondaryImages.length) {
                    const gap = 6;
                    const thumbWidth =
                        (pageWidth - margin * 2 - gap * (secondaryImages.length - 1)) /
                        secondaryImages.length;
                    const thumbHeight = 32;
                    let thumbX = margin;
                    secondaryImages.forEach((image) => {
                        pdf.addImage(
                            image,
                            getImageFormat(image),
                            thumbX,
                            currentY,
                            thumbWidth,
                            thumbHeight,
                            undefined,
                            'FAST'
                        );
                        thumbX += thumbWidth + gap;
                    });
                }

                const highlightY = pageHeight - 52;
                if (heroHighlights.length) {
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(10);
                    pdf.setTextColor(...PDF_COLORS.muted);
                    pdf.text(
                        heroHighlights.join('   •   '),
                        pageWidth / 2,
                        highlightY,
                        { align: 'center' }
                    );
                }

                const priceBlockTop = pageHeight - 40;
                const cellWidth = (pageWidth - margin * 2) / seasonalEntries.length;

                pdf.setLineWidth(0.2);
                pdf.setDrawColor(226, 232, 240);
                pdf.setFillColor(255, 255, 255);
                pdf.roundedRect(
                    margin,
                    priceBlockTop - 10,
                    pageWidth - margin * 2,
                    32,
                    4,
                    4,
                    'S'
                );

                seasonalEntries.forEach((entry, index) => {
                    const cellX = margin + index * cellWidth;
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(10);
                    pdf.setTextColor(...PDF_COLORS.muted);
                    pdf.text(entry.label, cellX + cellWidth / 2, priceBlockTop - 2, { align: 'center' });

                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(17);
                    pdf.setTextColor(...PDF_COLORS.navy);
                    pdf.text(entry.price || '—', cellX + cellWidth / 2, priceBlockTop + 12, { align: 'center' });

                    if (index < seasonalEntries.length - 1) {
                        pdf.setDrawColor(235, 239, 245);
                        pdf.line(cellX + cellWidth, priceBlockTop - 10, cellX + cellWidth, priceBlockTop + 22);
                    }
                });

                const finePrint = boatData.finePrint || 'Crew and VAT 21% included. Fuel not included.';
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(9);
                pdf.setTextColor(...PDF_COLORS.muted);
                pdf.text(finePrint, pageWidth / 2, pageHeight - 12, { align: 'center' });
            };

            const drawGalleryPages = (images) => {
                if (!images.length) return;
                let index = 0;

                const imageHeight = (pageHeight - headerHeight - 42) / 2;

                while (index < images.length) {
                    pdf.addPage();
                    drawTopBar('Gallery', 'Immersive views');
                    let y = headerHeight + 12;

                    for (let row = 0; row < 2 && index < images.length; row++) {
                        const img = images[index];
                        pdf.addImage(
                            img,
                            getImageFormat(img),
                            margin,
                            y,
                            pageWidth - margin * 2,
                            imageHeight,
                            undefined,
                            'FAST'
                        );
                        y += imageHeight + 12;
                        index += 1;
                    }
                }
            };

            const drawAmenitiesPages = (sections, descriptionText) => {
                if (!sections.length && !descriptionText) return;

                const gutter = 12;
                const columns = 2;
                const columnWidth = (pageWidth - margin * 2 - gutter) / columns;

                const drawCheckbox = (x, y) => {
                    const size = 4;
                    pdf.setDrawColor(...PDF_COLORS.accent);
                    pdf.setLineWidth(0.2);
                    pdf.roundedRect(x, y - size + 1, size, size, 0.7, 0.7, 'S');
                    pdf.setFillColor(...PDF_COLORS.accent);
                    pdf.roundedRect(x, y - size + 1, size, size, 0.7, 0.7, 'F');
                    pdf.setDrawColor(255, 255, 255);
                    pdf.setLineWidth(0.7);
                    pdf.line(x + 0.9, y - 0.4, x + 1.8, y + 0.8);
                    pdf.line(x + 1.8, y + 0.8, x + 3.1, y - 0.9);
                    pdf.setLineWidth(0.2);
                };

                let column = 0;
                let x = margin;
                let y = headerHeight + 14;
                let descriptionRendered = false;

                const startPage = () => {
                    pdf.addPage();
                    drawTopBar('Onboard Experience', 'Amenities & extras');
                    column = 0;
                    x = margin;
                    y = headerHeight + 14;
                };

                const advanceColumn = () => {
                    column += 1;
                    if (column >= columns) {
                        startPage();
                    } else {
                        x = margin + column * (columnWidth + gutter);
                        y = headerHeight + 14;
                    }
                };

                startPage();

                const renderDescription = () => {
                    if (descriptionRendered || !descriptionText) return;
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(11);
                    pdf.setTextColor(...PDF_COLORS.text);
                    const wrapped = pdf.splitTextToSize(descriptionText, pageWidth - margin * 2);
                    pdf.text(wrapped, margin, y);
                    y += wrapped.length * 5 + 10;
                    descriptionRendered = true;
                };

                renderDescription();

                sections.forEach((section) => {
                    const sectionTitleHeight = 8;
                    if (y + sectionTitleHeight > pageHeight - margin) {
                        advanceColumn();
                    }

                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(11);
                    pdf.setTextColor(...PDF_COLORS.navy);
                    pdf.text(section.title.toUpperCase(), x, y);
                    y += 6;

                    section.items.forEach((item) => {
                        if (y + 6 > pageHeight - margin) {
                            advanceColumn();
                            pdf.setFont('helvetica', 'bold');
                            pdf.setFontSize(11);
                            pdf.setTextColor(...PDF_COLORS.navy);
                            pdf.text(section.title.toUpperCase(), x, y);
                            y += 6;
                        }
                        pdf.setFont('helvetica', 'normal');
                        pdf.setFontSize(9.5);
                        pdf.setTextColor(...PDF_COLORS.text);
                        drawCheckbox(x, y + 1);
                        const wrapped = pdf.splitTextToSize(item, columnWidth - 10);
                        pdf.text(wrapped, x + 7, y + 1);
                        y += wrapped.length * 5 + 2;
                    });

                    y += 4;
                });
            };

            drawHeroPage();
            drawGalleryPages(galleryImages.slice(1));
            const amenitySections = buildAmenitySections(boatData);
            drawAmenitiesPages(amenitySections, boatData.description);

            const fileName = `${slugify(boatData.name || 'boat')}-brochure.pdf`;
            pdf.save(fileName);
        } catch (error) {
            console.error('PDF generation error:', error);
            setFeedback({ type: 'error', message: error.message || 'Failed to generate PDF. Please try again.' });
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
        <div className="space-y-6">
            {feedback && (
                <div
                    className={`app-card border-l-4 px-4 py-3 text-sm font-medium ${
                        feedback.type === 'success'
                            ? 'border-l-green-500 text-green-700'
                            : 'border-l-red-500 text-red-600'
                    }`}
                >
                    {feedback.message}
                </div>
            )}

            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--text-tertiary)]">
                        Fleet
                    </p>
                    <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Boat Management</h1>
                    <p className="text-sm text-[var(--text-secondary)]">
                        Curate the Nautiq fleet and publish availability in one workspace.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setBulkModalOpen(true)}
                        className="app-button--secondary text-sm"
                        disabled={bulkUpdating || !boats.length}
                    >
                        {bulkUpdating ? 'Updating…' : 'Make all visible'}
                    </button>
                    <button
                        onClick={() => navigate('/add-boat')}
                        className="app-button text-sm"
                    >
                        Add new boat
                    </button>
                </div>
            </div>

            <div className="app-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-[var(--text-secondary)]">
                    Showing <span className="font-semibold text-[var(--text-primary)]">{filteredBoats.length}</span> of {boats.length} boats
                </p>
                <div className="relative w-full md:w-72">
                    <input
                        type="search"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search boats, specs or destinations…"
                        className="app-input pl-4 pr-3"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredBoats.map((boat) => (
                    <div
                        key={boat.id}
                        className={`app-card overflow-hidden ${!boat.visible ? 'opacity-75 ring-1 ring-dashed ring-[var(--border)]' : ''}`}
                    >
                        <div className="relative h-56 w-full overflow-hidden rounded-[calc(var(--radius-lg)-0.5rem)]">
                            <img
                                src={boat.images?.[0] || boat.image}
                                alt={boat.name}
                                className="h-full w-full object-cover"
                            />
                            {!boat.visible && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-white text-sm font-semibold tracking-wide uppercase">
                                    Hidden from website
                                </div>
                            )}
                            <div className="absolute top-4 right-4 flex gap-2">
                                <button
                                    onClick={() => handleToggleVisibility(boat.id, boat.visible)}
                                    className="icon-button"
                                    title={boat.visible ? 'Hide from website' : 'Show on website'}
                                >
                                    {boat.visible ? (
                                        <Eye size={18} className="text-[var(--success)]" />
                                    ) : (
                                        <EyeOff size={18} className="text-[var(--text-secondary)]" />
                                    )}
                                </button>
                                <button onClick={() => handleEdit(boat.id)} className="icon-button" title="Edit boat">
                                    <PenSquare size={18} className="text-[var(--accent)]" />
                                </button>
                                <button onClick={() => requestDeleteBoat(boat)} className="icon-button" title="Delete boat">
                                    <Trash2 size={18} className="text-[var(--danger)]" />
                                </button>
                                <button
                                    onClick={() => handleGeneratePdf(boat.id)}
                                    disabled={pdfLoading[boat.id]}
                                    className="icon-button"
                                    title="Download PDF brochure"
                                >
                                    {pdfLoading[boat.id] ? (
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-b-transparent" />
                                    ) : (
                                        <Download size={18} className="text-[var(--text-secondary)]" />
                                    )}
                                </button>
                            </div>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">{boat.name}</h2>
                                    <p className="text-sm text-[var(--text-secondary)]">
                                        {boat.detailedSpecs?.Builder || boat.category || 'Custom charter'}
                                    </p>
                                </div>
                                {!boat.visible && (
                                    <span className="muted-chip text-[var(--danger)] border-[var(--danger-light)] bg-[var(--danger-light)]/40">
                                        Hidden
                                    </span>
                                )}
                            </div>

                            <dl className="grid grid-cols-2 gap-3 text-sm text-[var(--text-secondary)]">
                                <div>
                                    <dt className="text-[var(--text-tertiary)] uppercase tracking-[0.2em] text-[11px]">Length</dt>
                                    <dd className="font-medium text-[var(--text-primary)]">{boat.detailedSpecs?.Length || '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-[var(--text-tertiary)] uppercase tracking-[0.2em] text-[11px]">Guests</dt>
                                    <dd className="font-medium text-[var(--text-primary)]">{boat.detailedSpecs?.Guests || '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-[var(--text-tertiary)] uppercase tracking-[0.2em] text-[11px]">Crew</dt>
                                    <dd className="font-medium text-[var(--text-primary)]">{boat.detailedSpecs?.Crew || '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-[var(--text-tertiary)] uppercase tracking-[0.2em] text-[11px]">Cruising area</dt>
                                    <dd className="font-medium text-[var(--text-primary)]">{boat.detailedSpecs?.['Cruising Area'] || '—'}</dd>
                                </div>
                            </dl>

                            <details className="border-t border-[var(--border)] pt-4">
                                <summary className="text-sm font-semibold text-[var(--accent)] cursor-pointer">
                                    {boat.description ? 'Overview' : 'View details'}
                                </summary>
                                <div className="mt-3 space-y-4 text-sm text-[var(--text-secondary)]">
                                    {boat.description && <p>{boat.description}</p>}
                                    <div className="grid grid-cols-2 gap-3">
                                        {boat.detailedSpecs &&
                                            Object.entries(boat.detailedSpecs).map(([key, value]) => (
                                                <p key={key} className="text-sm">
                                                    <span className="font-medium text-[var(--text-primary)]">{key}:</span> {value}
                                                </p>
                                            ))}
                                    </div>
                                    {boat.seasonalPrices && (
                                        <div>
                                            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Seasonal prices</h3>
                                            <div className="mt-2 space-y-1">
                                                {Object.entries(boat.seasonalPrices).map(([season, price]) => (
                                                    <p key={season} className="text-sm">
                                                        <span className="font-medium">{season}:</span> {price}
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </details>
                        </div>
                    </div>
                ))}
                {!filteredBoats.length && (
                    <div className="col-span-full app-card p-10 text-center text-[var(--text-secondary)]">
                        No boats match your search. Try a different keyword.
                    </div>
                )}
            </div>

            {bulkModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                    <div className="w-full max-w-md app-card p-6">
                        <h2 className="text-lg font-semibold text-gray-900">Make all boats visible?</h2>
                        <p className="mt-2 text-sm text-gray-600">
                            This will publish every boat in the fleet to the website. Hidden boats will become visible immediately.
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setBulkModalOpen(false)}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                disabled={bulkUpdating}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkVisibilityConfirm}
                                className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                                disabled={bulkUpdating}
                            >
                                {bulkUpdating ? 'Updating…' : `Confirm (${boats.length})`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {boatToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                    <div className="w-full max-w-md app-card p-6">
                        <h2 className="text-lg font-semibold text-gray-900">Delete {boatToDelete.name}?</h2>
                        <p className="mt-2 text-sm text-gray-600">
                            This action cannot be undone. The boat will be removed from the fleet list permanently.
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setBoatToDelete(null)}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                disabled={deleteLoading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteBoat}
                                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                                disabled={deleteLoading}
                            >
                                {deleteLoading ? 'Deleting…' : 'Delete boat'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BoatManagement;
