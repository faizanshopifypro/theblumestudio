if (!customElements.get('board-customizer')) {
  const PIECE_DEFAULTS = {
    'name-1': { x: 50, y: 18, size: 100, placeholder: 'عبدالله' },
    'name-2': { x: 50, y: 36, size: 100, placeholder: 'موزة' },
    additional: { x: 50, y: 54, size: 100, placeholder: '' },
    english: { x: 50, y: 70, size: 30, placeholder: '' },
  };

  customElements.define(
    'board-customizer',
    class BoardCustomizer extends HTMLElement {
      connectedCallback() {
        this.preview = this.querySelector('.board-customizer__preview');
        this.board = this.preview?.querySelector('[data-board]');
        this.image = this.preview?.querySelector('[data-board-image]');
        this.stage = this.preview?.querySelector('[data-stage]');
        const slot = this.closest('.product')?.querySelector('[data-board-preview-slot]');
        if (slot && this.preview) slot.replaceChildren(this.preview);
        this.dateInput = this.querySelector('[data-date-input]');
        this.typedDate = this.querySelector('[data-typed-date]');
        this.typedDateInput = this.querySelector('[data-piece-input="english"]');
        this.dateOutput = this.querySelector('[data-date-output]');
        this.drag = null;
        this.previewAttached = false;
        this.capturing = false;
        this.previewFile = this.querySelector('[data-board-preview-file]');
        this.productForm = this.previewFile?.form || null;
        if (this.productForm) {
          this.productForm.addEventListener('submit', this.onFormSubmit.bind(this), true);
        }
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
        if (event.target.matches('[data-rush-input]')) {
          this.applyRush(event.target.value === 'Yes');
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
        this.drag.piece.style.setProperty('--piece-scale', String(Number(this.drag.piece.dataset.size) / 100));
        this.placePiece(this.drag.piece);
        this.writePlace(this.drag.piece, this.querySelector('[data-include-input]:checked')?.value === 'Yes');
      }

      onPointerUp(event) {
        if (!this.drag || event.pointerId !== this.drag.pointerId) return;
        this.drag.piece.classList.remove('is-dragging');
        this.drag = null;
      }

      selectPiece(key) {
        this.preview.querySelectorAll('[data-piece]').forEach((piece) => {
          piece.classList.toggle('is-selected', piece.dataset.piece === key);
        });
      }

      applyInclude(includeDate) {
        this.dateInput.required = true;
        if (this.typedDate) this.typedDate.hidden = !includeDate;
        if (this.typedDateInput) {
          this.typedDateInput.required = includeDate;
          this.typedDateInput.disabled = !includeDate;
        }
        this.querySelectorAll('[data-english-font], [data-piece-size="english"]').forEach((input) => {
          input.disabled = !includeDate;
        });
        this.selectOption('date on board', includeDate ? 'yes' : 'no');
      }

      applyRush(rush) {
        this.selectOption('rush', rush ? 'yes' : 'no');
      }

      syncIncludeFromVariant() {
        const includeDate = this.optionValue('date on board') === 'yes';
        const rush = this.optionValue('rush') === 'yes';
        const includeInput = this.querySelector(`[data-include-input][value="${includeDate ? 'Yes' : 'No'}"]`);
        const rushInput = this.querySelector(`[data-rush-input][value="${rush ? 'Yes' : 'No'}"]`);
        if (includeInput) includeInput.checked = true;
        if (rushInput) rushInput.checked = true;
        this.applyInclude(includeDate);
        this.applyRush(rush);
      }

      optionGroup(namePart) {
        const variantSelects = this.closest('product-info')?.querySelector('variant-selects');
        if (!variantSelects) return null;
        return [...variantSelects.querySelectorAll('fieldset, .product-form__input')].find((group) => {
          const label = group.querySelector('legend, label')?.textContent || '';
          return label.toLowerCase().includes(namePart) && this.groupHasYesNo(group);
        });
      }

      optionValue(namePart) {
        const group = this.optionGroup(namePart);
        if (!group) return '';
        const checked = group.querySelector('input[type="radio"]:checked');
        if (checked) return checked.value.trim().toLowerCase();
        const select = group.querySelector('select');
        return select ? select.value.trim().toLowerCase() : '';
      }

      groupHasYesNo(group) {
        if (!group) return false;
        const values = [...group.querySelectorAll('input[type="radio"], option')].map((input) =>
          input.value.trim().toLowerCase()
        );
        return values.includes('yes') && values.includes('no');
      }

      selectOption(namePart, wanted) {
        const group = this.optionGroup(namePart);
        if (!group) return;
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
      }

      updatePreview() {
        const orientation = this.querySelector('[data-orientation-input]:checked')?.value === 'Horizontal' ? 'horizontal' : 'vertical';
        const includeDate = this.querySelector('[data-include-input]:checked')?.value === 'Yes';
        const nameFont = this.querySelector('[data-font-input]:checked')?.dataset.fontFamily || 'serif';
        const dateFont = this.querySelector('[data-english-font]:checked')?.dataset.fontFamily || 'var(--font-heading-family)';
        const color = this.querySelector('[data-color-input]:checked')?.dataset.color || '#1a1a1a';

        this.board.dataset.orientation = orientation;
        this.image.src = orientation === 'horizontal' ? this.dataset.horizontal : this.dataset.vertical;

        this.preview.querySelectorAll('[data-piece]').forEach((piece) => {
          const key = piece.dataset.piece;
          const input = this.querySelector(`[data-piece-input="${key}"]`);
          const sizeInput = this.querySelector(`[data-piece-size="${key}"]`);
          const text = input?.value.trim() || '';
          const defaults = PIECE_DEFAULTS[key];
          piece.dataset.size = sizeInput?.value || String(defaults.size);
          piece.hidden = key === 'english' ? !includeDate || !text : !text && !defaults.placeholder;
          piece.textContent = text || defaults.placeholder;
          piece.classList.toggle('is-placeholder', Boolean(defaults.placeholder) && !text);
          piece.style.fontFamily = key === 'english' ? dateFont : nameFont;
          piece.style.color = color;
          piece.style.setProperty('--piece-scale', String(Number(piece.dataset.size) / 100));
          this.placePiece(piece);
          this.writePlace(piece, includeDate);
        });

        const typed = includeDate ? (this.typedDateInput?.value || '').trim() : '';
        this.dateOutput.disabled = !typed;
        this.dateOutput.value = typed;
      }

      placePiece(piece) {
        piece.style.left = `${piece.dataset.x}%`;
        piece.style.top = `${piece.dataset.y}%`;
      }

      writePlace(piece, includeDate) {
        const key = piece.dataset.piece;
        const place = this.querySelector(`[data-piece-place="${key}"]`);
        const input = this.querySelector(`[data-piece-input="${key}"]`);
        if (!place) return;
        const hasText = Boolean(input?.value.trim());
        place.disabled = (key !== 'name-1' && !hasText) || (key === 'english' && !includeDate);
        place.value = `x:${Math.round(Number(piece.dataset.x))} y:${Math.round(Number(piece.dataset.y))} size:${piece.dataset.size}`;
      }

      clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
      }

      onFormSubmit(event) {
        if (this.previewAttached) {
          this.previewAttached = false;
          return;
        }
        if (this.capturing) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        this.capturing = true;
        this.captureAndSubmit(event.currentTarget);
      }

      async captureAndSubmit(form) {
        try {
          this.clearCaptureError();
          this.updatePreview();
          const file = await this.drawPreviewFile();
          if (!file) throw new Error('empty');
          const transfer = new DataTransfer();
          transfer.items.add(file);
          this.previewFile.files = transfer.files;
          this.previewAttached = true;
          this.capturing = false;
          form.requestSubmit();
        } catch (error) {
          this.capturing = false;
          this.previewAttached = false;
          this.showCaptureError();
        }
      }

      showCaptureError() {
        const button = this.productForm?.querySelector('[type="submit"]');
        if (!button) return;
        let note = this.productForm.querySelector('[data-board-preview-error]');
        if (!note) {
          note = document.createElement('p');
          note.dataset.boardPreviewError = '';
          note.className = 'board-customizer__preview-error';
          button.insertAdjacentElement('afterend', note);
        }
        note.textContent = 'The board picture could not be saved. Please try again.';
      }

      clearCaptureError() {
        this.productForm?.querySelector('[data-board-preview-error]')?.remove();
      }

      loadPhoto(src) {
        return new Promise((resolve, reject) => {
          const photo = new Image();
          photo.crossOrigin = 'anonymous';
          photo.onload = () => resolve(photo);
          photo.onerror = () => reject(new Error('photo'));
          photo.src = src;
        });
      }

      async drawPreviewFile() {
        await document.fonts.ready;
        const orientation = this.board.dataset.orientation === 'horizontal' ? 'horizontal' : 'vertical';
        const src = orientation === 'horizontal' ? this.dataset.horizontal : this.dataset.vertical;
        const photo = await this.loadPhoto(src);
        const canvas = document.createElement('canvas');
        canvas.width = photo.naturalWidth;
        canvas.height = photo.naturalHeight;
        const context = canvas.getContext('2d');
        context.drawImage(photo, 0, 0, canvas.width, canvas.height);

        const area = orientation === 'horizontal'
          ? { left: 0.16, width: 0.68, top: 0.42, height: 0.36 }
          : { left: 0.32, width: 0.495, top: 0.32, height: 0.47 };
        const stageX = canvas.width * area.left;
        const stageY = canvas.height * area.top;
        const stageW = canvas.width * area.width;
        const stageH = canvas.height * area.height;

        if (orientation === 'vertical') {
          const boxX = stageX + stageW * 0.14;
          const boxW = stageW * 0.72;
          const boxH = stageH * 0.28;
          const boxY = stageY + stageH - stageH * 0.04 - boxH;
          context.fillStyle = '#ffffff';
          context.fillRect(boxX, boxY, boxW, boxH);
          context.strokeStyle = '#111111';
          context.lineWidth = Math.max(2, (canvas.width / Math.max(this.board.clientWidth, 1)) * 2);
          context.strokeRect(boxX, boxY, boxW, boxH);
        }

        this.preview.querySelectorAll('[data-piece]').forEach((piece) => {
          if (piece.hidden || piece.classList.contains('is-placeholder')) return;
          const text = piece.textContent.trim();
          if (!text) return;
          const computed = getComputedStyle(piece);
          const scale = Number(piece.dataset.size) / 100;
          const fontSize = stageW * 0.18 * scale;
          context.save();
          context.fillStyle = computed.color;
          context.font = `${fontSize}px ${computed.fontFamily}`;
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.direction = piece.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr';
          context.fillText(
            text,
            stageX + (Number(piece.dataset.x) / 100) * stageW,
            stageY + (Number(piece.dataset.y) / 100) * stageH
          );
          context.restore();
        });

        const blob = await new Promise((resolve, reject) => {
          try {
            canvas.toBlob((result) => resolve(result), 'image/png');
          } catch (error) {
            reject(error);
          }
        });
        if (!blob || !blob.size) return null;
        return new File([blob], 'board-preview.png', { type: 'image/png' });
      }
    }
  );
}
