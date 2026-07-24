---
<b>AI Integration (Google Gemini)</b>
---

`Step #1:` Go to google AI Studio to get a key to use for the APIs in your application.

<img width="1722" height="832" alt="image" src="https://github.com/user-attachments/assets/5d5f41a6-3a81-41c8-984b-422417752ffa" />

`Step #2:` Need to install the required dependencies ['express', '@google/genai', 'dotenv'].

```prompt
> npm install express @google/genai dotenv
```

`Step #3:` This is the format that the json payload needs to be sent to the Google API for lyria 3 music generation model.

```javascript
// Call the Gemini API using the Lyria 3 music generation model.
const response = await ai.models.generateContentStream({
	model: 'lyria-3-pro-preview',  // 'lyria-3-clip-preview' for ~30s clips, 'lyria-3-pro-preview' for ~3min clips.
	contents: prompt,
	config: {
		responseModalities: ['AUDIO', 'TEXT'],
	},
});
```
