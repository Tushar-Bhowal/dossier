// The resume comes in as /data.json (a RenderData plus `hasPhoto`), never spliced into this source,
// so user text is always plain text to Typst — nothing to escape, nothing to inject.
export const RESUME_TEMPLATE = String.raw`
#let d = json("/data.json")
#let c = d.contact

#let margin-x = 1.7cm
#let margin-y = 1.5cm
#let body-width = 210mm - 2 * margin-x
#let body-height = 297mm - 2 * margin-y

#set document(title: c.name, author: c.name)
#set page(paper: "a4", margin: (x: margin-x, y: margin-y))
#set text(font: "Carlito", lang: "en", hyphenate: false)
#set par(justify: false)
#set list(indent: 2pt, body-indent: 6pt, marker: [•])

#let muted = luma(70)

#let contact-parts = {
  let parts = ()
  if "email" in c { parts.push(c.email) }
  if "phone" in c { parts.push(c.phone) }
  if "location" in c { parts.push(c.location) }
  for l in c.links { parts.push(l.url) }
  parts
}

// fs scales type, sp scales the gaps. Both grow together so a short resume fills the page with
// slightly larger text and more air, instead of stopping halfway down.
#let resume(fs, sp) = {
  set text(size: 10.5pt * fs)
  set par(leading: 0.5em * calc.clamp(1 + (sp - 1) * 0.25, 0.9, 1.35), spacing: 0.55em * sp)
  set list(spacing: 0.45em * sp)

  let header = {
    block(below: 5pt * sp, text(size: 20pt * fs, weight: "bold", c.name))
    if contact-parts.len() > 0 {
      block(text(size: 9.5pt * fs, fill: muted, contact-parts.join("   |   ")))
    }
  }

  if d.hasPhoto {
    grid(
      columns: (1fr, auto),
      column-gutter: 14pt,
      align: (left + horizon, right + top),
      header,
      image("/photo.jpg", width: 2.5cm, height: 3.1cm, fit: "cover"),
    )
  } else {
    header
  }

  for s in d.sections {
    v(8pt * sp)
    block(below: 3pt * sp, text(size: 11pt * fs, weight: "bold", upper(s.title)))
    line(length: 100%, stroke: 0.6pt + luma(140))
    v(2pt * sp)

    if "text" in s {
      par(s.text)
    }
    if "list" in s {
      par(s.list.join(", "))
    }
    if "items" in s {
      for it in s.items {
        block(breakable: true, below: 7pt * sp, {
          grid(
            columns: (1fr, auto),
            column-gutter: 10pt,
            align: (left, right),
            {
              text(weight: "bold", it.title)
              if "org" in it { text(", " + it.org) }
              if "place" in it { text(fill: muted, ", " + it.place) }
            },
            text(fill: muted, it.dates),
          )
          if it.bullets.len() > 0 {
            v(1pt * sp)
            list(..it.bullets)
          }
        })
      }
    }
  }
}

// Largest first. The first size that fits one page wins; the last two shrink slightly so a resume
// that just spills over stays on one page. Anything longer flows onto a second page at normal size.
#let sizes = (
  (1.14, 2.4), (1.14, 2.0), (1.12, 1.75), (1.1, 1.55), (1.08, 1.4), (1.06, 1.28),
  (1.04, 1.16), (1.02, 1.08), (1.0, 1.0), (0.97, 0.9), (0.94, 0.82),
)

#context {
  let fits(size) = measure(block(width: body-width, resume(..size))).height <= body-height - 6pt
  let chosen = sizes.find(fits)
  if chosen == none { chosen = (1.0, 1.0) }
  resume(..chosen)
}
`;
