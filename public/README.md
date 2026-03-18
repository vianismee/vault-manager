# PWA Icons Needed

Add these icons to the `public/` folder for full PWA support:

## Required Icons

| File | Size | Purpose |
|------|------|---------|
| `icon-192.png` | 192x192 | Android/manifest |
| `icon-512.png` | 512x512 | Android/manifest |
| `favicon.ico` | 32x32 | Browser tab |

## Quick Icon Generation

Using a service like:
- https://realfavicongenerator.net/
- https://www.pwabuilder.com/imageGenerator
- https://favicon.io/

Or create with SVG:

```svg
<!-- Simple lock icon - save as icon.svg and convert to PNG -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" rx="100" fill="#e67c50"/>
  <path d="M160 192v-64c0-70.7 57.3-128 128-128s128 57.3 128 128v64" stroke="white" stroke-width="32" stroke-linecap="round"/>
  <rect x="144" y="192" width="224" height="256" rx="24" fill="white"/>
</svg>
```

## For Testing (Temporary)

The PWA will work without icons, but will show a default icon.
Install prompts may not appear on iOS without proper icons.
