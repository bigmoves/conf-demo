import gleam/dynamic/decode
import gleam/http
import gleam/http/request
import gleam/httpc
import gleam/json
import gleam/list
import gleam/result
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

pub fn get_bluesky_profile(client: squall.Client, did: String) -> Result(GetBlueskyProfileResponse, String) {
  let query =
    "query GetBskyProfile($did: String!) { appBskyActorProfiles(where: { did: { eq: $did } }, first: 1) { edges { node { displayName description avatar { ref mimeType size } } } } }"
  let variables =
    json.object([#("did", json.string(did))])
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
    use data <- decode.field("data", get_bluesky_profile_response_decoder())
    decode.success(data)
  }
  decode.run(json_value, data_and_response_decoder)
  |> result.map_error(fn(_) { "Failed to decode response data" })
}
