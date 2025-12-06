// service_worker.js

// Placeholder for storing user memory, persona, and language
let userMemory = "";
let selectedPersona = "Neutral"; // Default persona
let selectedLanguage = "English"; // Default language
let autoReplyEnabled = false; // Default auto-reply setting

// Automation settings
let tone = "Neutral";
let autoGenerate = false;
let autoComment = false;
let actionDelay = 10; // seconds
let includeMention = false;

// Load settings from storage when the service worker starts
// This function loads settings - called on startup and on install
function loadAllSettings() {
  chrome.storage.sync.get([
    'selectedLanguage', 'selectedPersona', 'userMemory', 'autoReplyEnabled',
    'tone', 'autoGenerate', 'autoComment', 'actionDelay', 'includeMention'
  ], (data) => {
    if (data.selectedLanguage) {
      selectedLanguage = data.selectedLanguage;
    }
    if (data.selectedPersona) {
      selectedPersona = data.selectedPersona;
    }
    if (data.userMemory) {
      userMemory = data.userMemory;
    }
    if (data.autoReplyEnabled !== undefined) {
      autoReplyEnabled = data.autoReplyEnabled;
    }
    // Load automation settings
    if (data.tone) tone = data.tone;
    if (data.autoGenerate !== undefined) autoGenerate = data.autoGenerate;
    if (data.autoComment !== undefined) autoComment = data.autoComment;
    if (data.actionDelay !== undefined) actionDelay = data.actionDelay;
    if (data.includeMention !== undefined) includeMention = data.includeMention;

    console.log('Service Worker: Settings loaded', { selectedLanguage, selectedPersona, userMemory, autoReplyEnabled, tone, autoGenerate, autoComment, actionDelay, includeMention });
  });
}

// Load settings on service worker startup (every time it wakes up)
loadAllSettings();

// Also load on install/update
chrome.runtime.onInstalled.addListener(() => {
  loadAllSettings();
  console.log('Service Worker: Extension installed/updated');
});


// Update settings when they change (e.g., from popup.js)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.selectedLanguage) {
      selectedLanguage = changes.selectedLanguage.newValue;
    }
    if (changes.selectedPersona) {
      selectedPersona = changes.selectedPersona.newValue;
    }
    if (changes.userMemory) {
      userMemory = changes.userMemory.newValue;
    }
    if (changes.autoReplyEnabled) {
      autoReplyEnabled = changes.autoReplyEnabled.newValue;
      console.log('Service Worker: Auto-reply setting changed to', autoReplyEnabled);
    }
    // Update automation settings
    if (changes.tone) tone = changes.tone.newValue;
    if (changes.autoGenerate) autoGenerate = changes.autoGenerate.newValue;
    if (changes.autoComment) autoComment = changes.autoComment.newValue;
    if (changes.actionDelay) actionDelay = changes.actionDelay.newValue;
    if (changes.includeMention) includeMention = changes.includeMention.newValue;

    console.log('Service Worker: Settings updated');
  }
});


// ============================================================
// API KEY CONFIGURATION
// ============================================================
// To use this extension, you need a Google Gemini API key.
//
// HOW TO GET YOUR API KEY:
// 1. Go to: https://aistudio.google.com/app/apikey
// 2. Sign in with your Google account
// 3. Click "Create API Key"
// 4. Copy the key (starts with "AIzaSy...")
// 5. Paste it below between the quotes
//
// FREE TIER: 15 requests/minute (no credit card required)
// ============================================================
const API_KEY = ""; // <-- PASTE YOUR API KEY HERE
// ============================================================

const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

// === HUMAN-LIKE TIMING (2025 Anti-Detection) ===
function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function humanizedDelay() {
  // Simulate human reaction time with natural variation
  const base = randomDelay(800, 2000);
  const occasional = Math.random() < 0.2 ? randomDelay(1000, 3000) : 0;
  return base + occasional;
}


// Rate limiting for Gemini API - Optimized for 2025
const rateLimiter = {
  queue: [],
  processing: false,
  minDelay: 1500, // 1.5 second between requests (safer)
  lastRequest: 0,
  requestsThisMinute: 0,
  minuteStart: Date.now(),
  maxRequestsPerMinute: 10, // More conservative for 2025

  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  },

  async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const now = Date.now();

    // Reset minute counter if a minute has passed
    if (now - this.minuteStart >= 60000) {
      this.requestsThisMinute = 0;
      this.minuteStart = now;
    }

    // If we've hit the per-minute limit, wait until the next minute
    if (this.requestsThisMinute >= this.maxRequestsPerMinute) {
      const waitTime = 60000 - (now - this.minuteStart) + randomDelay(1000, 3000);
      console.log(`Rate limit: waiting ${(waitTime/1000).toFixed(1)}s for next minute window`);
      await new Promise(r => setTimeout(r, waitTime));
      this.requestsThisMinute = 0;
      this.minuteStart = Date.now();
    }

    // Enforce minimum delay between requests with human-like variation
    const timeSinceLastRequest = Date.now() - this.lastRequest;
    const requiredDelay = this.minDelay + randomDelay(0, 500);
    if (timeSinceLastRequest < requiredDelay) {
      await new Promise(r => setTimeout(r, requiredDelay - timeSinceLastRequest));
    }

    const { fn, resolve, reject } = this.queue.shift();
    try {
      const result = await fn();
      this.requestsThisMinute++;
      resolve(result);
    } catch (error) {
      reject(error);
    }

    this.lastRequest = Date.now();
    this.processing = false;
    this.process();
  }
};

