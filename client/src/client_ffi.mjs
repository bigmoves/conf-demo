import { Error, Ok, Empty, NonEmpty } from "./gleam.mjs";
import { latLngToCell } from "h3-js";

// Convert JavaScript array to Gleam List
function toList(array) {
  let list = new Empty();
  for (let i = array.length - 1; i >= 0; i--) {
    list = new NonEmpty(array[i], list);
  }
  return list;
}

/**
 * Get current time in milliseconds
 * @returns {number} Current timestamp in milliseconds
 */
export function getCurrentTimeMs() {
  return Date.now();
}

export function fetchUrl(url) {
  return fetch(url)
    .then((response) => {
      return response.text().then((text) => {
        // Return Ok(#(status, text))
        return new Ok([response.status, text]);
      });
    })
    .catch((error) => {
      // Return Error(message)
      return new Error(error.message || "Network error");
    });
}

export function postJson(url, jsonString) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: jsonString,
  })
    .then((response) => {
      return response.text().then((text) => {
        // Return Ok(#(status, text))
        return new Ok([response.status, text]);
      });
    })
    .catch((error) => {
      // Return Error(message)
      return new Error(error.message || "Network error");
    });
}

/**
 * Search for locations using the Nominatim OpenStreetMap geocoding API
 * Returns a Promise that resolves to Result(List(NominatimResult), String)
 */
export function searchLocations(query) {
  if (!query || query.trim().length < 2) {
    return Promise.resolve(new Ok(toList([])));
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", query.trim());
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");

  return fetch(url.toString(), {
    headers: {
      // Nominatim requires a User-Agent header
      "User-Agent": "lustre-fullstack-app/1.0",
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.statusText}`);
      }
      return response.json();
    })
    .then((results) => {
      // Convert JavaScript array to Gleam List
      return new Ok(toList(results));
    })
    .catch((error) => {
      console.error("Error fetching locations from Nominatim:", error);
      return new Error(error.message || "Failed to fetch locations");
    });
}

/**
 * Convert latitude/longitude coordinates to an H3 index
 * @param lat Latitude
 * @param lon Longitude
 * @param resolution H3 resolution (0-15). Default is 5 (~5km hexagons, city-level)
 * @returns H3 index string
 */
export function latLonToH3(lat, lon, resolution = 5) {
  return latLngToCell(lat, lon, resolution);
}

/**
 * Process a file from an input element by ID and return a Promise with the file data
 * This is called from Gleam/Lustre as an effect after the change event fires
 */
export async function processFileFromInputId(inputId) {
  console.log("processFileFromInputId called for:", inputId);

  const inputElement = document.getElementById(inputId);
  if (!inputElement) {
    console.error("Input element not found:", inputId);
    return new Error("Input element not found");
  }

  const file = inputElement.files?.[0];
  if (!file) {
    console.log("No file selected");
    return new Error("No file selected");
  }

  if (!file.type.startsWith("image/")) {
    console.log("File is not an image:", file.type);
    return new Error("File is not an image");
  }

  try {
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    console.log("Created preview URL:", previewUrl);

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const binary = Array.from(bytes).map((b) => String.fromCharCode(b)).join("");
    const base64Data = btoa(binary);

    console.log("Converted to base64, length:", base64Data.length);

    // Return Ok with file data
    return new Ok({
      preview_url: previewUrl,
      base64_data: base64Data,
      mime_type: file.type,
    });
  } catch (error) {
    console.error("Failed to process file:", error);
    return new Error(error.message || "Failed to process file");
  }
}
