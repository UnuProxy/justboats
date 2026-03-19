import React, { useState, useRef, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { db, storage } from '../firebase/firebaseConfig';
import { collection, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  Ship, Upload, Download, Trash2, Eye, Image as ImageIcon,
  Calendar, ChevronDown,
  Palette, FileText, Copy, Check, Sparkles, RefreshCw, Save,
  Building2, Utensils, GripVertical
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// NAUTIQ IBIZA - LUXURY BOAT BROCHURE BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

const TEMPLATE_STYLES = {
  luxury: {
    name: 'Luxury Ibiza',
    headerBg: 'linear-gradient(135deg, #0f2744 0%, #1e3a5f 50%, #0891b2 100%)',
    accentColor: '#d4a574',
    textColor: '#ffffff',
    footerBg: '#0f2744',
  },
  mediterranean: {
    name: 'Mediterranean Blue',
    headerBg: 'linear-gradient(135deg, #0369a1 0%, #0891b2 50%, #22d3ee 100%)',
    accentColor: '#fbbf24',
    textColor: '#ffffff',
    footerBg: '#0369a1',
  },
  sunset: {
    name: 'Ibiza Sunset',
    headerBg: 'linear-gradient(135deg, #f97316 0%, #f59e0b 50%, #fbbf24 100%)',
    accentColor: '#0f2744',
    textColor: '#ffffff',
    footerBg: '#ea580c',
  },
  elegant: {
    name: 'Elegant White',
    headerBg: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)',
    accentColor: '#0891b2',
    textColor: '#0f172a',
    footerBg: '#334155',
  },
  purewhite: {
    name: 'Pure White',
    headerBg: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eef2f7 100%)',
    accentColor: '#94a3b8',
    textColor: '#0f172a',
    footerBg: '#f8fafc',
  },
  emerald: {
    name: 'Emerald Sea',
    headerBg: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%)',
    accentColor: '#fcd34d',
    textColor: '#ffffff',
    footerBg: '#064e3b',
  },
};

const DEFAULT_RESTAURANTS = [
  { id: 'cancarlito', name: 'Can Carlito', logo: null },
  { id: 'esmoli', name: 'Es Molí de Sal', logo: null },
  { id: 'chezgerdi', name: 'Chez Gerdi', logo: null },
  { id: 'tiburon', name: 'Tiburon', logo: null },
  { id: 'juanyandrea', name: 'Juan y Andrea', logo: null },
  { id: 'beso', name: 'Beso Beach', logo: null },
];

const DEFAULT_PARTNERS = [
  { id: 'sunseeker', name: 'Sunseeker', logo: null },
  { id: 'quicksilver', name: 'Quicksilver', logo: null },
  { id: 'deantonio', name: 'De Antonio Yachts', logo: null },
  { id: 'vqyachts', name: 'VQ Yachts', logo: null },
  { id: 'pardo', name: 'Pardo Yachts', logo: null },
];

const PRICING_PERIODS = [
  { key: 'may', inputLabel: 'May', brochureLabel: 'May' },
  { key: 'juneEarly', inputLabel: 'Jun 1-14', brochureLabel: '1-14 Jun' },
  { key: 'peakSeason', inputLabel: '15 Jun - 20 Aug', brochureLabel: '15 Jun - 20 Aug' },
  { key: 'augustLate', inputLabel: 'Aug 21-31', brochureLabel: '21-31 Aug' },
  { key: 'sept', inputLabel: 'Sept', brochureLabel: 'Sept.' },
  { key: 'oct', inputLabel: 'Oct', brochureLabel: 'Oct.' },
];
const LEGACY_MONTHS = ['May', 'June', 'July', 'Aug', 'Sept', 'Oct'];
const DEFAULT_INCLUDED_ITEMS = ['Captain', 'Soft drinks', 'Ice', 'Snorkel gear', 'Towels'];
const DEFAULT_NOT_INCLUDED_ITEMS = ['Fuel', 'Seabob', 'Overnight stay', 'Transfer service'];
const DEFAULT_AMENITIES = ['Bedroom Cabin', 'Bathroom', 'Wi-Fi', 'Bluetooth Audio', 'Sunbed', 'Fridge', 'Deck Shower', 'Swim Ladder'];
const EXTRA_GALLERY_PAGE_SIZE = 6;
const MAX_BROCHURE_IMAGES = 10;
const BROCHURE_COLLECTION = 'boatBrochureTemplates';

