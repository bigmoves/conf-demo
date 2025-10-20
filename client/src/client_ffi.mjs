import { Error, Ok } from "./gleam.mjs";

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
