import { useState, useEffect } from "react";
import { Plus, Minus, Trash2, Receipt, TrendingUp, Settings, Edit2, Check, X, Delete, Download, ArrowLeftRight } from "lucide-react";

const CURRENCY = "£";
const MENU_KEY = "billing_menu_v1";
const SALES_KEY = "billing_sales_v1";
const ORDER_KEY = "billing_current_order_v1";
const CASH_KEY = "billing_current_cash_v1";
const DISCOUNT_KEY = "billing_current_discount_v1";
const DEFAULT_DISCOUNT = { mode: "amount", value: "" };

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
  const [discount, setDiscount] = useState(() => load(DISCOUNT_KEY, DEFAULT_DISCOUNT));
  const [salesLog, setSalesLog] = useState(() => load(SALES_KEY, []));
  const [activeCategory, setActiveCategory] = useState(() => {
    const m = load(MENU_KEY, DEFAULT_MENU);
    return m[0]?.category || "";
  });
  const [view, setView] = useState("till"); // till | summary | editor
  const [confirmCard, setConfirmCard] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [cardPart, setCardPart] = useState("");
  const [cashRecv, setCashRecv] = useState("");
  const [splitField, setSplitField] = useState("card"); // which field the split numpad edits

  // Persist as things change
  useEffect(() => { save(MENU_KEY, menu); }, [menu]);
  useEffect(() => { save(ORDER_KEY, order); }, [order]);
  useEffect(() => { save(CASH_KEY, cashGiven); }, [cashGiven]);
  useEffect(() => { save(DISCOUNT_KEY, discount); }, [discount]);
  useEffect(() => { save(SALES_KEY, salesLog); }, [salesLog]);

  // Order actions
  const addItem = (item, category) => {
    setOrder(prev => {
      const existing = prev.find(o => o.name === item.name);
      if (existing) return prev.map(o => o.name === item.name ? { ...o, qty: o.qty + 1 } : o);
      return [...prev, { ...item, category, qty: 1 }];
    });
  };
  const changeQty = (name, delta) => {
    setOrder(prev => prev.map(o => o.name === name ? { ...o, qty: o.qty + delta } : o).filter(o => o.qty > 0));
  };
  const removeItem = (name) => setOrder(prev => prev.filter(o => o.name !== name));
  const clearOrder = () => { setOrder([]); setCashGiven(""); setDiscount(DEFAULT_DISCOUNT); };

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

  // Generic numeric-keypad handler for a string state setter
  const pressInto = (setter, key) => {
    setter(prev => {
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

  const subtotal = order.reduce((sum, o) => sum + o.price * o.qty, 0);
  const discountValueNum = parseFloat(discount.value) || 0;
  const rawDiscountAmount = discount.mode === "percent" ? (subtotal * discountValueNum) / 100 : discountValueNum;
  const discountAmount = Math.min(Math.max(rawDiscountAmount, 0), subtotal);
  const total = subtotal - discountAmount;
  const cash = parseFloat(cashGiven) || 0;
  const change = cash - total;
  const canComplete = order.length > 0;
  const cardPartNum = Math.min(Math.max(parseFloat(cardPart) || 0, 0), total);
  const cashPartNum = Math.max(total - cardPartNum, 0);
  const cashRecvNum = parseFloat(cashRecv) || 0;
  const splitChange = cashRecvNum - cashPartNum; // +ve = change owed, -ve = short

  const completeOrder = (paymentType, split = null) => {
    const record = {
      id: Date.now(),
      time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      items: order,
      subtotal,
      discount: discountAmount > 0 ? { mode: discount.mode, value: discountValueNum, amount: discountAmount } : null,
      total,
      payment: paymentType,
      split, // { cash, card } when paymentType === "split"
      cashGiven: paymentType === "cash" ? cash : null,
      change: paymentType === "cash" ? change : null,
    };
    setSalesLog(prev => [record, ...prev]);
    clearOrder();
    setSplitMode(false);
    setCardPart("");
    setCashRecv("");
    setSplitField("card");
  };

  const dayTotal = salesLog.reduce((sum, r) => sum + r.total, 0);
  const cashTotal = salesLog.reduce((sum, r) => sum + (r.payment === "cash" ? r.total : r.payment === "split" ? (r.split?.cash || 0) : 0), 0);
  const cardTotal = salesLog.reduce((sum, r) => sum + (r.payment === "card" ? r.total : r.payment === "split" ? (r.split?.card || 0) : 0), 0);
  const discountsTotal = salesLog.reduce((sum, r) => sum + (r.discount?.amount || 0), 0);

  const switchPayment = (id) => {
    setSalesLog(prev => prev.map(r => {
      if (r.id !== id) return r;
      const next = r.payment === "cash" ? "card" : "cash";
      return { ...r, payment: next, cashGiven: null, change: null };
    }));
  };

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
            menu={menu}
            dayTotal={dayTotal}
            cashTotal={cashTotal}
            cardTotal={cardTotal}
            discountsTotal={discountsTotal}
            onSwitchPayment={switchPayment}
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
                      onClick={() => addItem(item, activeCategory)}
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

              {/* Discount */}
              {order.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex bg-slate-100 rounded-lg p-0.5">
                    <button
                      onClick={() => setDiscount(d => ({ ...d, mode: "amount" }))}
                      className={`px-3 py-1.5 rounded-md text-sm font-semibold ${discount.mode === "amount" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}
                    >
                      {CURRENCY}
                    </button>
                    <button
                      onClick={() => setDiscount(d => ({ ...d, mode: "percent" }))}
                      className={`px-3 py-1.5 rounded-md text-sm font-semibold ${discount.mode === "percent" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}
                    >
                      %
                    </button>
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="Discount"
                    value={discount.value}
                    onChange={e => setDiscount(d => ({ ...d, value: e.target.value }))}
                    className="flex-1 min-w-0 px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                  />
                  {discountValueNum > 0 && (
                    <button
                      onClick={() => setDiscount(d => ({ ...d, value: "" }))}
                      className="text-slate-400 shrink-0"
                      aria-label="Clear discount"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              )}

              {/* Totals */}
              <div className="bg-slate-800 text-white rounded-lg p-3 mb-2">
                {discountAmount > 0 && (
                  <>
                    <div className="flex justify-between items-center text-sm text-slate-300">
                      <span>Subtotal</span>
                      <span>{CURRENCY}{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-amber-400 mb-1">
                      <span>Discount{discount.mode === "percent" ? ` (${discountValueNum}%)` : ""}</span>
                      <span>-{CURRENCY}{discountAmount.toFixed(2)}</span>
                    </div>
                  </>
                )}
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
                  onClick={() => setConfirmCard(true)}
                  disabled={!canComplete}
                  className="py-4 bg-blue-600 text-white font-bold text-lg rounded-xl disabled:bg-slate-300 active:bg-blue-700"
                >
                  Paid Card
                </button>
              </div>
              <button
                onClick={() => { setCardPart(""); setCashRecv(""); setSplitField("card"); setSplitMode(true); }}
                disabled={!canComplete}
                className="mt-2 w-full py-3 bg-slate-700 text-white font-bold rounded-xl disabled:bg-slate-300 active:bg-slate-800"
              >
                Split cash + card
              </button>
            </div>
          </div>
        )}

        {/* Card approval confirmation */}
        {confirmCard && (
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setConfirmCard(false)}
          >
            <div
              className="bg-white rounded-2xl p-6 max-w-sm w-full text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-sm font-semibold text-slate-500 mb-1">Card payment</div>
              <div className="text-3xl font-bold text-slate-900 mb-4">{CURRENCY}{total.toFixed(2)}</div>
              <p className="text-slate-600 text-sm mb-5">Did the card payment go through?</p>
              <div className="grid gap-2">
                <button
                  onClick={() => { completeOrder("card"); setConfirmCard(false); }}
                  className="py-3 bg-green-600 text-white font-bold rounded-xl active:bg-green-700"
                >
                  Yes — card approved
                </button>
                <button
                  onClick={() => setConfirmCard(false)}
                  className="py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl"
                >
                  Declined — take cash instead
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Split payment */}
        {splitMode && (
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setSplitMode(false)}
          >
            <div
              className="bg-white rounded-2xl p-5 max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center mb-3">
                <div className="text-sm font-semibold text-slate-500">Split payment — Total</div>
                <div className="text-3xl font-bold text-slate-900">{CURRENCY}{total.toFixed(2)}</div>
              </div>

              {/* Tap a field, then use the pad below */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  onClick={() => setSplitField("card")}
                  className={`text-left p-3 rounded-lg border-2 ${splitField === "card" ? "border-purple-500 bg-purple-50" : "border-slate-200 bg-white"}`}
                >
                  <div className="text-xs font-semibold text-purple-700">On card</div>
                  <div className="text-xl font-bold text-slate-900">{CURRENCY}{cardPartNum.toFixed(2)}</div>
                </button>
                <div className="p-3 rounded-lg border-2 border-slate-200 bg-slate-50">
                  <div className="text-xs font-semibold text-blue-700">Cash due</div>
                  <div className="text-xl font-bold text-slate-900">{CURRENCY}{cashPartNum.toFixed(2)}</div>
                </div>
              </div>

              <button
                onClick={() => setSplitField("cash")}
                className={`w-full text-left p-3 rounded-lg border-2 mb-2 ${splitField === "cash" ? "border-green-500 bg-green-50" : "border-slate-200 bg-white"}`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xs font-semibold text-slate-600">Cash received (optional)</div>
                    <div className="text-xl font-bold text-slate-900">{CURRENCY}{cashRecvNum.toFixed(2)}</div>
                  </div>
                  {cashRecvNum > 0 && (
                    <div className="text-right">
                      <div className={`text-xs font-semibold ${splitChange >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {splitChange >= 0 ? "Change" : "Short"}
                      </div>
                      <div className={`text-xl font-bold ${splitChange >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {CURRENCY}{Math.abs(splitChange).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              </button>

              {/* Shared number pad */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {["7","8","9","4","5","6","1","2","3",".","0","back"].map(k => (
                  <button
                    key={k}
                    onClick={() => pressInto(splitField === "card" ? setCardPart : setCashRecv, k)}
                    className="h-12 bg-slate-100 active:bg-slate-300 rounded-xl text-2xl font-bold text-slate-800 flex items-center justify-center select-none"
                  >
                    {k === "back" ? <Delete size={22} /> : k}
                  </button>
                ))}
              </div>

              <div className="grid gap-2">
                <button
                  onClick={() => completeOrder("split", {
                    cash: cashPartNum,
                    card: cardPartNum,
                    cashGiven: cashRecvNum > 0 ? cashRecvNum : null,
                    change: cashRecvNum > 0 ? splitChange : null,
                  })}
                  disabled={cardPartNum <= 0 || cardPartNum >= total || (cashRecvNum > 0 && splitChange < 0)}
                  className="py-3 bg-green-600 text-white font-bold rounded-xl disabled:bg-slate-300 active:bg-green-700"
                >
                  Card approved — record split
                </button>
                <button
                  onClick={() => setSplitMode(false)}
                  className="py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl"
                >
                  Cancel
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
function SummaryView({ salesLog, menu, dayTotal, cashTotal, cardTotal, discountsTotal, onSwitchPayment, onBack, onReset }) {
  const [breakdown, setBreakdown] = useState("product"); // product | category | orders

  // Map item name -> category from the current menu (fallback for older sales)
  const nameToCategory = {};
  (menu || []).forEach(c => c.items.forEach(it => { nameToCategory[it.name] = c.category; }));
  const categoryOf = (item) => item.category || nameToCategory[item.name] || "Uncategorised";

  // Aggregate sold line items across all orders
  const productMap = {};
  const categoryMap = {};
  salesLog.forEach(r => {
    r.items.forEach(i => {
      const revenue = i.price * i.qty;
      const cat = categoryOf(i);
      if (!productMap[i.name]) productMap[i.name] = { name: i.name, category: cat, qty: 0, revenue: 0 };
      productMap[i.name].qty += i.qty;
      productMap[i.name].revenue += revenue;
      if (!categoryMap[cat]) categoryMap[cat] = { name: cat, qty: 0, revenue: 0 };
      categoryMap[cat].qty += i.qty;
      categoryMap[cat].revenue += revenue;
    });
  });
  const products = Object.values(productMap).sort((a, b) => b.revenue - a.revenue);
  const categories = Object.values(categoryMap).sort((a, b) => b.revenue - a.revenue);
  const grossSales = products.reduce((s, p) => s + p.revenue, 0);
  const rows = breakdown === "category" ? categories : products;

  const downloadCsv = () => {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const money = (n) => n.toFixed(2);
    const dateStr = new Date().toLocaleDateString("en-GB");
    const lines = [];
    lines.push(`Event Till - Day Summary,${dateStr}`);
    lines.push("");
    lines.push("Totals");
    lines.push(`Total,${money(dayTotal)}`);
    lines.push(`Cash,${money(cashTotal)}`);
    lines.push(`Card,${money(cardTotal)}`);
    lines.push(`Discounts,${money(discountsTotal)}`);
    lines.push(`Orders,${salesLog.length}`);
    lines.push("");
    lines.push("Sales by product");
    lines.push("Product,Category,Qty,Revenue");
    products.forEach(p => lines.push([esc(p.name), esc(p.category), p.qty, money(p.revenue)].join(",")));
    lines.push(`Gross,,${products.reduce((s, p) => s + p.qty, 0)},${money(grossSales)}`);
    lines.push("");
    lines.push("Sales by category");
    lines.push("Category,Qty,Revenue");
    categories.forEach(c => lines.push([esc(c.name), c.qty, money(c.revenue)].join(",")));
    lines.push(`Gross,,${money(grossSales)}`);

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `event-till-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    const dateStr = new Date().toLocaleDateString("en-GB");
    const money = (n) => `${CURRENCY}${n.toFixed(2)}`;
    const esc = (s) => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const productRows = products.map(p =>
      `<tr><td>${esc(p.name)}</td><td class="muted">${esc(p.category)}</td><td class="num">${p.qty}</td><td class="num">${money(p.revenue)}</td></tr>`
    ).join("");
    const categoryRows = categories.map(c =>
      `<tr><td>${esc(c.name)}</td><td class="num">${c.qty}</td><td class="num">${money(c.revenue)}</td></tr>`
    ).join("");
    const totalQty = products.reduce((s, p) => s + p.qty, 0);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Day Summary ${dateStr}</title>
      <style>
        body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1e293b;padding:24px;max-width:720px;margin:auto}
        h1{font-size:22px;margin:0 0 2px} .date{color:#64748b;margin-bottom:20px}
        h2{font-size:15px;margin:22px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:4px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #f1f5f9}
        th{color:#64748b;font-size:11px;text-transform:uppercase}
        .num{text-align:right} .muted{color:#94a3b8;font-size:12px}
        .totals{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px}
        .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 14px}
        .card .lbl{font-size:11px;color:#64748b} .card .val{font-size:18px;font-weight:700}
        tfoot td{font-weight:700;border-top:2px solid #e2e8f0}
        @media print{body{padding:0}}
      </style></head><body>
      <h1>Event Till — Day Summary</h1>
      <div class="date">${dateStr}</div>
      <div class="totals">
        <div class="card"><div class="lbl">Total</div><div class="val">${money(dayTotal)}</div></div>
        <div class="card"><div class="lbl">Cash</div><div class="val">${money(cashTotal)}</div></div>
        <div class="card"><div class="lbl">Card</div><div class="val">${money(cardTotal)}</div></div>
        <div class="card"><div class="lbl">Discounts</div><div class="val">${money(discountsTotal)}</div></div>
        <div class="card"><div class="lbl">Orders</div><div class="val">${salesLog.length}</div></div>
      </div>
      <h2>Sales by product</h2>
      <table><thead><tr><th>Product</th><th>Category</th><th class="num">Qty</th><th class="num">Revenue</th></tr></thead>
        <tbody>${productRows || '<tr><td colspan="4" class="muted">No sales</td></tr>'}</tbody>
        <tfoot><tr><td>Gross</td><td></td><td class="num">${totalQty}</td><td class="num">${money(grossSales)}</td></tr></tfoot>
      </table>
      <h2>Sales by category</h2>
      <table><thead><tr><th>Category</th><th class="num">Qty</th><th class="num">Revenue</th></tr></thead>
        <tbody>${categoryRows || '<tr><td colspan="3" class="muted">No sales</td></tr>'}</tbody>
        <tfoot><tr><td>Gross</td><td class="num">${totalQty}</td><td class="num">${money(grossSales)}</td></tr></tfoot>
      </table>
      <script>window.onload=function(){window.print();}<\/script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { alert("Please allow pop-ups to download the PDF."); return; }
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Day Summary</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadCsv}
            disabled={salesLog.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-sm font-semibold disabled:bg-slate-300"
          >
            <Download size={16} /> CSV
          </button>
          <button
            onClick={downloadPdf}
            disabled={salesLog.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-sm font-semibold disabled:bg-slate-300"
          >
            <Download size={16} /> PDF
          </button>
          <button onClick={onBack} className="text-blue-600 font-semibold ml-1">Back to till</button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
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
        <div className="bg-amber-50 p-3 rounded-lg">
          <div className="text-xs text-amber-700 font-semibold">Discounts</div>
          <div className="text-xl font-bold text-amber-900">{CURRENCY}{discountsTotal.toFixed(2)}</div>
        </div>
      </div>

      {/* Breakdown toggle */}
      <div className="flex bg-slate-100 rounded-lg p-0.5 mb-3 w-fit">
        {[["product", "By product"], ["category", "By category"], ["orders", "Orders"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setBreakdown(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold ${breakdown === key ? "bg-white shadow text-slate-800" : "text-slate-500"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {breakdown !== "orders" ? (
        <div className="max-h-96 overflow-y-auto border-t border-slate-200">
          {rows.length === 0 ? (
            <div className="text-center text-slate-400 py-8">No sales yet</div>
          ) : (
            <>
              <div className="flex justify-between text-xs font-semibold text-slate-400 uppercase py-2 border-b border-slate-100">
                <span>{breakdown === "category" ? "Category" : "Product"}</span>
                <span className="flex gap-6"><span className="w-12 text-right">Qty</span><span className="w-20 text-right">Revenue</span></span>
              </div>
              {rows.map(row => (
                <div key={row.name} className="flex justify-between items-center py-2 border-b border-slate-100 text-sm">
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-slate-800 truncate">{row.name}</div>
                    {breakdown === "product" && (
                      <div className="text-xs text-slate-400">{row.category}</div>
                    )}
                  </div>
                  <div className="flex gap-6 shrink-0">
                    <span className="w-12 text-right font-medium text-slate-600">{row.qty}</span>
                    <span className="w-20 text-right font-bold text-slate-800">{CURRENCY}{row.revenue.toFixed(2)}</span>
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center py-2 text-sm font-bold border-t-2 border-slate-200">
                <span>Gross sales</span>
                <span className="flex gap-6">
                  <span className="w-12 text-right">{rows.reduce((s, r) => s + r.qty, 0)}</span>
                  <span className="w-20 text-right">{CURRENCY}{grossSales.toFixed(2)}</span>
                </span>
              </div>
            </>
          )}
        </div>
      ) : (
      <>
      <div className="text-sm text-slate-600 mb-2">{salesLog.length} orders</div>
      <div className="max-h-96 overflow-y-auto border-t border-slate-200">
        {salesLog.length === 0 ? (
          <div className="text-center text-slate-400 py-8">No sales yet</div>
        ) : (
          salesLog.map(r => (
            <div key={r.id} className="py-2 border-b border-slate-100 text-sm">
              <div className="flex justify-between items-center font-semibold">
                <span className="flex items-center gap-2">
                  <span>{r.time}</span>
                  {r.payment === "split" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                      split
                    </span>
                  ) : (
                    <button
                      onClick={() => onSwitchPayment(r.id)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${r.payment === "cash" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}
                      title="Tap to switch cash/card"
                    >
                      {r.payment}
                      <ArrowLeftRight size={11} />
                    </button>
                  )}
                </span>
                <span>{CURRENCY}{r.total.toFixed(2)}</span>
              </div>
              {r.payment === "split" && r.split && (
                <div className="text-xs text-slate-500">
                  {CURRENCY}{(r.split.card || 0).toFixed(2)} card + {CURRENCY}{(r.split.cash || 0).toFixed(2)} cash
                  {r.split.change > 0 && ` · change ${CURRENCY}${r.split.change.toFixed(2)}`}
                </div>
              )}
              <div className="text-slate-500 text-xs">
                {r.items.map(i => `${i.qty}× ${i.name}`).join(", ")}
              </div>
              {r.discount && (
                <div className="text-amber-600 text-xs font-medium">
                  Discount{r.discount.mode === "percent" ? ` (${r.discount.value}%)` : ""}: -{CURRENCY}{r.discount.amount.toFixed(2)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      </>
      )}
      <button
        onClick={onReset}
        className="mt-4 w-full py-2 text-sm text-red-600 font-semibold border border-red-200 rounded-lg"
      >
        Reset day (clear all sales)
      </button>
    </div>
  );
}
