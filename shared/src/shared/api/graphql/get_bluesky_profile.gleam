import gleam/dynamic/decode
import gleam/json
import squall
import gleam/option.{type Option}

pub type AppBskyActorProfileConnection {
  AppBskyActorProfileConnection(edges: List(AppBskyActorProfileEdge))
}

pub fn app_bsky_actor_profile_connection_decoder() -> decode.Decoder(AppBskyActorProfileConnection) {
  use edges <- decode.field("edges", decode.list(app_bsky_actor_profile_edge_decoder()))
  decode.success(AppBskyActorProfileConnection(edges: edges))
}

pub type AppBskyActorProfileEdge {
  AppBskyActorProfileEdge(node: AppBskyActorProfile)
}

pub fn app_bsky_actor_profile_edge_decoder() -> decode.Decoder(AppBskyActorProfileEdge) {
  use node <- decode.field("node", app_bsky_actor_profile_decoder())
  decode.success(AppBskyActorProfileEdge(node: node))
}

pub type AppBskyActorProfile {
  AppBskyActorProfile(
    display_name: Option(String),
    description: Option(String),
    avatar: Option(Blob),
  )
}

pub fn app_bsky_actor_profile_decoder() -> decode.Decoder(AppBskyActorProfile) {
  use display_name <- decode.field("displayName", decode.optional(decode.string))
  use description <- decode.field("description", decode.optional(decode.string))
  use avatar <- decode.field("avatar", decode.optional(blob_decoder()))
  decode.success(AppBskyActorProfile(
    display_name: display_name,
    description: description,
    avatar: avatar,
  ))
}

pub type Blob {
  Blob(ref: String, mime_type: String, size: Int)
}

pub fn blob_decoder() -> decode.Decoder(Blob) {
  use ref <- decode.field("ref", decode.string)
  use mime_type <- decode.field("mimeType", decode.string)
  use size <- decode.field("size", decode.int)
  decode.success(Blob(ref: ref, mime_type: mime_type, size: size))
}

pub fn app_bsky_actor_profile_connection_to_json(input: AppBskyActorProfileConnection) -> json.Json {
  json.object(
    [
      #("edges", json.array(
        from: input.edges,
        of: app_bsky_actor_profile_edge_to_json,
      )),
    ],
  )
}

pub fn app_bsky_actor_profile_edge_to_json(input: AppBskyActorProfileEdge) -> json.Json {
  json.object([#("node", app_bsky_actor_profile_to_json(input.node))])
}

pub fn app_bsky_actor_profile_to_json(input: AppBskyActorProfile) -> json.Json {
  json.object(
    [
      #("displayName", json.nullable(input.display_name, json.string)),
      #("description", json.nullable(input.description, json.string)),
      #("avatar", json.nullable(input.avatar, blob_to_json)),
    ],
  )
}

pub fn blob_to_json(input: Blob) -> json.Json {
  json.object(
    [
      #("ref", json.string(input.ref)),
      #("mimeType", json.string(input.mime_type)),
      #("size", json.int(input.size)),
    ],
  )
}

pub type GetBlueskyProfileResponse {
  GetBlueskyProfileResponse(
    app_bsky_actor_profiles: AppBskyActorProfileConnection,
  )
}

pub fn get_bluesky_profile_response_decoder() -> decode.Decoder(GetBlueskyProfileResponse) {
  use app_bsky_actor_profiles <- decode.field("appBskyActorProfiles", app_bsky_actor_profile_connection_decoder())
  decode.success(GetBlueskyProfileResponse(
    app_bsky_actor_profiles: app_bsky_actor_profiles,
  ))
}

pub fn get_bluesky_profile_response_to_json(input: GetBlueskyProfileResponse) -> json.Json {
  json.object(
    [
      #("appBskyActorProfiles", app_bsky_actor_profile_connection_to_json(
        input.app_bsky_actor_profiles,
      )),
    ],
  )
}

pub fn get_bluesky_profile(client: squall.Client, did: String) {
  squall.execute_query(
    client,
    "query GetBskyProfile($did: String!) { appBskyActorProfiles(where: { did: { eq: $did } }, first: 1) { edges { node { displayName description avatar { ref mimeType size } } } } }",
    json.object([#("did", json.string(did))]),
    get_bluesky_profile_response_decoder(),
  )
}
