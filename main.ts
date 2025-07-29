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
// This function is now shared between the editor view and the reading mode view.
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

        // --- REGISTER BOTH EXTENSIONS ---
		// 1. For Source Mode and Live Preview
        this.registerEditorExtension(buildEditorPlugin(this));

        // 2. For Reading Mode (the one that was missing)
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
    // == 2. PROCESSOR FOR READING MODE                      == //
    // ======================================================== //
    async buildReadingModeProcessor(element: HTMLElement, context: MarkdownPostProcessorContext) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const nodesToReplace: {node: Node, word: string}[] = [];
        const regex = new RegExp(`${this.settings.prefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}(\\w+)`, 'g');

        while(walker.nextNode()) {
            const node = walker.currentNode;
            if (node.parentElement?.closest('.reveal-container')) continue;
            
            if (node.textContent && node.textContent.match(regex)) {
                // We find all matches in the node's text
                const matches = Array.from(node.textContent.matchAll(regex));
                if (matches.length > 0) {
                     // Create a document fragment to hold the new nodes
                    const fragment = document.createDocumentFragment();
                    let lastIndex = 0;

                    for (const match of matches) {
                        const word = match[1]; // The word is the first captured group
                        const matchIndex = match.index ?? 0;

                        // Add the text before the match
                        fragment.appendChild(document.createTextNode(node.textContent.substring(lastIndex, matchIndex)));
                        
                        // Add the interactive element
                        const interactiveEl = createInteractiveWordElement(word, this);
                        fragment.appendChild(interactiveEl);

                        lastIndex = matchIndex + match[0].length;
                    }
                    // Add any remaining text after the last match
                    fragment.appendChild(document.createTextNode(node.textContent.substring(lastIndex)));
                    
                    // Replace the original text node with our fragment
                    node.parentNode?.replaceChild(fragment, node);
                }
            }
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
                            // If cursor is inside, just apply a style to the raw text
                            builder.add(startIndex, endIndex, Decoration.mark({ class: 'cm-reveal-text-syntax' }));
                        } else {
                            // Otherwise, replace the text with our interactive widget
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