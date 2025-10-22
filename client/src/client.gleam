import gleam/dynamic/decode
import gleam/int
import gleam/io
import gleam/javascript/promise
import gleam/json
import gleam/list
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
import pages/login
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
  Login
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
    current_user: option.Option(layout.User),
  )
}

fn init(_flags) -> #(Model, Effect(Msg)) {
  let route = case modem.initial_uri() {
    Ok(uri) -> parse_route(uri)
    Error(_) -> Home
  }

  // Try to read prerendered profile data from the server
  let prerendered_profile = read_embedded_profile_data()
  let prerendered_user = read_embedded_user_data()

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
              current_user: prerendered_user,
            )
          #(model, effect.none())
        }
        None -> {
          let model =
            Model(
              route: route,
              profile_state: Failed("Profile not found"),
              edit_form_data: profile_edit.init_form_data(None),
              current_user: prerendered_user,
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
              current_user: prerendered_user,
            )
          #(model, effect.none())
        }
        None -> {
          let model =
            Model(
              route: route,
              profile_state: Failed("Profile not found"),
              edit_form_data: profile_edit.init_form_data(None),
              current_user: prerendered_user,
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
          current_user: prerendered_user,
        )
      #(model, effect.none())
    }
  }

  let modem_effect = modem.init(on_url_change)

  // Only fetch user if not already prerendered
  let fetch_user_effect = case prerendered_user {
    Some(_) -> effect.none()
    None -> fetch_current_user()
  }

  // Combine all effects
  let combined_effect = effect.batch([modem_effect, initial_effect, fetch_user_effect])

  #(model, combined_effect)
}

fn read_embedded_profile_data() -> option.Option(Profile) {
  document.query_selector("#model")
  |> result.map(plinth_element.inner_text)
  |> result.try(fn(json_string) {
    json.parse(json_string, decode.at(["profile"], profile.profile_decoder()))
    |> result.replace_error(Nil)
  })
  |> option.from_result
}

