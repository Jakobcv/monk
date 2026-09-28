---
version: alpha
name: Larder
description: "A calm, legible list for reading at arm's length in a busy shop."
colors:
  ink: "#1F2320"
  ink-soft: "#5C645E"
  paper: "#FBFAF6"
  line: "#E4E1D8"
  basil: "#2F6B4F"
  basil-soft: "#E3EFE8"
  tomato: "#B23A2B"
typography:
  list-item:
    fontFamily: Larder Sans
    fontSize: 19px
    fontWeight: 400
    lineHeight: 1.35
  body:
    fontFamily: Larder Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Larder Sans
    fontSize: 13px
    fontWeight: 700
    lineHeight: 1.3
rounded:
  sm: 6px
  md: 12px
  full: 50%
spacing:
  sm: 8px
  md: 16px
  lg: 24px
components:
  button-primary:
    backgroundColor: "{colors.basil}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
    height: 48px
  list-item:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.list-item}"
    padding: "{spacing.md}"
    height: 56px
  list-item-ticked:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.list-item}"
    padding: "{spacing.md}"
    height: 56px
---

## Overview

Larder is read in a shop, at arm's length, with one hand. Everything in the shopping view is large, high in contrast and still; nothing decorates it.

At home, planning, it can be denser, but it uses the same type and the same colours.

## Colors

Ink on paper for everything that is read. Basil is the one colour that means "do this": the primary action and nothing else. Tomato is only for removing something.

## Typography

One typeface, chosen because its letters stay distinct at a glance. List items are larger than body text because they are read from further away.

## Layout

A single column. The list fills the screen; actions sit at the foot, within reach of a thumb.

## Elevation & Depth

## Shapes

Soft corners on anything pressable, square corners on anything that is only read.

## Components

A list item is at least 56 px tall. A ticked item keeps its height and is struck through in the soft ink colour.

## Do's and Don'ts

- Do strike through a ticked item and move it, so its state never depends on colour.
- Do keep the primary action at the foot of the screen.
- Don't use basil for anything that isn't the primary action.
- Don't animate anything in the shopping view that the shopper didn't cause.
