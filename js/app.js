/* =========================================================
   app.js — Application logic (auth, routing, all pages)
   Everything runs client-side. No server. No internet.
   ========================================================= */

let CURRENT_USER = null;
let CART = []; // current bill in progress
let GST_MODE = "exclusive"; // "exclusive": GST added on top of Selling Price. "inclusive": Selling Price already includes GST.

/**
 * Split a cart into subtotal (pre-tax) and GST, consistently, for both the
 * live billing screen and the saved invoice — so what's shown while billing
 * always matches what gets stored and printed.
 */
function calcCartTotals(cart, discount = 0) {
  let subtotal = 0, gst = 0;
  for (const i of cart) {
    const lineTotal = i.price * i.qty;
    if (GST_MODE === "inclusive") {
      const base = lineTotal / (1 + (i.gst || 0) / 100);
      subtotal += base;
      gst += lineTotal - base;
    } else {
      subtotal += lineTotal;
      gst += lineTotal * (i.gst || 0) / 100;
    }
  }
  const total = Math.max(0, subtotal + gst - discount);
  return { subtotal, gst, total };
}

/* ---------------------------------------------------------
   BOOTSTRAP
--------------------------------------------------------- */
window.addEventListener("DOMContentLoaded", async () => {
  await openDB();
  await seedDefaults();
  const theme = await getSetting("theme", "light");
  document.documentElement.setAttribute("data-theme", theme);
  document.getElementById("shopNameLabel").textContent = await getSetting("shopName", "Dress Shop");

  document.getElementById("loginPassword").addEventListener("keydown", e => {
    if (e.key === "Enter") handleLogin();
  });

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => navigate(btn.dataset.page));
  });
});

async function seedDefaults() {
  const userCount = await DB.count("users");
  if (userCount === 0) {
    await DB.add("users", { username: "admin", password: await hashPassword("admin123"), role: "owner", name: "Owner" });
  }
  const shopName = await getSetting("shopName");
  if (!shopName) await setSetting("shopName", "Dress Shop");
  const gst = await getSetting("defaultGST");
  if (gst === null) await setSetting("defaultGST", 5);
  const invCounter = await getSetting("invoiceCounter");
  if (invCounter === null) await setSetting("invoiceCounter", 1000);
}

/* ---------------------------------------------------------
   AUTH
--------------------------------------------------------- */
// Which pages each role may open. Enforced both in the sidebar (hiding buttons)
// and inside navigate() itself, so a role can't reach a page it isn't allowed to
// see just because a button happened to be visible or a page was called directly.
const ROLE_PAGES = {
  owner:   ["dashboard", "billing", "products", "barcodePrint", "customers", "reports", "invoices", "users", "settings"],
  manager: ["dashboard", "billing", "products", "barcodePrint", "customers", "reports", "invoices", "settings"],
  cashier: ["billing"]
};

function canAccess(page) {
  if (!CURRENT_USER) return false;
  const allowed = ROLE_PAGES[CURRENT_USER.role] || [];
  return allowed.includes(page);
}

async function handleLogin() {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  const users = await DB.getAll("users");
  const user = users.find(u => u.username === username);

  if (!user) {
    document.getElementById("loginError").textContent = "Invalid username or password.";
    return;
  }

  const enteredHash = await hashPassword(password);
  let ok = user.password === enteredHash;

  // One-time migration: older installs of this app stored passwords in plain
  // text. If we find one, verify against the plain value, then silently
  // upgrade it to a proper hash so it's never stored in plain text again.
  if (!ok && user.password === password) {
    ok = true;
    user.password = enteredHash;
    await DB.put("users", user);
  }

  if (!ok) {
    document.getElementById("loginError").textContent = "Invalid username or password.";
    return;
  }

  CURRENT_USER = user;
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");
  document.getElementById("whoamiLabel").textContent = `${user.name || user.username} (${user.role})`;

  const allowedPages = ROLE_PAGES[user.role] || [];
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.style.display = allowedPages.includes(btn.dataset.page) ? "" : "none";
  });

  navigate(allowedPages[0] || "billing");
}

function handleLogout() {
  CURRENT_USER = null;
  CART = [];
  document.getElementById("appShell").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("loginUsername").value = "";
  document.getElementById("loginPassword").value = "";
}

async function toggleDarkMode() {
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  await setSetting("theme", next);
}

/* ---------------------------------------------------------
   ROUTER
--------------------------------------------------------- */
const PAGES = {
  dashboard: renderDashboard,
  billing: renderBilling,
  products: renderProducts,
  barcodePrint: renderBarcodePrint,
  customers: renderCustomers,
  reports: renderReports,
  invoices: renderInvoiceSearch,
  users: renderUsers,
  settings: renderSettings
};

function navigate(page) {
  if (!canAccess(page)) {
    const content = document.getElementById("content");
    if (content) content.innerHTML = "<p>🚫 Access denied. Your role doesn't have permission to view this page.</p>";
    return;
  }
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.page === page));
  const fn = PAGES[page];
  if (fn) fn();
}

function money(n) {
  return "₹" + Number(n || 0).toFixed(2);
}

