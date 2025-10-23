import api/graphql
import api/profile_init
import dotenv_gleam
import envoy
import gleam/bit_array
import gleam/dynamic/decode
import gleam/erlang/process
import gleam/http.{Get, Post}
import gleam/http/request
import gleam/httpc
import gleam/io
import gleam/json
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/string
import gleam/string_tree
import gleam/uri
import lustre/attribute
import lustre/element
import lustre/element/html
import mist
import oauth/pkce
import oauth/session
import shared/profile
import sqlight
import wisp.{type Request, type Response}
import wisp/wisp_mist

// OAUTH CONFIG ----------------------------------------------------------------

pub type OAuthConfig {
  OAuthConfig(
    client_id: String,
    client_secret: String,
    redirect_uri: String,
    auth_url: String,
  )
}

fn load_oauth_config() -> OAuthConfig {
  OAuthConfig(
    client_id: envoy.get("OAUTH_CLIENT_ID")
      |> result.unwrap(""),
    client_secret: envoy.get("OAUTH_CLIENT_SECRET")
      |> result.unwrap(""),
    redirect_uri: envoy.get("OAUTH_REDIRECT_URI")
      |> result.unwrap("http://localhost:3000/oauth/callback"),
    auth_url: envoy.get("OAUTH_AUTH_URL")
      |> result.unwrap("http://localhost:3001"),
  )
}

