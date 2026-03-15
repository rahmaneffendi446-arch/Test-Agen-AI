/**
 * i18n.js: KriptoEdu Language Switcher
 * Mendukung: Bahasa Indonesia (ID) [default] & English (EN)
 *
 * Cara kerja:
 *  - Semua teks yang bisa ditranslasi diberi atribut data-i18n="key"
 *  - Script ini mengganti innerHTML / textContent elemen sesuai bahasa aktif
 *  - Bahasa tersimpan di localStorage agar persist saat reload
 *  - Default: Bahasa Indonesia
 */

// TRANSLATIONS
const TRANSLATIONS = {
  id: {
    // Navbar
    nav_learn:      'Belajar',
    nav_blockchain: 'Blockchain',
    nav_bitcoin:    'Bitcoin',
    nav_module:     'Modul',
    nav_donate:     '💛 Donasi',
    nav_start:      'Mulai Gratis →',
    nav_wallet:     '🔗 Wallet',

    // Hero
    hero_badge:     '🚀 Platform Edukasi Web3 #1 Indonesia',
    hero_h1_1:      'Pahami Kripto &',
    hero_h1_2:      'Web3 dari Nol',
    hero_desc:      'Pelajari blockchain, DeFi, NFT, dan cara kerja dompet kripto dengan materi yang mudah dipahami. Bebas jargon, bebas ribet.',
    hero_cta1:      'Mulai Belajar Sekarang',
    hero_cta2:      '💛 Dukung Kami',
    hero_stat1_lbl: 'Pelajar Aktif',
    hero_stat2_lbl: 'Modul Gratis',
    hero_stat3_lbl: 'Berbahasa Indonesia',

    // Blockchain section
    mod01_label:    'Modul 01',
    mod01_title:    '⛓️ Apa Itu <span class="text-crypto-blue">Blockchain</span>?',
    mod01_intro:    'Kamu pernah denger kata "blockchain" tapi bingung maksudnya apa? Tenang, kita bahas dengan cara yang santai dan gampang dipahami.',
    mod01_card_title: 'Bayangin Buku Catatan Ajaib',
    mod01_card_p1:  'Coba bayangin kamu punya sebuah <strong class="text-white">buku catatan</strong> yang isinya catatan transaksi uang. Setiap kali ada transaksi baru (misalnya kamu transfer ke teman), transaksi itu ditulis di buku tersebut.',
    mod01_card_p2:  'Yang bikin <strong class="text-crypto-blue">blockchain spesial</strong>: buku catatan ini <em>bukan cuma dipegang satu orang</em>, tapi disimpan oleh <strong class="text-white">ribuan komputer</strong> di seluruh dunia secara bersamaan. Kalau ada yang coba curang dan ubah catatannya, semua komputer lain langsung tahu dan menolaknya! 🚫',
    mod01_k1_title: 'Blok + Rantai',
    mod01_k1_desc:  'Data disimpan dalam "blok". Setiap blok baru nyambung ke blok sebelumnya, membentuk "rantai" (chain). Makanya namanya <em>block-chain</em>!',
    mod01_k2_title: 'Desentralisasi',
    mod01_k2_desc:  'Nggak ada "bos" yang ngatur. Data tersebar di banyak komputer (disebut <em>node</em>), jadi nggak ada satu pihak pun yang bisa mengendalikan semuanya.',
    mod01_k3_title: 'Transparan & Aman',
    mod01_k3_desc:  'Semua transaksi bisa dilihat siapa saja (transparan), tapi identitas pengguna tetap anonim. Dan data yang sudah masuk <em>hampir mustahil</em> untuk diubah.',
    mod01_flow_title: '🔍 Gimana Alurnya?',
    mod01_step1_title: '1. Transaksi Terjadi',
    mod01_step1_desc:  'Kamu kirim Bitcoin ke temanmu',
    mod01_step2_title: '2. Disebar ke Network',
    mod01_step2_desc:  'Ribuan node menerima info ini',
    mod01_step3_title: '3. Diverifikasi',
    mod01_step3_desc:  'Node sepakat transaksi valid',
    mod01_step4_title: '4. Masuk Blok',
    mod01_step4_desc:  'Transaksi permanen di blockchain',
    faq_label:      '❓ Pertanyaan yang Sering Ditanya:',
    faq1_q:         'Siapa yang "menjaga" blockchain kalau nggak ada bosnya?',
    faq1_a:         'Yang menjaga adalah para <strong class="text-white">miner</strong> dan <strong class="text-white">validator</strong>, yaitu orang-orang di seluruh dunia yang menyediakan komputer mereka untuk memproses dan memverifikasi transaksi. Mereka diberi insentif berupa kripto sebagai "upah" atas kerja keras komputer mereka.',
    faq2_q:         'Apakah blockchain cuma untuk kripto?',
    faq2_a:         'Nggak! Blockchain bisa dipakai untuk banyak hal: supply chain (melacak asal-usul produk), voting digital, sertifikat pendidikan, rekam medis, dan masih banyak lagi. Kripto hanyalah salah satu aplikasi blockchain yang paling terkenal.',
    faq3_q:         'Kenapa data blockchain sulit dipalsukan?',
    faq3_a:         'Setiap blok punya "<strong class="text-white">hash</strong>" yaitu semacam sidik jari unik yang dibuat dari data di dalamnya. Kalau ada satu karakter yang diubah, hash-nya berubah total. Dan karena setiap blok mencantumkan hash blok sebelumnya, kamu harus ubah <em>semua blok sejak awal</em>, dan melakukannya lebih cepat dari ribuan komputer lain. Hampir mustahil! 😅',

    // Bitcoin section
    mod02_label:    'Modul 02',
    mod02_title:    '₿ Cara Kerja <span class="text-crypto-gold">Bitcoin</span>',
    mod02_intro:    'Bitcoin adalah uang digital pertama di dunia yang berhasil jalan tanpa bank. Tapi gimana caranya bisa kerja? Yuk kita bedah!',
    mod02_card_title: 'Uang Tanpa Bank? Emangnya Bisa?',
    mod02_card_p1:  'Kalau kamu transfer uang lewat bank, bank yang jadi "perantara", mereka yang catat bahwa kamu sudah kirim uang dan temanmu sudah terima. Tapi Bitcoin <strong class="text-crypto-gold">nggak butuh perantara</strong> sama sekali!',
    mod02_card_p2:  'Bitcoin pakai blockchain (yang udah kita pelajari tadi) sebagai buku catatan publik. Jadi semua orang bisa <em>verifikasi</em> transaksimu, tanpa perlu bank, tanpa perlu izin siapapun. 🎉',
    mod02_mining_title: 'Mining (Penambangan)',
    mod02_mining_desc: 'Bitcoin nggak dicetak kayak uang kertas. Bitcoin "ditambang" menggunakan komputer. Para <strong class="text-white">miner</strong> berlomba-lomba memecahkan teka-teki matematika yang susah. Yang berhasil duluan berhak menambahkan blok baru ke blockchain, dan dapat <strong class="text-crypto-gold">hadiah Bitcoin</strong> sebagai imbalan.',
    mod02_halving_title: 'Halving',
    mod02_halving_desc: 'Setiap 210.000 blok (kira-kira 4 tahun sekali), hadiah mining <strong class="text-white">dipotong setengahnya</strong>. Ini yang disebut "halving". Tujuannya agar Bitcoin makin langka seiring waktu, mirip kayak emas yang semakin susah ditambang.',
    mod02_wallet_title: 'Wallet & Kunci',
    mod02_wallet_desc: 'Wallet Bitcoin itu bukan "dompet" yang nyimpen Bitcoin beneran, tapi menyimpan dua hal penting:',
    mod02_pubkey_desc: '= Nomor rekening kamu. Boleh dibagiin ke siapa aja buat nerima Bitcoin.',
    mod02_privkey_desc: '= PIN rahasia. JANGAN pernah dibagiin! Ini yang membuktikan Bitcoin itu punyamu.',
    mod02_supply_title: 'Supply Terbatas = 21 Juta',
    mod02_supply_desc: 'Bitcoin yang akan pernah ada di dunia ini hanya <strong class="text-crypto-gold">21 juta BTC</strong>, selamanya. Nggak bisa ditambah, nggak bisa dicetak sesuka hati.',
    mod02_supply_mined: 'Sudah ditambang',
    mod02_supply_left: 'Sisa: ~1.3 juta BTC · Prediksi habis: tahun ~2140',
    mod02_tx_title: '⚡ Gimana Transaksi Bitcoin Bekerja?',
    mod02_tx1: '<strong class="text-white">Kamu mau kirim Bitcoin</strong> ke temanmu. Kamu masukkan alamat wallet-nya dan jumlah BTC yang mau dikirim.',
    mod02_tx2: '<strong class="text-white">Wallet kamu "tanda tangan"</strong> transaksi ini pakai private key, seperti tanda tangan digital yang membuktikan bahwa kamu yang kirim.',
    mod02_tx3: '<strong class="text-white">Transaksi masuk "mempool"</strong>, yaitu ruang tunggu di mana transaksi-transaksi menunggu untuk diproses para miner.',
    mod02_tx4: '<strong class="text-white">Miner memilih transaksimu</strong> dan memasukkannya ke blok baru. Setelah ±10 menit, transaksimu <strong class="text-crypto-gold">dikonfirmasi</strong>! 🎉',
    mod02_tx5: '<strong class="text-white">Temanmu menerima Bitcoin</strong>. Transaksi tercatat permanen di blockchain dan tidak bisa diubah oleh siapapun.',
    mod02_funfact: '<strong class="text-white">Fun Fact:</strong> Bitcoin pertama kali dipakai untuk transaksi nyata pada 22 Mei 2010, seorang programmer beli <strong class="text-crypto-gold">2 pizza seharga 10.000 BTC</strong>. Dengan harga Bitcoin sekarang, pizza itu nilainya ratusan juta dollar! Tanggal itu kini dirayakan sebagai <em>"Bitcoin Pizza Day"</em> setiap tahunnya. 🍕',

    // Features
    feat_title:     'Apa Lagi yang Akan Kamu Pelajari?',
    feat_subtitle:  'Dari dasar hingga praktik langsung, semua ada di sini.',
    feat1_title:    'Blockchain Dasar ✅',
    feat1_desc:     'Sudah kamu pelajari di atas! Cara kerja blockchain, konsensus, hash, dan kenapa teknologi ini revolusioner.',
    feat1_badge:    'Selesai',
    feat2_title:    'Cara Kerja Bitcoin ✅',
    feat2_desc:     'Sudah kamu pelajari! Mining, halving, wallet, private key, dan kenapa supply Bitcoin terbatas.',
    feat2_badge:    'Selesai',
    feat3_title:    'Kripto & DeFi',
    feat3_desc:     'Ethereum, stablecoin, staking, liquidity pool, dan yield farming explained.',
    feat3_badge:    'Segera',
    feat4_title:    'NFT & Metaverse',
    feat4_desc:     'Apa itu NFT, cara mint, jual-beli, dan potensinya di dunia digital.',
    feat4_badge:    'Coming Soon',
    feat5_title:    'Connect Wallet ✅',
    feat5_desc:     'Hubungkan MetaMask kamu langsung ke KriptoEdu via tombol di navbar.',
    feat5_badge:    'Live!',
    feat6_title:    'Tip Jar Kripto ✅',
    feat6_desc:     'Donasi ETH langsung via MetaMask! Pilih nominal, klik kirim, selesai. Konfeti menanti kamu! 🎉',
    feat6_badge:    'Live! Coba Sekarang →',

    // Curriculum
    curr_title:     'Kurikulum Terstruktur',
    curr_subtitle:  'Belajar step-by-step dari pemula hingga bisa pakai dApp sendiri.',
    curr1_title:    'Pengenalan Blockchain & Kripto',
    curr1_meta:     '5 pelajaran · 30 menit',
    curr1_badge:    '✅ Ada di halaman ini',
    curr2_title:    'Cara Kerja Bitcoin & Ethereum',
    curr2_meta:     '8 pelajaran · 1 jam',
    curr2_badge:    '✅ Ada di halaman ini',
    curr3_title:    'Setup Wallet & Koneksi MetaMask',
    curr3_meta:     'Live di navbar!',
    curr3_badge:    '✅ Live!',
    curr4_title:    'Tip Jar: Donasi Kripto via MetaMask',
    curr4_meta:     'Klik untuk coba donasi!',
    curr4_badge:    '✅ Live!',
    curr5_title:    'DeFi & Smart Contract',
    curr5_meta:     '10 pelajaran · 2 jam',
    curr5_badge:    'Coming Soon',

    // CTA
    cta_title:      'Siap Masuk Dunia Web3?',
    cta_desc:       'Hubungkan wallet & dukung KriptoEdu dengan tip kecil kamu!',
    cta_btn1:       '🔗 Connect Wallet',
    cta_btn2:       '💛 Kirim Tip Kripto',

    // Footer
    footer_copy:    '© 2026 KriptoEdu · Dibuat dengan ❤️ untuk komunitas Web3 Indonesia',
    footer_donate:  '💛 Dukung KriptoEdu dengan Tip Kripto',
  },

  en: {
    // Navbar
    nav_learn:      'Learn',
    nav_blockchain: 'Blockchain',
    nav_bitcoin:    'Bitcoin',
    nav_module:     'Modules',
    nav_donate:     '💛 Donate',
    nav_start:      'Start Free →',
    nav_wallet:     '🔗 Wallet',

    // Hero
    hero_badge:     '🚀 Indonesia\'s #1 Web3 Education Platform',
    hero_h1_1:      'Understand Crypto &',
    hero_h1_2:      'Web3 from Scratch',
    hero_desc:      'Learn blockchain, DeFi, NFT, and how crypto wallets work, with beginner-friendly content. No jargon, no hassle.',
    hero_cta1:      'Start Learning Now',
    hero_cta2:      '💛 Support Us',
    hero_stat1_lbl: 'Active Learners',
    hero_stat2_lbl: 'Free Modules',
    hero_stat3_lbl: 'In Indonesian',

    // Blockchain section
    mod01_label:    'Module 01',
    mod01_title:    '⛓️ What is <span class="text-crypto-blue">Blockchain</span>?',
    mod01_intro:    'You\'ve heard the word "blockchain" but have no idea what it means? No worries, let\'s break it down in the simplest way possible.',
    mod01_card_title: 'Imagine a Magic Notebook',
    mod01_card_p1:  'Imagine you have a <strong class="text-white">notebook</strong> that records all money transactions. Every time a new transaction happens (e.g., you send money to a friend), it gets written in that notebook.',
    mod01_card_p2:  'What makes <strong class="text-crypto-blue">blockchain special</strong>: this notebook is <em>not held by just one person</em>, but stored across <strong class="text-white">thousands of computers</strong> worldwide simultaneously. If anyone tries to cheat and alter a record, all other computers immediately detect and reject it! 🚫',
    mod01_k1_title: 'Block + Chain',
    mod01_k1_desc:  'Data is stored in "blocks". Each new block connects to the previous one, forming a "chain". That\'s where the name <em>block-chain</em> comes from!',
    mod01_k2_title: 'Decentralization',
    mod01_k2_desc:  'There\'s no single "boss" in charge. Data is spread across many computers (called <em>nodes</em>), so no single party can control everything.',
    mod01_k3_title: 'Transparent & Secure',
    mod01_k3_desc:  'All transactions are visible to everyone (transparent), yet user identities remain anonymous. And once data is recorded, it\'s <em>nearly impossible</em> to alter.',
    mod01_flow_title: '🔍 How Does It Work?',
    mod01_step1_title: '1. Transaction Occurs',
    mod01_step1_desc:  'You send Bitcoin to your friend',
    mod01_step2_title: '2. Broadcast to Network',
    mod01_step2_desc:  'Thousands of nodes receive the info',
    mod01_step3_title: '3. Verified',
    mod01_step3_desc:  'Nodes agree the transaction is valid',
    mod01_step4_title: '4. Added to Block',
    mod01_step4_desc:  'Transaction is permanently on blockchain',
    faq_label:      '❓ Frequently Asked Questions:',
    faq1_q:         'Who "guards" the blockchain if there\'s no boss?',
    faq1_a:         'It\'s maintained by <strong class="text-white">miners</strong> and <strong class="text-white">validators</strong>, people worldwide who provide their computers to process and verify transactions. They are rewarded with crypto as payment for their computational work.',
    faq2_q:         'Is blockchain only for crypto?',
    faq2_a:         'Not at all! Blockchain can be used for many things: supply chain tracking, digital voting, educational certificates, medical records, and much more. Crypto is just the most well-known application of blockchain.',
    faq3_q:         'Why is blockchain data hard to fake?',
    faq3_a:         'Each block has a "<strong class="text-white">hash</strong>", a unique fingerprint derived from its data. Change even one character and the hash changes entirely. Since each block includes the previous block\'s hash, you\'d need to alter <em>every block from the beginning</em>, faster than thousands of computers. Nearly impossible! 😅',

    // Bitcoin section
    mod02_label:    'Module 02',
    mod02_title:    '₿ How <span class="text-crypto-gold">Bitcoin</span> Works',
    mod02_intro:    'Bitcoin is the world\'s first digital currency that operates without a bank. But how does it actually work? Let\'s find out!',
    mod02_card_title: 'Money Without a Bank? Really?',
    mod02_card_p1:  'When you transfer money through a bank, the bank acts as the "middleman", they record that you sent money and your friend received it. But Bitcoin <strong class="text-crypto-gold">needs no middleman</strong> at all!',
    mod02_card_p2:  'Bitcoin uses blockchain (what we just learned) as a public ledger. So anyone can <em>verify</em> your transaction, no bank needed, no permission required. 🎉',
    mod02_mining_title: 'Mining',
    mod02_mining_desc: 'Bitcoin isn\'t printed like paper money. It\'s "mined" using computers. <strong class="text-white">Miners</strong> compete to solve complex math puzzles. The first to solve it gets to add a new block to the blockchain and earns a <strong class="text-crypto-gold">Bitcoin reward</strong>.',
    mod02_halving_title: 'Halving',
    mod02_halving_desc: 'Every 210,000 blocks (~4 years), the mining reward is <strong class="text-white">cut in half</strong>. This is called "halving". The goal is to make Bitcoin scarcer over time, like gold that gets harder to mine.',
    mod02_wallet_title: 'Wallet & Keys',
    mod02_wallet_desc: 'A Bitcoin wallet doesn\'t actually store Bitcoin. It stores two important things:',
    mod02_pubkey_desc: '= Your account number. You can share this with anyone to receive Bitcoin.',
    mod02_privkey_desc: '= Your secret PIN. NEVER share this! It proves the Bitcoin is yours.',
    mod02_supply_title: 'Fixed Supply = 21 Million',
    mod02_supply_desc: 'Only <strong class="text-crypto-gold">21 million BTC</strong> will ever exist, forever. It cannot be increased or printed at will.',
    mod02_supply_mined: 'Already mined',
    mod02_supply_left: 'Remaining: ~1.3M BTC · Estimated exhaustion: ~2140',
    mod02_tx_title: '⚡ How Does a Bitcoin Transaction Work?',
    mod02_tx1: '<strong class="text-white">You want to send Bitcoin</strong> to your friend. You enter their wallet address and the amount of BTC to send.',
    mod02_tx2: '<strong class="text-white">Your wallet "signs"</strong> the transaction using your private key, like a digital signature proving you authorized it.',
    mod02_tx3: '<strong class="text-white">The transaction enters the "mempool"</strong>, a waiting room where transactions wait to be processed by miners.',
    mod02_tx4: '<strong class="text-white">A miner picks your transaction</strong> and includes it in a new block. After ~10 minutes, your transaction is <strong class="text-crypto-gold">confirmed</strong>! 🎉',
    mod02_tx5: '<strong class="text-white">Your friend receives Bitcoin</strong>. The transaction is permanently recorded on the blockchain and cannot be altered by anyone.',
    mod02_funfact: '<strong class="text-white">Fun Fact:</strong> Bitcoin was first used in a real transaction on May 22, 2010, a programmer bought <strong class="text-crypto-gold">2 pizzas for 10,000 BTC</strong>. At today\'s Bitcoin price, those pizzas would be worth hundreds of millions of dollars! That date is now celebrated as <em>"Bitcoin Pizza Day"</em> every year. 🍕',

    // Features
    feat_title:     'What Else Will You Learn?',
    feat_subtitle:  'From basics to hands-on practice, everything is here.',
    feat1_title:    'Blockchain Basics ✅',
    feat1_desc:     'Already covered above! How blockchain works, consensus, hashing, and why this tech is revolutionary.',
    feat1_badge:    'Done',
    feat2_title:    'How Bitcoin Works ✅',
    feat2_desc:     'Already covered! Mining, halving, wallets, private keys, and why Bitcoin\'s supply is limited.',
    feat2_badge:    'Done',
    feat3_title:    'Crypto & DeFi',
    feat3_desc:     'Ethereum, stablecoins, staking, liquidity pools, and yield farming explained.',
    feat3_badge:    'Coming Soon',
    feat4_title:    'NFT & Metaverse',
    feat4_desc:     'What is an NFT, how to mint, buy and sell, and its potential in the digital world.',
    feat4_badge:    'Coming Soon',
    feat5_title:    'Connect Wallet ✅',
    feat5_desc:     'Connect your MetaMask directly to KriptoEdu via the navbar button.',
    feat5_badge:    'Live!',
    feat6_title:    'Crypto Tip Jar ✅',
    feat6_desc:     'Donate ETH directly via MetaMask! Choose amount, click send, done. Confetti awaits! 🎉',
    feat6_badge:    'Live! Try Now →',

    // Curriculum
    curr_title:     'Structured Curriculum',
    curr_subtitle:  'Learn step-by-step from beginner to using your first dApp.',
    curr1_title:    'Introduction to Blockchain & Crypto',
    curr1_meta:     '5 lessons · 30 minutes',
    curr1_badge:    '✅ On this page',
    curr2_title:    'How Bitcoin & Ethereum Work',
    curr2_meta:     '8 lessons · 1 hour',
    curr2_badge:    '✅ On this page',
    curr3_title:    'Wallet Setup & MetaMask Connection',
    curr3_meta:     'Live in navbar!',
    curr3_badge:    '✅ Live!',
    curr4_title:    'Tip Jar: Crypto Donation via MetaMask',
    curr4_meta:     'Click to try donating!',
    curr4_badge:    '✅ Live!',
    curr5_title:    'DeFi & Smart Contracts',
    curr5_meta:     '10 lessons · 2 hours',
    curr5_badge:    'Coming Soon',

    // CTA
    cta_title:      'Ready to Enter the Web3 World?',
    cta_desc:       'Connect your wallet & support KriptoEdu with a small tip!',
    cta_btn1:       '🔗 Connect Wallet',
    cta_btn2:       '💛 Send Crypto Tip',

    // Footer
    footer_copy:    '© 2026 KriptoEdu · Made with ❤️ for the Web3 community',
    footer_donate:  '💛 Support KriptoEdu with a Crypto Tip',
  }
};