/* ---------------------------------------------------------
   DASHBOARD
--------------------------------------------------------- */
async function renderDashboard() {
  const content = document.getElementById("content");
  const sales = await DB.getAll("sales");
  const today = new Date().toDateString();
  const todaySales = sales.filter(s => new Date(s.date).toDateString() === today && s.status !== "returned");

  const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);
  const todayProfit = todaySales.reduce((sum, s) => sum + (s.profit || 0), 0);

  const variants = await DB.getAll("variants");
  const lowStock = variants.filter(v => v.stock <= (v.lowStockAlert || 3));

  content.innerHTML = `
    <h2>📊 Dashboard</h2>
    <div class="grid cols-4">
      <div class="stat-card"><div class="label">Today's Sales</div><div class="value">${money(todayTotal)}</div></div>
      <div class="stat-card"><div class="label">Today's Bills</div><div class="value">${todaySales.length} Bills</div></div>
      <div class="stat-card"><div class="label">Today's Profit</div><div class="value">${money(todayProfit)}</div></div>
      <div class="stat-card"><div class="label">Low Stock Items</div><div class="value">${lowStock.length}</div></div>
    </div>
    <br>
    <div class="grid cols-2">
      <div class="card">
        <h3>⚠️ Low Stock Alerts</h3>
        <table>
          <tr><th>Product</th><th>Size</th><th>Color</th><th>Stock</th></tr>
          ${lowStock.slice(0, 10).map(v => `
            <tr><td>${v.productName}</td><td>${v.size}</td><td>${v.color}</td>
            <td><span class="badge low">${v.stock} left</span></td></tr>`).join("") || "<tr><td colspan=4 class='muted'>No low stock items 🎉</td></tr>"}
        </table>
      </div>
      <div class="card">
        <h3>🧾 Recent Bills</h3>
        <table>
          <tr><th>Invoice</th><th>Time</th><th>Total</th></tr>
          ${sales.slice(-8).reverse().map(s => `
            <tr><td>${s.invoiceNo}</td><td>${new Date(s.date).toLocaleTimeString()}</td><td>${money(s.total)}</td></tr>`).join("") || "<tr><td colspan=3 class='muted'>No sales yet</td></tr>"}
        </table>
      </div>
    </div>
  `;
}

/* ---------------------------------------------------------
   PRODUCT MANAGEMENT (each size/color combo = 1 variant = 1 barcode)
--------------------------------------------------------- */
async function renderProducts() {
  const content = document.getElementById("content");
  const variants = await DB.getAll("variants");

  content.innerHTML = `
    <div class="flex between">
      <h2>👕 Products</h2>
      <button class="btn primary" onclick="openProductModal()">+ Add Product / Variant</button>
    </div>
    <div class="card">
      <input type="text" placeholder="🔍 Search by name, barcode, category..." id="productSearch" oninput="filterProductTable()">
      <br><br>
      <table id="productTable">
        <tr><th>Barcode</th><th>Product</th><th>Category</th><th>Size</th><th>Color</th><th>Price</th><th>Stock</th><th></th></tr>
        ${variants.map(v => productRow(v)).join("") || "<tr><td colspan=8 class='muted'>No products yet. Click 'Add Product / Variant'.</td></tr>"}
      </table>
    </div>
  `;
}

function productRow(v) {
  return `<tr data-search="${(v.productName + v.category + v.barcode + v.brand).toLowerCase()}">
    <td class="tag">${v.barcode}</td>
    <td>${v.productName}</td>
    <td>${v.category}</td>
    <td>${v.size}</td>
    <td>${v.color}</td>
    <td>${money(v.sellingPrice)}</td>
    <td>${v.stock <= (v.lowStockAlert || 3) ? `<span class="badge low">${v.stock}</span>` : `<span class="badge ok">${v.stock}</span>`}</td>
    <td>
      <button class="btn small" onclick="openProductModal('${v.barcode}')">Edit</button>
      <button class="btn small" onclick="printSingleLabel('${v.barcode}')">🏷️</button>
      <button class="btn small danger" onclick="deleteVariant('${v.barcode}')">Del</button>
    </td>
  </tr>`;
}

function filterProductTable() {
  const q = document.getElementById("productSearch").value.toLowerCase();
  document.querySelectorAll("#productTable tr[data-search]").forEach(row => {
    row.style.display = row.dataset.search.includes(q) ? "" : "none";
  });
}

