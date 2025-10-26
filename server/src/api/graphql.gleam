import gleam/json
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result
import shared/api/graphql/check_profile_exists
import shared/api/graphql/create_profile as create_profile_gql
import shared/api/graphql/get_bluesky_profile
import shared/api/graphql/get_profile as get_profile_gql
import shared/api/graphql/list_profiles as list_profiles_gql
import shared/api/graphql/sync_user_collections
import shared/api/graphql/update_profile as update_profile_gql
import shared/api/graphql/upload_blob as upload_blob_gql
import shared/api/types
import squall

pub type Config {
  Config(api_url: String, slice_uri: String, access_token: String)
}

/// Create a squall client from our config
fn create_client(config: Config) -> squall.Client {
  squall.new_erlang_client(config.api_url, [
    #("X-Slice-Uri", config.slice_uri),
    #("Authorization", "Bearer " <> config.access_token),
  ])
}

/// Fetch profile by handle from the GraphQL API
pub fn get_profile_by_handle(
  config: Config,
  handle: String,
) -> Result(Option(types.Profile), String) {
  let client = create_client(config)

  use response <- result.try(get_profile_gql.get_profile(client, handle))

  case response.org_atmosphereconf_profiles.edges {
    [] -> Ok(None)
    [first_edge, ..] -> Ok(Some(first_edge.node))
  }
}

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
      #("ref", json.string(blob.ref)),
      #("mimeType", json.string(blob.mime_type)),
      #("size", json.int(blob.size)),
    ]),
  )
}

// Helper to convert update_profile response to canonical Profile type
fn convert_update_profile_to_profile(
  n: update_profile_gql.OrgAtmosphereconfProfile,
) -> types.Profile {
  get_profile_gql.OrgAtmosphereconfProfile(
    id: n.id,
    uri: n.uri,
    cid: n.cid,
    did: n.did,
    actor_handle: n.actor_handle,
    display_name: n.display_name,
    description: n.description,
    avatar: case n.avatar {
      Some(b) ->
        Some(get_profile_gql.Blob(
          ref: b.ref,
          mime_type: b.mime_type,
          size: b.size,
          url: b.url,
        ))
      None -> None
    },
    home_town: case n.home_town {
      Some(ht) ->
        Some(get_profile_gql.CommunityLexiconLocationHthree(
          name: ht.name,
          value: ht.value,
        ))
      None -> None
    },
    interests: n.interests,
    created_at: n.created_at,
    indexed_at: n.indexed_at,
  )
}

/// Update profile via GraphQL mutation
/// Note: Converts mutation response to Profile type
pub fn update_profile(
  config: Config,
  _handle: String,
  update: update_profile_gql.OrgAtmosphereconfProfileInput,
) -> Result(types.Profile, String) {
  let client = create_client(config)

  use response <- result.try(update_profile_gql.update_profile(
    client,
    "self",
    update,
  ))

  Ok(convert_update_profile_to_profile(
    response.update_org_atmosphereconf_profile,
  ))
}

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
) -> Result(Option(get_bluesky_profile.AppBskyActorProfile), String) {
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

/// Create a new profile
pub fn create_profile(
  config: Config,
  input: create_profile_gql.OrgAtmosphereconfProfileInput,
) -> Result(Nil, String) {
  let client = create_client(config)

  use _response <- result.try(create_profile_gql.create_profile(
    client,
    input,
    "self",
  ))

  Ok(Nil)
}

// Helper to convert list_profiles profile to canonical Profile type
fn convert_list_profile_to_profile(
  n: list_profiles_gql.OrgAtmosphereconfProfile,
) -> types.Profile {
  get_profile_gql.OrgAtmosphereconfProfile(
    id: n.id,
    uri: n.uri,
    cid: n.cid,
    did: n.did,
    actor_handle: n.actor_handle,
    display_name: n.display_name,
    description: n.description,
    avatar: case n.avatar {
      Some(b) ->
        Some(get_profile_gql.Blob(
          ref: b.ref,
          mime_type: b.mime_type,
          size: b.size,
          url: b.url,
        ))
      None -> None
    },
    home_town: case n.home_town {
      Some(ht) ->
        Some(get_profile_gql.CommunityLexiconLocationHthree(
          name: ht.name,
          value: ht.value,
        ))
      None -> None
    },
    interests: n.interests,
    created_at: n.created_at,
    indexed_at: n.indexed_at,
  )
}

/// List all profiles
/// Note: Converts list_profiles response to Profile type
pub fn list_profiles(config: Config) -> Result(List(types.Profile), String) {
  let client = create_client(config)

  use response <- result.try(list_profiles_gql.list_profiles(client))

  // Extract and convert the profile nodes from the edges
  let profiles =
    response.org_atmosphereconf_profiles.edges
    |> list.map(fn(edge) { convert_list_profile_to_profile(edge.node) })

  Ok(profiles)
}
