/**
 * wallet.js — KriptoEdu Wallet System
 * RAH-14: Rebuild total dengan Web3Modal v1 + Ethers.js v5
 *
 * Kenapa Web3Modal?
 *  - Satu interface untuk MetaMask, WalletConnect, Coinbase Wallet, dll
 *  - Menangani mobile browser secara otomatis (deep link, QR, in-app browser)
 *  - Tidak perlu custom mobile detection yang error-prone
 *  - Stabil, battle-tested di banyak dApp production
 *
 * Load order CDN (semua lazy, hanya dimuat saat user klik Connect):
 *  1. ethers.js v5
 *  2. @walletconnect/web3-provider@1.8.0
 *  3. web3modal@1.9.12
 */

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SUPPORTED_CHAIN_ID   = 1;      // Ethereum Mainnet (integer)
const SUPPORTED_CHAIN_HEX  = '0x1';
const SUPPORTED_CHAIN_NAME = 'Ethereum Mainnet';

// ─── SHARED STATE ────────────────────────────────────────────────────────────
// Dibaca juga oleh donation.js — jangan rename
let walletState = {
  address:       null,
  chainId:       null,
  isConnected:   false,
  provider:      null,   // raw Web3Modal provider instance
  ethersProvider: null,  // ethers.providers.Web3Provider wrapper
};

let _web3Modal   = null;  // singleton Web3Modal instance
let _sdkLoading  = false; // guard: tidak load ulang jika sedang loading

// ─── CDN URLs ─────────────────────────────────────────────────────────────────
const _CDN = {
  ethers:   'https://cdn.ethers.io/lib/ethers-5.7.umd.min.js',
  wc:       'https://unpkg.com/@walletconnect/web3-provider@1.8.0/dist/umd/index.min.js',
  w3m:      'https://unpkg.com/web3modal@1.9.12/dist/index.js',
};

// ─── UTILS ───────────────────────────────────────────────────────────────────

