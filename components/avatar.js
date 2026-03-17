/**
 * Scooter Avatar Component
 * Usage: <span data-sc="avatar">
 *          <img data-slot="avatar-image" src="…" alt="User" />
 *          <span data-slot="avatar-fallback">AB</span>
 *        </span>
 * The image is attempted first. On error (or missing src) the fallback text shows.
 */
;(function () {
  Scooter.register('avatar', function (el) {
    const img = el.querySelector('[data-slot="avatar-image"]');
    const fallback = el.querySelector('[data-slot="avatar-fallback"]');
    if (!fallback) return;

    function showFallback() {
      if (img) img.hidden = true;
      fallback.hidden = false;
    }

    function showImage() {
      if (img) img.hidden = false;
      fallback.hidden = true;
    }

    if (!img || !img.getAttribute('src')) {
      showFallback();
      return;
    }

    // If image already loaded (cached)
    if (img.complete && img.naturalWidth > 0) {
      showImage();
    } else {
      // Hide both until we know which to show
      fallback.hidden = true;
      img.hidden = true;
      img.addEventListener('load', showImage, { once: true });
      img.addEventListener('error', showFallback, { once: true });
    }
  });
})();
