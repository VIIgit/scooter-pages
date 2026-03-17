/**
 * Scooter Toggle Component
 * Usage: <button data-sc="toggle" data-slot="toggle" aria-pressed="false">…</button>
 */
;(function () {
  Scooter.register('toggle', function (el) {
    const initial = el.getAttribute('data-state') === 'on' || el.getAttribute('aria-pressed') === 'true';
    setState(initial);

    el.addEventListener('click', () => {
      const isOn = el.getAttribute('aria-pressed') === 'true';
      setState(!isOn);
      el.dispatchEvent(new CustomEvent('sc:toggle', { detail: { pressed: !isOn }, bubbles: true }));
    });

    function setState(on) {
      el.setAttribute('aria-pressed', String(on));
      el.setAttribute('data-state', on ? 'on' : 'off');
    }
  });
})();
