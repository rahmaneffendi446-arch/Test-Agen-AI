/**
 * donation.js — KriptoEdu Crypto Tip Jar
 * Update RAH-14: sendDonation() kini pakai ethers.js signer dari walletState
 *
 * Fitur:
 *  - Modal Tip Jar yang cantik
 *  - Pilihan nominal preset (0.001 / 0.005 / 0.01 ETH) + input custom
 *  - Kirim ETH via ethers.js (Web3Modal) atau fallback raw provider
 *  - Status transaksi real-time (pending -> confirmed / failed)
 *  - Riwayat donasi di session
 *  - Animasi konfeti saat berhasil donate 🎉
 *  - Toast notification terintegrasi dengan wallet.js
 */

// ─── CONFIG ───────────────────────────────────────────────────────────────
/** Ganti dengan alamat ETH penerima donasi kamu */
const DONATION_RECIPIENT = '0x715d4eB4a21e2e50f4F0083e3C05D1042B8FaC05';

/** Label nama penerima yang tampil di UI */
const RECIPIENT_LABEL = 'KriptoEdu Fund';

/** Preset nominal donasi dalam ETH */
const DONATION_PRESETS = [
  { label: '\u2615 Kopi',   eth: '0.001', desc: '~Rp 4rb'  },
  { label: '\ud83c\udf5c Makan', eth: '0.005', desc: '~Rp 20rb' },
  { label: '\ud83d\ude80 Super', eth: '0.01',  desc: '~Rp 40rb' },
];

// ─── STATE ────────────────────────────────────────────────────────────────
let donationHistory = [];
let selectedAmount  = DONATION_PRESETS[0].eth;
let isModalOpen     = false;

// ─── UTILS ────────────────────────────────────────────────────────────────

/** Konversi ETH ke Wei hex string (fallback jika ethers.js tidak tersedia) */
function ethToHex(eth) {
  const wei = BigInt(Math.round(parseFloat(eth) * 1e18));
  return '0x' + wei.toString(16);
}

