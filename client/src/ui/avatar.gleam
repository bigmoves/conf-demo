import gleam/list
import gleam/option.{type Option}
import gleam/string
import lustre/attribute
import lustre/element.{type Element}
import lustre/element/html

pub type Size {
  Sm
  Md
  Lg
  Xl
}

pub fn avatar(src: Option(String), alt: String, size: Size) -> Element(msg) {
  let size_classes = case size {
    Sm -> "w-8 h-8"
    Md -> "w-12 h-12"
    Lg -> "w-16 h-16"
    Xl -> "w-24 h-24"
  }

  let base_classes =
    size_classes <> " rounded-full border-2 border-zinc-700 bg-zinc-800"

  case src {
    option.Some(url) ->
      html.img([
        attribute.src(url),
        attribute.alt(alt),
        attribute.class(base_classes <> " object-cover"),
      ])

    option.None -> {
      // Generate initials from alt text
      let initials =
        alt
        |> string.split(" ")
        |> list.filter_map(fn(word) {
          case string.first(word) {
            Ok(char) -> Ok(string.uppercase(char))
            Error(_) -> Error(Nil)
          }
        })
        |> list.take(2)
        |> string.join("")

      let display_text = case initials {
        "" -> "?"
        text -> text
      }

      html.div(
        [
          attribute.class(
            base_classes
            <> " flex items-center justify-center text-zinc-400 font-semibold",
          ),
        ],
        [html.text(display_text)],
      )
    }
  }
}
