import cache
import gleam/option
import gleam/uri.{type Uri}
import pages/profile_edit
import query
import shared/profile.{type Profile}
import ui/layout

// ROUTING ---------------------------------------------------------------------

pub type Route {
  Home
  Login
  Attendees
  Profile(handle: String)
  ProfileEdit(handle: String)
  NotFound(uri: Uri)
}

// MODEL -----------------------------------------------------------------------

pub type Model {
  Model(
    route: Route,
    cache: cache.Cache,
    edit_form_data: profile_edit.FormData,
    current_user: option.Option(layout.User),
  )
}

// MESSAGES --------------------------------------------------------------------

pub type Msg {
  UserNavigatedTo(route: Route)
  QueryStarted(query_key: query.QueryKey)
  ProfileQuerySuccess(handle: String, profile: Profile)
  ProfileQueryError(handle: String, error: String)
  AttendeesQuerySuccess(profiles: List(Profile))
  AttendeesQueryError(error: String)
  ProfileEditMsg(profile_edit.Msg)
  CurrentUserFetched(Result(layout.User, String))
  ProfileMutationOptimistic(handle: String, updated: Profile)
  ProfileMutationSuccess(handle: String, updated: Profile)
  ProfileMutationError(handle: String, error: String)
}
