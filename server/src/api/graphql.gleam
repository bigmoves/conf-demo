import gleam/dynamic/decode
import gleam/http
import gleam/http/request
import gleam/httpc
import gleam/json
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/string
import shared/profile.{type Profile}

pub type Config {
  Config(api_url: String, slice_uri: String, access_token: String)
}

/// Fetch profile by handle from the GraphQL API
pub fn get_profile_by_handle(
  config: Config,
  handle: String,
) -> Result(Option(Profile), String) {
  let query =
    "
    query GetProfile($handle: String!) {
      orgAtmosphereconfProfiles(where: { actorHandle: { eq: $handle } }, first: 1) {
        edges {
          node {
            id
            uri
            cid
            did
            actorHandle
            displayName
            description
            avatar {
              url(preset: \"avatar\")
            }
            homeTown
            interests
            indexedAt
          }
        }
      }
    }
  "

  let variables = json.object([#("handle", json.string(handle))])

  let body_json =
    json.object([
      #("query", json.string(query)),
      #("variables", variables),
    ])

  // Build the HTTP request
  use req <- result.try(
    request.to(config.api_url)
    |> result.map_error(fn(_) { "Failed to create request" }),
  )

  let req =
    request.set_method(req, http.Post)
    |> request.set_header("content-type", "application/json")
    |> request.set_header("X-Slice-Uri", config.slice_uri)
    |> request.set_body(json.to_string(body_json))

  // Send the request
  use resp <- result.try(
    httpc.send(req)
    |> result.map_error(fn(_) { "HTTP request failed" }),
  )

  // Check status code
  case resp.status {
    200 -> parse_profile_response(resp.body)
    _ ->
      Error(
        "API returned status "
        <> string.inspect(resp.status)
        <> " with body: "
        <> resp.body,
      )
  }
}

/// Parse the GraphQL response and extract profile data
fn parse_profile_response(
  response_body: String,
) -> Result(Option(Profile), String) {
  // Parse JSON
  use data <- result.try(
    json.parse(response_body, decode.dynamic)
    |> result.map_error(fn(_) { "Failed to parse JSON response" }),
  )

  // Extract the edges array
  let edges_decoder =
    decode.at(
      ["data", "orgAtmosphereconfProfiles", "edges"],
      decode.list(decode.dynamic),
    )

  use edges <- result.try(
    decode.run(data, edges_decoder)
    |> result.map_error(fn(errors) {
      "Failed to extract edges: " <> string.inspect(errors)
    }),
  )

  // Extract first profile if exists
  case edges {
    [] -> Ok(None)
    [first_edge, ..] -> {
      // Decode the profile from edge.node.* fields
      let profile_decoder = {
        use id <- decode.subfield(["node", "id"], decode.string)
        use uri <- decode.subfield(["node", "uri"], decode.string)
        use cid <- decode.subfield(["node", "cid"], decode.string)
        use did <- decode.subfield(["node", "did"], decode.string)

        // For optional fields
        let handle = case
          decode.run(
            first_edge,
            decode.at(["node", "actorHandle"], decode.optional(decode.string)),
          )
        {
          Ok(val) -> val
          Error(_) -> None
        }

        let display_name = case
          decode.run(
            first_edge,
            decode.at(["node", "displayName"], decode.optional(decode.string)),
          )
        {
          Ok(val) -> val
          Error(_) -> None
        }

        let description = case
          decode.run(
            first_edge,
            decode.at(["node", "description"], decode.optional(decode.string)),
          )
        {
          Ok(val) -> val
          Error(_) -> None
        }

        let avatar_url = case
          decode.run(
            first_edge,
            decode.at(["node", "avatar", "url"], decode.optional(decode.string)),
          )
        {
          Ok(val) -> val
          Error(_) -> None
        }

        let home_town = case
          decode.run(
            first_edge,
            decode.at(
              ["node", "homeTown", "name"],
              decode.optional(decode.string),
            ),
          )
        {
          Ok(val) -> val
          Error(_) -> None
        }

        let interests = case
          decode.run(
            first_edge,
            decode.at(
              ["node", "interests"],
              decode.optional(decode.list(decode.string)),
            ),
          )
        {
          Ok(val) -> val
          Error(_) -> None
        }

        use indexed_at <- decode.subfield(["node", "indexedAt"], decode.string)
        decode.success(profile.Profile(
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

      use profile <- result.try(
        decode.run(first_edge, profile_decoder)
        |> result.map_error(fn(errors) {
          "Failed to decode profile: " <> string.inspect(errors)
        }),
      )
      Ok(Some(profile))
    }
  }
}

pub type ProfileUpdate {
  ProfileUpdate(
    display_name: Option(String),
    description: Option(String),
    home_town: Option(json.Json),
    interests: Option(List(String)),
  )
}

/// Update profile via GraphQL mutation
pub fn update_profile(
  config: Config,
  _handle: String,
  update: ProfileUpdate,
) -> Result(Nil, String) {
  let mutation =
    "
    mutation UpdateProfile($rkey: String!, $input: OrgAtmosphereconfProfileInput!) {
      updateOrgAtmosphereconfProfile(rkey: $rkey, input: $input) {
        id
      }
    }
  "

  // Build input object
  let input_fields = []

  let input_fields = case update.display_name {
    Some(val) -> [#("displayName", json.string(val)), ..input_fields]
    None -> input_fields
  }

  let input_fields = case update.description {
    Some(val) -> [#("description", json.string(val)), ..input_fields]
    None -> input_fields
  }

  let input_fields = case update.home_town {
    Some(val) -> [#("homeTown", val), ..input_fields]
    None -> input_fields
  }

  let input_fields = case update.interests {
    Some(val) -> [#("interests", json.array(val, json.string)), ..input_fields]
    None -> input_fields
  }

  let variables =
    json.object([
      #("rkey", json.string("self")),
      #("input", json.object(input_fields)),
    ])

  let body_json =
    json.object([
      #("query", json.string(mutation)),
      #("variables", variables),
    ])

  // Build the HTTP request
  use req <- result.try(
    request.to(config.api_url)
    |> result.map_error(fn(_) { "Failed to create request" }),
  )

  let req =
    request.set_method(req, http.Post)
    |> request.set_header("content-type", "application/json")
    |> request.set_header("X-Slice-Uri", config.slice_uri)
    |> request.set_header("Authorization", "Bearer " <> config.access_token)
    |> request.set_body(json.to_string(body_json))

  // Send the request
  use resp <- result.try(
    httpc.send(req)
    |> result.map_error(fn(_) { "HTTP request failed" }),
  )

  // Check status code
  case resp.status {
    200 -> Ok(Nil)
    _ ->
      Error(
        "API returned status "
        <> string.inspect(resp.status)
        <> " with body: "
        <> resp.body,
      )
  }
}
