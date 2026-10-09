/**
 * Loqate address lookup — ported from POC-Instructions (which took it from
 * POC-Address). Find v1.20 drives a typeahead with a container drill-down;
 * Batch v1.20 Verify turns the picked suggestion into a structured address.
 * Both are called straight from the browser; this is the app's only outbound
 * network call and it happens only after a country is chosen and (on the
 * Property tab) a suggestion is picked.
 *
 * The `key` is passed in rather than read from storage so the module stays a
 * pure transport + mapping layer the wizard can drive.
 */
export const LOQATE_FIND_URL = 'https://api.addressy.com/Capture/Interactive/Find/v1.20/json6.ws';
export const LOQATE_VERIFY_URL = 'https://api.addressy.com/Cleansing/International/Batch/v1.20/json6.ws';
export const LOQATE_DEFAULT_KEY = 'BY92-NN99-ER43-XT19'; // the POC-Address backend key
export const LOQATE_KEY_STORAGE = 'loqate_api_key';

export const OPTION_COUNTRIES = ['France', 'Germany', 'Spain', 'Poland', 'United Kingdom', 'Netherlands'];
export const COUNTRY_ISO = {
  France: 'FR', Germany: 'DE', Spain: 'ES', Poland: 'PL',
  'United Kingdom': 'GB', Netherlands: 'NL'
};
export const ISO_TO_OPTION = {
  FR: 'France', DE: 'Germany', ES: 'Spain', PL: 'Poland',
  GB: 'United Kingdom', NL: 'Netherlands'
};

/** Read the effective key: an explicit saved value wins, even if empty. */
export function loadLoqateKey() {
  try {
    const saved = localStorage.getItem(LOQATE_KEY_STORAGE);
    if (saved !== null) return saved;
  } catch (e) { /* storage unavailable */ }
  return LOQATE_DEFAULT_KEY;
}

export function saveLoqateKey(key) {
  try { localStorage.setItem(LOQATE_KEY_STORAGE, key); } catch (e) { /* ignore */ }
}

/* Find: GET + recursive Container drill-down until items are Addresses. */
export async function loqateFind(text, iso, key) {
  const url = new URL(LOQATE_FIND_URL);
  url.searchParams.set('Key', key);
  url.searchParams.set('Text', text);
  if (iso) url.searchParams.set('Countries', iso);
  url.searchParams.set('Limit', '100');

  let res = await fetch(url.toString());
  let data = await res.json();
  if (data.Items && data.Items[0] && data.Items[0].Error) {
    throw new Error(data.Items[0].Description || 'Loqate Find error');
  }
  let items = (data && data.Items) || [];
  let depth = 5;
  while (depth > 0 && items.length > 0 && items[0].Type !== 'Address') {
    url.searchParams.set('Container', items[0].Id);
    res = await fetch(url.toString());
    data = await res.json();
    if (data.Items && data.Items.length > 0) items = data.Items;
    else break;
    depth -= 1;
  }
  return items
    .filter((i) => i.Type === 'Address')
    .map((i) => ({ id: i.Id, text: i.Text, description: i.Description }));
}

/* Batch replies arrive as an array, an {Items:[…]} envelope, or a bare match
   object; a response with no usable match fields triggers one text-only retry. */
function batchResult(data) {
  let item = null;
  if (Array.isArray(data)) item = data[0];
  else if (data && data.Items && data.Items[0]) item = data.Items[0];
  else if (data && (data.Matches || data.Address1 || data.Address || data.PostalCode)) item = data;
  if (!item) return { match: null, error: null };
  if (item.Error) return { match: null, error: item.Description || 'Address not found' };
  const match = (item.Matches && item.Matches[0]) ? item.Matches[0] : item;
  const usable = match && (match.Address || match.Address1 || match.AddressFormat ||
    match.PostalCode || match.Thoroughfare || match.DeliveryAddress);
  return { match: usable ? match : null, error: usable ? null : (item.Description || null) };
}

async function batchVerify(addresses, key) {
  const res = await fetch(LOQATE_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Key: key,
      GeoCode: true,
      Addresses: addresses,
      Options: { Process: 'Verify', Enhance: false, ServerOptions: { OutputAddressFormat: 'YES' } }
    })
  });
  if (res && res.ok === false) throw new Error(`HTTP ${res.status}`);
  return batchResult(await res.json());
}

