import { useState, useEffect } from "react";
import { Plus, Minus, Trash2, Receipt, TrendingUp, Settings, Edit2, Check, X, Delete } from "lucide-react";

const CURRENCY = "£";
const MENU_KEY = "billing_menu_v1";
const SALES_KEY = "billing_sales_v1";
const ORDER_KEY = "billing_current_order_v1";
const CASH_KEY = "billing_current_cash_v1";

const DEFAULT_MENU = [
  { category: "Mains", items: [
    { name: "Item 1", price: 8.00 },
    { name: "Item 2", price: 9.50 },
  ]},
  { category: "Drinks", items: [
    { name: "Drink 1", price: 2.50 },
  ]},
];

// Safe localStorage helpers (SSR-safe)
const load = (key, fallback) => {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
};
const save = (key, value) => {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

export default function BillingApp() {
  const [menu, setMenu] = useState(() => load(MENU_KEY, DEFAULT_MENU));
  const [order, setOrder] = useState(() => load(ORDER_KEY, []));
  const [cashGiven, setCashGiven] = useState(() => load(CASH_KEY, ""));
  const [salesLog, setSalesLog] = useState(() => load(SALES_KEY, []));
  const [activeCategory, setActiveCategory] = useState(() => {
    const m = load(MENU_KEY, DEFAULT_MENU);
    return m[0]?.category || "";
  });
  const [view, setView] = useState("till"); // till | summary | editor

  // Persist as things change
  useEffect(() => { save(MENU_KEY, menu); }, [menu]);
  useEffect(() => { save(ORDER_KEY, order); }, [order]);
  useEffect(() => { save(CASH_KEY, cashGiven); }, [cashGiven]);
  useEffect(() => { save(SALES_KEY, salesLog); }, [salesLog]);

  // Order actions
  const addItem = (item) => {
    setOrder(prev => {
      const existing = prev.find(o => o.name === item.name);
      if (existing) return prev.map(o => o.name === item.name ? { ...o, qty: o.qty + 1 } : o);
      return [...prev, { ...item, qty: 1 }];
    });
  };
  const changeQty = (name, delta) => {
    setOrder(prev => prev.map(o => o.name === name ? { ...o, qty: o.qty + delta } : o).filter(o => o.qty > 0));
  };
  const removeItem = (name) => setOrder(prev => prev.filter(o => o.name !== name));
  const clearOrder = () => { setOrder([]); setCashGiven(""); };

  // Number pad
  const pressKey = (key) => {
    setCashGiven(prev => {
      if (key === "clear") return "";
      if (key === "back") return prev.slice(0, -1);
      if (key === ".") {
        if (prev.includes(".")) return prev;
        if (prev === "") return "0.";
        return prev + ".";
      }
      if (prev === "0") return key;
      if (prev.includes(".")) {
        const decimals = prev.split(".")[1];
        if (decimals.length >= 2) return prev;
      }
      return prev + key;
    });
  };

  const total = order.reduce((sum, o) => sum + o.price * o.qty, 0);
  const cash = parseFloat(cashGiven) || 0;
  const change = cash - total;
  const canComplete = order.length > 0;

  const completeOrder = (paymentType) => {
    const record = {
      id: Date.now(),
      time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      items: order,
      total,
      payment: paymentType,
      cashGiven: paymentType === "cash" ? cash : null,
      change: paymentType === "cash" ? change : null,
    };
    setSalesLog(prev => [record, ...prev]);
    clearOrder();
  };

  const dayTotal = salesLog.reduce((sum, r) => sum + r.total, 0);
  const cashTotal = salesLog.filter(r => r.payment === "cash").reduce((sum, r) => sum + r.total, 0);
  const cardTotal = salesLog.filter(r => r.payment === "card").reduce((sum, r) => sum + r.total, 0);

  const resetDay = () => {
    if (confirm("Clear ALL sales for the day? Cannot be undone.")) {
      setSalesLog([]);
      setView("till");
    }
  };

  const currentMenuItems = menu.find(c => c.category === activeCategory)?.items || [];

  return (
    <div className="min-h-screen bg-slate-100 p-3">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 gap-2">
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Event Till</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setView(view === "summary" ? "till" : "summary")}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700"
            >
              <TrendingUp size={18} />
              {CURRENCY}{dayTotal.toFixed(2)}
            </button>
            <button
              onClick={() => setView(view === "editor" ? "till" : "editor")}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700"
            >
              <Settings size={18} />
              Menu
            </button>
          </div>
        </div>

        {view === "editor" && (
          <MenuEditor
            menu={menu}
            saveMenu={(m) => {
              setMenu(m);
              if (!m.find(c => c.category === activeCategory)) {
                setActiveCategory(m[0]?.category || "");
              }
            }}
            onClose={() => setView("till")}
          />
        )}

        {view === "summary" && (
          <SummaryView
            salesLog={salesLog}
            dayTotal={dayTotal}
            cashTotal={cashTotal}
            cardTotal={cardTotal}
            onBack={() => setView("till")}
            onReset={resetDay}
          />
        )}

        {view === "till" && (
          <div className="grid lg:grid-cols-2 gap-3">
            {/* MENU SIDE */}
            <div className="bg-white rounded-xl shadow p-3">
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                {menu.map(c => (
                  <button
                    key={c.category}
                    onClick={() => setActiveCategory(c.category)}
                    className={`px-4 py-3 rounded-lg text-base font-semibold whitespace-nowrap ${
                      activeCategory === c.category
                        ? "bg-slate-800 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {c.category}
                  </button>
                ))}
              </div>
              {menu.length === 0 || currentMenuItems.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p className="mb-3">No items yet.</p>
                  <button
                    onClick={() => setView("editor")}
                    className="px-4 py-2 bg-slate-800 text-white rounded-lg font-semibold"
                  >
                    Add menu items
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {currentMenuItems.map(item => (
                    <button
                      key={item.name}
                      onClick={() => addItem(item)}
                      className="p-4 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 rounded-lg text-left transition min-h-20"
                    >
                      <div className="font-semibold text-slate-800 text-base leading-tight mb-1">{item.name}</div>
                      <div className="text-slate-600 text-sm font-medium">{CURRENCY}{item.price.toFixed(2)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ORDER + NUMPAD SIDE */}
            <div className="bg-white rounded-xl shadow p-3 flex flex-col">
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                  <Receipt size={20} />
                  Order
                </h2>
                {order.length > 0 && (
                  <button onClick={clearOrder} className="text-sm text-red-600 font-semibold px-3 py-1 rounded hover:bg-red-50">Clear</button>
                )}
              </div>

              <div className="flex-1 min-h-24 max-h-48 overflow-y-auto mb-2 border-y border-slate-100">
                {order.length === 0 ? (
                  <div className="text-center text-slate-400 py-6 text-sm">Tap menu items to add</div>
                ) : (
                  order.map(o => (
                    <div key={o.name} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="font-medium text-sm truncate">{o.name}</div>
                        <div className="text-xs text-slate-500">{CURRENCY}{o.price.toFixed(2)}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => changeQty(o.name, -1)} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg"><Minus size={14} /></button>
                        <span className="w-7 text-center font-bold">{o.qty}</span>
                        <button onClick={() => changeQty(o.name, 1)} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg"><Plus size={14} /></button>
                        <span className="w-16 text-right font-bold text-sm">{CURRENCY}{(o.price * o.qty).toFixed(2)}</span>
                        <button onClick={() => removeItem(o.name)} className="ml-1 text-slate-400"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Totals */}
              <div className="bg-slate-800 text-white rounded-lg p-3 mb-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm">Total</span>
                  <span className="text-2xl font-bold">{CURRENCY}{total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-300">Cash given</span>
                  <span className="font-semibold">{CURRENCY}{(parseFloat(cashGiven) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-600">
                  <span className="font-semibold">
                    {change >= 0 ? "Change" : "Short"}
                  </span>
                  <span className={`text-2xl font-bold ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {CURRENCY}{Math.abs(change).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Quick cash */}
              {total > 0 && (
                <div className="flex gap-1 mb-2">
                  {[Math.ceil(total), Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10, Math.ceil(total / 20) * 20]
                    .filter((v, i, arr) => arr.indexOf(v) === i)
                    .slice(0, 4)
                    .map(v => (
                      <button
                        key={v}
                        onClick={() => setCashGiven(v.toString())}
                        className="flex-1 py-2 text-sm font-bold bg-slate-200 rounded-lg active:bg-slate-300"
                      >
                        {CURRENCY}{v}
                      </button>
                    ))}
                </div>
              )}

              {/* BIG NUMBER PAD */}
              <div className="grid grid-cols-3 gap-2 mb-2">
                {["7","8","9","4","5","6","1","2","3",".","0","back"].map(k => (
                  <button
                    key={k}
                    onClick={() => pressKey(k)}
                    className="h-14 md:h-16 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl text-2xl md:text-3xl font-bold text-slate-800 flex items-center justify-center select-none"
                  >
                    {k === "back" ? <Delete size={24} /> : k}
                  </button>
                ))}
              </div>

              {/* Payment buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => completeOrder("cash")}
                  disabled={!canComplete || change < 0}
                  className="py-4 bg-green-600 text-white font-bold text-lg rounded-xl disabled:bg-slate-300 active:bg-green-700"
                >
                  Paid Cash
                </button>
                <button
                  onClick={() => completeOrder("card")}
                  disabled={!canComplete}
                  className="py-4 bg-blue-600 text-white font-bold text-lg rounded-xl disabled:bg-slate-300 active:bg-blue-700"
                >
                  Paid Card
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- MENU EDITOR ---
function MenuEditor({ menu, saveMenu, onClose }) {
  const [local, setLocal] = useState(menu);
  const [newCat, setNewCat] = useState("");

  const addCategory = () => {
    const name = newCat.trim();
    if (!name || local.find(c => c.category === name)) return;
    setLocal([...local, { category: name, items: [] }]);
    setNewCat("");
  };

  const removeCategory = (cat) => {
    if (confirm(`Delete category "${cat}" and all its items?`)) {
      setLocal(local.filter(c => c.category !== cat));
    }
  };

  const renameCategory = (oldName, newName) => {
    if (!newName.trim()) return;
    setLocal(local.map(c => c.category === oldName ? { ...c, category: newName.trim() } : c));
  };

  const addItem = (cat, name, price) => {
    if (!name.trim() || isNaN(parseFloat(price))) return;
    setLocal(local.map(c => c.category === cat ? {
      ...c,
      items: [...c.items, { name: name.trim(), price: parseFloat(price) }]
    } : c));
  };

  const updateItem = (cat, idx, field, value) => {
    setLocal(local.map(c => c.category === cat ? {
      ...c,
      items: c.items.map((it, i) => i === idx ? {
        ...it,
        [field]: field === "price" ? (parseFloat(value) || 0) : value
      } : it)
    } : c));
  };

  const removeItem = (cat, idx) => {
    setLocal(local.map(c => c.category === cat ? {
      ...c,
      items: c.items.filter((_, i) => i !== idx)
    } : c));
  };

  const handleSave = () => {
    saveMenu(local);
    onClose();
  };

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Edit Menu</h2>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-3 py-2 text-slate-600 font-semibold">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold">Save</button>
        </div>
      </div>

      {local.map(cat => (
        <CategoryEditor
          key={cat.category}
          cat={cat}
          onRemove={() => removeCategory(cat.category)}
          onRename={(newName) => renameCategory(cat.category, newName)}
          onAddItem={(n, p) => addItem(cat.category, n, p)}
          onUpdateItem={(idx, field, val) => updateItem(cat.category, idx, field, val)}
          onRemoveItem={(idx) => removeItem(cat.category, idx)}
        />
      ))}

      <div className="mt-4 flex gap-2 items-center border-t border-slate-200 pt-4">
        <input
          type="text"
          placeholder="New category name"
          value={newCat}
          onChange={e => setNewCat(e.target.value)}
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
        />
        <button onClick={addCategory} className="px-4 py-2 bg-slate-800 text-white rounded-lg font-semibold flex items-center gap-1">
          <Plus size={16} /> Category
        </button>
      </div>
    </div>
  );
}

function CategoryEditor({ cat, onRemove, onRename, onAddItem, onUpdateItem, onRemoveItem }) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(cat.category);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");

  return (
    <div className="mb-4 border border-slate-200 rounded-lg p-3">
      <div className="flex justify-between items-center mb-3">
        {editingName ? (
          <div className="flex gap-2 flex-1">
            <input
              type="text"
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              className="flex-1 px-2 py-1 border border-slate-300 rounded"
            />
            <button onClick={() => { onRename(nameVal); setEditingName(false); }} className="text-green-600"><Check size={20} /></button>
            <button onClick={() => { setNameVal(cat.category); setEditingName(false); }} className="text-slate-400"><X size={20} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800">{cat.category}</h3>
            <button onClick={() => setEditingName(true)} className="text-slate-400"><Edit2 size={14} /></button>
          </div>
        )}
        <button onClick={onRemove} className="text-red-500"><Trash2 size={16} /></button>
      </div>

      {cat.items.map((item, idx) => (
        <div key={idx} className="flex gap-2 mb-2 items-center">
          <input
            type="text"
            value={item.name}
            onChange={e => onUpdateItem(idx, "name", e.target.value)}
            className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm"
          />
          <div className="flex items-center gap-1">
            <span className="text-slate-500 text-sm">{CURRENCY}</span>
            <input
              type="number"
              step="0.01"
              value={item.price}
              onChange={e => onUpdateItem(idx, "price", e.target.value)}
              className="w-20 px-2 py-1.5 border border-slate-300 rounded text-sm"
            />
          </div>
          <button onClick={() => onRemoveItem(idx)} className="text-red-400"><Trash2 size={14} /></button>
        </div>
      ))}

      <div className="flex gap-2 mt-2 pt-2 border-t border-slate-100">
        <input
          type="text"
          placeholder="Item name"
          value={newItemName}
          onChange={e => setNewItemName(e.target.value)}
          className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm"
        />
        <input
          type="number"
          step="0.01"
          placeholder="Price"
          value={newItemPrice}
          onChange={e => setNewItemPrice(e.target.value)}
          className="w-24 px-2 py-1.5 border border-slate-300 rounded text-sm"
        />
        <button
          onClick={() => {
            onAddItem(newItemName, newItemPrice);
            setNewItemName("");
            setNewItemPrice("");
          }}
          className="px-3 py-1.5 bg-slate-800 text-white rounded text-sm font-semibold"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// --- SUMMARY VIEW ---
function SummaryView({ salesLog, dayTotal, cashTotal, cardTotal, onBack, onReset }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Day Summary</h2>
        <button onClick={onBack} className="text-blue-600 font-semibold">Back to till</button>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-xs text-green-700 font-semibold">Total</div>
          <div className="text-xl font-bold text-green-900">{CURRENCY}{dayTotal.toFixed(2)}</div>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-xs text-blue-700 font-semibold">Cash</div>
          <div className="text-xl font-bold text-blue-900">{CURRENCY}{cashTotal.toFixed(2)}</div>
        </div>
        <div className="bg-purple-50 p-3 rounded-lg">
          <div className="text-xs text-purple-700 font-semibold">Card</div>
          <div className="text-xl font-bold text-purple-900">{CURRENCY}{cardTotal.toFixed(2)}</div>
        </div>
      </div>
      <div className="text-sm text-slate-600 mb-2">{salesLog.length} orders</div>
      <div className="max-h-96 overflow-y-auto border-t border-slate-200">
        {salesLog.length === 0 ? (
          <div className="text-center text-slate-400 py-8">No sales yet</div>
        ) : (
          salesLog.map(r => (
            <div key={r.id} className="py-2 border-b border-slate-100 text-sm">
              <div className="flex justify-between font-semibold">
                <span>{r.time} · {r.payment}</span>
                <span>{CURRENCY}{r.total.toFixed(2)}</span>
              </div>
              <div className="text-slate-500 text-xs">
                {r.items.map(i => `${i.qty}× ${i.name}`).join(", ")}
              </div>
            </div>
          ))
        )}
      </div>
      <button
        onClick={onReset}
        className="mt-4 w-full py-2 text-sm text-red-600 font-semibold border border-red-200 rounded-lg"
      >
        Reset day (clear all sales)
      </button>
    </div>
  );
}
