import { App, Plugin, PluginSettingTab, Setting, MarkdownPostProcessorContext } from 'obsidian';
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

interface RevealTextSettings {
	revealStyle: 'blur' | 'underline';
	prefix: string;
}

const DEFAULT_SETTINGS: RevealTextSettings = {
	revealStyle: 'blur',
	prefix: 're:'
}

// ================================================================= //
// == 1. SHARED FUNCTION TO CREATE THE INTERACTIVE WORD ELEMENT == //
// ================================================================= //
function createInteractiveWordElement(word: string, plugin: RevealTextPlugin): HTMLElement {
    const container = document.createElement("span");
    container.className = "reveal-container";
    container.classList.add(plugin.settings.revealStyle === 'blur' ? 'blur-style' : 'underline-style');

    const letters = word.split('').map(char => {
        const letterSpan = document.createElement("span");
        letterSpan.className = "reveal-letter";
        letterSpan.textContent = char;
        container.appendChild(letterSpan);
        return letterSpan;
    });

    const getRevealCount = (wordLength: number): number => {
        if (wordLength <= 4) return 1;
        if (wordLength <= 6) return Math.floor(Math.random() * 2) + 1;
        if (wordLength <= 8) return Math.floor(Math.random() * 2) + 2;
        const min = Math.floor(wordLength / 3);
        const max = Math.floor(wordLength / 2);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    const onMouseEnter = () => {
        if (container.classList.contains("fully-revealed")) return;
        letters.forEach(l => l.classList.remove("temp-revealed"));
        const revealCount = getRevealCount(letters.length);
        const shuffledIndices = Array.from(Array(letters.length).keys()).sort(() => Math.random() - 0.5);
        for (let i = 0; i < revealCount; i++) {
            letters[shuffledIndices[i]].classList.add("temp-revealed");
        }
    };

    const onMouseLeave = () => {
        if (container.classList.contains("fully-revealed")) return;
        letters.forEach(l => l.classList.remove("temp-revealed"));
    };

    const onClick = () => {
        container.classList.toggle("fully-revealed");
    };

    container.addEventListener('mouseenter', onMouseEnter);
    container.addEventListener('mouseleave', onMouseLeave);
    container.addEventListener('click', onClick);

    return container;
}


export default class RevealTextPlugin extends Plugin {
	settings: RevealTextSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new RevealTextSettingTab(this.app, this));

		this.registerEditorExtension(buildEditorPlugin(this));
		this.registerMarkdownPostProcessor(this.buildReadingModeProcessor.bind(this));

		this.registerEvent(
            this.app.workspace.on('editor-menu', (menu, editor, view) => {
                const selection = editor.getSelection();
                if (selection) {
                    menu.addItem((item) => {
                        item
                            .setTitle("Apply Reveal Text")
                            .setIcon("eye")
                            .onClick(() => {
                                editor.replaceSelection(`${this.settings.prefix}${selection}`);
                            });
                    });
                }
            })
        );
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
        this.app.workspace.updateOptions();
	}

    // ======================================================== //
    // == 2. PROCESSOR FOR READING MODE (BUG FIXED)          == //
    // ======================================================== //
    async buildReadingModeProcessor(element: HTMLElement, context: MarkdownPostProcessorContext) {
        // Find all text nodes within the element that are not already part of our widget.
        const textNodes = Array.from(element.querySelectorAll("*:not(script, style, .reveal-container)"))
                               .flatMap(el => Array.from(el.childNodes))
                               .filter(node => node.nodeType === Node.TEXT_NODE);

        const prefix = this.settings.prefix;
        const regex = new RegExp(`${prefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}(\\w+)`, 'g');

        for (const node of textNodes) {
            const text = node.textContent;
            if (!text || !text.match(regex)) continue;

            const fragment = document.createDocumentFragment();
            let lastIndex = 0;

            // Use matchAll to find every occurrence in the text node
            for (const match of text.matchAll(regex)) {
                const word = match[1];
                const matchIndex = match.index ?? 0;

                // Append text before the current match
                fragment.appendChild(document.createTextNode(text.substring(lastIndex, matchIndex)));
                
                // Create and append the interactive element
                const interactiveEl = createInteractiveWordElement(word, this);
                fragment.appendChild(interactiveEl);

                lastIndex = matchIndex + match[0].length;
            }

            // If there's any text left after the last match, append it
            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
            }

            // Replace the original text node with our new fragment
            node.parentNode?.replaceChild(fragment, node);
        }
    }
}


// ======================================================== //
// == 3. WIDGET AND PLUGIN FOR EDITOR (Live Preview)     == //
// ======================================================== //
class RevealWidget extends WidgetType {
    constructor(readonly word: string, readonly plugin: RevealTextPlugin) { super(); }
    toDOM = () => createInteractiveWordElement(this.word, this.plugin);
}

function buildEditorPlugin(plugin: RevealTextPlugin) {
    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;
            constructor(view: EditorView) { this.decorations = this.buildDecorations(view); }
            update(update: ViewUpdate) {
                if (update.docChanged || update.viewportChanged || update.selectionSet) {
                    this.decorations = this.buildDecorations(update.view);
                }
            }
            buildDecorations(view: EditorView): DecorationSet {
                const builder = new RangeSetBuilder<Decoration>();
                const prefix = plugin.settings.prefix;
                const regex = new RegExp(`(${prefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})(\\w+)`, 'g');

                for (const { from, to } of view.visibleRanges) {
                    const text = view.state.doc.sliceString(from, to);
                    for (const match of text.matchAll(regex)) {
                        const startIndex = from + (match.index || 0);
                        const endIndex = startIndex + match[0].length;
                        const word = match[2];

                        const selection = view.state.selection.main;
                        const isEditing = selection.from <= endIndex && selection.to >= startIndex;

                        if (isEditing) {
                            builder.add(startIndex, endIndex, Decoration.mark({ class: 'cm-reveal-text-syntax' }));
                        } else {
                            builder.add(startIndex, endIndex, Decoration.replace({ widget: new RevealWidget(word, plugin) }));
                        }
                    }
                }
                return builder.finish();
            }
        }, { decorations: (v) => v.decorations }
    );
}


// ======================================================== //
// == 4. SETTINGS TAB (No changes here)                  == //
// ======================================================== //
class RevealTextSettingTab extends PluginSettingTab {
	plugin: RevealTextPlugin;
	constructor(app: App, plugin: RevealTextPlugin) { super(app, plugin); this.plugin = plugin; }
	display(): void {
		const {containerEl} = this;
		containerEl.empty();
		containerEl.createEl('h2', {text: 'Reveal Text Settings'});
		new Setting(containerEl)
			.setName('Reveal Style')
			.setDesc('Choose how the hidden text should appear.')
			.addDropdown(dropdown => dropdown
				.addOption('blur', 'Blur Effect')
				.addOption('underline', 'Underline Only')
				.setValue(this.plugin.settings.revealStyle)
				.onChange(async (value: 'blur' | 'underline') => {
					this.plugin.settings.revealStyle = value;
					await this.plugin.saveSettings();
				}));
        new Setting(containerEl)
            .setName('Syntax Prefix')
            .setDesc('The text that comes before a word to make it interactive.')
            .addText(text => text
                .setPlaceholder('e.g., re:')
                .setValue(this.plugin.settings.prefix)
                .onChange(async (value) => {
                    this.plugin.settings.prefix = value;
                    await this.plugin.saveSettings();
                }));
	}
}