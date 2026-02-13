

## Add showcase image to README

The TinyToolTown bot needs a thumbnail image in the README using markdown syntax. You already have `public/og-image.png` in the repo which should work as the showcase image.

### Changes

**`README.md`** -- Add an image tag right after the project description, before the "Live" link:

```markdown
# smolmoji

Easily create and edit pixel art emojis or icons with AI

![smolmoji - pixel art emoji creator](public/og-image.png)

**Live:** [smolmoji.com](https://smolmoji.com)
```

This uses a relative path so GitHub will render it directly in the README. The `og-image.png` is already designed as a preview image for the project, making it the perfect choice for the tool showcase thumbnail.

If `og-image.png` turns out to be too small or not representative enough, you can replace it with an actual screenshot of the app later.
