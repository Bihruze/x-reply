// notifications.js
console.log("X Crypto Agent: Notifications script loaded.");

let autoReplyEnabled = false;
let lastAutoReplyTime = 0;
const AUTO_REPLY_COOLDOWN = 60000; // ANTI-SPAM: 60 second cooldown between auto-replies

// Check initial setting
chrome.storage.sync.get('autoReplyEnabled', (data) => {
  autoReplyEnabled = !!data.autoReplyEnabled;
  console.log('Auto-reply initially set to:', autoReplyEnabled);
  if (autoReplyEnabled) {
    observer.observe(document.body, { childList: true, subtree: true });
    console.log('Auto-reply is ON. Observer started.');
    // Initial scan
    setTimeout(processAllVisibleNotifications, 2000);
  }
});

// Listen for changes to the setting
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.autoReplyEnabled) {
    autoReplyEnabled = !!changes.autoReplyEnabled.newValue;
    console.log('Auto-reply setting changed to:', autoReplyEnabled);
    if (autoReplyEnabled) {
      observer.observe(document.body, { childList: true, subtree: true });
      console.log('Auto-reply turned ON. Observer started.');
      // Scan notifications that might have appeared while disabled
      setTimeout(processAllVisibleNotifications, 1000);
    } else {
      observer.disconnect();
      console.log('Auto-reply turned OFF. Observer stopped.');
    }
  }
});

function processAllVisibleNotifications() {
  document.querySelectorAll('article[data-testid="notification"]').forEach(processNotification);
}

const observer = new MutationObserver((mutations) => {
  if (!autoReplyEnabled) return;
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === 1) {
        if (node.matches('article[data-testid="notification"]')) {
          processNotification(node);
        }
        node.querySelectorAll('article[data-testid="notification"]').forEach(processNotification);
      }
    });
  });
});

function processNotification(notificationElement) {
  if (notificationElement.getAttribute('data-agent-processed')) {
    return; // Skip already processed notifications
  }

  // Mark as processed immediately to prevent double-replies
  notificationElement.setAttribute('data-agent-processed', 'true');

  // Find notifications that are replies to your tweet
  // This is based on finding text like "replied to your Tweet" or similar indicators.
  // This selector is fragile and may need updating if Twitter changes its structure.
  const replyTextIndicator = Array.from(notificationElement.querySelectorAll('span')).find(
    span => span.textContent.includes('replied')
  );

  const mentionTextIndicator = Array.from(notificationElement.querySelectorAll('span')).find(
    span => span.textContent.includes('mentioned')
  );

  if (!replyTextIndicator && !mentionTextIndicator) {
    return; // Not a reply or mention notification
  }

  console.log('Found a relevant notification:', notificationElement);

  const mentionAuthorElement = notificationElement.querySelector('a[href^="/"][role="link"]');
  const mentionAuthorName = mentionAuthorElement ? mentionAuthorElement.href.substring(mentionAuthorElement.href.lastIndexOf('/') + 1) : null;

  if (mentionAuthorName && mentionTextIndicator) {
    console.log(`Found mention from @${mentionAuthorName}. Queuing for advanced auto-reply...`);
    chrome.runtime.sendMessage({
      action: "queueMentioner",
      username: mentionAuthorName
    });
  }

  if (!replyTextIndicator) {
    return; // If it's just a mention, we are done (queued). If it's a reply, continue to auto-reply in place.
  }

  // ANTI-SPAM: Check cooldown before auto-replying
  const now = Date.now();
  if (now - lastAutoReplyTime < AUTO_REPLY_COOLDOWN) {
    console.log(`Auto-reply cooldown active. Waiting ${((AUTO_REPLY_COOLDOWN - (now - lastAutoReplyTime)) / 1000).toFixed(0)}s...`);
    return;
  }
  lastAutoReplyTime = now;

  // Extract the reply content and author
  const tweetTextElement = notificationElement.querySelector('[data-testid="tweetText"]');
  const replyText = tweetTextElement ? tweetTextElement.innerText : null;

  const authorNameElement = notificationElement.querySelector('a[href^="/"][role="link"]');
  const authorName = authorNameElement ? authorNameElement.href.substring(authorNameElement.href.lastIndexOf('/') + 1) : null;

  if (!replyText || !authorName) {
    console.error("Could not extract reply text or author from notification.", { replyText, authorName });
    return;
  }

  console.log(`New reply from @${authorName}: "${replyText}"`);
  console.log("Triggering auto-reply...");

  // Send to service worker for reply generation
  chrome.runtime.sendMessage({
    action: "autoReplyToMention",
    authorName: authorName,
    tweetText: replyText
  }).then(response => {
    if (response && response.reply) {
      console.log("Received AI reply, attempting to post:", response.reply);
      postAutoReply(notificationElement, response.reply);
    } else {
      console.error("Failed to get a valid AI reply from service worker.");
      // Un-mark for retry? For now, we'll leave it processed.
    }
  });

  // Visually mark that it has been processed for good measure
  notificationElement.style.outline = '2px solid #1DA1F2';
}

async function postAutoReply(notificationElement, text) {
  // Try to find reply button with multiple strategies
  let replyButton = notificationElement.querySelector('[data-testid="reply"]');

  if (!replyButton) {
    // Fallback to aria-label for English and Turkish
    replyButton = notificationElement.querySelector('button[aria-label*="Reply"]') ||
      notificationElement.querySelector('button[aria-label*="Yanıtla"]');
  }

  if (!replyButton) {
    console.error("Reply button not found in notification");
    return;
  }

  replyButton.click();

  // Wait for the reply composer modal to open
  await new Promise(resolve => setTimeout(resolve, 500)); // Give it a moment to appear

  const composer = document.querySelector('div[data-testid="tweetTextarea_0"]');
  if (!composer) {
    console.error("Reply composer not found");
    // We should close the modal if we can
    const closeButton = document.querySelector('div[aria-label="Close"]');
    if (closeButton) closeButton.click();
    return;
  }

  // Inject the text
  composer.textContent = text;
  composer.dispatchEvent(new Event('input', { bubbles: true }));

  // Find and click the final "Reply" button in the composer
  const postButton = document.querySelector('button[data-testid="tweetButton"]');
  if (postButton && !postButton.disabled) {
    console.log("Clicking final post button...");
    postButton.click();
  } else {
    console.error("Could not find or click the final post button.");
    const closeButton = document.querySelector('div[aria-label="Close"]');
    if (closeButton) closeButton.click();
  }
}
