import { useState, useEffect, useRef } from "react";

const LULU_SIZES_NUMERIC = ["00", "0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20"];
const LULU_SIZES_ALPHA = ["XXS", "XS", "S", "M", "L", "XL", "XXL"];
const LULU_COLORS = [
  "Black", "White", "Navy", "Grey", "Heathered Grey", "Dark Olive", "Forest Green",
  "Teal", "Cerulean Blue", "Burgundy", "Mauve", "Blush Pink", "Coral", "Red",
  "Midnight Blue", "Bone", "Brown", "Tan", "Gold", "Silver", "Multi"
];

const STORAGE_KEY = "lulu-tracker-products";

const defaultForm = {
  name: "",
  url: "",
  sizes: [],
  colors: [],
  max_price: "",
};

function Tag({ label, onRemove, color }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: color || "#f0ece8", color: "#3a2a1f",
      borderRadius: 20, padding: "3px 10px 3px 12px",
      fontSize: 12, fontWeight: 600, letterSpacing: "0.02em",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {label}
      {onRemove && (
        <button onClick={onRemove} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "#8a6a58", fontSize: 14, lineHeight: 1,
          padding: "0 0 0 2px", display: "flex", alignItems: "center",
        }}>×</button>
      )}
    </span>
  );
}

function MultiSelect({ options, selected, onToggle, label }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#a08060", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map(opt => {
          const active = selected.includes(opt);
          return (
            <button key={opt} onClick={() => onToggle(opt)} style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 12,
              fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
              fontFamily: "'DM Sans', sans-serif",
              border: active ? "1.5px solid #8B4513" : "1.5px solid #d8cfc8",
              background: active ? "#8B4513" : "transparent",
              color: active ? "#fff" : "#5a3a2a",
            }}>{opt}</button>
          );
        })}
      </div>
    </div>
  );
}

function ProductCard({ product, onDelete, onEdit }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "#faf7f4" : "#fff",
        border: "1.5px solid #e8e0d8",
        borderRadius: 16, padding: "20px 22px",
        transition: "all 0.2s", position: "relative",
        boxShadow: hovered ? "0 4px 20px rgba(139,69,19,0.08)" : "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* Actions */}
      <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 6, opacity: hovered ? 1 : 0, transition: "opacity 0.2s" }}>
        <button onClick={() => onEdit(product)} style={{
          background: "#f0ece8", border: "none", borderRadius: 8,
          width: 30, height: 30, cursor: "pointer", fontSize: 13,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>✏️</button>
        <button onClick={() => onDelete(product.id)} style={{
          background: "#fee2d5", border: "none", borderRadius: 8,
          width: 30, height: 30, cursor: "pointer", fontSize: 13,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>🗑️</button>
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, color: "#2a1a0f", marginBottom: 6, paddingRight: 70, fontFamily: "'DM Serif Display', serif" }}>
        {product.name}
      </div>
      <a href={product.url} target="_blank" rel="noreferrer" style={{
        fontSize: 11, color: "#8B4513", textDecoration: "none",
        fontFamily: "'DM Sans', sans-serif", display: "block",
        marginBottom: 12, wordBreak: "break-all",
        opacity: 0.8,
      }}>
        {product.url.replace("https://www.lululemon.com", "lululemon.com")}
      </a>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: product.colors?.length ? 8 : 0 }}>
        {product.sizes.map(s => <Tag key={s} label={s} color="#ede8e4" />)}
        {product.max_price && <Tag label={`≤ $${product.max_price}`} color="#e8f0e8" />}
      </div>

      {product.colors?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {product.colors.map(c => <Tag key={c} label={c} color="#f5eef8" />)}
        </div>
      )}
    </div>
  );
}

function Modal({ open, onClose, children }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(30,15,5,0.35)",
      backdropFilter: "blur(3px)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fffdf9", borderRadius: 20,
        padding: 32, width: "100%", maxWidth: 560,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        animation: "slideUp 0.25s ease",
      }}>
        {children}
      </div>
    </div>
  );
}

