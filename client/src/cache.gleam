import gleam/dict.{type Dict}
import gleam/option.{type Option, None, Some}
import shared/profile.{type Profile}

// CACHE TYPES -----------------------------------------------------------------

/// Query status tracking with timestamps
pub type QueryStatus {
  Idle
  Fetching
  Success(fetched_at_ms: Int)
  Error(message: String, failed_at_ms: Int)
}

/// Metadata for a specific query
pub type QueryMetadata {
  QueryMetadata(status: QueryStatus, stale_time_ms: Int)
}

/// Query cache stores status and staleness info per query key
pub type QueryCache {
  QueryCache(queries: Dict(String, QueryMetadata))
}

/// Optimistic update that can be rolled back
/// When adding new entity types, add new variants here:
/// PostUpdate(id: String, previous: Option(Post), optimistic: Post)
pub type OptimisticUpdate {
  ProfileUpdate(handle: String, previous: Option(Profile), optimistic: Profile)
}

/// Complete cache state
/// When adding new entity types, add new Dict fields here:
/// post_entities: Dict(String, Post),
pub type Cache {
  Cache(
    // Entity stores - add new entity types as separate dicts
    profile_entities: Dict(String, Profile),
    // Query metadata - shared across all entity types
    queries: QueryCache,
    // Optimistic updates - add new variants to OptimisticUpdate type
    optimistic_updates: List(OptimisticUpdate),
  )
}

// CACHE INITIALIZATION --------------------------------------------------------

/// Create an empty cache
pub fn init() -> Cache {
  Cache(
    profile_entities: dict.new(),
    queries: QueryCache(queries: dict.new()),
    optimistic_updates: [],
  )
}

/// Create cache with initial profiles (for hydration)
pub fn from_profiles(profiles: List(Profile)) -> Cache {
  let profiles_dict = list_fold_profiles(profiles, dict.new())

  Cache(
    profile_entities: profiles_dict,
    queries: QueryCache(queries: dict.new()),
    optimistic_updates: [],
  )
}

fn list_fold_profiles(
  profiles: List(Profile),
  acc: Dict(String, Profile),
) -> Dict(String, Profile) {
  case profiles {
    [] -> acc
    [first, ..rest] -> {
      case first.handle {
        Some(handle) ->
          list_fold_profiles(rest, dict.insert(acc, handle, first))
        None -> list_fold_profiles(rest, acc)
      }
    }
  }
}

// PROFILE ENTITY OPERATIONS ---------------------------------------------------
// When adding new entity types, copy this section and replace Profile/profile

/// Get a profile from the entity cache
pub fn get_profile(cache: Cache, handle: String) -> Option(Profile) {
  dict.get(cache.profile_entities, handle)
  |> option.from_result
}

/// Get all profiles from the entity cache
pub fn get_all_profiles(cache: Cache) -> List(Profile) {
  dict.values(cache.profile_entities)
}

/// Set a profile in the entity cache
pub fn set_profile(cache: Cache, profile: Profile) -> Cache {
  case profile.handle {
    Some(handle) -> {
      let updated_profiles = dict.insert(cache.profile_entities, handle, profile)
      Cache(..cache, profile_entities: updated_profiles)
    }
    None -> cache
  }
}

/// Set multiple profiles in the entity cache
pub fn set_profiles(cache: Cache, profiles: List(Profile)) -> Cache {
  let updated_profiles = list_fold_profiles(profiles, cache.profile_entities)
  Cache(..cache, profile_entities: updated_profiles)
}

/// Remove a profile from the entity cache
pub fn remove_profile(cache: Cache, handle: String) -> Cache {
  let updated_profiles = dict.delete(cache.profile_entities, handle)
  Cache(..cache, profile_entities: updated_profiles)
}

// QUERY OPERATIONS ------------------------------------------------------------
// These are generic and work for any entity type

/// Get query metadata
pub fn get_query_metadata(
  cache: Cache,
  query_key: String,
) -> Option(QueryMetadata) {
  dict.get(cache.queries.queries, query_key)
  |> option.from_result
}

/// Check if a query is stale
pub fn is_query_stale(
  cache: Cache,
  query_key: String,
  current_time_ms: Int,
) -> Bool {
  case get_query_metadata(cache, query_key) {
    Some(metadata) -> {
      case metadata.status {
        Success(fetched_at_ms: fetched_at) -> {
          let age_ms = current_time_ms - fetched_at
          age_ms > metadata.stale_time_ms
        }
        _ -> True
      }
    }
    None -> True
  }
}

/// Get query status
pub fn get_query_status(cache: Cache, query_key: String) -> QueryStatus {
  case get_query_metadata(cache, query_key) {
    Some(metadata) -> metadata.status
    None -> Idle
  }
}

/// Mark a query as fetching
pub fn set_query_fetching(
  cache: Cache,
  query_key: String,
  stale_time_ms: Int,
) -> Cache {
  let metadata = QueryMetadata(status: Fetching, stale_time_ms: stale_time_ms)
  let updated_queries = dict.insert(cache.queries.queries, query_key, metadata)
  Cache(..cache, queries: QueryCache(queries: updated_queries))
}

/// Mark a query as successful
pub fn set_query_success(
  cache: Cache,
  query_key: String,
  fetched_at_ms: Int,
  stale_time_ms: Int,
) -> Cache {
  let metadata =
    QueryMetadata(
      status: Success(fetched_at_ms: fetched_at_ms),
      stale_time_ms: stale_time_ms,
    )
  let updated_queries = dict.insert(cache.queries.queries, query_key, metadata)
  Cache(..cache, queries: QueryCache(queries: updated_queries))
}

