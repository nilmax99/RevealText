# Reveal Text Plugin for Obsidian

This is a plugin for [Obsidian](https://obsidian.md) that allows you to create interactive words or phrases that are initially hidden and can be revealed by hovering or clicking on them. It's a great tool for creating flashcards, spoilers, or interactive notes.

## Features

- **Custom Syntax**: Uses a simple, configurable prefix to make words interactive (default is `re:word`).
- **Two Reveal Styles**:
    - **Blur**: The word is initially blurred and becomes clear upon interaction.
    - **Underline**: The word is completely hidden, and only a colored line is visible.
- **Interactive Reveal**:
    - **Hover**: Hovering over a word reveals a random subset of its letters. The number of revealed letters is dynamically calculated based on the word's length.
    - **Click**: Clicking a word toggles its full visibility. Click once to reveal the entire word, and click again to hide it.
- **Editor Integration**:
    - **Live Preview Support**: Works seamlessly in both Live Preview and Reading Mode.
    - **Context Menu**: Simply select text, right-click, and choose "Apply Reveal Text" to wrap your word with the correct syntax.
- **Customization**: A dedicated settings panel allows you to change the syntax prefix and the default reveal style.

## How to Use

There are two ways to create a revealable word:

1.  **Manual Syntax**:
    Simply type your chosen prefix before a word. By default, this is `re:`. For example:
    `re:obsidian`

2.  **Context Menu (Recommended)**:
    - Select the word or phrase you want to hide in the editor.
    - Right-click on the selection.
    - Click on **"Apply Reveal Text"**. The plugin will automatically format the text for you.

## Settings

You can customize the plugin's behavior by going to **Settings > Reveal Text**:
- **Reveal Style**: Choose between the "Blur" or "Underline" effect.
- **Syntax Prefix**: Change the prefix used to identify interactive words (e.g., you can change `re:` to `hide:` or any other text).

## Manual Installation

1.  Download the `main.js`, `styles.css`, and `manifest.json` files from the [latest release](https://github.com/nilmax99/RevealText/releases).
2.  Go to your Obsidian vault's plugin folder: `YourVault/.obsidian/plugins/`.
3.  Create a new folder named `reveal-text`.
4.  Copy the three downloaded files into the `reveal-text` folder.
5.  Reload Obsidian, go to **Settings > Community Plugins**, and enable "Reveal Text".

## For Developers

### Building the Plugin

1.  Clone this repository.
2.  Make sure you have NodeJS installed.
3.  Run `npm i` to install the necessary dependencies.
4.  Run `npm run dev` to start the development server, which will automatically recompile `main.js` on changes.
5.  To create a production build, run `npm run build`.