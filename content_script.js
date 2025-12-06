// Prevent duplicate loading
if (window.xReplyLoaded) {
  throw new Error("X Crypto Agent already loaded");
}
window.xReplyLoaded = true;
console.log("X Crypto Agent: Content script loaded (v3).");

let repliedAuthors = new Map(); // Map of username -> timestamp
let targetingSettings = {
  minFollowers: 0,
  maxFollowers: 0,
  nicheKeywords: '',
  blacklist: '',
  whitelist: ''
};

// Load targeting settings
chrome.storage.sync.get(['minFollowers', 'maxFollowers', 'nicheKeywords', 'blacklist', 'whitelist'], (data) => {
  if (data.minFollowers) targetingSettings.minFollowers = data.minFollowers;
  if (data.maxFollowers) targetingSettings.maxFollowers = data.maxFollowers;
  if (data.nicheKeywords) targetingSettings.nicheKeywords = data.nicheKeywords;
  if (data.blacklist) targetingSettings.blacklist = data.blacklist;
  if (data.whitelist) targetingSettings.whitelist = data.whitelist;
  console.log('Targeting settings loaded:', targetingSettings);
});

// Check if user is in blacklist
function isBlacklisted(username) {
  if (!targetingSettings.blacklist) return false;
  const blacklist = targetingSettings.blacklist.toLowerCase().split(',').map(u => u.trim().replace('@', ''));
  return blacklist.includes(username.toLowerCase());
}

// Check if user is in whitelist
function isWhitelisted(username) {
  if (!targetingSettings.whitelist) return false;
  const whitelist = targetingSettings.whitelist.toLowerCase().split(',').map(u => u.trim().replace('@', ''));
  return whitelist.includes(username.toLowerCase());
}


// Extract follower count from tweet element (if visible)
function getFollowerCount(tweetElement) {
  // Try to find follower count from the tweet or user card
  // This is best-effort as Twitter doesn't always show this in the timeline
  const userCard = tweetElement.querySelector('[data-testid="UserCell"]');
  if (userCard) {
    const followerText = userCard.textContent;
    const match = followerText.match(/(\d+(?:\.\d+)?[KMB]?)\s*(?:followers|takipçi)/i);
    if (match) {
      return parseFollowerString(match[1]);
    }
  }
  return null; // Unknown follower count
}

// Parse follower string like "10K", "1.5M" to number
function parseFollowerString(str) {
  if (!str) return 0;
  const num = parseFloat(str);
  if (str.toUpperCase().includes('K')) return num * 1000;
  if (str.toUpperCase().includes('M')) return num * 1000000;
  if (str.toUpperCase().includes('B')) return num * 1000000000;
  return num;
}

// Check if follower count is within targeting range
function isWithinFollowerRange(followerCount) {
  // If we couldn't determine follower count, allow by default
  if (followerCount === null) return true;

  const min = targetingSettings.minFollowers || 0;
  const max = targetingSettings.maxFollowers || 0;

  // Check min followers
  if (min > 0 && followerCount < min) {
    return false;
  }

  // Check max followers (0 means no limit)
  if (max > 0 && followerCount > max) {
    return false;
  }

  return true;
}

// === HUMAN-LIKE TIMING UTILITIES (2025 Anti-Detection) ===
function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function humanizedDelay() {
  // Simulate human reaction time (300-800ms with occasional longer pauses)
  const base = randomDelay(300, 800);
  const occasional = Math.random() < 0.15 ? randomDelay(500, 1500) : 0;
  return base + occasional;
}