// STATE
let currentLang = localStorage.getItem('kriptoedu_lang') || 'id';

// CORE

/** Ambil teks terjemahan */
function t(key) {
  return TRANSLATIONS[currentLang]?.[key] ?? TRANSLATIONS.id[key] ?? key;
}

/** Terapkan semua terjemahan ke DOM */
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = val;
    } else {
      el.innerHTML = val;
    }
  });

  document.documentElement.lang = currentLang;
  updateLangButton();
  document.title = currentLang === 'en'
    ? 'KriptoEdu: Learn Web3 from Scratch'
    : 'KriptoEdu: Belajar Web3 Mulai dari Nol';
}

/** Update tampilan tombol ganti bahasa */
function updateLangButton() {
  const btn = document.getElementById('lang-switcher-btn');
  if (!btn) return;
  if (currentLang === 'id') {
    btn.innerHTML = `<span class="text-base">🇬🇧</span><span>EN</span>`;
    btn.title = 'Switch to English';
  } else {
    btn.innerHTML = `<span class="text-base">🇮🇩</span><span>ID</span>`;
    btn.title = 'Ganti ke Bahasa Indonesia';
  }
}

/** Toggle bahasa */
function toggleLanguage() {
  currentLang = currentLang === 'id' ? 'en' : 'id';
  localStorage.setItem('kriptoedu_lang', currentLang);
  applyTranslations();

  if (typeof showToast === 'function') {
    showToast(
      currentLang === 'en' ? '🇬🇧 Switched to English!' : '🇮🇩 Berhasil ganti ke Bahasa Indonesia!',
      'info'
    );
  }
}

