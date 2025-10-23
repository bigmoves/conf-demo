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
              ref
              mimeType
              size
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

/// Decode a profile from GraphQL format (with camelCase fields)
/// The data should be positioned at the profile node level
fn decode_graphql_profile(data: decode.Dynamic) -> decode.Decoder(Profile) {
  use id <- decode.field("id", decode.string)
  use uri <- decode.field("uri", decode.string)
  use cid <- decode.field("cid", decode.string)
  use did <- decode.field("did", decode.string)

  // For optional fields, extract them manually
  let handle = case
    decode.run(data, decode.at(["actorHandle"], decode.optional(decode.string)))
  {
    Ok(val) -> val
    Error(_) -> None
  }

  let display_name = case
    decode.run(data, decode.at(["displayName"], decode.optional(decode.string)))
  {
    Ok(val) -> val
    Error(_) -> None
  }

  let description = case
    decode.run(data, decode.at(["description"], decode.optional(decode.string)))
  {
    Ok(val) -> val
    Error(_) -> None
  }

  let avatar_url = case
    decode.run(
      data,
      decode.at(["avatar", "url"], decode.optional(decode.string)),
    )
  {
    Ok(val) -> val
    Error(_) -> None
  }

  let avatar_blob = case
    decode.run(
      data,
      decode.at(
        ["avatar"],
        decode.optional({
          use ref <- decode.field("ref", decode.string)
          use mime_type <- decode.field("mimeType", decode.string)
          use size <- decode.field("size", decode.int)
          decode.success(profile.AvatarBlob(
            ref: ref,
            mime_type: mime_type,
            size: size,
          ))
        }),
      ),
    )
  {
    Ok(val) -> val
    Error(_) -> None
  }

  let home_town = case
    decode.run(
      data,
      decode.at(
        ["homeTown"],
        decode.optional({
          use name <- decode.field("name", decode.string)
          use value <- decode.field("value", decode.string)
          decode.success(profile.HomeTown(name: name, h3_index: value))
        }),
      ),
    )
  {
    Ok(val) -> val
    Error(_) -> None
  }

  let interests = case
    decode.run(
      data,
      decode.at(["interests"], decode.optional(decode.list(decode.string))),
    )
  {
    Ok(val) -> val
    Error(_) -> None
  }

  use indexed_at <- decode.field("indexedAt", decode.string)
  decode.success(profile.Profile(
    id:,
    uri:,
    cid:,
    did:,
    handle:,
    display_name:,
    description:,
    avatar_url:,
    avatar_blob:,
    home_town:,
    interests:,
    indexed_at:,
  ))
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

        // Decode avatar blob (ref, mimeType, size)
        let avatar_blob = case
          decode.run(
            first_edge,
            decode.at(
              ["node", "avatar"],
              decode.optional({
                use ref <- decode.field("ref", decode.string)
                use mime_type <- decode.field("mimeType", decode.string)
                use size <- decode.field("size", decode.int)
                decode.success(profile.AvatarBlob(
                  ref: ref,
                  mime_type: mime_type,
                  size: size,
                ))
              }),
            ),
          )
        {
          Ok(val) -> val
          Error(_) -> None
        }

        let home_town = case
          decode.run(
            first_edge,
            decode.at(
              ["node", "homeTown"],
              decode.optional({
                use name <- decode.field("name", decode.string)
                use value <- decode.field("value", decode.string)
                decode.success(profile.HomeTown(name: name, h3_index: value))
              }),
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
          avatar_blob:,
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
    avatar: Option(json.Json),
  )
}

/// Upload a blob (e.g., avatar image) and return the blob reference
pub fn upload_blob(
  config: Config,
  base64_data: String,
  mime_type: String,
) -> Result(json.Json, String) {
  let mutation =
    "
    mutation UploadBlob($data: String!, $mimeType: String!) {
      uploadBlob(data: $data, mimeType: $mimeType) {
        blob
      }
    }
  "

  let variables =
    json.object([
      #("data", json.string(base64_data)),
      #("mimeType", json.string(mime_type)),
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
    200 -> {
      // Parse the response to extract the blob object
      // The blob is returned as a JSON object with fields like ref, mimeType, size
      use parsed <- result.try(
        json.parse(resp.body, decode.dynamic)
        |> result.map_error(fn(_) { "Failed to parse blob response" }),
      )

      // Extract the blob field as a dynamic value
      use blob_data <- result.try(
        decode.run(parsed, decode.at(["data", "uploadBlob", "blob"], decode.dynamic))
        |> result.map_error(fn(_) { "Failed to extract blob from response" }),
      )

      // The blob structure is:
      // { "$type": "blob", "mimeType": "...", "ref": { "$link": "..." }, "size": 123 }

      // Decode the nested $link from ref.$link
      let link_decoder = {
        use link <- decode.subfield(["ref", "$link"], decode.string)
        decode.success(link)
      }

      use cid_link <- result.try(
        decode.run(blob_data, link_decoder)
        |> result.map_error(fn(errors) {
          "Failed to extract $link from ref: " <> string.inspect(errors)
        }),
      )

      let mime_decoder = {
        use mime <- decode.field("mimeType", decode.string)
        decode.success(mime)
      }

      let mime_type = case decode.run(blob_data, mime_decoder) {
        Ok(val) -> val
        Error(_) -> "application/octet-stream"
      }

      let size_decoder = {
        use s <- decode.field("size", decode.int)
        decode.success(s)
      }

      let size = case decode.run(blob_data, size_decoder) {
        Ok(val) -> val
        Error(_) -> 0
      }

      // Reconstruct as json.Json with the ref nested structure
      Ok(json.object([
        #("$type", json.string("blob")),
        #("mimeType", json.string(mime_type)),
        #("ref", json.object([#("$link", json.string(cid_link))])),
        #("size", json.int(size)),
      ]))
    }
    _ ->
      Error(
        "Blob upload returned status "
        <> string.inspect(resp.status)
        <> " with body: "
        <> resp.body,
      )
  }
}

/// Update profile via GraphQL mutation
pub fn update_profile(
  config: Config,
  _handle: String,
  update: ProfileUpdate,
) -> Result(profile.Profile, String) {
  let mutation =
    "
    mutation UpdateProfile($rkey: String!, $input: OrgAtmosphereconfProfileInput!) {
      updateOrgAtmosphereconfProfile(rkey: $rkey, input: $input) {
        id
        uri
        cid
        did
        actorHandle
        displayName
        description
        avatar {
          ref
          mimeType
          size
          url
        }
        homeTown
        interests
        indexedAt
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

  let input_fields = case update.avatar {
    Some(val) -> [#("avatar", val), ..input_fields]
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

  // Check status code and parse response
  case resp.status {
    200 -> {
      // Parse JSON and extract the profile node
      use data <- result.try(
        json.parse(resp.body, decode.dynamic)
        |> result.map_error(fn(_) { "Failed to parse JSON response" }),
      )

      // Extract the profile node from data.updateOrgAtmosphereconfProfile
      use profile_node <- result.try(
        decode.run(
          data,
          decode.at(["data", "updateOrgAtmosphereconfProfile"], decode.dynamic),
        )
        |> result.map_error(fn(errors) {
          "Failed to extract updateOrgAtmosphereconfProfile: "
          <> string.inspect(errors)
        }),
      )

      // Decode the profile using the reusable decoder
      decode.run(profile_node, decode_graphql_profile(profile_node))
      |> result.map_error(fn(errors) {
        "Failed to decode profile: " <> string.inspect(errors)
      })
    }
    _ ->
      Error(
        "API returned status "
        <> string.inspect(resp.status)
        <> " with body: "
        <> resp.body,
      )
  }
}

// PROFILE INITIALIZATION HELPERS ----------------------------------------------

pub type BlueskyProfile {
  BlueskyProfile(
    display_name: Option(String),
    description: Option(String),
    avatar: Option(BlueskyAvatar),
  )
}

pub type BlueskyAvatar {
  BlueskyAvatar(ref: String, mime_type: String, size: Int)
}

/// Check if a profile already exists for the given DID
pub fn check_profile_exists(config: Config, did: String) -> Result(Bool, String) {
  let query =
    "
    query CheckProfile($did: String!) {
      orgAtmosphereconfProfiles(where: { did: { eq: $did } }, first: 1) {
        edges {
          node {
            id
          }
        }
      }
    }
  "

  let variables = json.object([#("did", json.string(did))])

  let body_json =
    json.object([
      #("query", json.string(query)),
      #("variables", variables),
    ])

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

  use resp <- result.try(
    httpc.send(req)
    |> result.map_error(fn(_) { "HTTP request failed" }),
  )

  case resp.status {
    200 -> {
      use data <- result.try(
        json.parse(resp.body, decode.dynamic)
        |> result.map_error(fn(_) { "Failed to parse JSON response" }),
      )

      let edges_decoder =
        decode.at(
          ["data", "orgAtmosphereconfProfiles", "edges"],
          decode.list(decode.dynamic),
        )

      use edges <- result.try(
        decode.run(data, edges_decoder)
        |> result.map_error(fn(_) { "Failed to extract edges" }),
      )

      case edges {
        [] -> Ok(False)
        _ -> Ok(True)
      }
    }
    _ ->
      Error(
        "API returned status "
        <> string.inspect(resp.status)
        <> " with body: "
        <> resp.body,
      )
  }
}

/// Sync user collections (Bluesky data)
pub fn sync_user_collections(config: Config, did: String) -> Result(Nil, String) {
  let mutation =
    "
    mutation SyncUserCollections($did: String!) {
      syncUserCollections(did: $did) {
        success
        message
      }
    }
  "

  let variables = json.object([#("did", json.string(did))])

  let body_json =
    json.object([
      #("query", json.string(mutation)),
      #("variables", variables),
    ])

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

  use resp <- result.try(
    httpc.send(req)
    |> result.map_error(fn(_) { "HTTP request failed" }),
  )

  case resp.status {
    200 -> Ok(Nil)
    _ ->
      Error(
        "Sync failed with status "
        <> string.inspect(resp.status)
        <> " with body: "
        <> resp.body,
      )
  }
}

/// Fetch Bluesky profile data
pub fn get_bluesky_profile(
  config: Config,
  did: String,
) -> Result(Option(BlueskyProfile), String) {
  let query =
    "
    query GetBskyProfile($did: String!) {
      appBskyActorProfiles(where: { did: { eq: $did } }, first: 1) {
        edges {
          node {
            displayName
            description
            avatar {
              ref
              mimeType
              size
            }
          }
        }
      }
    }
  "

  let variables = json.object([#("did", json.string(did))])

  let body_json =
    json.object([
      #("query", json.string(query)),
      #("variables", variables),
    ])

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

  use resp <- result.try(
    httpc.send(req)
    |> result.map_error(fn(_) { "HTTP request failed" }),
  )

  case resp.status {
    200 -> {
      use data <- result.try(
        json.parse(resp.body, decode.dynamic)
        |> result.map_error(fn(_) { "Failed to parse JSON response" }),
      )

      let edges_decoder =
        decode.at(
          ["data", "appBskyActorProfiles", "edges"],
          decode.list(decode.dynamic),
        )

      use edges <- result.try(
        decode.run(data, edges_decoder)
        |> result.map_error(fn(_) { "Failed to extract edges" }),
      )

      case edges {
        [] -> Ok(None)
        [first_edge, ..] -> {
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

          let avatar = case
            decode.run(
              first_edge,
              decode.at(
                ["node", "avatar"],
                decode.optional({
                  use ref <- decode.field("ref", decode.string)
                  use mime_type <- decode.field("mimeType", decode.string)
                  use size <- decode.field("size", decode.int)
                  decode.success(BlueskyAvatar(
                    ref: ref,
                    mime_type: mime_type,
                    size: size,
                  ))
                }),
              ),
            )
          {
            Ok(val) -> val
            Error(_) -> None
          }

          Ok(Some(BlueskyProfile(
            display_name: display_name,
            description: description,
            avatar: avatar,
          )))
        }
      }
    }
    _ ->
      Error(
        "API returned status "
        <> string.inspect(resp.status)
        <> " with body: "
        <> resp.body,
      )
  }
}

pub type ProfileInput {
  ProfileInput(
    display_name: String,
    description: Option(String),
    avatar: Option(json.Json),
    created_at: String,
  )
}

/// Create a new profile
pub fn create_profile(
  config: Config,
  input: ProfileInput,
) -> Result(Nil, String) {
  let mutation =
    "
    mutation CreateProfile(
      $input: OrgAtmosphereconfProfileInput!
      $rkey: String
    ) {
      createOrgAtmosphereconfProfile(input: $input, rkey: $rkey) {
        id
      }
    }
  "

  // Build input object
  let input_fields = [#("displayName", json.string(input.display_name))]

  let input_fields = case input.description {
    Some(val) -> [#("description", json.string(val)), ..input_fields]
    None -> input_fields
  }

  let input_fields = case input.avatar {
    Some(val) -> [#("avatar", val), ..input_fields]
    None -> input_fields
  }

  let input_fields = [
    #("createdAt", json.string(input.created_at)),
    ..input_fields
  ]

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

  use resp <- result.try(
    httpc.send(req)
    |> result.map_error(fn(_) { "HTTP request failed" }),
  )

  case resp.status {
    200 -> Ok(Nil)
    _ ->
      Error(
        "Create profile failed with status "
        <> string.inspect(resp.status)
        <> " with body: "
        <> resp.body,
      )
  }
}
