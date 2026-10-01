import { isInEgypt } from '../../../shared/egypt.js';

// Should this checkout be paid in EGP through Paymob? Yes from a device
// inside Egypt. The position is checked on the phone (shared/egypt.js)
// and never sent anywhere. When the phone won't say where it is
// (permission refused, location off, no answer), the country the
// business signed up with decides.
export function paysInEgypt(businessCountry) {
  const fallback = businessCountry === 'Egypt';
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(fallback);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } };
    // getCurrentPosition's own timeout doesn't run while the permission
    // question is on screen; someone who ignores it still gets a checkout.
    const timer = setTimeout(() => finish(fallback), 15000);
    navigator.geolocation.getCurrentPosition(
      (pos) => finish(isInEgypt(pos.coords.latitude, pos.coords.longitude)),
      () => finish(fallback),
      { timeout: 10000, maximumAge: 60 * 60 * 1000, enableHighAccuracy: false }
    );
  });
}

// Paymob sends the customer back with the signed result in the address
// (?id=…&success=…&hmac=…). The fields, or null when this isn't a return.
export function paymobReturnParams(search) {
  const params = new URLSearchParams(search);
  if (!params.get('hmac') || !params.has('success')) return null;
  return Object.fromEntries(params.entries());
}
