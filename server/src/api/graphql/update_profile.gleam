import gleam/dynamic/decode
import gleam/http
import gleam/http/request
import gleam/httpc
import gleam/json
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result
import squall

pub type OrgAtmosphereconfProfileInput {
  OrgAtmosphereconfProfileInput(
    avatar: Option(json.Json),
    created_at: Option(String),
    description: Option(String),
    display_name: Option(String),
    home_town: Option(json.Json),
    interests: Option(List(String)),
  )
}

fn org_atmosphereconf_profile_input_to_json(
  input: OrgAtmosphereconfProfileInput,
) -> json.Json {
  [
    {
      case input.avatar {
        Some(val) -> Some(#("avatar", val))
        None -> None
      }
    },
    {
      case input.created_at {
        Some(val) -> Some(#("createdAt", json.string(val)))
        None -> None
      }
    },
    {
      case input.description {
        Some(val) -> Some(#("description", json.string(val)))
        None -> None
      }
    },
    {
      case input.display_name {
        Some(val) -> Some(#("displayName", json.string(val)))
        None -> None
      }
    },
    {
      case input.home_town {
        Some(val) -> Some(#("homeTown", val))
        None -> None
      }
    },
    {
      case input.interests {
        Some(val) ->
          Some(#("interests", json.array(from: val, of: json.string)))
        None -> None
      }
    },
  ]
  |> list.filter_map(fn(x) {
    case x {
      Some(val) -> Ok(val)
      None -> Error(Nil)
    }
  })
  |> json.object
}

pub type OrgAtmosphereconfProfile {
  OrgAtmosphereconfProfile(
    id: String,
    uri: String,
    cid: String,
    did: String,
    actor_handle: Option(String),
    display_name: Option(String),
    description: Option(String),
    avatar: Option(Blob),
    home_town: Option(CommunityLexiconLocationHthree),
    interests: Option(List(String)),
    created_at: Option(String),
    indexed_at: String,
  )
}

pub fn org_atmosphereconf_profile_decoder() -> decode.Decoder(
  OrgAtmosphereconfProfile,
) {
  use id <- decode.field("id", decode.string)
  use uri <- decode.field("uri", decode.string)
  use cid <- decode.field("cid", decode.string)
  use did <- decode.field("did", decode.string)
  use actor_handle <- decode.field(
    "actorHandle",
    decode.optional(decode.string),
  )
  use display_name <- decode.field(
    "displayName",
    decode.optional(decode.string),
  )
  use description <- decode.field("description", decode.optional(decode.string))
  use avatar <- decode.field("avatar", decode.optional(blob_decoder()))
  use home_town <- decode.field(
    "homeTown",
    decode.optional(community_lexicon_location_hthree_decoder()),
  )
  use interests <- decode.field(
    "interests",
    decode.optional(decode.list(decode.string)),
  )
  use created_at <- decode.field("createdAt", decode.optional(decode.string))
  use indexed_at <- decode.field("indexedAt", decode.string)
  decode.success(OrgAtmosphereconfProfile(
    id: id,
    uri: uri,
    cid: cid,
    did: did,
    actor_handle: actor_handle,
    display_name: display_name,
    description: description,
    avatar: avatar,
    home_town: home_town,
    interests: interests,
    created_at: created_at,
    indexed_at: indexed_at,
  ))
}

pub type Blob {
  Blob(ref: String, mime_type: String, size: Int, url: String)
}

pub fn blob_decoder() -> decode.Decoder(Blob) {
  use ref <- decode.field("ref", decode.string)
  use mime_type <- decode.field("mimeType", decode.string)
  use size <- decode.field("size", decode.int)
  use url <- decode.field("url", decode.string)
  decode.success(Blob(ref: ref, mime_type: mime_type, size: size, url: url))
}

pub type CommunityLexiconLocationHthree {
  CommunityLexiconLocationHthree(name: Option(String), value: Option(String))
}

pub fn community_lexicon_location_hthree_decoder() -> decode.Decoder(
  CommunityLexiconLocationHthree,
) {
  use name <- decode.field("name", decode.optional(decode.string))
  use value <- decode.field("value", decode.optional(decode.string))
  decode.success(CommunityLexiconLocationHthree(name: name, value: value))
}

pub type UpdateProfileResponse {
  UpdateProfileResponse(
    update_org_atmosphereconf_profile: OrgAtmosphereconfProfile,
  )
}

pub fn update_profile_response_decoder() -> decode.Decoder(
  UpdateProfileResponse,
) {
  use update_org_atmosphereconf_profile <- decode.field(
    "updateOrgAtmosphereconfProfile",
    org_atmosphereconf_profile_decoder(),
  )
  decode.success(UpdateProfileResponse(
    update_org_atmosphereconf_profile: update_org_atmosphereconf_profile,
  ))
}

pub fn update_profile(
  client: squall.Client,
  rkey: String,
  input: OrgAtmosphereconfProfileInput,
) -> Result(UpdateProfileResponse, String) {
  let query =
    "mutation UpdateProfile($rkey: String!, $input: OrgAtmosphereconfProfileInput!) { updateOrgAtmosphereconfProfile(rkey: $rkey, input: $input) { id uri cid did actorHandle displayName description avatar { ref mimeType size url } homeTown { name value } interests createdAt indexedAt } }"
  let variables =
    json.object([
      #("rkey", json.string(rkey)),
      #("input", org_atmosphereconf_profile_input_to_json(input)),
    ])
  let body =
    json.object([#("query", json.string(query)), #("variables", variables)])
  use req <- result.try(
    request.to(client.endpoint)
    |> result.map_error(fn(_) { "Invalid endpoint URL" }),
  )
  let req =
    req
    |> request.set_method(http.Post)
    |> request.set_body(json.to_string(body))
    |> request.set_header("content-type", "application/json")
  let req =
    list.fold(client.headers, req, fn(r, header) {
      request.set_header(r, header.0, header.1)
    })
  use resp <- result.try(
    httpc.send(req)
    |> result.map_error(fn(_) { "HTTP request failed" }),
  )
  use json_value <- result.try(
    json.parse(from: resp.body, using: decode.dynamic)
    |> result.map_error(fn(_) { "Failed to decode JSON response" }),
  )
  let data_and_response_decoder = {
    use data <- decode.field("data", update_profile_response_decoder())
    decode.success(data)
  }
  decode.run(json_value, data_and_response_decoder)
  |> result.map_error(fn(_) { "Failed to decode response data" })
}