// Robust DOM selector helpers with multiple fallbacks (Updated December 2025)
const DOM = {
  // Find tweet element - Updated selectors for 2025 X layout
  getTweet: (element) => {
    return element.closest('article[data-testid="tweet"]') ||
           element.closest('article[role="article"]') ||
           element.closest('[data-testid="cellInnerDiv"] article') ||
           element.closest('article');
  },

  // Find all tweets - Added new 2025 selectors
  getAllTweets: () => {
    return document.querySelectorAll(
      'article[data-testid="tweet"], ' +
      'article[role="article"], ' +
      '[data-testid="cellInnerDiv"] article'
    );
  },

  // Find tweet text - Updated for 2025 structure
  getTweetText: (tweet) => {
    const el = tweet.querySelector('[data-testid="tweetText"]') ||
               tweet.querySelector('[data-testid="tweet-text-show-more-link"]')?.parentElement ||
               tweet.querySelector('[lang]') ||
               tweet.querySelector('div[dir="auto"][lang]') ||
               tweet.querySelector('div[dir="auto"]');
    return el ? el.innerText : '';
  },

  // Find user names container - Updated for 2025
  getUserNames: (tweet) => {
    return tweet.querySelector('[data-testid="User-Name"]') ||
           tweet.querySelector('[data-testid="User-Names"]') ||
           tweet.querySelector('div[data-testid="User-Name"]') ||
           tweet.querySelector('a[role="link"][href^="/"]')?.parentElement;
  },

  // Find reply textbox - Updated for 2025 compose UI
  getReplyTextbox: () => {
    return document.querySelector('div[data-testid="tweetTextarea_0"]') ||
           document.querySelector('div[data-testid="tweetTextarea_1"]') ||
           document.querySelector('[data-testid="tweetTextarea_0RichTextInputContainer"]') ||
           document.querySelector('[data-testid="tweetTextarea_1RichTextInputContainer"]') ||
           document.querySelector('[role="textbox"][aria-label*="Tweet"]') ||
           document.querySelector('[role="textbox"][aria-label*="Post"]') ||
           document.querySelector('[role="textbox"][aria-label*="reply"]') ||
           document.querySelector('[role="textbox"][aria-label]') ||
           document.querySelector('[contenteditable="true"][role="textbox"]');
  },

  // Find post/reply button - Updated for 2025 X button variants
  getPostButton: () => {
    return document.querySelector('button[data-testid="tweetButton"]') ||
           document.querySelector('button[data-testid="tweetButtonInline"]') ||
           document.querySelector('[data-testid="tweetButton"]') ||
           document.querySelector('[data-testid="tweetButtonInline"]') ||
           document.querySelector('[data-testid="toolBar"] button[type="button"]:not([aria-label])') ||
           document.querySelector('button[data-testid="reply"]') ||
           // New 2025 selectors
           document.querySelector('[aria-label*="Post"][role="button"]') ||
           document.querySelector('[aria-label*="Reply"][role="button"]');
  },

  // Find native reply button in tweet - Updated for 2025 swipe-to-reply UI
  getNativeReplyButton: (tweet) => {
    return tweet.querySelector('button[data-testid="reply"]') ||
           tweet.querySelector('[data-testid="reply"]') ||
           tweet.querySelector('[aria-label*="Reply"]') ||
           tweet.querySelector('[aria-label*="reply"]') ||
           tweet.querySelector('[aria-label*="Yanıtla"]'); // Turkish
  },

  // Find actions bar in tweet - Updated for 2025
  getActionsBar: (tweet) => {
    return tweet.querySelector('[role="group"][id]') ||
           tweet.querySelector('[role="group"]') ||
           tweet.querySelector('[aria-label*="actions"]')?.parentElement ||
           tweet.querySelector('[data-testid="tweet"] > div > div:last-child');
  },

  // Find verified badge - Updated for 2025 badge variants
  getVerifiedBadge: (tweet) => {
    return tweet.querySelector('[data-testid="icon-verified"]') ||
           tweet.querySelector('[data-testid="verificationBadge"]') ||
           tweet.querySelector('svg[aria-label*="Verified"]') ||
           tweet.querySelector('svg[aria-label*="verified"]') ||
           tweet.querySelector('[aria-label*="verified"]') ||
           tweet.querySelector('[aria-label*="Doğrulanmış"]'); // Turkish
  },

  // NEW: Find like button - for auto-like feature
  getLikeButton: (tweet) => {
    return tweet.querySelector('button[data-testid="like"]') ||
           tweet.querySelector('[data-testid="like"]') ||
           tweet.querySelector('[aria-label*="Like"]') ||
           tweet.querySelector('[aria-label*="Beğen"]'); // Turkish
  },

  // NEW: Check if already liked
  isLiked: (tweet) => {
    return tweet.querySelector('button[data-testid="unlike"]') ||
           tweet.querySelector('[data-testid="unlike"]') ||
           tweet.querySelector('[aria-label*="Unlike"]') ||
           tweet.querySelector('[aria-label*="Beğeniyi"]'); // Turkish
  },

  // NEW: Find repost button
  getRepostButton: (tweet) => {
    return tweet.querySelector('button[data-testid="retweet"]') ||
           tweet.querySelector('[data-testid="retweet"]') ||
           tweet.querySelector('[aria-label*="Repost"]') ||
           tweet.querySelector('[aria-label*="repost"]');
  }
};