// Rate-limited fetch wrapper
async function rateLimitedFetch(url, options) {
  return rateLimiter.add(() => fetch(url, options));
}


// Function to get the sentiment of a tweet using Gemini
async function getTweetSentiment(tweetText) {
  if (!API_KEY || !API_KEY.startsWith("AIza")) {
    return "Neutral"; // Default sentiment if API is not configured
  }
  try {
    const requestBody = {
      "contents": [{
        "parts": [{ "text": `Analyze the sentiment of the following tweet. Respond with only one word: Positive, Negative, or Neutral.\n\nTweet: "${tweetText}"` }]
      }],
      "generationConfig": {
        "maxOutputTokens": 10
      }
    };

    const response = await rateLimitedFetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.error("Sentiment API error:", response.status);
      return "Neutral";
    }

    const responseData = await response.json();

    // Check if response has valid structure
    if (!responseData.candidates ||
      !responseData.candidates[0] ||
      !responseData.candidates[0].content ||
      !responseData.candidates[0].content.parts ||
      !responseData.candidates[0].content.parts[0]) {
      console.error("Invalid sentiment response structure:", responseData);
      return "Neutral";
    }

    const sentiment = responseData.candidates[0].content.parts[0].text.trim();
    console.log("Tweet sentiment detected:", sentiment);
    return sentiment;
  } catch (error) {
    console.error("Error getting tweet sentiment:", error);
    return "Neutral"; // Default to Neutral on error
  }
}

async function getLinkSummary(url) {
  if (!url) return null;
  console.log("Fetching summary for URL:", url);
  try {
    // Fetch the URL content
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const htmlContent = await response.text();

    // Extract text content from HTML (basic extraction)
    const textContent = htmlContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 3000); // Limit to 3000 chars for API

    if (!textContent || textContent.length < 50) {
      return "Could not extract meaningful content from the link.";
    }

    // Use Gemini to summarize the content
    const summaryRequestBody = {
      "contents": [{
        "parts": [{
          "text": `Please provide a concise, neutral summary of the key points from this content. Focus on the main arguments and conclusions. The summary should be no more than 150 words.\n\nContent:\n${textContent}`
        }]
      }],
      "generationConfig": {
        "maxOutputTokens": 200
      }
    };

    const summaryResponse = await rateLimitedFetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(summaryRequestBody)
    });

    if (!summaryResponse.ok) {
      console.error("Link summary API error:", summaryResponse.status);
      return null;
    }

    const summaryData = await summaryResponse.json();

    // Check if response has valid structure
    if (!summaryData.candidates ||
      !summaryData.candidates[0] ||
      !summaryData.candidates[0].content ||
      !summaryData.candidates[0].content.parts ||
      !summaryData.candidates[0].content.parts[0]) {
      console.error("Invalid link summary response:", summaryData);
      return null;
    }

    const summary = summaryData.candidates[0].content.parts[0].text.trim();
    console.log("Link summary generated:", summary);
    return summary;
  } catch (error) {
    console.error("Error fetching link summary:", error);
    return "Could not fetch or summarize the content of the link.";
  }
}

// Function to analyze author's writing style
async function analyzeAuthorStyle(recentTweets, authorBio) {
  if (!API_KEY || !API_KEY.startsWith("AIza") || recentTweets.length === 0) {
    return "";
  }

  try {
    const analysisPrompt = `Analyze this Twitter user's writing style based on their bio and recent tweets.

Bio: "${authorBio || 'Not available'}"

Recent Tweets:
${recentTweets.map((t, i) => `${i + 1}. "${t}"`).join('\n')}

Provide a brief analysis (2-3 sentences) covering:
1. Their tone (formal/casual, serious/humorous, etc.)
2. Common topics/interests
3. Writing style (short/long, emoji usage, slang, etc.)

Keep it concise and actionable for generating a reply.`;

    const requestBody = {
      "contents": [{
        "parts": [{ "text": analysisPrompt }]
      }],
      "generationConfig": {
        "maxOutputTokens": 150,
        "temperature": 0.3
      }
    };

    const response = await rateLimitedFetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const analysis = data.candidates[0].content.parts[0].text.trim();
      console.log("Author style analysis:", analysis);
      return analysis;
    }
    return "";
  } catch (error) {
    console.error("Error analyzing author style:", error);
    return "";
  }
}

// Function to detect language of the tweet
async function detectLanguage(text) {
  if (!API_KEY || !API_KEY.startsWith("AIza") || !text) {
    return "English"; // Default to English if API/Text missing
  }

  try {
    const requestBody = {
      "contents": [{
        "parts": [{ "text": `What language is this text written in? Reply with ONLY ONE WORD - the language name in English (Turkish, English, German, French, Spanish, etc). Nothing else.

Text: "${text}"

Language:` }]
      }],
      "generationConfig": {
        "maxOutputTokens": 5,
        "temperature": 0
      }
    };

    const response = await rateLimitedFetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) return "English";

    const data = await response.json();
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      let language = data.candidates[0].content.parts[0].text.trim();
      // Clean up the response - remove any extra text
      language = language.split('\n')[0].split(' ')[0].replace(/[^a-zA-Z]/g, '');
      console.log("Language detected:", language);
      return language || "English";
    }
    return "English";
  } catch (error) {
    console.error("Error detecting language:", error);
    return "English";
  }
}