function shortenAddress(addr) {
  if (!addr) return '';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function _loadScript(url) {
  return new Promise((resolve, reject) => {
    // Sudah ada di DOM? Skip
    if ([...document.scripts].some(s => s.src.includes(url.split('/').pop()))) {
      return resolve();
    }
    const s    = document.createElement('script');
    s.src      = url;
    s.async    = true;
    s.onload   = resolve;
    s.onerror  = () => reject(new Error('Gagal load: ' + url));
    document.head.appendChild(s);
  });
}

// ─── TOAST ───────────────────────────────────────────────────────────────────

let _toastTimer;

function showToast(message, type = 'info') {
  const toast = document.getElementById('wallet-toast');
  const msg   = document.getElementById('wallet-toast-msg');
  const icon  = document.getElementById('wallet-toast-icon');
  if (!toast) return;

  const map = {
    success: { i: '\u2705', bg: 'bg-green-500/20',  bd: 'border-green-500/40',  tx: 'text-green-300'  },
    error:   { i: '\u274c', bg: 'bg-red-500/20',    bd: 'border-red-500/40',    tx: 'text-red-300'    },
    warning: { i: '\u26a0\ufe0f', bg: 'bg-yellow-500/20', bd: 'border-yellow-500/40', tx: 'text-yellow-300' },
    info:    { i: '\u2139\ufe0f', bg: 'bg-blue-500/20',   bd: 'border-blue-500/40',   tx: 'text-blue-300'   },
  };
  const c = map[type] || map.info;

  toast.className      = `fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl border backdrop-blur-md shadow-xl transition-all duration-300 ${c.bg} ${c.bd}`;
  msg.className        = `text-sm font-semibold ${c.tx}`;
  icon.textContent     = c.i;
  msg.textContent      = message;
  toast.style.opacity  = '1';
  toast.style.transform = 'translateY(0)';
  toast.style.pointerEvents = 'auto';

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(hideToast, 3500);
}

function hideToast() {
  const t = document.getElementById('wallet-toast');
  if (!t) return;
  t.style.opacity       = '0';
  t.style.transform     = 'translateY(16px)';
  t.style.pointerEvents = 'none';
}

// ─── UI UPDATE ────────────────────────────────────────────────────────────────

function updateWalletUI() {
  const btn   = document.getElementById('wallet-btn');
  const label = document.getElementById('wallet-btn-label');
  const dot   = document.getElementById('wallet-btn-dot');
  const badge = document.getElementById('wallet-address-badge');
  if (!btn) return;

  if (walletState.isConnected && walletState.address) {
    btn.className = [
      'hidden md:inline-flex items-center gap-2',
      'bg-green-500/15 hover:bg-red-500/15',
      'border border-green-500/40 hover:border-red-500/40',
      'text-green-400 hover:text-red-400',
      'text-sm font-semibold px-4 py-2 rounded-full',
      'transition-all duration-200 cursor-pointer group',
    ].join(' ');
    if (label) label.innerHTML = `
      <span class="group-hover:hidden">${shortenAddress(walletState.address)}</span>
      <span class="hidden group-hover:inline">Disconnect</span>`;
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-green-400 group-hover:bg-red-400 transition-colors animate-pulse';
    if (badge) {
      badge.innerHTML   = `<span class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span><span>${shortenAddress(walletState.address)}</span>`;
      badge.className   = 'mt-6 inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-mono px-4 py-2 rounded-full';
      badge.classList.remove('hidden');
    }
  } else {
    btn.className = 'hidden md:inline-flex items-center gap-2 bg-crypto-purple hover:bg-purple-500 text-white text-sm font-semibold px-4 py-2 rounded-full transition-all duration-200 cursor-pointer';
    if (label) label.innerHTML = '<span>\ud83d\udd17 Connect Wallet</span>';
    if (dot)   dot.className   = 'w-2 h-2 rounded-full bg-white/50';
    if (badge) badge.classList.add('hidden');
  }
}

// ─── WEB3MODAL BOOTSTRAP ──────────────────────────────────────────────────────

async function _initWeb3Modal() {
  if (_web3Modal) return; // Sudah ada
  if (_sdkLoading) {
    // Tunggu sampai load selesai
    await new Promise(r => setTimeout(r, 100));
    if (_web3Modal) return;
  }

  _sdkLoading = true;
  try {
    // Load semua dependency secara berurutan
    await _loadScript(_CDN.ethers);
    await _loadScript(_CDN.wc);
    await _loadScript(_CDN.w3m);

    const Web3Modal  = window.Web3Modal?.default ?? window.Web3Modal;
    const WCProvider = window.WalletConnectProvider?.default ?? window.WalletConnectProvider;

    if (!Web3Modal) throw new Error('Web3Modal tidak berhasil dimuat.');

    const providerOptions = {};

    if (WCProvider) {
      providerOptions.walletconnect = {
        package: WCProvider,
        options: {
          rpc:    { 1: 'https://rpc.ankr.com/eth' },
          bridge: 'https://bridge.walletconnect.org',
        },
      };
    }

    _web3Modal = new Web3Modal({
      network:       'mainnet',
      cacheProvider: true,   // auto-reconnect saat reload
      disableInjectedProvider: false,
      providerOptions,
      theme: {
        background: '#0F172A',
        main:       '#f1f5f9',
        secondary:  '#94a3b8',
        border:     '#1e293b',
        hover:      '#1e293b',
      },
    });
  } finally {
    _sdkLoading = false;
  }
}

// ─── PROVIDER SETUP (setelah modal connect) ───────────────────────────────────

async function _setupProvider(rawInstance) {
  const ethers   = window.ethers;
  const provider = new ethers.providers.Web3Provider(rawInstance, 'any');
  const signer   = provider.getSigner();
  const address  = await signer.getAddress();
  const network  = await provider.getNetwork();

  walletState.address        = address;
  walletState.chainId        = network.chainId;
  walletState.isConnected    = true;
  walletState.provider       = rawInstance;  // raw: dipakai WC disconnect
  walletState.ethersProvider = provider;     // ethers: dipakai donation.js

  sessionStorage.setItem('wallet_connected', 'true');
  sessionStorage.setItem('wallet_address',   address);

  updateWalletUI();

  const ok = network.chainId === SUPPORTED_CHAIN_ID;
  showToast(
    ok
      ? `\u2705 Wallet terhubung! ${shortenAddress(address)}`
      : `\u26a0\ufe0f Terhubung di chain ${network.chainId}, bukan Mainnet.`,
    ok ? 'success' : 'warning'
  );

  // ── Event listeners dari provider ──
  if (rawInstance.on) {
    rawInstance.on('accountsChanged', (accounts) => {
      if (!accounts || !accounts.length) {
        disconnectWallet();
      } else {
        walletState.address = accounts[0];
        sessionStorage.setItem('wallet_address', accounts[0]);
        updateWalletUI();
        showToast(`Akun berganti: ${shortenAddress(accounts[0])} \ud83d\udd04`, 'info');
      }
    });
    rawInstance.on('chainChanged', (chainIdHex) => {
      const cid = parseInt(chainIdHex, 16);
      walletState.chainId = cid;
      const ok2 = cid === SUPPORTED_CHAIN_ID;
      showToast(ok2 ? 'Beralih ke Ethereum Mainnet \u2705' : `Jaringan berubah! Gunakan ${SUPPORTED_CHAIN_NAME}. \u26a0\ufe0f`, ok2 ? 'success' : 'warning');
    });
    rawInstance.on('disconnect', () => { disconnectWallet(); });
  }
}

// ─── CONNECT ─────────────────────────────────────────────────────────────────

async function connectWallet() {
  try {
    showToast('Memuat sistem wallet... \u23f3', 'info');
    await _initWeb3Modal();

    // Web3Modal menampilkan picker: MetaMask / WalletConnect / dll
    // Di mobile: otomatis menampilkan deep link & QR yang sesuai
    const rawInstance = await _web3Modal.connect();
    await _setupProvider(rawInstance);

  } catch (err) {
    const msg = err?.message || '';
    if (
      msg.includes('User closed') ||
      msg.includes('Modal closed') ||
      msg.includes('user rejected') ||
      msg.includes('User rejected') ||
      err?.code === 4001
    ) {
      showToast('Koneksi dibatalkan. \ud83d\ude0a', 'warning');
    } else if (msg.includes('Gagal load')) {
      showToast('Gagal memuat SDK. Cek koneksi internet kamu!', 'error');
    } else {
      showToast('Gagal connect: ' + (msg || 'Error tidak diketahui'), 'error');
      console.error('[wallet.js] connectWallet error:', err);
    }
  }
}

// ─── DISCONNECT ──────────────────────────────────────────────────────────────

async function disconnectWallet() {
  const prev = walletState.address;

  // Clear Web3Modal cache
  if (_web3Modal) {
    try { _web3Modal.clearCachedProvider(); } catch (_) {}
  }

  // WalletConnect perlu explicit close
  if (walletState.provider?.disconnect) {
    try { await walletState.provider.disconnect(); } catch (_) {}
  }
  if (walletState.provider?.close) {
    try { await walletState.provider.close(); } catch (_) {}
  }

  walletState.address        = null;
  walletState.chainId        = null;
  walletState.isConnected    = false;
  walletState.provider       = null;
  walletState.ethersProvider = null;

  sessionStorage.removeItem('wallet_connected');
  sessionStorage.removeItem('wallet_address');

  updateWalletUI();
  showToast(`Wallet ${shortenAddress(prev)} disconnect. \ud83d\udc4b`, 'info');
}

// ─── AUTO-RECONNECT ──────────────────────────────────────────────────────────

async function _tryAutoReconnect() {
  const wasSaved = sessionStorage.getItem('wallet_connected');
  if (!wasSaved) return;

  try {
    await _initWeb3Modal();

    // Jika ada cached provider, reconnect silent tanpa popup
    if (_web3Modal.cachedProvider) {
      const rawInstance = await _web3Modal.connect();
      await _setupProvider(rawInstance);
    }
  } catch (_) {
    // Gagal auto-reconnect: bersihkan session, tidak perlu error message
    sessionStorage.removeItem('wallet_connected');
    sessionStorage.removeItem('wallet_address');
    if (_web3Modal) {
      try { _web3Modal.clearCachedProvider(); } catch (__) {}
    }
  }
}

// ─── BUTTON HANDLER ──────────────────────────────────────────────────────────

function handleWalletButtonClick() {
  if (walletState.isConnected) {
    disconnectWallet();
  } else {
    connectWallet();
  }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

function initWallet() {
  // Pasang event listener ke semua tombol wallet
  const desktopBtn = document.getElementById('wallet-btn');
  if (desktopBtn) desktopBtn.addEventListener('click', handleWalletButtonClick);

  const mobileBtn = document.getElementById('wallet-btn-mobile');
  if (mobileBtn) mobileBtn.addEventListener('click', handleWalletButtonClick);

  updateWalletUI();
  _tryAutoReconnect();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWallet);
} else {
  initWallet();
}
