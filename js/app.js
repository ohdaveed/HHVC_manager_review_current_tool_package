    const DATA = window.HHVC_DATA;
    if (!DATA || !DATA.pages || !DATA.order) {
      throw new Error('HHVC mockup page data did not load. Check script order in index.html.');
    }
    const ORIGINAL_DATA = JSON.parse(JSON.stringify(DATA));
    const pageData = DATA.pages;
    const pageOrder = DATA.order;
    function escapeHtml(value) { return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
    function karlTag(label, kind = "body") { return `<div class="karl-tag" data-kind="${kind}"><strong>Karl:</strong> ${escapeHtml(label)}</div>`; }
    function paragraphList(paragraphs = []) { return paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join(''); }
    let currentPageKey = 'pestsTopic';
    function defaultSeoTitle(page) { return page.seoTitle || `${page.title} | San Francisco`; }
    function defaultMetaDescription(page) { return page.metaDescription || page.summary || ''; }
    function getPrimaryCta(page) {
      for (const section of page.sections || []) {
        for (const step of section.steps || []) {
          if (step.button) return step.button;
        }
      }
      return page.primaryCta || '';
    }
    function setPrimaryCta(page, label) {
      for (const section of page.sections || []) {
        for (const step of section.steps || []) {
          if (step.button) { step.button = label; return; }
        }
      }
      page.primaryCta = label;
    }
    function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }
    function setField(id, value) { const el = document.getElementById(id); if (el) el.value = value || ''; }
    function statusClass(length, max) { return length <= max ? 'ok' : 'warn'; }
    function updateSearchPreview() {
      const page = pageData[currentPageKey]; if (!page) return;
      const seoTitle = document.getElementById('seoTitleInput')?.value || defaultSeoTitle(page);
      const metaDescription = document.getElementById('metaDescriptionInput')?.value || defaultMetaDescription(page);
      const slug = document.getElementById('urlInput')?.value || page.slug;
      setText('seoPreviewTitle', seoTitle);
      setText('seoPreviewUrl', 'https://' + slug);
      setText('seoPreviewDescription', metaDescription);
      const titleStatus = document.getElementById('seoTitleStatus');
      const descStatus = document.getElementById('metaDescriptionStatus');
      setText('seoTitleCount', `${seoTitle.length} characters`);
      setText('metaDescriptionCount', `${metaDescription.length} characters`);
      if (titleStatus) { titleStatus.className = statusClass(seoTitle.length, 60); titleStatus.textContent = seoTitle.length <= 60 ? 'OK: 60 or fewer' : 'Over 60 characters'; }
      if (descStatus) { descStatus.className = statusClass(metaDescription.length, 110); descStatus.textContent = metaDescription.length <= 110 ? 'OK: 110 or fewer' : 'Over 110 characters'; }
    }
    function syncEditorFields(page) {
      setField('titleInput', page.title);
      setField('descriptionInput', page.summary);
      setField('ctaInput', getPrimaryCta(page));
      setField('seoTitleInput', defaultSeoTitle(page));
      setField('metaDescriptionInput', defaultMetaDescription(page));
      updateSearchPreview();
    }

    // ── Helper functions for dirty state, toast, sidebar, checklist, etc. ──
    function updateDirtyIndicators(key) {
      const page = pageData[key];
      const orig = ORIGINAL_DATA.pages[key];
      if (!page || !orig) return;
      const titleWrap = document.getElementById('titleInput')?.closest('.field-with-reset');
      if (titleWrap) titleWrap.classList.toggle('modified', page.title !== orig.title);
      const descWrap = document.getElementById('descriptionInput')?.closest('.field-with-reset');
      if (descWrap) descWrap.classList.toggle('modified', page.summary !== orig.summary);
      const ctaWrap = document.getElementById('ctaInput')?.closest('.field-with-reset');
      if (ctaWrap) ctaWrap.classList.toggle('modified', getPrimaryCta(page) !== getPrimaryCta(orig));
    }
    function showToast(message, type) {
      const container = document.getElementById('toastContainer');
      if (!container) return;
      const el = document.createElement('div');
      el.className = 'toast' + (type ? ' ' + type : '');
      el.textContent = message;
      const close = document.createElement('button');
      close.className = 'toast-close';
      close.textContent = '\u00d7';
      close.setAttribute('aria-label', 'Dismiss');
      close.addEventListener('click', () => el.remove());
      el.appendChild(close);
      container.appendChild(el);
      setTimeout(() => { if (el.parentNode) el.remove(); }, 4000);
    }
    function updateReadingTarget(page) {
      const el = document.getElementById('readingTargetValue');
      if (el && page && page.reading) { el.textContent = page.reading; } else if (el) { el.textContent = '\u2014'; }
    }
    function updatePageBadge(title) {
      const badge = document.getElementById('currentPageBadge');
      if (!badge) return;
      badge.textContent = 'Viewing: ' + escapeHtml(title || '');
      badge.classList.add('visible');
      clearTimeout(badge._timeout);
      badge._timeout = setTimeout(() => badge.classList.remove('visible'), 5000);
    }
    function saveSidebarScroll() {
      const sb = document.querySelector('.sidebar');
      if (sb) sessionStorage.setItem('sidebarScroll', String(sb.scrollTop));
    }
    function restoreSidebarScroll() {
      const saved = sessionStorage.getItem('sidebarScroll');
      if (saved !== null) requestAnimationFrame(() => { const sb = document.querySelector('.sidebar'); if (sb) sb.scrollTop = parseInt(saved, 10); });
    }
    function resetField(fieldKey) {
      const key = currentPageKey;
      const orig = ORIGINAL_DATA.pages[key];
      const page = pageData[key];
      if (!orig || !page) return;
      if (fieldKey === 'title') { page.title = orig.title; setField('titleInput', orig.title); const h1 = document.querySelector('#mockPage h1'); if (h1) h1.textContent = orig.title; }
      else if (fieldKey === 'summary') { page.summary = orig.summary; setField('descriptionInput', orig.summary); const s = document.querySelector('#mockPage .summary'); if (s) s.textContent = orig.summary; }
      else if (fieldKey === 'cta') { setPrimaryCta(page, getPrimaryCta(orig)); setField('ctaInput', getPrimaryCta(orig)); const pb = document.querySelector('#mockPage .btn:not(.secondary)'); if (pb) pb.innerHTML = karlTag('Button label: Primary CTA', 'placement') + escapeHtml(getPrimaryCta(orig)); }
      updateDirtyIndicators(key);
      showToast((fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1)) + ' reset to original.', 'info');
    }
    function toggleSidebar() {
      const app = document.querySelector('.app');
      const btn = document.getElementById('sidebarToggle');
      if (!app || !btn) return;
      app.classList.toggle('sidebar-collapsed');
      const coll = app.classList.contains('sidebar-collapsed');
      btn.textContent = coll ? '\u25b6' : '\u25c0';
      btn.setAttribute('aria-label', coll ? 'Expand sidebar' : 'Collapse sidebar');
    }
    function buildPageSelect() {
      const select = document.getElementById('pageSelect');
      if (!select) return;
      const groups = { Topic: [], Transaction: [], Information: [] };
      pageOrder.forEach(([key, label]) => {
        const type = label.startsWith('Topic') ? 'Topic' : label.startsWith('Transaction') ? 'Transaction' : 'Information';
        groups[type].push([key, label.replace(/^(Topic|Transaction|Information):\s*/, '')]);
      });
      select.innerHTML = Object.entries(groups).map(([type, items]) =>
        '<optgroup label="' + escapeHtml(type) + ' pages">' + items.map(([k, l]) => '<option value="' + k + '">' + escapeHtml(l) + '</option>').join('') + '</optgroup>'
      ).join('');
    }
    function initChecklist() {
      document.querySelectorAll('.checklist .check').forEach((el, i) => {
        el.setAttribute('data-check-index', i);
        el.addEventListener('click', function() {
          this.classList.toggle('unchecked');
          if (currentPageKey) sessionStorage.setItem('check_' + currentPageKey + '_' + i, this.classList.contains('unchecked') ? '0' : '1');
        });
      });
    }
    function applyChecklistState(key) {
      document.querySelectorAll('.checklist .check').forEach((el, i) => {
        const saved = sessionStorage.getItem('check_' + key + '_' + i);
        if (saved === '0') el.classList.add('unchecked');
        else el.classList.remove('unchecked');
      });
    }
    // ── End helper functions ──

    function renderAudience(audience = []) {
      if (!Array.isArray(audience)) return '';
      return audience.map(item => `<li>${escapeHtml(item)}</li>`).join('');
    }
    function bulletList(bullets = []) { if (!bullets.length) return ''; return `<ul>${bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`; }
    function button(label, kind = "primary", target = null) { const cls = kind === 'secondary' ? 'btn secondary' : 'btn'; const onclick = target ? ` onclick="renderPage('${target}'); return false;"` : ''; return `<a class="${cls}" href="#"${onclick}>${karlTag(kind === 'secondary' ? 'Body link to related Transaction page' : 'Button label: Primary CTA', 'placement')}${escapeHtml(label)}</a>`; }
    function renderCards(cards = []) { return `<div class="cards">${cards.map(c => { const href = c.url ? escapeHtml(c.url) : '#'; const attr = c.url ? ' target="_blank" rel="noopener"' : ` onclick="${c.target ? `renderPage('${c.target}'); return false;` : 'return false;'}"`; return `<article class="card">${karlTag(c.karl || 'Linked page item: title + description + link. Use Related section, body link, Resource Collection item, or Agency page link section as appropriate.', 'placement')}<h3><a href="${href}"${attr}>${escapeHtml(c.title)}</a></h3><p>${escapeHtml(c.text)}</p></article>`; }).join('')}</div>`; }
    function renderSteps(steps = []) { return `<ol class="step-list">${steps.map(s => `<li class="step"><div>${karlTag(s.karl || 'Body step', s.button ? 'placement' : 'body')}<h3>${escapeHtml(s.title)}</h3>${paragraphList(s.text || [])}${bulletList(s.bullets || [])}${s.button ? button(s.button, 'primary') : ''}${s.callout ? `<div class="callout">${karlTag(s.callout.karl || 'Body note', 'body')}<strong>Note:</strong> ${escapeHtml(s.callout.text)}</div>` : ''}</div></li>`).join('')}</ol>`; }
    function renderTable(rows = []) { if (!rows.length) return ''; const [head, ...body] = rows; return `<table class="table"><thead><tr>${head.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`; }
    function renderSection(section) {
      const kind = section.kind || 'body';
      let inner = `${karlTag(section.karl || 'Body section', kind)}<h2>${escapeHtml(section.heading)}</h2>`;
      inner += paragraphList(section.paragraphs || []);
      inner += section.steps ? renderSteps(section.steps) : '';
      inner += bulletList(section.bullets || []);
      inner += section.table ? renderTable(section.table) : '';
      if (section.callout) inner += `<div class="callout">${karlTag(section.callout.karl || 'Body callout', 'body')}${escapeHtml(section.callout.text)}</div>`;
      if (section.button) inner += button(section.button, section.buttonStyle || 'primary', section.buttonTarget || null);
      if (section.cards) inner += renderCards(section.cards);
      return `<div class="section">${inner}</div>`;
    }
    function applyPageContent(key) {
      const page = pageData[key]; if (!page) return;
      saveSidebarScroll();
      currentPageKey = key;
      document.getElementById('browserUrl').textContent = 'https://' + page.slug;
      document.getElementById('urlInput').value = page.slug;
      document.getElementById('pageSelect').value = key;
      document.getElementById('mockPage').innerHTML = `
        <header class="site-header"><div class="site-header-inner"><a href="#" class="brand"><span class="brand-mark">SF</span><span>SF.gov</span></a><nav class="site-nav" aria-label="Example navigation"><a href="#">Services</a><a href="#">Departments</a><a href="#">Search</a></nav></div></header>
        <section class="hero"><div class="hero-inner">${karlTag('Metadata: Karl page type', 'meta')}<div class="eyebrow">${escapeHtml(page.type)}</div>${karlTag('Page title field', 'meta')}<h1 tabindex="-1">${escapeHtml(page.title)}</h1>${karlTag('Short summary / Description field', 'meta')}<p class="summary">${escapeHtml(page.summary)}</p>${karlTag('Metadata: Agency, program, reading target', 'meta')}<div class="metadata"><span class="pill">Environmental Health</span><span class="pill">HHVC</span><span class="pill">${escapeHtml(page.reading)}</span></div></div></section>
        <main class="page-body"><div class="editor-note">${karlTag('Editor-only QA note / Do not publish', 'editor')}<strong>Editor QA:</strong> ${escapeHtml(page.editorNote || `Primary agency: Environmental Health. Parent department: Department of Public Health. Program: Healthy Housing and Vector Control. Reading level target: ${page.reading}. Transaction pages use one primary CTA and avoid about-style program background. Visual link boxes in this mockup are preview aids.`)}</div><div class="section audience-section">${karlTag('Body: Audience section', 'body')}<h2>Who this page is for</h2><p>This page can help if you are:</p><ul>${renderAudience(page.audience)}</ul></div>${page.sections.map(renderSection).join('')}</main>
        <footer class="footer"><div class="footer-inner"><strong>City and County of San Francisco</strong><br>This is a design mockup for HHVC content review, not a live SF.gov page.</div></footer>`;
      syncEditorFields(page);
      updateDirtyIndicators(key);
      updateReadingTarget(page);
      updatePageBadge(page.title);
      applyChecklistState(key);
      restoreSidebarScroll();
    }
    function renderPage(key) {
      if (!pageData[key]) return;
      if (!document.startViewTransition) {
        applyPageContent(key);
        return;
      }
      const transition = document.startViewTransition(() => applyPageContent(key));
      transition.finished.finally(() => {
        document.querySelector('#mockPage h1')?.focus();
      });
    }
    function init() {
      buildPageSelect();
      const select = document.getElementById('pageSelect');
      select.addEventListener('change', e => renderPage(e.target.value));
      document.getElementById('urlInput').addEventListener('input', e => { document.getElementById('browserUrl').textContent = 'https://' + e.target.value; updateSearchPreview(); });
      document.getElementById('titleInput').addEventListener('input', e => { const page = pageData[currentPageKey]; page.title = e.target.value; const h1 = document.querySelector('#mockPage h1'); if (h1) h1.textContent = e.target.value; if (!page.seoTitleEdited) { setField('seoTitleInput', defaultSeoTitle(page)); } updateSearchPreview(); updateDirtyIndicators(currentPageKey); });
      document.getElementById('descriptionInput').addEventListener('input', e => { const page = pageData[currentPageKey]; page.summary = e.target.value; const summary = document.querySelector('#mockPage .summary'); if (summary) summary.textContent = e.target.value; if (!page.metaDescriptionEdited) { setField('metaDescriptionInput', defaultMetaDescription(page)); } updateSearchPreview(); updateDirtyIndicators(currentPageKey); });
      document.getElementById('ctaInput').addEventListener('input', e => { const page = pageData[currentPageKey]; setPrimaryCta(page, e.target.value); const primaryButton = document.querySelector('#mockPage .btn:not(.secondary)'); if (primaryButton) primaryButton.innerHTML = karlTag('Button label: Primary CTA', 'placement') + escapeHtml(e.target.value); updateDirtyIndicators(currentPageKey); });
      document.getElementById('seoTitleInput').addEventListener('input', e => { const page = pageData[currentPageKey]; page.seoTitle = e.target.value; page.seoTitleEdited = true; updateSearchPreview(); });
      document.getElementById('metaDescriptionInput').addEventListener('input', e => { const page = pageData[currentPageKey]; page.metaDescription = e.target.value; page.metaDescriptionEdited = true; updateSearchPreview(); });
      document.getElementById('tagToggle').addEventListener('change', e => { document.body.classList.toggle('hide-karl-tags', !e.target.checked); });
      document.getElementById('resetTitleBtn')?.addEventListener('click', () => resetField('title'));
      document.getElementById('resetDescriptionBtn')?.addEventListener('click', () => resetField('summary'));
      document.getElementById('resetCtaBtn')?.addEventListener('click', () => resetField('cta'));
      document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebar);
      initChecklist();
      renderPage('pestsTopic');
    }
    init();