// Build system prompt for natural, human-like replies
function buildSystemPrompt(persona, userMemory, intent, customPersonaPrompt, authorStyleAnalysis = "", authorBio = "", myWritingStyle = "", replyLength = "medium", sentiment = "", linkSummary = "", detectedLanguage = "English") {

  const isEnglish = detectedLanguage === "English";
  const isTurkish = detectedLanguage === "Turkish";

  // Persona instructions based on language
  let personaInstruction = "";
  if (isEnglish) {
    switch (persona) {
      case "Degen":
        personaInstruction = "you're a crypto degen. use slang but don't overdo it. 'lfg', 'ngmi', 'ser', 'anon' etc. lowercase usually. be hyped but genuine.";
        break;
      case "Analyst":
        personaInstruction = "think like a crypto analyst. mention data and metrics but don't be boring. be technical but understandable.";
        break;
      case "Maxi":
        personaInstruction = "you're a bitcoin maximalist. connect everything to btc. be skeptical of altcoins. use 'hodl', 'stack sats'.";
        break;
      case "Builder":
        personaInstruction = "think like a builder/dev. mention technical details, be solution-oriented, pragmatic.";
        break;
      case "Roast":
        personaInstruction = "be witty and ironic. light roast but not hurtful. clever banter.";
        break;
      case "Custom":
        personaInstruction = customPersonaPrompt || "you're a friendly crypto enthusiast.";
        break;
      default:
        personaInstruction = "you're a friendly crypto enthusiast. helpful and balanced.";
    }
  } else {
    // Turkish responses - but prompt in English for AI to understand
    switch (persona) {
      case "Degen":
        personaInstruction = "you're a crypto degen. use slang but don't overdo it. be hyped but genuine. write in a casual way.";
        break;
      case "Analyst":
        personaInstruction = "think like a crypto analyst. mention data and metrics but don't be boring. be technical but understandable.";
        break;
      case "Maxi":
        personaInstruction = "you're a bitcoin maximalist. connect everything to btc. be skeptical of altcoins.";
        break;
      case "Builder":
        personaInstruction = "think like a builder/dev. mention technical details, be solution-oriented, pragmatic.";
        break;
      case "Roast":
        personaInstruction = "be witty and ironic. light roast but not hurtful. clever banter.";
        break;
      case "Custom":
        personaInstruction = customPersonaPrompt || "you're a friendly crypto enthusiast.";
        break;
      default:
        personaInstruction = "you're a friendly crypto enthusiast. helpful and balanced.";
    }
  }

  // Length instructions - always in English for AI
  let lengthInstruction = "";
  switch (replyLength) {
    case "short": lengthInstruction = "Very short, 1-2 sentences max. Under 50 chars."; break;
    case "long": lengthInstruction = "Detailed, 3-5 sentences. Up to 200 chars."; break;
    default: lengthInstruction = "Medium length, 2-3 sentences. 100-140 chars."; break;
  }

  // Build the prompt in the detected language
  if (isEnglish) {
    return `You write tweet replies as a real human. You are NOT a bot or AI.

CRITICAL: YOUR REPLY MUST BE IN ENGLISH ONLY. DO NOT USE ANY OTHER LANGUAGE.

${personaInstruction}

${userMemory ? `Your views: "${userMemory}" - reflect this naturally.` : ''}
${myWritingStyle ? `Your writing style: "${myWritingStyle}" - mimic this style.` : ''}

REPLY LENGTH: Write exactly 2 sentences, around 30 words total. Not more, not less.

UNIQUENESS IS CRITICAL:
- Each reply MUST be completely unique and different from any previous reply
- Use different words, sentence structures, and perspectives every time
- NEVER start with the same word twice
- Random seed for variation: ${Date.now()}-${Math.random().toString(36).substring(7)}

IMPORTANT RULES:
- NEVER use abbreviations like ngl, tbh, lfg, ngmi, imo, etc. Write full words
- NEVER use dashes (- or —), quotes (" or '), or colons (:)
- NEVER use exclamation marks (!)
- NEVER use emojis or hashtags
- NEVER use "lol"
- Dont worry about punctuation, be casual
- No "Great point!", "Absolutely!", "I agree!" type phrases
- Be specific to the tweet, not generic

GOOD EXAMPLES:
- "been thinking the same thing lately. especially with how the market has been moving"
- "interesting take on this. didnt consider that angle before"
- "yeah the gas fees are getting out of hand. hard to justify small transactions anymore"

BAD EXAMPLES (NEVER DO THIS):
- "lol true"
- "ngl this is based"
- "Great point! I totally agree! 🔥"
- "lfg ser"

Now write a natural 2 sentence reply to this tweet:
`;
  } else {
    return `You write tweet replies as a real human. You are NOT a bot or AI.

CRITICAL: YOUR REPLY MUST BE IN TURKISH ONLY. DO NOT USE ANY OTHER LANGUAGE. Write everything in Turkish.

${personaInstruction}

${userMemory ? `Your views: "${userMemory}" - reflect this naturally.` : ''}
${myWritingStyle ? `Your writing style: "${myWritingStyle}" - mimic this style.` : ''}

REPLY LENGTH: Write exactly 2 sentences, around 30 words total. Not more, not less.

UNIQUENESS IS CRITICAL:
- Each reply MUST be completely unique and different from any previous reply
- Use different words, sentence structures, and perspectives every time
- NEVER start with the same word twice
- Random seed for variation: ${Date.now()}-${Math.random().toString(36).substring(7)}

IMPORTANT RULES:
- NEVER use abbreviations like ngl, tbh, lfg, ngmi, imo, etc. Write full words
- NEVER use dashes (- or —), quotes (" or '), or colons (:)
- NEVER use exclamation marks (!)
- NEVER use emojis or hashtags
- Dont worry about punctuation, be casual
- No generic praise phrases like "Kesinlikle katiliyorum!", "Harika!", "Cok dogru!"
- Be specific to the tweet, not generic

GOOD TURKISH REPLY EXAMPLES:
- "ayni seyi dusunuyordum ben de. ozellikle son zamanlarda cok belirgin oldu"
- "mantikli aslinda bu acidan bakunca. daha once hic dusunmemistim"
- "evet gas feeler cok artmaya basladi. kucuk islemler icin zor artik"

BAD EXAMPLES (NEVER DO THIS):
- "Kesinlikle katiliyorum! Harika! 🔥"
- "ngl cok based"
- "lfg ser"

Now write a natural 2 sentence reply IN TURKISH to this tweet:
`;
  }
}

