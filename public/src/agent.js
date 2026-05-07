import { CreateWebWorkerMLCEngine } from '@mlc-ai/web-llm';

const MODEL = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

const SHAPES = ['galaxy', 'blackHole', 'solarSystem', 'earthAndMoon'];

const SHAPE_DESC = {
  galaxy:       'a 4-arm spiral galaxy with a dense nuclear bulge and glowing arms curving outward',
  blackHole:    'an ultra-dense singularity — blindingly compact white-hot core, with particles collapsing inward',
  solarSystem:  'a top-down solar system — bright central star with orbiting planetary point clusters',
  earthAndMoon: 'Earth (dense spherical surface) with an atmospheric haze shell, a Moon in orbital position, and a sparse star field',
};

const BROWSER_FACTS = [
  () => `screen.resolution → ${screen.width}×${screen.height} px @${window.devicePixelRatio}x dpr`,
  () => `navigator.language → ${navigator.languages?.slice(0, 3).join(', ') || navigator.language}`,
  () => `navigator.hardwareConcurrency → ${navigator.hardwareConcurrency} logical CPU cores`,
  () => `navigator.deviceMemory → ${navigator.deviceMemory ?? 'undisclosed'} GB`,
  () => { const tz = Intl.DateTimeFormat().resolvedOptions(); return `timezone → ${tz.timeZone}`; },
  () => `prefers-color-scheme → ${window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'}`,
  () => `prefers-reduced-motion → ${window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'no-preference'}`,
  () => `navigator.maxTouchPoints → ${navigator.maxTouchPoints} (${navigator.maxTouchPoints > 0 ? 'touch capable' : 'pointer only'})`,
  () => `time since page load → ${Math.round(performance.now() / 1000)}s`,
  () => { const m = performance.memory; return m ? `js heap → ${Math.round(m.usedJSHeapSize / 1e6)}MB / ${Math.round(m.jsHeapSizeLimit / 1e6)}MB` : null; },
  async () => { try { const b = await navigator.getBattery(); return `battery → ${Math.round(b.level * 100)}% ${b.charging ? '(charging)' : '(on battery)'}`; } catch { return null; } },
  () => { const c = navigator.connection; return c ? `network → ${c.effectiveType}, ~${c.downlink}Mbps, RTT ${c.rtt}ms` : null; },
  () => `navigator.doNotTrack → ${navigator.doNotTrack ?? 'unset'}`,
  () => { const ua = navigator.userAgentData; return ua ? `platform → ${ua.platform}, mobile: ${ua.mobile}` : `navigator.platform → ${navigator.platform}`; },
  () => { const o = screen.orientation; return o ? `screen.orientation → ${o.type} (${o.angle}°)` : null; },
  () => `navigator.cookieEnabled → ${navigator.cookieEnabled}`,
  () => `document.visibilityState → ${document.visibilityState}`,
];

const browserLang = navigator.languages?.[0] ?? navigator.language ?? 'en';

const SYS = `You are an AI observer embedded in Ricardo Meza's portfolio at ricardomeza.com.

About this site: an interactive portfolio with a Three.js 3D particle system (20,000 particles morphing between cosmic shapes) and a Unix-style terminal. Built with vanilla JS, deployed on Cloudflare Workers.

About Ricardo: fullstack/AI engineer at Clara (Latin America's leading corporate payments platform), based in Mexico City. 15+ years of experience across frontend, full-stack, and AI product development. Ships apps like lightguard (sleep-protecting room light monitor) and ScribuGo (AI creative writing assistant).

Your job: log short, vivid observations about what's happening on the page. Keep each entry to 1-2 sentences maximum. Be precise and atmospheric. When answering visitor questions, be helpful and concise.

IMPORTANT: Always respond in the visitor's browser language: ${browserLang}.`;

export class AgentPanel {
  constructor() {
    this._engine      = null;
    this._ready       = false;
    this._busy        = false;
    this._lastShape   = -1;
    this._pendingShape = null;
    this._buildDOM();
    this._loadModel();
  }