/** Singkat alamat */
function shortAddr(addr) {
  if (!addr) return '';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

/** Format timestamp */
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

/** Cek wallet tersambung (membaca walletState dari wallet.js) */
function isWalletConnected() {
  return typeof walletState !== 'undefined' && walletState.isConnected && !!walletState.address;
}

// ─── MODAL ────────────────────────────────────────────────────────────────

function openDonationModal() {
  const modal = document.getElementById('donation-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
  isModalOpen = true;
  renderPresets();
  renderHistory();
  updateDonateButton();
}

function closeDonationModal() {
  const modal = document.getElementById('donation-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.style.overflow = '';
  isModalOpen = false;
  resetTxStatus();
}

// ─── PRESET BUTTONS ──────────────────────────────────────────────────────

function renderPresets() {
  const container = document.getElementById('donation-presets');
  if (!container) return;
  container.innerHTML = DONATION_PRESETS.map(p => `
    <button
      onclick="selectPreset('${p.eth}')"
      id="preset-${p.eth}"
      class="preset-btn flex flex-col items-center gap-1 px-4 py-3 rounded-xl border transition-all text-sm font-semibold
             ${ selectedAmount === p.eth
               ? 'bg-crypto-gold/20 border-crypto-gold text-crypto-gold'
               : 'bg-crypto-card/60 border-white/10 text-slate-300 hover:border-crypto-gold/50 hover:text-crypto-gold' }"
    >
      <span class="text-lg">${p.label}</span>
      <span class="font-black">${p.eth} ETH</span>
      <span class="text-xs opacity-70">${p.desc}</span>
    </button>
  `).join('');
}

function selectPreset(eth) {
  selectedAmount = eth;
  const customInput = document.getElementById('donation-custom');
  if (customInput) customInput.value = '';
  renderPresets();
  updateDonateButton();
}

function onCustomInput(val) {
  const parsed = parseFloat(val);
  if (!isNaN(parsed) && parsed > 0) {
    selectedAmount = parsed.toString();
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.className = btn.className
        .replace('bg-crypto-gold/20 border-crypto-gold text-crypto-gold',
                 'bg-crypto-card/60 border-white/10 text-slate-300 hover:border-crypto-gold/50 hover:text-crypto-gold');
    });
  }
  updateDonateButton();
}

// ─── DONATE BUTTON STATE ─────────────────────────────────────────────────

function updateDonateButton() {
  const btn  = document.getElementById('donate-submit-btn');
  const note = document.getElementById('donate-wallet-note');
  if (!btn) return;

  if (!isWalletConnected()) {
    btn.disabled    = true;
    btn.textContent = '\ud83d\udd17 Connect Wallet Dulu';
    btn.className   = 'w-full py-4 rounded-xl font-black text-lg bg-slate-700 text-slate-500 cursor-not-allowed transition';
    if (note) note.classList.remove('hidden');
  } else {
    btn.disabled  = false;
    btn.innerHTML = `<span>\ud83d\udc9b Kirim ${selectedAmount} ETH</span>`;
    btn.className = 'w-full py-4 rounded-xl font-black text-lg bg-gradient-to-r from-crypto-gold to-yellow-400 text-crypto-dark hover:opacity-90 transition cursor-pointer';
    if (note) note.classList.add('hidden');
  }
}

// ─── SEND TRANSACTION ────────────────────────────────────────────────────

async function sendDonation() {
  if (!isWalletConnected()) {
    if (typeof showToast === 'function') showToast('Connect wallet dulu ya! \ud83d\udd17', 'warning');
    return;
  }

  const customVal = document.getElementById('donation-custom')?.value?.trim();
  const amount    = (customVal && customVal !== '') ? customVal : selectedAmount;
  const parsedAmt = parseFloat(amount);

  if (isNaN(parsedAmt) || parsedAmt <= 0) {
    if (typeof showToast === 'function') showToast('Nominal donasi tidak valid!', 'error');
    return;
  }

  setTxStatus('pending', `Mengirim ${parsedAmt} ETH\u2026 Konfirmasi di wallet kamu \ud83d\udd17`);

  try {
    let txHash;

    // ── Path A: Ethers.js via Web3Modal (rekomendasi) ──
    if (walletState.ethersProvider && window.ethers) {
      const signer = walletState.ethersProvider.getSigner();
      const tx     = await signer.sendTransaction({
        to:    DONATION_RECIPIENT,
        value: window.ethers.utils.parseEther(parsedAmt.toString()),
      });
      txHash = tx.hash;

      setTxStatus('pending', `TX terkirim, menunggu konfirmasi blockchain\u2026 \u23f3`);
      await tx.wait(1); // Tunggu 1 blok konfirmasi

    // ── Path B: Fallback raw window.ethereum ──
    } else if (window.ethereum) {
      txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from:  walletState.address,
          to:    DONATION_RECIPIENT,
          value: ethToHex(parsedAmt.toString()),
          gas:   '0x5208',
        }],
      });

    } else {
      throw new Error('Tidak ada provider wallet yang tersedia.');
    }

    // ── Sukses ──
    const entry = { hash: txHash, amount: parsedAmt, from: walletState.address, time: Date.now() };
    donationHistory.unshift(entry);

    setTxStatus('success', txHash, parsedAmt);
    renderHistory();
    launchConfetti();
    updateDonationCounter(donationHistory.length);

    if (typeof showToast === 'function') {
      showToast(`Makasih banyak! Donasi ${parsedAmt} ETH berhasil \ud83d\udc9b`, 'success');
    }

  } catch (err) {
    // Ethers.js reject code: ACTION_REJECTED, atau MetaMask 4001
    if (err?.code === 4001 || err?.code === 'ACTION_REJECTED' || err?.action === 'sendTransaction') {
      setTxStatus('cancelled');
      if (typeof showToast === 'function') showToast('Transaksi dibatalkan. No worries! \ud83d\ude0a', 'warning');
    } else {
      const msg = err?.reason || err?.message || 'Error tidak diketahui';
      setTxStatus('failed', msg);
      if (typeof showToast === 'function') showToast('Transaksi gagal: ' + msg, 'error');
      console.error('[donation.js] sendDonation error:', err);
    }
  }
}

// ─── TX STATUS UI ─────────────────────────────────────────────────────────

function setTxStatus(status, data = '', amount = 0) {
  const box = document.getElementById('tx-status-box');
  if (!box) return;

  const configs = {
    pending: {
      cls:  'bg-yellow-500/10 border-yellow-500/30',
      html: `<div class="flex items-center gap-3">
               <svg class="animate-spin h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24">
                 <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                 <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
               </svg>
               <span class="text-yellow-300 text-sm font-semibold">${data}</span>
             </div>`,
    },
    success: {
      cls:  'bg-green-500/10 border-green-500/30',
      html: `<div class="space-y-2">
               <p class="text-green-400 font-black text-lg">\ud83c\udf89 Donasi Berhasil! ${amount} ETH</p>
               <p class="text-slate-400 text-xs font-mono break-all">TX: <a href="https://etherscan.io/tx/${data}" target="_blank" class="text-crypto-blue hover:underline">${String(data).slice(0,20)}...${String(data).slice(-8)}</a></p>
               <p class="text-slate-500 text-xs">Lihat di <a href="https://etherscan.io/tx/${data}" target="_blank" class="text-crypto-blue hover:underline">Etherscan</a> \u2197</p>
             </div>`,
    },
    failed: {
      cls:  'bg-red-500/10 border-red-500/30',
      html: `<p class="text-red-400 text-sm font-semibold">\u274c Gagal: ${data}</p>`,
    },
    cancelled: {
      cls:  'bg-slate-500/10 border-slate-500/30',
      html: `<p class="text-slate-400 text-sm">\u21a9\ufe0f Transaksi dibatalkan.</p>`,
    },
  };

  const c = configs[status];
  if (!c) return;
  box.className = `rounded-xl border p-4 mt-4 ${c.cls}`;
  box.innerHTML = c.html;
  box.classList.remove('hidden');
}

