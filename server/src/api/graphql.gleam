import api/graphql/check_profile_exists
import api/graphql/create_profile as create_profile_gql
import api/graphql/get_bluesky_profile
import api/graphql/get_profile as get_profile_gql
import api/graphql/list_profiles as list_profiles_gql
import api/graphql/sync_user_collections
import api/graphql/update_profile as update_profile_gql
import api/graphql/upload_blob as upload_blob_gql
import gleam/json
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result
import shared/profile.{type Profile}
import squall

pub type Config {
  Config(api_url: String, slice_uri: String, access_token: String)
}

/// Create a squall client from our config
fn create_client(config: Config) -> squall.Client {
  squall.new_client(config.api_url, [
    #("X-Slice-Uri", config.slice_uri),
    #("Authorization", "Bearer " <> config.access_token),
  ])
}

/// Fetch profile by handle from the GraphQL API
pub fn get_profile_by_handle(
  config: Config,
  handle: String,
) -> Result(Option(Profile), String) {
  let client = create_client(config)

  use response <- result.try(get_profile_gql.get_profile(client, handle))

  // Convert the generated response to our Profile type
  case response.org_atmosphereconf_profiles.edges {
    [] -> Ok(None)
    [first_edge, ..] -> {
      let node = first_edge.node

      // Convert avatar from generated Blob type to our AvatarBlob type
      let avatar_blob = case node.avatar {
        Some(blob) ->
          Some(profile.AvatarBlob(
            ref: blob.ref,
            mime_type: blob.mime_type,
            size: blob.size,
          ))
        None -> None
      }

      // Convert home_town from generated type to HomeTown type
      let home_town = case node.home_town {
        Some(ht) -> convert_home_town(ht)
        None -> None
      }

      Ok(
        Some(profile.Profile(
          id: node.id,
          uri: node.uri,
          cid: node.cid,
          did: node.did,
          handle: node.actor_handle,
          display_name: node.display_name,
          description: node.description,
          avatar_url: case node.avatar {
            Some(blob) -> Some(blob.url)
            None -> None
          },
          avatar_blob: avatar_blob,
          home_town: home_town,
          interests: node.interests,
          created_at: node.created_at,
          indexed_at: node.indexed_at,
        )),
      )
    }
  }
}

/// Convert generated CommunityLexiconLocationHthree to HomeTown type
fn convert_home_town(
  ht: get_profile_gql.CommunityLexiconLocationHthree,
) -> Option(profile.HomeTown) {
  case ht.name, ht.value {
    Some(name), Some(value) -> Some(profile.HomeTown(name: name, h3_index: value))
    _, _ -> None
  }
}

/// Convert update_profile's CommunityLexiconLocationHthree to HomeTown type
fn convert_home_town_from_update(
  ht: update_profile_gql.CommunityLexiconLocationHthree,
) -> Option(profile.HomeTown) {
  case ht.name, ht.value {
    Some(name), Some(value) -> Some(profile.HomeTown(name: name, h3_index: value))
    _, _ -> None
  }
}

// Re-export the generated input type for convenience
pub type ProfileUpdate =
  update_profile_gql.OrgAtmosphereconfProfileInput

/// Upload a blob (e.g., avatar image) and return the blob reference
pub fn upload_blob(
  config: Config,
  base64_data: String,
  mime_type: String,
) -> Result(json.Json, String) {
  let client = create_client(config)

  use response <- result.try(upload_blob_gql.upload_blob(
    client,
    base64_data,
    mime_type,
  ))

  // Extract blob fields directly from the typed response
  let blob = response.upload_blob.blob

  // Reconstruct as json.Json with flat ref string
  Ok(
    json.object([
      #("$type", json.string("blob")),
      #("ref", json.string(blob.ref)),
      #("mimeType", json.string(blob.mime_type)),
      #("size", json.int(blob.size)),
    ]),
  )
}

/// Update profile via GraphQL mutation
pub fn update_profile(
  config: Config,
  _handle: String,
  update: ProfileUpdate,
) -> Result(profile.Profile, String) {
  let client = create_client(config)

  // Use the generated function directly
  use response <- result.try(update_profile_gql.update_profile(
    client,
    "self",
    update,
  ))

  // Convert generated type to our Profile type
  let node = response.update_org_atmosphereconf_profile
  Ok(convert_generated_profile_to_profile(node))
}

