# Where the SFDS sources disagree

Three conflicts were found between the theme `design-system.sf.gov` inlines and
the published `@sfgov/design-system@0.0.1` package. All three resolve toward the
docs-site theme, which is newer and agrees with the typeface sf.gov actually
serves. They are recorded rather than silently resolved, because an unrecorded
discrepancy is how the wrong action colour survived in this repo for as long as
it did.

| Property | Docs-site theme (canon) | Package `sfds.css@0.0.1` |
| --- | --- | --- |
| Body typeface | Roboto Flex | Rubik |
| Title weight | 700 | 600 |
| `bigDesc` at desktop | bold | 400 |

A fourth disagreement is with the world rather than within SFDS: live sf.gov
matches neither source on link colour, background, body text colour, or heading
scale. See `README.md`.
