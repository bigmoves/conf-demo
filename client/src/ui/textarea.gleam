import lustre/attribute.{type Attribute}
import lustre/element.{type Element}
import lustre/element/html

pub fn textarea(
  attributes: List(Attribute(msg)),
  value: String,
) -> Element(msg) {
  let classes =
    "w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded text-sm text-zinc-300 focus:outline-none focus:border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed resize-y min-h-[100px]"

  html.textarea([attribute.class(classes), ..attributes], value)
}
