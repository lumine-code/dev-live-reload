# dev-live-reload

Live reload themes and packages as you edit their stylesheets.

## Features

- **Live style reload**: reflects edits to `.css` and `.less` files in any running Lumine window instantly.
- **Dev mode default**: installed by default on Lumine windows running in dev mode.
- **Theme and package watching**: watches core, theme, and package stylesheets for changes.

## Installation

To install `dev-live-reload` search for _dev-live-reload_ in the Install pane of the Lumine settings or run `lumine --install lumine-code/dev-live-reload`.

## Commands

Commands available in `atom-workspace`:

- `dev-live-reload:reload-all`: reload all core and package stylesheets.

## Usage

New `.css` and `.less` files added within an active package or theme's styles directories are picked up without reloading the window.

An edit to a stylesheet reloads only the package that owns it. Editing a theme's variable definitions (`variables.css`, `ui-variables.less`, `syntax-variables.less`) additionally re-derives the theme's Less variables and recompiles the stylesheets that were compiled against them — and only those, since CSS custom properties cascade at runtime without recompilation.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
