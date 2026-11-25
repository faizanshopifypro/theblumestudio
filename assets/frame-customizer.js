if (!customElements.get('frame-customizer')) {
  const FRAME_AREAS = {
    horizontal: { left: 0.24, width: 0.54, top: 0.46, height: 0.3 },
    vertical: { left: 0.36, width: 0.4, top: 0.38, height: 0.4 },
  };

  customElements.define(
    'frame-customizer',
    class FrameCustomizer extends HTMLElement {
      connectedCallback() {
        this.preview = this.querySelector('[data-frame-preview]');
        this.board = this.preview?.querySelector('[data-board]');
        this.image = this.preview?.querySelector('[data-frame-image]');
        this.stage = this.preview?.querySelector('[data-stage]');
        const slot = this.closest('.product')?.querySelector('[data-frame-preview-slot]');
        if (slot && this.preview) slot.replaceChildren(this.preview);
        this.drag = null;
        this.previewAttached = false;
        this.capturing = false;
        this.previewFile = this.querySelector('[data-frame-preview-file]');
        this.productForm = this.previewFile?.form || this.querySelector('[form]')?.form || null;
        if (!this.productForm) {
          const formId = this.querySelector('[name="properties[Frame]"]')?.getAttribute('form');
          if (formId) this.productForm = document.getElementById(formId);
        }
        if (this.productForm && this.previewFile) {
          this.productForm.addEventListener('submit', this.onFormSubmit.bind(this), true);
        }
        this.addEventListener('change', this.onChange.bind(this));
        this.addEventListener('input', this.onInput.bind(this));
        if (this.preview) {
          this.onPointerDown = this.onPointerDown.bind(this);
          this.onPointerMove = this.onPointerMove.bind(this);
          this.onPointerUp = this.onPointerUp.bind(this);
          this.preview.addEventListener('pointerdown', this.onPointerDown);
          this.preview.addEventListener('pointermove', this.onPointerMove);
          this.preview.addEventListener('pointerup', this.onPointerUp);
          this.preview.addEventListener('pointercancel', this.onPointerUp);
        }
        this.syncFromVariant();
        this.updatePreview();
      }

      onChange(event) {
        if (event.target.matches('[data-finish-input]')) {
          this.applyFinish(event.target.value);
        }
        if (event.target.matches('[data-rush-input]')) {
          this.applyRush(event.target.value === 'Yes');
        }
        this.updatePreview();
      }

      onInput() {
        this.updatePreview();
      }

      onPointerDown(event) {
        if (event.pointerType === 'mouse' && event.button > 0) return;
        const piece = this.pieceFromEvent(event);
        if (!piece) return;
        event.preventDefault();
        this.preview.setPointerCapture?.(event.pointerId);
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

      pieceFromEvent(event) {
        const direct = event.target.closest?.('[data-piece]');
        if (direct && !direct.hidden) return direct;
        const pieces = [...this.preview.querySelectorAll('[data-piece]')].filter((piece) => !piece.hidden);
        return (
          pieces.find((piece) => {
            const bounds = piece.getBoundingClientRect();
            return (
              event.clientX >= bounds.left - 16 &&
              event.clientX <= bounds.right + 16 &&
              event.clientY >= bounds.top - 16 &&
              event.clientY <= bounds.bottom + 16
            );
          }) || null
        );
      }

      selectPiece(key) {
        this.preview.querySelectorAll('[data-piece]').forEach((piece) => {
          piece.classList.toggle('is-selected', piece.dataset.piece === key);
        });
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
      }

      onPointerUp(event) {
        if (!this.drag || event.pointerId !== this.drag.pointerId) return;
        this.drag.piece.classList.remove('is-dragging');
        this.drag = null;
      }

      clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
      }

      placePiece(piece) {
        piece.style.left = `${piece.dataset.x}%`;
        piece.style.top = `${piece.dataset.y}%`;
        const sizeInput = this.querySelector(`[data-piece-size="${piece.dataset.piece}"]`);
        const size = Number(sizeInput?.value || piece.dataset.size || 100);
        piece.dataset.size = String(size);
        piece.style.setProperty('--piece-scale', String(size / 100));
      }

      beadsSelected(value) {
        return /embroidery/i.test(value || '');
      }

      applyFinish(value) {
        const beads = this.beadsSelected(value);
        const choice = this.querySelector('[data-bead-choice]');
        if (choice) {
          choice.hidden = !beads;
          choice.querySelectorAll('input').forEach((input) => {
            input.disabled = !beads;
          });
        }
        const fixedNote = this.querySelector('[data-fixed-bead]');
        const fixedInput = this.querySelector('[data-fixed-bead-input]');
        if (fixedNote) fixedNote.hidden = !beads;
        if (fixedInput) fixedInput.disabled = !beads;
        this.selectOption('finish', value, false);
      }

      applyRush(rush) {
        this.selectOption('rush', rush ? 'yes' : 'no', true);
      }

      syncFromVariant() {
        const finish = this.optionValue('finish', false);
        const rush = this.optionValue('rush', true) === 'yes';
        const finishInput = [...this.querySelectorAll('[data-finish-input]')].find(
          (input) => input.value.trim().toLowerCase() === finish
        );
        if (finishInput) finishInput.checked = true;
        const rushInput = this.querySelector(`[data-rush-input][value="${rush ? 'Yes' : 'No'}"]`);
        if (rushInput) rushInput.checked = true;
        this.applyFinish(finishInput?.value || this.querySelector('[data-finish-input]:checked')?.value || '');
        this.applyRush(rush);
      }

      optionGroup(namePart, yesNo) {
        const variantSelects = this.closest('product-info')?.querySelector('variant-selects');
        if (!variantSelects) return null;
        return [...variantSelects.querySelectorAll('fieldset, .product-form__input')].find((group) => {
          const label = group.querySelector('legend, label')?.textContent || '';
          if (!label.toLowerCase().includes(namePart)) return false;
          if (!yesNo) return true;
          const values = [...group.querySelectorAll('input[type="radio"], option')].map((input) =>
            input.value.trim().toLowerCase()
          );
          return values.includes('yes') && values.includes('no');
        });
      }

      optionValue(namePart, yesNo) {
        const group = this.optionGroup(namePart, yesNo);
        if (!group) return '';
        const checked = group.querySelector('input[type="radio"]:checked');
        if (checked) return checked.value.trim().toLowerCase();
        const select = group.querySelector('select');
        return select ? select.value.trim().toLowerCase() : '';
      }

      selectOption(namePart, wanted, yesNo) {
        const group = this.optionGroup(namePart, yesNo);
        if (!group) return;
        const radio = [...group.querySelectorAll('input[type="radio"]')].find(
          (input) => input.value.trim().toLowerCase() === wanted.toLowerCase()
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
        const option = [...select.options].find((item) => item.value.trim().toLowerCase() === wanted.toLowerCase());
        if (option && select.value !== option.value) {
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      currentPhoto() {
        const thick = this.querySelector('[data-frame-style]:checked')?.value === 'Thick';
        if (this.dataset.mode === 'custom') {
          const horizontal = this.querySelector('[data-orientation-input]:checked')?.value === 'Horizontal';
          if (horizontal) return thick ? this.dataset.thickHorizontal : this.dataset.thinHorizontal;
          return thick ? this.dataset.thickVertical : this.dataset.thinVertical;
        }
        return thick ? this.dataset.thick : this.dataset.thin;
      }

      currentOrientation() {
        if (this.dataset.mode === 'custom') {
          return this.querySelector('[data-orientation-input]:checked')?.value === 'Horizontal' ? 'horizontal' : 'vertical';
        }
        return this.dataset.mode === 'signing' ? 'vertical' : 'horizontal';
      }

      updatePreview() {
        if (!this.image || !this.board) return;
        const orientation = this.currentOrientation();
        this.board.dataset.orientation = orientation;
        const src = this.currentPhoto();
        if (src) this.image.src = src;
        const color = this.querySelector('[data-color-input]:checked')?.dataset.color || '#1a1a1a';
        const nameFont = this.querySelector('[data-font-input]:checked')?.dataset.fontFamily || 'serif';
        this.preview.querySelectorAll('[data-piece]').forEach((piece) => {
          const input = this.querySelector(`[data-piece-input="${piece.dataset.piece}"]`);
          const text = input?.value.trim() || '';
          piece.hidden = !text;
          piece.textContent = text;
          piece.style.fontFamily = nameFont;
          piece.style.color = color;
          this.placePiece(piece);
        });
      }

      onFormSubmit(event) {
        if (!this.previewFile) return;
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
        let note = this.productForm.querySelector('[data-frame-preview-error]');
        if (!note) {
          note = document.createElement('p');
          note.dataset.framePreviewError = '';
          note.className = 'board-customizer__preview-error';
          button.insertAdjacentElement('afterend', note);
        }
        note.textContent = 'The frame picture could not be saved. Please try again.';
      }

      clearCaptureError() {
        this.productForm?.querySelector('[data-frame-preview-error]')?.remove();
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
        const orientation = this.currentOrientation();
        const src = this.currentPhoto();
        const photo = await this.loadPhoto(src);
        const canvas = document.createElement('canvas');
        canvas.width = photo.naturalWidth;
        canvas.height = photo.naturalHeight;
        const context = canvas.getContext('2d');
        context.drawImage(photo, 0, 0, canvas.width, canvas.height);
        const area = FRAME_AREAS[orientation] || FRAME_AREAS.vertical;
        const stageX = canvas.width * area.left;
        const stageY = canvas.height * area.top;
        const stageW = canvas.width * area.width;
        const stageH = canvas.height * area.height;
        this.preview.querySelectorAll('[data-piece]').forEach((piece) => {
          if (piece.hidden) return;
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
        return new File([blob], 'frame-preview.png', { type: 'image/png' });
      }
    }
  );
}