/// Helper to convert generated profile type to our Profile type
fn convert_generated_profile_to_profile(
  node: update_profile_gql.OrgAtmosphereconfProfile,
) -> profile.Profile {
  let avatar_blob = case node.avatar {
    Some(blob) ->
      Some(profile.AvatarBlob(
        ref: blob.ref,
        mime_type: blob.mime_type,
        size: blob.size,
      ))
    None -> None
  }

  let home_town = case node.home_town {
    Some(ht) -> convert_home_town_from_update(ht)
    None -> None
  }

  profile.Profile(
    id: node.id,
    uri: node.uri,
    cid: node.cid,
    did: node.did,
    handle: node.actor_handle,
    display_name: node.display_name,
    description: node.description,
    avatar_url: case node.avatar {
      Some(blob) -> Some(blob.url)
      None -> None
    },
    avatar_blob: avatar_blob,
    home_town: home_town,
    interests: node.interests,
    created_at: node.created_at,
    indexed_at: node.indexed_at,
  )
}

// PROFILE INITIALIZATION HELPERS ----------------------------------------------

// Re-export generated types with semantic names
pub type BlueskyProfile =
  get_bluesky_profile.AppBskyActorProfile

pub type BlueskyAvatar =
  get_bluesky_profile.Blob

/// Check if a profile already exists for the given DID
pub fn check_profile_exists(config: Config, did: String) -> Result(Bool, String) {
  let client = create_client(config)

  use response <- result.try(check_profile_exists.check_profile_exists(
    client,
    did,
  ))

  case response.org_atmosphereconf_profiles.edges {
    [] -> Ok(False)
    _ -> Ok(True)
  }
}

/// Sync user collections (Bluesky data)
pub fn sync_user_collections(config: Config, did: String) -> Result(Nil, String) {
  let client = create_client(config)

  use _response <- result.try(sync_user_collections.sync_user_collections(
    client,
    did,
  ))

  Ok(Nil)
}

/// Fetch Bluesky profile data
pub fn get_bluesky_profile(
  config: Config,
  did: String,
) -> Result(Option(BlueskyProfile), String) {
  let client = create_client(config)

  use response <- result.try(get_bluesky_profile.get_bluesky_profile(
    client,
    did,
  ))

  case response.app_bsky_actor_profiles.edges {
    [] -> Ok(None)
    [first_edge, ..] -> Ok(Some(first_edge.node))
  }
}

// Re-export the same input type for create operations (it's the same as ProfileUpdate)
pub type ProfileInput =
  create_profile_gql.OrgAtmosphereconfProfileInput

/// Create a new profile
pub fn create_profile(
  config: Config,
  input: ProfileInput,
) -> Result(Nil, String) {
  let client = create_client(config)

  use _response <- result.try(create_profile_gql.create_profile(
    client,
    input,
    "self",
  ))

  Ok(Nil)
}

/// List all profiles
pub fn list_profiles(config: Config) -> Result(List(Profile), String) {
  let client = create_client(config)

  use response <- result.try(list_profiles_gql.list_profiles(client))

  // Convert all profiles from generated types to our Profile type
  let profiles =
    response.org_atmosphereconf_profiles.edges
    |> list.map(fn(edge) {
      let node = edge.node

      // Convert avatar from generated Blob type to our AvatarBlob type
      let avatar_blob = case node.avatar {
        Some(blob) ->
          Some(profile.AvatarBlob(
            ref: blob.ref,
            mime_type: blob.mime_type,
            size: blob.size,
          ))
        None -> None
      }

      // Convert home_town from generated type to HomeTown type
      let home_town = case node.home_town {
        Some(ht) -> convert_home_town_from_list(ht)
        None -> None
      }

      profile.Profile(
        id: node.id,
        uri: node.uri,
        cid: node.cid,
        did: node.did,
        handle: node.actor_handle,
        display_name: node.display_name,
        description: node.description,
        avatar_url: case node.avatar {
          Some(blob) -> Some(blob.url)
          None -> None
        },
        avatar_blob: avatar_blob,
        home_town: home_town,
        interests: node.interests,
        created_at: node.created_at,
        indexed_at: node.indexed_at,
      )
    })

  Ok(profiles)
}

/// Convert list_profiles's CommunityLexiconLocationHthree to HomeTown type
fn convert_home_town_from_list(
  ht: list_profiles_gql.CommunityLexiconLocationHthree,
) -> Option(profile.HomeTown) {
  case ht.name, ht.value {
    Some(name), Some(value) -> Some(profile.HomeTown(name: name, h3_index: value))
    _, _ -> None
  }
}