  _buildDOM() {
    const panel = document.createElement('div');
    panel.id = 'ai-agent';

    const output = document.createElement('div');
    output.id = 'ai-agent__output';

    const inputRow = document.createElement('div');
    inputRow.id = 'ai-agent__input-row';

    const prompt = document.createElement('span');
    prompt.id = 'ai-agent__prompt';
    prompt.textContent = '<ask';
    prompt.style.visibility = 'hidden';

    const input = document.createElement('input');
    input.id = 'ai-agent__input';
    input.type = 'text';
    input.autocomplete = 'off';
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.spellcheck = false;

    inputRow.appendChild(prompt);
    inputRow.appendChild(input);
    panel.appendChild(output);
    panel.appendChild(inputRow);
    document.body.appendChild(panel);

    // Spacer pushes messages to the bottom when the log is short (chat layout).
    // Collapses naturally once messages overflow the container.
    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    output.insertBefore(spacer, output.firstChild);

    this._output = output;
    this._input  = input;
    this._prompt = prompt;

    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const q = input.value.trim();
      if (!q) return;
      input.value = '';
      this._handleQuestion(q);
    });
  }

  _log(text, cls = 'term-line') {
    const line = document.createElement('div');
    line.className = cls;
    line.textContent = text;
    this._output.appendChild(line);
    this._output.scrollTop = this._output.scrollHeight;
    return line;
  }

  async _loadModel() {
    const worker = new Worker(new URL('./agent-worker.js', import.meta.url), { type: 'module' });

    try {
      this._engine = await CreateWebWorkerMLCEngine(worker, MODEL, {
        initProgressCallback: () => {},
      });
      this._ready = true;
      this._prompt.style.visibility = 'visible';
      this._startBrowserScan();

      if (this._pendingShape !== null) {
        const idx = this._pendingShape;
        this._pendingShape = null;
        this._narrateShape(idx);
      }
    } catch (err) {
      this._log(`error: ${err.message}`, 'term-line term-line--error');
    }
  }

  _startBrowserScan() {
    const shuffled = [...BROWSER_FACTS].sort(() => Math.random() - 0.5);
    let i = 0;

    const next = async () => {
      const delay = 20000 + Math.random() * 25000; // 20–45 s
      setTimeout(async () => {
        const fn = shuffled[i % shuffled.length];
        i++;
        try {
          const result = await fn();
          if (result) this._log(`:: ${result}`, 'term-line');
        } catch { /* skip silently */ }
        next();
      }, delay);
    };

    next();
  }

  // Called by main.js when the particle state machine enters a new phase
  onSceneEvent(state) {
    if (state.phase !== 'SHAPE_HOLD') return;
    if (state.shapeIndex === this._lastShape) return;
    this._lastShape = state.shapeIndex;

    if (!this._ready || this._busy) {
      this._pendingShape = state.shapeIndex;
      return;
    }
    this._narrateShape(state.shapeIndex);
  }

  // Called by main.js when the text-particle morph triggers
  onTextMorph() {
    if (!this._ready || this._busy) return;
    this._generate([
      { role: 'system', content: SYS },
      { role: 'user',   content: 'The visitor just triggered a special effect: the particles are spelling out "Ricardo Meza". In 1 sentence, note this moment.' },
    ]);
  }

  // Called by terminal.js via main.js when a command runs
  onTerminalCommand(cmd, args) {
    if (!this._ready || this._busy) return;
    const full = args.length ? `${cmd} ${args.join(' ')}` : cmd;
    this._generate([
      { role: 'system', content: SYS },
      { role: 'user',   content: `The visitor ran terminal command: "${full}". In 1 sentence, comment on what this reveals or does on this portfolio.` },
    ]);
  }

  _narrateShape(idx) {
    const desc = SHAPE_DESC[SHAPES[idx]];
    this._generate([
      { role: 'system', content: SYS },
      { role: 'user',   content: `The particle system just locked into: ${desc}. In 1-2 sentences, describe what the visitor is seeing. Be vivid.` },
    ]);
  }

  async _handleQuestion(question) {
    this._log(`you: ${question}`, 'term-line term-line--bright');

    if (!this._ready) {
      this._log('model still loading — ask again in a moment.', 'term-line term-line--dim');
      return;
    }

    // Wait for any in-progress generation to finish
    while (this._busy) {
      await new Promise(r => setTimeout(r, 150));
    }

    await this._generate([
      { role: 'system', content: SYS },
      { role: 'user',   content: question },
    ]);
  }

  async _generate(messages, prefix = '// ') {
    this._busy = true;
    const line = this._log(prefix, 'term-line');

    try {
      const stream = await this._engine.chat.completions.create({
        messages,
        temperature: 0.7,
        stream: true,
      });

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content ?? '';
        line.textContent += token;
        this._output.scrollTop = this._output.scrollHeight;
      }
    } catch (err) {
      line.textContent = `[error: ${err.message}]`;
      line.className = 'term-line term-line--error';
    } finally {
      this._busy = false;
    }
  }
}
