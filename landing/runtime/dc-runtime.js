/*
 * Local runtime for Design Component pages (.dc.html) exported from the
 * "PitchIt – Landing Page" canvas on claude.ai.
 *
 * It implements the part of the format the canvas uses:
 *   - {{ path }} holes in text and attributes (dotted lookups and literals only)
 *   - <sc-if value="{{ cond }}"> and <sc-for list="{{ items }}" as="item">
 *   - JSX-style event attributes (onClick="{{ handler }}")
 *   - a `class Component extends DCLogic` logic block with React class semantics
 *
 * scripts/build.mjs moves each page's <x-dc> markup into a
 * <script type="text/x-dc-template"> so the browser never parses it as HTML
 * (the HTML parser would, for example, hoist <sc-for> out of a <tbody>).
 * React 18 does the DOM diffing, so inputs keep focus and CSS animations are
 * not restarted when state changes.
 */
(function () {
  'use strict';

  const React = window.React;
  const ReactDOM = window.ReactDOM;

  const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea']);
  const TABLE_TAGS = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'colgroup']);
  const BOOLEAN_ATTRS = new Set(['checked', 'disabled', 'selected', 'readonly', 'required', 'multiple', 'autofocus', 'hidden', 'open', 'novalidate']);
  const FORM_TAGS = new Set(['input', 'textarea', 'select']);
  const ATTR_RENAMES = {
    class: 'className', for: 'htmlFor', tabindex: 'tabIndex', readonly: 'readOnly', maxlength: 'maxLength',
    minlength: 'minLength', autocomplete: 'autoComplete', autofocus: 'autoFocus', spellcheck: 'spellCheck',
    inputmode: 'inputMode', srcset: 'srcSet', colspan: 'colSpan', rowspan: 'rowSpan', crossorigin: 'crossOrigin',
    enterkeyhint: 'enterKeyHint', 'xlink:href': 'xlinkHref'
  };
  const HOLE = /\{\{\s*([^{}]*?)\s*\}\}/g;
  const WHOLE_HOLE = /^\{\{\s*([^{}]*?)\s*\}\}$/;
  const TAG_OPEN = /<([a-zA-Z][\w:.-]*)/y;
  const ATTRIBUTE = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/y;

  // ---------------------------------------------------------------- parsing

  const entityDecoder = document.createElement('textarea');
  function decodeEntities(text) {
    if (text.indexOf('&') === -1) return text;
    entityDecoder.innerHTML = text;
    return entityDecoder.value;
  }

  /** Parses template markup into { tag, attrs: [[name, value|null]], children } / { text } nodes. */
  function parseTemplate(src) {
    const root = { tag: '#root', attrs: [], children: [] };
    const stack = [root];
    const lowerSrc = src.toLowerCase();
    const n = src.length;
    let i = 0;
    const top = () => stack[stack.length - 1];
    const pushText = (text) => { if (text) top().children.push({ text: decodeEntities(text) }); };

    while (i < n) {
      const lt = src.indexOf('<', i);
      if (lt === -1) { pushText(src.slice(i)); break; }
      if (lt > i) pushText(src.slice(i, lt));

      if (src.startsWith('<!--', lt)) {
        const end = src.indexOf('-->', lt + 4);
        i = end === -1 ? n : end + 3;
        continue;
      }

      if (src[lt + 1] === '/') {
        const gt = src.indexOf('>', lt);
        if (gt === -1) { pushText(src.slice(lt)); break; }
        const name = src.slice(lt + 2, gt).trim().toLowerCase();
        for (let s = stack.length - 1; s > 0; s--) {
          if (stack[s].tag.toLowerCase() === name) { stack.length = s; break; }
        }
        i = gt + 1;
        continue;
      }

      TAG_OPEN.lastIndex = lt;
      const open = TAG_OPEN.exec(src);
      if (!open) { pushText('<'); i = lt + 1; continue; }

      const node = { tag: open[1], attrs: [], children: [] };
      let j = TAG_OPEN.lastIndex;
      let selfClosing = false;
      while (j < n) {
        while (j < n && /\s/.test(src[j])) j++;
        if (src[j] === '>') { j++; break; }
        if (src[j] === '/' && src[j + 1] === '>') { selfClosing = true; j += 2; break; }
        ATTRIBUTE.lastIndex = j;
        const a = ATTRIBUTE.exec(src);
        if (!a) { j++; continue; }
        const value = a[2] !== undefined ? a[2] : a[3] !== undefined ? a[3] : a[4] !== undefined ? a[4] : null;
        node.attrs.push([a[1], value === null ? null : decodeEntities(value)]);
        j = ATTRIBUTE.lastIndex;
      }
      top().children.push(node);

      const lower = node.tag.toLowerCase();
      if (selfClosing || VOID_TAGS.has(lower)) { i = j; continue; }
      if (RAW_TEXT_TAGS.has(lower)) {
        const close = lowerSrc.indexOf('</' + lower, j);
        const end = close === -1 ? n : close;
        const raw = src.slice(j, end);
        if (raw) node.children.push({ text: lower === 'textarea' ? decodeEntities(raw) : raw });
        const gt = close === -1 ? -1 : src.indexOf('>', close);
        i = gt === -1 ? n : gt + 1;
        continue;
      }
      stack.push(node);
      i = j;
    }
    return root;
  }

  // -------------------------------------------------------------- rendering

  function lookup(expr, scope) {
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'null') return null;
    if (expr === '' || expr === 'undefined') return undefined;
    if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);
    if (/^(['"]).*\1$/.test(expr)) return expr.slice(1, -1);
    const parts = expr.split('.');
    let value = scope[parts[0]];
    for (let k = 1; k < parts.length && value != null; k++) value = value[parts[k]];
    return value;
  }

  function toText(value) {
    return value == null || typeof value === 'boolean' || typeof value === 'object' || typeof value === 'function' ? '' : String(value);
  }

  function interpolate(text, scope) {
    return text.replace(HOLE, (_, expr) => toText(lookup(expr, scope)));
  }

  /** A whole-value hole yields the raw value (number, function, …); anything else a string. */
  function evalAttr(raw, scope) {
    const whole = WHOLE_HOLE.exec(raw);
    if (whole) return lookup(whole[1], scope);
    return raw.indexOf('{{') === -1 ? raw : interpolate(raw, scope);
  }

  function getAttr(node, name) {
    const pair = node.attrs.find((a) => a[0].toLowerCase() === name);
    return pair ? pair[1] : null;
  }

  const camel = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

  function propName(name) {
    const lower = name.toLowerCase();
    if (ATTR_RENAMES[lower]) return ATTR_RENAMES[lower];
    if (/^on[A-Z]/.test(name)) return name;
    if (lower.startsWith('aria-') || lower.startsWith('data-')) return lower;
    if (name.indexOf('-') !== -1) return camel(name); // SVG presentation attributes
    return name;
  }

  /** Inline CSS string to a React style object; custom properties are kept as-is. */
  function styleObject(css) {
    const out = {};
    if (!css) return out;
    const decls = [];
    let depth = 0, quote = null, start = 0;
    for (let k = 0; k < css.length; k++) {
      const c = css[k];
      if (quote) { if (c === quote) quote = null; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (c === ';' && depth === 0) { decls.push(css.slice(start, k)); start = k + 1; }
    }
    decls.push(css.slice(start));
    for (const decl of decls) {
      const colon = decl.indexOf(':');
      if (colon === -1) continue;
      let prop = decl.slice(0, colon).trim();
      const value = decl.slice(colon + 1).trim();
      if (!prop || !value) continue;
      if (prop.startsWith('--')) { out[prop] = value; continue; }
      prop = prop.toLowerCase();
      if (prop.startsWith('-ms-')) prop = prop.slice(1);
      out[camel(prop)] = value; // -webkit-x becomes WebkitX
    }
    return out;
  }

  function renderChildren(children, scope, parentTag, keyPrefix) {
    const out = [];
    children.forEach((child, index) => {
      const rendered = renderNode(child, scope, parentTag, keyPrefix + '.' + index);
      if (rendered == null) return;
      if (Array.isArray(rendered)) out.push(...rendered);
      else out.push(rendered);
    });
    return out;
  }

  function renderNode(node, scope, parentTag, key) {
    if (node.text !== undefined) {
      if (TABLE_TAGS.has(parentTag) && !node.text.trim()) return null;
      return node.text.indexOf('{{') === -1 ? node.text : interpolate(node.text, scope);
    }

    const tag = node.tag;
    const lower = tag.toLowerCase();

    if (lower === 'sc-if') {
      const cond = evalAttr(getAttr(node, 'value') || '', scope);
      return cond ? renderChildren(node.children, scope, parentTag, key) : null;
    }
    if (lower === 'sc-for') {
      const list = evalAttr(getAttr(node, 'list') || '', scope);
      if (!Array.isArray(list)) return null;
      const as = getAttr(node, 'as') || 'item';
      const out = [];
      list.forEach((item, index) => {
        const inner = Object.create(scope);
        inner[as] = item;
        inner.$index = index;
        out.push(...renderChildren(node.children, inner, parentTag, key + '#' + index));
      });
      return out;
    }
    if (lower === 'helmet') return null; // moved into <head> by the build

    const props = { key };
    for (const [name, raw] of node.attrs) {
      if (name.toLowerCase().startsWith('hint-')) continue;
      const bound = raw !== null && raw.indexOf('{{') !== -1;
      let value = raw === null ? true : evalAttr(raw, scope);
      let prop = propName(name);

      if (/^on[A-Z]/.test(prop)) {
        if (typeof value === 'function') props[prop] = value;
        continue;
      }
      if (prop === 'style') {
        props.style = value && typeof value === 'object' ? value : styleObject(toText(value));
        continue;
      }
      if (BOOLEAN_ATTRS.has(name.toLowerCase())) value = bound ? Boolean(value) : true;
      if (!bound && FORM_TAGS.has(lower)) {
        // A literal value/checked is an initial value, not a controlled one.
        if (prop === 'value') prop = 'defaultValue';
        else if (prop === 'checked') prop = 'defaultChecked';
      }
      if (value == null) continue;
      props[prop] = value;
    }

    if (VOID_TAGS.has(lower)) return React.createElement(tag, props);
    if (lower === 'textarea') {
      const initial = node.children.map((c) => c.text || '').join('');
      if (initial && props.value === undefined && props.defaultValue === undefined) props.defaultValue = initial;
      return React.createElement(tag, props);
    }
    if (lower === 'style' || lower === 'script') {
      const raw = node.children.map((c) => c.text || '').join('');
      return React.createElement(tag, { ...props, dangerouslySetInnerHTML: { __html: raw } });
    }
    const children = renderChildren(node.children, scope, lower, key);
    return React.createElement(tag, props, children.length ? children : undefined);
  }

  // ---------------------------------------------------------------- mounting

  function makeDCLogic(tree) {
    return class DCLogic extends React.Component {
      renderVals() { return {}; }
      render() {
        return React.createElement(React.Fragment, null, renderChildren(tree.children, this.renderVals() || {}, '#root', 'r'));
      }
    };
  }

  function defaultProps(json) {
    if (!json) return {};
    let spec;
    try { spec = JSON.parse(json); } catch (error) {
      console.warn('[dc-runtime] data-props is not valid JSON', error);
      return {};
    }
    const out = {};
    for (const key of Object.keys(spec)) {
      if (key[0] !== '$' && spec[key] && typeof spec[key] === 'object' && 'default' in spec[key]) out[key] = spec[key].default;
    }
    return out;
  }

  /** The page root paints its own background; extend it to the whole viewport. */
  function syncPageBackground(mount) {
    const first = mount.firstElementChild;
    if (!first) return;
    const color = getComputedStyle(first).backgroundColor;
    if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') document.documentElement.style.backgroundColor = color;
  }

  /** Content renders after load, so the browser's own jump to #hash has nothing to land on. */
  function scrollToHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const target = document.getElementById(id);
    if (target) target.scrollIntoView();
  }

  function errorPanel(message) {
    return React.createElement('div', {
      role: 'alert',
      style: { margin: '24px', padding: '20px', borderRadius: '12px', background: '#3A1F1A', color: '#FFD7CC', font: '15px/1.5 system-ui, sans-serif' }
    }, 'Stránku sa nepodarilo vykresliť: ' + message);
  }

  function makeShell(mount) {
    return class Shell extends React.Component {
      constructor(props) { super(props); this.state = { error: null }; }
      static getDerivedStateFromError(error) { return { error }; }
      componentDidCatch(error) { console.error('[dc-runtime] render failed', error); }
      componentDidMount() { syncPageBackground(mount); scrollToHash(); }
      render() { return this.state.error ? errorPanel(String(this.state.error.message || this.state.error)) : this.props.children; }
    };
  }

  function boot() {
    const mount = document.querySelector('[data-dc-root]');
    const templateEl = document.querySelector('script[type="text/x-dc-template"]');
    if (!mount || !templateEl) throw new Error('chýba šablóna stránky (spusti npm run build)');
    if (!React || !ReactDOM) throw new Error('React sa nenačítal');

    const tree = parseTemplate(templateEl.textContent);
    const DCLogic = makeDCLogic(tree);
    const logicEl = document.querySelector('script[data-dc-script]');
    let Component = DCLogic;
    let props = {};
    if (logicEl) {
      props = defaultProps(logicEl.getAttribute('data-props'));
      // The logic block is classic JS that declares `class Component extends DCLogic`.
      const factory = new Function('DCLogic', 'React', logicEl.textContent + '\n;return typeof Component === "function" ? Component : null;');
      Component = factory(DCLogic, React) || DCLogic;
    }
    const Shell = makeShell(mount);
    ReactDOM.createRoot(mount).render(React.createElement(Shell, null, React.createElement(Component, props)));
  }

  try {
    boot();
  } catch (error) {
    console.error('[dc-runtime]', error);
    const mount = document.querySelector('[data-dc-root]') || document.body;
    mount.textContent = 'Stránku sa nepodarilo vykresliť: ' + error.message;
  }
})();