export default function LuluTracker() {
  const [products, setProducts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editId, setEditId] = useState(null);
  const [exportCopied, setExportCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("numeric");
  const [urlError, setUrlError] = useState("");
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // Load from storage on mount
  useEffect(() => {
    const load = async () => {
      try {
        const result = await window.storage.get(STORAGE_KEY);
        if (result?.value) setProducts(JSON.parse(result.value));
      } catch {
        // No saved data yet
      }
    };
    load();
  }, []);

  // Persist on change
  useEffect(() => {
    if (products.length === 0) return;
    window.storage.set(STORAGE_KEY, JSON.stringify(products)).catch(() => {});
  }, [products]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  const validateUrl = (url) => {
    if (!url) return "URL is required";
    if (!url.includes("lululemon.com")) return "Please paste a lululemon.com product URL";
    return "";
  };

  const openAdd = () => {
    setForm(defaultForm);
    setEditId(null);
    setUrlError("");
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setForm({
      name: product.name,
      url: product.url,
      sizes: [...product.sizes],
      colors: [...(product.colors || [])],
      max_price: product.max_price ?? "",
    });
    setEditId(product.id);
    setUrlError("");
    setModalOpen(true);
  };

  const toggleSize = (s) => {
    setForm(f => ({
      ...f,
      sizes: f.sizes.includes(s) ? f.sizes.filter(x => x !== s) : [...f.sizes, s],
    }));
  };

  const toggleColor = (c) => {
    setForm(f => ({
      ...f,
      colors: f.colors.includes(c) ? f.colors.filter(x => x !== c) : [...f.colors, c],
    }));
  };

  const handleSave = () => {
    const err = validateUrl(form.url);
    if (err) { setUrlError(err); return; }
    if (!form.name.trim()) return;
    if (form.sizes.length === 0) return;

    const entry = {
      id: editId || Date.now().toString(),
      name: form.name.trim(),
      url: form.url.trim(),
      sizes: form.sizes,
      colors: form.colors,
      max_price: form.max_price ? parseFloat(form.max_price) : null,
    };

    setProducts(prev =>
      editId ? prev.map(p => p.id === editId ? entry : p) : [...prev, entry]
    );
    setModalOpen(false);
    showToast(editId ? "Item updated!" : "Item added to tracker ✓");
  };

  const handleDelete = (id) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    showToast("Item removed", "warn");
  };

  // Export as products.json (tracker format)
  const exportJson = () => {
    const data = products.map(({ name, url, sizes, colors, max_price }) => ({
      name, url, sizes, colors: colors?.length ? colors : undefined, max_price: max_price ?? null,
    }));
    const str = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(str);
    setExportCopied(true);
    setTimeout(() => setExportCopied(false), 2000);
    showToast("Copied to clipboard — paste into products.json");
  };

  const downloadJson = () => {
    const data = products.map(({ name, url, sizes, colors, max_price }) => ({
      name, url, sizes, colors: colors?.length ? colors : undefined, max_price: max_price ?? null,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "products.json";
    a.click();
  };

  const canSave = form.name.trim() && form.url.trim() && form.sizes.length > 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;1,9..40,300&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f7f3ef; }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        input, textarea { outline: none; }
        input::placeholder { color: #c0aa98; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d0c8be; border-radius: 3px; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 200,
          background: toast.type === "warn" ? "#3a2010" : "#1a3a20",
          color: "#fff", padding: "12px 20px", borderRadius: 12,
          fontSize: 13, fontFamily: "'DM Sans', sans-serif",
          fontWeight: 500, boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
          animation: "toastIn 0.25s ease",
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ minHeight: "100vh", background: "#f7f3ef", fontFamily: "'DM Sans', sans-serif" }}>

        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #2a1505 0%, #5c2a0a 50%, #8B4513 100%)",
          padding: "36px 32px 32px", position: "relative", overflow: "hidden",
        }}>
          {/* Decorative circles */}
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{
              position: "absolute", borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.08)",
              width: [320, 220, 140, 80][i], height: [320, 220, 140, 80][i],
              top: [-80, -30, 10, 30][i], right: [-60, 20, 80, 130][i],
              pointerEvents: "none",
            }} />
          ))}
          <div style={{ maxWidth: 680, margin: "0 auto", position: "relative" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,200,140,0.7)", marginBottom: 10, fontWeight: 600 }}>
              Sale Tracker
            </div>
            <h1 style={{ fontSize: 34, fontFamily: "'DM Serif Display', serif", color: "#fff", fontWeight: 400, lineHeight: 1.15, marginBottom: 8 }}>
              Lululemon Wishlist
            </h1>
            <p style={{ color: "rgba(255,220,180,0.75)", fontSize: 14, fontWeight: 300 }}>
              Track items in your size & color — get emailed when they go on sale.
            </p>
          </div>
        </div>

        {/* Main */}
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 20px 60px" }}>

          {/* Action bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: "#8a6a52", fontWeight: 500 }}>
              {products.length === 0 ? "No items tracked yet" : `${products.length} item${products.length !== 1 ? "s" : ""} tracked`}
            </div>
            <button onClick={openAdd} style={{
              background: "#8B4513", color: "#fff",
              border: "none", borderRadius: 12, padding: "10px 20px",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 7,
              boxShadow: "0 2px 12px rgba(139,69,19,0.3)",
              transition: "all 0.15s",
              fontFamily: "'DM Sans', sans-serif",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#7a3a0f"}
              onMouseLeave={e => e.currentTarget.style.background = "#8B4513"}
            >
              <span style={{ fontSize: 16 }}>+</span> Add Item
            </button>
          </div>

          {/* Empty state */}
          {products.length === 0 && (
            <div style={{
              textAlign: "center", padding: "60px 20px",
              background: "#fff", borderRadius: 20,
              border: "1.5px dashed #d8cfc8",
            }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>🛍️</div>
              <div style={{ fontSize: 17, fontFamily: "'DM Serif Display', serif", color: "#2a1505", marginBottom: 8 }}>
                Your wishlist is empty
              </div>
              <div style={{ fontSize: 13, color: "#a08060", marginBottom: 24, lineHeight: 1.6 }}>
                Paste a Lululemon product URL, pick your size and color preferences,<br />
                and we'll alert you when it goes on sale.
              </div>
              <button onClick={openAdd} style={{
                background: "#8B4513", color: "#fff", border: "none",
                borderRadius: 12, padding: "12px 28px", fontSize: 14,
                fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>
                Add your first item
              </button>
            </div>
          )}

          {/* Product cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {products.map(p => (
              <ProductCard key={p.id} product={p} onDelete={handleDelete} onEdit={openEdit} />
            ))}
          </div>

          {/* Export section */}
          {products.length > 0 && (
            <div style={{
              marginTop: 32, background: "#2a1505", borderRadius: 16,
              padding: "22px 24px",
            }}>
              <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,190,120,0.7)", marginBottom: 6, fontWeight: 700 }}>
                Export for GitHub
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,220,180,0.7)", marginBottom: 16, lineHeight: 1.6 }}>
                When you're happy with your list, export <code style={{ background: "rgba(255,255,255,0.1)", padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>products.json</code> and replace the file in your GitHub repo.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={downloadJson} style={{
                  background: "#8B4513", color: "#fff", border: "none",
                  borderRadius: 10, padding: "10px 18px", fontSize: 13,
                  fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}>
                  ⬇ Download products.json
                </button>
                <button onClick={exportJson} style={{
                  background: "rgba(255,255,255,0.08)", color: "rgba(255,220,180,0.9)",
                  border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
                  padding: "10px 18px", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
                }}>
                  {exportCopied ? "✓ Copied!" : "📋 Copy to clipboard"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "#2a1505", marginBottom: 4 }}>
            {editId ? "Edit Item" : "Add Item to Track"}
          </h2>
          <p style={{ fontSize: 13, color: "#a08060", marginBottom: 24 }}>
            Paste the product URL and choose your preferences below.
          </p>

          {/* Name */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#a08060", display: "block", marginBottom: 6 }}>
              Item Name
            </label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Align High-Rise Pant 25&quot;"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 10,
                border: "1.5px solid #e0d8d0", fontSize: 14, color: "#2a1505",
                background: "#fffdf9", fontFamily: "'DM Sans', sans-serif",
                transition: "border-color 0.15s",
              }}
              onFocus={e => e.target.style.borderColor = "#8B4513"}
              onBlur={e => e.target.style.borderColor = "#e0d8d0"}
            />
          </div>

          {/* URL */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#a08060", display: "block", marginBottom: 6 }}>
              Product URL
            </label>
            <input
              value={form.url}
              onChange={e => { setForm(f => ({ ...f, url: e.target.value })); setUrlError(""); }}
              placeholder="https://www.lululemon.com/en-us/p/..."
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 10,
                border: `1.5px solid ${urlError ? "#c0392b" : "#e0d8d0"}`,
                fontSize: 13, color: "#2a1505", background: "#fffdf9",
                fontFamily: "'DM Sans', sans-serif",
              }}
              onFocus={e => e.target.style.borderColor = urlError ? "#c0392b" : "#8B4513"}
              onBlur={e => e.target.style.borderColor = urlError ? "#c0392b" : "#e0d8d0"}
            />
            {urlError && <div style={{ fontSize: 11, color: "#c0392b", marginTop: 4 }}>{urlError}</div>}
          </div>

          {/* Sizes */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              {["numeric", "alpha"].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
                  textTransform: "uppercase", padding: "5px 12px",
                  borderRadius: 8, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  border: "1.5px solid",
                  borderColor: activeTab === tab ? "#8B4513" : "#e0d8d0",
                  background: activeTab === tab ? "#8B4513" : "transparent",
                  color: activeTab === tab ? "#fff" : "#a08060",
                }}>
                  {tab === "numeric" ? "00–20" : "XS–XXL"}
                </button>
              ))}
            </div>
            <MultiSelect
              label="Your Sizes (select all that fit)"
              options={activeTab === "numeric" ? LULU_SIZES_NUMERIC : LULU_SIZES_ALPHA}
              selected={form.sizes}
              onToggle={toggleSize}
            />
            {form.sizes.length === 0 && (
              <div style={{ fontSize: 11, color: "#c0392b", marginTop: 6 }}>Select at least one size</div>
            )}
          </div>

          {/* Colors */}
          <div style={{ marginBottom: 18 }}>
            <MultiSelect
              label="Preferred Colors (optional)"
              options={LULU_COLORS}
              selected={form.colors}
              onToggle={toggleColor}
            />
            <div style={{ fontSize: 11, color: "#b0906e", marginTop: 6 }}>
              Note: colors are saved for your reference — the tracker alerts based on size &amp; price.
            </div>
          </div>

          {/* Max price */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#a08060", display: "block", marginBottom: 6 }}>
              Max Price (optional)
            </label>
            <div style={{ position: "relative", maxWidth: 160 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#a08060", fontSize: 14, fontWeight: 600 }}>$</span>
              <input
                type="number"
                value={form.max_price}
                onChange={e => setForm(f => ({ ...f, max_price: e.target.value }))}
                placeholder="79.00"
                min="0"
                step="0.01"
                style={{
                  width: "100%", padding: "11px 14px 11px 26px", borderRadius: 10,
                  border: "1.5px solid #e0d8d0", fontSize: 14, color: "#2a1505",
                  background: "#fffdf9", fontFamily: "'DM Sans', sans-serif",
                }}
                onFocus={e => e.target.style.borderColor = "#8B4513"}
                onBlur={e => e.target.style.borderColor = "#e0d8d0"}
              />
            </div>
            <div style={{ fontSize: 11, color: "#b0906e", marginTop: 5 }}>
              Leave blank to alert at any price when your size is in stock.
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => setModalOpen(false)} style={{
              background: "transparent", color: "#8a6a52",
              border: "1.5px solid #e0d8d0", borderRadius: 10,
              padding: "11px 20px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            }}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              style={{
                background: canSave ? "#8B4513" : "#d8cfc8",
                color: canSave ? "#fff" : "#a09080",
                border: "none", borderRadius: 10,
                padding: "11px 24px", fontSize: 13, fontWeight: 700,
                cursor: canSave ? "pointer" : "not-allowed",
                fontFamily: "'DM Sans', sans-serif",
                transition: "background 0.15s",
              }}
            >
              {editId ? "Save Changes" : "Add to Tracker"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
