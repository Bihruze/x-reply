# X Crypto Agent - AI-Powered Twitter/X Reply Bot

<p align="center">
  <img src="images/icon-128.png" alt="X Crypto Agent Logo" width="128" height="128">
</p>

<p align="center">
  <strong>Generate intelligent, contextual replies on Twitter/X using Google Gemini AI</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#api-key-setup">API Key Setup</a> •
  <a href="#usage">Usage</a> •
  <a href="#configuration">Configuration</a>
</p>

---

## Overview

X Crypto Agent is a Chrome browser extension that uses Google Gemini AI to automatically generate contextually relevant replies on Twitter/X. It's specifically designed for the cryptocurrency community, allowing users to engage more effectively with tweets while maintaining their unique voice and persona.

## Features

### Core Features
- **AI-Powered Reply Generation** - Generate intelligent replies with a single click
- **Sentiment Analysis** - Automatically detects tweet sentiment (Positive/Negative/Neutral)
- **Language Detection** - Detects tweet language and responds in the same language
- **Link Summarization** - Analyzes and summarizes links in tweets for better context
- **Author Style Analysis** - Analyzes the author's writing style for more relevant replies

### Content Generation
- **Project Post Generator** - Create promotional posts for crypto projects (5 style options)
- **Viral Post Generator** - Generate high-engagement tweet variations
- **Hashtag Suggester** - AI-powered hashtag recommendations
- **Competitor Analysis** - Analyze competitor Twitter accounts

### Automation
- **Auto-Reply to Mentions** - Automatically respond to notifications
- **Auto-Comment** - Post replies automatically with configurable delays
- **Scheduled Posts** - Schedule tweets for future posting
- **Bulk Auto-Comment** - Process multiple tweet URLs in queue

### Personalization
- **Multiple Personas** - Choose from Degen, Analyst, Roast, Maxi, Builder, Neutral, or Custom
- **Investment Philosophy** - Add your crypto beliefs to reflect in responses
- **Writing Style Detection** - Analyze and match any user's writing style
- **Tone Selection** - Bullish, Bearish, Funny, Professional, or Casual
- **Reply Length Control** - Short, Medium, or Long responses

### Targeting & Analytics
- **Daily Reply Limits** - Control engagement volume
- **Follower Range Filtering** - Target users by follower count
- **Whitelist/Blacklist** - Control who you engage with
- **Reply Tracking** - Track who you've replied to (green/red indicators)
- **Analytics Dashboard** - View reply statistics, charts, and top accounts

### Multi-Language Support
- English, Turkish, German, French, Spanish UI
- Auto-detect or manual language selection for replies

---

## Installation

### Method 1: Git Clone (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/Bihruze/x-reply.git
   ```

2. **Navigate to the project folder**
   ```bash
   cd x-reply
   ```

3. **Add your API Key** (See [API Key Setup](#api-key-setup) below)

4. **Load the extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable **Developer mode** (toggle in top right corner)
   - Click **Load unpacked**
   - Select the `x-reply` folder

5. **Pin the extension** (Optional)
   - Click the puzzle icon in Chrome toolbar
   - Find "X Crypto Agent" and click the pin icon

### Method 2: Download ZIP

1. Click the green **Code** button on GitHub
2. Select **Download ZIP**
3. Extract the ZIP file to a folder
4. Follow steps 3-5 from Method 1

---

## API Key Setup

This extension requires a **Google Gemini API Key** to function. The API has a generous free tier.

### Step 1: Get Your Free API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **Create API Key**
4. Copy the key (it starts with `AIzaSy...`)

> **Free Tier:** 15 requests/minute, 1,500 requests/day - No credit card required!

### Step 2: Add the API Key to the Extension

1. Open the `x-reply` folder
2. Open `service_worker.js` in a text editor (VS Code, Notepad++, etc.)
3. Find line **287** (around line 287):
   ```javascript
   const API_KEY = ""; // <-- PASTE YOUR API KEY HERE
   ```
4. Paste your API key between the quotes:
   ```javascript
   const API_KEY = "AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxx"; // <-- PASTE YOUR API KEY HERE
   ```
5. Save the file

### Step 3: Reload the Extension

1. Go to `chrome://extensions/`
2. Find "X Crypto Agent"
3. Click the **reload** icon (circular arrow)

---

## Usage

### Basic Usage

