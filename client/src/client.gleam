import gleam/io
import gleam/javascript/promise
import gleam/json
import gleam/option.{None, Some}
import gleam/result
import gleam/string
import gleam/uri.{type Uri}
import lustre
import lustre/attribute
import lustre/effect.{type Effect}
import lustre/element.{type Element}
import lustre/element/html
import modem
import pages/home
import pages/profile as profile_page
import pages/profile_edit
import plinth/browser/document
import ui/location_input
import plinth/browser/element as plinth_element
import shared/profile.{type Profile}
import ui/layout

pub fn main() {
  let app = lustre.application(init, update, view)
  let assert Ok(_) = lustre.start(app, "#app", Nil)

  Nil
}

// MODEL -----------------------------------------------------------------------

pub type Route {
  Home
  Profile(handle: String)
  ProfileEdit(handle: String)
  NotFound(uri: Uri)
}

pub type ProfileState {
  NotAsked
  Loading
  Loaded(Profile)
  Failed(error: String)
}

type Model {
  Model(
    route: Route,
    profile_state: ProfileState,
    edit_form_data: profile_edit.FormData,
  )
}

fn init(_flags) -> #(Model, Effect(Msg)) {
  let route = case modem.initial_uri() {
    Ok(uri) -> parse_route(uri)
    Error(_) -> Home
  }

  // Try to read prerendered profile data from the server
  let prerendered_profile = read_embedded_profile_data()

  // Check if we need to fetch profile data on initial load
  let #(model, initial_effect) = case route {
    Profile(handle: _handle) -> {
      // Use prerendered data if available, otherwise show loading
      case prerendered_profile {
        Some(profile_data) -> {
          let model =
            Model(
              route: route,
              profile_state: Loaded(profile_data),
              edit_form_data: profile_edit.init_form_data(None),
            )
          #(model, effect.none())
        }
        None -> {
          let model =
            Model(
              route: route,
              profile_state: Failed("Profile not found"),
              edit_form_data: profile_edit.init_form_data(None),
            )
          #(model, effect.none())
        }
      }
    }
    ProfileEdit(handle: _handle) -> {
      // Use prerendered data if available
      case prerendered_profile {
        Some(profile_data) -> {
          let model =
            Model(
              route: route,
              profile_state: Loaded(profile_data),
              edit_form_data: profile_edit.init_form_data(Some(profile_data)),
            )
          #(model, effect.none())
        }
        None -> {
          let model =
            Model(
              route: route,
              profile_state: Failed("Profile not found"),
              edit_form_data: profile_edit.init_form_data(None),
            )
          #(model, effect.none())
        }
      }
    }
    _ -> {
      let model =
        Model(
          route: route,
          profile_state: NotAsked,
          edit_form_data: profile_edit.init_form_data(None),
        )
      #(model, effect.none())
    }
  }

  let modem_effect = modem.init(on_url_change)

  // Combine both effects
  let combined_effect = effect.batch([modem_effect, initial_effect])

  #(model, combined_effect)
}

fn read_embedded_profile_data() -> option.Option(Profile) {
  document.query_selector("#model")
  |> result.map(plinth_element.inner_text)
  |> result.try(fn(json_string) {
    json.parse(json_string, profile.profile_decoder())
    |> result.replace_error(Nil)
  })
  |> option.from_result
}

fn on_url_change(uri: Uri) -> Msg {
  uri
  |> parse_route
  |> UserNavigatedTo
}

fn parse_route(uri: Uri) -> Route {
  case uri.path_segments(uri.path) {
    [] | [""] -> Home
    ["profile", handle] -> Profile(handle: handle)
    ["profile", handle, "edit"] -> ProfileEdit(handle: handle)
    _ -> NotFound(uri: uri)
  }
}

// UPDATE ----------------------------------------------------------------------

type Msg {
  UserNavigatedTo(route: Route)
  ProfileFetched(Result(option.Option(Profile), String))
  ProfileEditMsg(profile_edit.Msg)
}