async function openProductModal(barcode) {
  const editing = !!barcode;
  const v = editing ? await DB.get("variants", barcode) : {};
  const suppliers = await DB.getAll("suppliers");
  const gstMode = await getSetting("gstMode", "exclusive");

  const html = `
    <div class="modal-bg" id="productModalBg">
      <div class="modal">
        <h3>${editing ? "Edit Variant" : "Add Product / Variant"}</h3>
        <div class="grid cols-2">
          <div class="field"><label>Product Name</label><input id="f_name" value="${v.productName || ""}"></div>
          <div class="field"><label>Category</label>
            <select id="f_category">
              ${["Shirt","T-Shirt","Jeans","Saree","Kurti","Dress","Trousers","Jacket","Other"].map(c =>
                `<option ${v.category===c?"selected":""}>${c}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label>Brand</label><input id="f_brand" value="${v.brand || ""}"></div>
          <div class="field"><label>Size</label><input id="f_size" value="${v.size || ""}" placeholder="S, M, L, 32..."></div>
          <div class="field"><label>Color</label><input id="f_color" value="${v.color || ""}"></div>
          <div class="field"><label>Supplier</label>
            <input id="f_supplier" list="supplierList" value="${v.supplier || ""}">
            <datalist id="supplierList">${suppliers.map(s => `<option value="${s.name}">`).join("")}</datalist>
          </div>
          <div class="field"><label>MRP</label><input id="f_mrp" type="number" value="${v.mrp || ""}"></div>
          <div class="field"><label>Selling Price ${gstMode === "inclusive" ? "(incl. GST)" : "(excl. GST)"}</label><input id="f_sp" type="number" value="${v.sellingPrice || ""}"></div>
          <div class="field"><label>Purchase Price</label><input id="f_pp" type="number" value="${v.purchasePrice || ""}"></div>
          <div class="field"><label>GST %</label><input id="f_gst" type="number" value="${v.gst ?? await getSetting('defaultGST',5)}"></div>
          <div class="field"><label>Stock Quantity</label><input id="f_stock" type="number" value="${v.stock ?? 0}"></div>
          <div class="field"><label>Low Stock Alert Below</label><input id="f_low" type="number" value="${v.lowStockAlert ?? 3}"></div>
        </div>
        ${editing ? `<p class="muted">Barcode: <b>${v.barcode}</b> (fixed, auto-generated)</p>` : `<p class="muted">A unique barcode will be generated automatically for this size/color.</p>`}
        <div class="flex" style="margin-top:12px;">
          <button class="btn primary" onclick="saveProduct(${editing ? `'${v.barcode}'` : "null"})">Save</button>
          <button class="btn" onclick="closeModal('productModalBg')">Cancel</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

async function saveProduct(existingBarcode) {
  const supplierName = document.getElementById("f_supplier").value.trim();
  if (supplierName) {
    const suppliers = await DB.getAll("suppliers");
    if (!suppliers.find(s => s.name === supplierName)) {
      await DB.add("suppliers", { name: supplierName });
    }
  }

  const variant = {
    barcode: existingBarcode || await nextBarcodeNumber(),
    productName: document.getElementById("f_name").value.trim(),
    category: document.getElementById("f_category").value,
    brand: document.getElementById("f_brand").value.trim(),
    size: document.getElementById("f_size").value.trim(),
    color: document.getElementById("f_color").value.trim(),
    supplier: supplierName,
    mrp: parseFloat(document.getElementById("f_mrp").value) || 0,
    sellingPrice: parseFloat(document.getElementById("f_sp").value) || 0,
    purchasePrice: parseFloat(document.getElementById("f_pp").value) || 0,
    gst: parseFloat(document.getElementById("f_gst").value) || 0,
    stock: parseInt(document.getElementById("f_stock").value) || 0,
    lowStockAlert: parseInt(document.getElementById("f_low").value) || 3
  };

  if (!variant.productName) { alert("Product name is required."); return; }

  await DB.put("variants", variant);
  closeModal("productModalBg");
  renderProducts();
}

async function deleteVariant(barcode) {
  if (!confirm("Delete this product variant? This cannot be undone.")) return;
  await DB.delete("variants", barcode);
  renderProducts();
}

/* ---------------------------------------------------------
   BARCODE LABEL PRINTING
--------------------------------------------------------- */
async function renderBarcodePrint() {
  const content = document.getElementById("content");
  const variants = await DB.getAll("variants");
  const shopName = await getSetting("shopName", "Dress Shop");

  content.innerHTML = `
    <h2>🏷️ Barcode Label Printing</h2>
    <div class="card">
      <p class="muted">Select items and choose how many copies of each label to print, then click Print.</p>
      <table>
        <tr><th><input type="checkbox" onclick="toggleAllLabels(this)"></th><th>Barcode</th><th>Product</th><th>Size/Color</th><th>Price</th><th>Copies</th></tr>
        ${variants.map(v => `
          <tr>
            <td><input type="checkbox" class="labelCheck" value="${v.barcode}"></td>
            <td class="tag">${v.barcode}</td>
            <td>${v.productName}</td>
            <td>${v.size} / ${v.color}</td>
            <td>${money(v.sellingPrice)}</td>
            <td><input type="number" min="1" value="1" style="width:70px" class="labelQty" data-barcode="${v.barcode}"></td>
          </tr>`).join("") || "<tr><td colspan=6 class='muted'>No products yet.</td></tr>"}
      </table>
      <br>
      <div class="flex">
        <button class="btn primary" onclick="printSelectedLabels()">🖨️ Print Selected Labels</button>
        <button class="btn accent" onclick="printAllStockLabels()">🖨️ Print Entire Stock</button>
      </div>
    </div>
  `;
}

function toggleAllLabels(master) {
  document.querySelectorAll(".labelCheck").forEach(cb => cb.checked = master.checked);
}

async function printSelectedLabels() {
  const barcodes = [...document.querySelectorAll(".labelCheck:checked")].map(cb => cb.value);
  if (!barcodes.length) { alert("Select at least one product."); return; }
  const jobs = [];
  for (const bc of barcodes) {
    const qty = parseInt(document.querySelector(`.labelQty[data-barcode="${bc}"]`).value) || 1;
    jobs.push({ barcode: bc, qty });
  }
  await printLabels(jobs);
}

async function printAllStockLabels() {
  const variants = await DB.getAll("variants");
  const jobs = variants.map(v => ({ barcode: v.barcode, qty: v.stock > 0 ? v.stock : 1 }));
  await printLabels(jobs);
}

async function printSingleLabel(barcode) {
  await printLabels([{ barcode, qty: 1 }]);
}

async function printLabels(jobs) {
  const shopName = await getSetting("shopName", "Dress Shop");
  let html = "";
  for (const job of jobs) {
    const v = await DB.get("variants", job.barcode);
    if (!v) continue;
    const svg = renderBarcodeSVG(v.barcode, { barWidth: 1.6, height: 40 });
    for (let i = 0; i < job.qty; i++) {
      html += `<div class="print-label">
        <div style="font-weight:bold;font-size:12px;">${shopName}</div>
        <div style="font-size:12px;">${v.productName}</div>
        <div style="font-size:11px;">${v.size} ${v.color ? "· " + v.color : ""}</div>
        ${svg}
        <div style="font-weight:bold;">${money(v.sellingPrice)}</div>
      </div>`;
    }
  }
  const printArea = document.getElementById("printArea");
  printArea.innerHTML = html;
  printArea.classList.remove("hidden");
  window.print();
  printArea.classList.add("hidden");
}

/* ---------------------------------------------------------
   BILLING SCREEN
--------------------------------------------------------- */
async function renderBilling() {
  const content = document.getElementById("content");
  const customers = await DB.getAll("customers");
  GST_MODE = await getSetting("gstMode", "exclusive");

  content.innerHTML = `
    <h2>🧾 Billing</h2>
    <div class="grid cols-2">
      <div class="card">
        <label>Scan Barcode (or type + Enter)</label>
        <input id="scanInput" class="scan-input" placeholder="Scan or type barcode, press Enter" autofocus>
        <br><br>
        <label>Customer (optional)</label>
        <select id="billCustomer">
          <option value="">Walk-in Customer</option>
          ${customers.map(c => `<option value="${c.id}">${c.name} (${c.phone})</option>`).join("")}
        </select>
        <br><br>
        <table>
          <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th><th></th></tr>
          <tbody id="cartRows"></tbody>
        </table>
      </div>
      <div class="card">
        <h3>Bill Summary</h3>
        <p class="muted small">Pricing mode: ${GST_MODE === "inclusive" ? "Selling price includes GST" : "GST added on top of selling price"} (change in Settings)</p>
        <div class="bill-line"><span>Subtotal</span><span id="sumSubtotal">₹0.00</span></div>
        <div class="bill-line"><span>GST</span><span id="sumGST">₹0.00</span></div>
        <div class="field" style="margin-top:10px;">
          <label>Discount (₹)${CURRENT_USER.role === "cashier" ? ' <span class="muted">(cashiers cannot apply discounts)</span>' : ""}</label>
          <input id="discountInput" type="number" value="0" oninput="renderCart()" ${CURRENT_USER.role === "cashier" ? "readonly" : ""}>
        </div>
        <div class="total-row"><span>Grand Total</span><span id="sumTotal">₹0.00</span></div>

        <label>Payment Method</label>
        <select id="paymentMethod" onchange="togglePaymentFields()">
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="card">Card</option>
          <option value="split">Split Payment</option>
          <option value="credit">Credit Customer</option>
        </select>
        <div id="splitFields" class="hidden">
          <div class="grid cols-2">
            <div class="field"><label>Cash Amount</label><input id="splitCash" type="number" value="0"></div>
            <div class="field"><label>UPI/Card Amount</label><input id="splitOther" type="number" value="0"></div>
          </div>
        </div>

        <button class="btn primary wide" style="margin-top:14px;" onclick="checkout()">✅ Complete Sale &amp; Print</button>
        <button class="btn wide" style="margin-top:8px;" onclick="clearCart()">Clear Bill</button>
      </div>
    </div>
  `;

  const scanInput = document.getElementById("scanInput");
  scanInput.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      await addToCartByBarcode(scanInput.value.trim());
      scanInput.value = "";
    }
  });
  scanInput.focus();
  renderCart();
}

