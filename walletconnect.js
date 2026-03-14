/**
 * walletconnect.js — KriptoEdu WalletConnect Integration
 * Bug fixes (RAH-13):
 *
 *  FIX 1: Mobile browser — tampilkan deep links wallet apps, BUKAN QR code
 *          (tidak mungkin scan layar sendiri di HP)
 *  FIX 2: Provider instantiation yang lebih robust untuk mobile
 *  FIX 3: Fallback CDN jika jsdelivr gagal load
 *  FIX 4: Error message yang lebih informatif di mobile context
 *  FIX 5: Picker modal mobile-aware — reorder + highlight opsi yang relevan
 */

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const WC_INFURA_ID  = 'YOUR_INFURA_PROJECT_ID'; // Ganti dengan Infura ID kamu (infura.io)
const WC_CHAIN_ID   = 1; // Ethereum Mainnet
const WC_BRIDGE_URL = 'https://bridge.walletconnect.org';

/** Public RPC fallback — dipakai jika Infura ID belum diisi */
const WC_RPC_URLS = { 1: 'https://rpc.ankr.com/eth' };

/**
 * Daftar wallet mobile beserta deep link & universal link.
 * Dipakai untuk tampilan mobile — user tap untuk buka app langsung.
 */
const MOBILE_WALLETS = [
  {
    name:    'MetaMask',
    emoji:   '🦊',
    color:   'orange',
    // Universal link: buka dApp langsung di MetaMask browser
    getLink: () => `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`,
  },
  {
    name:    'Trust Wallet',
    emoji:   '🛡️',
    color:   'blue',
    // Trust Wallet deep link
    getLink: () => `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(window.location.href)}`,
  },
  {
    name:    'Rainbow',
    emoji:   '🌈',
    color:   'purple',
    getLink: () => `https://rnbwapp.com/wc?uri=${encodeURIComponent(window.location.href)}`,
  },
  {
    name:    'Coinbase Wallet',
    emoji:   '🔵',
    color:   'blue',
    getLink: () => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(window.location.href)}`,
  },
];

// ─── STATE ────────────────────────────────────────────────────────────────────
let wcProvider   = null;
let wcConnecting = false;

// ─── UTILS ────────────────────────────────────────────────────────────────────

function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// ─── SDK LOADER ───────────────────────────────────────────────────────────────

/** CDN utama & fallback untuk WalletConnect provider SDK */
const WC_SDK_URLS = [
  'https://cdn.jsdelivr.net/npm/@walletconnect/web3-provider@1.8.0/dist/umd/index.min.js',
  'https://unpkg.com/@walletconnect/web3-provider@1.8.0/dist/umd/index.min.js',
];

/**
 * Muat WalletConnect SDK secara lazy.
 * Mencoba CDN pertama, fallback ke CDN kedua jika gagal.
 */
function loadWalletConnectSDK() {
  return new Promise((resolve, reject) => {
    if (window.WalletConnectProvider) return resolve();

    let tried = 0;

    function tryLoad(url) {
      const script   = document.createElement('script');
      script.src     = url;
      script.async   = true;
      script.onload  = () => resolve();
      script.onerror = () => {
        tried++;
        if (tried < WC_SDK_URLS.length) {
          tryLoad(WC_SDK_URLS[tried]);
        } else {
          reject(new Error(
            'Gagal memuat WalletConnect SDK. Cek koneksi internet kamu dan coba lagi.'
          ));
        }
      };
      document.head.appendChild(script);
    }

    tryLoad(WC_SDK_URLS[0]);
  });
}

// ─── MOBILE WALLET LINKS MODAL ───────────────────────────────────────────────

/**
 * FIX UTAMA: Di mobile browser, tampilkan daftar tombol deep link wallet
 * (bukan QR code yang tidak bisa di-scan sendiri)
 */
function openMobileWalletLinksModal() {
  closeMobileWalletLinksModal(); // Bersihkan jika sudah ada

  const overlay = document.createElement('div');
  overlay.id        = 'wc-mobile-modal';
  overlay.className = 'fixed inset-0 z-[10002] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-4 sm:pb-0';
  overlay.innerHTML = `
    <!-- Backdrop close -->
    <div class="absolute inset-0" onclick="closeMobileWalletLinksModal()"></div>

    <!-- Sheet / Card -->
    <div class="relative w-full max-w-sm bg-[#0F172A] border border-white/10 rounded-3xl p-6 shadow-2xl z-10">

      <!-- Handle bar (mobile sheet feel) -->
      <div class="flex justify-center mb-5">
        <div class="w-10 h-1 bg-white/20 rounded-full"></div>
      </div>

      <!-- Header -->
      <div class="text-center mb-5">
        <div class="text-4xl mb-2">📱</div>
        <h3 class="text-lg font-black">Buka dengan Wallet App</h3>
        <p class="text-slate-400 text-xs mt-1 leading-relaxed">
          Kamu di mobile browser. Pilih wallet app yang sudah terinstall
          untuk connect langsung.
        </p>
      </div>

      <!-- Wallet buttons -->
      <div class="space-y-2 mb-5" id="wc-mobile-wallet-list"></div>

      <!-- Divider -->
      <div class="flex items-center gap-3 my-4">
        <div class="flex-1 h-px bg-white/10"></div>
        <span class="text-slate-500 text-xs">atau</span>
        <div class="flex-1 h-px bg-white/10"></div>
      </div>

      <!-- QR option (desktop user or scan with another device) -->
      <button onclick="closeMobileWalletLinksModal(); connectViaWalletConnectQR();"
        class="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-left transition">
        <span class="text-2xl">📷</span>
        <div>
          <p class="text-white text-sm font-semibold">Scan QR Code</p>
          <p class="text-slate-500 text-xs">Scan dari perangkat lain</p>
        </div>
      </button>

      <!-- Close -->
      <button onclick="closeMobileWalletLinksModal()"
        class="w-full mt-3 py-2 text-slate-500 hover:text-white text-sm transition">Batal</button>
    </div>
  `;

  // Isi daftar wallet
  const list = overlay.querySelector('#wc-mobile-wallet-list');
  MOBILE_WALLETS.forEach(wallet => {
    const btn = document.createElement('a');
    btn.href      = wallet.getLink();
    // Gunakan _self agar deep link bisa trigger app; _blank sering diblokir di mobile
    btn.target    = '_self';
    btn.rel       = 'noopener';
    btn.className = `flex items-center gap-4 bg-[#1E293B] hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-2xl px-4 py-3 transition`;
    btn.innerHTML = `
      <span class="text-3xl">${wallet.emoji}</span>
      <div class="flex-1">
        <p class="font-bold text-white text-sm">${wallet.name}</p>
        <p class="text-slate-500 text-xs">Ketuk untuk membuka app</p>
      </div>
      <span class="text-slate-500 text-lg">→</span>
    `;
    list.appendChild(btn);
  });

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  // Tutup dengan Escape
  const escHandler = (e) => {
    if (e.key === 'Escape') { closeMobileWalletLinksModal(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);
}

function closeMobileWalletLinksModal() {
  const el = document.getElementById('wc-mobile-modal');
  if (el) el.remove();
  document.body.style.overflow = '';
}

// ─── WALLETCONNECT QR (DESKTOP / SCAN FROM ANOTHER DEVICE) ──────────────────

/**
 * Koneksi WalletConnect via QR — cocok untuk desktop atau
 * user yang mau scan dari HP lain.
 */
async function connectViaWalletConnectQR() {
  if (wcConnecting) return;
  wcConnecting = true;

  if (typeof showToast === 'function') {
    showToast('Memuat WalletConnect QR... ⏳', 'info');
  }

  try {
    await loadWalletConnectSDK();

    // Cleanup sesi lama jika ada
    if (wcProvider) {
      try { await wcProvider.disconnect(); } catch (_) {}
      wcProvider = null;
    }

    wcProvider = new window.WalletConnectProvider.default({
      infuraId: WC_INFURA_ID !== 'YOUR_INFURA_PROJECT_ID' ? WC_INFURA_ID : undefined,
      rpc:      WC_RPC_URLS,
      bridge:   WC_BRIDGE_URL,
      chainId:  WC_CHAIN_ID,
      // Di mobile QR scan mode, matikan mobileLinks agar hanya tampilkan QR
      qrcodeModalOptions: { mobileLinks: [] },
    });

    _attachWCListeners();

    const accounts = await wcProvider.enable();
    if (!accounts || accounts.length === 0) throw new Error('Tidak ada akun terdeteksi.');

    _onWCConnected(accounts);

  } catch (err) {
    _handleWCError(err);
  } finally {
    wcConnecting = false;
  }
}

// ─── WALLETCONNECT MAIN ENTRY ─────────────────────────────────────────────────

/**
 * Entry point utama untuk koneksi WalletConnect.
 *
 * FIX: Di mobile browser → tampilkan wallet app links (deep link).
 *      Di desktop → tampilkan QR code modal seperti biasa.
 */
async function connectViaWalletConnect() {
  closeWalletPickerModal();

  if (isMobile()) {
    // ── MOBILE: Tampilkan sheet dengan deep links wallet apps ──
    openMobileWalletLinksModal();
  } else {
    // ── DESKTOP: Tampilkan QR code WalletConnect ──
    await connectViaWalletConnectQR();
  }
}

// ─── INTERNAL HELPERS ─────────────────────────────────────────────────────────

function _attachWCListeners() {
  if (!wcProvider) return;

  wcProvider.on('accountsChanged', (accounts) => {
    if (!accounts || accounts.length === 0) {
      disconnectWalletConnect();
    } else {
      walletState.address = accounts[0];
      sessionStorage.setItem('wallet_address',   accounts[0]);
      sessionStorage.setItem('wallet_connected', 'true');
      sessionStorage.setItem('wallet_provider',  'walletconnect');
      if (typeof updateWalletUI  === 'function') updateWalletUI();
      if (typeof showToast === 'function') {
        showToast(`Akun berganti: ${shortenAddress(accounts[0])} 🔄`, 'info');
      }
    }
  });

  wcProvider.on('chainChanged', (chainId) => {
    walletState.chainId = '0x' + parseInt(chainId).toString(16);
    const ok = walletState.chainId === SUPPORTED_CHAIN_ID;
    if (typeof showToast === 'function') {
      showToast(
        ok ? 'Beralih ke Ethereum Mainnet ✅'
           : 'Peringatan: kamu di jaringan lain. Gunakan Ethereum Mainnet. ⚠️',
        ok ? 'success' : 'warning'
      );
    }
  });

  wcProvider.on('disconnect', () => { disconnectWalletConnect(); });
}

function _onWCConnected(accounts) {
  const chainIdHex = '0x' + parseInt(wcProvider.chainId || 1).toString(16);

  walletState.address     = accounts[0];
  walletState.chainId     = chainIdHex;
  walletState.isConnected = true;
  walletState.provider    = 'walletconnect';

  sessionStorage.setItem('wallet_connected', 'true');
  sessionStorage.setItem('wallet_address',   accounts[0]);
  sessionStorage.setItem('wallet_provider',  'walletconnect');

  if (typeof updateWalletUI === 'function') updateWalletUI();

  const isMainnet = chainIdHex === SUPPORTED_CHAIN_ID;
  if (typeof showToast === 'function') {
    showToast(
      isMainnet
        ? `📱 WalletConnect terhubung! ${shortenAddress(accounts[0])} ✨`
        : `📱 WalletConnect terhubung, tapi jaringan bukan Mainnet. ⚠️`,
      isMainnet ? 'success' : 'warning'
    );
  }

  showWalletConnectBadge(accounts[0]);
}

function _handleWCError(err) {
  if (!err) return;
  const msg = err.message || '';

  if (
    msg.includes('User closed modal') ||
    msg.includes('user rejected') ||
    msg.includes('User rejected')
  ) {
    if (typeof showToast === 'function') {
      showToast('Koneksi dibatalkan. Coba lagi kapan saja! 😊', 'warning');
    }
  } else if (msg.includes('Already connected')) {
    if (typeof showToast === 'function') {
      showToast('Wallet sudah terhubung! 🔗', 'info');
    }
  } else {
    if (typeof showToast === 'function') {
      showToast('WalletConnect gagal: ' + (msg || 'Error tidak diketahui'), 'error');
    }
    console.error('[WalletConnect error]', err);
  }

  // Cleanup
  if (wcProvider) {
    try { wcProvider.disconnect(); } catch (_) {}
    wcProvider = null;
  }
}

// ─── DISCONNECT ───────────────────────────────────────────────────────────────

async function disconnectWalletConnect() {
  const prevAddr = walletState.address;

  if (wcProvider) {
    try { await wcProvider.disconnect(); } catch (_) {}
    wcProvider = null;
  }

  walletState.address     = null;
  walletState.chainId     = null;
  walletState.isConnected = false;
  walletState.provider    = null;

  sessionStorage.removeItem('wallet_connected');
  sessionStorage.removeItem('wallet_address');
  sessionStorage.removeItem('wallet_provider');

  if (typeof updateWalletUI === 'function') updateWalletUI();
  if (typeof showToast === 'function') {
    showToast(`Wallet ${shortenAddress(prevAddr)} disconnect. 👋`, 'info');
  }

  hideWalletConnectBadge();
}

// ─── RESTORE SESSION ──────────────────────────────────────────────────────────

async function restoreWalletConnectSession() {
  const provider     = sessionStorage.getItem('wallet_provider');
  const savedAddress = sessionStorage.getItem('wallet_address');

  if (provider !== 'walletconnect' || !savedAddress) return false;

  try {
    await loadWalletConnectSDK();

    wcProvider = new window.WalletConnectProvider.default({
      infuraId: WC_INFURA_ID !== 'YOUR_INFURA_PROJECT_ID' ? WC_INFURA_ID : undefined,
      rpc:      WC_RPC_URLS,
      bridge:   WC_BRIDGE_URL,
      chainId:  WC_CHAIN_ID,
    });

    if (wcProvider.wc && wcProvider.wc.connected) {
      const accounts = wcProvider.wc.accounts || [];
      if (accounts.length > 0) {
        _attachWCListeners();
        const chainIdHex = '0x' + parseInt(wcProvider.chainId || 1).toString(16);
        walletState.address     = accounts[0];
        walletState.chainId     = chainIdHex;
        walletState.isConnected = true;
        walletState.provider    = 'walletconnect';
        if (typeof updateWalletUI === 'function') updateWalletUI();
        if (typeof showToast === 'function') {
          showToast(`📱 WalletConnect terhubung kembali — ${shortenAddress(accounts[0])} 🔗`, 'success');
        }
        showWalletConnectBadge(accounts[0]);
        return true;
      }
    }
  } catch (_) {
    sessionStorage.removeItem('wallet_provider');
  }

  return false;
}

// ─── WALLET PICKER MODAL (UPDATED: mobile-aware) ─────────────────────────────

function openWalletPickerModal() {
  if (!document.getElementById('wallet-picker-modal')) {
    injectWalletPickerModal();
  }
  const modal = document.getElementById('wallet-picker-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }
}

function closeWalletPickerModal() {
  const modal = document.getElementById('wallet-picker-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
  }
}

function injectWalletPickerModal() {
  const mobile = isMobile();

  const modal = document.createElement('div');
  modal.id        = 'wallet-picker-modal';
  modal.className = 'hidden fixed inset-0 z-[10001] items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-4 sm:pb-0';
  modal.innerHTML = `
    <div class="absolute inset-0" onclick="closeWalletPickerModal()"></div>
    <div class="relative bg-[#0F172A] border border-white/10 rounded-3xl w-full max-w-sm shadow-2xl p-8 z-10">

      <div class="flex justify-center mb-5">
        <div class="w-10 h-1 bg-white/20 rounded-full"></div>
      </div>

      <div class="flex items-center justify-between mb-5">
        <div>
          <h3 class="text-xl font-black">🔗 Connect Wallet</h3>
          <p class="text-slate-400 text-sm mt-0.5">${mobile ? 'Pilih wallet app kamu' : 'Pilih cara menghubungkan wallet'}</p>
        </div>
        <button onclick="closeWalletPickerModal()" class="text-slate-500 hover:text-white text-2xl leading-none transition">×</button>
      </div>

      ${mobile ? `
      <!-- MOBILE: WalletConnect first (lebih relevan) -->
      <button onclick="connectViaWalletConnect()"
        class="w-full flex items-center gap-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 hover:border-blue-500/60 rounded-2xl px-5 py-4 mb-3 text-left transition-all group">
        <div class="w-10 h-10 rounded-xl bg-blue-500/30 flex items-center justify-center shrink-0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6.09 8.4c3.26-3.26 8.55-3.26 11.82 0l.39.39a.4.4 0 010 .56l-1.34 1.34a.2.2 0 01-.28 0l-.54-.54c-2.28-2.28-5.97-2.28-8.25 0l-.58.58a.2.2 0 01-.28 0L5.59 9.39a.4.4 0 010-.56l.5-.43zm14.6 2.72l1.19 1.19a.4.4 0 010 .56l-5.37 5.37a.4.4 0 01-.56 0l-3.81-3.81a.1.1 0 00-.14 0l-3.81 3.81a.4.4 0 01-.56 0L2.12 12.87a.4.4 0 010-.56l1.19-1.19a.4.4 0 01.56 0l3.81 3.81a.1.1 0 00.14 0l3.81-3.81a.4.4 0 01.56 0l3.81 3.81a.1.1 0 00.14 0l3.81-3.81a.4.4 0 01.65 0z" fill="#3B99FC"/></svg>
        </div>
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <p class="font-bold text-blue-300">WalletConnect</p>
            <span class="text-xs bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full font-bold">Disarankan</span>
          </div>
          <p class="text-slate-500 text-xs mt-0.5">Trust, Rainbow, MetaMask Mobile, dll</p>
        </div>
      </button>

      <button onclick="closeWalletPickerModal(); connectWallet();"
        class="w-full flex items-center gap-4 bg-[#1E293B] hover:bg-orange-500/10 border border-white/5 hover:border-orange-500/40 rounded-2xl px-5 py-4 mb-3 text-left transition-all group">
        <span class="text-4xl">🦊</span>
        <div class="flex-1">
          <p class="font-bold group-hover:text-orange-400 transition">MetaMask</p>
          <p class="text-slate-500 text-xs">Buka MetaMask app & lanjutkan di browser-nya</p>
        </div>
        <span class="text-slate-600 text-lg">→</span>
      </button>

      ` : `
      <!-- DESKTOP: MetaMask first -->
      <button onclick="closeWalletPickerModal(); connectWallet();"
        class="w-full flex items-center gap-4 bg-[#1E293B] hover:bg-orange-500/10 border border-white/5 hover:border-orange-500/40 rounded-2xl px-5 py-4 mb-3 text-left transition-all group">
        <span class="text-4xl">🦊</span>
        <div class="flex-1">
          <p class="font-bold group-hover:text-orange-400 transition">MetaMask</p>
          <p class="text-slate-500 text-xs">Browser extension (Chrome, Firefox, Brave)</p>
        </div>
        <span class="text-slate-600 group-hover:text-orange-400 transition text-lg">→</span>
      </button>

      <button onclick="connectViaWalletConnect()"
        class="w-full flex items-center gap-4 bg-[#1E293B] hover:bg-blue-500/10 border border-white/5 hover:border-blue-500/40 rounded-2xl px-5 py-4 mb-3 text-left transition-all group">
        <div class="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6.09 8.4c3.26-3.26 8.55-3.26 11.82 0l.39.39a.4.4 0 010 .56l-1.34 1.34a.2.2 0 01-.28 0l-.54-.54c-2.28-2.28-5.97-2.28-8.25 0l-.58.58a.2.2 0 01-.28 0L5.59 9.39a.4.4 0 010-.56l.5-.43zm14.6 2.72l1.19 1.19a.4.4 0 010 .56l-5.37 5.37a.4.4 0 01-.56 0l-3.81-3.81a.1.1 0 00-.14 0l-3.81 3.81a.4.4 0 01-.56 0L2.12 12.87a.4.4 0 010-.56l1.19-1.19a.4.4 0 01.56 0l3.81 3.81a.1.1 0 00.14 0l3.81-3.81a.4.4 0 01.56 0l3.81 3.81a.1.1 0 00.14 0l3.81-3.81a.4.4 0 01.65 0z" fill="#3B99FC"/></svg>
        </div>
        <div class="flex-1">
          <p class="font-bold group-hover:text-blue-400 transition">WalletConnect</p>
          <p class="text-slate-500 text-xs">Scan QR dari HP — Trust, Rainbow, dll</p>
        </div>
        <span class="bg-blue-500/20 text-blue-400 text-xs font-bold px-2 py-0.5 rounded-full">📱 HP</span>
      </button>
      `}

      <div class="mt-4 pt-4 border-t border-white/5">
        <p class="text-slate-500 text-xs text-center">
          ${mobile
            ? '📱 Wallet yang didukung: MetaMask · Trust · Rainbow · Coinbase'
            : 'Wallet yang didukung: 🦊 MetaMask · 🛡️ Trust · 🌈 Rainbow · +100 lainnya'}
        </p>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeWalletPickerModal();
  });
}

// ─── BADGE ────────────────────────────────────────────────────────────────────

function showWalletConnectBadge(address) {
  const badge = document.getElementById('wallet-address-badge');
  if (!badge) return;
  badge.innerHTML = `
    <span class="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
    <span class="text-blue-400">📱 ${shortenAddress(address)}</span>
    <span class="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">WalletConnect</span>
  `;
  badge.className = 'mt-6 inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-mono px-4 py-2 rounded-full';
  badge.classList.remove('hidden');
}

function hideWalletConnectBadge() {
  const badge = document.getElementById('wallet-address-badge');
  if (badge) badge.classList.add('hidden');
}

// ─── EXPOSE GLOBALS ───────────────────────────────────────────────────────────
window.connectViaWalletConnect     = connectViaWalletConnect;
window.connectViaWalletConnectQR   = connectViaWalletConnectQR;
window.disconnectWalletConnect     = disconnectWalletConnect;
window.openWalletPickerModal       = openWalletPickerModal;
window.closeWalletPickerModal      = closeWalletPickerModal;
window.openMobileWalletLinksModal  = openMobileWalletLinksModal;
window.closeMobileWalletLinksModal = closeMobileWalletLinksModal;
window.restoreWalletConnectSession = restoreWalletConnectSession;
