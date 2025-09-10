// Roleta de Prêmios - Canvas + Lead (Supabase)
// Itens fornecidos pelo usuário
const items = [
  "Flyboard",
  "10% de desconto",
  "Pedalinho",
  "Standup",
  "5% de desconto",
  "Tente novamente",
  "Perdeu a vez",
];

// Paleta derivada da cor base #00727A (consistente com style.css)
const palette = [
  "#7ec4c6", // brand-300
  "#55b2b4", // brand-400
  "#2ca0a2", // brand-500
  "#138990", // brand-600
  "#0a6f74", // brand-700
  "#08595d", // brand-800
  "#064347", // brand-900
];

// ----- Supabase Config (somente URL e ANON KEY são públicos) -----
const SUPABASE_URL = "https://sotdtklmzwwnsmkpwcxw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvdGR0a2xtend3bnNta3B3Y3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1ODkwNDMsImV4cCI6MjA3MjE2NTA0M30.rOSszL2Rhl8wXTaqdpnYPGuES7pWH27kvADL_xuJz1U";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado e refs
const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const resultEl = document.getElementById("result");
const wrapper = document.querySelector(".wheel-wrapper");
const popup = document.getElementById("popup");
const popupText = document.getElementById("popupText");
const popupClose = document.getElementById("popupClose");
// Lead modal
const leadModal = document.getElementById("leadModal");
const leadForm = document.getElementById("leadForm");
const leadName = document.getElementById("leadName");
const leadPhone = document.getElementById("leadPhone");
const leadError = document.getElementById("leadError");
const leadClose = document.getElementById("leadClose");

let deviceScale = 1;
let currentAngle = 0; // radianos, 0 = eixo +X
let spinning = false;
let currentItems = items.slice(); // ordem atual desenhada
let lastWinner = null; // evita repetir o mesmo prêmio em giros consecutivos
let retryCredit = 0; // permite novo giro sem cadastro quando cair em "Tente novamente"

// Configuração de velocidade do giro (ajuste aqui)
const SPIN_DURATION_MS = 2000; // 2s
const SPIN_TURNS = 12;         // 12 voltas

// Ajuste responsivo para nitidez em telas de alta densidade
function resizeCanvas() {
  const size = Math.min(wrapper.clientWidth, wrapper.clientHeight);
  const dpr = window.devicePixelRatio || 1;
  // manter resolução alta do canvas
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + "px";
  canvas.style.height = size + "px";
  deviceScale = dpr;
  drawWheel();
}

window.addEventListener("resize", resizeCanvas);

function drawWheel() {
  const n = currentItems.length;
  const { width, height } = canvas;
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) / 2 - 6 * deviceScale; // padding para sombra/borda

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.translate(cx, cy);
  ctx.rotate(currentAngle);

  const segAngle = (Math.PI * 2) / n;

  // Desenhar segmentos
  for (let i = 0; i < n; i++) {
    const start = i * segAngle;
    const end = start + segAngle;

    // fatia
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, start, end);
    ctx.closePath();
    ctx.fillStyle = palette[i % palette.length];
    ctx.fill();

    // separador
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2 * deviceScale;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(r * Math.cos(start), r * Math.sin(start));
    ctx.stroke();

    // texto
    const mid = start + segAngle / 2;
    ctx.save();
    ctx.rotate(mid);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const fontSize = Math.max(14, Math.floor(r * 0.06));
    ctx.font = `${fontSize}px Poppins, Arial, sans-serif`;
    ctx.fillStyle = "#ffffff";

    // sombra leve para legibilidade
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 8 * deviceScale;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    const text = currentItems[i];
    const maxTextWidth = r * 0.85;

    drawFittedText(ctx, text, maxTextWidth);

    ctx.restore();
  }

  // Anel externo
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.lineWidth = 6 * deviceScale;
  ctx.strokeStyle = "#00727A";
  ctx.stroke();

  // Miolo
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 4 * deviceScale;
  ctx.strokeStyle = "#00727A";
  ctx.stroke();

  ctx.restore();
}

