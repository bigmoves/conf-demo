import gleam/dynamic/decode
import gleam/json
import squall
import gleam/option.{type Option}

pub type OrgAtmosphereconfProfileConnection {
  OrgAtmosphereconfProfileConnection(edges: List(OrgAtmosphereconfProfileEdge))
}

pub fn org_atmosphereconf_profile_connection_decoder() -> decode.Decoder(OrgAtmosphereconfProfileConnection) {
  use edges <- decode.field("edges", decode.list(org_atmosphereconf_profile_edge_decoder()))
  decode.success(OrgAtmosphereconfProfileConnection(edges: edges))
}

pub type OrgAtmosphereconfProfileEdge {
  OrgAtmosphereconfProfileEdge(node: OrgAtmosphereconfProfile)
}

pub fn org_atmosphereconf_profile_edge_decoder() -> decode.Decoder(OrgAtmosphereconfProfileEdge) {
  use node <- decode.field("node", org_atmosphereconf_profile_decoder())
  decode.success(OrgAtmosphereconfProfileEdge(node: node))
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

pub fn org_atmosphereconf_profile_decoder() -> decode.Decoder(OrgAtmosphereconfProfile) {
  use id <- decode.field("id", decode.string)
  use uri <- decode.field("uri", decode.string)
  use cid <- decode.field("cid", decode.string)
  use did <- decode.field("did", decode.string)
  use actor_handle <- decode.field("actorHandle", decode.optional(decode.string))
  use display_name <- decode.field("displayName", decode.optional(decode.string))
  use description <- decode.field("description", decode.optional(decode.string))
  use avatar <- decode.field("avatar", decode.optional(blob_decoder()))
  use home_town <- decode.field("homeTown", decode.optional(community_lexicon_location_hthree_decoder()))
  use interests <- decode.field("interests", decode.optional(decode.list(decode.string)))
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

pub fn community_lexicon_location_hthree_decoder() -> decode.Decoder(CommunityLexiconLocationHthree) {
  use name <- decode.field("name", decode.optional(decode.string))
  use value <- decode.field("value", decode.optional(decode.string))
  decode.success(CommunityLexiconLocationHthree(name: name, value: value))
}

pub fn org_atmosphereconf_profile_connection_to_json(input: OrgAtmosphereconfProfileConnection) -> json.Json {
  json.object(
    [
      #("edges", json.array(
        from: input.edges,
        of: org_atmosphereconf_profile_edge_to_json,
      )),
    ],
  )
}

pub fn org_atmosphereconf_profile_edge_to_json(input: OrgAtmosphereconfProfileEdge) -> json.Json {
  json.object([#("node", org_atmosphereconf_profile_to_json(input.node))])
}

pub fn org_atmosphereconf_profile_to_json(input: OrgAtmosphereconfProfile) -> json.Json {
  json.object(
    [
      #("id", json.string(input.id)),
      #("uri", json.string(input.uri)),
      #("cid", json.string(input.cid)),
      #("did", json.string(input.did)),
      #("actorHandle", json.nullable(input.actor_handle, json.string)),
      #("displayName", json.nullable(input.display_name, json.string)),
      #("description", json.nullable(input.description, json.string)),
      #("avatar", json.nullable(input.avatar, blob_to_json)),
      #("homeTown", json.nullable(
        input.home_town,
        community_lexicon_location_hthree_to_json,
      )),
      #("interests", json.nullable(
        input.interests,
        fn(list) { json.array(from: list, of: json.string) },
      )),
      #("createdAt", json.nullable(input.created_at, json.string)),
      #("indexedAt", json.string(input.indexed_at)),
    ],
  )
}

pub fn blob_to_json(input: Blob) -> json.Json {
  json.object(
    [
      #("ref", json.string(input.ref)),
      #("mimeType", json.string(input.mime_type)),
      #("size", json.int(input.size)),
      #("url", json.string(input.url)),
    ],
  )
}

pub fn community_lexicon_location_hthree_to_json(input: CommunityLexiconLocationHthree) -> json.Json {
  json.object(
    [
      #("name", json.nullable(input.name, json.string)),
      #("value", json.nullable(input.value, json.string)),
    ],
  )
}

pub type GetProfileResponse {
  GetProfileResponse(
    org_atmosphereconf_profiles: OrgAtmosphereconfProfileConnection,
  )
}

pub fn get_profile_response_decoder() -> decode.Decoder(GetProfileResponse) {
  use org_atmosphereconf_profiles <- decode.field("orgAtmosphereconfProfiles", org_atmosphereconf_profile_connection_decoder())
  decode.success(GetProfileResponse(
    org_atmosphereconf_profiles: org_atmosphereconf_profiles,
  ))
}

pub fn get_profile_response_to_json(input: GetProfileResponse) -> json.Json {
  json.object(
    [
      #("orgAtmosphereconfProfiles", org_atmosphereconf_profile_connection_to_json(
        input.org_atmosphereconf_profiles,
      )),
    ],
  )
}

pub fn get_profile(client: squall.Client, handle: String) {
  squall.execute_query(
    client,
    "query GetProfile($handle: String!) { orgAtmosphereconfProfiles(where: { actorHandle: { eq: $handle } }, first: 1) { edges { node { id uri cid did actorHandle displayName description avatar { ref mimeType size url(preset: \"avatar\") } homeTown { name value } interests createdAt indexedAt } } } }",
    json.object([#("handle", json.string(handle))]),
    get_profile_response_decoder(),
  )
}