// Function to generate the AI reply using Gemini
async function generateAiReply(tweetText, authorName, authorStatus, linkUrl, intent, authorBio = "", recentTweets = []) {
  console.log("🚀 generateAiReply called");
  console.log("📝 Tweet:", tweetText?.substring(0, 50));
  console.log("👤 Author:", authorName);
  console.log("🔑 API_KEY:", API_KEY ? API_KEY.substring(0, 10) + "..." : "NOT SET");

  if (!API_KEY || !API_KEY.startsWith("AIza")) {
    console.error("❌ Google API key is not set or invalid");
    return "API Key not set. Add your key in service_worker.js line 287";
  }

  console.log("✅ API Key valid, proceeding...");

  // 1. Get context: sentiment and link summary
  const sentiment = await getTweetSentiment(tweetText);
  const linkSummary = await getLinkSummary(linkUrl);

  // 2. Analyze author's writing style if we have recent tweets
  let authorStyleAnalysis = "";
  if (recentTweets.length > 0) {
    authorStyleAnalysis = await analyzeAuthorStyle(recentTweets, authorBio);
  }

  // 3. Determine Language (Selected vs Detected)
  const settings = await chrome.storage.sync.get(['selectedLanguage', 'selectedPersona', 'userMemory', 'customPersonaPrompt', 'myWritingStyle', 'replyLength']);

  let targetLanguage = "English"; // Default fallback

  // Always detect the tweet's language first
  const detectedLang = await detectLanguage(tweetText);
  console.log(`🕵️ Detected tweet language: ${detectedLang}`);

  if (settings.selectedLanguage && settings.selectedLanguage !== "Auto") {
    // User explicitly selected a language - use that
    targetLanguage = settings.selectedLanguage;
    console.log(`🗣️ User selected language: ${targetLanguage}`);
  } else {
    // Auto mode - reply in the same language as the tweet
    targetLanguage = detectedLang;
    console.log(`🗣️ Auto mode - using detected language: ${targetLanguage}`);
  }

  // 4. Build the system prompt with all context
  const persona = settings.selectedPersona || 'Neutral';
  const userMemory = settings.userMemory || '';
  const customPersonaPrompt = settings.customPersonaPrompt || '';
  const myWritingStyle = settings.myWritingStyle || '';
  const replyLength = settings.replyLength || 'medium';

  const systemPrompt = buildSystemPrompt(persona, userMemory, intent, customPersonaPrompt, authorStyleAnalysis, authorBio, myWritingStyle, replyLength, sentiment, linkSummary, targetLanguage);

  // Fixed max tokens for 2 sentences, ~30 words
  const maxOutputTokens = 80;
  console.log(`maxOutputTokens: ${maxOutputTokens}`);

  const contents = [
    {
      "role": "user",
      "parts": [{ "text": `${systemPrompt}\n\nTweet: "${tweetText}"` }]
    }
  ];

  const tools = [{
    "functionDeclarations": [
      {
        "name": "get_crypto_price",
        "description": "Fetches the current price and 24h change percentage of a cryptocurrency.",
        "parameters": {
          "type": "OBJECT",
          "properties": {
            "coinId": { "type": "STRING", "description": "The id of the coin (e.g., bitcoin, ethereum, solana, dogecoin)" }
          },
          "required": ["coinId"]
        }
      }
    ]
  }];

  // Generation config for more natural, varied responses
  const generationConfig = {
    "temperature": 0.9,  // Higher = more creative/varied
    "topP": 0.95,
    "topK": 40,
    "maxOutputTokens": maxOutputTokens,
  };

  try {
    let response = await rateLimitedFetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents, tools, generationConfig })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API HTTP Error:", response.status, errorText);
      throw new Error(`API returned ${response.status}: ${errorText} `);
    }

    let responseData = await response.json();
    console.log("Gemini API Response:", JSON.stringify(responseData, null, 2));

    if (!responseData.candidates || responseData.candidates.length === 0) {
      console.error("No candidates in response:", responseData);
      if (responseData.error) {
        throw new Error(`Gemini API Error: ${responseData.error.message} `);
      }
      throw new Error("No candidates returned from Gemini API");
    }

    if (!responseData.candidates[0].content || !responseData.candidates[0].content.parts || !responseData.candidates[0].content.parts[0]) {
      console.error("Invalid candidate structure:", responseData.candidates[0]);
      throw new Error("Invalid response structure from Gemini API");
    }

    let responsePart = responseData.candidates[0].content.parts[0];

    // Check if the model wants to call a tool
    if (responsePart.functionCall) {
      const functionCall = responsePart.functionCall;
      const functionName = functionCall.name;
      const functionArgs = functionCall.args;

      if (functionName === "get_crypto_price") {
        console.log(`AI wants to call tool: ${functionName} with args: `, functionArgs);
        const toolResult = await callTool(functionName, functionArgs);

        // Add the function call and result to the contents for the next turn
        contents.push({
          "role": "model",
          "parts": [{ "functionCall": functionCall }]
        });
        contents.push({
          "role": "function",
          "parts": [{
            "functionResponse": {
              "name": functionName,
              "response": { "content": toolResult }
            }
          }]
        });

        // Make a second call with the tool's result
        response = await rateLimitedFetch(API_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents, tools, generationConfig }) // Re-send with history
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("API HTTP Error (tool call):", response.status, errorText);
          throw new Error(`API returned ${response.status} `);
        }

        responseData = await response.json();
        console.log("Gemini API Response (after tool):", JSON.stringify(responseData, null, 2));

        if (responseData.candidates && responseData.candidates[0] && responseData.candidates[0].content && responseData.candidates[0].content.parts) {
          responsePart = responseData.candidates[0].content.parts[0];
        } else {
          throw new Error("Invalid response after tool call");
        }
      }
    }

    const finalReply = responsePart.text;

    if (!finalReply) {
      console.error("No text in response part:", responsePart);
      return "AI could not generate a reply. Please try again.";
    }

    // Prepend @ mention if enabled
    let processedReply = finalReply;
    if (includeMention && authorName) {
      processedReply = `@${authorName} ${finalReply}`;
    }

    // After successfully getting a reply, save the author's name
    saveRepliedAuthor(authorName);

    return processedReply;

  } catch (error) {
    console.error("Error calling Google API:", error.message);
    console.error("Full error:", error);
    return `Error: ${error.message || "Failed to generate AI reply. Check console for details."} `
  }
}