// Desenha texto ajustando quebra simples se necessário
function drawFittedText(ctx, text, maxWidth) {
  // Tentativa de única linha
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, maxWidth - 10 * deviceScale, 0);
    return;
  }
  // Quebra em duas linhas aproximada
  const words = text.split(" ");
  let line1 = "";
  let line2 = "";
  for (const w of words) {
    const test = line1 ? line1 + " " + w : w;
    if (ctx.measureText(test).width <= maxWidth) {
      line1 = test;
    } else {
      line2 = line2 ? line2 + " " + w : w;
    }
  }
  const lineHeight = parseInt(ctx.font, 10) * 1.05;
  ctx.fillText(line1, maxWidth - 10 * deviceScale, -lineHeight * 0.5);
  if (line2) ctx.fillText(line2, maxWidth - 10 * deviceScale, lineHeight * 0.5);
}

// Easing
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function startSpin() {
  if (spinning) return;
  // Garantir que o popup não bloqueie o clique do próximo giro
  if (popup.getAttribute("aria-hidden") === "false") hidePopup();
  spinning = true;
  resultEl.textContent = "Girando...";

  const n = currentItems.length;
  const segAngle = (Math.PI * 2) / n;

  // destino: rotação base + voltas + offset aleatório de segmento
  const turns = SPIN_TURNS;
  let randomIndex = Math.floor(Math.random() * n);
  if (n > 1) {
    let safety = 0;
    while (currentItems[randomIndex] === lastWinner && safety < 12) {
      randomIndex = Math.floor(Math.random() * n);
      safety++;
    }
  }

  // Queremos que, ao parar, o segmento escolhido fique sob o ponteiro no topo.
  const targetSegmentCenter = randomIndex * segAngle + segAngle / 2;
  const targetAngle = (Math.PI * -0.5) - targetSegmentCenter; // alinha centro do segmento ao topo

  // Calcula delta garantindo ao menos 'turns' voltas completas
  const currentNorm = normalizeAngle(currentAngle);
  const baseDiff = normalizeAngle(targetAngle - currentNorm); // [0, 2PI)
  const delta = turns * Math.PI * 2 + baseDiff;
  const duration = SPIN_DURATION_MS; // sempre usar a duração configurada
  const startAngle = currentAngle;
  const startTime = performance.now();

  function animate(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = easeOutCubic(t);
    currentAngle = startAngle + delta * eased;
    drawWheel();
    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      // Garantir ângulo normalizado
      currentAngle = normalizeAngle(currentAngle);
      drawWheel();
      const winner = computeWinnerIndex(currentAngle, n);
      const label = currentItems[winner];
      resultEl.textContent = label;
      showPopupFor(label);
      lastWinner = label;
      spinning = false;
    }
  }
  requestAnimationFrame(animate);
}

// Clique e teclado (Enter/Espaço) para girar — com proteção de lead
canvas.addEventListener("click", attemptSpin);
canvas.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    attemptSpin();
  }
});

function normalizeAngle(a) {
  const twoPi = Math.PI * 2;
  a = a % twoPi;
  return a < 0 ? a + twoPi : a;
}

// Retorna delta positivo mínimo para chegar a target
function shortestPositiveDelta(from, to) {
  const twoPi = Math.PI * 2;
  let delta = (to - from) % twoPi;
  if (delta < 0) delta += twoPi;
  return delta;
}

// Determina índice vencedor dado o ângulo atual do disco
function computeWinnerIndex(angle, n) {
  const seg = (Math.PI * 2) / n;
  // Qual ângulo do disco está sob o ponteiro no topo? Ponteiro = -PI/2
  // O ponto do disco sob o ponteiro é o que está em -currentAngle no espaço global.
  const atPointer = normalizeAngle(-angle - Math.PI * 0.5);
  const idx = Math.floor(atPointer / seg);
  // segurança por borda
  return Math.max(0, Math.min(n - 1, idx));
}

// Boot
resizeCanvas();
// Embaralhar uma única vez a ordem dos textos (apenas para mudar a posição inicial)
currentItems = shuffle(items);
drawWheel();
resultEl.textContent = "Clique para Girar";

