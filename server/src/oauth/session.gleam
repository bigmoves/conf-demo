import gleam/bit_array
import gleam/crypto
import gleam/dynamic/decode
import gleam/option.{type Option}
import gleam/result
import sqlight.{type Connection}
import wisp.{type Request, type Response}

/// OAuth session data stored server-side
pub type OAuthSession {
  OAuthSession(
    session_id: String,
    access_token: String,
    refresh_token: Option(String),
    did: String,
    handle: String,
  )
}

/// Temporary OAuth state during authorization flow
pub type OAuthState {
  OAuthState(code_verifier: String, code_challenge: String, login_hint: String)
}

const session_cookie_name = "lustre_session"

/// Initialize the session database tables
pub fn init_db(db: Connection) -> Result(Nil, sqlight.Error) {
  let sessions_sql =
    "
    CREATE TABLE IF NOT EXISTS oauth_sessions (
      session_id TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      did TEXT NOT NULL,
      handle TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  "

  let states_sql =
    "
    CREATE TABLE IF NOT EXISTS oauth_states (
      state_id TEXT PRIMARY KEY,
      code_verifier TEXT NOT NULL,
      code_challenge TEXT NOT NULL,
      login_hint TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  "

  use _ <- result.try(sqlight.exec(sessions_sql, db))
  sqlight.exec(states_sql, db)
}

/// Generate a new session ID
pub fn generate_session_id() -> String {
  let random_bytes = crypto.strong_random_bytes(32)
  bit_array.base64_url_encode(random_bytes, False)
}

/// Create a new OAuth session
pub fn create_session(
  db: Connection,
  access_token: String,
  refresh_token: Option(String),
  did: String,
  handle: String,
) -> Result(String, sqlight.Error) {
  let session_id = generate_session_id()

  let sql =
    "
    INSERT INTO oauth_sessions (session_id, access_token, refresh_token, did, handle)
    VALUES (?, ?, ?, ?, ?)
  "

  let refresh_token_value = case refresh_token {
    option.Some(token) -> sqlight.text(token)
    option.None -> sqlight.null()
  }

  use _ <- result.try(sqlight.query(
    sql,
    db,
    [
      sqlight.text(session_id),
      sqlight.text(access_token),
      refresh_token_value,
      sqlight.text(did),
      sqlight.text(handle),
    ],
    decode.success(Nil),
  ))

  Ok(session_id)
}

/// Get a session by ID
pub fn get_session(
  db: Connection,
  session_id: String,
) -> Result(OAuthSession, sqlight.Error) {
  let sql =
    "
    SELECT session_id, access_token, refresh_token, did, handle
    FROM oauth_sessions
    WHERE session_id = ?
  "

  let decoder = {
    use session_id <- decode.field(0, decode.string)
    use access_token <- decode.field(1, decode.string)
    use refresh_token <- decode.field(2, decode.optional(decode.string))
    use did <- decode.field(3, decode.string)
    use handle <- decode.field(4, decode.string)

    decode.success(OAuthSession(
      session_id: session_id,
      access_token: access_token,
      refresh_token: refresh_token,
      did: did,
      handle: handle,
    ))
  }

  case sqlight.query(sql, db, [sqlight.text(session_id)], decoder) {
    Ok([session]) -> Ok(session)
    Ok([]) ->
      Error(sqlight.SqlightError(
        sqlight.ConstraintForeignkey,
        "Session not found",
        0,
      ))
    Ok(_) ->
      Error(sqlight.SqlightError(
        sqlight.ConstraintForeignkey,
        "Multiple sessions found",
        0,
      ))
    Error(e) -> Error(e)
  }
}

/// Delete a session by ID
pub fn delete_session(
  db: Connection,
  session_id: String,
) -> Result(Nil, sqlight.Error) {
  let sql = "DELETE FROM oauth_sessions WHERE session_id = ?"

  use _ <- result.try(sqlight.query(
    sql,
    db,
    [sqlight.text(session_id)],
    decode.success(Nil),
  ))
  Ok(Nil)
}

/// Set session cookie on response
pub fn set_session_cookie(
  response: Response,
  req: Request,
  session_id: String,
) -> Response {
  wisp.set_cookie(
    response,
    req,
    session_cookie_name,
    session_id,
    wisp.Signed,
    60 * 60 * 24 * 14,
  )
}

/// Get session ID from request cookies
pub fn get_session_id(req: Request) -> Result(String, Nil) {
  wisp.get_cookie(req, session_cookie_name, wisp.Signed)
}

/// Clear session cookie on response
pub fn clear_session_cookie(response: Response, req: Request) -> Response {
  wisp.set_cookie(response, req, session_cookie_name, "", wisp.Signed, 0)
}

/// Get the current user from session
pub fn get_current_user(
  req: Request,
  db: Connection,
) -> Result(#(String, String, String), Nil) {
  use session_id <- result.try(get_session_id(req))
  use session <- result.try(
    get_session(db, session_id) |> result.replace_error(Nil),
  )
  Ok(#(session.did, session.handle, session.access_token))
}

/// Save OAuth state for authorization flow
pub fn save_oauth_state(
  db: Connection,
  state_id: String,
  state: OAuthState,
) -> Result(Nil, sqlight.Error) {
  let sql =
    "
    INSERT INTO oauth_states (state_id, code_verifier, code_challenge, login_hint)
    VALUES (?, ?, ?, ?)
  "

  use _ <- result.try(sqlight.query(
    sql,
    db,
    [
      sqlight.text(state_id),
      sqlight.text(state.code_verifier),
      sqlight.text(state.code_challenge),
      sqlight.text(state.login_hint),
    ],
    decode.success(Nil),
  ))

  Ok(Nil)
}

/// Get OAuth state by ID
pub fn get_oauth_state(
  db: Connection,
  state_id: String,
) -> Result(OAuthState, sqlight.Error) {
  let sql =
    "
    SELECT code_verifier, code_challenge, login_hint
    FROM oauth_states
    WHERE state_id = ?
  "

  let decoder = {
    use code_verifier <- decode.field(0, decode.string)
    use code_challenge <- decode.field(1, decode.string)
    use login_hint <- decode.field(2, decode.string)

    decode.success(OAuthState(
      code_verifier: code_verifier,
      code_challenge: code_challenge,
      login_hint: login_hint,
    ))
  }

  case sqlight.query(sql, db, [sqlight.text(state_id)], decoder) {
    Ok([state]) -> Ok(state)
    Ok([]) ->
      Error(sqlight.SqlightError(
        sqlight.ConstraintForeignkey,
        "State not found",
        0,
      ))
    Ok(_) ->
      Error(sqlight.SqlightError(
        sqlight.ConstraintForeignkey,
        "Multiple states found",
        0,
      ))
    Error(e) -> Error(e)
  }
}

/// Delete OAuth state after use
pub fn delete_oauth_state(
  db: Connection,
  state_id: String,
) -> Result(Nil, sqlight.Error) {
  let sql = "DELETE FROM oauth_states WHERE state_id = ?"

  use _ <- result.try(sqlight.query(
    sql,
    db,
    [sqlight.text(state_id)],
    decode.success(Nil),
  ))
  Ok(Nil)
}
