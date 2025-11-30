/* global Chart */

document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();

    // Refresh button handler
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadDashboardData);
    }
});

let activityChartInstance = null;
let languageChartInstance = null;

function loadDashboardData() {
    chrome.storage.local.get({ repliedAuthors: [], replyCount: 0, replyHistory: [] }, (data) => {
        const repliedAuthors = data.repliedAuthors || [];
        const replyHistory = data.replyHistory || [];

        const uniqueAuthors = new Set();
        const authorCounts = {};
        const repliesByDate = {};
        const toneDistribution = {};

        // Helper to normalize date
        const getDayKey = (timestamp) => {
            const date = new Date(timestamp);
            return date.toISOString().split('T')[0]; // YYYY-MM-DD
        };

        // Initialize last 7 days with 0
        const today = new Date();
        const todayKey = today.toISOString().split('T')[0];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const key = d.toISOString().split('T')[0];
            repliesByDate[key] = 0;
        }

        // Calculate today's and this week's replies
        let todayReplies = 0;
        let weekReplies = 0;
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);

        repliedAuthors.forEach(item => {
            let name = '';

            if (typeof item === 'string') {
                name = item;
            } else {
                name = item.username;
            }

            // Unique Authors
            if (name) {
                const lowerName = name.toLowerCase();
                uniqueAuthors.add(lowerName);
                authorCounts[lowerName] = (authorCounts[lowerName] || 0) + 1;
            }

            // Activity by Date
            if (typeof item !== 'string' && item.timestamp) {
                const key = getDayKey(item.timestamp);
                if (repliesByDate[key] !== undefined) {
                    repliesByDate[key]++;
                }

                // Count today's replies
                if (key === todayKey) {
                    todayReplies++;
                }

                // Count this week's replies
                if (new Date(item.timestamp) >= weekAgo) {
                    weekReplies++;
                }
            }
        });

        // Process reply history for tone distribution
        replyHistory.forEach(reply => {
            const tone = reply.tone || 'neutral';
            toneDistribution[tone] = (toneDistribution[tone] || 0) + 1;
        });

        // Update DOM
        document.getElementById('total-replies').textContent = data.replyCount || repliedAuthors.length;
        const uniqueUsersEl = document.getElementById('unique-users');
        if (uniqueUsersEl) uniqueUsersEl.textContent = uniqueAuthors.size;

        const todayRepliesEl = document.getElementById('today-replies');
        if (todayRepliesEl) todayRepliesEl.textContent = todayReplies;

        const weekRepliesEl = document.getElementById('week-replies');
        if (weekRepliesEl) weekRepliesEl.textContent = weekReplies;

        // Render Charts
        renderActivityChartJS(repliesByDate);
        renderToneChartJS(toneDistribution);

        // Render Recent Activity
        renderRecentActivity(replyHistory.slice(-10).reverse());

        // Render Top Accounts
        renderTopAccounts(authorCounts);
    });
}

function renderActivityChartJS(data) {
    const ctx = document.getElementById('activityChart');
    if (!ctx) return;

    const labels = Object.keys(data).map(date => {
        return new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
    });
    const values = Object.values(data);

    // Destroy previous chart if exists
    if (activityChartInstance) {
        activityChartInstance.destroy();
    }

    activityChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Replies',
                data: values,
                backgroundColor: 'rgba(29, 161, 242, 0.7)',
                borderColor: 'rgba(29, 161, 242, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: '#8899a6'
                    },
                    grid: {
                        color: 'rgba(136, 153, 166, 0.2)'
                    }
                },
                x: {
                    ticks: {
                        color: '#8899a6'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function renderToneChartJS(data) {
    const ctx = document.getElementById('languageChart');
    if (!ctx) return;

    const labels = Object.keys(data).map(tone => tone.charAt(0).toUpperCase() + tone.slice(1));
    const values = Object.values(data);

    const colors = [
        'rgba(29, 161, 242, 0.8)',
        'rgba(0, 186, 124, 0.8)',
        'rgba(244, 33, 46, 0.8)',
        'rgba(255, 173, 31, 0.8)',
        'rgba(121, 75, 196, 0.8)'
    ];

    // Destroy previous chart if exists
    if (languageChartInstance) {
        languageChartInstance.destroy();
    }

    languageChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.length > 0 ? labels : ['No data'],
            datasets: [{
                data: values.length > 0 ? values : [1],
                backgroundColor: values.length > 0 ? colors.slice(0, labels.length) : ['rgba(136, 153, 166, 0.3)'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#8899a6',
                        padding: 10
                    }
                }
            }
        }
    });
}

function renderRecentActivity(history) {
    const tbody = document.getElementById('logs-body');
    if (!tbody) return;

    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#8899a6;">No recent activity</td></tr>';
        return;
    }

    tbody.innerHTML = history.map(item => {
        const time = new Date(item.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
        const tone = item.tone || 'neutral';
        return `
            <tr>
                <td>${time}</td>
                <td>Reply sent</td>
                <td>@${item.author || 'unknown'}</td>
                <td><span class="status-badge status-success">${tone}</span></td>
            </tr>
        `;
    }).join('');
}

function renderTopAccounts(counts) {
    const container = document.getElementById('top-accounts-list');
    container.innerHTML = '';

    // Sort by count desc
    const sorted = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5); // Top 5

    if (sorted.length === 0) {
        container.innerHTML = '<div class="empty-state">No interactions yet</div>';
        return;
    }

    sorted.forEach(([name, count], index) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
      <div class="user-info">
        <span class="rank">#${index + 1}</span>
        <span class="username">@${name}</span>
      </div>
      <div class="count">${count}</div>
    `;
        container.appendChild(item);
    });
}
