if (!customElements.get('board-customizer')) {
  customElements.define(
    'board-customizer',
    class BoardCustomizer extends HTMLElement {
      connectedCallback() {
        this.board = this.querySelector('[data-board]');
        this.image = this.querySelector('[data-board-image]');
        this.names = this.querySelector('[data-names]');
        this.dateLine = this.querySelector('[data-date]');
        this.namesInput = this.querySelector('[data-names-input]');
        this.dateInput = this.querySelector('[data-date-input]');
        this.dateStyleField = this.querySelector('[data-date-style-field]');
        this.dateOutput = this.querySelector('[data-date-output]');
        this.addEventListener('change', this.onChange.bind(this));
        this.addEventListener('input', this.updatePreview.bind(this));
        this.syncIncludeFromVariant();
        this.updatePreview();
      }

      onChange(event) {
        const target = event.target;
        if (target.matches('[data-include-input]')) {
          this.applyInclude(target.value === 'Yes');
        }
        if (target.matches('[data-layout-input]') && target.dataset.layout === 'entrance') {
          const horizontal = this.querySelector('[data-orientation-input][value="Horizontal"]');
          if (horizontal && !horizontal.checked) horizontal.checked = true;
        }
        if (target.matches('[data-orientation-input]') && target.value === 'Vertical' && this.layoutKey() === 'entrance') {
          const fallback = this.querySelector('[data-layout-input]:not([data-layout="entrance"])');
          if (fallback) fallback.checked = true;
        }
        this.updatePreview();
      }

      applyInclude(includeDate) {
        this.dateInput.required = includeDate;
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
        const select = [...variantSelects.querySelectorAll('select')].find((field) => this.groupHasYesNo(field.closest('.product-form__input')));
        return select ? select.value.trim().toLowerCase() : '';
      }

      groupHasYesNo(group) {
        if (!group) return false;
        const values = [...group.querySelectorAll('input[type="radio"], option')].map((input) => input.value.trim().toLowerCase());
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

      layoutKey() {
        return this.querySelector('[data-layout-input]:checked')?.dataset.layout || 'stacked';
      }

      updatePreview() {
        const layout = this.layoutKey();
        const entrance = layout === 'entrance';
        const orientationInput = this.querySelector('[data-orientation-input]:checked');
        const orientation = entrance || orientationInput?.value === 'Horizontal' ? 'horizontal' : 'vertical';
        const includeDate = this.querySelector('[data-include-input]:checked')?.value === 'Yes';
        const font = this.querySelector('[data-font-input]:checked')?.dataset.fontFamily || 'serif';
        const color = this.querySelector('[data-color-input]:checked')?.dataset.color || '#1a1a1a';
        const typedNames = this.namesInput.value.trim();
        const names = this.formatNames(typedNames, layout);

        this.board.dataset.orientation = orientation;
        this.board.dataset.layout = layout;
        this.image.src = orientation === 'horizontal' ? this.dataset.horizontal : this.dataset.vertical;
        this.names.textContent = names || (layout === 'single' ? 'عبدالله و موزة' : 'عبدالله\nموزة');
        this.names.classList.toggle('is-placeholder', !names);
        this.names.style.fontFamily = `"${font.replaceAll('"', '')}", serif`;
        this.names.style.color = color;
        this.dateLine.style.fontFamily = this.names.style.fontFamily;
        this.dateLine.style.color = color;

        const formatted = includeDate ? this.formatDate(this.dateInput.value, this.dateFormat()) : '';
        this.dateLine.hidden = !formatted;
        this.dateLine.textContent = formatted;
        this.dateOutput.disabled = !formatted;
        this.dateOutput.value = formatted;
      }

      formatNames(value, layout) {
        const lines = value
          .split(/\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        if (!lines.length) return '';
        if (layout === 'single') return lines.join(' و ');
        return lines.join('\n');
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
