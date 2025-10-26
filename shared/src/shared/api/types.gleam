// Re-export generated types for client/server use
// The client uses these for JSON deserialization
// The server uses these as return types from GraphQL operations

import shared/api/graphql/get_profile

pub type Profile =
  get_profile.OrgAtmosphereconfProfile

pub type Blob =
  get_profile.Blob

pub type HomeTown =
  get_profile.CommunityLexiconLocationHthree

// Re-export decoder for client use
pub fn profile_decoder() {
  get_profile.org_atmosphereconf_profile_decoder()
}

// Re-export to_json for server use
pub fn profile_to_json(profile: Profile) {
  get_profile.org_atmosphereconf_profile_to_json(profile)
}
