import { breakScreen } from './broken-screen.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const PROMPT = '> ';

// Pre-filled on the input line: Enter spells it in particles, and typing
// anything else replaces it (see _prefillName and the input handler).
const NAME = 'Ricardo Meza';

const USER     = 'visitor';
const HOSTNAME = window.location.hostname || 'ricardomeza.dev';
const HOME     = '/home/visitor';

const COMMAND_NAMES = [
  'about', 'apps', 'cat', 'cd', 'clear', 'cls', 'date', 'df', 'echo', 'env', 'exit',
  'file', 'free', 'hack', 'help', 'history', 'hostname', 'locale', 'ls', 'man',
  'matrix', 'neofetch', 'nproc', 'pwd', 'rm', 'sl', 'sudo', 'traceroute',
  'uname', 'uptime', 'which', 'whoami',
];

// Virtual directory tree reachable by cd
const KNOWN_DIRS = new Set(['/', '/home', '/home/visitor']);

// ─── OS detection ─────────────────────────────────────────────────────────────
// 1. userAgentData.platform  — Chrome/Edge (returns "macOS", "Windows", "Linux")
// 2. userAgent string parse  — Firefox, Safari, mobile
function detectOS() {
  if (navigator.userAgentData?.platform) return navigator.userAgentData.platform;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) {
    const m = ua.match(/Android (\d+[\.\d]*)/);
    return m ? `Android ${m[1]}` : 'Android';
  }
  if (/Mac OS X/.test(ua)) {
    const m = ua.match(/Mac OS X (\d+[._]\d+[._]?\d*)/);
    return m ? `macOS ${m[1].replace(/_/g, '.')}` : 'macOS';
  }
  if (/Windows NT/.test(ua)) {
    const m = ua.match(/Windows NT (\d+\.\d+)/);
    const map = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7', '6.0': 'Vista' };
    return `Windows ${map[m?.[1]] ?? m?.[1] ?? ''}`.trim();
  }
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown';
}