function togglePaymentFields() {
  const method = document.getElementById("paymentMethod").value;
  document.getElementById("splitFields").classList.toggle("hidden", method !== "split");
}

async function addToCartByBarcode(barcode) {
  if (!barcode) return;
  const v = await DB.get("variants", barcode);
  if (!v) { alert("No product found for barcode: " + barcode); return; }
  if (v.stock <= 0) { alert(`${v.productName} (${v.size}/${v.color}) is out of stock.`); return; }

  const existing = CART.find(i => i.barcode === barcode);
  if (existing) {
    if (existing.qty + 1 > v.stock) { alert("Not enough stock."); return; }
    existing.qty += 1;
  } else {
    CART.push({ barcode: v.barcode, name: v.productName, size: v.size, color: v.color,
      price: v.sellingPrice, gst: v.gst, qty: 1, purchasePrice: v.purchasePrice });
  }
  renderCart();
}

function changeQty(barcode, delta) {
  const item = CART.find(i => i.barcode === barcode);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) CART = CART.filter(i => i.barcode !== barcode);
  renderCart();
}

function removeFromCart(barcode) {
  CART = CART.filter(i => i.barcode !== barcode);
  renderCart();
}

function clearCart() {
  CART = [];
  renderCart();
}

function renderCart() {
  const rows = document.getElementById("cartRows");
  if (!rows) return;
  rows.innerHTML = CART.map(i => `
    <tr>
      <td>${i.name} <span class="muted">(${i.size}/${i.color})</span></td>
      <td>
        <button class="btn small" onclick="changeQty('${i.barcode}',-1)">-</button>
        ${i.qty}
        <button class="btn small" onclick="changeQty('${i.barcode}',1)">+</button>
      </td>
      <td>${money(i.price)}</td>
      <td>${money(i.price * i.qty)}</td>
      <td><button class="btn small danger" onclick="removeFromCart('${i.barcode}')">✕</button></td>
    </tr>
  `).join("") || `<tr><td colspan=5 class="muted">Scan a barcode to begin...</td></tr>`;

  const discount = parseFloat(document.getElementById("discountInput")?.value) || 0;
  const { subtotal, gst, total } = calcCartTotals(CART, discount);

  if (document.getElementById("sumSubtotal")) {
    document.getElementById("sumSubtotal").textContent = money(subtotal);
    document.getElementById("sumGST").textContent = money(gst);
    document.getElementById("sumTotal").textContent = money(total);
  }
}

