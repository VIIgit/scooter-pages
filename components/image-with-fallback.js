/**
 * Scooter Image With Fallback Component
 * Usage: <div data-sc="image-with-fallback">
 *          <img data-slot="image" src="…" alt="Photo" />
 *        </div>
 * On error, the <img> is replaced by a placeholder SVG icon.
 * Derived from the React ImageWithFallback component.
 */
;(function () {
  Scooter.register('image-with-fallback', function (el) {
    const img = el.querySelector('[data-slot="image"]') || el.querySelector('img');
    if (!img) return;

    function insertFallback() {
      img.hidden = true;
      // Only insert once
      if (el.querySelector('[data-slot="image-fallback"]')) return;

      const ph = document.createElement('div');
      ph.setAttribute('data-slot', 'image-fallback');
      ph.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>' +
        '<circle cx="9" cy="9" r="2"/>' +
        '<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>' +
        '</svg>';
      el.appendChild(ph);
    }

    if (img.complete) {
      if (img.naturalWidth === 0) insertFallback();
    } else {
      img.addEventListener('error', insertFallback, { once: true });
    }
  });
})();
