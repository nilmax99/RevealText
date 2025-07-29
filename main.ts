import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Settings interface to store the user's preferred style
interface RevealTextSettings {
	revealStyle: 'blur' | 'underline';
}

// Default settings
const DEFAULT_SETTINGS: RevealTextSettings = {
	revealStyle: 'blur'
}

export default class RevealTextPlugin extends Plugin {
	settings: RevealTextSettings;

	async onload() {
		// Load settings from memory
		await this.loadSettings();

		// Add a settings tab so users can choose the style
		this.addSettingTab(new RevealTextSettingTab(this.app, this));

		console.log('Reveal Text plugin loaded.');

		this.registerMarkdownPostProcessor((element: HTMLElement, context) => {
			const codeElements = element.findAll("code");
			for (const el of codeElements) {
				const text = el.innerText.trim();
				if (text.startsWith('++') && text.endsWith('++')) {
					const word = text.substring(2, text.length - 2);
					if (word) {
						this.createInteractiveWord(el, word);
					}
				}
			}
		});
	}

	onunload() {
		console.log('Reveal Text plugin unloaded.');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	createInteractiveWord(originalElement: HTMLElement, word: string) {
		const container = document.createElement("span");
		container.className = "reveal-container";
		// Add the class for the currently selected style from settings
		container.classList.add(this.settings.revealStyle === 'blur' ? 'blur-style' : 'underline-style');

		const letters = word.split('').map(char => {
			const letterSpan = document.createElement("span");
			letterSpan.className = "reveal-letter";
			letterSpan.textContent = char;
			container.appendChild(letterSpan);
			return letterSpan;
		});

		// --- LOGIC FOR DYNAMIC REVEAL COUNT ---
		const getRevealCount = (wordLength: number): number => {
			if (wordLength <= 4) return 1;
			if (wordLength <= 6) return Math.floor(Math.random() * 2) + 1; // 1 or 2
			if (wordLength <= 8) return Math.floor(Math.random() * 2) + 2; // 2 or 3
			// For longer words, reveal between 1/3 and 1/2 of letters
			const min = Math.floor(wordLength / 3);
			const max = Math.floor(wordLength / 2);
			return Math.floor(Math.random() * (max - min + 1)) + min;
		};

		const onMouseOver = () => {
			if (container.classList.contains("fully-revealed")) return;

			letters.forEach(l => l.classList.remove("temp-revealed"));

			const revealCount = getRevealCount(letters.length);
			const shuffledIndices = Array.from(Array(letters.length).keys()).sort(() => Math.random() - 0.5);
			
			for (let i = 0; i < revealCount; i++) {
				letters[shuffledIndices[i]].classList.add("temp-revealed");
			}
		};

		const onMouseOut = () => {
			if (container.classList.contains("fully-revealed")) return;
			letters.forEach(l => l.classList.remove("temp-revealed"));
		};

		// --- LOGIC FOR CLICK TOGGLE ---
		const onClick = () => {
			// Toggle the 'fully-revealed' class on the container
			container.classList.toggle("fully-revealed");
		};

		container.addEventListener('mouseover', onMouseOver);
		container.addEventListener('mouseout', onMouseOut);
		container.addEventListener('click', onClick);
		
		originalElement.replaceWith(container);
	}
}

// --- SETTINGS TAB IMPLEMENTATION ---
class RevealTextSettingTab extends PluginSettingTab {
	plugin: RevealTextPlugin;

	constructor(app: App, plugin: RevealTextPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

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
					// You might want to force a re-render of the markdown view
					// but for now, new elements will use the new style.
				}));
	}
}