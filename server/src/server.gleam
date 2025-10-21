import api/graphql
import gleam/dynamic/decode
import gleam/erlang/process
import gleam/http.{Get, Post}
import gleam/json
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/string_tree
import lustre/attribute
import lustre/element
import lustre/element/html
import mist
import shared/profile
import wisp.{type Request, type Response}
import wisp/wisp_mist

pub fn main() {
  wisp.configure_logger()
  let secret_key_base = wisp.random_string(64)

  let assert Ok(priv_directory) = wisp.priv_directory("server")
  let static_directory = priv_directory <> "/static"

  let assert Ok(_) =
    handle_request(static_directory, _)
    |> wisp_mist.handler(secret_key_base)
    |> mist.new
    |> mist.port(3000)
    |> mist.start

  process.sleep_forever()
}

// REQUEST HANDLERS ------------------------------------------------------------

fn app_middleware(
  req: Request,
  static_directory: String,
  next: fn(Request) -> Response,
) -> Response {
  let req = wisp.method_override(req)
  use <- wisp.log_request(req)
  use <- wisp.rescue_crashes
  use req <- wisp.handle_head(req)
  use <- wisp.serve_static(req, under: "/static", from: static_directory)

  next(req)
}

fn handle_request(static_directory: String, req: Request) -> Response {
  use req <- app_middleware(req, static_directory)

  case req.method, wisp.path_segments(req) {
    // API endpoint to fetch profile data as JSON
    Get, ["api", "profile", handle] -> fetch_profile_json(handle)

    // API endpoint to update profile
    Post, ["api", "profile", handle, "update"] -> update_profile_json(req, handle)

    // Profile routes - prerender with data
    Get, ["profile", handle] -> serve_profile(handle)
    Get, ["profile", handle, "edit"] -> serve_profile(handle)

    // Everything else gets our base HTML
    Get, _ -> serve_index(option.None)

    // Fallback for other methods/paths
    _, _ -> wisp.not_found()
  }
}

fn serve_index(profile_data: Option(profile.Profile)) -> Response {
  let model_script = case profile_data {
    option.Some(profile_val) ->
      html.script(
        [attribute.type_("application/json"), attribute.id("model")],
        json.to_string(profile.profile_to_json(profile_val)),
      )
    option.None -> element.none()
  }

  let html =
    html.html([], [
      html.head([], [
        html.title([], "Atmosphere Conf"),
        html.script([attribute.src("https://cdn.tailwindcss.com")], ""),
        html.script(
          [attribute.type_("module"), attribute.src("/static/client.js")],
          "",
        ),
        model_script,
      ]),
      html.body([attribute.class("bg-zinc-950 text-zinc-300 font-mono")], [
        html.div([attribute.id("app")], []),
      ]),
    ])

  html
  |> element.to_document_string_tree
  |> string_tree.to_string
  |> wisp.html_response(200)
}

fn get_graphql_config() -> graphql.Config {
  graphql.Config(
    api_url: "https://api.slices.network/graphql",
    slice_uri: "at://did:plc:bcgltzqazw5tb6k2g3ttenbj/network.slices.slice/3m3gc7lhwzx2z",
    access_token: "",
  )
}

fn fetch_profile_json(handle: String) -> Response {
  let config = get_graphql_config()

  wisp.log_info("API: Fetching profile for handle: " <> handle)

  case graphql.get_profile_by_handle(config, handle) {
    Ok(option.Some(profile_val)) -> {
      wisp.log_info("API: Profile found for handle: " <> handle)
      json.to_string(profile.profile_to_json(profile_val))
      |> wisp.json_response(200)
    }
    Ok(option.None) -> {
      wisp.log_warning("API: No profile found for handle: " <> handle)
      wisp.json_response(json.to_string(json.object([#("error", json.string("Profile not found"))])), 404)
    }
    Error(err) -> {
      wisp.log_error("API: Error fetching profile: " <> err)
      wisp.json_response(json.to_string(json.object([#("error", json.string(err))])), 500)
    }
  }
}

fn serve_profile(handle: String) -> Response {
  let config = get_graphql_config()

  wisp.log_info("SSR: Fetching profile for handle: " <> handle)

  let profile_data = case graphql.get_profile_by_handle(config, handle) {
    Ok(option.Some(profile_val)) -> {
      wisp.log_info("SSR: Profile found for handle: " <> handle)
      option.Some(profile_val)
    }
    Ok(option.None) -> {
      wisp.log_warning("SSR: No profile found for handle: " <> handle)
      option.None
    }
    Error(err) -> {
      wisp.log_error("SSR: Error fetching profile: " <> err)
      option.None
    }
  }

  serve_index(profile_data)
}

fn update_profile_json(req: Request, handle: String) -> Response {
  let config = get_graphql_config()

  wisp.log_info("API: Updating profile for handle: " <> handle)

  // Parse request body
  use body <- wisp.require_string_body(req)

  // Decode JSON
  let update_result = {
    use parsed <- result.try(
      json.parse(body, decode.dynamic)
      |> result.map_error(fn(_) { "Invalid JSON" }),
    )

    // Extract fields from JSON
    let display_name = case
      decode.run(parsed, decode.at(["display_name"], decode.optional(decode.string)))
    {
      Ok(val) -> val
      Error(_) -> None
    }

    let description = case
      decode.run(parsed, decode.at(["description"], decode.optional(decode.string)))
    {
      Ok(val) -> val
      Error(_) -> None
    }

    // Decode home_town as an object with name and value fields
    let home_town = case
      decode.run(
        parsed,
        decode.at(
          ["home_town"],
          decode.optional({
            use name <- decode.field("name", decode.string)
            use value <- decode.field("value", decode.string)
            decode.success(#(name, value))
          }),
        ),
      )
    {
      Ok(Some(#(name, value))) -> {
        // Re-encode as JSON object
        let json_obj = json.object([#("name", json.string(name)), #("value", json.string(value))])
        Some(json_obj)
      }
      _ -> None
    }

    let interests = case
      decode.run(
        parsed,
        decode.at(["interests"], decode.optional(decode.list(decode.string))),
      )
    {
      Ok(val) -> val
      Error(_) -> None
    }

    Ok(graphql.ProfileUpdate(
      display_name: display_name,
      description: description,
      home_town: home_town,
      interests: interests,
    ))
  }

  case update_result {
    Ok(update) -> {
      case graphql.update_profile(config, handle, update) {
        Ok(_) -> {
          wisp.log_info("API: Profile updated successfully for: " <> handle)
          wisp.json_response(
            json.to_string(json.object([
              #("success", json.bool(True)),
              #("message", json.string("Profile updated successfully")),
            ])),
            200,
          )
        }
        Error(err) -> {
          wisp.log_error("API: Failed to update profile: " <> err)
          wisp.json_response(
            json.to_string(json.object([#("error", json.string(err))])),
            500,
          )
        }
      }
    }
    Error(err) -> {
      wisp.log_error("API: Failed to parse update request: " <> err)
      wisp.json_response(
        json.to_string(json.object([#("error", json.string(err))])),
        400,
      )
    }
  }
}