async function checkout() {
  if (!CART.length) { alert("Cart is empty."); return; }
  const discount = parseFloat(document.getElementById("discountInput").value) || 0;
  if (CURRENT_USER.role === "cashier" && discount !== 0) { alert("Cashiers cannot apply discounts."); return; }
  const { subtotal, gst, total } = calcCartTotals(CART, discount);
  const profit = CART.reduce((s, i) => s + (i.price - i.purchasePrice) * i.qty, 0) - discount;
  const paymentMethod = document.getElementById("paymentMethod").value;
  const customerId = document.getElementById("billCustomer").value || null;

  let paymentDetail = { method: paymentMethod };
  if (paymentMethod === "split") {
    paymentDetail.cash = parseFloat(document.getElementById("splitCash").value) || 0;
    paymentDetail.other = parseFloat(document.getElementById("splitOther").value) || 0;
  }

  // stock check
  for (const item of CART) {
    const v = await DB.get("variants", item.barcode);
    if (!v || v.stock < item.qty) { alert(`Not enough stock for ${item.name}`); return; }
  }

  let counter = await getSetting("invoiceCounter", 1000);
  counter += 1;
  await setSetting("invoiceCounter", counter);
  const invoiceNo = "INV" + counter;

  const sale = {
    invoiceNo, date: new Date().toISOString(),
    items: CART.map(i => ({ ...i })),
    subtotal, gst, discount, total, profit,
    paymentMethod, paymentDetail,
    customerId: customerId ? Number(customerId) : null,
    cashier: CURRENT_USER.username,
    status: "completed"
  };
  await DB.add("sales", sale);

  // decrement stock
  for (const item of CART) {
    const v = await DB.get("variants", item.barcode);
    v.stock -= item.qty;
    await DB.put("variants", v);
  }

  // update customer points/history (1 point per ₹100 spent; ₹250 coupon per ₹5000)
  if (customerId) {
    const c = await DB.get("customers", Number(customerId));
    c.totalSpent = (c.totalSpent || 0) + total;
    c.points = (c.points || 0) + Math.floor(total / 100);
    c.purchaseHistory = c.purchaseHistory || [];
    c.purchaseHistory.push({ invoiceNo, date: sale.date, total });
    await DB.put("customers", c);
  }

  await printInvoice(sale);
  CART = [];
  renderBilling();
}

/* ---------------------------------------------------------
   INVOICE PRINTING (thermal 80mm style + reusable for A4/PDF)
--------------------------------------------------------- */
async function printInvoice(sale, format = "thermal") {
  const shopName = await getSetting("shopName", "Dress Shop");
  const address = await getSetting("shopAddress", "");
  const gstin = await getSetting("gstin", "");
  const customer = sale.customerId ? await DB.get("customers", sale.customerId) : null;

  const itemsHtml = sale.items.map(i => `
    <div class="bill-line"><span>${i.name} ${i.size}/${i.color} x${i.qty}</span><span>${money(i.price * i.qty)}</span></div>
  `).join("");

  const html = `
    <div class="print-invoice ${format === "a4" ? "a4" : ""}">
      <h3 style="text-align:center;margin:4px 0;">${shopName}</h3>
      <div style="text-align:center;">${address}</div>
      ${gstin ? `<div style="text-align:center;">GSTIN: ${gstin}</div>` : ""}
      <hr>
      <div>Invoice: ${sale.invoiceNo}</div>
      <div>Date: ${new Date(sale.date).toLocaleString()}</div>
      <div>Cashier: ${sale.cashier}</div>
      ${customer ? `<div>Customer: ${customer.name} (${customer.phone})</div>` : ""}
      <hr>
      ${itemsHtml}
      <hr>
      <div class="bill-line"><span>Subtotal</span><span>${money(sale.subtotal)}</span></div>
      <div class="bill-line"><span>GST</span><span>${money(sale.gst)}</span></div>
      <div class="bill-line"><span>Discount</span><span>-${money(sale.discount)}</span></div>
      <div class="total-row"><span>Total</span><span>${money(sale.total)}</span></div>
      <div>Payment: ${sale.paymentMethod.toUpperCase()}</div>
      <hr>
      <div style="text-align:center;">Thank you! Visit again 🙏</div>
    </div>
  `;
  const printArea = document.getElementById("printArea");
  printArea.innerHTML = html;
  printArea.classList.remove("hidden");
  window.print();
  printArea.classList.add("hidden");
}

/* ---------------------------------------------------------
   INVOICE SEARCH / REPRINT / RETURNS & EXCHANGE
--------------------------------------------------------- */
async function renderInvoiceSearch() {
  const content = document.getElementById("content");
  content.innerHTML = `
    <h2>🔎 Invoice Search</h2>
    <div class="card">
      <input id="invSearchBox" placeholder="Search by invoice number or customer name..." oninput="doInvoiceSearch()">
      <br><br>
      <table>
        <tr><th>Invoice</th><th>Date</th><th>Total</th><th>Status</th><th></th></tr>
        <tbody id="invResults"></tbody>
      </table>
    </div>
  `;
  doInvoiceSearch();
}