function resetTxStatus() {
  const box = document.getElementById('tx-status-box');
  if (box) { box.innerHTML = ''; box.classList.add('hidden'); }
}

// ─── DONATION HISTORY ─────────────────────────────────────────────────────

function renderHistory() {
  const list = document.getElementById('donation-history');
  if (!list) return;
  if (donationHistory.length === 0) {
    list.innerHTML = '<p class="text-slate-600 text-xs text-center py-2">Belum ada donasi hari ini. Jadilah yang pertama! \ud83c\udf1f</p>';
    return;
  }
  list.innerHTML = donationHistory.slice(0, 5).map(d => `
    <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <div class="flex items-center gap-2">
        <span class="text-lg">\ud83d\udc9b</span>
        <div>
          <p class="text-white text-xs font-semibold">${shortAddr(d.from)}</p>
          <p class="text-slate-500 text-xs">${fmtTime(d.time)}</p>
        </div>
      </div>
      <span class="text-crypto-gold text-sm font-black">+${d.amount} ETH</span>
    </div>
  `).join('');
}

// ─── COUNTER ──────────────────────────────────────────────────────────────

function updateDonationCounter(count) {
  const el = document.getElementById('donation-count');
  if (el) el.textContent = count;
}

// ─── CONFETTI \ud83c\udf89 ──────────────────────────────────────────────────────────────

function launchConfetti() {
  const colors = ['#F59E0B','#7C3AED','#1DA1F2','#10B981','#F472B6'];
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const particles = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -canvas.height,
    r: Math.random() * 6 + 3,
    d: Math.random() * 2 + 1,
    color: colors[Math.floor(Math.random() * colors.length)],
    tilt: 0, tiltAngle: 0, tiltSpeed: Math.random() * 0.1 + 0.05,
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.tiltAngle += p.tiltSpeed;
      p.y += p.d + 1;
      p.x += Math.sin(p.tiltAngle) * 2;
      p.tilt = Math.sin(p.tiltAngle) * 15;
      ctx.beginPath();
      ctx.lineWidth   = p.r;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
      ctx.stroke();
    });
    if (++frame < 180) requestAnimationFrame(draw);
    else canvas.remove();
  }
  draw();
}

// ─── INJECT MODAL HTML ────────────────────────────────────────────────────