function detectEngine() {
  const ua = navigator.userAgent;
  return ua.includes('Firefox') ? 'Gecko/Firefox'
       : (ua.includes('Safari') && !ua.includes('Chrome')) ? 'WebKit/Safari'
       : 'Blink/Chromium';
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ─── Man pages ────────────────────────────────────────────────────────────────

const MAN_PAGES = {
  about:      ['about me, my work, this site', 'about [topic]',      'Without a topic, lists what you can ask about: me, work, site, contact. A few topics are hidden. Firefox-style about:topic also works.'],
  apps:       ['list available apps',          'apps',               'Lists all launchable apps with descriptions. Type the app name (or ./appname) to launch it in a new tab.'],
  cat:        ['concatenate and print files',  'cat [file]',         'Prints the contents of a file. For symlinks shows the URL; for executables shows the script body. cat @name also works.'],
  cd:         ['change directory',             'cd [dir]',           'Changes the current working directory. Knows /, /home, /home/visitor, and ~. Symlinks and executables are not directories.'],
  file:       ['determine file type',          'file [name]',        'Describes the type of a file. Apps show as "Bourne-Again shell script, ASCII text executable"; links show as "symbolic link to <url>".'],
  clear:      ['clear the terminal screen',   'clear',              'Clears all output and reprints the boot message. Alias: cls. Shortcut: Ctrl+L.'],
  cls:        ['clear the terminal screen',   'cls',                'Alias for clear.'],
  date:       ['print date and time',         'date',               'Prints the current date and time from the browser clock.'],
  df:         ['report storage usage',        'df',                 'Shows storage quota and current usage via the Storage API (async).'],
  echo:       ['display a line of text',      'echo [text]',        'Prints text to terminal output.'],
  env:        ['print environment variables', 'env',                'Shows browser environment: language, timezone, platform, and engine.'],
  exit:       ['close the terminal',          'exit',               'Attempts to close the terminal. Results may vary.'],
  free:       ['display memory usage',        'free',               'Shows JavaScript heap memory. Chrome/Edge only; other browsers show N/A.'],
  hack:       ['initiate hack sequence',      'hack',               'FOR EDUCATIONAL PURPOSES ONLY. All hacking is simulated.'],
  help:       ['list available commands',     'help',               'Shows all available commands and their descriptions.'],
  history:    ['command history',             'history',            'Lists all commands entered this session, oldest first.'],
  hostname:   ['print hostname',              'hostname',           'Prints the website hostname.'],
  locale:     ['show locale settings',        'locale',             'Prints language, timezone, and calendar settings from the browser.'],
  ls:         ['list directory contents',     'ls [-la]',           'Lists available links. -la shows long format with permissions and URLs.'],
  man:        ['show command manual',         'man [command]',      'Displays the manual page for the given command.'],
  matrix:     ['enter the matrix',            'matrix',             'There is no spoon.'],
  neofetch:   ['system info with ASCII art',  'neofetch',           'Displays browser/system info alongside ASCII art.'],
  nproc:      ['print processor count',       'nproc',              'Prints the number of logical CPU cores (navigator.hardwareConcurrency).'],
  pwd:        ['print working directory',     'pwd',                'Prints the current working directory path.'],
  sl:         ['steam locomotive',            'sl',                 'You typed sl instead of ls. You deserve what happens next.'],
  sudo:       ['execute as superuser',        'sudo [command]',     'Runs a command with superuser privileges. Or tries to.'],
  traceroute: ['trace network route',         'traceroute [host]',  'Traces the route packets take to reach a host.'],
  uname:      ['print system information',    'uname [-a]',         'Without flags: prints "Linux". With -a: full system/browser info string.'],
  uptime:     ['show session uptime',         'uptime',             'Shows how long this terminal session has been running.'],
  which:      ['locate a command',            'which [name]',       'Prints the full path of an executable. Apps resolve to /home/visitor/bin/<name>. Links and unknown names return nothing.'],
  whoami:     ['print current user',          'whoami',             'Prints the current user name.'],
};

// ─── Terminal class ───────────────────────────────────────────────────────────

export class Terminal {
  constructor({ links = [], apps = [], about = {}, onNameSubmit = null, onCommand = null, extraEnv = null } = {}) {
    this._links        = links;
    this._apps         = apps;
    this._about        = about;         // { topic: { desc, summary?, facts: [{ label, text }] } } for `about`
    this._onNameSubmit = onNameSubmit;  // called when "Ricardo Meza" is entered
    this._onCommand    = onCommand;     // called on any other command (resumes particle cycle)
    this._extraEnv     = extraEnv;      // () => ['KEY=value', …] appended to `env` output
    this._history      = [];            // most-recent first
    this._histIndex    = -1;
    this._startTime    = Date.now();
    this._busy         = false;         // lock keyboard during animations
    this._cwd          = HOME;          // virtual working directory

    this._termEl   = document.getElementById('terminal');
    this._outputEl = document.getElementById('terminal__output');
    this._promptEl = document.getElementById('terminal__prompt');
    this._typedEl  = document.getElementById('terminal__typed');
    this._relayEl  = document.getElementById('terminal__relay');

    // Set the prompt character
    this._promptEl.textContent = PROMPT;

    this._prefillName();

    this._bindEvents();
    this._printBoot();

    // Ensure relay is focused after module load
    requestAnimationFrame(() => this._relayEl.focus());
  }

  // ── DOM helpers ────────────────────────────────────────────────────────────

  _println(text = '', cls = 'term-line--output') {
    const el = document.createElement('span');
    el.className = `term-line ${cls}`;
    el.textContent = text;
    this._outputEl.appendChild(el);
    return el;
  }

  _printRaw(html, cls = 'term-line--output') {
    const el = document.createElement('div');
    el.className = `term-line ${cls}`;
    el.innerHTML = html;
    this._outputEl.appendChild(el);
    return el;
  }

  _printBlank() { return this._println(''); }

  // _printBlank's empty line collapses to zero height; this one keeps a full
  // line of space, for a separation that has to show.
  _printGap() { return this._println('\u00a0'); }

  _clearOutput() { this._outputEl.innerHTML = ''; }

  _scrollToBottom() {
    this._termEl.scrollTop = this._termEl.scrollHeight;
  }

  // ── Input buffer ───────────────────────────────────────────────────────────

  // Single source of truth for the current typed line.
  // Keeps the relay input, the visible span, and the internal buffer in sync.
  _setInput(val) {
    this._relayEl.value  = val;
    this._typedEl.textContent = val;
    this._prefilled = false;
  }

  // Puts the name on the input line as a suggestion: Enter submits it, but the
  // first edit replaces it instead of appending to it (see the input handler).
  _prefillName() {
    this._setInput(NAME);
    this._prefilled = true;
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  _bindEvents() {
    // Clicking anywhere in the terminal re-focuses the relay
    this._termEl.addEventListener('click', (e) => {
      if (e.target.tagName !== 'A') this._relayEl.focus();
    });

    // Relay input: sync typed text on every character change
    this._relayEl.addEventListener('input', (e) => {
      if (this._busy) {
        this._relayEl.value = '';
        return;
      }
      // Typing or pasting over the pre-filled name replaces it and deleting
      // clears it, so a visitor who just starts typing "about me" doesn't get
      // "Ricardo Mezaabout me". Text that already replaced the whole line
      // (select-all + type, some mobile keyboards) is kept as is.
      if (this._prefilled) {
        const val = this._relayEl.value;
        this._relayEl.value = e.inputType?.startsWith('delete') ? ''
                            : val.startsWith(NAME) ? val.slice(NAME.length)
                            : val;
        this._prefilled = false;
      }
      // The boot hints stay while the visitor types, so they can follow them;
      // once a command runs they scroll up with the rest of the output.
      this._typedEl.textContent = this._relayEl.value;
    });

    // Relay input: handle special keys
    this._relayEl.addEventListener('keydown', (e) => {
      if (this._busy) { e.preventDefault(); return; }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'l') { e.preventDefault(); this._run('clear'); }
        if (e.key === 'c') { e.preventDefault(); this._ctrlC(); }
        return;
      }

      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          this._submit();
          break;
        case 'ArrowUp':
          e.preventDefault();
          this._historyBack();
          break;
        case 'ArrowDown':
          e.preventDefault();
          this._historyForward();
          break;
        case 'Tab':
          e.preventDefault();
          this._tabComplete();
          break;
        // Backspace / printable chars handled naturally by the browser;
        // the 'input' event above syncs the display.
      }
    });

    // If relay loses focus (e.g. user clicks a link), reclaim it shortly after
    this._relayEl.addEventListener('blur', () => {
      setTimeout(() => {
        // Only reclaim if focus didn't go to a link inside the terminal
        const active = document.activeElement;
        if (!active || (active.tagName !== 'A' && active.id !== 'ai-agent__input')) {
          this._relayEl.focus();
        }
      }, 150);
    });
  }

  // ── Submission ─────────────────────────────────────────────────────────────

  _submit() {
    const raw = this._relayEl.value.trim();
    this._setInput('');

    if (raw) {
      this._history.unshift(raw);
      this._histIndex = -1;
    }

    this._println(PROMPT + raw, 'term-line--prompt');

    // Special case: "Ricardo Meza" triggers the particle name animation.
    // No command output — the visual effect speaks for itself.
    if (raw.toLowerCase() === NAME.toLowerCase()) {
      this._dismissHelper();
      if (this._onNameSubmit) this._onNameSubmit();
      // Post-morph nudge: appears ~2.5 s after Enter, once the name shape is
      // fully rendered and clearly visible (morph-in takes ~1.5 s).
      const hints = [
        this._about.me    && `<span class="term-line--bright">about me</span>`,
        this._apps.length && `<span class="term-line--bright">apps</span> to see what I've built`,
      ].filter(Boolean);
      if (hints.length) {
        setTimeout(() => {
          this._printRaw(`  — try ${hints.join(', or ')}.`, 'term-line--dim');
          this._scrollToBottom();
        }, 2500);
      }
      this._scrollToBottom();
      return;
    }

    // Any other command → tell main.js to resume the particle auto-cycle
    if (raw && this._onCommand) this._onCommand();

    if (raw) {
      const result = this._run(raw);
      if (result instanceof Promise) {
        result.then(() => this._scrollToBottom());
      }
    }

    this._scrollToBottom();
  }

  _ctrlC() {
    this._println(PROMPT + this._relayEl.value + '^C', 'term-line--dim');
    this._setInput('');
    this._scrollToBottom();
  }

  // ── History ────────────────────────────────────────────────────────────────

  _historyBack() {
    if (this._histIndex < this._history.length - 1) {
      this._histIndex++;
      this._setInput(this._history[this._histIndex]);
    }
  }

  _historyForward() {
    if (this._histIndex > 0) {
      this._histIndex--;
      this._setInput(this._history[this._histIndex]);
    } else {
      this._histIndex = -1;
      this._setInput('');
    }
  }

  // ── Tab completion ─────────────────────────────────────────────────────────

  _tabComplete() {
    const val     = this._relayEl.value;

    // `about <topic>`: an empty prefix lists only the public topics; hidden
    // ones complete once the visitor starts guessing.
    const aboutArg = val.match(/^\s*about\s+(\S*)$/);
    if (aboutArg) {
      const prefix = aboutArg[1].toLowerCase();
      const topics = this._aboutTopics({ hidden: prefix !== '' });
      this._complete(val, topics.filter(t => t.startsWith(prefix)), t => `about ${t}`);
      return;
    }

    const parts   = val.trim().split(/\s+/);
    if (parts.length !== 1 || !parts[0]) return;

    const prefix  = parts[0].replace(/^\.\//, '');
    const allNames = [...COMMAND_NAMES, ...this._apps.map(a => a.label)];
    this._complete(val, allNames.filter(c => c.startsWith(prefix)), c => c);
  }

  // One match fills the line; several are listed under a copy of the prompt.
  _complete(val, matches, toInput) {
    if (matches.length === 1) {
      this._setInput(toInput(matches[0]) + ' ');
    } else if (matches.length > 1) {
      this._println(PROMPT + val, 'term-line--prompt');
      this._println(matches.join('  '), 'term-line--dim');
      this._scrollToBottom();
    }
  }

  // ── Command dispatch ───────────────────────────────────────────────────────

  _run(raw) {
    const trimmed = raw.trim();

    // Multi-word easter egg — intercept before splitting
    if (trimmed === 'sudo rm -rf /' || trimmed === 'sudo rm -rf /*') {
      return this._cmdSudoRm();
    }

    // Strip leading ./ so "./lightguard" resolves identically to "lightguard"
    // Firefox-style "about:me" is the same as "about me"
    const bare = trimmed.replace(/^\.\//, '').replace(/^about:/, 'about ');
    const [cmd, ...args] = bare.split(/\s+/);
    const handler = this._commands[cmd];

    if (handler) {
      this.onCommand?.(cmd, args);
      return handler.call(this, args);
    }

    // Check apps before falling through to "command not found"
    const app = this._apps.find(a => a.label === cmd);
    if (app) {
      this.onCommand?.(cmd, args);
      return this._launchApp(app);
    }

    this._println(`command not found: ${cmd}`, 'term-line--error');
    this._println(`type 'help' to see available commands.`, 'term-line--dim');
  }

  // ── Boot message ───────────────────────────────────────────────────────────

  _printBoot() {
    // Track the helper lines so submitting the name can remove them: the
    // particles spell it out and a shorter nudge follows (see _submit).
    this._helpers = [...this._printHints(), this._printBlank()];
  }

  // The welcome hints, minus the one for `except` — the command that just ran
  // and printed them. Commands are highlighted rather than quoted, so visitors
  // don't type the quotes. Returns the printed lines.
  _printHints(except = null) {
    const hints = [
      this._about.me    && ['about me', 'and press enter to get to know me.'],
      this._apps.length && ['apps',     'to explore my projects.'],
      ['help', 'to see all commands.'],
    ].filter(h => h && h[0] !== except);
    return hints.map(([cmd, rest]) => this._printRaw(
      `type <span class="term-line--bright">${cmd}</span> ${rest}`,
      'term-line--dim'
    ));
  }

  _dismissHelper() {
    for (const el of this._helpers ?? []) el.remove();
    this._helpers = [];
  }

  // ── Commands map ───────────────────────────────────────────────────────────

  get _commands() {
    return {
      help:       ()     => this._cmdHelp(),
      about:      (args) => this._cmdAbout(args),
      clear:      ()     => { this._clearOutput(); this._prefillName(); this._printBoot(); },
      cls:        ()     => { this._clearOutput(); this._prefillName(); this._printBoot(); },
      apps:       ()     => this._cmdApps(),
      cat:        (args) => this._cmdCat(args),
      echo:       (args) => this._println(args.join(' ')),
      file:       (args) => this._cmdFile(args),
      which:      (args) => this._cmdWhich(args),
      whoami:     ()     => this._println(USER),
      date:       ()     => this._println(new Date().toString()),
      pwd:        ()     => this._println(this._cwd),
      cd:         (args) => this._cmdCd(args),
      ls:         (args) => this._cmdLs(args),
      hostname:   ()     => this._println(HOSTNAME),
      uname:      (args) => this._cmdUname(args),
      env:        ()     => this._cmdEnv(),
      uptime:     ()     => this._cmdUptime(),
      locale:     ()     => this._cmdLocale(),
      nproc:      ()     => this._println(String(navigator.hardwareConcurrency ?? '?')),
      free:       ()     => this._cmdFree(),
      df:         ()     => this._cmdDf(),
      history:    ()     => this._cmdHistory(),
      man:        (args) => this._cmdMan(args),
      neofetch:   ()     => this._cmdNeofetch(),
      exit:       ()     => this._cmdExit(),
      hack:       ()     => this._cmdHack(),
      sl:         ()     => this._cmdSl(),
      matrix:     ()     => this._cmdMatrix(),
      traceroute: (args) => this._cmdTraceroute(args),
      sudo:       (args) => this._cmdSudo(args),
      rm:         (args) => this._cmdRm(args),
    };
  }

  // ── Command implementations ────────────────────────────────────────────────

  _cmdHelp() {
    this._println('available commands:', 'term-line--bright');
    this._printBlank();
    const cmds = [
      ['help',           'show this message'],
      ['about [topic]',  'me, my work, this site…'],
      ['clear, cls',     'clear the terminal  (ctrl+l)'],
      ['echo [text]',    'print text'],
      ['whoami',         'current user'],
      ['date',           'current date and time'],
      ['pwd',            'print working directory'],
      ['apps',           'list launchable projects'],
      ['cat [file]',     'print file / symlink / script'],
      ['cd [dir]',       'change directory'],
      ['file [name]',    'determine file type'],
      ['ls [-la]',       'list directory contents'],
      ['which [name]',   'locate a command'],
      ['hostname',       'print hostname'],
      ['uname [-a]',     'system information'],
      ['env',            'environment variables'],
      ['uptime',         'session running time'],
      ['locale',         'language and locale settings'],
      ['nproc',          'number of logical CPUs'],
      ['free',           'memory usage'],
      ['df',             'storage quota'],
      ['history',        'command history'],
      ['man [cmd]',      'show manual page'],
      ['neofetch',       'system info + ascii art'],
      ['exit',           'close terminal'],
    ];
    for (const [cmd, desc] of cmds) {
      this._println(`  ${cmd.padEnd(18)} ${desc}`);
    }
    this._printGap();
    this._printHints('help');
  }

  // ── about ───────────────────────────────────────────────────────────────
  // Personal topics are data passed in from main.js (this._about). The rest
  // are built in here because they read the browser (you), the links
  // (contact), or are just jokes. Hidden topics stay out of the index and out
  // of empty-prefix tab completion — they're for visitors who guess.

  get _aboutBuiltins() {
    return {
      contact:    { desc: 'where to find me', run: () => this._aboutContact() },
      you:        { hidden: true, run: () => this._aboutYou() },
      life:       { hidden: true, run: () => this._aboutLife() },
      universe:   { hidden: true, run: () => this._aboutUniverse() },
      everything: { hidden: true, run: () => this._aboutEverything() },
      about:      { hidden: true, run: () => this._aboutAbout() },
      blank:      { hidden: true, run: () => this._println('(this page intentionally left blank)', 'term-line--dim') },
      config:     { hidden: true, run: () => this._aboutConfig() },
    };
  }

  // Topic names in display order: data topics first, then built-ins.
  _aboutTopics({ hidden = false } = {}) {
    const builtins = Object.entries(this._aboutBuiltins)
      .filter(([name, t]) => (hidden || !t.hidden) && !(name in this._about))
      .map(([name]) => name);
    return [...Object.keys(this._about), ...builtins];
  }

  _cmdAbout(args) {
    const topic = (args[0] ?? '').toLowerCase();
    if (!topic) return this._aboutIndex();
    const data = this._about[topic];
    if (data) return this._aboutPrint(topic, data);
    const builtin = this._aboutBuiltins[topic];
    if (builtin) return builtin.run();
    this._println(`about: no entry for ${args[0]}`, 'term-line--error');
    this._println("type 'about' to see the topics.", 'term-line--dim');
  }

  _aboutIndex() {
    this._println('about what?', 'term-line--bright');
    this._printBlank();
    for (const name of this._aboutTopics()) {
      this._printRow(name, this._about[name]?.desc ?? this._aboutBuiltins[name]?.desc ?? '');
    }
    this._printBlank();
    this._println('usage: about [topic]  ·  a few topics are hidden — guess away.', 'term-line--dim');
  }

  _aboutPrint(name, { summary, facts = [], link }) {
    this._println(`about ${name}:`, 'term-line--bright');
    this._printBlank();
    if (summary) {
      // Indented paragraph — wrapped lines keep the 2ch indent
      this._printRaw(`<div style="padding-left:2ch">${escapeHtml(summary)}</div>`);
      this._printBlank();
    }
    for (const { label, text } of facts) this._printRow(label, text);
    if (link) {
      this._printBlank();
      this._printRaw(
        `<span class="term-line--output">${escapeHtml(link.text)} </span>` +
        `<a href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">→ ${escapeHtml(link.href)}</a>`,
        'term-line--link'
      );
    }
    this._aboutMore(name);
  }

  // Footer pointing at the other public topics
  _aboutMore(current) {
    const others = this._aboutTopics().filter(n => n !== current);
    if (!others.length) return;
    this._printBlank();
    this._println(`more: ${others.map(n => `about ${n}`).join('  ·  ')}`, 'term-line--dim');
  }

  _aboutContact() {
    this._println('about contact:', 'term-line--bright');
    this._printBlank();
    for (const link of this._links) this._printRow(link.label, link.href, link.href);
    this._aboutMore('contact');
  }

  _aboutYou() {
    this._println('about you:', 'term-line--bright');
    this._printBlank();
    this._printRow('user',     USER);
    this._printRow('system',   `${detectOS()} · ${detectEngine()}`);
    this._printRow('language', navigator.language);
    this._printRow('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    this._printRow('screen',   `${screen.width}x${screen.height}`);
    this._printRow('here for', this._uptimeShort());
    this._printBlank();
    this._println('nice to meet you.', 'term-line--dim');
  }

  _aboutLife() {
    this._println('42', 'term-line--bright');
    this._println('— the answer to life, the universe and everything. (douglas adams)', 'term-line--dim');
  }

  _aboutUniverse() {
    this._println('~93 billion light-years across — the observable part, anyway.', 'term-line--bright');
    this._println("the one behind this text is 20,000 particles. close enough.", 'term-line--dim');
  }

  _aboutEverything() {
    this._println("that's a lot. let's start smaller:", 'term-line--bright');
    this._println("try 'about me'.", 'term-line--dim');
  }

  _aboutAbout() {
    this._println(`${'about: '.repeat(9)}…`);
    this._println('Uncaught RangeError: Maximum call stack size exceeded', 'term-line--error');
    for (let i = 0; i < 3; i++) this._println('    at about (about:about)', 'term-line--dim');
  }

  _aboutConfig() {
    this._println('⚠ proceed with caution', 'term-line--bright');
    this._println('changing advanced settings may void your warranty.');
    this._printBlank();
    this._println("...kidding. there's nothing to configure — it's a website.", 'term-line--dim');
    this._println("a nod to firefox's about:config — I spent 4 years localizing firefox at mozilla méxico.", 'term-line--dim');
  }

  // Label + text with a hanging indent, so wrapped text lines up under where
  // it began. With href the text becomes a link. Shared by `apps` and `about`.
  _printRow(label, text, href = null) {
    const body = href
      ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`
      : `<span class="term-line--output">${escapeHtml(text)}</span>`;
    this._printRaw(
      `<div style="padding-left:18ch;text-indent:-18ch">` +
      `  <span class="term-line--dim">▸ </span>` +
      `<span class="term-line--bright">${escapeHtml(label.padEnd(14))}</span>` +
      body +
      `</div>`,
      href ? 'term-line--link' : 'term-line--output'
    );
  }

  _cmdLs(args) {
    const long = args.some(a => a.startsWith('-') && (a.includes('l') || a.includes('a')));
    const total = this._links.length + this._apps.length;
    if (long) {
      this._println(`total ${total}`, 'term-line--dim');
      this._println('drwxr-xr-x  visitor visitor   96  ./', 'term-line--dim');
      for (const link of this._links) {
        const size = String(link.href.length).padStart(4);
        this._printRaw(
          `<span class="term-line--dim">lrwxrwxrwx  visitor visitor ${size}  </span>` +
          `<a href="${link.href}" target="_blank" rel="noopener noreferrer">${link.label}</a>` +
          `<span class="term-line--dim"> -> ${link.href}</span>`,
          'term-line--link'
        );
      }
      for (const app of this._apps) {
        const size = String(app.href.length).padStart(4);
        this._printRaw(
          `<span class="term-line--dim">-rwxr-xr-x  visitor visitor ${size}  </span>` +
          `<a href="${app.href}" target="_blank" rel="noopener noreferrer">${app.label}</a>`,
          'term-line--link'
        );
      }
    } else {
      // @ = symlink, * = executable — standard ls -F conventions
      const names = [
        ...this._links.map(l => l.label + '@'),
        ...this._apps.map(a => a.label + '*'),
      ];
      this._println(names.join('  '), 'term-line--bright');
    }
  }

  _cmdCat(args) {
    if (!args[0]) {
      this._println('usage: cat [file]', 'term-line--dim');
      this._println('# reading from stdin not supported — this is a website', 'term-line--dim');
      return;
    }
    // Strip leading @ or * and ./ — users may copy-paste ls -F output
    const name = args[0].replace(/^\.\//, '').replace(/^[@*]/, '');
    const link = this._links.find(l => l.label === name);
    if (link) {
      // Symlink: show the target URL as a clickable link
      this._printRaw(
        `<a href="${link.href}" target="_blank" rel="noopener noreferrer">${link.href}</a>`,
        'term-line--link'
      );
      return;
    }
    const app = this._apps.find(a => a.label === name);
    if (app) {
      // Executable: show a fake shell script body
      this._println('#!/bin/bash', 'term-line--dim');
      this._println(`# ${app.label} — ${app.desc}`, 'term-line--dim');
      this._printRaw(
        `exec xdg-open <a href="${app.href}" target="_blank" rel="noopener noreferrer">${app.href}</a>`,
        'term-line--link'
      );
      return;
    }
    this._println(`cat: ${args[0]}: No such file or directory`, 'term-line--error');
  }

  _launchApp(app) {
    this._busy = true;
    const BAR = '████████████████████';
    this._println(`[${app.label}] initializing...`, 'term-line--dim');
    setTimeout(() => {
      this._println(`[${app.label}] ${BAR} 100%`);
      this._scrollToBottom();
    }, 400);
    setTimeout(() => {
      this._println(`[${app.label}] spawning in new tab...`, 'term-line--dim');
      this._scrollToBottom();
    }, 900);
    setTimeout(() => {
      window.open(app.href, '_blank', 'noopener,noreferrer');
      this._busy = false;
      this._scrollToBottom();
    }, 1300);
  }

  _cmdApps() {
    if (!this._apps.length) {
      this._println('no apps configured.', 'term-line--dim');
      return;
    }
    this._println('available apps:', 'term-line--bright');
    this._printBlank();
    for (const app of this._apps) {
      this._printRow(app.label, app.desc);
      this._printRaw(
        `  ${''.padEnd(16)}<a href="${app.href}" target="_blank" rel="noopener noreferrer">→ ${app.href}</a>`,
        'term-line--link'
      );
    }
    this._printBlank();
    this._println("type the app name to launch  ·  tab to autocomplete.", 'term-line--dim');
    this._printGap();
    this._printHints('apps');
  }

  _cmdFile(args) {
    if (!args[0]) {
      this._println('usage: file [name]', 'term-line--dim');
      return;
    }
    const name = args[0].replace(/^\.\//, '').replace(/^[@*]/, '');
    const link = this._links.find(l => l.label === name);
    if (link) {
      this._println(`${name}: symbolic link to ${link.href}`);
      return;
    }
    const app = this._apps.find(a => a.label === name);
    if (app) {
      this._println(`${name}: Bourne-Again shell script, ASCII text executable`);
      return;
    }
    this._println(`${args[0]}: cannot open (No such file or directory)`, 'term-line--error');
  }

  _cmdWhich(args) {
    if (!args[0]) {
      this._println('usage: which [name]', 'term-line--dim');
      return;
    }
    const name = args[0].replace(/^\.\//, '');
    const app = this._apps.find(a => a.label === name);
    if (app) {
      this._println(`/home/visitor/bin/${name}`);
      return;
    }
    // Commands in PATH
    if (COMMAND_NAMES.includes(name)) {
      this._println(`/usr/bin/${name}`);
      return;
    }
    this._println(
      `which: no ${name} in (/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/visitor/bin)`,
      'term-line--dim'
    );
  }

  _cmdCd(args) {
    const target = args[0];

    // cd / cd ~ / cd $HOME → reset to home
    if (!target || target === '~' || target === HOME) {
      this._cwd = HOME;
      return;
    }

    // cd - → previous dir (we only keep one level of history)
    if (target === '-') {
      if (this._prevCwd) {
        [this._cwd, this._prevCwd] = [this._prevCwd, this._cwd];
        this._println(this._cwd, 'term-line--dim');
      } else {
        this._println(`cd: OLDPWD not set`, 'term-line--error');
      }
      return;
    }

    // cd .. → parent
    if (target === '..') {
      const parts = this._cwd.split('/').filter(Boolean);
      parts.pop();
      this._prevCwd = this._cwd;
      this._cwd = parts.length ? '/' + parts.join('/') : '/';
      return;
    }

    // Resolve absolute vs relative path
    const resolved = target.startsWith('/')
      ? target
      : this._cwd === '/' ? `/${target}` : `${this._cwd}/${target}`;

    // Symlink names → not a directory
    if (this._links.some(l => l.label === target || l.label === resolved)) {
      this._println(`cd: ${target}: Not a directory`, 'term-line--error');
      return;
    }

    if (KNOWN_DIRS.has(resolved)) {
      this._prevCwd = this._cwd;
      this._cwd = resolved;
    } else {
      this._println(`cd: ${target}: No such file or directory`, 'term-line--error');
    }
  }

  _cmdUname(args) {
    const os  = detectOS();
    const ua  = navigator.userAgent;
    const eng = ua.includes('Firefox') ? 'Gecko'
              : (ua.includes('Safari') && !ua.includes('Chrome')) ? 'WebKit'
              : 'Blink';
    if (args.includes('-a')) {
      this._println(`${os} ${HOSTNAME} 6.1.0-visitor #1 SMP PREEMPT_DYNAMIC ${eng} x86_64 GNU/Linux`);
    } else {
      this._println(os);
    }
  }

  _cmdEnv() {
    const tz       = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const engine   = detectEngine();
    const platform = navigator.platform || 'Unknown';
    const vars = [
      `USER=${USER}`,
      `HOME=${HOME}`,
      `SHELL=/bin/bash`,
      `LANG=${navigator.language}`,
      `TZ=${tz}`,
      `DISPLAY=:0`,
      `TERM=xterm-256color`,
      `BROWSER_ENGINE=${engine}`,
      `PLATFORM=${platform}`,
      `HOSTNAME=${HOSTNAME}`,
      `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`,
      ...(this._extraEnv?.() ?? []),
    ];
    for (const v of vars) this._println(v);
  }

  // Session age as "1h 2m", "3m 4s" or "5s"
  _uptimeShort() {
    const sec = Math.floor((Date.now() - this._startTime) / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  _cmdUptime() {
    const elapsed  = Date.now() - this._startTime;
    const totalSec = Math.floor(elapsed / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const clock = new Date().toLocaleTimeString();
    this._println(
      ` ${clock} up ${h}:${String(m).padStart(2, '0')},  1 user,  load average: 0.00, 0.00, 0.00`
    );
  }

  _cmdLocale() {
    const opts = Intl.DateTimeFormat().resolvedOptions();
    this._println(`LANG=${navigator.language}`);
    this._println(`LC_CTYPE=${navigator.language}.UTF-8`);
    this._println(`LC_MESSAGES=${navigator.language}`);
    this._println(`LC_TIME=${navigator.language}`);
    this._println(`TZ=${opts.timeZone}`);
    this._println(`CALENDAR=${opts.calendar}`);
  }

  _cmdFree() {
    this._println('              total        used        free', 'term-line--dim');
    if (performance.memory) {
      const total = Math.round(performance.memory.jsHeapSizeLimit / 1048576);
      const used  = Math.round(performance.memory.usedJSHeapSize  / 1048576);
      const free  = total - used;
      this._println(
        `Mem:  ${String(total).padStart(10)} MiB` +
        `${String(used).padStart(12)} MiB` +
        `${String(free).padStart(12)} MiB`
      );
      this._println('Swap:          0 MiB           0 MiB           0 MiB');
    } else {
      this._println('Mem:            N/A          N/A          N/A');
      this._println('# performance.memory unavailable in this browser', 'term-line--dim');
    }
  }

  async _cmdDf() {
    const placeholder = this._println('querying storage...', 'term-line--dim');
    try {
      const { quota = 0, usage = 0 } = await navigator.storage.estimate();
      const fmt = b => {
        const gb = b / 1073741824;
        return gb >= 1 ? gb.toFixed(1) + 'G' : (b / 1048576).toFixed(0) + 'M';
      };
      const pct = quota ? Math.round((usage / quota) * 100) + '%' : 'N/A';
      placeholder.remove();
      this._println('Filesystem         Size   Used  Avail  Use%  Mounted on', 'term-line--dim');
      this._println(
        `storage-quota   ${fmt(quota).padStart(6)} ${fmt(usage).padStart(6)} ` +
        `${fmt(quota - usage).padStart(6)}  ${pct.padStart(4)}  /home/visitor`
      );
    } catch {
      placeholder.remove();
      this._println('df: failed to estimate storage', 'term-line--error');
    }
  }

  _cmdHistory() {
    if (!this._history.length) {
      this._println('(no commands in history)', 'term-line--dim');
      return;
    }
    [...this._history].reverse().forEach((cmd, i) => {
      this._println(`  ${String(i + 1).padStart(4)}  ${cmd}`);
    });
  }

  _cmdMan(args) {
    const cmd  = args[0];
    if (!cmd) {
      this._println('what manual page do you want?', 'term-line--error');
      this._println('usage: man [command]', 'term-line--dim');
      return;
    }
    const page = MAN_PAGES[cmd];
    if (!page) {
      this._println(`no manual entry for ${cmd}`, 'term-line--error');
      return;
    }
    const [desc, synopsis, description] = page;
    this._printBlank();
    this._println('NAME', 'term-line--bright');
    this._println(`    ${cmd} - ${desc}`);
    this._printBlank();
    this._println('SYNOPSIS', 'term-line--bright');
    this._println(`    ${synopsis}`);
    this._printBlank();
    this._println('DESCRIPTION', 'term-line--bright');
    this._println(`    ${description}`);
    this._printBlank();
    this._println('SEE ALSO', 'term-line--bright');
    this._println('    help(1)');
    this._printBlank();
  }

  _cmdNeofetch() {
    const os     = detectOS();
    const engine = detectEngine();
    const cores     = navigator.hardwareConcurrency ?? '?';
    const res       = `${screen.width}x${screen.height}`;
    const tz        = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const uptimeStr = this._uptimeShort();

    // Block ASCII art using Unicode box-drawing characters.
    // Spacing tuned to align in fallback font (Menlo on macOS) where
    // box-drawing glyphs have slightly different widths than VT323's blocks.
    const art = [
      ' ██████╗ ███╗     ███╗',
      ' ██╔══██╗████╗  ████║',
      ' ██████╔╝██╔████╔██║',
      ' ██╔══██╗██║╚██╔╝██║',
      ' ██║   ██║██║  ╚═╝ ██║',
      ' ╚═╝   ╚═╝╚═╝       ╚═╝',
    ];

    const label = `${USER}@${HOSTNAME}`;
    const info  = [
      label,
      '─'.repeat(label.length),
      `OS:         ${os}`,
      `Host:       ${HOSTNAME}`,
      `Kernel:     WebGL 2.0`,
      `Shell:      /bin/bash`,
      `Resolution: ${res}`,
      `Engine:     ${engine}`,
      `CPU:        ${cores}-core`,
      `Uptime:     ${uptimeStr}`,
      `Lang:       ${navigator.language}`,
      `TZ:         ${tz}`,
    ];

    this._printBlank();
    for (const line of art) {
      this._println(line, 'term-line--bright');
    }
    this._printBlank();
    for (let i = 0; i < info.length; i++) {
      const cls = i === 0 ? 'term-line--bright'
                : i === 1 ? 'term-line--dim'
                : 'term-line--output';
      this._println(info[i], cls);
    }
    this._printBlank();
  }

  _cmdExit() {
    this._println('logout', 'term-line--dim');
    this._printBlank();
    this._println("there is no escape from a personal website.", 'term-line--bright');
    this._println('session will restart in 3 seconds...', 'term-line--dim');
    this._scrollToBottom();
    this._busy = true;
    setTimeout(() => {
      this._clearOutput();
      this._prefillName();
      this._printBoot();
      this._busy = false;
    }, 3000);
  }

  // ── Easter eggs ────────────────────────────────────────────────────────────

  _cmdHack() {
    this._busy = true;
    const BAR = '████████████████████';
    const steps = [
      { text: 'initializing exploit framework...',      delay:    0 },
      { text: `bypassing firewall    [${BAR}] 100%`,    delay:  700 },
      { text: `cracking encryption   [${BAR}] 100%`,    delay: 1500 },
      { text: `accessing mainframe   [${BAR}] 100%`,    delay: 2300 },
      { text: `downloading secrets   [${BAR}] 100%`,    delay: 3100 },
      { text: '──────────────────────────────────────', delay: 3900, cls: 'term-line--dim' },
      { text: 'access granted. decrypted payload:',     delay: 4100, cls: 'term-line--bright' },
      { text: '',                                        delay: 4300 },
    ];

    for (const { text, delay, cls } of steps) {
      setTimeout(() => {
        this._println(text, cls ?? 'term-line--output');
        this._scrollToBottom();
      }, delay);
    }

    setTimeout(() => {
      for (const link of this._links) {
        this._printRaw(
          `  <span class="term-line--dim">→</span> ` +
          `<a href="${link.href}" target="_blank" rel="noopener noreferrer">` +
          `${link.label}: ${link.href}</a>`,
          'term-line--link'
        );
      }
      this._printBlank();
      this._println("...that's it. nothing else here. move along.", 'term-line--dim');
      this._scrollToBottom();
      this._busy = false;
    }, 4500);
  }

  _cmdSl() {
    this._busy = true;
    const train = [
      '           ____                              ',
      '        _/ [] \\__LI_________                ',
      '    o  (   _____  __________]===≡=======    ',
      '   o  /  /    o /    o /                    ',
      '______/____(__)/______(__)/____________________',
      '  O     O          O      O          O    O  ',
    ];

    this._printBlank();
    this._println("  you typed 'sl' instead of 'ls'.", 'term-line--dim');
    this._printBlank();
    const els = train.map(line => this._println(line, 'term-line--bright'));
    this._scrollToBottom();

    setTimeout(() => {
      for (const el of els) el.remove();
      this._printBlank();
      this._scrollToBottom();
      this._busy = false;
    }, 2500);
  }

  _cmdSudoRm() {
    this._busy = true;
    const termEl = this._termEl;
    const files  = [
      '/bin/bash',
      '/usr/lib/libc.so.6',
      '/etc/passwd',
      '/etc/hosts',
      '/usr/bin/python3',
      '/var/log/syslog',
      `/home/${USER}/.bashrc`,
      '/usr/share/fonts/',
      '/dev/null',
      '/proc/cpuinfo',
      '/sys/kernel/',
    ];

    let delay = 0;
    for (const f of files) {
      setTimeout(() => {
        this._println(`rm: removing '${f}'`, 'term-line--error');
        this._scrollToBottom();
      }, delay);
      delay += 120;
    }

    setTimeout(() => {
      this._println('');
      this._println('██████████████████████████████  100%  system deleted', 'term-line--error');
      this._scrollToBottom();
    }, delay + 100);

    // After the deletion message the screen goes black for 1 s, shows a
    // broken panel for 5 s (see broken-screen.js), goes black for 3 s, reloads
    setTimeout(async () => {
      const canvas = document.createElement('canvas');
      canvas.style.cssText =
        'position:fixed;inset:0;width:100vw;height:100vh;z-index:99999;display:block;background:#000';
      document.body.appendChild(canvas);
      await new Promise(r => setTimeout(r, 1000));
      await breakScreen(canvas, 5000);
      setTimeout(() => window.location.reload(), 3000);
    }, delay + 700);
  }

  _cmdMatrix() {
    this._busy = true;
    const chars   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()[]{};:<>,.?/\\~`';
    const cols    = 42;
    const rows    = 16;
    const frameMs = 80;
    const totalMs = 4000;

    const rnd = () => chars[Math.floor(Math.random() * chars.length)];
    const row = () => Array.from({ length: cols }, rnd).join('');

    this._printBlank();
    const els = Array.from({ length: rows }, () => {
      const el = this._println(row());
      el.style.color = '#00ff41';
      return el;
    });
    this._scrollToBottom();

    const timer = setInterval(() => {
      for (const el of els) el.textContent = row();
    }, frameMs);

    setTimeout(() => {
      clearInterval(timer);
      for (const el of els) el.remove();
      this._println('wake up, visitor...', 'term-line--dim');
      this._println('the matrix has you.', 'term-line--bright');
      this._printBlank();
      this._scrollToBottom();
      this._busy = false;
    }, totalMs);
  }

  _cmdTraceroute(args) {
    const target = args[0] || HOSTNAME;
    this._busy   = true;

    const hops = [
      { host: 'your-device.local',           ms: '0.1'  },
      { host: 'router.home',                 ms: '4.2'  },
      { host: 'isp-gateway.net',             ms: '12.3' },
      { host: 'the-internet.backbone.com',   ms: '28.7' },
      { host: 'definitely-not-nsa.gov',      ms: null   },
      { host: 'cloudflare-edge.cdn.net',     ms: '63.1' },
      { host: target,                        ms: '1.0',  last: true },
    ];

    this._println(
      `traceroute to ${target}, 30 hops max, 60 byte packets`
    );

    let delay = 300;
    hops.forEach((hop, i) => {
      setTimeout(() => {
        const num  = String(i + 1).padStart(2);
        const name = hop.host.padEnd(38);
        if (!hop.ms) {
          this._println(`${num}  ${name}  * * *  (access denied)`, 'term-line--error');
        } else if (hop.last) {
          this._println(`${num}  ${name}  ${hop.ms} ms`, 'term-line--bright');
          setTimeout(() => {
            this._printBlank();
            this._println('destination reached.', 'term-line--dim');
            this._scrollToBottom();
            this._busy = false;
          }, 300);
        } else {
          this._println(`${num}  ${name}  ${hop.ms} ms`);
        }
        this._scrollToBottom();
      }, delay);
      delay += 380;
    });
  }

  _cmdRm(args) {
    const target = args.join(' ') || '';
    this._println(`rm: cannot remove ${target || 'file'}: Permission denied`, 'term-line--error');
    this._println(`try: sudo rm ${target}`.trim(), 'term-line--dim');
  }

  _cmdSudo(args) {
    if (args[0] === 'rm' && args.includes('-rf')) {
      return this._cmdSudoRm();
    }
    this._println(`[sudo] password for ${USER}: `);
    setTimeout(() => {
      this._println(
        `${USER} is not in the sudoers file. this incident will be reported.`,
        'term-line--error'
      );
      this._scrollToBottom();
    }, 900);
  }
}
