# dev-live-reload

Live reload themes and packages as you edit their stylesheets.

## Features

- **Live style reload**: reflects edits to `.css` files in any running Lumine window instantly.
- **Dev mode default**: installed by default on Lumine windows running in dev mode.
- **Theme and package watching**: watches core, theme, and package stylesheets for changes.

## Installation

To install `dev-live-reload` search for _dev-live-reload_ in the Install pane of the Lumine settings or run `lumine --install lumine-code/dev-live-reload`.

## Commands

Commands available in `atom-workspace`:

- `dev-live-reload:reload-all`: reload all core and package stylesheets.

## Usage

New `.css` files added within an active package or theme's styles directories are picked up without reloading the window.

An edit to a stylesheet reloads only the package that owns it, a theme's `variables.css` included: custom properties cascade at runtime, so re-attaching the theme that defines them restyles everything that reads them.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