/// Mark a query as failed
pub fn set_query_error(
  cache: Cache,
  query_key: String,
  error: String,
  failed_at_ms: Int,
  stale_time_ms: Int,
) -> Cache {
  let metadata =
    QueryMetadata(
      status: Error(message: error, failed_at_ms: failed_at_ms),
      stale_time_ms: stale_time_ms,
    )
  let updated_queries = dict.insert(cache.queries.queries, query_key, metadata)
  Cache(..cache, queries: QueryCache(queries: updated_queries))
}

/// Invalidate a query (mark as stale, remove metadata)
pub fn invalidate_query(cache: Cache, query_key: String) -> Cache {
  let updated_queries = dict.delete(cache.queries.queries, query_key)
  Cache(..cache, queries: QueryCache(queries: updated_queries))
}

// OPTIMISTIC UPDATES ----------------------------------------------------------
// When adding new entity types, add cases to handle new OptimisticUpdate variants

/// Apply an optimistic profile update
pub fn apply_optimistic_profile_update(
  cache: Cache,
  handle: String,
  optimistic_profile: Profile,
) -> Cache {
  let previous = get_profile(cache, handle)
  let update = ProfileUpdate(handle, previous, optimistic_profile)

  // Update the entity cache with optimistic data
  let updated_cache = set_profile(cache, optimistic_profile)

  // Track the update for potential rollback
  Cache(
    ..updated_cache,
    optimistic_updates: [update, ..cache.optimistic_updates],
  )
}

/// Commit an optimistic update (remove from rollback stack)
pub fn commit_optimistic_update(cache: Cache, handle: String) -> Cache {
  let remaining_updates =
    list_filter_optimistic(cache.optimistic_updates, handle)
  Cache(..cache, optimistic_updates: remaining_updates)
}

fn list_filter_optimistic(
  updates: List(OptimisticUpdate),
  handle: String,
) -> List(OptimisticUpdate) {
  case updates {
    [] -> []
    [first, ..rest] -> {
      case first {
        ProfileUpdate(h, _, _) if h == handle ->
          list_filter_optimistic(rest, handle)
        _ -> [first, ..list_filter_optimistic(rest, handle)]
      }
    }
  }
}

/// Rollback an optimistic update
pub fn rollback_optimistic_update(cache: Cache, handle: String) -> Cache {
  case find_optimistic_update(cache.optimistic_updates, handle) {
    Some(ProfileUpdate(_, previous, _)) -> {
      // Restore previous state
      let restored_cache = case previous {
        Some(prev_profile) -> set_profile(cache, prev_profile)
        None -> remove_profile(cache, handle)
      }

      // Remove from optimistic updates
      let remaining_updates =
        list_filter_optimistic(cache.optimistic_updates, handle)
      Cache(..restored_cache, optimistic_updates: remaining_updates)
    }
    None -> cache
  }
}

fn find_optimistic_update(
  updates: List(OptimisticUpdate),
  handle: String,
) -> Option(OptimisticUpdate) {
  case updates {
    [] -> None
    [first, ..rest] -> {
      case first {
        ProfileUpdate(h, _, _) if h == handle -> Some(first)
        _ -> find_optimistic_update(rest, handle)
      }
    }
  }
}

// HYDRATION -------------------------------------------------------------------
// SSR data seeding - mark as fresh to avoid immediate refetch

/// Seed cache with SSR profile data, marking query as fresh
pub fn hydrate_profile(
  cache: Cache,
  profile: Profile,
  current_time_ms: Int,
  stale_time_ms: Int,
) -> Cache {
  case profile.handle {
    Some(handle) -> {
      // Add to entity cache
      let cache_with_entity = set_profile(cache, profile)

      // Mark profile query as fresh
      let query_key = "profile:" <> handle
      set_query_success(
        cache_with_entity,
        query_key,
        current_time_ms,
        stale_time_ms,
      )
    }
    None -> cache
  }
}

/// Seed cache with multiple profiles (for attendees list)
pub fn hydrate_profiles(
  cache: Cache,
  profiles: List(Profile),
  current_time_ms: Int,
  stale_time_ms: Int,
) -> Cache {
  // Add all to entity cache
  let cache_with_entities = set_profiles(cache, profiles)

  // Mark attendees query as fresh
  let cache_with_attendees_query =
    set_query_success(
      cache_with_entities,
      "attendees",
      current_time_ms,
      stale_time_ms,
    )

  // Mark each individual profile query as fresh to avoid refetches
  mark_individual_profile_queries_fresh(
    cache_with_attendees_query,
    profiles,
    current_time_ms,
    stale_time_ms,
  )
}

fn mark_individual_profile_queries_fresh(
  cache: Cache,
  profiles: List(Profile),
  current_time_ms: Int,
  stale_time_ms: Int,
) -> Cache {
  case profiles {
    [] -> cache
    [first, ..rest] -> {
      case first.handle {
        Some(handle) -> {
          let query_key = "profile:" <> handle
          let updated_cache =
            set_query_success(cache, query_key, current_time_ms, stale_time_ms)
          mark_individual_profile_queries_fresh(
            updated_cache,
            rest,
            current_time_ms,
            stale_time_ms,
          )
        }
        None ->
          mark_individual_profile_queries_fresh(
            cache,
            rest,
            current_time_ms,
            stale_time_ms,
          )
      }
    }
  }
}
