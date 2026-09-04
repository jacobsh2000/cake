# Static assets

Files here are served from the site root: `public/logo.png` is
`/logo.png` in the browser.

## logo.png — not yet added

`/request` renders the Columbus Cake Celebrations logo at the top of
the form and on the "Request received" confirmation. Until the file
exists, both fall back to the drawn cake icon in
`app/request/page.js` — the page is never broken, it just isn't
branded yet.

To finish it, drop the logo here as `logo.png`. No code change is
needed; the fallback stops firing as soon as the file resolves.

The mark is a circular badge, so a square canvas with a transparent
background works best. It renders at 88px on the form header and 104px
on the confirmation card, so roughly 320×320 or larger keeps it sharp
on high-density screens.