// Function to save an author's name to the replied list and increment reply count
function saveRepliedAuthor(authorName) {
  if (!authorName) return;
  chrome.storage.local.get({ repliedAuthors: [], replyCount: 0 }, (data) => {
    const repliedAuthors = data.repliedAuthors || [];
    const now = Date.now();

    // Find if author already exists
    const existingIndex = repliedAuthors.findIndex(item =>
      (typeof item === 'string' ? item : item.username).toLowerCase() === authorName.toLowerCase()
    );

    if (existingIndex >= 0) {
      // Update existing author with new timestamp
      repliedAuthors[existingIndex] = {
        username: authorName.toLowerCase(),
        timestamp: now
      };
    } else {
      // Add new author
      repliedAuthors.push({
        username: authorName.toLowerCase(),
        timestamp: now
      });
    }

    const newReplyCount = (data.replyCount || 0) + 1;
    chrome.storage.local.set({
      repliedAuthors: repliedAuthors,
      replyCount: newReplyCount
    }, () => {
      console.log(`Author ${authorName} saved to replied list with timestamp. Total replies: ${newReplyCount}`);
    });
  });
}

// Listener for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("📨 Message received:", request.action);

  if (request.action === "processTweet") {
    console.log("🐦 Processing tweet:", request.tweetText?.substring(0, 50) + "...");
    console.log("🔑 API Key available:", !!API_KEY);
    // Generate reply using Gemini
    generateAiReply(
      request.tweetText,
      request.authorName,
      request.authorStatus,
      request.linkUrl,
      request.intent,
      request.authorBio,
      request.recentTweets
    ).then(reply => {
      sendResponse({ reply: reply });
    }).catch(error => {
      console.error("Error generating AI reply:", error);
      sendResponse({ error: error.message || "Failed to generate reply" });
    });
    return true; // Keep message channel open for async response
  } else if (request.action === "getSettings") {
    sendResponse({ selectedPersona, userMemory });
    return true;
  } else if (request.action === "autoReplyToMention") {
    if (!autoReplyEnabled) {
      console.log("Auto-reply is disabled. Ignoring mention.");
      return false; // Do not send a response
    }
    console.log("Service Worker received mention for auto-reply:", request);
    // Generate a reply, but we don't have linkUrl or a specific sentiment for the original tweet.
    // We can just use the context of the reply itself.
    generateAiReply(request.tweetText, request.authorName, "Mention", null).then(reply => {
      sendResponse({ reply: reply });
    }).catch(error => {
      console.error("Error generating auto-reply:", error);
      sendResponse({ error: error.message || "Failed to generate auto-reply" });
    });
    return true; // Keep message channel open for async response
  } else if (request.action === "generateViralPost") {
    console.log("Generating viral post for topic:", request.topic);
    generateViralPost(request.topic, request.persona).then(posts => {
      sendResponse({ posts: posts });
    });
    return true;
  } else if (request.action === "generateProjectPost") {
    console.log("Generating project post:", request.projectName);
    generateProjectPost(request.projectName, request.projectInfo, request.postStyle).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  } else if (request.action === "queueMentioner") {
    console.log("Queuing mentioner:", request.username);
    addToMentionQueue(request.username);
    return true;
  } else if (request.action === "analyzeMyStyle") {
    console.log("Analyzing style for:", request.username);
    analyzeUserStyle(request.username).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  } else if (request.action === "schedulePost") {
    console.log("Scheduling post:", request.post);
    schedulePost(request.post);
    sendResponse({ success: true });
    return true;
  } else if (request.action === "analyzeCompetitor") {
    console.log("Analyzing competitor:", request.username);
    analyzeCompetitor(request.username).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  } else if (request.action === "suggestHashtags") {
    console.log("Suggesting hashtags for:", request.topic);
    suggestHashtags(request.topic).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});

