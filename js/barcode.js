/* =========================================================
   barcode.js — Code128 (subset B) barcode generator.
   Pure JavaScript, zero dependencies, works fully offline.
   Returns an SVG string you can print on labels or invoices.
   Also includes a simple numeric barcode-number generator.
   ========================================================= */

// Code128B character set: ASCII 32-127 map to values 0-95
const CODE128B_START = 104;
const CODE128B_STOP = 106;

const PATTERNS = [
  "11011001100","11001101100","11001100110","10010011000","10010001100",
  "10001001100","10011001000","10011000100","10001100100","11001001000",
  "11001000100","11000100100","10110011100","10011011100","10011001110",
  "10111001100","10011101100","10011100110","11001110010","11001011100",
  "11001001110","11011100100","11001110100","11101101110","11101001100",
  "11100101100","11100100110","11101100100","11100110100","11100110010",
  "11011011000","11011000110","11000110110","10100011000","10001011000",
  "10001000110","10110001000","10001101000","10001100010","11010001000",
  "11000101000","11000100010","10110111000","10110001110","10001101110",
  "10111011000","10111000110","10001110110","11101110110","11010001110",
  "11000101110","11011101000","11011100010","11011101110","11101011000",
  "11101000110","11100010110","11101101000","11101100010","11100011010",
  "11101111010","11001000010","11110001010","10100110000","10100001100",
  "10010110000","10010000110","10000101100","10000100110","10110010000",
  "10110000100","10011010000","10011000010","10000110100","10000110010",
  "11000010010","11001010000","11110111010","11000010100","10001111010",
  "10100111100","10010111100","10010011110","10111100100","10011110100",
  "10011110010","11110100100","11110010100","11110010010","11011011110",
  "11011110110","11110110110","10101111000","10100011110","10001011110",
  "10111101000","10111100010","11110101000","11110100010","10111011110",
  "10111101110","11101011110","11110101110","11010000100","11010010000",
  "11010011100","1100011101011"
];

function code128bEncode(text) {
  const values = [CODE128B_START];
  for (const ch of text) {
    const code = ch.charCodeAt(0) - 32;
    if (code < 0 || code > 94) throw new Error("Unsupported character in barcode: " + ch);
    values.push(code);
  }
  let checksum = values[0];
  for (let i = 1; i < values.length; i++) checksum += values[i] * i;
  values.push(checksum % 103);
  values.push(CODE128B_STOP);
  return values.map(v => PATTERNS[v]).join("");
}

/**
 * Render a Code128 barcode as an SVG string.
 * @param {string} text - digits/letters to encode
 * @param {object} opts - {width, height, showText}
 */
function renderBarcodeSVG(text, opts = {}) {
  const barWidth = opts.barWidth || 2;
  const height = opts.height || 60;
  const showText = opts.showText !== false;
  const bits = code128bEncode(text);
  const totalWidth = bits.length * barWidth;
  const svgHeight = showText ? height + 18 : height;

  let x = 0;
  let bars = "";
  for (const bit of bits) {
    if (bit === "1") {
      bars += `<rect x="${x}" y="0" width="${barWidth}" height="${height}" fill="#000"/>`;
    }
    x += barWidth;
  }

  const text_svg = showText
    ? `<text x="${totalWidth / 2}" y="${height + 14}" font-size="13" text-anchor="middle" font-family="monospace">${text}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${svgHeight}" width="${totalWidth}" height="${svgHeight}">
    <rect x="0" y="0" width="${totalWidth}" height="${svgHeight}" fill="#fff"/>
    ${bars}
    ${text_svg}
  </svg>`;
}

/**
 * Generate the next sequential numeric barcode, e.g. 890100001, 890100002...
 * Prefix defaults to 8901 (a generic "in-store" EAN-ish prefix).
 */
async function nextBarcodeNumber() {
  let counter = await getSetting("barcodeCounter", 100000);
  counter += 1;
  await setSetting("barcodeCounter", counter);
  return "890" + String(counter).padStart(6, "0");
}