fn read_embedded_user_data() -> option.Option(layout.User) {
  document.query_selector("#model")
  |> result.map(plinth_element.inner_text)
  |> result.try(fn(json_string) {
    json.parse(json_string, decode.at(["user"], {
      use handle <- decode.field("handle", decode.string)
      decode.success(layout.User(name: None, handle: handle))
    }))
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
    ["login"] -> Login
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
  CurrentUserFetched(Result(layout.User, String))
}

fn update(model: Model, msg: Msg) -> #(Model, Effect(Msg)) {
  case msg {
    CurrentUserFetched(result) -> {
      let current_user = case result {
        Ok(user) -> Some(user)
        Error(_) -> None
      }
      #(Model(..model, current_user: current_user), effect.none())
    }

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

          // Check if current user is authorized to edit this profile
          let is_authorized = case model.current_user {
            option.Some(user) if user.handle == handle -> True
            _ -> False
          }

          case is_authorized {
            False -> {
              // Redirect to profile view if not authorized
              io.println("Unauthorized edit attempt, redirecting to profile view")
              #(model, modem.push("/profile/" <> handle, option.None, option.None))
            }
            True -> {
              // Check if we have the correct profile loaded
              case model.profile_state {
                Loaded(p) -> {
                  // Check if loaded profile matches the requested handle
                  case p.handle {
                    option.Some(loaded_handle) if loaded_handle == handle -> {
                      let form_data = profile_edit.init_form_data(Some(p))
                      #(Model(..model, edit_form_data: form_data), effect.none())
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
        profile_edit.AvatarFileChanged(_files) -> {
          // Trigger an effect to process the file from the input element
          #(model, process_file_from_input_effect("avatar-upload"))
        }
        profile_edit.AvatarFileProcessed(file_data) -> {
          let form_data =
            profile_edit.FormData(
              ..model.edit_form_data,
              avatar_preview_url: Some(file_data.preview_url),
              avatar_file_data: Some(file_data),
            )
          #(Model(..model, edit_form_data: form_data), effect.none())
        }
        profile_edit.FormSubmitted -> {
          // Clear any existing messages and set saving state
          let form_data =
            profile_edit.FormData(
              ..model.edit_form_data,
              is_saving: True,
              success_message: None,
              error_message: None,
            )
          let model = Model(..model, edit_form_data: form_data)

          // Get the handle from the route
          case model.route {
            ProfileEdit(handle: handle) -> {
              #(model, save_profile_effect(handle, model.edit_form_data))
            }
            _ -> #(model, effect.none())
          }
        }
        profile_edit.SaveCompleted(result) -> {
          case result {
            Ok(updated_profile) -> {
              // Update form data with success message
              let form_data =
                profile_edit.FormData(
                  ..model.edit_form_data,
                  is_saving: False,
                  success_message: Some("Profile updated successfully!"),
                  error_message: None,
                )

              // Update profile_state with the profile returned from the server
              #(
                Model(
                  ..model,
                  edit_form_data: form_data,
                  profile_state: Loaded(updated_profile),
                ),
                effect.none(),
              )
            }
            Error(err) -> {
              let form_data =
                profile_edit.FormData(
                  ..model.edit_form_data,
                  is_saving: False,
                  success_message: None,
                  error_message: Some(err),
                )
              #(Model(..model, edit_form_data: form_data), effect.none())
            }
          }
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

fn fetch_current_user() -> Effect(Msg) {
  effect.from(fn(dispatch) {
    let url = "/api/user/current"

    fetch_url(url)
    |> promise.map(fn(body_result) {
      case body_result {
        Ok(#(200, text)) -> {
          json.parse(text, {
            use handle <- decode.field("handle", decode.string)
            decode.success(layout.User(name: None, handle: handle))
          })
          |> result.map_error(fn(_) { "Failed to parse user JSON" })
        }
        Ok(#(401, _)) -> {
          // Not authenticated
          Error("Not authenticated")
        }
        Ok(#(status, _)) -> {
          Error("API request failed with status: " <> int.to_string(status))
        }
        Error(err) -> Error(err)
      }
    })
    |> promise.tap(fn(result) { dispatch(CurrentUserFetched(result)) })

    Nil
  })
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

@external(javascript, "./client_ffi.mjs", "postJson")
fn post_json(
  url: String,
  json_body: String,
) -> promise.Promise(Result(#(Int, String), String))

// FFI function to get file from input and process it
@external(javascript, "./client_ffi.mjs", "processFileFromInputId")
fn process_file_from_input_id(
  input_id: String,
) -> promise.Promise(Result(profile_edit.AvatarFileData, String))

fn process_file_from_input_effect(input_id: String) -> Effect(Msg) {
  effect.from(fn(dispatch) {
    process_file_from_input_id(input_id)
    |> promise.map(fn(result) {
      case result {
        Ok(file_data) -> {
          io.println("File processed successfully")
          dispatch(ProfileEditMsg(profile_edit.AvatarFileProcessed(file_data)))
        }
        Error(err) -> {
          io.println("Failed to process file: " <> err)
        }
      }
    })
    |> promise.await(fn(_) { promise.resolve(Nil) })

    Nil
  })
}

fn save_profile_effect(
  handle: String,
  form_data: profile_edit.FormData,
) -> Effect(Msg) {
  effect.from(fn(dispatch) {
    let url = "/api/profile/" <> handle <> "/update"

    // Build the JSON body
    let json_fields = []

    // Add display_name if not empty
    let json_fields = case form_data.display_name {
      "" -> json_fields
      name -> [#("display_name", json.string(name)), ..json_fields]
    }

    // Add description if not empty
    let json_fields = case form_data.description {
      "" -> json_fields
      desc -> [#("description", json.string(desc)), ..json_fields]
    }

    // Add home_town as JSON object with name and h3_index
    let json_fields = case form_data.location_input.selected_location {
      Some(loc) -> {
        let location_json =
          json.object([
            #("name", json.string(loc.name)),
            #("value", json.string(loc.h3_index)),
          ])
        [#("home_town", location_json), ..json_fields]
      }
      None -> json_fields
    }

    // Add interests as array (split by comma)
    let json_fields = case form_data.interests {
      "" -> json_fields
      interests_str -> {
        let interests_list =
          string.split(interests_str, ",")
          |> list.map(string.trim)
          |> list.filter(fn(s) { s != "" })
        [#("interests", json.array(interests_list, json.string)), ..json_fields]
      }
    }

    // Add avatar data if a new file was selected
    let json_fields = case form_data.avatar_file_data {
      Some(file_data) ->
        case file_data.base64_data {
          "" -> json_fields
          _ -> [
            #("avatar_base64", json.string(file_data.base64_data)),
            #("avatar_mime_type", json.string(file_data.mime_type)),
            ..json_fields
          ]
        }
      None -> json_fields
    }

    let json_body = json.object(json_fields) |> json.to_string

    io.println("Sending profile update: " <> json_body)

    post_json(url, json_body)
    |> promise.map(fn(result) {
      case result {
        Ok(#(200, text)) -> {
          io.println("Profile saved successfully, parsing response...")
          // Parse the returned profile
          case json.parse(text, profile.profile_decoder()) {
            Ok(updated_profile) -> {
              io.println("Profile parsed successfully")
              dispatch(
                ProfileEditMsg(profile_edit.SaveCompleted(Ok(updated_profile))),
              )
            }
            Error(_) -> {
              io.println("Failed to parse profile response")
              dispatch(
                ProfileEditMsg(
                  profile_edit.SaveCompleted(
                    Error("Failed to parse updated profile"),
                  ),
                ),
              )
            }
          }
        }
        Ok(#(status, text)) -> {
          io.println(
            "Save failed with status "
            <> int.to_string(status)
            <> ": "
            <> text,
          )
          dispatch(
            ProfileEditMsg(
              profile_edit.SaveCompleted(
                Error("Failed to save profile (status " <> int.to_string(status) <> ")"),
              ),
            ),
          )
        }
        Error(err) -> {
          io.println("Save request failed: " <> err)
          dispatch(
            ProfileEditMsg(profile_edit.SaveCompleted(Error(err))),
          )
        }
      }
    })
    |> promise.await(fn(_) { promise.resolve(Nil) })

    Nil
  })
}

// VIEW ------------------------------------------------------------------------

fn view(model: Model) -> Element(Msg) {
  layout.layout(model.current_user, [
    case model.route {
      Home -> home.view()
      Login -> login.view()
      Profile(handle: _handle) -> {
        case model.profile_state {
          NotAsked | Loading ->
            html.div([attribute.class("text-center py-12")], [
              html.p([attribute.class("text-zinc-400")], [
                html.text("Loading profile..."),
              ]),
            ])
          Loaded(p) -> {
            let current_user_handle = case model.current_user {
              option.Some(user) -> option.Some(user.handle)
              option.None -> option.None
            }
            profile_page.view(p, current_user_handle)
          }
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
