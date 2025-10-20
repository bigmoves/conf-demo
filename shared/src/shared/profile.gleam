import gleam/dynamic/decode
import gleam/json
import gleam/option.{type Option}

/// Profile data type matching org.atmosphereconf.profile schema
pub type Profile {
  Profile(
    id: String,
    uri: String,
    cid: String,
    did: String,
    handle: Option(String),
    display_name: Option(String),
    description: Option(String),
    avatar_url: Option(String),
    home_town: Option(String),
    interests: Option(List(String)),
    indexed_at: String,
  )
}

pub fn profile_decoder() -> decode.Decoder(Profile) {
  use id <- decode.field("id", decode.string)
  use uri <- decode.field("uri", decode.string)
  use cid <- decode.field("cid", decode.string)
  use did <- decode.field("did", decode.string)
  use handle <- decode.field("handle", decode.optional(decode.string))
  use display_name <- decode.field("display_name", decode.optional(decode.string))
  use description <- decode.field("description", decode.optional(decode.string))
  use avatar_url <- decode.field("avatar_url", decode.optional(decode.string))
  use home_town <- decode.field("home_town", decode.optional(decode.string))
  use interests <- decode.field(
    "interests",
    decode.optional(decode.list(decode.string)),
  )
  use indexed_at <- decode.field("indexed_at", decode.string)
  decode.success(Profile(
    id:,
    uri:,
    cid:,
    did:,
    handle:,
    display_name:,
    description:,
    avatar_url:,
    home_town:,
    interests:,
    indexed_at:,
  ))
}

pub fn profile_to_json(profile: Profile) -> json.Json {
  let Profile(
    id:,
    uri:,
    cid:,
    did:,
    handle:,
    display_name:,
    description:,
    avatar_url:,
    home_town:,
    interests:,
    indexed_at:,
  ) = profile

  json.object([
    #("id", json.string(id)),
    #("uri", json.string(uri)),
    #("cid", json.string(cid)),
    #("did", json.string(did)),
    #("handle", json.nullable(handle, json.string)),
    #("display_name", json.nullable(display_name, json.string)),
    #("description", json.nullable(description, json.string)),
    #("avatar_url", json.nullable(avatar_url, json.string)),
    #("home_town", json.nullable(home_town, json.string)),
    #(
      "interests",
      json.nullable(interests, fn(list) { json.array(list, json.string) }),
    ),
    #("indexed_at", json.string(indexed_at)),
  ])
}