// INJECT BUTTON

/** Inject tombol lang switcher ke navbar */
function injectLangSwitcher() {
  if (document.getElementById('lang-switcher-btn')) return;

  const btn = document.createElement('button');
  btn.id        = 'lang-switcher-btn';
  btn.type      = 'button';
  btn.onclick   = toggleLanguage;
  btn.className = [
    'hidden md:inline-flex items-center gap-1.5',
    'bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/30',
    'text-slate-300 hover:text-white',
    'text-xs font-bold px-3 py-2 rounded-full',
    'transition-all duration-200 cursor-pointer',
  ].join(' ');
  btn.title = 'Switch to English';
  btn.innerHTML = `<span class="text-base">🇬🇧</span><span>EN</span>`;

  const btnMobile = document.createElement('button');
  btnMobile.type      = 'button';
  btnMobile.onclick   = toggleLanguage;
  btnMobile.className = 'md:hidden flex items-center gap-1 bg-white/5 border border-white/10 text-slate-300 text-xs font-bold px-2.5 py-1.5 rounded-full transition';
  btnMobile.innerHTML = `<span>🌐</span>`;

  const navRight = document.querySelector('nav .hidden.md\\:flex.items-center.gap-3');
  if (navRight) navRight.prepend(btn);

  const mobileNav = document.querySelector('nav .md\\:hidden.flex.items-center.gap-2');
  if (mobileNav) mobileNav.prepend(btnMobile);
}

// INIT

function initI18n() {
  injectLangSwitcher();
  applyTranslations();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initI18n);
} else {
  initI18n();
}