// ----- Popup helpers -----
function showPopupFor(label) {
  const msg = buildMessage(label);
  popupText.textContent = msg;
  popup.setAttribute("aria-hidden", "false");
  // Concede uma nova tentativa quando cair em "Tente novamente"
  if (typeof label === "string" && label.toLowerCase().includes("tente novamente")) {
    retryCredit = 1;
  }
}

function hidePopup() {
  popup.setAttribute("aria-hidden", "true");
}

function buildMessage(label) {
  // Mensagens personalizadas
  const lower = label.toLowerCase();
  if (lower.includes("perdeu a vez")) return "Não foi dessa vez!";
  if (lower.includes("tente novamente")) return "Sorte! Tente mais uma vez.";
  // Padrão para os demais
  return `Você ganhou: ${label}!`;
}

// Eventos de fechamento
popupClose.addEventListener("click", hidePopup);
popup.addEventListener("click", (e) => {
  if (e.target === popup) hidePopup();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hidePopup();
});

// Utilitário: embaralhar array copiando
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===== Lead & Supabase helpers =====
function normalizePhone(v) {
  return (v || "").replace(/[^0-9]+/g, "");
}

function showLeadModal() {
  // Limpa os campos a cada exibição (multiusuário no mesmo aparelho)
  leadError.textContent = "";
  try { leadForm.reset(); } catch (_) {}
  leadName.value = "";
  leadPhone.value = "";
  leadModal.setAttribute("aria-hidden", "false");
  // Foco no nome para agilizar o atendimento
  setTimeout(() => { try { leadName.focus(); } catch (_) {} }, 0);
}
function hideLeadModal() {
  leadModal.setAttribute("aria-hidden", "true");
}

async function registerLead(name, phone) {
  const { data, error } = await supabase.rpc("register_lead", {
    p_name: name,
    p_phone: phone,
  });
  if (error) throw error;
  // data === true -> inseriu agora; false -> já existia
  return !!data;
}

async function canSpin(phone) {
  const { data, error } = await supabase.rpc("can_spin", { p_phone: phone });
  if (error) throw error;
  return !!data; // true -> permitido; false -> já participou
}

async function ensureAllowedToSpin() {
  // Sempre solicitar os dados antes de cada giro (multiusuário no mesmo aparelho)
  return new Promise((resolve) => {
    showLeadModal();
    const onSubmit = async (ev) => {
      ev.preventDefault();
      const name = leadName.value.trim();
      const phoneRaw = leadPhone.value;
      const phone = normalizePhone(phoneRaw);
      if (!name || phone.length < 10) {
        leadError.textContent = "Preencha nome e telefone válidos";
        return;
      }
      leadError.textContent = "";
      const btn = document.getElementById("leadSubmit");
      const prevDisabled = btn.disabled;
      btn.disabled = true;
      try {
        const inserted = await registerLead(name, phone);
        if (!inserted) {
          leadError.textContent = "Você já participou.";
          btn.disabled = prevDisabled;
          return resolve(false);
        }
        hideLeadModal();
        btn.disabled = prevDisabled;
        resolve(true);
      } catch (e) {
        console.error(e);
        leadError.textContent = "Erro ao registrar. Tente novamente.";
        btn.disabled = prevDisabled;
      }
    };
    const onClose = () => {
      hideLeadModal();
      leadForm.removeEventListener("submit", onSubmit);
      leadClose.removeEventListener("click", onClose);
      resolve(false);
    };
    leadForm.addEventListener("submit", onSubmit, { once: true });
    leadClose.addEventListener("click", onClose, { once: true });
  });
}

async function attemptSpin() {
  if (spinning) return; // já está girando
  // Se o usuário tem crédito por "Tente novamente", permite girar sem novo cadastro
  if (retryCredit > 0) {
    retryCredit -= 1;
    startSpin();
    return;
  }
  const ok = await ensureAllowedToSpin();
  if (ok) startSpin();
}
