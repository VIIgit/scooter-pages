/**
 * Scooter Input-OTP Component  (one-time password / verification code input)
 * Usage: <div data-sc="input-otp" data-length="6" data-name="code">
 *          <div data-slot="input-otp-group">
 *            <!-- slots auto-generated -->
 *          </div>
 *        </div>
 * Options: data-length="6"  data-name="fieldName"  data-separator="3" (insert separator after N digits)
 *          data-pattern="digits" (digits | alphanumeric | any)
 */
;(function () {
  Scooter.register('input-otp', function (el) {
    const length = parseInt(el.getAttribute('data-length') || '6', 10);
    const name = el.getAttribute('data-name') || '';
    const separatorAt = parseInt(el.getAttribute('data-separator') || '0', 10);
    const patternType = el.getAttribute('data-pattern') || 'digits';

    const group = el.querySelector('[data-slot="input-otp-group"]');
    if (!group) return;

    // Hidden input for form submission
    let hidden;
    if (name) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = name;
      el.appendChild(hidden);
    }

    // Validation pattern
    const patterns = {
      digits: /^[0-9]$/,
      alphanumeric: /^[a-zA-Z0-9]$/,
      any: /^.$/
    };
    const regex = patterns[patternType] || patterns.digits;

    // Build slot inputs
    group.innerHTML = '';
    const inputs = [];
    for (let i = 0; i < length; i++) {
      if (separatorAt > 0 && i > 0 && i % separatorAt === 0) {
        const sep = document.createElement('span');
        sep.setAttribute('data-slot', 'input-otp-separator');
        sep.textContent = '·';
        group.appendChild(sep);
      }
      const slot = document.createElement('input');
      slot.type = 'text';
      slot.inputMode = patternType === 'digits' ? 'numeric' : 'text';
      slot.maxLength = 1;
      slot.setAttribute('data-slot', 'input-otp-slot');
      slot.setAttribute('autocomplete', 'one-time-code');
      slot.setAttribute('aria-label', 'Digit ' + (i + 1));
      group.appendChild(slot);
      inputs.push(slot);
    }

    function getValue() {
      return inputs.map(function (inp) { return inp.value; }).join('');
    }

    function syncHidden() {
      if (hidden) hidden.value = getValue();
    }

    function focusIdx(i) {
      if (i >= 0 && i < inputs.length) inputs[i].focus();
    }

    inputs.forEach(function (inp, idx) {
      inp.addEventListener('input', function () {
        const v = inp.value;
        if (!regex.test(v)) { inp.value = ''; return; }
        inp.value = v.slice(-1); // ensure single char
        syncHidden();
        if (idx < inputs.length - 1) focusIdx(idx + 1);
        if (getValue().length === length) {
          el.dispatchEvent(new CustomEvent('sc:complete', { detail: getValue(), bubbles: true }));
        }
      });

      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace') {
          if (!inp.value && idx > 0) {
            e.preventDefault();
            inputs[idx - 1].value = '';
            focusIdx(idx - 1);
            syncHidden();
          }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          focusIdx(idx - 1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          focusIdx(idx + 1);
        }
      });

      inp.addEventListener('focus', function () {
        inp.select();
        inp.setAttribute('data-active', 'true');
      });

      inp.addEventListener('blur', function () {
        inp.removeAttribute('data-active');
      });

      // Paste support
      inp.addEventListener('paste', function (e) {
        e.preventDefault();
        const paste = (e.clipboardData.getData('text') || '').trim();
        for (let j = 0; j < paste.length && idx + j < inputs.length; j++) {
          if (regex.test(paste[j])) {
            inputs[idx + j].value = paste[j];
          }
        }
        syncHidden();
        const next = Math.min(idx + paste.length, inputs.length - 1);
        focusIdx(next);
        if (getValue().length === length) {
          el.dispatchEvent(new CustomEvent('sc:complete', { detail: getValue(), bubbles: true }));
        }
      });
    });

    el._inputOtp = {
      getValue,
      setValue: function (v) {
        for (let i = 0; i < inputs.length; i++) {
          inputs[i].value = v[i] || '';
        }
        syncHidden();
      },
      clear: function () {
        inputs.forEach(function (inp) { inp.value = ''; });
        syncHidden();
        focusIdx(0);
      },
      focus: function () { focusIdx(0); }
    };
  });
})();
