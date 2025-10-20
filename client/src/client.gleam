import api/graphql
import api/profile as profile_api
import gleam/javascript/promise
import gleam/option.{type Option, None, Some}
import gleam/uri.{type Uri}
import lustre
import lustre/attribute
import lustre/effect.{type Effect}
import lustre/element.{type Element}
import lustre/element/html
import modem
import pages/home
import pages/profile
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
  NotFound(uri: Uri)
}

pub type ProfileState {
  NotAsked
  Loading
  Loaded(profile: profile_api.Profile)
  Failed(error: String)
}

type Model {
  Model(route: Route, profile_state: ProfileState)
}

fn init(_flags) -> #(Model, Effect(Msg)) {
  let route = case modem.initial_uri() {
    Ok(uri) -> parse_route(uri)
    Error(_) -> Home
  }

  // Check if we need to fetch profile data on initial load
  let #(model, initial_effect) = case route {
    Profile(handle: handle) -> {
      let model = Model(route: route, profile_state: Loading)
      #(model, fetch_profile(handle))
    }
    _ -> {
      let model = Model(route: route, profile_state: NotAsked)
      #(model, effect.none())
    }
  }

  let modem_effect = modem.init(on_url_change)

  // Combine both effects
  let combined_effect = effect.batch([modem_effect, initial_effect])

  #(model, combined_effect)
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
    _ -> NotFound(uri: uri)
  }
}

// UPDATE ----------------------------------------------------------------------

type Msg {
  UserNavigatedTo(route: Route)
  ProfileFetched(result: Result(Option(profile_api.Profile), String))
}

fn update(model: Model, msg: Msg) -> #(Model, Effect(Msg)) {
  case msg {
    UserNavigatedTo(route: route) -> {
      let model = Model(..model, route: route)

      // Fetch profile if navigating to profile page
      case route {
        Profile(handle: handle) -> {
          let model = Model(..model, profile_state: Loading)
          let effect = fetch_profile(handle)
          #(model, effect)
        }
        _ -> #(model, effect.none())
      }
    }

    ProfileFetched(result: result) -> {
      let profile_state = case result {
        Ok(Some(profile)) -> Loaded(profile)
        Ok(None) -> Failed("Profile not found")
        Error(error) -> Failed(error)
      }
      #(Model(..model, profile_state: profile_state), effect.none())
    }
  }
}

fn fetch_profile(handle: String) -> Effect(Msg) {
  effect.from(fn(dispatch) {
    // TODO: Get these from environment or config
    let config =
      graphql.Config(
        api_url: "https://api.slices.network",
        slice_uri: "at://did:plc:bcgltzqazw5tb6k2g3ttenbj/network.slices.slice/3m3gc7lhwzx2z",
        access_token: "",
      )

    profile_api.get_profile_by_handle(config, handle)
    |> promise.tap(fn(result) { dispatch(ProfileFetched(result)) })

    Nil
  })
}

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
          Loaded(profile: p) -> profile.view(p)
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