// --- Scheduled Posts System ---
function schedulePost(post) {
  const alarmName = `scheduled_post_${post.scheduledTime}`;
  const delayMs = post.scheduledTime - Date.now();
  if (delayMs > 0) {
    chrome.alarms.create(alarmName, { when: post.scheduledTime });
    console.log(`Post scheduled for ${new Date(post.scheduledTime).toLocaleString()}`);
  }
}

// Scheduled posts handler function (called from consolidated alarm listener)
async function handleScheduledPost(alarm) {
  const scheduledTime = parseInt(alarm.name.replace('scheduled_post_', ''));
  const data = await chrome.storage.local.get({ scheduledPosts: [] });
  const post = data.scheduledPosts.find(p => p.scheduledTime === scheduledTime);

  if (post) {
    console.log('Posting scheduled content:', post.text);
    // Open Twitter compose and post
    const tab = await chrome.tabs.create({ url: 'https://x.com/compose/tweet', active: true });
    await new Promise(r => setTimeout(r, 3000));

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: (text) => {
        const editor = document.querySelector('[data-testid="tweetTextarea_0"]') ||
          document.querySelector('[role="textbox"]');
        if (editor) {
          editor.focus();
          document.execCommand('insertText', false, text);

          // Wait for button to become enabled and click it
          setTimeout(() => {
            const postButton = document.querySelector('button[data-testid="tweetButton"]') ||
              document.querySelector('button[data-testid="tweetButtonInline"]') ||
              document.querySelector('[data-testid="toolBar"] button[type="button"]:not([aria-label])');

            if (postButton) {
              console.log("Clicking post button...");
              postButton.click();
            } else {
              console.error("Post button not found");
            }
          }, 1000);
        }
      },
      args: [post.text]
    });

    // Remove from list
    const posts = data.scheduledPosts.filter(p => p.scheduledTime !== scheduledTime);
    chrome.storage.local.set({ scheduledPosts: posts });
  }
}

// --- Competitor Analysis ---
async function analyzeCompetitor(username) {
  if (!username) return { success: false, error: 'Kullanici adi gerekli' };

  try {
    const profileUrl = `https://x.com/${username}`;
    const tab = await chrome.tabs.create({ url: profileUrl, active: false });
    await new Promise(r => setTimeout(r, 5000));

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        const stats = {};
        // Get follower count
        const followersEl = document.querySelector('a[href$="/verified_followers"] span, a[href$="/followers"] span');
        stats.followers = followersEl?.innerText || '0';

        // Get following count
        const followingEl = document.querySelector('a[href$="/following"] span');
        stats.following = followingEl?.innerText || '0';

        // Get bio
        const bioEl = document.querySelector('[data-testid="UserDescription"]');
        stats.bio = bioEl?.innerText || '';

        // Get recent tweets
        const tweets = [];
        document.querySelectorAll('article[data-testid="tweet"]').forEach(tweet => {
          const textEl = tweet.querySelector('[data-testid="tweetText"]');
          if (textEl && tweets.length < 5) {
            tweets.push(textEl.innerText.substring(0, 100));
          }
        });
        stats.recentTweets = tweets;

        return stats;
      }
    });

    chrome.tabs.remove(tab.id);
    const stats = results[0]?.result || {};

    // Analyze with AI
    const prompt = `Rakip analizi yap (kisa ve onemli bilgiler):
@${username}
Followers: ${stats.followers}
Following: ${stats.following}
Bio: ${stats.bio}
Son tweetler: ${stats.recentTweets?.join(' | ')}

Su bilgileri ver (HTML formatinda, kisa):
- Hesap buyuklugu ve etki alani
- Icerik stratejisi
- Guclu ve zayif yonleri
- Oneriler`;

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
      })
    });

    const data = await response.json();
    const analysis = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Analiz yapilamadi';

    return { success: true, analysis, stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// --- Hashtag Suggester ---
async function suggestHashtags(topic) {
  if (!topic) return { success: false, error: 'Konu gerekli' };

  try {
    const prompt = `"${topic}" konusu icin Twitter'da kullanilabilecek 8-10 adet hashtag oner.
Populer ve ilgili hashtag'ler olsun. Sadece hashtag listesi ver, baska bir sey yazma.
Her hashtag # ile baslasin.
Ornek format:
#crypto
#bitcoin
#defi`;

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 200 }
      })
    });

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const hashtags = text.match(/#\w+/g) || [];

    return { success: true, hashtags: hashtags.slice(0, 10) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Analyze user's writing style from their tweets
async function analyzeUserStyle(username) {
  if (!username) {
    return { success: false, error: 'Kullanıcı adı gerekli' };
  }

  try {
    console.log("🔍 Fetching tweets for @" + username);

    // Open user's profile to scrape tweets
    const profileUrl = `https://x.com/${username}`;
    const tab = await chrome.tabs.create({ url: profileUrl, active: false });

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Execute script to extract tweets from the profile
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        const tweets = [];
        const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');

        tweetElements.forEach(tweet => {
          const textEl = tweet.querySelector('[data-testid="tweetText"]');
          if (textEl) {
            const text = textEl.innerText.trim();
            // Only get tweets from this user (not retweets)
            if (text && text.length > 10 && tweets.length < 10) {
              tweets.push(text);
            }
          }
        });

        // Also get bio
        const bioEl = document.querySelector('[data-testid="UserDescription"]');
        const bio = bioEl ? bioEl.innerText.trim() : '';

        return { tweets, bio };
      }
    });

    // Close the tab
    chrome.tabs.remove(tab.id);

    const { tweets, bio } = results[0]?.result || { tweets: [], bio: '' };

    console.log(`📝 Found ${tweets.length} tweets for @${username}`);

    if (tweets.length === 0) {
      return { success: false, error: 'Tweet bulunamadı. Profil gizli veya tweet yok olabilir.' };
    }

    // Now analyze the actual tweets with Gemini
    const prompt = `Sen bir Twitter/X yazım tarzı analistisin.

@${username} kullanıcısının GERÇEK tweet'lerini analiz et:

BIO: "${bio || 'Yok'}"

SON TWEET'LERİ:
${tweets.map((t, i) => `${i + 1}. "${t}"`).join('\n')}

Bu tweet'lere bakarak şu özellikleri belirle (max 250 karakter):
1. Dil tercihi (Türkçe/İngilizce/karma)
2. Ton (casual/formal/degen/profesyonel/teknik)
3. Emoji kullanımı (çok/az/hiç)
4. Sık kullandığı kelimeler veya kalıplar
5. Cümle uzunluğu (kısa/orta/uzun)
6. Büyük/küçük harf tercihi

Örnek format:
"Türkçe-İngilizce karma, casual degen tarzı, emoji az, lowercase tercih, kısa cümleler, 'ser', 'ngl', 'fr' gibi slang kullanıyor, teknik konularda detaylı yazıyor"

Sadece analiz sonucunu yaz.`;

    const response = await rateLimitedFetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 200
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      const style = data.candidates[0].content.parts[0].text.trim();
      console.log("✅ User style analyzed:", style);
      return { success: true, style, tweetCount: tweets.length };
    }

    return { success: false, error: 'Analiz yapılamadı' };
  } catch (error) {
    console.error("Error analyzing user style:", error);
    return { success: false, error: error.message };
  }
}

