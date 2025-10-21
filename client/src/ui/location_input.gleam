import gleam/dynamic/decode
import gleam/float
import gleam/javascript/promise
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/string
import lustre/attribute
import lustre/effect.{type Effect}
import lustre/element.{type Element}
import lustre/element/html
import lustre/event
import utils/location

pub type Model {
  Model(
    input_value: String,
    selected_location: Option(location.LocationData),
    suggestions: List(location.NominatimResult),
    is_loading: Bool,
    show_dropdown: Bool,
  )
}

pub type Msg {
  UserTypedQuery(String)
  UserClickedSuggestion(location.NominatimResult)
  UserFocusedInput
  UserBlurredInput
  GotSearchResults(Result(List(location.NominatimResult), String))
}

pub fn init(initial_value: Option(location.LocationData)) -> Model {
  Model(
    input_value: case initial_value {
      Some(loc) -> loc.name
      None -> ""
    },
    selected_location: initial_value,
    suggestions: [],
    is_loading: False,
    show_dropdown: False,
  )
}

pub fn update(model: Model, msg: Msg) -> #(Model, Effect(Msg)) {
  case msg {
    UserTypedQuery(query) -> {
      let model = Model(..model, input_value: query)

      case string.length(query) >= 2 {
        True -> {
          let model = Model(..model, is_loading: True, show_dropdown: True)
          #(model, debounced_search_effect(query))
        }
        False -> {
          #(
            Model(
              ..model,
              suggestions: [],
              show_dropdown: False,
              selected_location: None,
            ),
            effect.none(),
          )
        }
      }
    }

    UserClickedSuggestion(result) -> {
      let lat = case float.parse(result.lat) {
        Ok(v) -> v
        Error(_) -> 0.0
      }
      let lon = case float.parse(result.lon) {
        Ok(v) -> v
        Error(_) -> 0.0
      }

      let h3_index = location.lat_lon_to_h3(lat, lon)
      let formatted_name = format_location_name(result)

      let location_data =
        location.LocationData(
          name: formatted_name,
          lat: lat,
          lon: lon,
          h3_index: h3_index,
        )

      #(
        Model(
          ..model,
          input_value: formatted_name,
          selected_location: Some(location_data),
          show_dropdown: False,
          suggestions: [],
        ),
        effect.none(),
      )
    }

    UserFocusedInput -> {
      case string.length(model.input_value) >= 2 {
        True -> {
          let model = Model(..model, is_loading: True, show_dropdown: True)
          #(model, debounced_search_effect(model.input_value))
        }
        False -> #(model, effect.none())
      }
    }

    UserBlurredInput -> {
      // Delay hiding dropdown to allow click on suggestion
      #(model, effect.none())
    }

    GotSearchResults(result) -> {
      case result {
        Ok(results) -> {
          #(
            Model(
              ..model,
              suggestions: results,
              is_loading: False,
              show_dropdown: results != [],
            ),
            effect.none(),
          )
        }
        Error(_err) -> {
          #(
            Model(..model, suggestions: [], is_loading: False),
            effect.none(),
          )
        }
      }
    }
  }
}

// FFI function for debouncing
@external(javascript, "../client_ffi.mjs", "debounce")
fn debounce(callback: fn() -> Nil, delay: Int) -> fn() -> Nil

fn debounced_search_effect(query: String) -> Effect(Msg) {
  effect.from(fn(dispatch) {
    // Debounce the search by 300ms
    debounce(
      fn() {
        location.search_locations(query)
        |> promise.map(fn(result) {
          case result {
            Ok(dynamic_list) -> {
              // Decode each dynamic result using filter_map which expects Result
              let decoded_results =
                list.filter_map(dynamic_list, fn(dyn) {
                  decode.run(dyn, location.nominatim_result_decoder())
                })

              dispatch(GotSearchResults(Ok(decoded_results)))
            }
            Error(err) -> {
              dispatch(GotSearchResults(Error(err)))
            }
          }
        })
        |> promise.await(fn(_) { promise.resolve(Nil) })

        Nil
      },
      300,
    )

    Nil
  })
}

fn format_location_name(result: location.NominatimResult) -> String {
  let parts = []

  // Append items to maintain order: City, State, Country
  let parts = case result.address.city {
    "" -> parts
    city -> list.append(parts, [city])
  }

  let parts = case result.address.state {
    "" -> parts
    state -> list.append(parts, [state])
  }

  let parts = case result.address.country {
    "" -> parts
    country -> list.append(parts, [country])
  }

  case parts {
    [] -> result.display_name
    _ -> string.join(parts, ", ")
  }
}

pub fn view(model: Model, placeholder: String) -> Element(Msg) {
  html.div([attribute.class("relative")], [
    html.div([attribute.class("relative")], [
      input_element(model.input_value, placeholder, model.is_loading),
      icon_element(),
    ]),
    dropdown_element(model.show_dropdown, model.suggestions),
  ])
}

fn input_element(
  value: String,
  placeholder: String,
  _is_loading: Bool,
) -> Element(Msg) {
  html.input([
    attribute.type_("text"),
    attribute.value(value),
    attribute.placeholder(placeholder),
    attribute.class(
      "w-full px-3 py-2 pr-10 bg-zinc-900 border border-zinc-800 rounded text-sm text-zinc-300 focus:outline-none focus:border-zinc-700",
    ),
    event.on_input(UserTypedQuery),
    event.on_focus(UserFocusedInput),
    event.on_blur(UserBlurredInput),
  ])
}

fn icon_element() -> Element(Msg) {
  html.div(
    [
      attribute.class(
        "absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500",
      ),
    ],
    [html.text("📍")],
  )
}

fn dropdown_element(
  show: Bool,
  suggestions: List(location.NominatimResult),
) -> Element(Msg) {
  case show && suggestions != [] {
    True ->
      html.div(
        [
          attribute.class(
            "absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg max-h-60 overflow-y-auto",
          ),
        ],
        list.map(suggestions, suggestion_item),
      )
    False -> element.none()
  }
}

fn suggestion_item(result: location.NominatimResult) -> Element(Msg) {
  html.button(
    [
      attribute.type_("button"),
      attribute.class(
        "w-full px-4 py-3 text-left hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-b-0",
      ),
      event.on_click(UserClickedSuggestion(result)),
    ],
    [
      html.div([attribute.class("flex items-start gap-2")], [
        html.div([attribute.class("text-zinc-500 mt-1 flex-shrink-0")], [
          html.text("📍"),
        ]),
        html.div([attribute.class("text-sm text-zinc-300")], [
          html.text(format_location_name(result)),
        ]),
      ]),
    ],
  )
}
