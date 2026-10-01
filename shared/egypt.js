// Is a GPS position inside Egypt? Checkout offers Paymob (paying in EGP)
// to devices in Egypt. Worked out on the device from a simplified border
// outline, so the position never leaves the phone.
//
// [latitude, longitude] points, clockwise from the Libyan border on the
// Mediterranean. Land borders follow the real line closely; at sea the
// outline runs a little offshore, between Egypt's coast and its
// neighbours' (it leaves out Gaza, Eilat, Aqaba, Tiran and the Saudi
// coast). Accurate to a couple of kilometres at the borders, which is
// plenty for choosing a payment method.
const EGYPT_OUTLINE = [
  [31.68, 25.07], // Libyan border at the coast, west of Sallum
  [32.0, 29.0], // offshore, along the Mediterranean coast
  [32.0, 33.0],
  [31.6, 34.1], // offshore, west of Gaza
  [31.32, 34.22], // Rafah, on the coast
  [31.22, 34.27], // Kerem Shalom
  [30.87, 34.41], // Nitzana
  [30.3, 34.58],
  [29.75, 34.8],
  [29.49, 34.9], // Taba
  [29.0, 34.75], // Gulf of Aqaba, off the Sinai coast
  [28.5, 34.62], // off Dahab
  [28.05, 34.45], // Strait of Tiran, west of Tiran island
  [27.85, 34.4], // off Sharm El Sheikh
  [27.6, 34.3], // south of Ras Mohammed
  [27.3, 34.1], // Red Sea, off Hurghada
  [26.8, 34.3], // off Safaga
  [26.1, 34.7], // off Quseir
  [25.1, 35.3], // off Marsa Alam
  [24.0, 35.9], // off Berenice
  [23.2, 36.2], // off Shalateen
  [22.0, 37.3], // off Halaib, on the 22nd parallel
  [22.0, 25.0], // Sudan border along 22°N to the Libyan border
  [29.2, 24.98], // Libyan border along 25°E, north past Siwa
  [29.8, 24.85],
  [30.5, 24.85],
  [31.0, 24.95],
];

export function isInEgypt(lat, lng) {
  const y = Number(lat);
  const x = Number(lng);
  if (!Number.isFinite(y) || !Number.isFinite(x)) return false;
  // Ray casting: count how many outline edges a line due east crosses.
  let inside = false;
  for (let i = 0, j = EGYPT_OUTLINE.length - 1; i < EGYPT_OUTLINE.length; j = i++) {
    const [yi, xi] = EGYPT_OUTLINE[i];
    const [yj, xj] = EGYPT_OUTLINE[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
