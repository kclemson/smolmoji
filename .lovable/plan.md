

## Replace README showcase image

Replace the current `og-image.png` reference in the README with the uploaded screenshot of the app.

### Steps

1. Copy `user-uploads://smolmoji-overview.jpg` to `public/smolmoji-overview.jpg`
2. Update `README.md` to reference the new image instead of `og-image.png`, using an HTML `<img>` tag at 75% width to keep it from being too large:

```markdown
<img src="public/smolmoji-overview.jpg" alt="smolmoji - pixel art emoji creator" width="75%" />
```

