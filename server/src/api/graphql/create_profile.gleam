import gleam/dynamic/decode
import gleam/http
import gleam/http/request
import gleam/httpc
import gleam/json
import gleam/list
import gleam/result
import squall
import gleam/option.{type Option, Some, None}

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

pub fn create_profile(client: squall.Client, input: OrgAtmosphereconfProfileInput, rkey: String) -> Result(CreateProfileResponse, String) {
  let query =
    "mutation CreateProfile($input: OrgAtmosphereconfProfileInput!, $rkey: String) { createOrgAtmosphereconfProfile(input: $input, rkey: $rkey) { id } }"
  let variables =
    json.object(
      [
        #("input", org_atmosphereconf_profile_input_to_json(input)),
        #("rkey", json.string(rkey)),
      ],
    )
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
    use data <- decode.field("data", create_profile_response_decoder())
    decode.success(data)
  }
  decode.run(json_value, data_and_response_decoder)
  |> result.map_error(fn(_) { "Failed to decode response data" })
}
