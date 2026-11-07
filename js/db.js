/* =========================================================
   db.js — Local offline database (IndexedDB)
   No server, no internet, no installation. Data lives on
   this computer only, inside the browser's storage for this
   app. Works even in airplane mode.
   ========================================================= */

const DB_NAME = "dressShopBillingDB";
const DB_VERSION = 1;
let dbInstance = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      // variants = one row per size/color combo = one barcode each
      if (!db.objectStoreNames.contains("variants")) {
        const store = db.createObjectStore("variants", { keyPath: "barcode" });
        store.createIndex("productName", "productName", { unique: false });
        store.createIndex("category", "category", { unique: false });
        store.createIndex("stock", "stock", { unique: false });
      }

      if (!db.objectStoreNames.contains("customers")) {
        const store = db.createObjectStore("customers", { keyPath: "id", autoIncrement: true });
        store.createIndex("phone", "phone", { unique: true });
      }

      if (!db.objectStoreNames.contains("sales")) {
        const store = db.createObjectStore("sales", { keyPath: "id", autoIncrement: true });
        store.createIndex("date", "date", { unique: false });
        store.createIndex("invoiceNo", "invoiceNo", { unique: true });
        store.createIndex("status", "status", { unique: false });
      }

      if (!db.objectStoreNames.contains("users")) {
        const store = db.createObjectStore("users", { keyPath: "id", autoIncrement: true });
        store.createIndex("username", "username", { unique: true });
      }

      if (!db.objectStoreNames.contains("expenses")) {
        db.createObjectStore("expenses", { keyPath: "id", autoIncrement: true });
      }

      if (!db.objectStoreNames.contains("suppliers")) {
        db.createObjectStore("suppliers", { keyPath: "id", autoIncrement: true });
      }

      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };

    req.onsuccess = (e) => { dbInstance = e.target.result; resolve(dbInstance); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function tx(storeName, mode = "readonly") {
  return openDB().then(db => db.transaction(storeName, mode).objectStore(storeName));
}

const DB = {
  async add(store, obj) {
    const s = await tx(store, "readwrite");
    return new Promise((res, rej) => {
      const r = s.add(obj);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async put(store, obj) {
    const s = await tx(store, "readwrite");
    return new Promise((res, rej) => {
      const r = s.put(obj);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async get(store, key) {
    const s = await tx(store);
    return new Promise((res, rej) => {
      const r = s.get(key);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async delete(store, key) {
    const s = await tx(store, "readwrite");
    return new Promise((res, rej) => {
      const r = s.delete(key);
      r.onsuccess = () => res(true);
      r.onerror = () => rej(r.error);
    });
  },
  async getAll(store) {
    const s = await tx(store);
    return new Promise((res, rej) => {
      const r = s.getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async clear(store) {
    const s = await tx(store, "readwrite");
    return new Promise((res, rej) => {
      const r = s.clear();
      r.onsuccess = () => res(true);
      r.onerror = () => rej(r.error);
    });
  },
  async count(store) {
    const s = await tx(store);
    return new Promise((res, rej) => {
      const r = s.count();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
};

// ---- password hashing (SHA-256, built into every modern browser, works fully offline) ----
async function hashPassword(password) {
  const enc = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// ---- settings helpers (shop name, gst%, counters, dark mode, logged-in user) ----
async function getSetting(key, fallback = null) {
  const row = await DB.get("settings", key);
  return row ? row.value : fallback;
}
async function setSetting(key, value) {
  return DB.put("settings", { key, value });
}

// ---- full backup / restore (this is our "cloud backup" — a downloadable JSON file) ----
async function exportBackup() {
  const stores = ["variants", "customers", "sales", "users", "expenses", "suppliers", "settings"];
  const data = {};
  for (const s of stores) data[s] = await DB.getAll(s);
  data.exportedAt = new Date().toISOString();
  return data;
}
async function importBackup(data) {
  const stores = ["variants", "customers", "sales", "users", "expenses", "suppliers", "settings"];
  for (const s of stores) {
    if (!data[s]) continue;
    await DB.clear(s);
    for (const row of data[s]) await DB.put(s, row);
  }
}