export async function loqateVerify(result, iso, key) {
  let res = await batchVerify([{
    Id: result.id,
    Address: result.text,
    Address1: result.text,
    Locality: result.description || '',
    Country: iso || ''
  }], key);
  if (!res.match && !res.error) {
    // Id lookup resolved nothing — retry as a pure text cleanse without the Id
    res = await batchVerify([{
      Address: [result.text, result.description].filter(Boolean).join(', '),
      Locality: result.description || '',
      Country: iso || ''
    }], key);
  }
  if (!res.match) throw new Error(res.error || 'Address not found');
  return res.match;
}

/* ---------------- mapping the verify match onto the address form -------- */
export function optionForCountry(name) {
  return (name && OPTION_COUNTRIES.indexOf(name) >= 0) ? name : '';
}

export function resolveCountry(match) {
  const direct = optionForCountry(match.CountryName) || optionForCountry(match.Country);
  if (direct) return direct;
  // Only a code-shaped value is an ISO code — slicing a full name
  // ("French Southern Territories" → "FR") would pick the wrong country.
  const raw = String(match['ISO3166-2'] || match.ISO3166_2 || match.Country || '').trim();
  if (/^[A-Za-z]{2}(-[A-Za-z0-9]{1,3})?$/.test(raw)) {
    return ISO_TO_OPTION[raw.toUpperCase().slice(0, 2)] || '';
  }
  return '';
}

/* ISO code of the country a verify match belongs to ('' when unknown). */
export function matchIso(match) {
  const raw = String(match['ISO3166-2'] || match.ISO3166_2 || '').trim();
  if (raw) return raw.toUpperCase().slice(0, 2);
  const c = String(match.Country || '').trim();
  if (/^[A-Za-z]{2}$/.test(c)) return c.toUpperCase();
  const name = optionForCountry(match.CountryName) || optionForCountry(c);
  return name ? COUNTRY_ISO[name] : '';
}

function splitAddressLines(s) {
  return String(s).split(/<br\s*\/?>|\r?\n/i).map((x) => x.trim()).filter(Boolean);
}

/** Turn a Verify match into { address, city, postcode, country }. */
export function mapVerifyMatch(match) {
  const postcode = match.PostalCode || match.PostalCodePrimary || '';
  const country = resolveCountry(match);
  let city = match.Locality || '';
  if (!city && match.Address2 && match.Address2 !== postcode) city = match.Address2;
  if (!city && match.AdministrativeArea && match.AdministrativeArea !== postcode) city = match.AdministrativeArea;
  // A Locality echo can drag the postcode along with it — trim it back off
  if (city && postcode && city.toLowerCase().indexOf(postcode.toLowerCase()) >= 0) {
    const head = city.slice(0, city.toLowerCase().indexOf(postcode.toLowerCase()))
      .replace(/[\s,;/|-]+$/, '').trim();
    city = head || (match.Address2 && match.Address2 !== postcode ? match.Address2 : '');
  }

  // Address lines: the Address blob first, then AddressFormat composition,
  // then the numbered Address1..4 / DeliveryAddress lines
  let lines = [];
  if (match.Address) {
    lines = splitAddressLines(match.Address);
  }
  if (!lines.length && match.AddressFormat) {
    lines = splitAddressLines(match.AddressFormat).map((fmt) =>
      fmt.trim().split(/\s+/).map((f) => String(f).replace(/[,;:]$/, ''))
        .map((f) => (match[f] !== undefined && match[f] !== null) ? String(match[f]) : '')
        .filter(Boolean).join(' ').trim()
    ).filter(Boolean);
  }
  if (!lines.length) {
    lines = ['Address1', 'Address2', 'Address3', 'Address4', 'Address5',
      'DeliveryAddress1', 'DeliveryAddress2', 'DeliveryAddress3']
      .map((k) => (match[k] !== undefined && match[k] !== null && String(match[k]).trim()) ? String(match[k]).trim() : '')
      .filter(Boolean);
  }

  // City, postcode and country have their own fields — keep them out of the address
  const address = lines.filter((l) => {
    const lower = l.toLowerCase();
    if (postcode && lower.indexOf(postcode.toLowerCase()) >= 0) return false;
    if (city && lower === city.toLowerCase()) return false;
    if (match.AdministrativeArea && lower === String(match.AdministrativeArea).toLowerCase()) return false;
    if (match.CountryName && lower === String(match.CountryName).toLowerCase()) return false;
    if (country && lower === country.toLowerCase()) return false;
    return true;
  }).join(', ') || match.Address1 || match.DeliveryAddress || '';

  return { address, city, postcode, country };
}
