// Shared page tracker — include in every page
// Tracks page views and user actions to Supabase
(function() {
  const TRACK_URL = '/api/track';
  const SYNC_URL = '/api/sync-user';

  function getUser() {
    try { return JSON.parse(localStorage.getItem('swipechat_user') || '{}'); } catch { return {}; }
  }

  function track(event, page, meta) {
    const user = getUser();
    fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        page,
        user_phone: user.phone || null,
        user_name: user.name || null,
        user_email: user.email || null,
        meta: meta || null
      })
    }).catch(() => {});
  }

  function syncUser(stage) {
    const user = getUser();
    if (!user.phone) return;
    const activated = localStorage.getItem('swipechat_activated') === 'true';
    const payment = JSON.parse(localStorage.getItem('swipechat_activation_payment') || 'null');
    fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: user.name,
        phone: user.phone,
        email: user.email,
        activated,
        stage,
        payment_ref: payment?.ref || null,
        payment_amount: payment?.amount || null
      })
    }).catch(() => {});
  }

  // Auto-track on page load
  const page = document.title.replace('Texting Factory Kenya | ', '').replace('Texting Factory | ', '').toLowerCase().replace(/\s+/g, '_');
  track('page_view', page);

  // Expose globally
  window.tfTrack = track;
  window.tfSyncUser = syncUser;
})();
