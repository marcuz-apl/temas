/**
 * TEMAS 2 — Documentation Portal Application Logic (2-Column Architecture)
 */

class TemasDocsApp {
  constructor() {
    this.articles = [];
    this.currentArticleId = null;
    this.initElements();
    this.initTheme();
    this.bindEvents();
    this.loadCatalog();
  }

  initElements() {
    this.sidebarNav = document.getElementById('sidebarNav');
    this.sidebarFilterInput = document.getElementById('sidebarFilterInput');
    this.docsSearchInput = document.getElementById('docsSearchInput');
    this.docContent = document.getElementById('docContent');
    this.docsBreadcrumbs = document.getElementById('docsBreadcrumbs');
    this.bcCategory = document.getElementById('bcCategory');
    this.bcTitle = document.getElementById('bcTitle');
    this.articleTitle = document.getElementById('articleTitle');
    this.articleDesc = document.getElementById('articleDesc');
    this.articleBadge = document.getElementById('articleBadge');
    this.articleReadTime = document.getElementById('articleReadTime');
    this.btnPrevArticle = document.getElementById('btnPrevArticle');
    this.btnNextArticle = document.getElementById('btnNextArticle');
    this.prevArticleTitle = document.getElementById('prevArticleTitle');
    this.nextArticleTitle = document.getElementById('nextArticleTitle');
    this.btnBackToTop = document.getElementById('btnBackToTop');
    this.btnMobileSidebarToggle = document.getElementById('btnMobileSidebarToggle');
    this.docsSidebar = document.getElementById('docsSidebar');
    this.sidebarBackdrop = document.getElementById('sidebarBackdrop');
  }