// Fetch initial list of replied authors
chrome.storage.local.get({ repliedAuthors: [] }, (data) => {
  const authors = data.repliedAuthors || [];
  repliedAuthors.clear();

  // Handle both old format (strings) and new format (objects with timestamp)
  authors.forEach(item => {
    if (typeof item === 'string') {
      // Old format: just username, set timestamp to 0 (very old)
      repliedAuthors.set(item.toLowerCase(), 0);
    } else if (item.username && item.timestamp) {
      // New format: object with username and timestamp
      repliedAuthors.set(item.username.toLowerCase(), item.timestamp);
    }
  });

  console.log("Initial replied authors list loaded:", repliedAuthors);
  // Initial scan for tweets already on page
  DOM.getAllTweets().forEach(processTweet);
});

// Listen for updates to the replied authors list (e.g., after sending a reply)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.repliedAuthors) {
    const authors = changes.repliedAuthors.newValue || [];
    repliedAuthors.clear();

    authors.forEach(item => {
      if (typeof item === 'string') {
        repliedAuthors.set(item.toLowerCase(), 0);
      } else if (item.username && item.timestamp) {
        repliedAuthors.set(item.username.toLowerCase(), item.timestamp);
      }
    });

    console.log("Replied authors list updated:", repliedAuthors);
    // Re-process all visible tweets to update their ticks
    DOM.getAllTweets().forEach(processTweet);
  }
});

// Main function to process a tweet element
function processTweet(tweetElement) {
  addReplyButton(tweetElement);
  addAuthorTick(tweetElement);
}

// Function to extract tweet text and author info
function getTweetDetails(tweetElement) {
  let tweetText = "";
  const textElement = tweetElement.querySelector('[data-testid="tweetText"]');
  if (textElement) {
    tweetText = textElement.innerText;
  }

  let authorName = "";
  // New robust strategy: Find the span with the @-handle, then find its parent link to get the href.
  const allSpans = tweetElement.querySelectorAll('span');
  const handleSpan = Array.from(allSpans).find(span => span.textContent.startsWith('@'));

  if (handleSpan) {
    const authorLink = handleSpan.closest('a[role="link"]');
    if (authorLink && authorLink.href) {
      const hrefParts = authorLink.href.split('/');
      authorName = hrefParts[hrefParts.length - 1];
    }
  }

  // Fallback if the first strategy fails
  if (!authorName) {
    console.log("Could not find author via @-handle, trying fallback...");
    const userNamesContainer = tweetElement.querySelector('[data-testid="User-Names"]');
    if (userNamesContainer) {
      // Get the first link in the user names container
      const authorLink = userNamesContainer.querySelector('a[role="link"]');
      if (authorLink && authorLink.href) {
        const hrefParts = authorLink.href.split('/');
        // The username is typically the last part of the URL
        authorName = hrefParts[hrefParts.length - 1];
      }
    }
  }

  let authorStatus = "Normal";
  const verifiedBadge = DOM.getVerifiedBadge(tweetElement);
  if (verifiedBadge) {
    authorStatus = "Verified";
  }

  // Extract link from tweet text
  let linkUrl = null;
  if (textElement) {
    // This regex needs to be improved to not catch parts of the URL
    const urlRegex = /https?:\/\/[^\s]+/g;
    const matches = textElement.innerText.match(urlRegex);
    if (matches) {
      // Find the t.co link element that corresponds to the displayed text
      const linkElement = Array.from(tweetElement.querySelectorAll('a[href*="t.co"]')).find(a => matches.includes(a.textContent));
      if (linkElement && linkElement.href) {
        linkUrl = linkElement.href; // Use the actual t.co href
        console.log("Found URL in tweet:", linkUrl);
      }
    }
  }

  // Extract author's bio if available (from profile hover card or page)
  let authorBio = "";
  const bioElement = document.querySelector('[data-testid="UserDescription"]');
  if (bioElement) {
    authorBio = bioElement.innerText.trim();
  }

  // Extract recent tweets from the author (if on their profile or visible)
  let recentTweets = [];
  const allTweets = document.querySelectorAll('article[data-testid="tweet"]');
  allTweets.forEach(tweet => {
    const { tweetText: recentText, authorName: recentAuthor } = getTweetDetailsSimple(tweet);
    if (recentAuthor && recentAuthor.toLowerCase() === authorName.toLowerCase() && recentText) {
      recentTweets.push(recentText);
    }
  });
  // Limit to 3 most recent tweets for context
  recentTweets = recentTweets.slice(0, 3);

  return { tweetText, authorName, authorStatus, linkUrl, authorBio, recentTweets };
}

