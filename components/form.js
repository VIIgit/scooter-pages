/**
 * Scooter Form Component  (validation + error messages)
 * Usage: <form data-sc="form">
 *          <div data-slot="form-item">
 *            <label data-slot="form-label" for="email">Email</label>
 *            <input data-slot="form-control" id="email" name="email" type="email" required />
 *            <p data-slot="form-description">We'll never share your email.</p>
 *            <p data-slot="form-message" hidden></p>
 *          </div>
 *          <button type="submit">Submit</button>
 *        </form>
 * Validation: Uses native HTML constraint validation API.
 *   data-match="password" on a confirm field to require matching another field.
 */
;(function () {
  Scooter.register('form', function (el) {
    if (el.tagName !== 'FORM') return;

    const items = () => Array.from(el.querySelectorAll('[data-slot="form-item"]'));

    function validate(item) {
      const control = item.querySelector('[data-slot="form-control"]') || 
                      item.querySelector('input, select, textarea');
      const msg = item.querySelector('[data-slot="form-message"]');
      if (!control) return true;

      // Custom match validation
      const matchName = control.getAttribute('data-match');
      if (matchName) {
        const other = el.querySelector('[name="' + matchName + '"]');
        if (other && control.value !== other.value) {
          control.setCustomValidity('Values do not match');
        } else {
          control.setCustomValidity('');
        }
      }

      const valid = control.checkValidity();
      item.setAttribute('data-invalid', String(!valid));
      if (msg) {
        msg.textContent = valid ? '' : control.validationMessage;
        msg.hidden = valid;
      }
      return valid;
    }

    // Live validation on blur
    el.addEventListener('focusout', function (e) {
      const item = e.target.closest('[data-slot="form-item"]');
      if (item) validate(item);
    });

    // Also on input after first invalid
    el.addEventListener('input', function (e) {
      const item = e.target.closest('[data-slot="form-item"]');
      if (item && item.getAttribute('data-invalid') === 'true') validate(item);
    });

    el.addEventListener('submit', function (e) {
      let allValid = true;
      items().forEach(function (item) {
        if (!validate(item)) allValid = false;
      });
      if (!allValid) {
        e.preventDefault();
        // Focus first invalid
        const first = el.querySelector('[data-invalid="true"] [data-slot="form-control"]') ||
                      el.querySelector('[data-invalid="true"] input, [data-invalid="true"] select, [data-invalid="true"] textarea');
        if (first) first.focus();
      }
    });

    el.setAttribute('novalidate', ''); // Suppress browser default bubbles; we handle validation

    el._form = {
      validate: function () {
        let ok = true;
        items().forEach(function (item) { if (!validate(item)) ok = false; });
        return ok;
      },
      reset: function () {
        el.reset();
        items().forEach(function (item) {
          item.removeAttribute('data-invalid');
          const msg = item.querySelector('[data-slot="form-message"]');
          if (msg) { msg.textContent = ''; msg.hidden = true; }
        });
      }
    };
  });
})();
