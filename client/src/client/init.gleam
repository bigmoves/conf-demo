import cache
import client/effects
import client/model.{type Model, type Msg, type Route, Model}
import gleam/dynamic/decode
import gleam/json
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/uri.{type Uri}
import lustre/effect.{type Effect}
import modem
import pages/profile_edit
import plinth/browser/document
import plinth/browser/element as plinth_element
import query
import shared/profile.{type Profile}
import ui/layout

// INITIALIZATION --------------------------------------------------------------

pub fn init(_flags) -> #(Model, Effect(Msg)) {
  let route = case modem.initial_uri() {
    Ok(uri) -> parse_route(uri)
    Error(_) -> model.Home
  }

  // Initialize empty cache
  let initial_cache = cache.init()

  // Try to read prerendered data from the server for hydration
  let prerendered_profile = read_embedded_profile_data()
  let prerendered_attendees = read_embedded_attendees_data()
  let prerendered_user = read_embedded_user_data()

  // Get current timestamp for cache hydration
  let current_time_ms = effects.get_current_time_ms()

  // Hydrate cache with SSR data if available
  let hydrated_cache = case prerendered_profile, prerendered_attendees {
    Some(profile_data), _ -> {
      // Seed cache with profile and mark as fresh
      let stale_time = query.stale_time(query.ProfileQuery(""))
      cache.hydrate_profile(
        initial_cache,
        profile_data,
        current_time_ms,
        stale_time,
      )
    }
    None, Some(attendees_data) -> {
      // Seed cache with attendees and mark all profiles as fresh
      let stale_time = query.stale_time(query.ProfileQuery(""))
      cache.hydrate_profiles(
        initial_cache,
        attendees_data,
        current_time_ms,
        stale_time,
      )
    }
    None, None -> initial_cache
  }

  // Determine what data needs to be fetched based on route
  let #(initial_model, initial_effect) = case route {
    model.Attendees -> {
      // Check if user is logged in before fetching attendees
      case prerendered_user {
        None -> {
          let new_model =
            Model(
              route: route,
              cache: hydrated_cache,
              edit_form_data: profile_edit.init_form_data(None),
              current_user: prerendered_user,
            )
          #(new_model, modem.push("/login", option.None, option.None))
        }
        Some(_) -> {
          let new_model =
            Model(
              route: route,
              cache: hydrated_cache,
              edit_form_data: profile_edit.init_form_data(None),
              current_user: prerendered_user,
            )

          // Only fetch if cache is stale (not from SSR)
          let query_key = query.to_string(query.AttendeesQuery)
          let needs_fetch =
            cache.is_query_stale(hydrated_cache, query_key, current_time_ms)

          let fetch_effect = case needs_fetch {
            True -> effects.fetch_attendees_with_cache()
            False -> effect.none()
          }

          #(new_model, fetch_effect)
        }
      }
    }
    model.Profile(handle: handle) | model.ProfileEdit(handle: handle) -> {
      // Profile data might be in cache from SSR
      let profile_from_cache = cache.get_profile(hydrated_cache, handle)

      let form_data = case route {
        model.ProfileEdit(_) -> profile_edit.init_form_data(profile_from_cache)
        _ -> profile_edit.init_form_data(None)
      }

      let new_model =
        Model(
          route: route,
          cache: hydrated_cache,
          edit_form_data: form_data,
          current_user: prerendered_user,
        )

      // Check if we need to fetch (cache might be stale or missing)
      let query_key = query.to_string(query.ProfileQuery(handle))
      let needs_fetch =
        cache.is_query_stale(hydrated_cache, query_key, current_time_ms)

      let fetch_effect = case needs_fetch {
        True -> effects.fetch_profile_with_cache(handle)
        False -> effect.none()
      }

      #(new_model, fetch_effect)
    }
    _ -> {
      let new_model =
        Model(
          route: route,
          cache: hydrated_cache,
          edit_form_data: profile_edit.init_form_data(None),
          current_user: prerendered_user,
        )
      #(new_model, effect.none())
    }
  }

  let modem_effect = modem.init(on_url_change)

  // Only fetch user if not already prerendered
  let fetch_user_effect = case prerendered_user {
    Some(_) -> effect.none()
    None -> effects.fetch_current_user()
  }

  // Combine all effects
  let combined_effect =
    effect.batch([modem_effect, initial_effect, fetch_user_effect])

  #(initial_model, combined_effect)
}

// SSR DATA READING ------------------------------------------------------------

fn read_embedded_profile_data() -> Option(Profile) {
  document.query_selector("#model")
  |> result.map(plinth_element.inner_text)
  |> result.try(fn(json_string) {
    json.parse(json_string, decode.at(["profile"], profile.profile_decoder()))
    |> result.replace_error(Nil)
  })
  |> option.from_result
}

fn read_embedded_user_data() -> Option(layout.User) {
  document.query_selector("#model")
  |> result.map(plinth_element.inner_text)
  |> result.try(fn(json_string) {
    json.parse(
      json_string,
      decode.at(["user"], {
        use handle <- decode.field("handle", decode.string)
        decode.success(layout.User(name: None, handle: handle))
      }),
    )
    |> result.replace_error(Nil)
  })
  |> option.from_result
}

fn read_embedded_attendees_data() -> Option(List(Profile)) {
  document.query_selector("#model")
  |> result.map(plinth_element.inner_text)
  |> result.try(fn(json_string) {
    json.parse(
      json_string,
      decode.at(["attendees"], decode.list(profile.profile_decoder())),
    )
    |> result.replace_error(Nil)
  })
  |> option.from_result
}

// ROUTING ---------------------------------------------------------------------

pub fn on_url_change(uri: Uri) -> Msg {
  uri
  |> parse_route
  |> model.UserNavigatedTo
}

pub fn parse_route(uri: Uri) -> Route {
  case uri.path_segments(uri.path) {
    [] | [""] -> model.Home
    ["login"] -> model.Login
    ["attendees"] -> model.Attendees
    ["profile", handle] -> model.Profile(handle: handle)
    ["profile", handle, "edit"] -> model.ProfileEdit(handle: handle)
    _ -> model.NotFound(uri: uri)
  }
}