// Simplified version to avoid recursion
function getTweetDetailsSimple(tweetElement) {
  let tweetText = "";
  const textElement = tweetElement.querySelector('[data-testid="tweetText"]');
  if (textElement) {
    tweetText = textElement.innerText;
  }

  let authorName = "";
  const allSpans = tweetElement.querySelectorAll('span');
  const handleSpan = Array.from(allSpans).find(span => span.textContent.startsWith('@'));
  if (handleSpan) {
    const authorLink = handleSpan.closest('a[role="link"]');
    if (authorLink && authorLink.href) {
      const hrefParts = authorLink.href.split('/');
      authorName = hrefParts[hrefParts.length - 1];
    }
  }

  return { tweetText, authorName };
}


// Function to add a reply button to a tweet
function addReplyButton(tweetElement) {
  // Check if a button already exists to prevent duplicates
  if (tweetElement.querySelector('.crypto-agent-reply-button')) {
    return;
  }

  // Get author name for targeting checks
  const { authorName } = getTweetDetails(tweetElement);

  // Check blacklist - skip this tweet
  if (authorName && isBlacklisted(authorName)) {
    console.log(`Skipping blacklisted user: @${authorName}`);
    return;
  }

  // NOT: Manuel AI Reply butonunda limit yok - kullanıcı istediği kadar kullanabilir
  // Limitler sadece otomatik yanıtlar için geçerli (auto-reply, bulk process)

  // Check follower count range (unless whitelisted)
  if (!isWhitelisted(authorName)) {
    const followerCount = getFollowerCount(tweetElement);
    if (!isWithinFollowerRange(followerCount)) {
      console.log(`Skipping user @${authorName} - follower count ${followerCount} outside range`);
      return;
    }
  }

  const actionsBar = DOM.getActionsBar(tweetElement);
  if (actionsBar) {
    // Create container for the vibe selector
    const container = document.createElement('div');
    container.className = 'crypto-agent-reply-button';
    container.style.cssText = `
      display: flex;
      align-items: center;
      margin-left: 10px;
      background-color: transparent;
      border-radius: 9999px;
      transition: all 0.2s ease;
      position: relative;
    `;

    // Main "AI Reply" button
    const mainButton = document.createElement('button');
    mainButton.innerText = "AI Reply";
    mainButton.style.cssText = `
      background-color: #1DA1F2;
      color: white;
      border: none;
      padding: 5px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.2s;
    `;

    // Main button click
    mainButton.onclick = () => handleReplyClick(tweetElement, mainButton, null);

    container.appendChild(mainButton);

    // Wrap in a div for alignment in the action bar
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.appendChild(container);

    actionsBar.appendChild(wrapper);
  }
}

// Track if a reply is currently being processed to prevent duplicates
let isReplyInProgress = false;

