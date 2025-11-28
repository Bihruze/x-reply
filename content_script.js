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

// Robust DOM selector helpers with multiple fallbacks
const DOM = {
  // Find tweet element
  getTweet: (element) => {
    return element.closest('article[data-testid="tweet"]') ||
           element.closest('article[role="article"]') ||
           element.closest('article');
  },

  // Find all tweets
  getAllTweets: () => {
    return document.querySelectorAll('article[data-testid="tweet"], article[role="article"]');
  },

  // Find tweet text
  getTweetText: (tweet) => {
    const el = tweet.querySelector('[data-testid="tweetText"]') ||
               tweet.querySelector('[lang]') ||
               tweet.querySelector('div[dir="auto"]');
    return el ? el.innerText : '';
  },

  // Find user names container
  getUserNames: (tweet) => {
    return tweet.querySelector('[data-testid="User-Names"]') ||
           tweet.querySelector('div[data-testid="User-Name"]') ||
           tweet.querySelector('a[role="link"][href^="/"]')?.parentElement;
  },

  // Find reply textbox
  getReplyTextbox: () => {
    return document.querySelector('div[data-testid="tweetTextarea_0"]') ||
           document.querySelector('div[data-testid="tweetTextarea_1"]') ||
           document.querySelector('[role="textbox"][aria-label]') ||
           document.querySelector('[contenteditable="true"][role="textbox"]');
  },

  // Find post/reply button
  getPostButton: () => {
    return document.querySelector('button[data-testid="tweetButton"]') ||
           document.querySelector('button[data-testid="tweetButtonInline"]') ||
           document.querySelector('[data-testid="toolBar"] button[type="button"]:not([aria-label])') ||
           document.querySelector('button[data-testid="reply"]');
  },

  // Find native reply button in tweet
  getNativeReplyButton: (tweet) => {
    return tweet.querySelector('button[data-testid="reply"]') ||
           tweet.querySelector('[aria-label*="Reply"]') ||
           tweet.querySelector('[aria-label*="reply"]');
  },

  // Find actions bar in tweet
  getActionsBar: (tweet) => {
    return tweet.querySelector('[role="group"]') ||
           tweet.querySelector('[aria-label*="actions"]')?.parentElement;
  },

  // Find verified badge
  getVerifiedBadge: (tweet) => {
    return tweet.querySelector('[data-testid="icon-verified"]') ||
           tweet.querySelector('svg[aria-label*="Verified"]') ||
           tweet.querySelector('[aria-label*="verified"]');
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

// Helper function to handle reply generation
async function handleReplyClick(tweetElement, button, intent) {
  console.log("🎯 handleReplyClick triggered!");

  const originalText = button.innerText;
  button.innerText = intent ? `${getIntentIcon(intent)} Thinking...` : "Replying...";
  button.disabled = true;

  const { tweetText, authorName, authorStatus, linkUrl, authorBio, recentTweets } = getTweetDetails(tweetElement);

  if (!authorName) {
    alert("Could not determine tweet author");
    button.innerText = originalText;
    button.disabled = false;
    return;
  }

  console.log('📝 Tweet details for AI Reply:', { tweetText: tweetText?.substring(0, 50), authorName, intent });

  const nativeReplyButton = DOM.getNativeReplyButton(tweetElement);
  if (nativeReplyButton) {
    nativeReplyButton.click();
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
  const userNamesElement = DOM.getUserNames(tweetElement);
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
      tickTitle = 'Son 24 saatte yanit verildi';
    } else {
      // Replied but >24h ago - needs fresh reply - RED
      tickColor = '#F4212E';
      tickSymbol = '●';
      tickTitle = 'Yanit 24 saatten eski - yeni yanit ver';
    }
  } else {
    // Never replied - needs reply - RED
    tickColor = '#F4212E';
    tickSymbol = '●';
    tickTitle = 'Henuz yanit verilmedi';
  }

  // Check if tick already exists
  let tick = userNamesElement.querySelector('.author-reply-tick');

  if (!tick) {
    tick = document.createElement('span');
    tick.className = 'author-reply-tick';
    tick.style.marginLeft = '4px';
    tick.style.fontSize = '14px';
    tick.style.cursor = 'help';
    userNamesElement.appendChild(tick);
  }

  // Update tick properties
  tick.innerText = tickSymbol;
  tick.style.color = tickColor;
  tick.title = tickTitle;
}


// Function to find the reply textbox and inject the text
async function injectReply(text) {
  const interval = setInterval(async () => {
    const replyTextbox = DOM.getReplyTextbox();
    if (replyTextbox) {
      clearInterval(interval);

      // Find the actual editable span inside Twitter's editor
      const editableSpan = replyTextbox.querySelector('span[data-text="true"]') ||
        replyTextbox.querySelector('[data-contents="true"] span') ||
        replyTextbox.querySelector('br');

      const editableDiv = editableSpan ? editableSpan.parentElement : replyTextbox;

      // Clear existing content
      editableDiv.innerHTML = '';

      // Create a text node with the reply
      const textNode = document.createTextNode(text);
      editableDiv.appendChild(textNode);

      // Set the text content directly
      editableDiv.textContent = text;

      // Trigger input events to update Twitter's internal state
      editableDiv.dispatchEvent(new Event('input', { bubbles: true }));
      editableDiv.dispatchEvent(new Event('change', { bubbles: true }));

      // Focus the element
      editableDiv.focus();

      // More aggressive event dispatching
      setTimeout(() => {
        editableDiv.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text
        }));

        // Dispatch composition events
        editableDiv.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        editableDiv.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true, data: text }));
        editableDiv.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: text }));

        // Trigger multiple input events with slight delays
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            editableDiv.dispatchEvent(new Event('input', { bubbles: true }));
            editableDiv.dispatchEvent(new Event('change', { bubbles: true }));
          }, 100 * i);
        }
      }, 100);

      // Final focus and post button click
      setTimeout(() => {
        editableDiv.focus();
        // Trigger one more input event
        editableDiv.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text
        }));

        // Check if Auto Comment is enabled and click Post button
        chrome.storage.sync.get({ autoComment: false, actionDelay: 10 }, (settings) => {
          if (settings.autoComment) {
            // ANTI-SPAM: More human-like delay with higher minimum
            const baseDelay = Math.max(settings.actionDelay, 15); // Minimum 15 seconds
            const variance = baseDelay * 0.35; // ±35% variance for more randomness
            const randomDelay = baseDelay + (Math.random() * variance * 2 - variance);

            // ANTI-SPAM: Occasional "thinking pause" (15% chance of extra 5-15s)
            const thinkingPause = Math.random() < 0.15 ? (5 + Math.random() * 10) : 0;
            const finalDelay = randomDelay + thinkingPause;
            const delayMs = finalDelay * 1000;

            console.log(`Auto Comment enabled. Posting in ${finalDelay.toFixed(1)} seconds (human-like delay)...`);

            setTimeout(() => {
              // Try multiple selectors for the post button
              const postButton = DOM.getPostButton();

              if (postButton && !postButton.disabled) {
                console.log('Clicking post button...');
                postButton.click();

                // Verify click worked
                setTimeout(() => {
                  const stillExists = DOM.getReplyTextbox();
                  if (stillExists) {
                    console.warn('Post button click may have failed, trying again...');
                    postButton.click();
                  }
                }, 500);
              } else {
                console.error('Post button not found or disabled');
              }
            }, delayMs);
          }
        });
      }, 1000); // Increased from 200ms to 1000ms for better reliability
    }
  }, 300);

  setTimeout(() => clearInterval(interval), 5000);
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

