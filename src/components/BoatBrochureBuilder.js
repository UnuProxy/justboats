import React, { useState, useRef, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { db } from '../firebase/firebaseConfig';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import {
  Ship, Upload, Download, Trash2, Eye, Image as ImageIcon,
  Calendar, ChevronDown,
  Palette, FileText, Copy, Check, Sparkles, RefreshCw, Save,
  Building2, Utensils
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

const MONTHS = ['May', 'June', 'July', 'Aug', 'Sept', 'Oct'];
const DEFAULT_INCLUDED_ITEMS = ['Captain', 'Soft drinks', 'Ice', 'Snorkel gear', 'Towels'];
const DEFAULT_NOT_INCLUDED_ITEMS = ['Fuel', 'Seabob', 'Overnight stay', 'Transfer service'];
const DEFAULT_AMENITIES = ['Bedroom Cabin', 'Bathroom', 'Wi-Fi', 'Bluetooth Audio', 'Sunbed', 'Fridge', 'Deck Shower', 'Swim Ladder'];

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

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const ImageUploader = ({ images, onImagesChange, maxImages = 12 }) => {
  const fileInputRef = useRef(null);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-700">
          Boat Images ({images.length}/{maxImages})
        </label>
        {images.length < maxImages && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white text-sm font-medium rounded-lg hover:from-cyan-600 hover:to-teal-600 transition-all shadow-sm"
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
          className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center cursor-pointer hover:border-cyan-400 hover:bg-cyan-50/50 transition-all group"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-100 to-teal-100 flex items-center justify-center group-hover:scale-110 transition-transform">
            <ImageIcon size={28} className="text-cyan-600" />
          </div>
          <p className="text-slate-600 font-medium">Click to upload boat images</p>
          <p className="text-slate-400 text-sm mt-1">PNG, JPG up to 10MB • First image is the hero</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {images.map((img, idx) => (
            <div
              key={img.id}
              className={`relative group rounded-xl overflow-hidden aspect-[4/3] border-2 transition-all ${
                idx === 0 ? 'border-cyan-500 ring-2 ring-cyan-200' : 'border-slate-200'
              }`}
            >
              <img src={img.src} alt={img.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-0 left-0 right-0 p-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                {idx !== 0 && (
                  <button
                    onClick={() => setMainImage(img.id)}
                    className="px-2 py-1 bg-white/90 text-slate-700 text-xs font-medium rounded-md hover:bg-white"
                  >
                    Set Main
                  </button>
                )}
                {idx === 0 && (
                  <span className="px-2 py-1 bg-cyan-500 text-white text-xs font-bold rounded-md">
                    HERO
                  </span>
                )}
                <button
                  onClick={() => removeImage(img.id)}
                  className="p-1.5 bg-red-500 text-white rounded-md hover:bg-red-600"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PricingTable = ({ pricing, onPricingChange }) => {
  const updatePrice = (month, value) => {
    onPricingChange({ ...pricing, [month]: value });
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-semibold text-slate-700">Monthly Pricing (€)</label>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {MONTHS.map((month) => (
          <div key={month} className="space-y-1">
            <label className="text-xs font-medium text-slate-500 block text-center">{month}</label>
            <input
              type="number"
              value={pricing[month] || ''}
              onChange={(e) => updatePrice(month, e.target.value)}
              placeholder="0"
              className="w-full px-2 py-2 text-center text-sm font-semibold border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
            />
          </div>
        ))}
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
          top: '40px',
          left: '40px',
          zIndex: 10,
        }}
      >
        <h1
          style={{
            fontSize: '64px',
            fontWeight: 600,
            color: primaryText,
            letterSpacing: '0.4px',
            margin: 0,
            textTransform: 'uppercase',
            textShadow: '0 4px 20px rgba(0,0,0,0.5)',
            fontStyle: 'normal',
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

      {/* Monthly Pricing Row */}
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
        {MONTHS.map((month) => (
          <div key={month} style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: '24px',
                fontWeight: 400,
                color: hexToRgba(primaryText, 0.82),
                marginBottom: '8px',
                letterSpacing: '0.2px',
              }}
            >
              {month === 'Aug' ? 'Aug.' : month === 'Sept' ? 'Sept.' : month === 'Oct' ? 'Oct.' : month}
            </div>
            <div
              style={{
                fontSize: '34px',
                fontWeight: 500,
                color: primaryText,
                letterSpacing: '0.2px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {data.pricing[month] || '—'}€
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

const PortBaseSignature = ({ primaryText }) => {
  const normalizedPrimary = String(primaryText || '').toLowerCase();
  const useDarkPortWord = normalizedPrimary === '#0f172a' || normalizedPrimary === '#111827' || normalizedPrimary === '#1e293b';
  const portWordColor = useDarkPortWord ? '#0f2744' : '#e9f1fb';

  return (
    <>
      <h3
        style={{
          margin: 0,
          fontSize: '16px',
          lineHeight: 1,
          color: primaryText,
          fontWeight: 600,
          letterSpacing: '0px',
          textShadow: '0 3px 8px rgba(0,0,0,0.15)',
        }}
      >
        <span style={{ color: portWordColor }}>Port</span>
        <span style={{ color: '#27c2f3' }}>Base</span>
      </h3>
      <p
        style={{
          margin: '4px 0 0',
          fontSize: '10px',
          color: hexToRgba(primaryText, 0.88),
          letterSpacing: '0.1px',
          fontWeight: 400,
        }}
      >
        The{' '}
        <span
          style={{
            color: '#27c2f3',
            textDecorationLine: 'underline',
            textDecorationColor: '#27c2f3',
            textDecorationThickness: '1px',
            textUnderlineOffset: '2px',
            textDecorationSkipInk: 'none',
          }}
        >
          Trusted
        </span>{' '}
        Booking Network for Yacht Professionals
      </p>
    </>
  );
};

const BrochurePageTwo = React.forwardRef(function BrochurePageTwo({ data, selectedTemplate }, ref) {
  const showcaseImage = data.images && data.images.length > 6 ? data.images[6].src : null;
  const templateStyle = TEMPLATE_STYLES[selectedTemplate] || TEMPLATE_STYLES.luxury;
  const primaryText = selectedTemplate === 'elegant' ? '#f8fafc' : templateStyle.textColor;
  const bedroomCount = Math.max(1, Number(data.bedroomCount) || 1);
  const includedItems = (Array.isArray(data.includedItems) && data.includedItems.length ? data.includedItems : DEFAULT_INCLUDED_ITEMS)
    .filter((item) => item.toLowerCase() !== 'vat 21%')
    .slice(0, 6);
  const notIncludedItems = (Array.isArray(data.notIncludedItems) && data.notIncludedItems.length ? data.notIncludedItems : DEFAULT_NOT_INCLUDED_ITEMS)
    .filter((item) => item.toLowerCase() !== 'docking fees')
    .slice(0, 6);
  const amenities = (Array.isArray(data.amenities) && data.amenities.length ? data.amenities : DEFAULT_AMENITIES)
    .map((item) => (item === 'Bedroom Cabin' ? `Bedroom Cabin (${bedroomCount})` : item))
    .slice(0, 8);
  const boxBaseStyle = {
    width: '14px',
    height: '14px',
    borderRadius: '3px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };
  const checklistRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minHeight: '18px',
  };
  const checklistLabelStyle = {
    display: 'inline-block',
    lineHeight: '14px',
    transform: 'translateY(-6px)',
    margin: 0,
    padding: 0,
  };

  const CheckBoxIcon = () => (
    <span style={{ ...boxBaseStyle, background: hexToRgba(templateStyle.accentColor, 0.95) }}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path
          d="M1.8 5.4L3.9 7.4L8.2 2.9"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );

  const XBoxIcon = () => (
    <span style={{ ...boxBaseStyle, border: `1px solid ${hexToRgba(primaryText, 0.5)}` }}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path
          d="M2.3 2.3L7.7 7.7M7.7 2.3L2.3 7.7"
          fill="none"
          stroke={hexToRgba(primaryText, 0.82)}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );

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
        <h2
          style={{
            margin: 0,
            color: primaryText,
            fontWeight: 500,
            letterSpacing: '1px',
            fontSize: '26px',
            textTransform: 'uppercase',
          }}
        >
          {data.boatName || 'Boat Name'}
        </h2>
        <p
          style={{
            margin: 0,
            color: hexToRgba(primaryText, 0.72),
            fontWeight: 400,
            letterSpacing: '3px',
            fontSize: '12px',
          }}
        >
          GALLERY VIEW
        </p>
      </div>

      <div
        style={{
          position: 'absolute',
          top: '100px',
          left: '56px',
          right: '56px',
          height: '620px',
          borderRadius: '26px',
          overflow: 'hidden',
          zIndex: 2,
          border: `1px solid ${hexToRgba(templateStyle.accentColor, 0.58)}`,
          boxShadow: '0 26px 80px rgba(0, 0, 0, 0.45)',
          background: 'rgba(255,255,255,0.04)',
        }}
      >
        {showcaseImage ? (
          <img
            src={showcaseImage}
            alt="Boat detail"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            crossOrigin="anonymous"
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: templateStyle.headerBg,
            }}
          >
            <Ship size={140} color="rgba(255,255,255,0.24)" />
          </div>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          top: '748px',
          left: '56px',
          right: '56px',
          height: '322px',
          zIndex: 4,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: 'auto auto',
          gap: '14px',
        }}
      >
        <div
          style={{
            background: hexToRgba(templateStyle.footerBg, 0.52),
            border: `1px solid ${hexToRgba(templateStyle.accentColor, 0.45)}`,
            borderRadius: '14px',
            padding: '12px 14px',
          }}
        >
          <p style={{ margin: 0, marginBottom: '8px', color: primaryText, fontSize: '12px', letterSpacing: '1.2px', fontWeight: 600, textTransform: 'uppercase' }}>
            Included
          </p>
          <div style={{ display: 'grid', gap: '6px' }}>
            {includedItems.map((item) => (
              <div key={`in-${item}`} style={{ ...checklistRowStyle, color: hexToRgba(primaryText, 0.9), fontSize: '12px' }}>
                <CheckBoxIcon />
                <span style={checklistLabelStyle}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            background: hexToRgba(templateStyle.footerBg, 0.52),
            border: `1px solid ${hexToRgba(templateStyle.accentColor, 0.45)}`,
            borderRadius: '14px',
            padding: '12px 14px',
          }}
        >
          <p style={{ margin: 0, marginBottom: '8px', color: primaryText, fontSize: '12px', letterSpacing: '1.2px', fontWeight: 600, textTransform: 'uppercase' }}>
            Not Included
          </p>
          <div style={{ display: 'grid', gap: '6px' }}>
            {notIncludedItems.map((item) => (
              <div key={`out-${item}`} style={{ ...checklistRowStyle, color: hexToRgba(primaryText, 0.86), fontSize: '12px' }}>
                <XBoxIcon />
                <span style={checklistLabelStyle}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            gridColumn: '1 / -1',
            background: hexToRgba(templateStyle.footerBg, 0.52),
            border: `1px solid ${hexToRgba(templateStyle.accentColor, 0.45)}`,
            borderRadius: '14px',
            padding: '12px 14px',
          }}
        >
          <p style={{ margin: 0, marginBottom: '8px', color: primaryText, fontSize: '12px', letterSpacing: '1.2px', fontWeight: 600, textTransform: 'uppercase' }}>
            Amenities
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px 10px' }}>
            {amenities.map((item) => (
              <div key={`amenity-${item}`} style={{ ...checklistRowStyle, color: hexToRgba(primaryText, 0.9), fontSize: '12px' }}>
                <CheckBoxIcon />
                <span style={checklistLabelStyle}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '230px',
          zIndex: 5,
          background: templateStyle.footerBg,
          borderTop: `1px solid ${hexToRgba(templateStyle.accentColor, 0.58)}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 60px 10px',
          textAlign: 'center',
        }}
      >
        <PortBaseSignature primaryText={primaryText} />
      </div>
    </div>
  );
});

const BrochurePageThree = React.forwardRef(function BrochurePageThree({ data, selectedTemplate }, ref) {
  const templateStyle = TEMPLATE_STYLES[selectedTemplate] || TEMPLATE_STYLES.luxury;
  const primaryText = selectedTemplate === 'elegant' ? '#f8fafc' : templateStyle.textColor;
  const remainingImages = Array.isArray(data.images) ? data.images.slice(7) : [];
  const columnCount = remainingImages.length <= 1 ? 1 : 2;
  const galleryRows = Math.max(1, Math.ceil(remainingImages.length / columnCount));
  const galleryTop = 100;
  const galleryBottom = 176;
  const galleryGap = 14;
  const galleryAvailableHeight = 1350 - galleryTop - galleryBottom;
  const computedRowHeight = Math.floor((galleryAvailableHeight - galleryGap * (galleryRows - 1)) / galleryRows);
  const maxRowHeight = columnCount === 1 ? 520 : 340;
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

      <div
        style={{
          position: 'absolute',
          top: '48px',
          left: '56px',
          right: '56px',
          zIndex: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <h2
          style={{
            margin: 0,
            color: primaryText,
            fontWeight: 500,
            letterSpacing: '0.9px',
            fontSize: '24px',
            textTransform: 'uppercase',
          }}
        >
          Extra Gallery
        </h2>
        <p
          style={{
            margin: 0,
            color: hexToRgba(primaryText, 0.72),
            fontWeight: 400,
            letterSpacing: '1.2px',
            fontSize: '12px',
          }}
        >
          {remainingImages.length} image{remainingImages.length === 1 ? '' : 's'}
        </p>
      </div>

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
        {remainingImages.map((img, idx) => (
          <div
            key={img.id || `extra-${idx}`}
            style={{
              borderRadius: '18px',
              overflow: 'hidden',
              border: `1px solid ${hexToRgba(templateStyle.accentColor, 0.58)}`,
              background: hexToRgba(templateStyle.footerBg, 0.55),
              boxShadow: '0 12px 34px rgba(0,0,0,0.28)',
            }}
          >
            <img
              src={img.src}
              alt={`Gallery image ${idx + 8}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              crossOrigin="anonymous"
            />
          </div>
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '138px',
          zIndex: 5,
          background: templateStyle.footerBg,
          borderTop: `1px solid ${hexToRgba(templateStyle.accentColor, 0.58)}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 40px 10px',
          textAlign: 'center',
        }}
      >
        <PortBaseSignature primaryText={primaryText} />
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// SAVED TEMPLATES PANEL
// ═══════════════════════════════════════════════════════════════════════════════

const SavedTemplatesPanel = ({ templates, onLoad, onDelete, isLoading }) => {
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
          className="group p-4 bg-white border border-slate-200 rounded-xl hover:border-cyan-300 hover:shadow-md transition-all"
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="font-semibold text-slate-800">{tmpl.boatName || 'Unnamed'}</h4>
              <p className="text-xs text-slate-500">
                {tmpl.createdAt ? new Date(tmpl.createdAt).toLocaleDateString() : 'Unknown date'}
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
  const pageThreeRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState([]);
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
    pricing: {},
  });

  const [selectedTemplate, setSelectedTemplate] = useState('luxury');
  const [footerType, setFooterType] = useState('restaurants');
  const [footerItems, setFooterItems] = useState(['cancarlito', 'esmoli', 'chezgerdi', 'tiburon', 'juanyandrea']);
  const hasSecondPage = formData.images && formData.images.length > 6;
  const hasThirdPage = formData.images && formData.images.length > 7;
  const totalPages = 1 + (hasSecondPage ? 1 : 0) + (hasThirdPage ? 1 : 0);

  // Load saved templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const snap = await getDocs(collection(db, 'boatBrochureTemplates'));
        const templates = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
      const templateData = {
        ...formData,
        images: [], // Don't save images to Firestore (too large)
        template: selectedTemplate,
        footerType,
        footerItems,
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'boatBrochureTemplates'), templateData);
      setSavedTemplates((prev) => [...prev, { id: docRef.id, ...templateData }]);
      alert('Template saved successfully!');
    } catch (err) {
      console.error('Error saving template:', err);
      alert('Failed to save template');
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
      images: [],
      pricing: template.pricing || {},
    });
    setSelectedTemplate(template.template || 'luxury');
    setFooterType(template.footerType || 'restaurants');
    setFooterItems(template.footerItems || []);
    alert('Template loaded! Add images to complete.');
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('Delete this saved template?')) return;
    try {
      await deleteDoc(doc(db, 'boatBrochureTemplates', id));
      setSavedTemplates((prev) => prev.filter((t) => t.id !== id));
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

      if (hasThirdPage && pageThreeRef.current) {
        const pageThreeImage = await renderToImageData(pageThreeRef.current);
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
                Save
              </button>
            </div>
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
                {hasThirdPage && (
                  <div
                    className="mx-auto shadow-2xl rounded-xl overflow-hidden"
                    style={{
                      width: '360px',
                      height: '450px',
                    }}
                  >
                    <div style={{ transform: 'scale(0.333)', transformOrigin: 'top left', width: '1080px', height: '1350px' }}>
                      <BrochurePageThree data={formData} selectedTemplate={selectedTemplate} />
                    </div>
                  </div>
                )}
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
            {hasThirdPage && <BrochurePageThree ref={pageThreeRef} data={formData} selectedTemplate={selectedTemplate} />}
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
