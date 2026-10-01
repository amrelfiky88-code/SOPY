import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isInEgypt } from '../../shared/egypt.js';

// Places checkout must recognise as in Egypt (Paymob) or not (cards),
// including the towns right at the borders.
const INSIDE = {
  Cairo: [30.044, 31.236], Giza: [30.013, 31.209], Alexandria: [31.2, 29.918], 'Port Said': [31.265, 32.302],
  Damietta: [31.417, 31.814], Rosetta: [31.404, 30.417], 'Marsa Matruh': [31.352, 27.237], Sallum: [31.553, 25.159],
  Siwa: [29.203, 25.519], Luxor: [25.687, 32.639], Aswan: [24.089, 32.899], 'Abu Simbel': [22.337, 31.626],
  Hurghada: [27.257, 33.812], Safaga: [26.743, 33.938], Quseir: [26.104, 34.278], 'Marsa Alam': [25.068, 34.889],
  Shalateen: [23.13, 35.59], Halaib: [22.22, 36.64], 'Sharm El Sheikh': [27.915, 34.33], 'Ras Nasrani': [27.98, 34.4],
  Dahab: [28.494, 34.513], Nuweiba: [29.031, 34.664], 'Taba Heights': [29.38, 34.81], Taba: [29.485, 34.888],
  'El Arish': [31.131, 33.799], 'Rafah (Egypt)': [31.28, 34.23], Suez: [29.967, 32.55], Ismailia: [30.6, 32.27],
  'Kharga': [25.44, 30.55], 'Saint Catherine': [28.556, 33.976], 'Gulf of Suez': [28.5, 33.0],
};
const OUTSIDE = {
  Eilat: [29.557, 34.952], Aqaba: [29.532, 35.006], 'Gaza City': [31.517, 34.45], 'Khan Younis': [31.34, 34.3],
  'Tel Aviv': [32.085, 34.782], 'Beersheba': [31.252, 34.791], Haql: [29.29, 34.94], Maqna: [28.4, 34.75],
  'Tiran island': [27.95, 34.55], Duba: [27.35, 35.69], 'Al Wajh': [26.24, 36.45], Jeddah: [21.543, 39.173],
  Tobruk: [32.076, 23.96], Jaghbub: [29.742, 24.517], Kufra: [24.2, 23.3], 'Wadi Halfa': [21.8, 31.35],
  'Port Sudan': [19.616, 37.216], Khartoum: [15.5, 32.56], Amman: [31.95, 35.93], Riyadh: [24.71, 46.67],
  Dubai: [25.2, 55.27], London: [51.5, -0.13], 'Null Island': [0, 0],
};

test('positions inside Egypt, border towns included, count as Egypt', () => {
  for (const [name, [lat, lng]] of Object.entries(INSIDE)) assert.equal(isInEgypt(lat, lng), true, name);
});

test('neighbouring places and the rest of the world do not', () => {
  for (const [name, [lat, lng]] of Object.entries(OUTSIDE)) assert.equal(isInEgypt(lat, lng), false, name);
});

test('a missing or broken position is not Egypt', () => {
  for (const [lat, lng] of [[null, null], [undefined, 31], ['abc', 31], [NaN, NaN], [Infinity, 31]]) assert.equal(isInEgypt(lat, lng), false);
});
