// Query key types and helpers for type-safe cache queries
// This module provides type-safe query keys and configuration

// QUERY KEYS ------------------------------------------------------------------

/// Type-safe query keys for different data types
pub type QueryKey {
  ProfileQuery(handle: String)
  AttendeesQuery
  CurrentUserQuery
}

/// Convert query key to string for cache lookup
pub fn to_string(key: QueryKey) -> String {
  case key {
    ProfileQuery(handle) -> "profile:" <> handle
    AttendeesQuery -> "attendees"
    CurrentUserQuery -> "current-user"
  }
}

// QUERY CONFIG ----------------------------------------------------------------

/// Default stale time for different query types (in milliseconds)
pub fn stale_time(key: QueryKey) -> Int {
  case key {
    // Profile data is fresh for 5 minutes
    ProfileQuery(_) -> 5 * 60 * 1000
    // Attendees list is fresh for 2 minutes
    AttendeesQuery -> 2 * 60 * 1000
    // Current user is fresh for 10 minutes
    CurrentUserQuery -> 10 * 60 * 1000
  }
}

/// Whether to refetch in background when stale
pub fn refetch_on_stale(key: QueryKey) -> Bool {
  case key {
    ProfileQuery(_) -> True
    AttendeesQuery -> True
    CurrentUserQuery -> True
  }
}

/// Whether to refetch on window focus
pub fn refetch_on_focus(key: QueryKey) -> Bool {
  case key {
    ProfileQuery(_) -> False
    AttendeesQuery -> True
    CurrentUserQuery -> False
  }
}
