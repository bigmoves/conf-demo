import gleam/dynamic/decode
import gleam/http
import gleam/http/request
import gleam/httpc
import gleam/json
import gleam/list
import gleam/result
import squall

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
  OrgAtmosphereconfProfile(id: String)
}

pub fn org_atmosphereconf_profile_decoder() -> decode.Decoder(OrgAtmosphereconfProfile) {
  use id <- decode.field("id", decode.string)
  decode.success(OrgAtmosphereconfProfile(id: id))
}

pub type CheckProfileExistsResponse {
  CheckProfileExistsResponse(
    org_atmosphereconf_profiles: OrgAtmosphereconfProfileConnection,
  )
}

pub fn check_profile_exists_response_decoder() -> decode.Decoder(CheckProfileExistsResponse) {
  use org_atmosphereconf_profiles <- decode.field("orgAtmosphereconfProfiles", org_atmosphereconf_profile_connection_decoder())
  decode.success(CheckProfileExistsResponse(
    org_atmosphereconf_profiles: org_atmosphereconf_profiles,
  ))
}

pub fn check_profile_exists(client: squall.Client, did: String) -> Result(CheckProfileExistsResponse, String) {
  let query =
    "query CheckProfile($did: String!) { orgAtmosphereconfProfiles(where: { did: { eq: $did } }, first: 1) { edges { node { id } } } }"
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
    use data <- decode.field("data", check_profile_exists_response_decoder())
    decode.success(data)
  }
  decode.run(json_value, data_and_response_decoder)
  |> result.map_error(fn(_) { "Failed to decode response data" })
}
