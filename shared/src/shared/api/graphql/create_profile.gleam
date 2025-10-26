import gleam/dynamic/decode
import gleam/json
import squall
import gleam/option.{type Option, Some, None}
import gleam/list

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

fn org_atmosphereconf_profile_input_to_json(input: OrgAtmosphereconfProfileInput) -> json.Json {
  [{
      case input.avatar {
        Some(val) -> Some(#("avatar", val))
        None -> None
      }
    }, {
      case input.created_at {
        Some(val) -> Some(#("createdAt", json.string(val)))
        None -> None
      }
    }, {
      case input.description {
        Some(val) -> Some(#("description", json.string(val)))
        None -> None
      }
    }, {
      case input.display_name {
        Some(val) -> Some(#("displayName", json.string(val)))
        None -> None
      }
    }, {
      case input.home_town {
        Some(val) -> Some(#("homeTown", val))
        None -> None
      }
    }, {
      case input.interests {
        Some(val) -> Some(#("interests", json.array(from: val, of: json.string)))
        None -> None
      }
    }]
  |> list.filter_map(fn(x) {
    case x {
      Some(val) -> Ok(val)
      None -> Error(Nil)
    }
  })
  |> json.object
}

pub type OrgAtmosphereconfProfile {
  OrgAtmosphereconfProfile(id: String)
}

pub fn org_atmosphereconf_profile_decoder() -> decode.Decoder(OrgAtmosphereconfProfile) {
  use id <- decode.field("id", decode.string)
  decode.success(OrgAtmosphereconfProfile(id: id))
}

pub fn org_atmosphereconf_profile_to_json(input: OrgAtmosphereconfProfile) -> json.Json {
  json.object([#("id", json.string(input.id))])
}

pub type CreateProfileResponse {
  CreateProfileResponse(
    create_org_atmosphereconf_profile: OrgAtmosphereconfProfile,
  )
}

pub fn create_profile_response_decoder() -> decode.Decoder(CreateProfileResponse) {
  use create_org_atmosphereconf_profile <- decode.field("createOrgAtmosphereconfProfile", org_atmosphereconf_profile_decoder())
  decode.success(CreateProfileResponse(
    create_org_atmosphereconf_profile: create_org_atmosphereconf_profile,
  ))
}

pub fn create_profile_response_to_json(input: CreateProfileResponse) -> json.Json {
  json.object(
    [
      #("createOrgAtmosphereconfProfile", org_atmosphereconf_profile_to_json(
        input.create_org_atmosphereconf_profile,
      )),
    ],
  )
}

pub fn create_profile(client: squall.Client, input: OrgAtmosphereconfProfileInput, rkey: String) {
  squall.execute_query(
    client,
    "mutation CreateProfile($input: OrgAtmosphereconfProfileInput!, $rkey: String) { createOrgAtmosphereconfProfile(input: $input, rkey: $rkey) { id } }",
    json.object(
      [
        #("input", org_atmosphereconf_profile_input_to_json(input)),
        #("rkey", json.string(rkey)),
      ],
    ),
    create_profile_response_decoder(),
  )
}
