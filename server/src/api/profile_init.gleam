import api/graphql
import gleam/io
import gleam/json
import gleam/option.{None, Some}
import gleam/time/duration
import gleam/time/timestamp
import shared/api/graphql/create_profile as create_profile_gql

/// Initialize user profile by:
/// 1. Checking if profile already exists
/// 2. Syncing user collections (Bluesky data)
/// 3. Fetching Bluesky profile
/// 4. Creating org.atmosphereconf.profile with Bluesky data
pub fn initialize_user_profile(
  config: graphql.Config,
  user_did: String,
  user_handle: String,
) -> Result(Nil, String) {
  // 1. Check if profile already exists
  case graphql.check_profile_exists(config, user_did) {
    Ok(True) -> {
      // User already has a profile, nothing to do
      io.println("Profile already exists for " <> user_did)
      Ok(Nil)
    }
    Ok(False) -> {
      io.println("Initializing profile for " <> user_did)

      // 2. Sync user collections (to get Bluesky data)
      let sync_result = graphql.sync_user_collections(config, user_did)
      case sync_result {
        Error(err) -> {
          io.println("Warning: Failed to sync collections: " <> err)
          // Continue anyway, we can still create a basic profile
          Nil
        }
        Ok(_) -> {
          io.println("Successfully synced user collections")
          Nil
        }
      }

      // 3. Fetch Bluesky profile data
      let bsky_profile_result = graphql.get_bluesky_profile(config, user_did)

      // 4. Create org.atmosphereconf.profile with Bluesky data
      let display_name = case bsky_profile_result {
        Ok(Some(profile)) ->
          case profile.display_name {
            Some(name) -> name
            None -> user_handle
          }
        _ -> user_handle
      }

      let description = case bsky_profile_result {
        Ok(Some(profile)) -> profile.description
        _ -> None
      }

      let avatar = case bsky_profile_result {
        Ok(Some(profile)) ->
          case profile.avatar {
            Some(avatar_blob) ->
              Some(
                json.object([
                  #("ref", json.string(avatar_blob.ref)),
                  #("mimeType", json.string(avatar_blob.mime_type)),
                  #("size", json.int(avatar_blob.size)),
                ]),
              )
            None -> None
          }
        _ -> None
      }

      let now = timestamp.system_time()
      let created_at = timestamp.to_rfc3339(now, duration.seconds(0))

      let profile_input =
        create_profile_gql.OrgAtmosphereconfProfileInput(
          display_name: Some(display_name),
          description: description,
          avatar: avatar,
          created_at: Some(created_at),
          home_town: None,
          interests: None,
        )

      case graphql.create_profile(config, profile_input) {
        Ok(_) -> {
          io.println("Successfully initialized profile for " <> user_did)
          Ok(Nil)
        }
        Error(err) -> {
          io.println("Failed to create profile: " <> err)
          Error(err)
        }
      }
    }
    Error(err) -> {
      io.println("Failed to check if profile exists: " <> err)
      Error(err)
    }
  }
}