async function doInvoiceSearch() {
  const q = (document.getElementById("invSearchBox").value || "").toLowerCase();
  const sales = await DB.getAll("sales");
  const filtered = sales.filter(s => s.invoiceNo.toLowerCase().includes(q)).reverse();
  document.getElementById("invResults").innerHTML = filtered.map(s => `
    <tr>
      <td>${s.invoiceNo}</td>
      <td>${new Date(s.date).toLocaleString()}</td>
      <td>${money(s.total)}</td>
      <td>${s.status}</td>
      <td>
        <button class="btn small" onclick='reprintInvoice(${s.id})'>Reprint</button>
        ${s.status === "completed" ? `<button class="btn small danger" onclick='processReturn(${s.id})'>Return</button>` : ""}
      </td>
    </tr>
  `).join("") || "<tr><td colspan=5 class='muted'>No invoices found.</td></tr>";
}

async function reprintInvoice(id) {
  const sale = await DB.get("sales", id);
  await printInvoice(sale);
}

async function processReturn(id) {
  if (!confirm("Mark this invoice as returned and restock all items?")) return;
  const sale = await DB.get("sales", id);
  sale.status = "returned";
  await DB.put("sales", sale);
  for (const item of sale.items) {
    const v = await DB.get("variants", item.barcode);
    if (v) { v.stock += item.qty; await DB.put("variants", v); }
  }
  doInvoiceSearch();
}

/* ---------------------------------------------------------
   CUSTOMERS
--------------------------------------------------------- */
async function renderCustomers() {
  const content = document.getElementById("content");
  const customers = await DB.getAll("customers");
  content.innerHTML = `
    <div class="flex between"><h2>👥 Customers</h2>
      <button class="btn primary" onclick="openCustomerModal()">+ Add Customer</button>
    </div>
    <div class="card">
      <table>
        <tr><th>Name</th><th>Phone</th><th>Birthday</th><th>Points</th><th>Total Spent</th><th></th></tr>
        ${customers.map(c => `
          <tr>
            <td>${c.name}</td><td>${c.phone}</td><td>${c.birthday || "-"}</td>
            <td>${c.points || 0} ${c.points >= 5000 ? "🎁" : ""}</td>
            <td>${money(c.totalSpent || 0)}</td>
            <td><button class="btn small" onclick="openCustomerModal(${c.id})">Edit</button></td>
          </tr>`).join("") || "<tr><td colspan=6 class='muted'>No customers yet.</td></tr>"}
      </table>
    </div>
  `;
}