// Helper function to handle reply generation
async function handleReplyClick(tweetElement, button, intent) {
  console.log("🎯 handleReplyClick triggered!");

  // DUPLICATE PREVENTION: Check if already processing a reply
  if (isReplyInProgress) {
    console.log("⚠️ Reply already in progress, ignoring duplicate click");
    return;
  }
  isReplyInProgress = true;

  const originalText = button.innerText;
  button.innerText = intent ? `${getIntentIcon(intent)} Thinking...` : "Replying...";
  button.disabled = true;

  const { tweetText, authorName, authorStatus, linkUrl, authorBio, recentTweets } = getTweetDetails(tweetElement);

  if (!authorName) {
    alert("Could not determine tweet author");
    button.innerText = originalText;
    button.disabled = false;
    isReplyInProgress = false; // Reset lock on early return
    return;
  }

  console.log('📝 Tweet details for AI Reply:', { tweetText: tweetText?.substring(0, 50), authorName, intent });

  // Auto Like - like the ORIGINAL POST before opening reply box (SYNC)
  const settings = await new Promise(resolve => {
    chrome.storage.sync.get({ autoLike: false }, resolve);
  });

  if (settings.autoLike) {
    const likeButton = DOM.getLikeButton(tweetElement);
    if (likeButton) {
      // Check if not already liked using new DOM helper
      const alreadyLiked = DOM.isLiked(tweetElement);
      if (!alreadyLiked) {
        console.log('❤️ Auto Like: Liking the original post...');
        // Human-like delay before liking
        await new Promise(r => setTimeout(r, humanizedDelay()));
        likeButton.click();
        // Wait a bit after liking with variation
        await new Promise(r => setTimeout(r, randomDelay(500, 1200)));
        console.log('✅ Like completed');
      } else {
        console.log('ℹ️ Post already liked');
      }
    }
  }

  // Open reply box with human-like timing
  const nativeReplyButton = DOM.getNativeReplyButton(tweetElement);
  if (nativeReplyButton) {
    console.log('📝 Opening reply box...');
    // Add human-like delay before clicking
    await new Promise(r => setTimeout(r, humanizedDelay()));
    nativeReplyButton.click();
    // Wait for reply box to open with variation
    await new Promise(r => setTimeout(r, randomDelay(800, 1500)));
  }

  console.log("📤 Sending message to service worker...");

  try {
    const response = await chrome.runtime.sendMessage({
      action: "processTweet",
      tweetText,
      authorName,
      authorStatus,
      linkUrl,
      authorBio,
      recentTweets,
      intent
    });

    console.log("📥 Response from service worker:", response);

    if (response && response.reply) {
      console.log("Got reply, injecting...");
      injectReply(response.reply);

      // Track reply for analytics
      chrome.storage.local.get({ replyHistory: [] }, (data) => {
        const history = data.replyHistory || [];
        history.push({
          timestamp: Date.now(),
          author: authorName,
          tone: intent || 'neutral'
        });
        // Keep only last 500 entries
        if (history.length > 500) history.shift();
        chrome.storage.local.set({ replyHistory: history });
      });
    } else {
      console.error("❌ No reply in response:", response);
      alert("Failed to get AI reply: " + (response?.error || "Unknown error"));
    }
  } catch (error) {
    console.error("❌ Error sending message:", error);
    alert("Error: " + error.message);
  } finally {
    // ALWAYS reset the lock
    isReplyInProgress = false;
  }

  button.innerText = "AI Reply";
  button.disabled = false;
}

function getIntentIcon(intent) {
  switch (intent) {
    case 'agree': return '👍';
    case 'disagree': return '👎';
    case 'funny': return '😂';
    case 'question': return '🤔';
    default: return '';
  }
}

