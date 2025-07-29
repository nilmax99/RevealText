import { Plugin } from 'obsidian';

export default class RevealTextPlugin extends Plugin {

	async onload() {
		console.log('Reveal Text plugin loaded.');

		// Register a Markdown post-processor. This function will be called on every rendered Markdown file.
		this.registerMarkdownPostProcessor((element: HTMLElement, context) => {
			
			// Find all potential elements. We'll look for `<code>` blocks,
			// which are created in Markdown using single backticks: `++text++`
			const codeElements = element.findAll("code");
			
			for (const el of codeElements) {
				const text = el.innerText.trim();

				// Check if the text matches our custom format: ++word++
				if (text.startsWith('++') && text.endsWith('++')) {
					// Extract the word without the '++' symbols
					const word = text.substring(2, text.length - 2);
					this.createInteractiveWord(el, word);
				}
			}
		});
	}

	onunload() {
		console.log('Reveal Text plugin unloaded.');
	}

	createInteractiveWord(originalElement: HTMLElement, word: string) {
		// Create the main container that will hold all the letters
		const container = document.createElement("span");
		container.className = "reveal-container";

		// Create a separate span for each letter of the word
		const letters = word.split('').map(char => {
			const letterSpan = document.createElement("span");
			letterSpan.className = "reveal-letter";
			letterSpan.textContent = char;
			container.appendChild(letterSpan);
			return letterSpan;
		});

		let isFullyRevealed = false;

		// Event handler for hovering over the word
		const onMouseOver = () => {
			if (isFullyRevealed) return;
			
			// First, reset any previously revealed letters
			letters.forEach(l => l.classList.remove("temp-revealed"));

			// Choose 1 to 3 letters to reveal, but no more than the word's length
			const revealCount = Math.min(letters.length, Math.floor(Math.random() * 3) + 1);
			
			// Create a shuffled list of indices and pick the first few to reveal
			const shuffledIndices = Array.from(Array(letters.length).keys()).sort(() => Math.random() - 0.5);
			
			for (let i = 0; i < revealCount; i++) {
				const indexToReveal = shuffledIndices[i];
				letters[indexToReveal].classList.add("temp-revealed");
			}
		};

		// Event handler for when the mouse leaves the word
		const onMouseOut = () => {
			if (isFullyRevealed) return;
			// Hide all temporarily revealed letters
			letters.forEach(l => l.classList.remove("temp-revealed"));
		};

		// Event handler for clicking the word
		const onClick = () => {
			isFullyRevealed = true;
			container.classList.add("fully-revealed");
			
			// Remove event listeners after the word is permanently revealed
			container.removeEventListener('mouseover', onMouseOver);
			container.removeEventListener('mouseout', onMouseOut);
			container.removeEventListener('click', onClick);
		};

		// Attach the event listeners
		container.addEventListener('mouseover', onMouseOver);
		container.addEventListener('mouseout', onMouseOut);
		container.addEventListener('click', onClick);
		
		// Replace the original `<code>` element with our new interactive container
		originalElement.replaceWith(container);
	}
}