  bindEvents() {
    // URL hash navigation
    window.addEventListener('hashchange', () => {
      const hashId = window.location.hash.replace('#', '');
      if (hashId && hashId !== this.currentArticleId) {
        this.selectArticle(hashId, false);
      }
    });

    // Sidebar filter
    if (this.sidebarFilterInput) {
      this.sidebarFilterInput.addEventListener('input', (e) => {
        this.filterSidebarLinks(e.target.value);
      });
    }

    // Top global search bar
    if (this.docsSearchInput) {
      this.docsSearchInput.addEventListener('input', (e) => {
        if (this.sidebarFilterInput) {
          this.sidebarFilterInput.value = e.target.value;
          this.filterSidebarLinks(e.target.value);
        }
      });
    }

    // Global keyboard shortcut: Ctrl+K or Cmd+K
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (this.docsSearchInput && window.innerWidth > 960) {
          this.docsSearchInput.focus();
        } else if (this.sidebarFilterInput) {
          this.openMobileSidebar();
          this.sidebarFilterInput.focus();
        }
      }
    });

    // Mobile sidebar toggle
    if (this.btnMobileSidebarToggle) {
      this.btnMobileSidebarToggle.addEventListener('click', () => {
        this.toggleMobileSidebar();
      });
    }

    if (this.sidebarBackdrop) {
      this.sidebarBackdrop.addEventListener('click', () => {
        this.closeMobileSidebar();
      });
    }

    // Bottom Prev / Next Article buttons
    if (this.btnPrevArticle) {
      this.btnPrevArticle.addEventListener('click', () => {
        const idx = this.articles.findIndex((a) => a.id === this.currentArticleId);
        if (idx > 0) {
          this.selectArticle(this.articles[idx - 1].id);
        }
      });
    }

    if (this.btnNextArticle) {
      this.btnNextArticle.addEventListener('click', () => {
        const idx = this.articles.findIndex((a) => a.id === this.currentArticleId);
        if (idx !== -1 && idx < this.articles.length - 1) {
          this.selectArticle(this.articles[idx + 1].id);
        }
      });
    }

    // Back-to-Top Button
    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
        this.btnBackToTop.classList.add('visible');
      } else {
        this.btnBackToTop.classList.remove('visible');
      }
    });

    if (this.btnBackToTop) {
      this.btnBackToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  async loadCatalog() {
    try {
      const res = await fetch('/api/docs/articles');
      if (!res.ok) throw new Error(`Failed to load catalog: ${res.status}`);
      const data = await res.json();
      this.articles = data.articles || [];
      this.renderSidebar();

      // Initial article selection based on URL hash or default to first
      const hashId = window.location.hash.replace('#', '');
      const initialArticle = this.articles.find((a) => a.id === hashId) || this.articles[0];
      if (initialArticle) {
        this.selectArticle(initialArticle.id, false);
      }
    } catch (err) {
      console.error('Error loading docs catalog:', err);
      if (this.docContent) {
        this.docContent.innerHTML = `<div class="alert-callout alert-warning"><div class="alert-title">Connection Error</div>Failed to load documentation catalog. Please ensure the backend server is active.</div>`;
      }
    }
  }

  renderSidebar() {
    if (!this.sidebarNav) return;

    // Group articles by category
    const categories = {};
    this.articles.forEach((art) => {
      const cat = art.category || 'General Documentation';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(art);
    });

    let html = '';
    for (const [catName, items] of Object.entries(categories)) {
      html += `
        <div class="sidebar-group">
          <div class="sidebar-group-title">
            <span>${catName}</span>
            <span class="sidebar-group-count">${items.length}</span>
          </div>
          <ul class="sidebar-links">
            ${items
              .map(
                (item) => `
              <li class="sidebar-link-item" data-id="${item.id}">
                <a href="#${item.id}" data-id="${item.id}">
                  <span>${item.title}</span>
                  ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
                </a>
              </li>
            `
              )
              .join('')}
          </ul>
        </div>
      `;
    }

    this.sidebarNav.innerHTML = html;

    // Add click listeners to sidebar links
    this.sidebarNav.querySelectorAll('.sidebar-link-item a').forEach((link) => {
      link.addEventListener('click', (e) => {
        const id = link.getAttribute('data-id');
        if (id) {
          this.selectArticle(id);
          this.closeMobileSidebar();
        }
      });
    });
  }

  filterSidebarLinks(query) {
    const q = (query || '').toLowerCase().trim();
    const items = this.sidebarNav.querySelectorAll('.sidebar-link-item');
    const groups = this.sidebarNav.querySelectorAll('.sidebar-group');

    items.forEach((li) => {
      const text = li.textContent.toLowerCase();
      const match = !q || text.includes(q);
      li.style.display = match ? 'block' : 'none';
    });

    groups.forEach((group) => {
      const visibleLinks = group.querySelectorAll('.sidebar-link-item:not([style*="display: none"])');
      group.style.display = visibleLinks.length > 0 ? 'block' : 'none';
    });
  }

  async selectArticle(articleId, updateHash = true) {
    const article = this.articles.find((a) => a.id === articleId);
    if (!article) return;

    this.currentArticleId = articleId;

    if (updateHash) {
      window.location.hash = articleId;
    }

    // Update active highlight in sidebar
    this.sidebarNav.querySelectorAll('.sidebar-link-item').forEach((li) => {
      if (li.getAttribute('data-id') === articleId) {
        li.classList.add('active');
        li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        li.classList.remove('active');
      }
    });

    // Update header meta card
    if (this.bcCategory) this.bcCategory.textContent = article.category || 'Documentation';
    if (this.bcTitle) this.bcTitle.textContent = article.title;
    if (this.articleTitle) this.articleTitle.textContent = article.title;
    if (this.articleDesc) this.articleDesc.textContent = article.description || '';
    if (this.articleBadge) this.articleBadge.textContent = article.badge || 'DOC';

    // Show loading state
    if (this.docContent) {
      this.docContent.innerHTML = `
        <div class="doc-loading">
          <div class="pulse-loader"></div>
          <span>Loading technical document...</span>
        </div>
      `;
    }

    // Scroll to top of main canvas
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Fetch markdown content
    try {
      const res = await fetch(`/api/docs/article/${articleId}`);
      if (!res.ok) throw new Error(`Article not found: ${res.status}`);
      const data = await res.json();
      const rawMarkdown = data.markdown || '';

      // Calculate estimated reading time (~200 words per minute)
      const wordCount = rawMarkdown.trim().split(/\s+/).length;
      const readMin = Math.max(1, Math.round(wordCount / 200));
      if (this.articleReadTime) this.articleReadTime.textContent = `⏱ ${readMin} min read (${wordCount.toLocaleString()} words)`;

      this.renderMarkdown(rawMarkdown);
      this.updateFooterNav();
    } catch (err) {
      console.error('Error fetching article content:', err);
      if (this.docContent) {
        this.docContent.innerHTML = `
          <div class="alert-callout alert-warning">
            <div class="alert-title">Document Load Error</div>
            Could not load <code>${article.file || articleId}</code>. Please verify the document exists on disk.
          </div>
        `;
      }
    }
  }

  renderMarkdown(markdownText) {
    if (!this.docContent) return;

    if (typeof window.marked === 'undefined') {
      this.docContent.innerHTML = `<pre>${markdownText}</pre>`;
      return;
    }

    // Configure marked options
    window.marked.setOptions({
      gfm: true,
      breaks: true
    });

    // Parse markdown into HTML
    let renderedHtml = window.marked.parse(markdownText);

    // Transform GitHub-style Alert Callouts: > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING]
    renderedHtml = renderedHtml.replace(
      /<blockquote>\s*<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING)\]([\s\S]*?)<\/p>\s*<\/blockquote>/gi,
      (match, type, content) => {
        const lower = type.toLowerCase();
        const icons = {
          note: 'ℹ️ NOTE',
          tip: '💡 TIP',
          important: '⚠️ IMPORTANT',
          warning: '🚨 WARNING'
        };
        return `
          <div class="alert-callout alert-${lower}">
            <div class="alert-title">${icons[lower] || type}</div>
            <p>${content.trim()}</p>
          </div>
        `;
      }
    );

    this.docContent.innerHTML = renderedHtml;

    // Enhance Code Blocks with Language Badge & Copy Button
    this.enhanceCodeBlocks();
  }

  enhanceCodeBlocks() {
    const preBlocks = this.docContent.querySelectorAll('pre');
    preBlocks.forEach((pre) => {
      const code = pre.querySelector('code');
      const codeText = code ? code.innerText : pre.innerText;

      // Detect language from class (e.g. language-python, language-json)
      let lang = 'CODE';
      if (code && code.className) {
        const match = code.className.match(/language-([a-zA-Z0-9_-]+)/);
        if (match) lang = match[1];
      }

      // Create code block wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';

      const header = document.createElement('div');
      header.className = 'code-header';
      header.innerHTML = `
        <span class="code-lang-tag">${lang}</span>
        <button class="btn-copy-code" title="Copy code snippet">Copy</button>
      `;

      const copyBtn = header.querySelector('.btn-copy-code');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(codeText).then(() => {
          copyBtn.textContent = 'Copied!';
          copyBtn.style.color = '#10b981';
          setTimeout(() => {
            copyBtn.textContent = 'Copy';
            copyBtn.style.color = '';
          }, 2000);
        });
      });

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);
    });
  }

  updateFooterNav() {
    const idx = this.articles.findIndex((a) => a.id === this.currentArticleId);

    // Prev Button
    if (idx > 0) {
      const prev = this.articles[idx - 1];
      this.btnPrevArticle.disabled = false;
      this.prevArticleTitle.textContent = prev.title;
    } else {
      this.btnPrevArticle.disabled = true;
      this.prevArticleTitle.textContent = 'None';
    }

    // Next Button
    if (idx !== -1 && idx < this.articles.length - 1) {
      const next = this.articles[idx + 1];
      this.btnNextArticle.disabled = false;
      this.nextArticleTitle.textContent = next.title;
    } else {
      this.btnNextArticle.disabled = true;
      this.nextArticleTitle.textContent = 'None';
    }
  }

  toggleMobileSidebar() {
    if (this.docsSidebar) {
      this.docsSidebar.classList.toggle('open');
      if (this.sidebarBackdrop) {
        this.sidebarBackdrop.classList.toggle('active');
      }
    }
  }

  openMobileSidebar() {
    if (this.docsSidebar) {
      this.docsSidebar.classList.add('open');
      if (this.sidebarBackdrop) {
        this.sidebarBackdrop.classList.add('active');
      }
    }
  }

  closeMobileSidebar() {
    if (this.docsSidebar) {
      this.docsSidebar.classList.remove('open');
      if (this.sidebarBackdrop) {
        this.sidebarBackdrop.classList.remove('active');
      }
    }
  }

  initTheme() {
    const SUN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="theme-icon"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
    const MOON_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="theme-icon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

    const applyTheme = (theme) => {
      const isLight = theme === 'light';
      if (isLight) {
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      try { localStorage.setItem('temas_theme', theme); } catch (e) {}

      const icon = isLight ? MOON_ICON : SUN_ICON;
      const title = isLight ? 'Current: Light • Switch to Dark Observatory Theme' : 'Current: Dark • Switch to Light Daylight Theme';

      document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
        btn.innerHTML = icon;
        btn.title = title;
      });
    };

    const toggleTheme = () => {
      const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      applyTheme(current === 'light' ? 'dark' : 'light');
    };

    const initialTheme = localStorage.getItem('temas_theme') || 'dark';
    applyTheme(initialTheme);

    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.addEventListener('click', toggleTheme);
    });
  }
}

// Instantiate Docs app upon DOM readiness
document.addEventListener('DOMContentLoaded', () => {
  window.temasDocsApp = new TemasDocsApp();
});