// Function to add a green/red tick next to the author's name
// Green = Replied within 24h | Red = Not replied yet (needs reply)
function addAuthorTick(tweetElement) {
  // Try multiple selectors to find username element
  let userNamesElement = tweetElement.querySelector('[data-testid="User-Name"]') ||
                         tweetElement.querySelector('[data-testid="User-Names"]');

  if (!userNamesElement) {
    // Fallback: find the first link that looks like a username
    const links = tweetElement.querySelectorAll('a[role="link"]');
    for (const link of links) {
      if (link.href && link.href.includes('x.com/') && !link.href.includes('/status/')) {
        userNamesElement = link.parentElement;
        break;
      }
    }
  }

  if (!userNamesElement) {
    return; // Can't find the name container
  }

  const { authorName } = getTweetDetails(tweetElement);
  if (!authorName) return;

  const authorLower = authorName.toLowerCase();
  const replyTimestamp = repliedAuthors.get(authorLower);

  let tickColor, tickSymbol, tickTitle;
  const hasReplied = replyTimestamp !== undefined && replyTimestamp !== null;

  if (hasReplied) {
    const now = Date.now();
    const hoursSinceReply = replyTimestamp === 0 ? 999 : (now - replyTimestamp) / (1000 * 60 * 60);

    if (hoursSinceReply < 24) {
      // Replied within 24h - GREEN
      tickColor = '#00BA7C';
      tickSymbol = '●';
      tickTitle = 'Replied within 24h';
    } else {
      // Replied but >24h ago - needs fresh reply - RED
      tickColor = '#F4212E';
      tickSymbol = '●';
      tickTitle = 'Reply older than 24h';
    }
  } else {
    // Never replied - needs reply - RED
    tickColor = '#F4212E';
    tickSymbol = '●';
    tickTitle = 'Not replied yet';
  }

  // Check if tick already exists in this tweet
  let tick = tweetElement.querySelector('.author-reply-tick');

  if (!tick) {
    tick = document.createElement('span');
    tick.className = 'author-reply-tick';
    tick.style.cssText = 'margin-left: 4px; font-size: 10px; cursor: help; vertical-align: middle;';
    userNamesElement.appendChild(tick);
  }

  // Update tick properties
  tick.innerText = tickSymbol;
  tick.style.color = tickColor;
  tick.title = tickTitle;
}


// Function to find the reply textbox and inject the text
async function injectReply(text) {
  console.log('🚀 injectReply called with text:', text?.substring(0, 50) + '...');

  const maxAttempts = 25;
  let attempts = 0;

  const tryInject = async () => {
    attempts++;
    console.log(`📝 Injection attempt ${attempts}/${maxAttempts}`);

    // Find the DraftJS editor container
    let editorContainer = document.querySelector('[data-testid="tweetTextarea_0"]') ||
                          document.querySelector('[data-testid="tweetTextarea_1"]');

    if (!editorContainer) {
      if (attempts < maxAttempts) {
        setTimeout(tryInject, 400);
      } else {
        console.error('❌ Reply textbox not found after max attempts');
      }
      return;
    }

    // Find the contenteditable element
    let editableEl = editorContainer.querySelector('.DraftEditor-editorContainer [contenteditable="true"]') ||
                     editorContainer.querySelector('[contenteditable="true"]') ||
                     editorContainer;

    console.log('✅ Found editor:', editableEl.className);

    // Focus
    editableEl.focus();
    await new Promise(r => setTimeout(r, 200));

    // BEST METHOD: Simulate real typing using DataTransfer
    console.log('📋 Using DataTransfer paste simulation...');

    try {
      // Create a DataTransfer object with the text
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', text);

      // Create paste event
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer
      });

      // Focus and dispatch
      editableEl.focus();
      editableEl.dispatchEvent(pasteEvent);

      await new Promise(r => setTimeout(r, 500));

      // Check if paste worked
      let currentText = editableEl.textContent || '';
      console.log('📝 After paste:', currentText?.substring(0, 30));

      if (currentText.length >= 3) {
        console.log('✅ Paste method worked!');
        await new Promise(r => setTimeout(r, 300));
        await forceClickPostButton();
        return;
      }
    } catch (e) {
      console.log('Paste error:', e.message);
    }

    // FALLBACK: execCommand with input events
    console.log('📝 Trying execCommand with beforeinput...');

    editableEl.focus();
    await new Promise(r => setTimeout(r, 100));

    // Fire beforeinput first - this is what DraftJS listens to
    const beforeInputEvent = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text
    });
    editableEl.dispatchEvent(beforeInputEvent);

    // Then execCommand
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    document.execCommand('insertText', false, text);

    // Fire input event
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: false,
      inputType: 'insertText',
      data: text
    });
    editableEl.dispatchEvent(inputEvent);

    await new Promise(r => setTimeout(r, 500));

    // Check
    let currentText = editableEl.textContent || editableEl.innerText || '';
    console.log('📝 After execCommand:', currentText?.substring(0, 30));

    // Always proceed to try clicking the button
    console.log('🔘 Proceeding to click post button...');
    await forceClickPostButton();
  };

  tryInject();
}

