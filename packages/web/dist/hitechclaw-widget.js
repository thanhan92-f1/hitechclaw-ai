/**
 * HiTechClaw Embeddable Chat Widget
 *
 * Usage:
 *   <script src="https://your-hitechclaw-host/hitechclaw-widget.js"
 *     data-token="embed-token"
 *     data-position="bottom-right"
 *     data-theme="light"
 *     data-title="Chat with us"
 *     data-primary-color="#6366f1"
 *     data-initial-message="Hello! How can I help you?"
 *   ></script>
 */
(function () {
    'use strict';

    // Prevent double-init
    if (window.__hitechclawWidget) return;
    window.__hitechclawWidget = true;

    // Read config from script tag
    var script = document.currentScript || document.querySelector('script[data-token]');
    var config = {
        token: script?.getAttribute('data-token') || '',
        position: script?.getAttribute('data-position') || 'bottom-right',
        theme: script?.getAttribute('data-theme') || 'light',
        title: script?.getAttribute('data-title') || 'Chat',
        primaryColor: script?.getAttribute('data-primary-color') || '#6366f1',
        initialMessage: script?.getAttribute('data-initial-message') || '',
        baseUrl: script?.getAttribute('data-base-url') || script?.src.replace(/\/hitechclaw-widget\.js.*$/, '') || '',
    };

    // Styles
    var isDark = config.theme === 'dark';
    var bgColor = isDark ? '#1e1e2e' : '#ffffff';
    var bgSecondary = isDark ? '#2a2a3e' : '#f8f9fa';
    var fgColor = isDark ? '#e0e0e0' : '#1a1a2e';
    var fgMuted = isDark ? '#888' : '#666';
    var borderColor = isDark ? '#333' : '#e5e7eb';

    var positionStyles = {
        'bottom-right': 'bottom:20px;right:20px;',
        'bottom-left': 'bottom:20px;left:20px;',
    };

    var pos = positionStyles[config.position] || positionStyles['bottom-right'];

    // Create container
    var container = document.createElement('div');
    container.id = 'hitechclaw-widget-root';
    container.innerHTML = '';

    // Inject styles
    var style = document.createElement('style');
    style.textContent = [
        '#hitechclaw-widget-root *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
        '#hitechclaw-widget-btn{position:fixed;' + pos + 'width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.15);z-index:99999;transition:transform .2s}',
        '#hitechclaw-widget-btn:hover{transform:scale(1.08)}',
        '#hitechclaw-widget-btn svg{width:24px;height:24px;fill:white}',
        '#hitechclaw-widget-panel{position:fixed;' + pos + 'width:380px;height:520px;border-radius:16px;overflow:hidden;display:none;flex-direction:column;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,.18)}',
        '#hitechclaw-widget-panel.open{display:flex}',
        '#hitechclaw-widget-header{padding:14px 16px;display:flex;align-items:center;justify-content:space-between}',
        '#hitechclaw-widget-header h3{margin:0;font-size:15px;font-weight:600}',
        '#hitechclaw-widget-close{background:none;border:none;cursor:pointer;padding:4px;border-radius:6px}',
        '#hitechclaw-widget-close:hover{opacity:.7}',
        '#hitechclaw-widget-messages{flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:8px}',
        '.hitechclaw-msg{max-width:80%;padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.5;word-break:break-word}',
        '.hitechclaw-msg.user{align-self:flex-end;border-bottom-right-radius:4px}',
        '.hitechclaw-msg.bot{align-self:flex-start;border-bottom-left-radius:4px}',
        '#hitechclaw-widget-input{padding:12px 16px;display:flex;gap:8px}',
        '#hitechclaw-widget-input input{flex:1;padding:10px 14px;border-radius:10px;border:1px solid;font-size:14px;outline:none}',
        '#hitechclaw-widget-input input:focus{border-color:' + config.primaryColor + '}',
        '#hitechclaw-widget-input button{padding:10px 16px;border-radius:10px;border:none;cursor:pointer;font-size:14px;font-weight:500}',
        '@media(max-width:500px){#hitechclaw-widget-panel{width:calc(100vw - 16px);height:calc(100vh - 80px);' + (config.position.includes('left') ? 'left:8px' : 'right:8px') + ';bottom:72px;border-radius:12px}}',
    ].join('\n');
    document.head.appendChild(style);

    // Button
    var btn = document.createElement('button');
    btn.id = 'hitechclaw-widget-btn';
    btn.style.background = config.primaryColor;
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';
    container.appendChild(btn);

    // Panel
    var panel = document.createElement('div');
    panel.id = 'hitechclaw-widget-panel';
    panel.style.background = bgColor;
    panel.style.border = '1px solid ' + borderColor;
    panel.innerHTML = [
        '<div id="hitechclaw-widget-header" style="background:' + config.primaryColor + '">',
        '  <h3 style="color:white">' + escapeHtml(config.title) + '</h3>',
        '  <button id="hitechclaw-widget-close"><svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>',
        '</div>',
        '<div id="hitechclaw-widget-messages"></div>',
        '<div id="hitechclaw-widget-input">',
        '  <input type="text" placeholder="Type a message..." style="background:' + bgSecondary + ';border-color:' + borderColor + ';color:' + fgColor + '"/>',
        '  <button style="background:' + config.primaryColor + ';color:white">Send</button>',
        '</div>',
    ].join('\n');
    container.appendChild(panel);
    document.body.appendChild(container);

    // State
    var sessionId = 'widget-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    var messagesEl = panel.querySelector('#hitechclaw-widget-messages');
    var inputEl = panel.querySelector('#hitechclaw-widget-input input');
    var sendBtn = panel.querySelector('#hitechclaw-widget-input button');
    var closeBtn = panel.querySelector('#hitechclaw-widget-close');

    // ─── Widget Analytics ──────────────────────────────────
    var analyticsQueue = [];
    var analyticsTimer = null;

    function trackEvent(event, data) {
        analyticsQueue.push({
            event: event,
            sessionId: sessionId,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            data: data || {},
        });
        // Flush in batches every 5 seconds
        if (!analyticsTimer) {
            analyticsTimer = setTimeout(flushAnalytics, 5000);
        }
    }

    function flushAnalytics() {
        analyticsTimer = null;
        if (!analyticsQueue.length) return;
        var events = analyticsQueue.splice(0);
        var payload = JSON.stringify({ events: events });
        // Use sendBeacon for reliability (fire-and-forget)
        if (navigator.sendBeacon) {
            navigator.sendBeacon(config.baseUrl + '/api/widget/analytics', new Blob([payload], { type: 'application/json' }));
        } else {
            fetch(config.baseUrl + '/api/widget/analytics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + config.token },
                body: payload,
                keepalive: true,
            }).catch(function () { });
        }
    }

    // Flush on page unload
    window.addEventListener('beforeunload', flushAnalytics);

    trackEvent('widget_loaded');

    // Toggle
    btn.addEventListener('click', function () {
        panel.classList.add('open');
        btn.style.display = 'none';
        inputEl.focus();
        trackEvent('widget_opened');
        if (messagesEl.children.length === 0 && config.initialMessage) {
            addMessage(config.initialMessage, 'bot');
        }
    });
    closeBtn.addEventListener('click', function () {
        panel.classList.remove('open');
        btn.style.display = 'flex';
        trackEvent('widget_closed');
    });

    // Send
    function send() {
        var text = inputEl.value.trim();
        if (!text) return;
        inputEl.value = '';
        addMessage(text, 'user');
        trackEvent('message_sent', { length: text.length });
        sendToAPI(text);
    }
    sendBtn.addEventListener('click', send);
    inputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') send();
    });

    function addMessage(text, role) {
        var div = document.createElement('div');
        div.className = 'hitechclaw-msg ' + role;
        if (role === 'user') {
            div.style.background = config.primaryColor;
            div.style.color = 'white';
        } else {
            div.style.background = bgSecondary;
            div.style.color = fgColor;
        }
        div.textContent = text;
        messagesEl.appendChild(div);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        return div;
    }

    function sendToAPI(text) {
        var typingEl = addMessage('...', 'bot');
        fetch(config.baseUrl + '/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + config.token,
            },
            body: JSON.stringify({ message: text, sessionId: sessionId }),
        })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                typingEl.textContent = data.reply || data.message || 'No response';
                messagesEl.scrollTop = messagesEl.scrollHeight;
                trackEvent('response_received', { length: (typingEl.textContent || '').length });
            })
            .catch(function () {
                typingEl.textContent = 'Sorry, something went wrong.';
                typingEl.style.color = '#ef4444';
                trackEvent('response_error');
            });
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }
})();