// Generate project-specific posts
async function generateProjectPost(projectName, projectInfo, postStyle) {
  if (!API_KEY || !API_KEY.startsWith("AIza")) {
    return { success: false, error: 'API Key not set. Add your key in service_worker.js line 287' };
  }

  // Get user's writing style if available
  const settings = await chrome.storage.sync.get(['myWritingStyle']);
  const myStyle = settings.myWritingStyle || '';

  let styleInstruction = "";
  switch (postStyle) {
    case "hype":
      styleInstruction = "Heyecanlı, bullish, FOMO yaratan bir post yaz. Projenin potansiyelini vurgula.";
      break;
    case "informative":
      styleInstruction = "Bilgilendirici, data-driven bir post yaz. Gerçeklere ve metriklere odaklan.";
      break;
    case "thread":
      styleInstruction = "Bir thread'in ilk tweet'i olacak şekilde yaz. Merak uyandır, '🧵' ile başla.";
      break;
    case "alpha":
      styleInstruction = "Alpha call tarzında yaz. 'ser', 'anon', 'nfa' gibi terimler kullan. Gizli bilgi paylaşır gibi yaz.";
      break;
    case "meme":
      styleInstruction = "Komik, meme tarzında yaz. Espritüel ol, ironi kullan.";
      break;
    default:
      styleInstruction = "Doğal ve engaging bir post yaz.";
  }

  const prompt = `Sen crypto Twitter'da deneyimli bir içerik üreticisisin.

PROJE: ${projectName}
${projectInfo ? `DETAYLAR/HABERLER: ${projectInfo}` : ''}

${myStyle ? `SENİN YAZIM TARZIN (bunu kullan!): "${myStyle}"` : ''}

GÖREV: ${styleInstruction}

3 FARKLI POST SEÇENEĞI ÜRET + 1 GÖRSEL PROMPT

KURALLAR:
- Her post max 280 karakter
- Hashtag KULLANMA
- EMOJİ KULLANMA (hiç emoji olmasın)
- ÜNLEM İŞARETİ KULLANMA (! yerine . kullan)
- Doğal, insan gibi yaz - bot gibi değil
- Projeye özel, spesifik bilgiler içersin
- Türkçe veya İngilizce olabilir (projeye göre)
- Her post farklı bir açıdan yaklaşsın

KÖTÜ ÖRNEKLER (bunları YAPMA):
- "🚀🚀🚀 $TOKEN to the moon! 🌙💎🙌"
- "This project is amazing! DYOR NFA! 🔥"
- Generic, her projeye uyabilecek postlar

İYİ ÖRNEKLER:
- "solana'nın fee yapısı eth'den 1000x ucuz ama kimse bunun sürdürülebilirliğini sorgulamıyor"
- "arbitrum sequencer geliri son 30 günde 2x oldu, bu rakamları gören var mı"
- "herkes ai token'lara bakarken infra oyunları sessizce pump ediyor ngl"

GÖRSEL PROMPT: Post'la birlikte kullanılabilecek bir AI görsel üretim prompt'u yaz (İngilizce, detaylı, midjourney/dall-e tarzı)

JSON formatında döndür:
{
  "posts": ["post1", "post2", "post3"],
  "imagePrompt": "detailed image prompt in English for AI image generation, crypto/web3 themed, professional, minimal style"
}`;

  try {
    const response = await rateLimitedFetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          topP: 0.95,
          maxOutputTokens: 500
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      const text = data.candidates[0].content.parts[0].text;
      // Clean up and parse JSON
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        const parsed = JSON.parse(cleanText);
        return { success: true, posts: parsed.posts, imagePrompt: parsed.imagePrompt };
      } catch (e) {
        // If JSON parsing fails, try to extract posts manually
        console.error("JSON parse error, trying manual extraction:", e);
        return { success: true, posts: [cleanText] };
      }
    }

    return { success: false, error: 'No response from API' };
  } catch (error) {
    console.error("Error generating project post:", error);
    return { success: false, error: error.message };
  }
}

