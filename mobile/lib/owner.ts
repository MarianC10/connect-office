import { authFetch, getAccessToken } from "@/lib/api";
import { API_BASE_URL } from "@/lib/env";

export type AmenityCatalogItem = {
  id: string;
  name: string;
  category: string;
};

export type OwnerLocationSummary = {
  id: string;
  name: string;
  city: string;
  image_url?: string;
  booking_count: number;
};

export type LocationImage = {
  id: string;
  url: string;
};

export type OwnerLocationDetail = {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  county: string;
  country: string;
  latitude: number;
  longitude: number;
  capacity: number;
  images: LocationImage[];
  amenity_ids: string[];
  amenities: AmenityCatalogItem[];
};

export type OwnerBooking = {
  id: string;
  location_id: string;
  location_name: string;
  booking_date: string;
  renter_id: string;
  renter_name: string;
  renter_email: string;
  status: string;
  location_image_url?: string;
};

export type CreateLocationBody = {
  name: string;
  description: string;
  address: string;
  city: string;
  county: string;
  country: string;
  latitude: number;
  longitude: number;
  capacity?: number;
  amenity_ids: string[];
};

export type UpdateLocationBody = {
  name?: string;
  description?: string;
  amenity_ids?: string[];
  images?: LocationImage[];
};

export async function fetchAmenities(): Promise<AmenityCatalogItem[]> {
  const res = await authFetch("/amenities");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchOwnerLocations(): Promise<OwnerLocationSummary[]> {
  const res = await authFetch("/owner/locations");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchOwnerLocation(id: string): Promise<OwnerLocationDetail> {
  const res = await authFetch(`/owner/locations/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function createOwnerLocation(body: CreateLocationBody): Promise<OwnerLocationDetail> {
  const res = await authFetch("/owner/locations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function updateOwnerLocation(
  id: string,
  body: UpdateLocationBody
): Promise<OwnerLocationDetail> {
  const res = await authFetch(`/owner/locations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function uploadOwnerLocationImage(
  locationId: string,
  uri: string,
  mimeType = "image/jpeg"
): Promise<LocationImage> {
  const token = await getAccessToken();
  const form = new FormData();
  form.append("image", {
    uri,
    name: "location.jpg",
    type: mimeType,
  } as unknown as Blob);

  const res = await fetch(
    `${API_BASE_URL}/owner/locations/${encodeURIComponent(locationId)}/images`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.image as LocationImage;
}

export async function deleteOwnerLocationImage(
  locationId: string,
  imageId: string
): Promise<void> {
  const res = await authFetch(
    `/owner/locations/${encodeURIComponent(locationId)}/images/${encodeURIComponent(imageId)}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
}

export async function fetchOwnerBookings(params?: {
  date?: string;
  locationId?: string;
}): Promise<OwnerBooking[]> {
  const search = new URLSearchParams();
  if (params?.date) search.set("date", params.date);
  if (params?.locationId) search.set("location_id", params.locationId);
  const qs = search.toString();
  const res = await authFetch(`/owner/bookings${qs ? `?${qs}` : ""}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}
