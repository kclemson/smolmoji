

## Fix README image to use markdown syntax

The TinyToolTown bot requires standard markdown image syntax `![Description](image-url)` to detect the showcase image. The current HTML `<img>` tag won't be recognized.

### Change in `README.md`

Replace:
```html
<img src="public/smolmoji-overview.jpg" alt="smolmoji - pixel art emoji creator" width="75%" />
```

With:
```markdown
![smolmoji - pixel art emoji creator](public/smolmoji-overview.jpg)
```

This loses the 75% width constraint, but the bot needs the standard markdown syntax to pick up the image. The image size in the README will be full-width, which should be fine for the bot's purposes.