pub fn main() {
  // Load environment variables from .env file
  let _ = dotenv_gleam.config()

  wisp.configure_logger()

  // Load secret key from environment or generate one (for development)
  let secret_key_base = case envoy.get("SECRET_KEY_BASE") {
    Ok(key) -> key
    Error(_) -> {
      // In development, generate and warn
      let generated = wisp.random_string(64)
      io.println(
        "WARNING: No SECRET_KEY_BASE found in environment. Using generated key: "
        <> generated,
      )
      io.println("Add this to your .env file: SECRET_KEY_BASE=" <> generated)
      generated
    }
  }

  let oauth_config = load_oauth_config()

  let assert Ok(priv_directory) = wisp.priv_directory("server")
  let static_directory = priv_directory <> "/static"

  // Initialize database
  use db <- sqlight.with_connection("./sessions.db")
  let assert Ok(_) = session.init_db(db)

  let assert Ok(_) =
    handle_request(static_directory, db, oauth_config, _)
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

fn require_profile_owner(
  req: Request,
  db: sqlight.Connection,
  handle: String,
  next: fn(String) -> Response,
) -> Response {
  case session.get_current_user(req, db) {
    Error(_) -> {
      wisp.log_warning("Unauthorized attempt to access profile: " <> handle)
      wisp.json_response(
        json.to_string(
          json.object([#("error", json.string("Not authenticated"))]),
        ),
        401,
      )
    }
    Ok(#(_did, current_handle, access_token)) -> {
      case current_handle == handle {
        False -> {
          wisp.log_warning(
            "User "
            <> current_handle
            <> " attempted to access profile of "
            <> handle,
          )
          wisp.json_response(
            json.to_string(
              json.object([
                #("error", json.string("You can only edit your own profile")),
              ]),
            ),
            403,
          )
        }
        True -> next(access_token)
      }
    }
  }
}

fn handle_request(
  static_directory: String,
  db: sqlight.Connection,
  oauth_config: OAuthConfig,
  req: Request,
) -> Response {
  use req <- app_middleware(req, static_directory)

  case req.method, wisp.path_segments(req) {
    // OAuth routes
    Get, ["login"] -> serve_index(option.None, req, db)
    Post, ["oauth", "authorize"] ->
      handle_oauth_authorize(req, db, oauth_config)
    Get, ["oauth", "callback"] -> handle_oauth_callback(req, db, oauth_config)
    Post, ["logout"] -> handle_logout(req, db)

    // API endpoint to get current user
    Get, ["api", "user", "current"] -> get_current_user_json(req, db)

    // API endpoint to fetch profile data as JSON
    Get, ["api", "profile", handle] -> fetch_profile_json(handle, req, db)

    // API endpoint to update profile
    Post, ["api", "profile", handle, "update"] ->
      update_profile_json(req, handle, db)

    // Profile routes - prerender with data
    Get, ["profile", handle] -> serve_profile(handle, req, db)
    Get, ["profile", handle, "edit"] -> serve_profile(handle, req, db)

    // Everything else gets our base HTML
    Get, _ -> serve_index(option.None, req, db)

    // Fallback for other methods/paths
    _, _ -> wisp.not_found()
  }
}

fn serve_index(
  profile_data: Option(profile.Profile),
  req: Request,
  db: sqlight.Connection,
) -> Response {
  // Get current user if authenticated
  let user_json = case session.get_current_user(req, db) {
    Ok(#(_did, handle, _access_token)) ->
      Some(json.object([#("handle", json.string(handle))]))
    Error(_) -> None
  }

  let model_script = case profile_data, user_json {
    option.Some(profile_val), Some(user) ->
      html.script(
        [attribute.type_("application/json"), attribute.id("model")],
        json.to_string(
          json.object([
            #("profile", profile.profile_to_json(profile_val)),
            #("user", user),
          ]),
        ),
      )
    option.Some(profile_val), None ->
      html.script(
        [attribute.type_("application/json"), attribute.id("model")],
        json.to_string(
          json.object([#("profile", profile.profile_to_json(profile_val))]),
        ),
      )
    None, Some(user) ->
      html.script(
        [attribute.type_("application/json"), attribute.id("model")],
        json.to_string(json.object([#("user", user)])),
      )
    None, None -> element.none()
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

fn get_graphql_config(access_token: String) -> graphql.Config {
  graphql.Config(
    api_url: "https://api.slices.network/graphql",
    slice_uri: "at://did:plc:bcgltzqazw5tb6k2g3ttenbj/network.slices.slice/3m3gc7lhwzx2z",
    access_token: access_token,
  )
}

fn get_current_user_json(req: Request, db: sqlight.Connection) -> Response {
  case session.get_current_user(req, db) {
    Ok(#(did, handle, _access_token)) -> {
      wisp.json_response(
        json.to_string(
          json.object([
            #("did", json.string(did)),
            #("handle", json.string(handle)),
          ]),
        ),
        200,
      )
    }
    Error(_) -> {
      wisp.json_response(
        json.to_string(
          json.object([#("error", json.string("Not authenticated"))]),
        ),
        401,
      )
    }
  }
}

fn fetch_profile_json(
  handle: String,
  req: Request,
  db: sqlight.Connection,
) -> Response {
  // Get access token from session if available
  let access_token = case session.get_current_user(req, db) {
    Ok(#(_, _, token)) -> token
    Error(_) -> ""
  }

  let config = get_graphql_config(access_token)

  wisp.log_info("API: Fetching profile for handle: " <> handle)

  case graphql.get_profile_by_handle(config, handle) {
    Ok(option.Some(profile_val)) -> {
      wisp.log_info("API: Profile found for handle: " <> handle)
      json.to_string(profile.profile_to_json(profile_val))
      |> wisp.json_response(200)
    }
    Ok(option.None) -> {
      wisp.log_warning("API: No profile found for handle: " <> handle)
      wisp.json_response(
        json.to_string(
          json.object([#("error", json.string("Profile not found"))]),
        ),
        404,
      )
    }
    Error(err) -> {
      wisp.log_error("API: Error fetching profile: " <> err)
      wisp.json_response(
        json.to_string(json.object([#("error", json.string(err))])),
        500,
      )
    }
  }
}

fn serve_profile(
  handle: String,
  req: Request,
  db: sqlight.Connection,
) -> Response {
  // Get access token from session if available
  let access_token = case session.get_current_user(req, db) {
    Ok(#(_, _, token)) -> token
    Error(_) -> ""
  }

  let config = get_graphql_config(access_token)

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

  serve_index(profile_data, req, db)
}

fn update_profile_json(
  req: Request,
  handle: String,
  db: sqlight.Connection,
) -> Response {
  use access_token <- require_profile_owner(req, db, handle)

  let config = get_graphql_config(access_token)

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
      decode.run(
        parsed,
        decode.at(["display_name"], decode.optional(decode.string)),
      )
    {
      Ok(val) -> val
      Error(_) -> None
    }

    let description = case
      decode.run(
        parsed,
        decode.at(["description"], decode.optional(decode.string)),
      )
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
        let json_obj =
          json.object([
            #("name", json.string(name)),
            #("value", json.string(value)),
          ])
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

    // Extract avatar data if present
    let avatar_base64 = case
      decode.run(
        parsed,
        decode.at(["avatar_base64"], decode.optional(decode.string)),
      )
    {
      Ok(val) -> val
      Error(_) -> None
    }

    let avatar_mime_type = case
      decode.run(
        parsed,
        decode.at(["avatar_mime_type"], decode.optional(decode.string)),
      )
    {
      Ok(val) -> val
      Error(_) -> None
    }

    Ok(#(
      graphql.ProfileUpdate(
        display_name: display_name,
        description: description,
        home_town: home_town,
        interests: interests,
        avatar: None,
      ),
      avatar_base64,
      avatar_mime_type,
    ))
  }

  case update_result {
    Ok(#(update, avatar_base64, avatar_mime_type)) -> {
      // Determine which avatar to use
      let avatar_blob = case avatar_base64, avatar_mime_type {
        Some(base64), Some(mime) -> {
          // New avatar uploaded - upload the blob
          case graphql.upload_blob(config, base64, mime) {
            Ok(blob) -> Some(blob)
            Error(err) -> {
              wisp.log_error("API: Failed to upload avatar blob: " <> err)
              None
            }
          }
        }
        _, _ -> {
          // No new avatar - fetch current profile and use existing avatar blob
          case graphql.get_profile_by_handle(config, handle) {
            Ok(Some(current_profile)) -> {
              // Use existing avatar blob if present
              case current_profile.avatar_blob {
                Some(blob) -> {
                  // Convert AvatarBlob to JSON for the mutation
                  Some(
                    json.object([
                      #("$type", json.string("blob")),
                      #("ref", json.object([#("$link", json.string(blob.ref))])),
                      #("mimeType", json.string(blob.mime_type)),
                      #("size", json.int(blob.size)),
                    ]),
                  )
                }
                None -> None
              }
            }
            _ -> None
          }
        }
      }

      // Create final update with avatar blob if available
      let final_update = graphql.ProfileUpdate(..update, avatar: avatar_blob)

      case graphql.update_profile(config, handle, final_update) {
        Ok(updated_profile) -> {
          wisp.log_info("API: Profile updated successfully for: " <> handle)
          wisp.json_response(
            json.to_string(profile.profile_to_json(updated_profile)),
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

// OAUTH HANDLERS --------------------------------------------------------------

fn handle_oauth_authorize(
  req: Request,
  db: sqlight.Connection,
  config: OAuthConfig,
) -> Response {
  use formdata <- wisp.require_form(req)

  // Get login hint from form
  let login_hint = case formdata.values {
    [#("loginHint", hint), ..] -> hint
    _ -> ""
  }

  wisp.log_info("OAuth: Authorization requested for: " <> login_hint)

  // Generate PKCE parameters
  let code_verifier = pkce.generate_code_verifier()
  let code_challenge = pkce.generate_code_challenge(code_verifier)
  let state = session.generate_session_id()

  // Store PKCE state
  let oauth_state =
    session.OAuthState(
      code_verifier: code_verifier,
      code_challenge: code_challenge,
      login_hint: login_hint,
    )
  let _ = session.save_oauth_state(db, state, oauth_state)

  // Build authorization URL
  let query_params = [
    #("response_type", "code"),
    #("client_id", config.client_id),
    #("redirect_uri", config.redirect_uri),
    #("state", state),
    #("code_challenge", code_challenge),
    #("code_challenge_method", "S256"),
    #("scope", "profile openid atproto transition:generic"),
    #("login_hint", login_hint),
  ]

  let full_auth_url = config.auth_url <> "/oauth/authorize"

  let auth_uri = case uri.parse(full_auth_url) {
    Ok(base_uri) -> {
      let query_string =
        query_params
        |> list_to_query_string

      uri.Uri(..base_uri, query: Some(query_string))
      |> uri.to_string
    }
    Error(_) -> full_auth_url
  }

  wisp.log_info("OAuth: Redirecting to: " <> auth_uri)
  wisp.redirect(auth_uri)
}

fn list_to_query_string(params: List(#(String, String))) -> String {
  params
  |> list.map(fn(pair) {
    let #(key, value) = pair
    uri.percent_encode(key) <> "=" <> uri.percent_encode(value)
  })
  |> string.join("&")
}

fn handle_oauth_callback(
  req: Request,
  db: sqlight.Connection,
  config: OAuthConfig,
) -> Response {
  // Get code from query params
  let code = case req.query {
    Some(query_string) -> {
      case uri.parse_query(query_string) {
        Ok(params) -> list.key_find(params, "code") |> result.unwrap("missing")
        Error(_) -> "missing"
      }
    }
    None -> "missing"
  }

  // Get state from query params
  let state = case req.query {
    Some(query_string) -> {
      case uri.parse_query(query_string) {
        Ok(params) -> list.key_find(params, "state") |> result.unwrap("missing")
        Error(_) -> "missing"
      }
    }
    None -> "missing"
  }

  // Validate we have both
  case code == "missing" || state == "missing" {
    True -> {
      wisp.log_error("OAuth: Missing code or state in callback")
      wisp.redirect("/login?error=Missing+parameters")
    }
    False -> {
      wisp.log_info("OAuth: Callback received with code and state")

      // Retrieve PKCE code_verifier from state
      case session.get_oauth_state(db, state) {
        Ok(oauth_state) -> {
          // Clean up the OAuth state
          let _ = session.delete_oauth_state(db, state)

          wisp.log_info("OAuth: Exchanging code for tokens")

          let token_url = config.auth_url <> "/oauth/token"

          case
            exchange_code_for_tokens(
              token_url,
              code,
              oauth_state.code_verifier,
              config.client_id,
              config.client_secret,
              config.redirect_uri,
            )
          {
            Ok(token_response) -> {
              wisp.log_info("OAuth: Successfully exchanged code for tokens")

              // Fetch user info
              let userinfo_url = config.auth_url <> "/oauth/userinfo"
              case get_user_info(userinfo_url, token_response.access_token) {
                Ok(user_info) -> {
                  wisp.log_info("OAuth: Got user info")
                  wisp.log_info("  DID: " <> user_info.did)
                  wisp.log_info(
                    "  Handle: " <> option.unwrap(user_info.handle, "(none)"),
                  )

                  // Initialize user profile (silent failure)
                  let graphql_config =
                    graphql.Config(
                      api_url: "https://api.slices.network/graphql",
                      slice_uri: "at://did:plc:bcgltzqazw5tb6k2g3ttenbj/network.slices.slice/3m3gc7lhwzx2z",
                      access_token: token_response.access_token,
                    )

                  let _ =
                    profile_init.initialize_user_profile(
                      graphql_config,
                      user_info.did,
                      option.unwrap(user_info.handle, ""),
                    )

                  case
                    session.create_session(
                      db,
                      token_response.access_token,
                      token_response.refresh_token,
                      user_info.did,
                      option.unwrap(user_info.handle, ""),
                    )
                  {
                    Ok(session_id) -> {
                      wisp.redirect("/")
                      |> session.set_session_cookie(req, session_id)
                    }
                    Error(_err) -> {
                      wisp.log_error("OAuth: Failed to create session")
                      wisp.redirect("/login?error=Session+creation+failed")
                    }
                  }
                }
                Error(err) -> {
                  wisp.log_error("OAuth: Failed to get user info: " <> err)
                  wisp.redirect("/login?error=Failed+to+get+user+info")
                }
              }
            }
            Error(err) -> {
              wisp.log_error("OAuth: Token exchange failed: " <> err)
              wisp.redirect("/login?error=Token+exchange+failed")
            }
          }
        }
        Error(_) -> {
          wisp.log_error("OAuth: Invalid or expired state")
          wisp.redirect("/login?error=Invalid+state")
        }
      }
    }
  }
}

fn handle_logout(req: Request, db: sqlight.Connection) -> Response {
  // Get session ID and delete session
  case session.get_session_id(req) {
    Ok(session_id) -> {
      let _ = session.delete_session(db, session_id)
      wisp.log_info("User logged out")
    }
    Error(_) -> Nil
  }

  // Clear cookie and redirect
  wisp.redirect("/")
  |> session.clear_session_cookie(req)
}

// TOKEN EXCHANGE --------------------------------------------------------------

type TokenResponse {
  TokenResponse(access_token: String, refresh_token: Option(String))
}

type UserInfo {
  UserInfo(sub: String, did: String, handle: Option(String))
}

fn exchange_code_for_tokens(
  token_url: String,
  code: String,
  code_verifier: String,
  client_id: String,
  client_secret: String,
  redirect_uri: String,
) -> Result(TokenResponse, String) {
  // Build form-encoded body (without client credentials)
  let body_params = [
    #("grant_type", "authorization_code"),
    #("code", code),
    #("redirect_uri", redirect_uri),
    #("client_id", client_id),
    #("code_verifier", code_verifier),
  ]

  let body = list_to_query_string(body_params)

  // Create Basic Auth header
  let credentials = client_id <> ":" <> client_secret
  let credentials_bytes = bit_array.from_string(credentials)
  let basic_auth = "Basic " <> bit_array.base64_encode(credentials_bytes, True)

  // Create HTTP request
  case request.to(token_url) {
    Ok(req) -> {
      let req =
        req
        |> request.set_method(Post)
        |> request.set_header("authorization", basic_auth)
        |> request.set_header(
          "content-type",
          "application/x-www-form-urlencoded",
        )
        |> request.set_body(body)

      // Send request
      case httpc.send(req) {
        Ok(resp) -> {
          case resp.status {
            200 -> {
              // Parse JSON response
              case json.parse(resp.body, decode.dynamic) {
                Ok(parsed) -> {
                  // Extract fields from token response
                  let access_token = case
                    decode.run(
                      parsed,
                      decode.at(["access_token"], decode.string),
                    )
                  {
                    Ok(token) -> token
                    Error(_) -> ""
                  }

                  let refresh_token = case
                    decode.run(
                      parsed,
                      decode.at(
                        ["refresh_token"],
                        decode.optional(decode.string),
                      ),
                    )
                  {
                    Ok(token) -> token
                    Error(_) -> None
                  }

                  case access_token == "" {
                    True -> Error("Missing access_token in token response")
                    False ->
                      Ok(TokenResponse(
                        access_token: access_token,
                        refresh_token: refresh_token,
                      ))
                  }
                }
                Error(_) -> Error("Failed to parse token response JSON")
              }
            }
            _ ->
              Error(
                "Token request failed with status: "
                <> string.inspect(resp.status),
              )
          }
        }
        Error(_) -> Error("Failed to send token request")
      }
    }
    Error(_) -> Error("Invalid token URL")
  }
}

fn get_user_info(
  userinfo_url: String,
  access_token: String,
) -> Result(UserInfo, String) {
  case request.to(userinfo_url) {
    Ok(req) -> {
      let req =
        req
        |> request.set_method(Get)
        |> request.set_header("authorization", "Bearer " <> access_token)

      case httpc.send(req) {
        Ok(resp) -> {
          case resp.status {
            200 -> {
              case json.parse(resp.body, decode.dynamic) {
                Ok(parsed) -> {
                  let sub = case
                    decode.run(parsed, decode.at(["sub"], decode.string))
                  {
                    Ok(s) -> s
                    Error(_) -> ""
                  }

                  let did = case
                    decode.run(parsed, decode.at(["did"], decode.string))
                  {
                    Ok(d) -> d
                    Error(_) -> sub
                  }

                  let handle = case
                    decode.run(
                      parsed,
                      decode.at(["name"], decode.optional(decode.string)),
                    )
                  {
                    Ok(h) -> h
                    Error(_) -> None
                  }

                  case sub == "" {
                    True -> Error("Missing sub in userinfo response")
                    False -> Ok(UserInfo(sub: sub, did: did, handle: handle))
                  }
                }
                Error(_) -> Error("Failed to parse userinfo response JSON")
              }
            }
            _ ->
              Error(
                "Userinfo request failed with status: "
                <> string.inspect(resp.status),
              )
          }
        }
        Error(_) -> Error("Failed to send userinfo request")
      }
    }
    Error(_) -> Error("Invalid userinfo URL")
  }
}
