export type NominatimAddress = {
  house_number?: string;
  road?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  country?: string;
  country_code?: string;
};

export type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address?: NominatimAddress;
};

export type NominatimReverseResult = {
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
};

export type ParsedAddress = {
  address: string;
  city: string;
  county: string;
  country: string;
  label: string;
};

const NOMINATIM_HEADERS = {
  "Accept-Language": "en",
  "User-Agent": "ConnectOfficeApp/1.0",
};

export async function geocodeLocation(query: string): Promise<NominatimResult[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=5&addressdetails=1`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) throw new Error("Geocode request failed");
  return res.json();
}

export async function reverseGeocodeLocation(
  latitude: number,
  longitude: number
): Promise<NominatimReverseResult> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}` +
    "&format=json&addressdetails=1";
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) throw new Error("Reverse geocode request failed");
  return res.json();
}

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export function parseNominatimCoordinate(result: NominatimResult): MapCoordinate {
  return {
    latitude: parseFloat(result.lat),
    longitude: parseFloat(result.lon),
  };
}

export function parseNominatimAddress(
  displayName: string,
  address?: NominatimAddress
): ParsedAddress {
  const streetParts: string[] = [];
  if (address?.house_number) streetParts.push(address.house_number);
  if (address?.road) streetParts.push(address.road);

  const city =
    address?.city ||
    address?.town ||
    address?.village ||
    address?.municipality ||
    "";

  const county = address?.county || address?.state || "";
  const country = address?.country || "";
  const label = displayName.split(",")[0]?.trim() || streetParts.join(" ") || city;

  return {
    address: streetParts.join(" ").trim() || label,
    city,
    county,
    country,
    label,
  };
}

export function matchCountryOption(country: string, options: string[]): string {
  const normalized = country.trim().toLowerCase();
  if (!normalized) return options[0] ?? country;
  const match = options.find((option) => option.toLowerCase() === normalized);
  return match ?? country;
}