async function generateViralPost(topic, persona) {
  if (!API_KEY || !API_KEY.startsWith("AIza")) {
    return ["API Key not set. Add your key in service_worker.js line 287"];
  }

  const prompt = `
        You are a viral Twitter content expert.
        Topic: "${topic}"
        Persona: ${persona || "Neutral"}
        
        Generate 3 DISTINCT, high-engagement tweet options about this topic.
        
        Styles:
        1. The "Hot Take" (Controversial/Opinionated)
        2. The "Story/Insight" (Personal/Educational)
        3. The "Short & Punchy" (One-liner/Meme style)
        
        Rules:
        - No hashtags.
        - No emojis (unless essential for the vibe).
        - Lowercase preferred for casual feel.
        - Under 280 chars.
        - Make them sound human, not AI.
        
        Output format: JSON array of strings. Example: ["tweet 1", "tweet 2", "tweet 3"]
      `;

  const contents = [{
    "role": "user",
    "parts": [{ "text": prompt }]
  }];

  try {
    let response = await rateLimitedFetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;

    // clean up markdown if present
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (error) {
    console.error("Error generating viral post:", error);
    return ["Error generating posts. Please try again."];
  }
}


// Function to call a tool (e.g., get_crypto_price)
async function callTool(toolName, args) {
  if (toolName === "get_crypto_price") {
    // This would ideally interact with an external API
    console.log(`Calling get_crypto_price for coinId: ${args.coinId} `);
    try {
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${args.coinId}&vs_currencies=usd&include_24hr_change=true`);
      const data = await response.json();
      if (data[args.coinId]) {
        return {
          price: data[args.coinId].usd,
          change_24h: data[args.coinId].usd_24h_change
        };
      }
      return null;
    } catch (error) {
      console.error("Error fetching crypto price:", error);
      return null;
    }
  }
  return null;
}

// Example of how the tool might be called (this would be integrated into the OpenAI logic)
// async function exampleToolCall() {
//   const priceData = await callTool("get_crypto_price", { coinId: "solana" });
//   console.log("Solana price data:", priceData);
// }
// exampleToolCall(); // For testing

// Note: Content scripts are automatically injected via manifest.json
// No need for manual injection here to avoid duplicate declarations




// --- Advanced Auto-Reply Queue System ---

// Add to queue (avoid duplicates)
async function addToMentionQueue(username) {
  const data = await chrome.storage.local.get({ mentionQueue: [] });
  const queue = data.mentionQueue;

  if (!queue.includes(username)) {
    queue.push(username);
    await chrome.storage.local.set({ mentionQueue: queue });
    console.log(`Added @${username} to mention queue. Current size: ${queue.length}`);
  }
}

// Alarm for processing queue - Less frequent to avoid spam patterns
// ANTI-SPAM: Process mentions every 30 minutes instead of 10
chrome.alarms.create("processMentionQueue", { periodInMinutes: 30 });

// CONSOLIDATED ALARM LISTENER - handles all alarms in one place
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('🔔 Alarm triggered:', alarm.name);

  if (alarm.name === "processMentionQueue") {
    await processMentionQueue();
  } else if (alarm.name.startsWith('scheduled_post_')) {
    await handleScheduledPost(alarm);
  }
});

async function processMentionQueue() {
  const data = await chrome.storage.local.get({ mentionQueue: [], autoReplyEnabled: false }); // Check global toggle? Or separate?
  // Using global autoReplyEnabled for now, or we should add a specific one.
  // Let's assume if the user enabled "Auto Reply", they want this too, or we check a new setting.
  // For safety, let's check a flag we haven't built UI for yet, defaulting to false if not set?
  // Or just use the main toggle.

  const queue = data.mentionQueue;
  if (queue.length === 0) return;

  const username = queue.shift(); // Take first
  await chrome.storage.local.set({ mentionQueue: queue }); // Update queue immediately

  console.log(`Processing mentioner: @${username}`);

  // SAFETY: For now, we will just open the tab and NOT auto-post.
  // Full auto-posting requires complex content script injection on the new tab.
  // We will open the tab so the user can review.

  chrome.tabs.create({ url: `https://x.com/${username}` }, () => {
    console.log(`Opened tab for @${username}`);
    // Future: Inject script to find latest tweet and reply
    // chrome.scripting.executeScript({
    //   target: { tabId: tab.id },
    //   function: autoReplyToProfile
    // });
  });
}

console.log('✅ Service Worker loaded successfully!');