// Manager review package additions. Runs locally in the browser only.
function managerReviewCsvEscape(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}
function managerReviewToCsv(rows) {
  return rows.map(row => row.map(managerReviewCsvEscape).join(',')).join('\n') + '\n';
}
function managerReviewDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
function managerReviewToday() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function getManagerReviewSnapshot() {
  const page = pageData[currentPageKey] || {};
  return {
    review_date: document.getElementById('reviewDateInput')?.value || managerReviewToday(),
    reviewer: document.getElementById('reviewerInput')?.value || '',
    page_key: currentPageKey,
    page_title: page.title || '',
    page_type: page.type || '',
    url_slug: document.getElementById('urlInput')?.value || page.slug || '',
    decision: document.getElementById('reviewDecision')?.value || 'Needs review',
    notes: document.getElementById('reviewNotes')?.value || '',
    risks_or_blockers: document.getElementById('reviewRisks')?.value || '',
    follow_up_owner: document.getElementById('reviewOwner')?.value || '',
    seo_title: document.getElementById('seoTitleInput')?.value || defaultSeoTitle(page),
    meta_description: document.getElementById('metaDescriptionInput')?.value || defaultMetaDescription(page),
    primary_cta: getPrimaryCta(page),
    reading_target: page.reading || ''
  };
}
function exportCurrentManagerReviewCsv() {
  const snapshot = getManagerReviewSnapshot();
  const headers = Object.keys(snapshot);
  const rows = [headers, headers.map(h => snapshot[h])];
  managerReviewDownload(`${snapshot.page_key}-manager-review.csv`, managerReviewToCsv(rows), 'text/csv;charset=utf-8');
  setText('reviewExportStatus', `Exported CSV for ${snapshot.page_title}.`);
  showToast(`CSV exported for ${snapshot.page_title}`, 'success');
}
function exportCurrentManagerReviewJson() {
  const snapshot = getManagerReviewSnapshot();
  managerReviewDownload(`${snapshot.page_key}-manager-review.json`, JSON.stringify(snapshot, null, 2), 'application/json;charset=utf-8');
  setText('reviewExportStatus', `Exported JSON for ${snapshot.page_title}.`);
  showToast(`JSON exported for ${snapshot.page_title}`, 'success');
}
function exportAllPageDecisionTemplateCsv() {
  const headers = ['review_date','reviewer','page_key','page_title','page_type','url_slug','decision','notes','risks_or_blockers','follow_up_owner','seo_title','meta_description','primary_cta','reading_target'];
  const rows = [headers];
  for (const [key] of pageOrder) {
    const page = pageData[key] || {};
    rows.push([
      managerReviewToday(), '', key, page.title || '', page.type || '', page.slug || '', 'Needs review', '', '', '',
      defaultSeoTitle(page), defaultMetaDescription(page), getPrimaryCta(page), page.reading || ''
    ]);
  }
  managerReviewDownload('hhvc-all-page-manager-review-template.csv', managerReviewToCsv(rows), 'text/csv;charset=utf-8');
  setText('reviewExportStatus', 'Exported all-page decision template.');
  showToast('All-page decision template exported', 'success');
}
function updateManagerReviewPageLabel() {
  const page = pageData[currentPageKey] || {};
  setText('reviewPageLabel', `Current page: ${page.title || currentPageKey}`);
}
(function attachManagerReviewTools() {
  const dateInput = document.getElementById('reviewDateInput');
  if (dateInput && !dateInput.value) dateInput.value = managerReviewToday();
  document.getElementById('exportReviewCsv')?.addEventListener('click', exportCurrentManagerReviewCsv);
  document.getElementById('exportReviewJson')?.addEventListener('click', exportCurrentManagerReviewJson);
  document.getElementById('exportAllTemplateCsv')?.addEventListener('click', exportAllPageDecisionTemplateCsv);
  const originalRenderPage = renderPage;
  renderPage = function patchedRenderPage(key) {
    originalRenderPage(key);
    updateManagerReviewPageLabel();
  };
  updateManagerReviewPageLabel();
})();
