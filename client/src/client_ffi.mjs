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
 * Debounce helper - executes callback after delay
 * Returns a function that can be called to cancel the timeout
 */
let debounceTimer = null;

export function debounce(callback, delay) {
  // Clear any existing timer
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }

  // Set new timer
  debounceTimer = setTimeout(() => {
    callback();
    debounceTimer = null;
  }, delay);

  // Return cancel function
  return () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };
}