async function openCustomerModal(id) {
  const editing = !!id;
  const c = editing ? await DB.get("customers", id) : {};
  const html = `
    <div class="modal-bg" id="custModalBg">
      <div class="modal">
        <h3>${editing ? "Edit Customer" : "Add Customer"}</h3>
        <div class="field"><label>Name</label><input id="c_name" value="${c.name || ""}"></div>
        <div class="field"><label>Phone</label><input id="c_phone" value="${c.phone || ""}"></div>
        <div class="field"><label>Birthday</label><input id="c_bday" type="date" value="${c.birthday || ""}"></div>
        ${editing ? `<p class="muted">Points: ${c.points || 0} · Total Spent: ${money(c.totalSpent || 0)}</p>` : ""}
        <p id="custModalError" class="error"></p>
        <div class="flex" style="margin-top:12px;">
          <button class="btn primary" onclick="saveCustomer(${editing ? id : "null"})">Save</button>
          <button class="btn" onclick="closeModal('custModalBg')">Cancel</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
}

async function saveCustomer(id) {
  const name = document.getElementById("c_name").value.trim();
  const phone = document.getElementById("c_phone").value.trim();
  const errorEl = document.getElementById("custModalError");
  errorEl.textContent = "";
  if (!name || !phone) { errorEl.textContent = "Name and phone are required."; return; }

  const customers = await DB.getAll("customers");
  const duplicate = customers.find(c => c.phone === phone && c.id !== id);
  if (duplicate) { errorEl.textContent = `This phone number is already used by ${duplicate.name}.`; return; }

  const obj = { name, phone, birthday: document.getElementById("c_bday").value };
  try {
    if (id) { obj.id = id; const existing = await DB.get("customers", id); await DB.put("customers", { ...existing, ...obj }); }
    else { await DB.add("customers", { ...obj, points: 0, totalSpent: 0, purchaseHistory: [] }); }
  } catch (err) {
    errorEl.textContent = "Could not save customer: " + (err.message || err);
    return;
  }
  closeModal("custModalBg");
  renderCustomers();
}

/* ---------------------------------------------------------
   REPORTS
--------------------------------------------------------- */
async function renderReports() {
  const content = document.getElementById("content");
  const sales = (await DB.getAll("sales")).filter(s => s.status !== "returned");
  const variants = await DB.getAll("variants");

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const sum = (arr, key) => arr.reduce((s, x) => s + (x[key] || 0), 0);
  const daily = sales.filter(s => new Date(s.date) >= startOfDay);
  const weekly = sales.filter(s => new Date(s.date) >= startOfWeek);
  const monthly = sales.filter(s => new Date(s.date) >= startOfMonth);

  // best/slow selling
  const salesByProduct = {};
  for (const s of sales) for (const i of s.items) {
    salesByProduct[i.name] = (salesByProduct[i.name] || 0) + i.qty;
  }
  const sortedProducts = Object.entries(salesByProduct).sort((a, b) => b[1] - a[1]);
  const best = sortedProducts.slice(0, 5);
  const slow = [...sortedProducts].reverse().slice(0, 5);

  // employee sales
  const byEmployee = {};
  for (const s of sales) byEmployee[s.cashier] = (byEmployee[s.cashier] || 0) + s.total;

  content.innerHTML = `
    <h2>📈 Reports</h2>
    <div class="grid cols-3">
      <div class="stat-card"><div class="label">Daily Sales</div><div class="value">${money(sum(daily,"total"))}</div></div>
      <div class="stat-card"><div class="label">Weekly Sales</div><div class="value">${money(sum(weekly,"total"))}</div></div>
      <div class="stat-card"><div class="label">Monthly Sales</div><div class="value">${money(sum(monthly,"total"))}</div></div>
      <div class="stat-card"><div class="label">Total Profit</div><div class="value">${money(sum(sales,"profit"))}</div></div>
      <div class="stat-card"><div class="label">GST Collected</div><div class="value">${money(sum(sales,"gst"))}</div></div>
      <div class="stat-card"><div class="label">Stock Value (Cost)</div><div class="value">${money(variants.reduce((s,v)=>s+v.stock*v.purchasePrice,0))}</div></div>
    </div>
    <br>
    <div class="grid cols-2">
      <div class="card">
        <h3>🏆 Best Selling Products</h3>
        <table><tr><th>Product</th><th>Units Sold</th></tr>
        ${best.map(([n,q]) => `<tr><td>${n}</td><td>${q}</td></tr>`).join("") || "<tr><td colspan=2 class='muted'>No data</td></tr>"}
        </table>
      </div>
      <div class="card">
        <h3>🐌 Slow Moving Products</h3>
        <table><tr><th>Product</th><th>Units Sold</th></tr>
        ${slow.map(([n,q]) => `<tr><td>${n}</td><td>${q}</td></tr>`).join("") || "<tr><td colspan=2 class='muted'>No data</td></tr>"}
        </table>
      </div>
    </div>
    <br>
    <div class="card">
      <h3>👤 Employee Sales Report</h3>
      <table><tr><th>Cashier</th><th>Total Sales</th></tr>
      ${Object.entries(byEmployee).map(([n,t]) => `<tr><td>${n}</td><td>${money(t)}</td></tr>`).join("") || "<tr><td colspan=2 class='muted'>No data</td></tr>"}
      </table>
    </div>
    <br>
    <div class="card">
      <h3>📦 Stock Report</h3>
      <table><tr><th>Product</th><th>Size/Color</th><th>Stock</th><th>Stock Value</th></tr>
      ${variants.map(v => `<tr><td>${v.productName}</td><td>${v.size}/${v.color}</td><td>${v.stock}</td><td>${money(v.stock*v.purchasePrice)}</td></tr>`).join("") || "<tr><td colspan=4 class='muted'>No products</td></tr>"}
      </table>
    </div>
  `;
}

/* ---------------------------------------------------------
   USERS & ROLES (owner only)
--------------------------------------------------------- */
async function renderUsers() {
  const content = document.getElementById("content");
  if (CURRENT_USER.role !== "owner") { content.innerHTML = "<p>Access denied. Owner role required.</p>"; return; }
  const users = await DB.getAll("users");
  content.innerHTML = `
    <div class="flex between"><h2>🔐 Users &amp; Roles</h2>
      <button class="btn primary" onclick="openUserModal()">+ Add User</button>
    </div>
    <div class="card">
      <table>
        <tr><th>Username</th><th>Name</th><th>Role</th><th></th></tr>
        ${users.map(u => `<tr><td>${u.username}</td><td>${u.name || "-"}</td><td>${u.role}</td>
          <td>
            <button class="btn small" onclick="openUserModal(${u.id})">Edit</button>
            ${u.username !== "admin" ? `<button class="btn small danger" onclick="deleteUser(${u.id})">Delete</button>` : ""}
          </td></tr>`).join("")}
      </table>
      <p class="muted small">Roles: <b>Owner</b> (full access) · <b>Manager</b> (reports + inventory, no user mgmt) · <b>Cashier</b> (billing only, no discounts/reports).</p>
      <p class="muted small">⚠️ If this shop is still using the default <b>admin / admin123</b> login, edit that user now and set a real password.</p>
    </div>
  `;
}

async function openUserModal(id) {
  const editing = !!id;
  const u = editing ? await DB.get("users", id) : {};
  const html = `
    <div class="modal-bg" id="userModalBg">
      <div class="modal">
        <h3>${editing ? "Edit User" : "Add User"}</h3>
        <div class="field"><label>Full Name</label><input id="u_name" value="${u.name || ""}"></div>
        <div class="field"><label>Username</label><input id="u_username" value="${u.username || ""}" ${editing ? "readonly" : ""}></div>
        <div class="field">
          <label>${editing ? "New Password (leave blank to keep current)" : "Password"}</label>
          <div class="flex">
            <input id="u_password" type="password" style="flex:1;">
            <button type="button" class="btn small" onclick="toggleUserPasswordVisibility()">👁️</button>
          </div>
        </div>
        <div class="field"><label>Role</label>
          <select id="u_role">
            <option value="owner" ${u.role === "owner" ? "selected" : ""}>Owner</option>
            <option value="manager" ${u.role === "manager" ? "selected" : ""}>Manager</option>
            <option value="cashier" ${!editing || u.role === "cashier" ? "selected" : ""}>Cashier</option>
          </select>
        </div>
        <p id="userModalError" class="error"></p>
        <div class="flex" style="margin-top:12px;">
          <button class="btn primary" onclick="saveUser(${editing ? u.id : "null"})">Save</button>
          <button class="btn" onclick="closeModal('userModalBg')">Cancel</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
}

