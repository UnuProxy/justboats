import React, { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Just Enjoy Ibiza — Invoice Generator (Luxury + Mobile-first + One-page PDF)
 * - Fluid mobile UI (Edit / Preview tabs), zero horizontal overflow
 * - Hidden A4 layout is captured for PDF at full opacity (no faint PDFs)
 * - British English copy, EUR formatting, 21% VAT from VAT-inclusive prices
 */

const VAT_RATE = 0.21;
const gbEur = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" });
const fmt = (n) => gbEur.format(Math.round((Number(n) || 0) * 100) / 100);

export default function InvoiceGenerator() {
  // Dates
  const todayIso = new Date().toISOString().split("T")[0];
  const todayPretty = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // Responsive behaviour
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth <= 1024);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [tab, setTab] = useState("edit"); // "edit" | "preview"

  // Form state
  const [invoice, setInvoice] = useState({
    invoiceNumber: "",
    invoiceDate: todayIso,
    description: "",
    unitPrice: "",
    discount: "0",
    notes: "Courtesy drinks, towels and skipper included.",
    terms:
      "Payment terms: Net 30 days from invoice date. Please include the invoice number as the payment reference.",
  });

  const [client, setClient] = useState({
    name: "",
    companyName: "",
    address: "",
    city: "",
    postalCode: "",
    country: "",
    email: "",
    phone: "",
    taxId: "",
  });

  const [items, setItems] = useState([]);

  const onInvoice = (e) => setInvoice((s) => ({ ...s, [e.target.name]: e.target.value }));
  const onClient = (e) => setClient((s) => ({ ...s, [e.target.name]: e.target.value }));

  const addItem = () => {
    if (!invoice.description || !invoice.unitPrice) return;
    const price = parseFloat(invoice.unitPrice);
    const disc = Math.min(Math.max(parseFloat(invoice.discount) || 0, 0), 100);

    setItems((arr) => [
      ...arr,
      {
        id: Date.now(),
        description: invoice.description.trim(),
        unitPrice: Number.isNaN(price) ? 0 : price, // VAT-inclusive
        discount: disc,
      },
    ]);

    setInvoice((s) => ({ ...s, description: "", unitPrice: "", discount: "0" }));
    if (isNarrow) setTab("preview");
  };

  const onAddKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem();
    }
  };

  const removeItem = (id) => setItems((arr) => arr.filter((x) => x.id !== id));

  // Totals (from VAT-inclusive amounts)
  const totalGross = items.reduce(
    (sum, it) => sum + (it.unitPrice - (it.unitPrice * it.discount) / 100),
    0
  );
  const totalVat = Math.round(((totalGross * VAT_RATE) / (1 + VAT_RATE)) * 100) / 100;
  const totalNet = Math.round((totalGross / (1 + VAT_RATE)) * 100) / 100;

  // Hidden A4 DOM for PDF
  const pdfRef = useRef(null);

  const downloadPDF = async () => {
    const stage = pdfRef.current;
    if (!stage) return;

    const btn = document.getElementById("download-btn");
    const prevBtn = btn ? { text: btn.innerText, disabled: btn.disabled } : null;
    if (btn) {
      btn.innerText = "Processing…";
      btn.disabled = true;
    }

    // Move into viewport at full opacity so html2canvas captures crisply
    const prev = {
      position: stage.style.position,
      top: stage.style.top,
      left: stage.style.left,
      zIndex: stage.style.zIndex,
      opacity: stage.style.opacity,
      pointerEvents: stage.style.pointerEvents,
    };
    stage.style.position = "fixed";
    stage.style.top = "0px";
    stage.style.left = "0px";
    stage.style.zIndex = "-1"; // behind everything; still rendered
    stage.style.opacity = "1";
    stage.style.pointerEvents = "none";

    try {
      await new Promise((r) => requestAnimationFrame(r));
      if (document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("Font readiness wait failed:", err);
        }
      }

      const canvas = await html2canvas(stage, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        scrollX: 0,
        scrollY: 0,
      });

      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageW = 210;
      const pageH = 297;
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      const s = Math.min(pageW / imgW, pageH / imgH);
      const w = imgW * s;
      const h = imgH * s;
      const x = (pageW - w) / 2;
      const y = 0;

      pdf.addImage(img, "PNG", x, y, w, h, undefined, "FAST");
      const fileName = invoice.invoiceNumber
        ? `just-enjoy-ibiza-invoice-${invoice.invoiceNumber}.pdf`
        : `just-enjoy-ibiza-invoice-${todayPretty.split("/").join("-")}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("PDF generation error:", err);
      alert("There was an error generating the PDF. Please try again.");
    } finally {
      // Restore off-screen state
      stage.style.position = prev.position || "fixed";
      stage.style.top = prev.top || "-10000px";
      stage.style.left = prev.left || "0px";
      stage.style.zIndex = prev.zIndex || "-1";
      stage.style.opacity = prev.opacity || "0";
      stage.style.pointerEvents = prev.pointerEvents || "none";
      if (btn && prevBtn) {
        btn.innerText = prevBtn.text || "Download PDF";
        btn.disabled = prevBtn.disabled;
      }
    }
  };

  return (
    <div className="jei-app">
      {/* Local styles */}
      <style>{`
        /* Never allow horizontal scroll */
        html, body, #root { max-width: 100%; overflow-x: hidden; }
        *, *::before, *::after { box-sizing: border-box; }

        :root{
          --bg:#f6f7fb; --card:#fff; --ink:#0b0f19; --text:#2a3242; --muted:#6b7280;
          --border:#e7e7ea; --navy:#0f1f3d; --gold:#c8a25e; --shadow:0 12px 30px rgba(11,15,25,.08); --r:16px;
        }
        body{margin:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
        .jei-app{min-height:100vh}
        .container{max-width:1100px;margin:0 auto;padding:12px 16px 96px}
        .grid{display:grid;gap:12px}
        .g2{grid-template-columns:1fr 1fr}
        .g3{grid-template-columns:1fr 1fr 1fr}
        @media(max-width:900px){.g2,.g3{grid-template-columns:1fr}}

        .layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:16px}
        @media(max-width:1024px){.layout{grid-template-columns:1fr}}

        .panel{background:var(--card);border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--shadow);overflow:hidden}
        .ph{padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
        .pt{margin:0;color:var(--ink);font-weight:900}
        .pb{padding:14px}
        label{font-size:12px;font-weight:800;color:var(--muted);margin-bottom:6px;display:block}
        .input,.textarea{width:100%;padding:11px 12px;border:1px solid var(--border);border-radius:12px;background:#fff;color:var(--ink);font-size:14px}
        .textarea{min-height:86px;resize:vertical}

        .btn{appearance:none;border:1px solid var(--border);background:#fff;color:var(--ink);padding:10px 12px;border-radius:12px;font-size:14px;cursor:pointer;transition:box-shadow .2s ease,transform .06s ease}
        .btn:hover{box-shadow:var(--shadow)} .btn:active{transform:translateY(1px)}
        .btn-primary{background:var(--navy);border-color:transparent;color:#fff}

        /* Tabs (mobile) */
        .seg{display:none;gap:8px;margin:0 0 12px}
        .seg-btn{flex:1;border:1px solid var(--border);background:#fff;padding:10px;border-radius:999px;font-weight:800;color:var(--muted);cursor:pointer}
        .seg-btn.active{background:var(--navy);border-color:var(--navy);color:#fff}
        @media(max-width:1024px){.seg{display:flex}}

        /* Mobile preview */
        .m-invoice{background:#fff;border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--shadow);overflow:hidden}
        .m-hd{padding:18px 16px;border-bottom:2px solid var(--gold);display:flex;align-items:center;justify-content:space-between;gap:12px}
        .m-brand{display:flex;align-items:center;gap:10px}
        .m-dot{width:10px;height:10px;border-radius:50%;background:var(--gold)}
        .m-name{margin:0;font-size:18px;font-weight:900;color:var(--ink)}
        .m-title{margin:0;font-size:26px;font-weight:900;color:var(--ink)}
        .m-body{padding:16px}
        .m-sect{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8b90a0;font-weight:900;margin:0 0 8px}
        .m-items{display:grid;gap:10px}
        .m-item{border:1px solid #eef2f7;border-radius:12px;padding:10px 12px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
        .m-item h4{margin:0;font-size:14px;color:var(--ink)}
        .m-meta{font-size:12px;color:#667085}
        .m-amt{font-weight:900;white-space:nowrap}
        .m-remove{border:0;background:transparent;color:#ef4444;font-size:18px;cursor:pointer;margin-left:4px}
        .m-totals{display:grid;gap:6px;padding-top:8px}
        .m-row{display:flex;justify-content:space-between;font-size:14px}
        .m-strong{border-top:1px solid var(--border);padding-top:8px;font-size:18px;font-weight:900;color:var(--navy)}
        .m-ft{padding:16px;background:#fbfbfe;border-top:1px solid var(--border);display:grid;gap:12px}

        /* Sticky mobile action bar */
        .bar{position:sticky;bottom:0;z-index:50;background:rgba(255,255,255,.96);backdrop-filter:saturate(1.2) blur(6px);border-top:1px solid var(--border);display:none}
        .bar-in{max-width:1100px;margin:0 auto;padding:10px 16px calc(10px + env(safe-area-inset-bottom));display:flex;align-items:center;justify-content:space-between;gap:10px}
        .bar-ttl{font-weight:900;color:var(--ink)}
        @media(max-width:1024px){.bar{display:block}}

        /* Hidden A4 stage for PDF (off-screen by default) */
        .pdf-stage{position:fixed;left:0;top:-10000px;width:210mm;background:#fff;pointer-events:none;opacity:0;z-index:-1}
        .a4{width:210mm;min-height:297mm;color:#2a3242;display:flex;flex-direction:column}
        .a4-hd{padding:18mm 16mm 12mm;border-bottom:2px solid var(--gold)}
        .a4-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
        .a4-org{display:flex;align-items:center;gap:10px}
        .a4-dot{width:10px;height:10px;border-radius:50%;background:var(--gold)}
        .a4-name{margin:0;font-size:24px;font-weight:900;color:var(--ink)}
        .a4-meta{color:#707784;font-size:12px;line-height:1.45;margin-top:6px}
        .a4-title{margin:0;font-size:40px;font-weight:900;color:var(--ink)}
        .a4-date{color:#707784;font-size:12px;text-align:right}
        .a4-body{padding:10mm 16mm}
        .a4-sect{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#8b90a0;font-weight:900;margin:0 0 8px}
        table{width:100%;border-collapse:collapse}
        thead th{background:#fafbff;border-bottom:1px solid var(--border);font-size:12px;color:#8b90a0;text-transform:uppercase;letter-spacing:.06em;padding:9px 10px;text-align:left}
        tbody td{border-bottom:1px solid #eef2f7;padding:9px 10px;font-size:13.5px}
        th.num,td.num{text-align:right}
        .a4-totals{display:flex;justify-content:flex-end;margin-top:10px}
        .a4-card{width:100%;max-width:340px;background:#fbfbfe;border:1px solid var(--border);border-radius:12px;padding:14px}
        .a4-line{display:flex;justify-content:space-between;margin:6px 0;font-size:14px}
        .a4-strong{border-top:1px solid var(--border);margin-top:8px;padding-top:10px;font-size:18px;font-weight:900}
        .a4-ft{margin-top:auto;padding:10mm 16mm;background:#fbfbfe;border-top:1px solid var(--border)}
        .a4-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
      `}</style>

      <div className="container">
        {/* Mobile tabs */}
        {isNarrow && (
          <div className="seg">
            <button
              className={`seg-btn ${tab === "edit" ? "active" : ""}`}
              onClick={() => setTab("edit")}
            >
              Edit
            </button>
            <button
              className={`seg-btn ${tab === "preview" ? "active" : ""}`}
              onClick={() => setTab("preview")}
            >
              Preview
            </button>
          </div>
        )}

        <div className="layout">
          {/* Editor (hidden on phones when Preview tab is active) */}
          <div
            className="grid"
            style={{ alignContent: "start", display: isNarrow && tab === "preview" ? "none" : "grid" }}
          >
            {/* Add item */}
            <section className="panel">
              <div className="ph"><h2 className="pt">Add item</h2></div>
              <div className="pb">
                <div className="grid" style={{ gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
                  <div style={{ gridColumn: "1 / span 2" }}>
                    <label htmlFor="i1">Description</label>
                    <input
                      id="i1"
                      className="input"
                      name="description"
                      placeholder="Yacht charter service…"
                      value={invoice.description}
                      onChange={onInvoice}
                      onKeyDown={onAddKey}
                    />
                  </div>
                  <div>
                    <label htmlFor="i2">Price (VAT incl.)</label>
                    <input
                      id="i2"
                      className="input"
                      type="number"
                      step="0.01"
                      min="0"
                      name="unitPrice"
                      placeholder="0.00"
                      value={invoice.unitPrice}
                      onChange={onInvoice}
                      onKeyDown={onAddKey}
                    />
                  </div>
                  <div>
                    <label htmlFor="i3">Discount %</label>
                    <input
                      id="i3"
                      className="input"
                      type="number"
                      min="0"
                      max="100"
                      name="discount"
                      placeholder="0"
                      value={invoice.discount}
                      onChange={onInvoice}
                      onKeyDown={onAddKey}
                    />
                  </div>
                  <button className="btn btn-primary" onClick={addItem} disabled={!invoice.description || !invoice.unitPrice}>Add item</button>
                </div>
              </div>
            </section>

            {/* Client details */}
            <section className="panel">
              <div className="ph"><h2 className="pt">Client details</h2></div>
              <div className="pb">
                <div className="grid g3">
                  <div><label htmlFor="c1">Client name</label><input id="c1" className="input" name="name" value={client.name} onChange={onClient} placeholder="Full name" /></div>
                  <div><label htmlFor="c2">Company</label><input id="c2" className="input" name="companyName" value={client.companyName} onChange={onClient} placeholder="Company name" /></div>
                  <div><label htmlFor="c3">Tax/VAT ID</label><input id="c3" className="input" name="taxId" value={client.taxId} onChange={onClient} placeholder="e.g. ESB12345678" /></div>
                  <div><label htmlFor="c4">Email</label><input id="c4" className="input" name="email" value={client.email} onChange={onClient} placeholder="email@example.com" /></div>
                  <div><label htmlFor="c5">Phone</label><input id="c5" className="input" name="phone" value={client.phone} onChange={onClient} placeholder="Phone number" /></div>
                  <div><label htmlFor="c6">Address</label><input id="c6" className="input" name="address" value={client.address} onChange={onClient} placeholder="Street address" /></div>
                  <div><label htmlFor="c7">City</label><input id="c7" className="input" name="city" value={client.city} onChange={onClient} placeholder="City" /></div>
                  <div><label htmlFor="c8">Postcode</label><input id="c8" className="input" name="postalCode" value={client.postalCode} onChange={onClient} placeholder="Postcode" /></div>
                  <div><label htmlFor="c9">Country</label><input id="c9" className="input" name="country" value={client.country} onChange={onClient} placeholder="Country" /></div>
                </div>
              </div>
            </section>

            {/* Notes & Terms */}
            <section className="panel">
              <div className="ph"><h2 className="pt">Notes & Terms</h2></div>
              <div className="pb grid">
                <div>
                  <label htmlFor="n1">Notes to client</label>
                  <textarea id="n1" className="textarea" name="notes" value={invoice.notes} onChange={onInvoice} />
                </div>
                <div>
                  <label htmlFor="n2">Payment terms</label>
                  <textarea id="n2" className="textarea" name="terms" value={invoice.terms} onChange={onInvoice} />
                </div>
              </div>
            </section>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {isNarrow && <button className="btn" onClick={() => setTab("preview")}>Preview</button>}
              <button id="download-btn" className="btn btn-primary" onClick={downloadPDF}>Download PDF</button>
            </div>
          </div>

          {/* Fluid preview (hidden on phones while editing) */}
          <div style={{ display: isNarrow && tab === "edit" ? "none" : "block" }}>
            <section className="m-invoice">
              <div className="m-hd">
                <div className="m-brand"><span className="m-dot" /><h2 className="m-name">Just Enjoy Ibiza</h2></div>
                <div style={{ textAlign: "right" }}>
                  <h3 className="m-title">Invoice</h3>
                  <div style={{ color: "#707784", fontSize: 12 }}>{todayPretty}</div>
                </div>
              </div>

              <div className="m-body">
                <div className="grid g2" style={{ marginBottom: 10 }}>
                  <div>
                    <h4 className="m-sect">Invoice details</h4>
                    <div className="grid" style={{ maxWidth: 360 }}>
                      <div><label htmlFor="d1">Invoice date</label><input id="d1" className="input" type="date" name="invoiceDate" value={invoice.invoiceDate} onChange={onInvoice} /></div>
                      <div><label htmlFor="d2">Invoice number</label><input id="d2" className="input" type="text" name="invoiceNumber" placeholder="JEI-00000" value={invoice.invoiceNumber} onChange={onInvoice} /></div>
                    </div>
                  </div>

                  {(client.name || client.companyName) && (
                    <div>
                      <h4 className="m-sect">Bill to</h4>
                      <div style={{ lineHeight: 1.5, fontSize: 13 }}>
                        {client.name && <div style={{ fontWeight: 900, color: "#0b0f19" }}>{client.name}</div>}
                        {client.companyName && <div style={{ fontWeight: 800 }}>{client.companyName}</div>}
                        {client.taxId && <div>Tax ID: {client.taxId}</div>}
                        {client.address && <div>{client.address}</div>}
                        {(client.city || client.postalCode) && <div>{client.city}{client.city && client.postalCode ? ", " : ""}{client.postalCode}</div>}
                        {client.country && <div>{client.country}</div>}
                        {client.email && <div>{client.email}</div>}
                        {client.phone && <div>{client.phone}</div>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Items as compact cards on mobile */}
                <div className="m-items">
                  {items.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#8e97ab", padding: 16, border: "1px dashed #e5e7eb", borderRadius: 12 }}>
                      No items added yet.
                    </div>
                  ) : (
                    items.map((it, i) => {
                      const discounted = it.unitPrice - (it.unitPrice * it.discount) / 100;
                      const lineVat = Math.round(((discounted * VAT_RATE) / (1 + VAT_RATE)) * 100) / 100;
                      return (
                        <div key={it.id} className="m-item">
                          <div style={{ minWidth: 0 }}>
                            <h4>{i + 1}. {it.description}</h4>
                            <div className="m-meta">Price (incl.): {fmt(it.unitPrice)} · Discount: {it.discount ? `${it.discount}%` : "—"} · VAT: {fmt(lineVat)}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "start" }}>
                            <div className="m-amt">{fmt(discounted)}</div>
                            <button className="m-remove" onClick={() => removeItem(it.id)} aria-label={`Remove item ${i + 1}`} title="Remove item">×</button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Totals */}
                {items.length > 0 && (
                  <div className="m-totals">
                    <div className="m-row"><span style={{ color: "#8b90a0" }}>Subtotal (excl. VAT)</span><span>{fmt(totalNet)}</span></div>
                    <div className="m-row"><span style={{ color: "#8b90a0" }}>VAT (21%)</span><span>{fmt(totalVat)}</span></div>
                    <div className="m-row m-strong"><span>Total amount</span><span>{fmt(totalGross)}</span></div>
                  </div>
                )}
              </div>

              <div className="m-ft">
                <div>
                  <div style={{ fontWeight: 900, color: "#0b0f19", marginBottom: 6 }}>Payment information</div>
                  <div style={{ color: "#6f7686", whiteSpace: "pre-wrap" }}>{invoice.terms}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 900, color: "#0b0f19", marginBottom: 6 }}>Notes</div>
                  <div style={{ color: "#6f7686", whiteSpace: "pre-wrap" }}>{invoice.notes}</div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Sticky mobile action bar */}
        {isNarrow && (
          <div className="bar">
            <div className="bar-in">
              <div className="bar-ttl">Total {fmt(totalGross)}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn" onClick={addItem} disabled={!invoice.description || !invoice.unitPrice}>Add item</button>
                <button id="download-btn" className="btn btn-primary" onClick={downloadPDF}>PDF</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden A4 layout for PDF (off-screen by default) */}
      <div className="pdf-stage" aria-hidden="true" ref={pdfRef}>
        <div className="a4">
          <header className="a4-hd">
            <div className="a4-top">
              <div>
                <div className="a4-org"><span className="a4-dot" /><h2 className="a4-name">Just Enjoy Ibiza</h2></div>
                <div className="a4-meta">
                  <div>Av. Sant Jordi 48/52</div>
                  <div>CIF: B56880875</div>
                  <div>Ibiza, Spain</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <h1 className="a4-title">INVOICE</h1>
                <div className="a4-date">{todayPretty}</div>
              </div>
            </div>
          </header>

          <div className="a4-body">
            <div className="grid g2" style={{ marginBottom: 10 }}>
              <div>
                <h3 className="a4-sect">Invoice details</h3>
                <div className="grid" style={{ maxWidth: 360 }}>
                  <div><label htmlFor="pd1">Invoice date</label><input id="pd1" className="input" type="date" name="invoiceDate" value={invoice.invoiceDate} onChange={onInvoice} /></div>
                  <div><label htmlFor="pd2">Invoice number</label><input id="pd2" className="input" type="text" name="invoiceNumber" placeholder="JEI-00000" value={invoice.invoiceNumber} onChange={onInvoice} /></div>
                </div>
              </div>

              {(client.name || client.companyName) && (
                <div>
                  <h3 className="a4-sect">Bill to</h3>
                  <div style={{ lineHeight: 1.5, fontSize: 13 }}>
                    {client.name && <div style={{ fontWeight: 900, color: "#0b0f19" }}>{client.name}</div>}
                    {client.companyName && <div style={{ fontWeight: 800 }}>{client.companyName}</div>}
                    {client.taxId && <div>Tax ID: {client.taxId}</div>}
                    {client.address && <div>{client.address}</div>}
                    {(client.city || client.postalCode) && <div>{client.city}{client.city && client.postalCode ? ", " : ""}{client.postalCode}</div>}
                    {client.country && <div>{client.country}</div>}
                    {client.email && <div>{client.email}</div>}
                    {client.phone && <div>{client.phone}</div>}
                  </div>
                </div>
              )}
            </div>

            <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Description</th>
                    <th className="num" style={{ width: 140 }}>Price (incl.)</th>
                    <th className="num" style={{ width: 90 }}>Discount</th>
                    <th className="num" style={{ width: 120 }}>VAT (21%)</th>
                    <th className="num" style={{ width: 140 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: "center", color: "#8e97ab", padding: 20 }}>No items added yet.</td></tr>
                  ) : (
                    items.map((it, i) => {
                      const discounted = it.unitPrice - (it.unitPrice * it.discount) / 100;
                      const lineVat = Math.round(((discounted * VAT_RATE) / (1 + VAT_RATE)) * 100) / 100;
                      return (
                        <tr key={it.id}>
                          <td>{i + 1}</td>
                          <td>{it.description}</td>
                          <td className="num">{fmt(it.unitPrice)}</td>
                          <td className="num">{it.discount ? `${it.discount}%` : "—"}</td>
                          <td className="num">{fmt(lineVat)}</td>
                          <td className="num">{fmt(discounted)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {items.length > 0 && (
              <div className="a4-totals">
                <div className="a4-card">
                  <div className="a4-line"><span style={{ color: "#8b90a0" }}>Subtotal (excl. VAT)</span><span>{fmt(totalNet)}</span></div>
                  <div className="a4-line"><span style={{ color: "#8b90a0" }}>VAT (21%)</span><span>{fmt(totalVat)}</span></div>
                  <div className="a4-line a4-strong"><span>Total amount</span><span>{fmt(totalGross)}</span></div>
                </div>
              </div>
            )}
          </div>
          <footer className="a4-ft">
            <div className="a4-grid">
              <div>
                <h4 style={{ margin: 0, color: "#0b0f19" }}>Payment information</h4>
                <p style={{ margin: "6px 0 0", color: "#6f7686", whiteSpace: "pre-wrap" }}>{invoice.terms}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <h4 style={{ margin: 0, color: "#0b0f19" }}>Notes</h4>
                <p style={{ margin: "6px 0 0", color: "#6f7686", whiteSpace: "pre-wrap" }}>{invoice.notes}</p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}