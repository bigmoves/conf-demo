import lustre/attribute
import lustre/element.{type Element}
import lustre/element/html

pub fn view() -> Element(msg) {
  html.div([attribute.class("space-y-8")], [
    // Welcome section
    html.div([], [
      html.h2([attribute.class("text-2xl font-bold text-white mb-4")], [
        html.text("Welcome to Atmosphere Conf"),
      ]),
    ]),
  ])
}