const hexToRgba = (hex, alpha = 1) => {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(255,255,255,${alpha})`;
  const normalized = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const firstDefinedValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

const normalizePricing = (pricing = {}) => ({
  may: firstDefinedValue(pricing.may, pricing.May, ''),
  juneEarly: firstDefinedValue(pricing.juneEarly, pricing.June, ''),
  peakSeason: firstDefinedValue(pricing.peakSeason, pricing.July, pricing.June, pricing.Aug, ''),
  augustLate: firstDefinedValue(pricing.augustLate, pricing.Aug, ''),
  sept: firstDefinedValue(pricing.sept, pricing.Sept, ''),
  oct: firstDefinedValue(pricing.oct, pricing.Oct, ''),
});

const normalizeMonthlyPricing = (pricing = {}) => ({
  May: firstDefinedValue(pricing.May, ''),
  June: firstDefinedValue(pricing.June, ''),
  July: firstDefinedValue(pricing.July, ''),
  Aug: firstDefinedValue(pricing.Aug, ''),
  Sept: firstDefinedValue(pricing.Sept, ''),
  Oct: firstDefinedValue(pricing.Oct, ''),
});

const chunkImages = (images, size) => {
  const chunks = [];
  for (let index = 0; index < images.length; index += size) {
    chunks.push(images.slice(index, index + size));
  }
  return chunks;
};

const getBrochureAmenities = (data) => (
  ((data.amenities && data.amenities.length ? data.amenities : DEFAULT_AMENITIES))
    .map((item) => (item === 'Bedroom Cabin' ? `Bedroom Cabin (${Math.max(1, Number(data.bedroomCount) || 1)})` : item))
);

const createEmptyFormData = () => ({
  boatName: '',
  length: '',
  beam: '',
  capacity: '',
  fuelConsumption: '',
  includedNote: '(Crew and VAT 21% included. FUEL not included)',
  bedroomCount: 1,
  includedItems: [...DEFAULT_INCLUDED_ITEMS],
  notIncludedItems: [...DEFAULT_NOT_INCLUDED_ITEMS],
  amenities: [...DEFAULT_AMENITIES],
  images: [],
  pricing: normalizePricing(),
  monthlyPricing: normalizeMonthlyPricing(),
});

const createStoredImageId = (seed, index) => seed || `saved-image-${index}`;

const normalizeSavedImages = (images = []) => (
  Array.isArray(images)
    ? images
      .map((image, index) => {
        if (!image) return null;
        if (typeof image === 'string') {
          return {
            id: createStoredImageId(image, index),
            src: image,
            name: `Image ${index + 1}`,
            storagePath: null,
          };
        }

        const src = image.src || image.url || image.downloadURL || '';
        if (!src) return null;

        return {
          id: createStoredImageId(image.id || image.storagePath || src, index),
          src,
          name: image.name || `Image ${index + 1}`,
          storagePath: image.storagePath || null,
        };
      })
      .filter(Boolean)
    : []
);

const parseDateValue = (value) => {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') {
    return value.toDate().getTime();
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortTemplates = (templates = []) => (
  [...templates].sort((a, b) => parseDateValue(b.updatedAt || b.createdAt) - parseDateValue(a.updatedAt || a.createdAt))
);

const formatTemplateDate = (value) => {
  const time = parseDateValue(value);
  return time ? new Date(time).toLocaleDateString() : 'Unknown date';
};

const sanitizeFileName = (value = 'image') => String(value).replace(/[^a-zA-Z0-9._-]+/g, '-');

const deleteStoredImages = async (images = []) => {
  const removablePaths = images
    .map((image) => image?.storagePath)
    .filter(Boolean);

  await Promise.all(removablePaths.map(async (storagePath) => {
    try {
      await deleteObject(ref(storage, storagePath));
    } catch (error) {
      console.warn('Unable to delete brochure image from storage:', storagePath, error);
    }
  }));
};

const uploadBrochureImages = async (brochureId, images, previousImages = []) => {
  const uploadedImages = await Promise.all(images.map(async (image, index) => {
    if (image.storagePath && /^https?:/i.test(image.src || '')) {
      return {
        id: image.id || image.storagePath,
        src: image.src,
        name: image.name || `Image ${index + 1}`,
        storagePath: image.storagePath,
      };
    }

    const imageBlob = await fetch(image.src).then((response) => response.blob());
    const fileName = sanitizeFileName(image.name || `image-${index + 1}.jpg`);
    const storagePath = `boatBrochureTemplates/${brochureId}/${Date.now()}-${index}-${fileName}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, imageBlob, imageBlob.type ? { contentType: imageBlob.type } : undefined);
    const downloadURL = await getDownloadURL(storageRef);

    return {
      id: storagePath,
      src: downloadURL,
      name: image.name || `Image ${index + 1}`,
      storagePath,
    };
  }));

  const nextPaths = new Set(uploadedImages.map((image) => image.storagePath).filter(Boolean));
  const removedImages = previousImages.filter((image) => image?.storagePath && !nextPaths.has(image.storagePath));
  await deleteStoredImages(removedImages);

  return uploadedImages;
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const ImageUploader = ({ images, onImagesChange, maxImages = MAX_BROCHURE_IMAGES }) => {
  const fileInputRef = useRef(null);
  const [draggedImageId, setDraggedImageId] = useState(null);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    const remaining = maxImages - images.length;
    const toProcess = files.slice(0, remaining);

    const readAsDataUrl = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        resolve({
          id: Date.now() + Math.random(),
          src: event.target.result,
          name: file.name,
        });
      };
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsDataURL(file);
    });

    try {
      const newImages = await Promise.all(toProcess.map(readAsDataUrl));
      onImagesChange([...images, ...newImages]);
    } catch (err) {
      console.error('Image upload error:', err);
      alert('Some images could not be loaded. Please try again.');
    }

    e.target.value = '';
  };

  const removeImage = (id) => {
    onImagesChange(images.filter((img) => img.id !== id));
  };

  const setMainImage = (id) => {
    const img = images.find((i) => i.id === id);
    const rest = images.filter((i) => i.id !== id);
    onImagesChange([img, ...rest]);
  };

  const moveImage = (sourceId, targetId) => {
    if (sourceId === targetId) return;
    const sourceIndex = images.findIndex((img) => img.id === sourceId);
    const targetIndex = images.findIndex((img) => img.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const nextImages = [...images];
    const [movedImage] = nextImages.splice(sourceIndex, 1);
    nextImages.splice(targetIndex, 0, movedImage);
    onImagesChange(nextImages);
  };

  const handleDragStart = (event, imageId) => {
    setDraggedImageId(imageId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', imageId);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (event, targetId) => {
    event.preventDefault();
    const sourceId = draggedImageId || event.dataTransfer.getData('text/plain');
    if (!sourceId) return;
    moveImage(sourceId, targetId);
    setDraggedImageId(null);
  };

  const handleDragEnd = () => {
    setDraggedImageId(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-700">
          Boat Images ({images.length}/{maxImages})
        </label>
        {images.length < maxImages && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700"
          >
            <Upload size={14} />
            Add Image
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {images.length === 0 ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center transition-all hover:border-cyan-400 hover:bg-cyan-50/50"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-100 to-teal-100">
            <ImageIcon size={28} className="text-cyan-600" />
          </div>
          <p className="text-slate-600 font-medium">Click to upload boat images</p>
          <p className="text-slate-400 text-sm mt-1">PNG, JPG up to 10MB • First image is the hero</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {images.map((img, idx) => (
            <div
              key={img.id}
              draggable
              onDragStart={(event) => handleDragStart(event, img.id)}
              onDragOver={handleDragOver}
              onDrop={(event) => handleDrop(event, img.id)}
              onDragEnd={handleDragEnd}
              className={`relative overflow-hidden rounded-lg border bg-white transition ${
                draggedImageId === img.id ? 'border-cyan-400 opacity-60' : 'border-slate-200'
              }`}
            >
              <img src={img.src} alt={img.name} className="h-24 w-full object-cover" />
              <div className="space-y-1 px-2 py-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <GripVertical size={14} className="text-slate-400" />
                    <button
                      type="button"
                      onClick={() => setMainImage(img.id)}
                      className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-800"
                    >
                      {idx === 0 ? 'HERO' : 'Set Main'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    className="text-slate-500 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">Drag to reorder</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PricingTable = ({ pricing, onPricingChange, monthlyPricing, onMonthlyPricingChange }) => {
  const normalizedPricing = normalizePricing(pricing);
  const normalizedMonthlyPricing = normalizeMonthlyPricing(monthlyPricing);

  const updatePrice = (month, value) => {
    onPricingChange({ ...normalizedPricing, [month]: value });
  };

  const updateMonthlyPrice = (month, value) => {
    onMonthlyPricingChange({ ...normalizedMonthlyPricing, [month]: value });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-700">Seasonal Pricing (€)</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
          {PRICING_PERIODS.map((period) => (
            <div key={period.key} className="space-y-1">
              <label className="text-xs font-medium text-slate-500 block text-center min-h-[32px]">
                {period.inputLabel}
              </label>
              <input
                type="number"
                value={normalizedPricing[period.key] || ''}
                onChange={(e) => updatePrice(period.key, e.target.value)}
                placeholder="0"
                className="w-full px-2 py-2 text-center text-sm font-semibold border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
        <div>
          <label className="text-sm font-semibold text-slate-700">Original Monthly Template (€)</label>
          <p className="text-xs text-slate-500 mt-1">Kept underneath for reference if you need the old month-by-month pricing too.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
          {LEGACY_MONTHS.map((month) => (
            <div key={month} className="space-y-1">
              <label className="text-xs font-medium text-slate-500 block text-center">{month}</label>
              <input
                type="number"
                value={normalizedMonthlyPricing[month] || ''}
                onChange={(e) => updateMonthlyPrice(month, e.target.value)}
                placeholder="0"
                className="w-full px-2 py-2 text-center text-sm font-semibold border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all bg-white"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TemplateSelector = ({ selected, onSelect }) => (
  <div className="space-y-3">
    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
      <Palette size={16} className="text-cyan-600" />
      Template Style
    </label>
    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
      {Object.entries(TEMPLATE_STYLES).map(([key, style]) => (
        <button
          key={key}
          onClick={() => onSelect(key)}
          className={`relative p-3 rounded-xl border-2 transition-all ${
            selected === key
              ? 'border-cyan-500 ring-2 ring-cyan-200'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div
            className="h-8 rounded-lg mb-2"
            style={{ background: style.headerBg, border: '1px solid #e2e8f0' }}
          />
          <p className="text-xs font-medium text-slate-700 truncate">{style.name}</p>
          {selected === key && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
              <Check size={12} className="text-white" />
            </div>
          )}
        </button>
      ))}
    </div>
  </div>
);

const FooterTypeSelector = ({ type, onTypeChange, selectedItems, onItemsChange }) => {
  const items = type === 'restaurants' ? DEFAULT_RESTAURANTS : DEFAULT_PARTNERS;

  const toggleItem = (id) => {
    if (selectedItems.includes(id)) {
      onItemsChange(selectedItems.filter((i) => i !== id));
    } else {
      onItemsChange([...selectedItems, id]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="text-sm font-semibold text-slate-700">Footer Section</label>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => onTypeChange('restaurants')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              type === 'restaurants'
                ? 'bg-cyan-500 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Utensils size={14} className="inline mr-2" />
            Restaurants
          </button>
          <button
            onClick={() => onTypeChange('partners')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              type === 'partners'
                ? 'bg-cyan-500 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Building2 size={14} className="inline mr-2" />
            Partners
          </button>
          <button
            onClick={() => onTypeChange('none')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              type === 'none'
                ? 'bg-cyan-500 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            None
          </button>
        </div>
      </div>

      {type !== 'none' && (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                selectedItems.includes(item.id)
                  ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {selectedItems.includes(item.id) && <Check size={12} className="inline mr-1" />}
              {item.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ChecklistSelector = ({ title, options, selectedValues, onToggle }) => (
  <div className="space-y-2">
    <p className="text-sm font-semibold text-slate-700">{title}</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {options.map((option) => (
        <label
          key={option}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-cyan-300"
        >
          <input
            type="checkbox"
            checked={selectedValues.includes(option)}
            onChange={() => onToggle(option)}
            className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
          />
          <span className="text-sm text-slate-700">{option}</span>
        </label>
      ))}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// BROCHURE PAGES (Rendered to PDF)
// ═══════════════════════════════════════════════════════════════════════════════

const BrochurePageOne = React.forwardRef(function BrochurePageOne({ data, selectedTemplate }, ref) {
  // First image is hero, next 3 are thumbnails
  const heroImage = data.images && data.images.length > 0 ? data.images[0].src : null;
  const thumbnailImages = data.images ? data.images.slice(1, 4) : [];
  const firstBottomImage = data.images && data.images.length > 4 ? data.images[4].src : null;
  const secondBottomImage = data.images && data.images.length > 5
    ? data.images[5].src
    : (data.images && data.images.length > 3 ? data.images[3].src : null);
  const hasTwoBottomImages = Boolean(firstBottomImage && secondBottomImage);
  const templateStyle = TEMPLATE_STYLES[selectedTemplate] || TEMPLATE_STYLES.luxury;
  const primaryText = selectedTemplate === 'elegant' ? '#f8fafc' : templateStyle.textColor;

  return (
    <div
      ref={ref}
      className="brochure-preview"
      style={{
        width: '1080px',
        height: '1350px',
        fontFamily: "'Helvetica Neue', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        position: 'relative',
        overflow: 'hidden',
        background: templateStyle.footerBg,
      }}
    >
      {/* Hero Image Section - Top 55% */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '680px',
          zIndex: 1,
        }}
      >
        {heroImage ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: templateStyle.headerBg,
            }}
          >
            <img
              src={heroImage}
              alt="Boat"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center center',
              }}
              crossOrigin="anonymous"
            />
          </div>
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: templateStyle.headerBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ship size={120} color="rgba(255,255,255,0.2)" />
          </div>
        )}
      </div>

      {/* Boat Name - Top Left */}
      <div
        style={{
          position: 'absolute',
          top: '34px',
          left: '40px',
          zIndex: 10,
          maxWidth: '760px',
        }}
      >
        <h1
          style={{
            fontSize: '36px',
            fontWeight: 500,
            color: primaryText,
            letterSpacing: '0.4px',
            lineHeight: 1.08,
            margin: 0,
            textShadow: '0 2px 14px rgba(0,0,0,0.28)',
          }}
        >
          {data.boatName || 'BOAT NAME'}
        </h1>
      </div>

      {/* Dark Navy Bottom Section */}
      <div
        style={{
          position: 'absolute',
          top: '640px',
          left: 0,
          right: 0,
          height: '710px',
          background: templateStyle.footerBg,
          zIndex: 2,
        }}
      />

      {/* 3 Thumbnail Images - Positioned at the transition */}
      <div
        style={{
          position: 'absolute',
          top: '500px',
          left: 0,
          right: 0,
          zIndex: 10,
          display: 'flex',
          gap: '24px',
          padding: '0 60px',
          justifyContent: 'center',
        }}
      >
        {thumbnailImages.length > 0 ? (
          thumbnailImages.map((img, idx) => (
            <div
              key={img.id || idx}
              style={{
                width: '300px',
                height: '200px',
                borderRadius: '16px',
                overflow: 'hidden',
                border: `4px solid ${hexToRgba(templateStyle.accentColor, 0.72)}`,
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                background: templateStyle.footerBg,
              }}
            >
              <img
                src={img.src}
                alt={`Boat view ${idx + 2}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
                crossOrigin="anonymous"
              />
            </div>
          ))
        ) : (
          // Placeholder boxes when no thumbnails
          [1, 2, 3].map((n) => (
            <div
              key={n}
              style={{
                width: '300px',
                height: '200px',
                borderRadius: '16px',
                border: `4px solid ${hexToRgba(templateStyle.accentColor, 0.58)}`,
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                background: templateStyle.footerBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ship size={40} color="rgba(255,255,255,0.3)" />
            </div>
          ))
        )}
      </div>

      {/* Specs Line */}
      <div
        style={{
          position: 'absolute',
          top: '715px',
          left: 0,
          right: 0,
          zIndex: 10,
          textAlign: 'center',
          padding: '0 60px',
        }}
      >
        <p
          style={{
            fontSize: '28px',
            fontWeight: 400,
            color: primaryText,
            margin: 0,
            letterSpacing: '0.15px',
          }}
        >
          {data.length || '0'} x {data.beam || '0'} mtrs. • Capacity: {data.capacity || '0'} pax • Consumption {data.fuelConsumption || '0'}L/H
        </p>
      </div>

      {/* Seasonal Pricing Row */}
      <div
        style={{
          position: 'absolute',
          top: '790px',
          left: 0,
          right: 0,
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          padding: '0 100px',
        }}
      >
        {PRICING_PERIODS.map((period) => (
          <div key={period.key} style={{ textAlign: 'center', maxWidth: '140px' }}>
            <div
              style={{
                fontSize: period.brochureSubLabel ? '21px' : '22px',
                fontWeight: 400,
                color: hexToRgba(primaryText, 0.82),
                marginBottom: period.brochureSubLabel ? '4px' : '8px',
                letterSpacing: '0.2px',
              }}
            >
              {period.brochureLabel}
            </div>
            {period.brochureSubLabel && (
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 400,
                  color: hexToRgba(primaryText, 0.7),
                  marginBottom: '8px',
                  letterSpacing: '0.2px',
                }}
              >
                {period.brochureSubLabel}
              </div>
            )}
            <div
              style={{
                fontSize: '32px',
                fontWeight: 500,
                color: primaryText,
                letterSpacing: '0.2px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {normalizePricing(data.pricing)[period.key] || '—'}€
            </div>
          </div>
        ))}
      </div>

      {/* Included Note */}
      <div
        style={{
          position: 'absolute',
          top: '905px',
          left: 0,
          right: 0,
          zIndex: 10,
          textAlign: 'center',
          padding: '0 60px',
        }}
      >
        <p
          style={{
            fontSize: '17px',
            color: hexToRgba(primaryText, 0.8),
            margin: 0,
            fontWeight: 300,
            fontStyle: 'italic',
            letterSpacing: '0.1px',
          }}
        >
          {data.includedNote || '(Crew and VAT 21% included. FUEL not included)'}
        </p>
      </div>

      {/* Bottom gallery block on page 1 */}
      {firstBottomImage && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '980px',
            bottom: 0,
            zIndex: 8,
            borderRadius: 0,
            overflow: 'hidden',
            border: 'none',
            boxShadow: 'none',
            background: '#000',
            display: 'flex',
          }}
        >
          <div style={{ position: 'relative', flex: hasTwoBottomImages ? 1 : 2, overflow: 'hidden' }}>
            <img
              src={firstBottomImage}
              alt="Boat detail left"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              crossOrigin="anonymous"
            />
          </div>
          {hasTwoBottomImages && (
            <div
              style={{
                width: '2px',
                background: hexToRgba(templateStyle.accentColor, 0.55),
                boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
              }}
            />
          )}
          {hasTwoBottomImages && (
            <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
              <img
                src={secondBottomImage}
                alt="Boat detail right"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
                crossOrigin="anonymous"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const PortBaseSignature = ({ textColor }) => (
  <>
    <h3
      style={{
        margin: 0,
        fontSize: '20px',
        lineHeight: 1,
        color: textColor,
        fontWeight: 600,
        letterSpacing: '0.2px',
      }}
    >
      <span style={{ color: '#e9f1fb' }}>Port</span>
      <span style={{ color: '#27c2f3' }}>Base</span>
    </h3>
    <p
      style={{
        margin: '5px 0 0',
        fontSize: '10px',
        color: textColor,
        opacity: 0.82,
        fontWeight: 400,
        letterSpacing: '0.1px',
      }}
    >
      The <span style={{ color: '#27c2f3', textDecoration: 'underline' }}>Trusted</span> Booking Network for Yacht Professionals
    </p>
  </>
);

const BrochurePageTwo = React.forwardRef(function BrochurePageTwo({ data, selectedTemplate }, ref) {
  const templateStyle = TEMPLATE_STYLES[selectedTemplate] || TEMPLATE_STYLES.luxury;
  const primaryText = selectedTemplate === 'elegant' ? '#f8fafc' : templateStyle.textColor;
  const showcaseImage = data.images && data.images.length > 6 ? data.images[6].src : null;
  const includedItems = (data.includedItems && data.includedItems.length ? data.includedItems : DEFAULT_INCLUDED_ITEMS).slice(0, 8);
  const notIncludedItems = (data.notIncludedItems && data.notIncludedItems.length ? data.notIncludedItems : DEFAULT_NOT_INCLUDED_ITEMS).slice(0, 8);
  const checklistRowStyle = {
    color: primaryText,
    fontSize: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minHeight: '34px',
    lineHeight: 1,
  };
  const checklistLabelStyle = {
    display: 'inline-block',
    lineHeight: '24px',
    margin: 0,
    padding: 0,
  };
  const checkMarkStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    fontSize: '22px',
    lineHeight: 1,
    flexShrink: 0,
  };
  const xMarkStyle = {
    ...checkMarkStyle,
    opacity: 0.9,
  };
  const maxChecklistItems = Math.max(includedItems.length, notIncludedItems.length);
  const showcaseTop = 100;
  const showcaseGap = 28;
  const showcaseHeight = maxChecklistItems <= 4
    ? 700
    : maxChecklistItems <= 6
      ? 670
      : maxChecklistItems <= 8
        ? 640
        : 620;
  const checklistTop = showcaseTop + showcaseHeight + showcaseGap;

  return (
    <div
      ref={ref}
      className="brochure-preview-page-two"
      style={{
        width: '1080px',
        height: '1350px',
        fontFamily: "'Helvetica Neue', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        position: 'relative',
        overflow: 'hidden',
        background: templateStyle.footerBg,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, ${hexToRgba(templateStyle.footerBg, 0.6)} 0%, ${hexToRgba(templateStyle.footerBg, 0.92)} 100%)`,
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: '42px',
          left: '56px',
          right: '56px',
          zIndex: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2 style={{ margin: 0, color: primaryText, fontSize: '26px', fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase' }}>
          {data.boatName || 'Boat Name'}
        </h2>
        <p style={{ margin: 0, color: hexToRgba(primaryText, 0.72), fontWeight: 400, letterSpacing: '3px', fontSize: '12px' }}>
          GALLERY VIEW
        </p>
      </div>

      <div
        style={{
          position: 'absolute',
          top: `${showcaseTop}px`,
          left: '56px',
          right: '56px',
          height: `${showcaseHeight}px`,
          borderRadius: '26px',
          overflow: 'hidden',
          zIndex: 2,
          border: `1px solid ${hexToRgba(templateStyle.accentColor, 0.58)}`,
          boxShadow: '0 26px 80px rgba(0, 0, 0, 0.45)',
          background: 'rgba(255,255,255,0.04)',
        }}
      >
        {showcaseImage ? (
          <img src={showcaseImage} alt="Boat detail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: templateStyle.headerBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ship size={140} color="rgba(255,255,255,0.24)" />
          </div>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          top: `${checklistTop}px`,
          left: '56px',
          right: '56px',
          bottom: '170px',
          zIndex: 4,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '14px',
        }}
      >
        <div style={{ border: `1px solid ${hexToRgba(templateStyle.accentColor, 0.45)}`, borderRadius: '14px', padding: '22px 24px', background: hexToRgba(templateStyle.footerBg, 0.52), display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <p style={{ margin: 0, marginBottom: '14px', color: primaryText, fontSize: '34px', fontWeight: 700, letterSpacing: '0.6px' }}>Included</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px', alignContent: 'start', flex: 1 }}>
            {includedItems.map((item) => (
              <div key={`in-${item}`} style={checklistRowStyle}>
                <span style={checkMarkStyle}>✓</span>
                <span style={checklistLabelStyle}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ border: `1px solid ${hexToRgba(templateStyle.accentColor, 0.45)}`, borderRadius: '14px', padding: '22px 24px', background: hexToRgba(templateStyle.footerBg, 0.52), display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <p style={{ margin: 0, marginBottom: '14px', color: primaryText, fontSize: '34px', fontWeight: 700, letterSpacing: '0.6px' }}>Not Included</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px', alignContent: 'start', flex: 1 }}>
            {notIncludedItems.map((item) => (
              <div key={`out-${item}`} style={checklistRowStyle}>
                <span style={xMarkStyle}>×</span>
                <span style={checklistLabelStyle}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
});

const BrochurePageThree = React.forwardRef(function BrochurePageThree({ images, amenities, pageIndex, totalPages, selectedTemplate }, ref) {
  const templateStyle = TEMPLATE_STYLES[selectedTemplate] || TEMPLATE_STYLES.luxury;
  const primaryText = selectedTemplate === 'elegant' ? '#f8fafc' : templateStyle.textColor;
  const hasAmenitiesCard = amenities.length > 0;
  const amenitiesColumns = 3;
  const amenitiesRows = Math.max(1, Math.ceil(amenities.length / amenitiesColumns));
  const amenitiesCardHeight = hasAmenitiesCard ? Math.min(420, 92 + amenitiesRows * 36) : 0;
  const stackGalleryImages = images.length <= 2;
  const columnCount = stackGalleryImages ? 1 : 2;
  const galleryRows = Math.max(1, Math.ceil(images.length / columnCount));
  const galleryTop = hasAmenitiesCard ? 68 + amenitiesCardHeight : 48;
  const galleryBottom = 176;
  const galleryGap = 14;
  const galleryAvailableHeight = 1350 - galleryTop - galleryBottom;
  const computedRowHeight = Math.floor((galleryAvailableHeight - galleryGap * (galleryRows - 1)) / galleryRows);
  const maxRowHeight = galleryRows === 1
    ? galleryAvailableHeight
    : galleryRows === 2
      ? Math.min(galleryAvailableHeight, 560)
      : columnCount === 1
        ? 520
        : 420;
  const minRowHeight = 190;
  const galleryRowHeight = Math.max(minRowHeight, Math.min(computedRowHeight, maxRowHeight));

  return (
    <div
      ref={ref}
      className="brochure-preview-page-three"
      style={{
        width: '1080px',
        height: '1350px',
        fontFamily: "'Helvetica Neue', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        position: 'relative',
        overflow: 'hidden',
        background: templateStyle.footerBg,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, ${hexToRgba(templateStyle.footerBg, 0.62)} 0%, ${hexToRgba(templateStyle.footerBg, 0.95)} 100%)`,
          zIndex: 1,
        }}
      />

      {hasAmenitiesCard && (
        <div
          style={{
            position: 'absolute',
            top: '48px',
            left: '56px',
            right: '56px',
            height: `${amenitiesCardHeight}px`,
            zIndex: 2,
            borderRadius: '24px',
            border: `1px solid ${hexToRgba(templateStyle.accentColor, 0.5)}`,
            background: hexToRgba(templateStyle.footerBg, 0.52),
            boxShadow: '0 18px 48px rgba(0,0,0,0.24)',
            padding: '24px 28px',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '18px' }}>
            <p style={{ margin: 0, color: primaryText, fontWeight: 600, letterSpacing: '0.8px', fontSize: '20px', textTransform: 'uppercase' }}>Amenities</p>
            <p style={{ margin: 0, color: hexToRgba(primaryText, 0.72), fontSize: '11px', letterSpacing: '1px' }}>
              {amenities.length} item{amenities.length === 1 ? '' : 's'}
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px 20px', alignContent: 'start' }}>
            {amenities.map((item) => (
              <div
                key={`amenity-card-${pageIndex}-${item}`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  color: primaryText,
                  fontSize: '22px',
                  lineHeight: 1.15,
                }}
              >
                <span style={{ display: 'inline-flex', width: '18px', justifyContent: 'center', flexShrink: 0 }}>✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          top: `${galleryTop}px`,
          left: '56px',
          right: '56px',
          bottom: `${galleryBottom}px`,
          zIndex: 2,
          display: 'grid',
          gridTemplateColumns: columnCount === 1 ? '1fr' : '1fr 1fr',
          gridAutoRows: `${galleryRowHeight}px`,
          gap: `${galleryGap}px`,
          alignContent: 'start',
        }}
      >
        {images.map((img, idx) => (
          <div
            key={img.id || `extra-${pageIndex}-${idx}`}
            style={{
              borderRadius: '18px',
              overflow: 'hidden',
              border: `1px solid ${hexToRgba(templateStyle.accentColor, 0.58)}`,
              background: hexToRgba(templateStyle.footerBg, 0.55),
              boxShadow: '0 12px 34px rgba(0,0,0,0.28)',
            }}
          >
            <img src={img.src} alt={`Gallery image ${idx + 8}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
          </div>
        ))}
      </div>

      {pageIndex === totalPages - 1 && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '138px',
            zIndex: 5,
            background: templateStyle.footerBg,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 40px 18px',
            textAlign: 'center',
          }}
        >
          <PortBaseSignature textColor={primaryText} />
        </div>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// SAVED TEMPLATES PANEL
// ═══════════════════════════════════════════════════════════════════════════════

const SavedTemplatesPanel = ({ templates, onLoad, onDelete, isLoading, activeTemplateId }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="animate-spin text-cyan-500" size={24} />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <FileText size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">No saved brochures yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {templates.map((tmpl) => (
        <div
          key={tmpl.id}
          className={`group p-4 bg-white border rounded-xl transition-all ${
            tmpl.id === activeTemplateId
              ? 'border-cyan-400 shadow-md ring-2 ring-cyan-100'
              : 'border-slate-200 hover:border-cyan-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-slate-800">{tmpl.boatName || 'Unnamed'}</h4>
                {tmpl.id === activeTemplateId && (
                  <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700">
                    Editing
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {formatTemplateDate(tmpl.updatedAt || tmpl.createdAt)}
              </p>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onLoad(tmpl)}
                className="p-1.5 text-cyan-600 hover:bg-cyan-50 rounded-lg"
                title="Load"
              >
                <Copy size={14} />
              </button>
              <button
                onClick={() => onDelete(tmpl.id)}
                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <div className="flex gap-2 text-xs text-slate-600">
            <span className="px-2 py-0.5 bg-slate-100 rounded-full">{tmpl.capacity || '?'} pax</span>
            <span className="px-2 py-0.5 bg-slate-100 rounded-full">{tmpl.template || 'luxury'}</span>
            <span className="px-2 py-0.5 bg-slate-100 rounded-full">{tmpl.images?.length || 0} imgs</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const BoatBrochureBuilder = () => {
  const pageOneRef = useRef(null);
  const pageTwoRef = useRef(null);
  const pageThreeRefs = useRef([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    details: true,
    images: true,
    pricing: true,
    onboard: true,
    style: true,
    footer: false,
    saved: false,
  });

  // Form state
  const [formData, setFormData] = useState({
    ...createEmptyFormData(),
  });

  const [selectedTemplate, setSelectedTemplate] = useState('luxury');
  const [footerType, setFooterType] = useState('restaurants');
  const [footerItems, setFooterItems] = useState(['cancarlito', 'esmoli', 'chezgerdi', 'tiburon', 'juanyandrea']);
  const hasSecondPage = formData.images && formData.images.length > 6;
  const brochureAmenities = getBrochureAmenities(formData);
  const extraGalleryPages = (() => {
    const remainingImages = formData.images.slice(7);
    if (!remainingImages.length && !brochureAmenities.length) return [];
    if (!brochureAmenities.length) {
      return chunkImages(remainingImages, EXTRA_GALLERY_PAGE_SIZE).map((images) => ({ images, amenities: [] }));
    }

    const firstPageImages = remainingImages.slice(0, 1);
    const otherPages = chunkImages(remainingImages.slice(1), EXTRA_GALLERY_PAGE_SIZE).map((images) => ({ images, amenities: [] }));
    return [{ images: firstPageImages, amenities: brochureAmenities }, ...otherPages];
  })();
  const totalPages = 1 + (hasSecondPage ? 1 : 0) + extraGalleryPages.length;

  // Load saved templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const snap = await getDocs(collection(db, BROCHURE_COLLECTION));
        const templates = sortTemplates(
          snap.docs.map((entry) => ({
            id: entry.id,
            ...entry.data(),
            images: normalizeSavedImages(entry.data().images),
          }))
        );
        setSavedTemplates(templates);
      } catch (err) {
        console.error('Error loading templates:', err);
      } finally {
        setIsLoadingTemplates(false);
      }
    };
    loadTemplates();
  }, []);

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const updateFormData = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetEditor = () => {
    setFormData(createEmptyFormData());
    setSelectedTemplate('luxury');
    setFooterType('restaurants');
    setFooterItems(['cancarlito', 'esmoli', 'chezgerdi', 'tiburon', 'juanyandrea']);
    setActiveTemplateId(null);
  };

  const toggleChecklistItem = (field, value) => {
    setFormData((prev) => {
      const current = Array.isArray(prev[field]) ? prev[field] : [];
      const nextValues = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      return { ...prev, [field]: nextValues };
    });
  };

  const handleSaveTemplate = async () => {
    if (!formData.boatName) {
      alert('Please enter a boat name to save the template');
      return;
    }

    setIsSaving(true);
    try {
      const templateRef = activeTemplateId
        ? doc(db, BROCHURE_COLLECTION, activeTemplateId)
        : doc(collection(db, BROCHURE_COLLECTION));
      const brochureId = templateRef.id;
      const previousTemplate = savedTemplates.find((template) => template.id === brochureId);
      const uploadedImages = await uploadBrochureImages(brochureId, formData.images, previousTemplate?.images || []);
      const nowIso = new Date().toISOString();
      const templateData = {
        ...formData,
        images: uploadedImages,
        template: selectedTemplate,
        footerType,
        footerItems,
        createdAt: previousTemplate?.createdAt || nowIso,
        updatedAt: nowIso,
      };

      await setDoc(templateRef, templateData);

      const savedTemplate = {
        id: brochureId,
        ...templateData,
        images: normalizeSavedImages(templateData.images),
      };

      setSavedTemplates((prev) => sortTemplates([
        ...prev.filter((template) => template.id !== brochureId),
        savedTemplate,
      ]));
      setFormData((prev) => ({ ...prev, images: savedTemplate.images }));
      setActiveTemplateId(brochureId);
      alert(previousTemplate ? 'Brochure updated successfully!' : 'Brochure saved successfully!');
    } catch (err) {
      console.error('Error saving template:', err);
      alert(err.message || 'Failed to save brochure');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadTemplate = (template) => {
    setFormData({
      boatName: template.boatName || '',
      length: template.length || '',
      beam: template.beam || '',
      capacity: template.capacity || '',
      fuelConsumption: template.fuelConsumption || '',
      includedNote: template.includedNote || '(Crew and VAT 21% included. FUEL not included)',
      bedroomCount: Math.max(1, Number(template.bedroomCount) || 1),
      includedItems: template.includedItems || [...DEFAULT_INCLUDED_ITEMS],
      notIncludedItems: template.notIncludedItems || [...DEFAULT_NOT_INCLUDED_ITEMS],
      amenities: template.amenities || [...DEFAULT_AMENITIES],
      images: normalizeSavedImages(template.images),
      pricing: normalizePricing(template.pricing),
      monthlyPricing: normalizeMonthlyPricing(template.monthlyPricing || template.pricing),
    });
    setSelectedTemplate(template.template || 'luxury');
    setFooterType(template.footerType || 'restaurants');
    setFooterItems(template.footerItems || []);
    setActiveTemplateId(template.id);
    alert('Brochure loaded. You can edit and update it here.');
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('Delete this saved template?')) return;
    try {
      const templateToDelete = savedTemplates.find((template) => template.id === id);
      await deleteStoredImages(templateToDelete?.images || []);
      await deleteDoc(doc(db, BROCHURE_COLLECTION, id));
      setSavedTemplates((prev) => prev.filter((t) => t.id !== id));
      if (activeTemplateId === id) {
        resetEditor();
      }
    } catch (err) {
      console.error('Error deleting template:', err);
    }
  };

  const generatePDF = async () => {
    if (!pageOneRef.current) return;

    setIsGenerating(true);
    try {
      // Wait for images to fully load
      await new Promise((resolve) => setTimeout(resolve, 500));

      const renderToImageData = async (node) => {
        const canvas = await html2canvas(node, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
        });
        return canvas.toDataURL('image/jpeg', 0.95);
      };

      // Custom dimensions for mobile-friendly format (1080x1350 = 4:5 ratio)
      // Converting to mm: 1080px = ~285mm at 96dpi, 1350px = ~357mm
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [285, 357], // Custom size matching 4:5 aspect ratio
      });

      const pageOneImage = await renderToImageData(pageOneRef.current);
      pdf.addImage(pageOneImage, 'JPEG', 0, 0, 285, 357);

      if (hasSecondPage && pageTwoRef.current) {
        const pageTwoImage = await renderToImageData(pageTwoRef.current);
        pdf.addPage([285, 357], 'portrait');
        pdf.addImage(pageTwoImage, 'JPEG', 0, 0, 285, 357);
      }

      for (const pageThreeRef of pageThreeRefs.current.slice(0, extraGalleryPages.length)) {
        if (!pageThreeRef) continue;
        const pageThreeImage = await renderToImageData(pageThreeRef);
        pdf.addPage([285, 357], 'portrait');
        pdf.addImage(pageThreeImage, 'JPEG', 0, 0, 285, 357);
      }

      pdf.save(`${formData.boatName || 'boat'}-brochure.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate as PNG image (better for WhatsApp/social sharing)
  const generateImage = async () => {
    if (!pageOneRef.current) return;

    setIsGenerating(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      const canvas = await html2canvas(pageOneRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const link = document.createElement('a');
      link.download = `${formData.boatName || 'boat'}-brochure.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Error generating image:', err);
      alert('Failed to generate image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const SectionHeader = ({ title, icon: Icon, section, badge }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between py-3 px-1 text-left group"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/10 to-teal-500/10 flex items-center justify-center">
          <Icon size={18} className="text-cyan-600" />
        </div>
        <span className="font-semibold text-slate-800">{title}</span>
        {badge && (
          <span className="px-2 py-0.5 text-xs font-medium bg-cyan-100 text-cyan-700 rounded-full">
            {badge}
          </span>
        )}
      </div>
      <ChevronDown
        size={18}
        className={`text-slate-400 transition-transform ${expandedSections[section] ? 'rotate-180' : ''}`}
      />
    </button>
  );

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <FileText size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Boat Brochure Builder</h1>
            <p className="text-slate-500 mt-1">Create stunning PDF brochures for your fleet</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left: Form */}
        <div className="space-y-4">
          {/* Boat Details */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 border-b border-slate-100">
              <SectionHeader title="Boat Details" icon={Ship} section="details" />
            </div>
            {expandedSections.details && (
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Boat Name</label>
                  <input
                    type="text"
                    value={formData.boatName}
                    onChange={(e) => updateFormData('boatName', e.target.value)}
                    placeholder="e.g., KEYLARGO 27"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-lg font-semibold focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Length (m)</label>
                    <input
                      type="text"
                      value={formData.length}
                      onChange={(e) => updateFormData('length', e.target.value)}
                      placeholder="8.50"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Beam (m)</label>
                    <input
                      type="text"
                      value={formData.beam}
                      onChange={(e) => updateFormData('beam', e.target.value)}
                      placeholder="2.65"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Capacity (pax)</label>
                    <input
                      type="number"
                      value={formData.capacity}
                      onChange={(e) => updateFormData('capacity', e.target.value)}
                      placeholder="7"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Fuel (L/H)</label>
                    <input
                      type="text"
                      value={formData.fuelConsumption}
                      onChange={(e) => updateFormData('fuelConsumption', e.target.value)}
                      placeholder="65"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Included Note</label>
                  <input
                    type="text"
                    value={formData.includedNote}
                    onChange={(e) => updateFormData('includedNote', e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Images */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 border-b border-slate-100">
              <SectionHeader
                title="Images"
                icon={ImageIcon}
                section="images"
                badge={formData.images.length > 0 ? `${formData.images.length}` : null}
              />
            </div>
            {expandedSections.images && (
              <div className="p-5">
                <ImageUploader
                  images={formData.images}
                  onImagesChange={(imgs) => updateFormData('images', imgs)}
                />
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 border-b border-slate-100">
              <SectionHeader title="Seasonal Pricing" icon={Calendar} section="pricing" />
            </div>
            {expandedSections.pricing && (
              <div className="p-5">
                <PricingTable
                  pricing={formData.pricing}
                  onPricingChange={(p) => updateFormData('pricing', p)}
                  monthlyPricing={formData.monthlyPricing}
                  onMonthlyPricingChange={(p) => updateFormData('monthlyPricing', p)}
                />
              </div>
            )}
          </div>

          {/* Included / Not Included / Amenities */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 border-b border-slate-100">
              <SectionHeader title="Included & Amenities" icon={Check} section="onboard" />
            </div>
            {expandedSections.onboard && (
              <div className="p-5 space-y-5">
                <ChecklistSelector
                  title="Included"
                  options={DEFAULT_INCLUDED_ITEMS}
                  selectedValues={formData.includedItems || []}
                  onToggle={(value) => toggleChecklistItem('includedItems', value)}
                />
                <ChecklistSelector
                  title="Not Included"
                  options={DEFAULT_NOT_INCLUDED_ITEMS}
                  selectedValues={formData.notIncludedItems || []}
                  onToggle={(value) => toggleChecklistItem('notIncludedItems', value)}
                />
                <ChecklistSelector
                  title="Amenities"
                  options={DEFAULT_AMENITIES}
                  selectedValues={formData.amenities || []}
                  onToggle={(value) => toggleChecklistItem('amenities', value)}
                />
                {(formData.amenities || []).includes('Bedroom Cabin') && (
                  <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3 items-center">
                    <label className="text-sm font-semibold text-slate-700">Bedrooms</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={formData.bedroomCount || 1}
                      onChange={(e) => updateFormData('bedroomCount', Math.max(1, Number(e.target.value) || 1))}
                      className="w-full sm:w-40 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Style */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 border-b border-slate-100">
              <SectionHeader title="Design Style" icon={Palette} section="style" />
            </div>
            {expandedSections.style && (
              <div className="p-5">
                <TemplateSelector selected={selectedTemplate} onSelect={setSelectedTemplate} />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 border-b border-slate-100">
              <SectionHeader title="Footer Section" icon={Building2} section="footer" />
            </div>
            {expandedSections.footer && (
              <div className="p-5">
                <FooterTypeSelector
                  type={footerType}
                  onTypeChange={setFooterType}
                  selectedItems={footerItems}
                  onItemsChange={setFooterItems}
                />
              </div>
            )}
          </div>

          {/* Saved Templates */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 border-b border-slate-100">
              <SectionHeader
                title="Saved Brochures"
                icon={Save}
                section="saved"
                badge={savedTemplates.length > 0 ? `${savedTemplates.length}` : null}
              />
            </div>
            {expandedSections.saved && (
              <div className="p-5">
                <SavedTemplatesPanel
                  templates={savedTemplates}
                  onLoad={handleLoadTemplate}
                  onDelete={handleDeleteTemplate}
                  isLoading={isLoadingTemplates}
                  activeTemplateId={activeTemplateId}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right: Preview & Actions */}
        <div className="space-y-6">
          {/* Action Buttons */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={resetEditor}
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                <RefreshCw size={18} />
                New Brochure
              </button>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                <Eye size={18} />
                {showPreview ? 'Hide Preview' : 'Preview'}
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={isSaving}
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
              >
                {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                {activeTemplateId ? 'Update Brochure' : 'Save Brochure'}
              </button>
            </div>
            {activeTemplateId && (
              <p className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
                Editing saved brochure: <span className="font-semibold">{formData.boatName || 'Untitled brochure'}</span>
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={generateImage}
                disabled={isGenerating}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white font-semibold rounded-xl hover:from-violet-600 hover:to-purple-600 shadow-lg shadow-violet-500/25 transition-all disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <ImageIcon size={18} />
                    Download PNG
                  </>
                )}
              </button>
              <button
                onClick={generatePDF}
                disabled={isGenerating}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold rounded-xl hover:from-cyan-600 hover:to-teal-600 shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    Download PDF
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500 text-center">
              💡 PNG is best for WhatsApp & social media sharing
            </p>
          </div>

          {/* Preview Container */}
          {showPreview && (
            <div className="bg-slate-100 rounded-2xl p-6 overflow-auto">
              <div className="space-y-6">
                <div
                  className="mx-auto shadow-2xl rounded-xl overflow-hidden"
                  style={{
                    width: '360px',
                    height: '450px',
                  }}
                >
                  <div style={{ transform: 'scale(0.333)', transformOrigin: 'top left', width: '1080px', height: '1350px' }}>
                    <BrochurePageOne data={formData} selectedTemplate={selectedTemplate} />
                  </div>
                </div>
                {hasSecondPage && (
                  <div
                    className="mx-auto shadow-2xl rounded-xl overflow-hidden"
                    style={{
                      width: '360px',
                      height: '450px',
                    }}
                  >
                    <div style={{ transform: 'scale(0.333)', transformOrigin: 'top left', width: '1080px', height: '1350px' }}>
                      <BrochurePageTwo data={formData} selectedTemplate={selectedTemplate} />
                    </div>
                  </div>
                )}
                {extraGalleryPages.map((page, index) => (
                  <div
                    key={`preview-extra-gallery-${index}`}
                    className="mx-auto shadow-2xl rounded-xl overflow-hidden"
                    style={{
                      width: '360px',
                      height: '450px',
                    }}
                  >
                    <div style={{ transform: 'scale(0.333)', transformOrigin: 'top left', width: '1080px', height: '1350px' }}>
                      <BrochurePageThree
                        images={page.images}
                        amenities={page.amenities}
                        pageIndex={index}
                        totalPages={extraGalleryPages.length}
                        selectedTemplate={selectedTemplate}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-center text-xs text-slate-500 mt-3">
                Preview at 33% scale • {totalPages} page{totalPages === 1 ? '' : 's'} • Actual size: 1080×1350px each
              </p>
            </div>
          )}

          {/* Hidden render target for PDF/Image generation */}
          <div
            style={{
              position: 'absolute',
              left: '-9999px',
              top: 0,
              pointerEvents: 'none',
            }}
          >
            <BrochurePageOne ref={pageOneRef} data={formData} selectedTemplate={selectedTemplate} />
            {hasSecondPage && <BrochurePageTwo ref={pageTwoRef} data={formData} selectedTemplate={selectedTemplate} />}
            {extraGalleryPages.map((page, index) => (
              <BrochurePageThree
                key={`extra-gallery-${index}`}
                ref={(element) => {
                  pageThreeRefs.current[index] = element;
                }}
                images={page.images}
                amenities={page.amenities}
                pageIndex={index}
                totalPages={extraGalleryPages.length}
                selectedTemplate={selectedTemplate}
              />
            ))}
          </div>

          {/* Tips Card */}
          <div className="bg-gradient-to-br from-cyan-50 to-teal-50 rounded-2xl p-6 border border-cyan-100">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">Pro Tips</h3>
                <ul className="text-sm text-slate-600 space-y-1.5">
                  <li>📱 <strong>Mobile-optimized</strong> - 1080×1350px (4:5 ratio) perfect for Instagram & WhatsApp</li>
                  <li>🖼️ <strong>First image</strong> = Large hero photo at the top</li>
                  <li>📸 <strong>Images 2-4</strong> = Three thumbnails in the middle row</li>
                  <li>🛥️ <strong>Images 5-6</strong> = Two-image gallery strip on page 1</li>
                  <li>📘 <strong>Image 7</strong> = Page 2 hero image</li>
                  <li>🖼️ <strong>Images 8+</strong> = Page 3 extra gallery grid (auto)</li>
                  <li>💾 <strong>PNG format</strong> is best for sharing on social media</li>
                  <li>📄 <strong>PDF format</strong> is best for printing and email attachments</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoatBrochureBuilder;