1. **Navigate to Twitter/X** - Go to [twitter.com](https://twitter.com) or [x.com](https://x.com)

2. **Find a tweet** - Scroll through your feed or go to a specific tweet

3. **Click "AI Reply"** - You'll see a blue "AI Reply" button on each tweet

4. **Review & Post** - The generated reply appears in the text box. Edit if needed, then post!

### Using the Popup

Click the extension icon in your toolbar to access:

| Tab | Description |
|-----|-------------|
| **Settings** | Configure persona, tone, language, and automation options |
| **Post** | Generate project posts, viral content, and hashtags |
| **Schedule** | Schedule tweets for future posting |
| **Analytics** | View your reply statistics and activity |
| **Bulk** | Process multiple tweet URLs at once |
| **Targeting** | Set follower ranges, limits, and user lists |

### Persona Options

| Persona | Style |
|---------|-------|
| **Degen** | Crypto degen slang, high energy, moon talk |
| **Analyst** | Data-driven, technical analysis, measured |
| **Roast** | Witty, sarcastic, playful burns |
| **Maxi** | Bitcoin maximalist perspective |
| **Builder** | Developer/founder mindset, constructive |
| **Neutral** | Balanced, informative, no bias |
| **Custom** | Define your own persona |

### Tone Options

- **Neutral** - Balanced, informative
- **Bullish** - Optimistic, positive outlook
- **Bearish** - Cautious, skeptical perspective
- **Funny** - Humorous, witty responses
- **Professional** - Formal, business-like
- **Casual** - Relaxed, friendly tone

---

## Configuration

### Settings Tab Options

| Setting | Description |
|---------|-------------|
| **Language** | Auto-detect or select specific language for replies |
| **Persona** | Choose your AI personality |
| **Custom Persona** | Write custom instructions for the AI |
| **User Memory** | Add investment philosophy/beliefs to reflect |
| **Auto-Reply** | Enable automatic replies to mentions |
| **Tone** | Select response tone |
| **Reply Length** | Short, Medium, or Long |
| **Auto-Generate** | Generate reply on button click |
| **Auto-Comment** | Automatically post the reply |
| **Include @mention** | Include author's @username in reply |
| **Action Delay** | Delay between automated actions (5-60 seconds) |

### Targeting Tab Options

| Setting | Description |
|---------|-------------|
| **Daily Limit** | Maximum replies per day (default: 50) |
| **Min Followers** | Only reply to users with at least X followers |
| **Max Followers** | Only reply to users with at most X followers |
| **Niche Keywords** | Keywords to look for in tweets |
| **Blacklist** | Users to never engage with (comma-separated) |
| **Whitelist** | Users to always engage with (bypasses limits) |

---

## Indicators

When browsing Twitter/X, you'll see indicators next to usernames:

| Indicator | Meaning |
|-----------|---------|
| ✓ (Green) | You replied to this user within the last 24 hours |
| ✓ (Red) | You replied to this user more than 24 hours ago |
| No tick | You haven't replied to this user |

---

## Project Structure

```
x-reply/
├── manifest.json          # Extension configuration
├── service_worker.js      # Backend logic & API integration
├── content_script.js      # DOM manipulation & UI injection
├── popup.html             # Main popup interface
├── popup.js               # Popup functionality
├── popup.css              # Popup styling
├── notifications.js       # Auto-reply to mentions
├── dashboard.html         # Analytics page
├── dashboard.js           # Analytics logic
├── dashboard.css          # Analytics styling
├── images/                # Extension icons
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
└── _locales/              # Translations
    ├── en/messages.json
    ├── tr/messages.json
    ├── de/messages.json
    ├── fr/messages.json
    └── es/messages.json
```

---

## Troubleshooting

### "API Key not set" Error
- Make sure you added your API key to `service_worker.js` line 287
- Reload the extension after adding the key

### AI Reply Button Not Showing
- Refresh the Twitter/X page
- Make sure the extension is enabled in `chrome://extensions/`
- Try disabling and re-enabling the extension

### Replies Not Generating
- Check your internet connection
- Verify your API key is correct
- Check if you've hit the API rate limit (15 requests/minute)

### Extension Not Loading
- Make sure you selected the correct folder (the one containing `manifest.json`)
- Check for errors in `chrome://extensions/`

---

## API Rate Limits

Google Gemini API free tier limits:
- **15 requests per minute**
- **1,500 requests per day**
- **32,000 tokens per minute**

If you need higher limits, consider upgrading to a paid plan at [Google AI Studio](https://aistudio.google.com/).

---

## Privacy & Security

- Your API key is stored locally in the extension files
- No data is sent to any server except Google's Gemini API
- Reply history is stored locally in Chrome storage
- No tracking or analytics are collected by the extension

---

## Disclaimer

This tool is intended for personal use to assist with Twitter/X engagement. Please use responsibly and in accordance with Twitter/X's Terms of Service. Automated engagement should be used thoughtfully to avoid being flagged as spam.

---

## License

ISC License

---

## Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests

---

## Support

If you encounter any issues or have questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Open an issue on GitHub

---

**Made with AI for the Crypto Community**