fn update(model: Model, msg: Msg) -> #(Model, Effect(Msg)) {
  case msg {
    UserNavigatedTo(route: route) -> {
      let model = Model(..model, route: route)

      // Fetch profile when navigating to a profile page
      case route {
        Profile(handle: handle) -> {
          io.println("Navigating to profile: " <> handle)
          // Check if we have the correct profile loaded
          case model.profile_state {
            Loaded(p) -> {
              // Check if loaded profile matches the requested handle
              case p.handle {
                option.Some(loaded_handle) if loaded_handle == handle -> {
                  // Already have the correct profile loaded
                  #(model, effect.none())
                }
                _ -> {
                  // Profile doesn't match, fetch the correct one
                  let model = Model(..model, profile_state: Loading)
                  #(model, fetch_profile(handle))
                }
              }
            }
            _ -> {
              // No profile loaded, fetch it
              let model = Model(..model, profile_state: Loading)
              #(model, fetch_profile(handle))
            }
          }
        }
        ProfileEdit(handle: handle) -> {
          io.println("Navigating to profile edit: " <> handle)
          // Check if we have the correct profile loaded
          case model.profile_state {
            Loaded(p) -> {
              // Check if loaded profile matches the requested handle
              case p.handle {
                option.Some(loaded_handle) if loaded_handle == handle -> {
                  let form_data = profile_edit.init_form_data(Some(p))
                  #(
                    Model(..model, edit_form_data: form_data),
                    effect.none(),
                  )
                }
                _ -> {
                  // Profile doesn't match, fetch the correct one
                  let model = Model(..model, profile_state: Loading)
                  #(model, fetch_profile(handle))
                }
              }
            }
            _ -> {
              // No profile loaded, fetch it
              let model = Model(..model, profile_state: Loading)
              #(model, fetch_profile(handle))
            }
          }
        }
        _ -> #(model, effect.none())
      }
    }

    ProfileFetched(result) -> {
      io.println("Profile fetched result: " <> string.inspect(result))
      let profile_state = case result {
        Ok(Some(profile_data)) -> Loaded(profile_data)
        Ok(None) -> Failed("Profile not found")
        Error(error) -> Failed(error)
      }

      // If we're on the edit page and profile was loaded, initialize form data
      let edit_form_data = case model.route, profile_state {
        ProfileEdit(_), Loaded(profile_data) ->
          profile_edit.init_form_data(Some(profile_data))
        _, _ -> model.edit_form_data
      }

      #(
        Model(..model, profile_state: profile_state, edit_form_data: edit_form_data),
        effect.none(),
      )
    }

    ProfileEditMsg(edit_msg) -> {
      case edit_msg {
        profile_edit.DisplayNameUpdated(value) -> {
          let form_data =
            profile_edit.FormData(..model.edit_form_data, display_name: value)
          #(Model(..model, edit_form_data: form_data), effect.none())
        }
        profile_edit.DescriptionUpdated(value) -> {
          let form_data =
            profile_edit.FormData(..model.edit_form_data, description: value)
          #(Model(..model, edit_form_data: form_data), effect.none())
        }
        profile_edit.LocationInputMsg(location_msg) -> {
          let #(location_model, location_effect) =
            location_input.update(model.edit_form_data.location_input, location_msg)

          let form_data =
            profile_edit.FormData(..model.edit_form_data, location_input: location_model)

          #(
            Model(..model, edit_form_data: form_data),
            location_effect |> effect.map(fn(msg) { ProfileEditMsg(profile_edit.LocationInputMsg(msg)) }),
          )
        }
        profile_edit.InterestsUpdated(value) -> {
          let form_data =
            profile_edit.FormData(..model.edit_form_data, interests: value)
          #(Model(..model, edit_form_data: form_data), effect.none())
        }
        profile_edit.AvatarFileSelected(_file_url) -> {
          // TODO: Handle avatar file selection
          #(model, effect.none())
        }
        profile_edit.FormSubmitted -> {
          // TODO: Handle form submission
          io.println("Profile form submitted")
          #(model, effect.none())
        }
        profile_edit.CancelClicked -> {
          // Navigate back to profile page
          case model.route {
            ProfileEdit(handle: handle) -> {
              #(model, modem.push("/profile/" <> handle, None, None))
            }
            _ -> #(model, effect.none())
          }
        }
      }
    }
  }
}

fn fetch_profile(handle: String) -> Effect(Msg) {
  effect.from(fn(dispatch) {
    let url = "/api/profile/" <> handle
    io.println("Fetching profile from: " <> url)

    // Use native fetch with relative URL
    fetch_url(url)
    |> promise.map(fn(body_result) {
      io.println("Body result: " <> string.inspect(body_result))
      case body_result {
        Ok(#(200, text)) -> {
          io.println("Got 200 response, parsing JSON...")
          json.parse(text, profile.profile_decoder())
          |> result.map(Some)
          |> result.map_error(fn(err) {
            io.println("JSON parse error: " <> string.inspect(err))
            "Failed to parse profile JSON"
          })
        }
        Ok(#(404, _)) -> {
          io.println("Got 404 response")
          Ok(None)
        }
        Ok(#(status, _)) -> {
          io.println("Got status: " <> string.inspect(status))
          Error("API request failed")
        }
        Error(err) -> {
          io.println("Fetch error: " <> err)
          Error(err)
        }
      }
    })
    |> promise.tap(fn(result) { dispatch(ProfileFetched(result)) })

    Nil
  })
}

@external(javascript, "./client_ffi.mjs", "fetchUrl")
fn fetch_url(url: String) -> promise.Promise(Result(#(Int, String), String))

// VIEW ------------------------------------------------------------------------

fn view(model: Model) -> Element(Msg) {
  let user =
    Some(layout.User(name: Some("Chad Miller"), handle: "chadtmiller.com"))

  layout.layout(user, [
    case model.route {
      Home -> home.view()
      Profile(handle: _handle) -> {
        case model.profile_state {
          NotAsked | Loading ->
            html.div([attribute.class("text-center py-12")], [
              html.p([attribute.class("text-zinc-400")], [
                html.text("Loading profile..."),
              ]),
            ])
          Loaded(p) -> profile_page.view(p)
          Failed(error: error) ->
            html.div([attribute.class("text-center py-12")], [
              html.h2([attribute.class("text-2xl font-bold text-white mb-4")], [
                html.text("Error"),
              ]),
              html.p([attribute.class("text-zinc-400")], [html.text(error)]),
            ])
        }
      }
      ProfileEdit(handle: handle) -> {
        case model.profile_state {
          NotAsked | Loading ->
            html.div([attribute.class("text-center py-12")], [
              html.p([attribute.class("text-zinc-400")], [
                html.text("Loading profile..."),
              ]),
            ])
          Loaded(p) ->
            profile_edit.view(
              Some(p),
              model.edit_form_data,
              handle,
              ProfileEditMsg,
            )
          Failed(error: error) ->
            html.div([attribute.class("text-center py-12")], [
              html.h2([attribute.class("text-2xl font-bold text-white mb-4")], [
                html.text("Error"),
              ]),
              html.p([attribute.class("text-zinc-400")], [html.text(error)]),
            ])
        }
      }
      NotFound(_) -> view_not_found()
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
