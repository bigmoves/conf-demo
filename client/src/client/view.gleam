import cache
import client/model.{type Model, type Msg}
import gleam/option
import lustre/attribute
import lustre/element.{type Element}
import lustre/element/html
import pages/attendees
import pages/home
import pages/login
import pages/profile as profile_page
import pages/profile_edit
import query
import ui/layout

// VIEW ------------------------------------------------------------------------

pub fn view(current_model: Model) -> Element(Msg) {
  layout.layout(current_model.current_user, [
    case current_model.route {
      model.Home -> home.view(current_model.current_user)
      model.Login -> login.view()
      model.Attendees -> {
        // Read from cache
        let query_key_str = query.to_string(query.AttendeesQuery)
        let query_status =
          cache.get_query_status(current_model.cache, query_key_str)

        case query_status {
          cache.Idle | cache.Fetching -> attendees.view_loading()
          cache.Success(_) -> {
            let profiles = cache.get_all_profiles(current_model.cache)
            attendees.view(profiles)
          }
          cache.Error(message, _) -> attendees.view_error(message)
        }
      }
      model.Profile(handle: handle) -> {
        // Read profile from cache
        let query_key_str = query.to_string(query.ProfileQuery(handle))
        let query_status =
          cache.get_query_status(current_model.cache, query_key_str)
        let profile_from_cache = cache.get_profile(current_model.cache, handle)

        case profile_from_cache, query_status {
          option.Some(p), _ -> {
            // Have profile data, show it (might be optimistic)
            let current_user_handle = case current_model.current_user {
              option.Some(user) -> option.Some(user.handle)
              option.None -> option.None
            }
            profile_page.view(p, current_user_handle)
          }
          option.None, cache.Fetching ->
            html.div([attribute.class("text-center py-12")], [
              html.p([attribute.class("text-zinc-400")], [
                html.text("Loading profile..."),
              ]),
            ])
          option.None, cache.Error(error, _) ->
            html.div([attribute.class("text-center py-12")], [
              html.h2([attribute.class("text-2xl font-bold text-white mb-4")], [
                html.text("Error"),
              ]),
              html.p([attribute.class("text-zinc-400")], [html.text(error)]),
            ])
          option.None, _ ->
            html.div([attribute.class("text-center py-12")], [
              html.p([attribute.class("text-zinc-400")], [
                html.text("Profile not found"),
              ]),
            ])
        }
      }
      model.ProfileEdit(handle: handle) -> {
        // Read profile from cache
        let profile_from_cache = cache.get_profile(current_model.cache, handle)
        let query_key_str = query.to_string(query.ProfileQuery(handle))
        let query_status =
          cache.get_query_status(current_model.cache, query_key_str)

        case profile_from_cache, query_status {
          option.Some(p), _ ->
            profile_edit.view(
              option.Some(p),
              current_model.edit_form_data,
              handle,
              model.ProfileEditMsg,
            )
          option.None, cache.Fetching ->
            html.div([attribute.class("text-center py-12")], [
              html.p([attribute.class("text-zinc-400")], [
                html.text("Loading profile..."),
              ]),
            ])
          option.None, cache.Error(error, _) ->
            html.div([attribute.class("text-center py-12")], [
              html.h2([attribute.class("text-2xl font-bold text-white mb-4")], [
                html.text("Error"),
              ]),
              html.p([attribute.class("text-zinc-400")], [html.text(error)]),
            ])
          option.None, _ ->
            html.div([attribute.class("text-center py-12")], [
              html.p([attribute.class("text-zinc-400")], [
                html.text("Profile not found"),
              ]),
            ])
        }
      }
      model.NotFound(_) -> view_not_found()
    },
  ])
}

fn view_not_found() -> Element(Msg) {
  html.div([attribute.class("text-center py-12")], [
    html.h2([attribute.class("text-2xl font-bold text-white mb-4")], [
      html.text("404 - Page Not Found"),
    ]),
    html.p([attribute.class("text-zinc-400")], [
      html.text("The page you're looking for doesn't exist."),
    ]),
  ])
}
