import lustre/attribute.{type Attribute}
import lustre/element.{type Element}
import lustre/element/html

pub type Variant {
  Default
  Primary
  Link
  Danger
}

pub type Size {
  Sm
  Md
  Lg
}

pub fn button(
  attributes: List(Attribute(msg)),
  variant: Variant,
  size: Size,
  children: List(Element(msg)),
) -> Element(msg) {
  let size_classes = case size {
    Sm -> "px-3 py-1.5 text-xs"
    Md -> "px-4 py-2 text-sm"
    Lg -> "px-6 py-3 text-base"
  }

  let variant_classes = case variant {
    Primary -> "text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded"
    Link -> "text-zinc-500 hover:text-zinc-300 px-2 py-1"
    Danger ->
      "bg-red-900 text-red-100 border border-red-800 hover:bg-red-800 hover:border-red-700 rounded"
    Default ->
      "text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-300 rounded"
  }

  let base_classes =
    size_classes
    <> " "
    <> variant_classes
    <> " transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"

  html.button([attribute.class(base_classes), ..attributes], children)
}
