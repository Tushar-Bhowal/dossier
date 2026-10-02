// The resume comes in as /data.json (a RenderData plus `hasPhoto`), never spliced into this source,
// so user text is always plain text to Typst — nothing to escape, nothing to inject.
export const RESUME_TEMPLATE = String.raw`
#let d = json("/data.json")
#let c = d.contact

#let L = d.layout
#let margin = (
  top: L.margins.top * 1mm,
  bottom: L.margins.bottom * 1mm,
  left: L.margins.left * 1mm,
  right: L.margins.right * 1mm,
)
#let body-width = 210mm - margin.left - margin.right
#let body-height = 297mm - margin.top - margin.bottom

#let muted = luma(70)

#set document(title: c.name, author: c.name)
// From page 2 on, a small running line so a loose page still says whose it is.
#set page(
  paper: "a4",
  margin: margin,
  header: context {
    let n = counter(page).get().first()
    if n > 1 {
      set text(size: 8.5pt, fill: muted)
      grid(columns: (1fr, auto), c.name, [Page #n])
    }
  },
)
#set text(font: "Carlito", lang: "en", hyphenate: false)
#set par(justify: false)
#set list(indent: 2pt, body-indent: 6pt, marker: [•])
// Dark blue, like the Word file: visibly a link on screen, still reads as text when printed.
#show link: set text(fill: rgb("#1a4fa3"))

#let linked(part) = if "href" in part { link(part.href, part.text) } else { part.text }

// fs scales type, sp scales the gaps. Both grow together so a short resume fills the page with
// slightly larger text and more air, instead of stopping halfway down.
#let resume(fs, sp) = {
  set text(size: 10.5pt * fs)
  set par(leading: 0.5em * calc.clamp(1 + (sp - 1) * 0.25, 0.9, 1.35), spacing: 0.55em * sp)
  set list(spacing: 0.45em * sp)

  let header = {
    block(below: 5pt * sp, text(size: 20pt * fs, weight: "bold", c.name))
    if d.contactLine.len() > 0 {
      block(text(size: 9.5pt * fs, fill: muted, d.contactLine.map(linked).join("   |   ")))
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
    v(8pt * sp * L.sectionGap + s.spaceBefore * 1pt)
    block(below: 3pt * sp, text(size: 11pt * fs, weight: "bold", upper(s.title)))
    line(length: 100%, stroke: 0.6pt + luma(140))
    v(2pt * sp)

    if "text" in s {
      par(s.text)
    }
    if "groups" in s {
      for g in s.groups {
        par([#text(weight: "bold", g.title + ":") #g.items.join(", ")])
      }
    } else if "list" in s {
      par(s.list.join(", "))
    }
    if "pairs" in s {
      for p in s.pairs {
        par([#text(weight: "bold", p.label + ":") #p.value])
      }
    }
    if "signature" in s {
      v(10pt * sp)
      grid(
        columns: (1fr, auto),
        align: (left, right),
        if "place" in s.signature { text(fill: muted, "Place: " + s.signature.place) } else { [] },
        text(weight: "bold", "(" + s.signature.name + ")"),
      )
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
          let details = ()
          if "grade" in it { details.push("Grade: " + it.grade) }
          if "credentialId" in it { details.push("ID: " + it.credentialId) }
          if "link" in it { details.push(link(it.link.href, it.link.text)) }
          if details.len() > 0 {
            v(1pt * sp)
            text(fill: muted, details.join("   |   "))
          }
          if it.bullets.len() > 0 {
            v(1pt * sp)
            list(..it.bullets)
          }
        })
      }
    }
  }
}

// (text scale, spacing scale), largest first. The first that fits one page wins; the last two shrink
// slightly so a resume that just spills over stays on one page. Anything longer flows onto a second
// page at normal size. With a chosen spacing, only the text size moves.
#let auto-sizes = (
  (1.14, 2.4), (1.14, 2.0), (1.12, 1.75), (1.1, 1.55), (1.08, 1.4), (1.06, 1.28),
  (1.04, 1.16), (1.02, 1.08), (1.0, 1.0), (0.97, 0.9), (0.94, 0.82),
)
#let density = ("auto": 1.0, compact: 0.8, balanced: 1.0, spacious: 1.3)
#let sp = density.at(L.spacing)
#let sizes = if L.spacing == "auto" {
  auto-sizes
} else {
  (1.14, 1.12, 1.1, 1.08, 1.06, 1.04, 1.02, 1.0, 0.97, 0.94).map(fs => (fs, sp))
}

#context {
  if L.fit {
    let fits(size) = measure(block(width: body-width, resume(..size))).height <= body-height - 6pt
    let chosen = sizes.find(fits)
    if chosen == none { chosen = (1.0, sp) }
    resume(..chosen)
  } else {
    resume(1.0, sp)
  }
}
`;