function injectDonationModal() {
  if (document.getElementById('donation-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'donation-modal';
  modal.className = 'hidden fixed inset-0 z-[10000] items-center justify-center bg-black/70 backdrop-blur-sm px-4';
  modal.innerHTML = `
    <div class="absolute inset-0" onclick="closeDonationModal()"></div>
    <div class="relative bg-[#0F172A] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl p-8 z-10">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h3 class="text-2xl font-black">\ud83d\udc9b Tip Jar Kripto</h3>
          <p class="text-slate-400 text-sm mt-1">Dukung KriptoEdu dengan donasi ETH-mu!</p>
        </div>
        <button onclick="closeDonationModal()" class="text-slate-500 hover:text-white text-2xl leading-none transition">\u00d7</button>
      </div>
      <div class="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 mb-6 border border-white/5">
        <span class="text-2xl">\ud83c\udfe6</span>
        <div class="flex-1 min-w-0">
          <p class="text-xs text-slate-500 font-semibold uppercase tracking-wide">Penerima</p>
          <p class="text-white font-bold">${RECIPIENT_LABEL}</p>
          <p class="text-slate-500 text-xs font-mono truncate">${DONATION_RECIPIENT}</p>
        </div>
      </div>
      <p class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">Pilih Nominal</p>
      <div id="donation-presets" class="grid grid-cols-3 gap-3 mb-4"></div>
      <div class="relative mb-4">
        <input id="donation-custom" type="number" step="0.001" min="0.0001"
          placeholder="Atau ketik jumlah custom (ETH)"
          oninput="onCustomInput(this.value)"
          class="w-full bg-[#1E293B] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-crypto-gold/50 transition" />
        <span class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">ETH</span>
      </div>
      <div id="donate-wallet-note" class="mb-4 flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
        <span>\u26a0\ufe0f</span>
        <p class="text-yellow-300 text-xs">Connect wallet dulu di navbar ya sebelum donasi!</p>
      </div>
      <button id="donate-submit-btn" onclick="sendDonation()"
        class="w-full py-4 rounded-xl font-black text-lg bg-slate-700 text-slate-500 cursor-not-allowed transition">
        \ud83d\udd17 Connect Wallet Dulu
      </button>
      <div id="tx-status-box" class="hidden"></div>
      <div class="mt-6">
        <p class="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-3">\u26a1 Donasi Terbaru</p>
        <div id="donation-history"></div>
      </div>
      <p class="text-slate-600 text-xs text-center mt-5 leading-relaxed">
        Donasi bersifat sukarela dan langsung masuk ke alamat ETH penerima.<br/>
        Pastikan kamu di jaringan Ethereum Mainnet.
      </p>
    </div>
  `;
  document.body.appendChild(modal);
}

// ─── INJECT TIP JAR SECTION ──────────────────────────────────────────────

function injectTipJarSection() {
  const footer = document.querySelector('footer');
  if (!footer || document.getElementById('tip-jar-section')) return;
  const section = document.createElement('section');
  section.id = 'tip-jar-section';
  section.className = 'py-24 px-6 relative overflow-hidden';
  section.innerHTML = `
    <div class="absolute inset-0 -z-10">
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-crypto-gold/8 rounded-full blur-[120px]"></div>
    </div>
    <div class="max-w-3xl mx-auto text-center">
      <span class="inline-block mb-4 px-4 py-1 rounded-full bg-crypto-gold/20 border border-crypto-gold/40 text-crypto-gold text-sm font-semibold tracking-wide">
        \ud83d\udc9b Dukung Platform Kami
      </span>
      <h2 class="text-4xl md:text-5xl font-black mb-4">
        Suka KriptoEdu?<br/>
        <span class="bg-gradient-to-r from-crypto-gold to-yellow-300 bg-clip-text text-transparent">Kirim Tip Kripto! \u2615</span>
      </h2>
      <p class="text-slate-400 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
        Konten ini 100% gratis. Kalau kamu merasa terbantu, donasi sekecil apapun sangat berarti buat kami! Langsung masuk ke wallet, tanpa perantara. \ud83d\ude4f
      </p>
      <div class="bg-[#1E293B] rounded-3xl border border-crypto-gold/20 p-8 shadow-xl shadow-crypto-gold/5 relative">
        <div class="absolute -top-6 left-1/2 -translate-x-1/2 text-5xl">\ud83e\udeaa</div>
        <div class="flex justify-center gap-10 mb-8 pt-4">
          <div class="text-center"><p class="text-3xl font-black text-crypto-gold" id="donation-count">0</p><p class="text-slate-500 text-xs mt-1">Donatur</p></div>
          <div class="text-center"><p class="text-3xl font-black text-white">ETH</p><p class="text-slate-500 text-xs mt-1">Mata Uang</p></div>
          <div class="text-center"><p class="text-3xl font-black text-green-400">100%</p><p class="text-slate-500 text-xs mt-1">Langsung ke Wallet</p></div>
        </div>
        <div class="flex flex-wrap justify-center gap-3 mb-6">
          ${DONATION_PRESETS.map(p => `
            <button onclick="selectPreset('${p.eth}'); openDonationModal();"
              class="flex items-center gap-2 bg-crypto-dark hover:bg-crypto-gold/10 border border-white/10 hover:border-crypto-gold/40 text-white hover:text-crypto-gold text-sm font-semibold px-5 py-2.5 rounded-full transition-all">
              ${p.label} <span class="text-crypto-gold font-black">${p.eth} ETH</span>
            </button>
          `).join('')}
        </div>
        <button onclick="openDonationModal()"
          class="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-gradient-to-r from-crypto-gold to-yellow-400 text-crypto-dark font-black text-lg px-10 py-4 rounded-full hover:opacity-90 transition shadow-lg shadow-crypto-gold/20">
          <span>\ud83d\udc9b</span><span>Buka Tip Jar</span><span>\u2192</span>
        </button>
        <p class="text-slate-600 text-xs mt-5">Butuh wallet (MetaMask / WalletConnect / dll) \u00b7 Ethereum Mainnet \u00b7 Gas fee berlaku</p>
      </div>
    </div>
  `;
  footer.parentNode.insertBefore(section, footer);
}

// ─── WATCH WALLET STATE ───────────────────────────────────────────────────

function watchWalletState() {
  setInterval(() => { if (isModalOpen) updateDonateButton(); }, 800);
}

// ─── INIT ─────────────────────────────────────────────────────────────────

function initDonation() {
  injectDonationModal();
  injectTipJarSection();
  watchWalletState();
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isModalOpen) closeDonationModal();
  });
  renderHistory();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDonation);
} else {
  initDonation();
}