// Force click post button - tries multiple times regardless of disabled state
async function forceClickPostButton() {
  console.log('🔘 forceClickPostButton called');

  // First, get autoComment setting once
  const settings = await new Promise(resolve => {
    chrome.storage.sync.get({ autoComment: true, actionDelay: 5 }, resolve);
  });

  console.log('📋 Settings:', settings);

  if (!settings.autoComment) {
    console.log('ℹ️ Auto Comment disabled, not clicking');
    return false;
  }

  const maxAttempts = 15;
  let clickAttempted = false;
  let spaceAdded = false;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 500)); // Faster checks

    // Check if reply box still exists
    const replyBox = DOM.getReplyTextbox();
    if (!replyBox) {
      console.log('✅ Reply box gone - post was successful!');
      return true;
    }

    const postButton = DOM.getPostButton();
    console.log(`🔘 Attempt ${i + 1}/${maxAttempts} - Button: ${!!postButton}, disabled: ${postButton?.disabled}`);

    // If button is disabled, try adding a space to trigger React state
    if (postButton && postButton.disabled && !spaceAdded) {
      console.log('⚠️ Button disabled, adding space to trigger React...');

      // Find editor and add a space
      const editor = document.querySelector('[data-testid="tweetTextarea_0"] [contenteditable="true"]') ||
                     document.querySelector('[data-testid="tweetTextarea_1"] [contenteditable="true"]');

      if (editor) {
        editor.focus();

        // Try adding a space using execCommand
        document.execCommand('insertText', false, ' ');

        // Also dispatch events
        editor.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: ' ' }));
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ' ' }));

        spaceAdded = true;
        await new Promise(r => setTimeout(r, 500));
        continue; // Check button again
      }
    }

    if (postButton && !postButton.disabled) {
      // Button is enabled!
      if (!clickAttempted) {
        // Human-like delay before clicking (1-2.5 seconds with variation)
        const clickDelay = randomDelay(1000, 2500);
        console.log(`⏳ Clicking in ${clickDelay}ms...`);
        await new Promise(r => setTimeout(r, clickDelay));
      }

      console.log('🖱️ Clicking post button...');
      clickAttempted = true;

      // Try multiple click methods
      try {
        postButton.click();
      } catch (e) {
        console.log('Direct click failed');
      }

      // Also try MouseEvent
      postButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

      console.log('✅ Click sent!');

      // Wait for Twitter to process
      await new Promise(r => setTimeout(r, 1500));

      // Check if successful
      const replyBoxAfter = DOM.getReplyTextbox();
      if (!replyBoxAfter) {
        console.log('✅ Reply posted successfully!');
        return true;
      } else {
        console.log('⚠️ Reply box still exists, will retry...');
      }
    } else if (postButton && postButton.disabled && spaceAdded) {
      // Space was added but button still disabled - try more aggressive approach
      console.log('⚠️ Button still disabled after space, trying aggressive approach...');

      const editor = document.querySelector('[data-testid="tweetTextarea_0"] [contenteditable="true"]') ||
                     document.querySelector('[data-testid="tweetTextarea_1"] [contenteditable="true"]');

      if (editor) {
        // Get current text
        const currentText = editor.textContent || '';

        // Clear and re-type everything
        editor.focus();
        document.execCommand('selectAll', false, null);
        await new Promise(r => setTimeout(r, 50));

        // Delete and re-insert
        document.execCommand('delete', false, null);
        await new Promise(r => setTimeout(r, 50));

        // Re-insert character by character (first 20 chars)
        const textToType = currentText.substring(0, Math.min(currentText.length, 20));
        for (const char of textToType) {
          document.execCommand('insertText', false, char);
          editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: char }));
        }

        // Insert rest at once
        if (currentText.length > 20) {
          document.execCommand('insertText', false, currentText.substring(20));
        }

        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  console.error('❌ Could not post after max attempts');
  return false;
}


// Observe for new tweets being added to the DOM
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === 1) {
        // Check if node is a tweet
        if (node.matches && (node.matches('article[data-testid="tweet"]') || node.matches('article[role="article"]'))) {
          processTweet(node);
        }
        // Check for tweets inside the added node
        if (node.querySelectorAll) {
          node.querySelectorAll('article[data-testid="tweet"], article[role="article"]').forEach(processTweet);
        }
      }
    });
  });
});

// Start observing - use a more specific container if available
const mainContainer = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
observer.observe(mainContainer, { childList: true, subtree: true });

