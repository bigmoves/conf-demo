import cache
import client/model.{type Msg}
import gleam/dynamic/decode
import gleam/int
import gleam/io
import gleam/javascript/promise
import gleam/json
import gleam/list
import gleam/option.{None, Some}
import gleam/result
import gleam/string
import lustre/effect.{type Effect}
import pages/profile_edit
import query
import shared/api/types
import ui/layout

// FFI DECLARATIONS ------------------------------------------------------------

@external(javascript, "../client_ffi.mjs", "getCurrentTimeMs")
pub fn get_current_time_ms() -> Int

@external(javascript, "../client_ffi.mjs", "fetchUrl")
fn fetch_url(url: String) -> promise.Promise(Result(#(Int, String), String))

@external(javascript, "../client_ffi.mjs", "postJson")
fn post_json(
  url: String,
  json_body: String,
) -> promise.Promise(Result(#(Int, String), String))

@external(javascript, "../client_ffi.mjs", "processFileFromInputId")
fn process_file_from_input_id(
  input_id: String,
) -> promise.Promise(Result(profile_edit.AvatarFileData, String))

// FETCH EFFECTS ---------------------------------------------------------------

pub fn fetch_current_user() -> Effect(Msg) {
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
    |> promise.tap(fn(result) { dispatch(model.CurrentUserFetched(result)) })

    Nil
  })
}

pub fn fetch_profile_with_cache(handle: String) -> Effect(Msg) {
  effect.from(fn(dispatch) {
    let url = "/api/profile/" <> handle
    io.println("Fetching profile from: " <> url)

    // Mark query as fetching
    dispatch(model.QueryStarted(query.ProfileQuery(handle)))

    // Fetch from API
    fetch_url(url)
    |> promise.map(fn(body_result) {
      io.println("Body result: " <> string.inspect(body_result))
      case body_result {
        Ok(#(200, text)) -> {
          io.println("Got 200 response, parsing JSON...")
          case
            json.parse(text, types.profile_decoder())
          {
            Ok(profile_data) -> {
              // Dispatch success
              dispatch(model.ProfileQuerySuccess(handle, profile_data))
            }
            Error(err) -> {
              io.println("JSON parse error: " <> string.inspect(err))
              dispatch(model.ProfileQueryError(
                handle,
                "Failed to parse profile JSON",
              ))
            }
          }
        }
        Ok(#(404, _)) -> {
          io.println("Got 404 response")
          dispatch(model.ProfileQueryError(handle, "Profile not found"))
        }
        Ok(#(status, _)) -> {
          io.println("Got status: " <> string.inspect(status))
          dispatch(model.ProfileQueryError(handle, "API request failed"))
        }
        Error(err) -> {
          io.println("Fetch error: " <> err)
          dispatch(model.ProfileQueryError(handle, err))
        }
      }
    })
    |> promise.await(fn(_) { promise.resolve(Nil) })

    Nil
  })
}

pub fn fetch_attendees_with_cache() -> Effect(Msg) {
  effect.from(fn(dispatch) {
    let url = "/api/attendees"
    io.println("Fetching attendees from: " <> url)

    // Mark query as fetching
    dispatch(model.QueryStarted(query.AttendeesQuery))

    fetch_url(url)
    |> promise.map(fn(body_result) {
      io.println("Attendees body result: " <> string.inspect(body_result))
      case body_result {
        Ok(#(200, text)) -> {
          io.println("Got 200 response, parsing JSON...")
          case
            json.parse(
              text,
              decode.list(types.profile_decoder()),
            )
          {
            Ok(profiles) -> {
              // Dispatch success
              dispatch(model.AttendeesQuerySuccess(profiles))
            }
            Error(err) -> {
              io.println("JSON parse error: " <> string.inspect(err))
              dispatch(model.AttendeesQueryError(
                "Failed to parse attendees JSON",
              ))
            }
          }
        }
        Ok(#(status, _)) -> {
          io.println("Got status: " <> string.inspect(status))
          dispatch(model.AttendeesQueryError("API request failed"))
        }
        Error(err) -> {
          io.println("Fetch error: " <> err)
          dispatch(model.AttendeesQueryError(err))
        }
      }
    })
    |> promise.await(fn(_) { promise.resolve(Nil) })

    Nil
  })
}

// FILE PROCESSING EFFECTS -----------------------------------------------------

pub fn process_file_from_input_effect(input_id: String) -> Effect(Msg) {
  effect.from(fn(dispatch) {
    process_file_from_input_id(input_id)
    |> promise.map(fn(result) {
      case result {
        Ok(file_data) -> {
          io.println("File processed successfully")
          dispatch(
            model.ProfileEditMsg(profile_edit.AvatarFileProcessed(file_data)),
          )
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

// SAVE PROFILE EFFECT ---------------------------------------------------------

pub fn save_profile_effect(
  handle: String,
  form_data: profile_edit.FormData,
  cache: cache.Cache,
) -> Effect(Msg) {
  effect.from(fn(dispatch) {
    let url = "/api/profile/" <> handle <> "/update"

    // Get the original profile from cache to preserve createdAt
    let original_profile = cache.get_profile(cache, handle)

    // Build the JSON body matching GraphQL input format (camelCase keys)
    let json_fields = []

    // Add createdAt from original profile to preserve it
    let json_fields = case original_profile {
      Some(profile) ->
        case profile.created_at {
          Some(created_at) -> [
            #("createdAt", json.string(created_at)),
            ..json_fields
          ]
          None -> json_fields
        }
      None -> json_fields
    }

    // Add displayName (camelCase) if not empty
    let json_fields = case form_data.display_name {
      "" -> json_fields
      name -> [#("displayName", json.string(name)), ..json_fields]
    }

    // Add description if not empty
    let json_fields = case form_data.description {
      "" -> json_fields
      desc -> [#("description", json.string(desc)), ..json_fields]
    }

    // Add homeTown (camelCase) as JSON object with optional name and value
    let json_fields = case form_data.location_input.selected_location {
      Some(loc) -> {
        let location_json =
          json.object([
            #("name", json.string(loc.name)),
            #("value", json.string(loc.h3_index)),
          ])
        [#("homeTown", location_json), ..json_fields]
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

    // Add avatar data if a new file was selected (still needs special handling for upload)
    let json_fields = case form_data.avatar_file_data {
      Some(file_data) ->
        case file_data.base64_data {
          "" -> json_fields
          _ -> [
            #("avatarBase64", json.string(file_data.base64_data)),
            #("avatarMimeType", json.string(file_data.mime_type)),
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
          case
            json.parse(text, types.profile_decoder())
          {
            Ok(updated_profile) -> {
              io.println("Profile parsed successfully")
              dispatch(
                model.ProfileEditMsg(
                  profile_edit.SaveCompleted(Ok(updated_profile)),
                ),
              )
            }
            Error(_) -> {
              io.println("Failed to parse profile response")
              dispatch(
                model.ProfileEditMsg(
                  profile_edit.SaveCompleted(Error(
                    "Failed to parse updated profile",
                  )),
                ),
              )
            }
          }
        }
        Ok(#(status, text)) -> {
          io.println(
            "Save failed with status " <> int.to_string(status) <> ": " <> text,
          )
          dispatch(
            model.ProfileEditMsg(
              profile_edit.SaveCompleted(Error(
                "Failed to save profile (status "
                <> int.to_string(status)
                <> ")",
              )),
            ),
          )
        }
        Error(err) -> {
          io.println("Save request failed: " <> err)
          dispatch(model.ProfileEditMsg(profile_edit.SaveCompleted(Error(err))))
        }
      }
    })
    |> promise.await(fn(_) { promise.resolve(Nil) })

    Nil
  })
}
