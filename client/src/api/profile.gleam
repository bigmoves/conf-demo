import api/graphql
import gleam/dynamic/decode
import gleam/javascript/promise
import gleam/json
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/string

/// Profile data type matching org.atmosphereconf.profile schema
pub type Profile {
  Profile(
    id: String,
    uri: String,
    cid: String,
    did: String,
    display_name: Option(String),
    description: Option(String),
    avatar_url: Option(String),
    interests: Option(List(String)),
    indexed_at: String,
  )
}

/// Fetch profile by handle from the GraphQL API
pub fn get_profile_by_handle(
  config: graphql.Config,
  handle: String,
) -> promise.Promise(Result(Option(Profile), String)) {
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
            displayName
            description
            avatar {
              url(preset: \"avatar\")
            }
            interests
            indexedAt
          }
        }
      }
    }
  "

  let variables = json.object([#("handle", json.string(handle))])

  graphql.execute_query(config, query, variables)
  |> promise.map(fn(result) {
    case result {
      Ok(response_body) -> parse_profile_response(response_body)
      Error(error) -> Error(error)
    }
  })
}

/// Parse the GraphQL response and extract profile data
fn parse_profile_response(
  response_body: String,
) -> Result(Option(Profile), String) {
  // Parse JSON
  use data <- result.try(
    json.parse(response_body, decode.dynamic)
    |> result.map_error(fn(_) { "Failed to parse JSON" }),
  )

  // Extract the edges array using decode.at to navigate nested path
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
      // Decode the profile from edge.node.* fields using subfield for nested paths
      let profile_decoder = {
        use id <- decode.subfield(["node", "id"], decode.string)
        use uri <- decode.subfield(["node", "uri"], decode.string)
        use cid <- decode.subfield(["node", "cid"], decode.string)
        use did <- decode.subfield(["node", "did"], decode.string)

        // For optional fields, use decode.at to get the value, then handle None case
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
            decode.at(
              ["node", "avatar", "url"],
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
        decode.success(Profile(
          id:,
          uri:,
          cid:,
          did:,
          display_name:,
          description:,
          avatar_url:,
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