function toggleUserPasswordVisibility() {
  const input = document.getElementById("u_password");
  input.type = input.type === "password" ? "text" : "password";
}

async function saveUser(id) {
  const editing = !!id;
  const username = document.getElementById("u_username").value.trim();
  const password = document.getElementById("u_password").value;
  const errorEl = document.getElementById("userModalError");
  errorEl.textContent = "";

  if (!username) { errorEl.textContent = "Username is required."; return; }
  if (!editing && !password) { errorEl.textContent = "Password is required for a new user."; return; }

  const record = {
    username,
    role: document.getElementById("u_role").value,
    name: document.getElementById("u_name").value.trim()
  };

  // The "admin" account can never be deleted (see deleteUser), so it must also
  // never lose the Owner role — otherwise a shop could end up with zero
  // accounts able to manage users, which would lock everyone out permanently.
  if (username === "admin" && record.role !== "owner") {
    errorEl.textContent = "The admin account must keep the Owner role, so the shop can never be locked out.";
    return;
  }

  try {
    if (editing) {
      const existing = await DB.get("users", id);
      record.id = id;
      record.password = password ? await hashPassword(password) : existing.password;
      await DB.put("users", record);
    } else {
      record.password = await hashPassword(password);
      await DB.add("users", record);
    }
  } catch (err) {
    errorEl.textContent = (err && err.name === "ConstraintError")
      ? "That username is already taken."
      : "Could not save user: " + (err.message || err);
    return;
  }

  closeModal("userModalBg");
  renderUsers();
}

async function deleteUser(id) {
  if (!confirm("Delete this user?")) return;
  await DB.delete("users", id);
  renderUsers();
}

/* ---------------------------------------------------------
   SETTINGS (shop info, GST, backup/restore)
--------------------------------------------------------- */
async function renderSettings() {
  const content = document.getElementById("content");
  const shopName = await getSetting("shopName", "Dress Shop");
  const address = await getSetting("shopAddress", "");
  const gstin = await getSetting("gstin", "");
  const defaultGST = await getSetting("defaultGST", 5);
  const gstMode = await getSetting("gstMode", "exclusive");

  content.innerHTML = `
    <h2>⚙️ Settings</h2>
    <div class="grid cols-2">
      <div class="card">
        <h3>Shop Details</h3>
        <div class="field"><label>Shop Name</label><input id="s_name" value="${shopName}"></div>
        <div class="field"><label>Address</label><input id="s_address" value="${address}"></div>
        <div class="field"><label>GSTIN</label><input id="s_gstin" value="${gstin}"></div>
        <div class="field"><label>Default GST %</label><input id="s_gst" type="number" value="${defaultGST}"></div>
        <div class="field">
          <label>GST Pricing Mode</label>
          <select id="s_gstmode">
            <option value="exclusive" ${gstMode === "exclusive" ? "selected" : ""}>GST added on top of Selling Price</option>
            <option value="inclusive" ${gstMode === "inclusive" ? "selected" : ""}>Selling Price already includes GST</option>
          </select>
          <p class="muted small">Applies to every product using its Selling Price. Change this only if you're consistent about how you enter prices.</p>
        </div>
        <button class="btn primary" onclick="saveShopSettings()">Save Settings</button>
      </div>
      <div class="card">
        <h3>💾 Backup &amp; Restore (Local Files)</h3>
        <p class="muted">All your data lives only on this computer. Export a backup file regularly and store it on a USB drive or cloud folder for safety.</p>
        <button class="btn accent wide" onclick="downloadBackup()">⬇️ Download Backup (.json)</button>
        <br><br>
        <label>Restore from Backup File</label>
        <input type="file" id="restoreFile" accept=".json">
        <button class="btn wide" style="margin-top:8px;" onclick="restoreFromFile()">⬆️ Restore Backup</button>
      </div>
    </div>
  `;
}

async function saveShopSettings() {
  await setSetting("shopName", document.getElementById("s_name").value.trim());
  await setSetting("shopAddress", document.getElementById("s_address").value.trim());
  await setSetting("gstin", document.getElementById("s_gstin").value.trim());
  await setSetting("defaultGST", parseFloat(document.getElementById("s_gst").value) || 0);
  await setSetting("gstMode", document.getElementById("s_gstmode").value);
  document.getElementById("shopNameLabel").textContent = await getSetting("shopName");
  alert("Settings saved.");
}

async function downloadBackup() {
  const data = await exportBackup();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dress-shop-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function restoreFromFile() {
  const fileInput = document.getElementById("restoreFile");
  if (!fileInput.files.length) { alert("Choose a backup file first."); return; }
  if (!confirm("This will overwrite existing data. Continue?")) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const data = JSON.parse(e.target.result);
    await importBackup(data);
    alert("Backup restored. Reloading...");
    location.reload();
  };
  reader.readAsText(fileInput.files[0]);
}
