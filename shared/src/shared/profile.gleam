import gleam/dynamic/decode
import gleam/json
import gleam/option.{type Option}

/// Home town data with name and H3 index
pub type HomeTown {
  HomeTown(name: String, h3_index: String)
}

/// Avatar blob data
pub type AvatarBlob {
  AvatarBlob(ref: String, mime_type: String, size: Int)
}

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
    avatar_blob: Option(AvatarBlob),
    home_town: Option(HomeTown),
    interests: Option(List(String)),
    created_at: Option(String),
    indexed_at: String,
  )
}

fn home_town_decoder() -> decode.Decoder(HomeTown) {
  use name <- decode.field("name", decode.string)
  use h3_index <- decode.field("value", decode.string)
  decode.success(HomeTown(name: name, h3_index: h3_index))
}

fn avatar_blob_decoder() -> decode.Decoder(AvatarBlob) {
  use ref <- decode.field("ref", decode.string)
  use mime_type <- decode.field("mime_type", decode.string)
  use size <- decode.field("size", decode.int)
  decode.success(AvatarBlob(ref: ref, mime_type: mime_type, size: size))
}

pub fn profile_decoder() -> decode.Decoder(Profile) {
  use id <- decode.field("id", decode.string)
  use uri <- decode.field("uri", decode.string)
  use cid <- decode.field("cid", decode.string)
  use did <- decode.field("did", decode.string)
  use handle <- decode.field("handle", decode.optional(decode.string))
  use display_name <- decode.field(
    "display_name",
    decode.optional(decode.string),
  )
  use description <- decode.field("description", decode.optional(decode.string))
  use avatar_url <- decode.field("avatar_url", decode.optional(decode.string))
  use avatar_blob <- decode.field(
    "avatar_blob",
    decode.optional(avatar_blob_decoder()),
  )
  use home_town <- decode.field(
    "home_town",
    decode.optional(home_town_decoder()),
  )
  use interests <- decode.field(
    "interests",
    decode.optional(decode.list(decode.string)),
  )
  use created_at <- decode.field("created_at", decode.optional(decode.string))
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
    avatar_blob:,
    home_town:,
    interests:,
    created_at:,
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
    avatar_blob:,
    home_town:,
    interests:,
    created_at:,
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
    #(
      "avatar_blob",
      json.nullable(avatar_blob, fn(blob) {
        json.object([
          #("ref", json.string(blob.ref)),
          #("mime_type", json.string(blob.mime_type)),
          #("size", json.int(blob.size)),
        ])
      }),
    ),
    #(
      "home_town",
      json.nullable(home_town, fn(ht) {
        json.object([
          #("name", json.string(ht.name)),
          #("value", json.string(ht.h3_index)),
        ])
      }),
    ),
    #(
      "interests",
      json.nullable(interests, fn(list) { json.array(list, json.string) }),
    ),
    #("created_at", json.nullable(created_at, json.string)),
    #("indexed_at", json.string(indexed_at)),
  ])
}
