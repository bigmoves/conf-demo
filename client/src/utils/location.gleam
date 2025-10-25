import gleam/dynamic.{type Dynamic}
import gleam/dynamic/decode
import gleam/javascript/promise.{type Promise}
import gleam/option

pub type NominatimResult {
  NominatimResult(
    display_name: String,
    lat: String,
    lon: String,
    place_id: Int,
    address: NominatimAddress,
  )
}

pub type NominatimAddress {
  NominatimAddress(city: String, state: String, country: String)
}

pub type LocationData {
  LocationData(name: String, lat: Float, lon: Float, h3_index: String)
}

/// Search for locations using Nominatim API
@external(javascript, "../client_ffi.mjs", "searchLocations")
pub fn search_locations(query: String) -> Promise(Result(List(Dynamic), String))

/// Convert lat/lon to H3 index
@external(javascript, "../client_ffi.mjs", "latLonToH3")
pub fn lat_lon_to_h3(lat: Float, lon: Float) -> String

// Decoder for NominatimAddress
pub fn nominatim_address_decoder() -> decode.Decoder(NominatimAddress) {
  use city <- decode.field("city", decode.optional(decode.string))
  use state <- decode.field("state", decode.optional(decode.string))
  use country <- decode.field("country", decode.optional(decode.string))
  decode.success(NominatimAddress(
    city: option.unwrap(city, ""),
    state: option.unwrap(state, ""),
    country: option.unwrap(country, ""),
  ))
}

// Decoder for NominatimResult
pub fn nominatim_result_decoder() -> decode.Decoder(NominatimResult) {
  use display_name <- decode.field("display_name", decode.string)
  use lat <- decode.field("lat", decode.string)
  use lon <- decode.field("lon", decode.string)
  use place_id <- decode.field("place_id", decode.int)
  use address <- decode.field("address", nominatim_address_decoder())
  decode.success(NominatimResult(
    display_name: display_name,
    lat: lat,
    lon: lon,
    place_id: place_id,
    address: address,
  ))
}
