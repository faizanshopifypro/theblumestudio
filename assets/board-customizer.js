if (!customElements.get('board-customizer')) {
  const PIECE_DEFAULTS = {
    'name-1': { x: 50, y: 18, size: 100, placeholder: 'عبدالله' },
    'name-2': { x: 50, y: 36, size: 100, placeholder: 'موزة' },
    english: { x: 50, y: 54, size: 70, placeholder: '' },
  };

  customElements.define(
    'board-customizer',
    class BoardCustomizer extends HTMLElement {
      connectedCallback() {
        this.board = this.querySelector('[data-board]');
        this.image = this.querySelector('[data-board-image]');
        this.stage = this.querySelector('[data-stage]');
        this.dateLine = this.querySelector('[data-date]');
        this.dateInput = this.querySelector('[data-date-input]');
        this.dateStyleField = this.querySelector('[data-date-style-field]');
        this.dateOutput = this.querySelector('[data-date-output]');
        this.drag = null;
        this.addEventListener('change', this.onChange.bind(this));
        this.addEventListener('input', this.onInput.bind(this));
        this.stage.addEventListener('pointerdown', this.onPointerDown.bind(this));
        this.stage.addEventListener('pointermove', this.onPointerMove.bind(this));
        this.stage.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.stage.addEventListener('pointercancel', this.onPointerUp.bind(this));
        this.syncIncludeFromVariant();
        this.updatePreview();
      }

      onChange(event) {
        if (event.target.matches('[data-include-input]')) {
          this.applyInclude(event.target.value === 'Yes');
        }
        this.updatePreview();
      }

      onInput(event) {
        if (event.target.matches('[data-piece-input]')) {
          this.selectPiece(event.target.dataset.pieceInput);
        }
        this.updatePreview();
      }

      onPointerDown(event) {
        const piece = event.target.closest('[data-piece]');
        if (!piece || event.button > 0) return;
        piece.setPointerCapture(event.pointerId);
        this.drag = {
          piece,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: Number(piece.dataset.x),
          originY: Number(piece.dataset.y),
        };
        piece.classList.add('is-dragging');
        this.selectPiece(piece.dataset.piece);
      }

      onPointerMove(event) {
        if (!this.drag || event.pointerId !== this.drag.pointerId) return;
        const bounds = this.stage.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        const nextX = this.drag.originX + ((event.clientX - this.drag.startX) / bounds.width) * 100;
        const nextY = this.drag.originY + ((event.clientY - this.drag.startY) / bounds.height) * 100;
        this.drag.piece.dataset.x = String(this.clamp(nextX, 8, 92));
        this.drag.piece.dataset.y = String(this.clamp(nextY, 8, 92));
        this.placePiece(this.drag.piece);
        this.writePlace(this.drag.piece);
      }

      onPointerUp(event) {
        if (!this.drag || event.pointerId !== this.drag.pointerId) return;
        this.drag.piece.classList.remove('is-dragging');
        this.drag = null;
      }

      selectPiece(key) {
        this.querySelectorAll('[data-piece]').forEach((piece) => {
          piece.classList.toggle('is-selected', piece.dataset.piece === key);
        });
      }

      applyInclude(includeDate) {
        this.dateInput.required = true;
        this.dateStyleField.hidden = !includeDate;
        this.querySelectorAll('[data-date-style-input]').forEach((input) => {
          input.disabled = !includeDate;
          input.required = includeDate;
        });
        if (includeDate && !this.querySelector('[data-date-style-input]:checked')) {
          const firstStyle = this.querySelector('[data-date-style-input]');
          if (firstStyle) firstStyle.checked = true;
        }
        this.dateOutput.disabled = !includeDate;
        if (!includeDate) this.dateOutput.value = '';
        this.selectDateVariant(includeDate ? 'yes' : 'no');
      }

      syncIncludeFromVariant() {
        const current = this.selectedVariantValue();
        if (current === 'yes') {
          const yes = this.querySelector('[data-include-input][value="Yes"]');
          if (yes) yes.checked = true;
          this.applyInclude(true);
        } else {
          this.applyInclude(false);
        }
      }

      selectedVariantValue() {
        const variantSelects = this.closest('product-info')?.querySelector('variant-selects');
        if (!variantSelects) return '';
        const checked = [...variantSelects.querySelectorAll('input[type="radio"]:checked')].find((input) =>
          this.groupHasYesNo(input.closest('fieldset, .product-form__input'))
        );
        if (checked) return checked.value.trim().toLowerCase();
        const select = [...variantSelects.querySelectorAll('select')].find((field) =>
          this.groupHasYesNo(field.closest('.product-form__input'))
        );
        return select ? select.value.trim().toLowerCase() : '';
      }

      groupHasYesNo(group) {
        if (!group) return false;
        const values = [...group.querySelectorAll('input[type="radio"], option')].map((input) =>
          input.value.trim().toLowerCase()
        );
        return values.includes('yes') && values.includes('no');
      }

      selectDateVariant(wanted) {
        const variantSelects = this.closest('product-info')?.querySelector('variant-selects');
        if (!variantSelects) return;
        const groups = variantSelects.querySelectorAll('fieldset, .product-form__input');
        for (const group of groups) {
          if (!this.groupHasYesNo(group)) continue;
          const radio = [...group.querySelectorAll('input[type="radio"]')].find(
            (input) => input.value.trim().toLowerCase() === wanted
          );
          if (radio) {
            if (!radio.checked) {
              radio.checked = true;
              radio.dispatchEvent(new Event('change', { bubbles: true }));
            }
            return;
          }
          const select = group.querySelector('select');
          if (!select) return;
          const option = [...select.options].find((item) => item.value.trim().toLowerCase() === wanted);
          if (option && select.value !== option.value) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
          return;
        }
      }

      updatePreview() {
        const orientation = this.querySelector('[data-orientation-input]:checked')?.value === 'Horizontal' ? 'horizontal' : 'vertical';
        const includeDate = this.querySelector('[data-include-input]:checked')?.value === 'Yes';
        const arabicFont = this.querySelector('[data-font-input]:checked')?.dataset.fontFamily || 'serif';
        const englishFont = this.querySelector('[data-english-font]:checked')?.dataset.fontFamily || 'var(--font-heading-family)';
        const color = this.querySelector('[data-color-input]:checked')?.dataset.color || '#1a1a1a';

        this.board.dataset.orientation = orientation;
        this.image.src = orientation === 'horizontal' ? this.dataset.horizontal : this.dataset.vertical;

        this.querySelectorAll('[data-piece]').forEach((piece) => {
          const key = piece.dataset.piece;
          const input = this.querySelector(`[data-piece-input="${key}"]`);
          const sizeInput = this.querySelector(`[data-piece-size="${key}"]`);
          const text = input?.value.trim() || '';
          const defaults = PIECE_DEFAULTS[key];
          piece.dataset.size = sizeInput?.value || String(defaults.size);
          piece.hidden = !text && !defaults.placeholder;
          piece.textContent = text || defaults.placeholder;
          piece.classList.toggle('is-placeholder', Boolean(defaults.placeholder) && !text);
          piece.style.fontFamily = key === 'english' ? englishFont : `"${arabicFont.replaceAll('"', '')}", serif`;
          piece.style.color = color;
          piece.style.setProperty('--piece-scale', String(Number(piece.dataset.size) / 100));
          this.placePiece(piece);
          this.writePlace(piece);
        });

        this.dateLine.style.fontFamily = `"${arabicFont.replaceAll('"', '')}", serif`;
        this.dateLine.style.color = color;
        const formatted = includeDate ? this.formatDate(this.dateInput.value, this.dateFormat()) : '';
        this.dateLine.hidden = !formatted;
        this.dateLine.textContent = formatted;
        this.dateOutput.disabled = !formatted;
        this.dateOutput.value = formatted;
      }

      placePiece(piece) {
        piece.style.left = `${piece.dataset.x}%`;
        piece.style.top = `${piece.dataset.y}%`;
      }

      writePlace(piece) {
        const key = piece.dataset.piece;
        const place = this.querySelector(`[data-piece-place="${key}"]`);
        const input = this.querySelector(`[data-piece-input="${key}"]`);
        if (!place) return;
        const hasText = Boolean(input?.value.trim());
        place.disabled = key !== 'name-1' && !hasText;
        place.value = `x:${Math.round(Number(piece.dataset.x))} y:${Math.round(Number(piece.dataset.y))} size:${piece.dataset.size}`;
      }

      clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
      }

      dateFormat() {
        return this.querySelector('[data-date-style-input]:checked')?.dataset.dateFormat || 'dmy-dots';
      }

      formatDate(value, format) {
        if (!value) return '';
        const parts = value.split('-').map((part) => Number(part));
        if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return '';
        const year = parts[0];
        const month = parts[1];
        const day = parts[2];
        const englishMonths = [
          'JANUARY',
          'FEBRUARY',
          'MARCH',
          'APRIL',
          'MAY',
          'JUNE',
          'JULY',
          'AUGUST',
          'SEPTEMBER',
          'OCTOBER',
          'NOVEMBER',
          'DECEMBER',
        ];
        const arabicMonths = [
          'يناير',
          'فبراير',
          'مارس',
          'أبريل',
          'مايو',
          'يونيو',
          'يوليو',
          'أغسطس',
          'سبتمبر',
          'أكتوبر',
          'نوفمبر',
          'ديسمبر',
        ];
        const pad = (number) => String(number).padStart(2, '0');
        const arabic = (number) => String(number).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[digit]);
        if (format === 'dmy-slash') return `${pad(day)}/${pad(month)}/${year}`;
        if (format === 'month-en') return `${this.ordinal(day)} OF ${englishMonths[month - 1]}`;
        if (format === 'ar-dots') return arabic(`${day}.${month}.${year}`);
        if (format === 'ar-slash') return arabic(`${pad(day)}/${pad(month)}/${year}`);
        if (format === 'ar-month') return `${arabic(day)} ${arabicMonths[month - 1]} ${arabic(year)}`;
        return `${day}.${month}.${year}`;
      }

      ordinal(day) {
        const tens = day % 100;
        const ones = day % 10;
        if (ones === 1 && tens !== 11) return `${day}ST`;
        if (ones === 2 && tens !== 12) return `${day}ND`;
        if (ones === 3 && tens !== 13) return `${day}RD`;
        return `${day}TH`;
      }
    }
  );
}
