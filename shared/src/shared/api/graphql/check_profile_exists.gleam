import gleam/dynamic/decode
import gleam/json
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
  json.object([#("id", json.string(input.id))])
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

pub fn check_profile_exists_response_to_json(input: CheckProfileExistsResponse) -> json.Json {
  json.object(
    [
      #("orgAtmosphereconfProfiles", org_atmosphereconf_profile_connection_to_json(
        input.org_atmosphereconf_profiles,
      )),
    ],
  )
}

pub fn check_profile_exists(client: squall.Client, did: String) {
  squall.execute_query(
    client,
    "query CheckProfile($did: String!) { orgAtmosphereconfProfiles(where: { did: { eq: $did } }, first: 1) { edges { node { id } } } }",
    json.object([#("did", json.string(did))]),
    check_profile_exists_response_decoder(),
  )
}
