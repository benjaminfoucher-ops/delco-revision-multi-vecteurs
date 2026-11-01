/* DELCO Révision : lit les QR texte des cours DELCO et les affiche en fiches. Aucun envoi réseau. */
(function () {
  'use strict';
  var view = document.getElementById('view');
  var KEY = 'delco-fiches-v1';
  var SEP = /^━+$/;
  var KEYCAPS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function toast(m) { var t = document.getElementById('toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(function () { t.style.display = 'none'; }, 2500); }
  // Les fiches enregistrées avant le multi-vecteurs n'ont pas de vecteur : on les relit depuis leur texte.
  function load() {
    var list;
    try { list = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
    return list.map(function (c) { return c.vec && c.label ? c : parse(c.raw); }).filter(function (c) { return c.kind !== 'raw'; });
  }
  function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} }

  /* ---------- Lecture du texte d'un QR ---------- */
  // Ligne 1 : « 🚁 DELCO · COURS 3/7 » → vecteur « DELCO », cours 3, total 7 (le total est facultatif).
  // Autres documents du stage : « 🚁 DJI MINI 3 · TEST » ou « 🚁 DJI MINI 3 · EMPLOI DU TEMPS » (sans numéro).
  function head(line) {
    var l = String(line || '').trim();
    var m = /^(.*?)[\s·•|:–—-]*\bCOURS\s+(\d+)(?:\s*\/\s*(\d+))?/i.exec(l), label;
    if (m) label = 'COURS ' + m[2] + (m[3] ? '/' + m[3] : '');
    else {
      var d = /^(.*\S)\s+·\s+(\S.*)$/.exec(l);
      if (!d) return null;
      m = [l, d[1], null, null]; label = d[2].toUpperCase();
    }
    var pre = m[1].trim(), emoji = '';
    var e = /^([^\p{L}\p{N}\s]+)\s*/u.exec(pre);
    if (e) { emoji = e[1]; pre = pre.slice(e[0].length); }
    pre = pre.replace(/[\s·•|:–—-]+$/, '').trim();
    return { vec: pre ? pre.toUpperCase() : 'DELCO', emoji: emoji, num: m[2] ? +m[2] : null, total: m[3] ? +m[3] : null, label: label };
  }
  function parse(text) {
    var lines = text.replace(/\r/g, '').split('\n');
    var hd = head(lines[0]);
    var card = { raw: text, num: hd ? hd.num : null, vec: hd ? hd.vec : '', emoji: hd ? hd.emoji : '', total: hd ? hd.total : null, label: hd ? hd.label : '', title: '', pill: '', kind: 'raw' };
    if (lines[1]) card.title = lines[1].replace(/^\S+\s/, '').trim();
    if (/CARTE MENTALE/.test(text)) card.kind = 'memo';
    else if (/QUESTIONS/.test(text)) card.kind = 'quiz';
    else if (hd && card.num === null) card.kind = 'memo'; // document du stage : même mise en page que la carte mentale
    if (!hd) card.kind = 'raw';
    // corps entre le 1er et le dernier séparateur
    var seps = []; lines.forEach(function (l, i) { if (SEP.test(l.trim())) seps.push(i); });
    var body = lines.slice((seps[0] || 1) + 1);
    // 1re ligne du corps (« 🗺️ CARTE MENTALE », « ❓ QUESTIONS… », « 📅 EMPLOI DU TEMPS ») = bandeau de la fiche
    for (var b0 = 0; b0 < body.length; b0++) {
      var l0 = body[b0].trim();
      if (!l0) continue;
      if (!/^[▪⚠✅]/.test(l0) && !SEP.test(l0)) { card.pill = l0; body.splice(b0, 1); }
      break;
    }
    if (card.kind === 'memo') {
      var end = seps.length > 1 ? seps[seps.length - 1] - seps[0] - 1 : body.length;
      body = body.slice(0, end);
      card.blocks = []; card.alerts = [];
      var cur = null;
      body.forEach(function (l) {
        l = l.trim();
        if (!l) { cur = null; return; }
        if (/^⚠/.test(l)) { card.alerts.push(l.replace(/^⚠️?\s*/, '')); cur = null; return; }
        if (/^▪/.test(l)) { if (cur) cur.items.push(l.replace(/^▪️?\s*/, '')); return; }
        var sp = l.indexOf(' ');
        cur = { emoji: sp > 0 ? l.slice(0, sp) : '•', name: sp > 0 ? l.slice(sp + 1) : l, items: [] };
        card.blocks.push(cur);
      });
    } else if (card.kind === 'quiz') {
      card.qs = []; var answers = {}; var inAns = false;
      body.forEach(function (l) {
        l = l.trim(); if (!l || SEP.test(l)) return;
        if (/^✅/.test(l)) { inAns = true; return; }
        if (inAns) { var a = /^(\d+)\)\s*(.*)$/.exec(l); if (a) answers[+a[1]] = a[2]; return; }
        var o = /^([A-H])\)\s+(.*)$/.exec(l); // choix de QCM sous la question
        if (o && card.qs.length) { var lq = card.qs[card.qs.length - 1]; (lq.opts = lq.opts || []).push(o[1] + ') ' + o[2]); return; }
        for (var k = 0; k < KEYCAPS.length; k++) {
          if (l.indexOf(KEYCAPS[k]) === 0) { card.qs.push({ n: k + 1, q: l.slice(KEYCAPS[k].length).trim() }); return; }
        }
        var d = /^(\d+)[.)]\s+(.*)$/.exec(l); if (d) card.qs.push({ n: +d[1], q: d[2] });
      });
      card.qs.forEach(function (q) { q.a = answers[q.n] || '—'; });
      if (!card.qs.length) card.kind = 'raw';
    }
    card.id = card.vec + '-' + card.label + '-' + card.kind + '-' + text.length;
    return card;
  }

  /* ---------- Affichage ---------- */
  function hero(card, label) {
    return '<div class="hero"><div class="k">' + esc((card.emoji ? card.emoji + ' ' : '') + card.vec + ' · ' + card.label) + '</div><h2>' + esc(card.title) + '</h2><span class="pill">' + esc(card.pill || label) + '</span></div>';
  }
  // « 🗺️ CARTE MENTALE » → ['🗺️', 'Carte mentale']
  function pillParts(card) {
    var p = card.pill || (card.kind === 'memo' ? '🗺️ CARTE MENTALE' : '❓ QUESTIONS DE RÉVISION'), sp = p.indexOf(' ');
    var e = sp > 0 && !/[\p{L}\p{N}]/u.test(p.slice(0, sp)) ? p.slice(0, sp) : '📄', t = e === '📄' ? p : p.slice(sp + 1);
    return [e, t.charAt(0) + t.slice(1).toLowerCase()];
  }
  function showCard(card) {
    var h = '';
    if (card.kind === 'memo') {
      h += hero(card, '🗺️ CARTE MENTALE');
      card.alerts.forEach(function (a) { h += '<div class="alert">⚠️ ' + esc(a) + '</div>'; });
      h += '<div class="grid" style="margin-top:12px">';
      card.blocks.forEach(function (b) {
        var short = b.items.length > 2 && b.items.every(function (i) { return i.length <= 14; });
        h += '<div class="box' + (short ? ' chips' : '') + '"><h3><span class="e">' + esc(b.emoji) + '</span>' + esc(b.name) + '</h3><ul>';
        b.items.forEach(function (i) { h += '<li>' + esc(i) + '</li>'; });
        h += '</ul></div>';
      });
      h += '</div>';
    } else if (card.kind === 'quiz') {
      h += hero(card, '❓ QUESTIONS DE RÉVISION');
      h += '<p style="color:var(--muted);margin:0 0 12px">Réfléchis d\'abord, puis touche « Voir la réponse » et note-toi.</p>';
      card.qs.forEach(function (q, i) {
        h += '<div class="q" data-i="' + i + '"><div class="txt"><span class="n">' + q.n + '</span><span>' + esc(q.q) + '</span></div>' + (q.opts ? '<ul class="opts">' + q.opts.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('') + '</ul>' : '') +
             '<button type="button" class="reveal">Voir la réponse</button><div class="ans">✅ ' + esc(q.a) +
             '<div class="score"><button type="button" data-r="ok">👍 Je savais</button><button type="button" data-r="ko">👎 À revoir</button></div></div></div>';
      });
      h += '<div id="result" class="foot" style="font-size:15px"></div>';
    } else {
      h += '<div class="raw">' + esc(card.raw) + '</div>';
    }
    h += '<div class="row"><button class="btn ghost" id="back">⬅ Mes fiches</button></div>';
    h += '<div class="foot">3e RIMa · NON PROTÉGÉ · lu sans réseau</div>';
    view.innerHTML = h; window.scrollTo(0, 0);
    document.getElementById('back').onclick = function () { location.hash = ''; showHome(); };
    if (card.kind === 'quiz') {
      var res = {};
      view.querySelectorAll('.q').forEach(function (el) {
        el.querySelector('.reveal').onclick = function () { el.classList.add('open'); };
        el.querySelectorAll('[data-r]').forEach(function (b) {
          b.onclick = function () {
            el.classList.remove('ok', 'ko'); el.classList.add(b.dataset.r); res[el.dataset.i] = b.dataset.r;
            var keys = Object.keys(res), ok = keys.filter(function (k) { return res[k] === 'ok'; }).length;
            document.getElementById('result').textContent = 'Score : ' + ok + ' / ' + card.qs.length + (keys.length < card.qs.length ? ' (en cours)' : (ok === card.qs.length ? ' 🎖️ Parfait !' : ''));
          };
        });
      });
    }
  }
  function showHome() {
    var list = load();
    var h = '';
    if (!list.length) {
      h += '<div class="empty"><div style="font-size:54px">📷</div><p><b>Aucune fiche pour l\'instant.</b></p>' +
           '<p>Scanne le QR « Carte mentale » ou « Questions » affiché à la fin de chaque cours. La fiche reste enregistrée sur ton téléphone, même sans réseau.</p></div>';
    } else {
      list.sort(function (a, b) { return (a.vec < b.vec ? -1 : a.vec > b.vec ? 1 : 0) || ((a.num === null) - (b.num === null)) || ((a.num || 0) - (b.num || 0)) || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0) || (a.kind < b.kind ? -1 : 1); });
      h += '<h2 class="sec">Mes fiches</h2>';
      var groups = [];
      list.forEach(function (c, i) {
        var g = groups[groups.length - 1];
        if (!g || g.vec !== c.vec) { g = { vec: c.vec, emoji: '', total: null, nums: {}, items: [] }; groups.push(g); }
        if (c.emoji) g.emoji = c.emoji;
        if (c.total) g.total = Math.max(g.total || 0, c.total);
        if (c.num !== null) g.nums[c.num] = 1; g.items.push(i);
      });
      groups.forEach(function (g) {
        var n = Object.keys(g.nums).length;
        h += '<h3 class="vec"><span>' + esc((g.emoji ? g.emoji + ' ' : '') + g.vec) + '</span><span class="cnt">' + (n ? n + (g.total ? ' / ' + g.total : '') + ' cours' : '') + '</span></h3><div class="list">';
        g.items.forEach(function (i) {
          var c = list[i], pp = pillParts(c);
          h += '<a href="#" data-i="' + i + '"><span class="tag">' + esc(pp[0]) + '</span><span><span class="t">' + (c.num !== null ? 'Cours ' + c.num + ' · ' : '') + esc(c.title) + '</span><br><span class="s">' + esc(pp[1]) + '</span></span></a>';
        });
        h += '</div>';
      });
    }
    h += '<div class="row"><button class="btn ghost" id="photoBtn">🖼️ Lire depuis une photo</button><button class="btn ghost" id="pasteBtn">📋 Coller un texte</button></div>';
    if (list.length) h += '<div class="row"><button class="btn ghost" id="clearBtn" style="color:var(--red)">🗑️ Effacer mes fiches</button></div>';
    var pws = getPws();
    if (pws.length) {
      var who = []; pws.forEach(function (p) { p.vecs.forEach(function (v) { if (who.indexOf(v) < 0) who.push(v); }); });
      h += '<div class="row"><button class="btn ghost" id="pwBtn">🔑 Oublier ' + (pws.length > 1 ? 'les mots de passe' : 'le mot de passe') + (who.length ? ' (' + esc(who.join(', ')) + ')' : '') + '</button></div>';
    }
    h += '<div class="foot">Appli hors ligne : rien n\'est envoyé sur Internet.<br>Astuce : menu du navigateur › « Ajouter à l\'écran d\'accueil ».</div>';
    view.innerHTML = h;
    view.querySelectorAll('.list a').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); showCard(list[+a.dataset.i]); }; });
    document.getElementById('photoBtn').onclick = function () { document.getElementById('photo').click(); };
    document.getElementById('pasteBtn').onclick = showPaste;
    var pb = document.getElementById('pwBtn');
    if (pb) pb.onclick = function () { savePws([]); toast('Mots de passe oubliés'); showHome(); };
    var cb = document.getElementById('clearBtn');
    if (cb) cb.onclick = function () { if (confirm('Effacer toutes les fiches enregistrées ?')) { save([]); showHome(); } };
  }
  function showPaste() {
    view.innerHTML = '<h2 class="sec">Coller le texte d\'un QR</h2><textarea id="ta" placeholder="Colle ici le texte lu par une autre appli"></textarea>' +
      '<div class="row"><button class="btn ghost" id="cancel">Annuler</button><button class="btn primary" id="ok">Afficher</button></div>';
    document.getElementById('cancel').onclick = showHome;
    document.getElementById('ok').onclick = function () { var t = document.getElementById('ta').value.trim(); if (t) handle(t); };
  }
  function store(card) {
    if (card.kind !== 'raw') {
      var list = load().filter(function (c) { return !(c.vec === card.vec && c.label === card.label && c.kind === card.kind); });
      list.push(card); save(list);
      toast('Fiche enregistrée ✔');
    }
    showCard(card);
  }

  /* ---------- Déchiffrement (QR « DELCO1: » = AES-GCM + PBKDF2, texte compressé) ---------- */
  // Mots de passe retenus : [{ pw, vecs: ['DELCO', …] }]. Un mot de passe commun couvre plusieurs vecteurs,
  // sinon chaque vecteur a le sien. Le vecteur n'est connu qu'après déchiffrement, donc on essaie chaque mot de passe retenu.
  var PWKEY = 'delco-mdp-v2', OLDPWKEY = 'delco-mdp-v1', ITER = 150000;
  function getPws() {
    var l = null;
    try { l = JSON.parse(localStorage.getItem(PWKEY)); } catch (e) {}
    if (!Array.isArray(l)) {
      l = [];
      try { var old = localStorage.getItem(OLDPWKEY); if (old) l.push({ pw: old, vecs: [] }); } catch (e) {}
    }
    return l;
  }
  function savePws(l) {
    try { localStorage.setItem(PWKEY, JSON.stringify(l)); localStorage.removeItem(OLDPWKEY); } catch (e) {}
  }
  // Retient pw pour le vecteur vec, et le place en tête pour être essayé en premier la fois suivante.
  function rememberPw(pw, vec) {
    // Les autres mots de passe sont gardés : un vecteur peut changer de mot de passe d'un stage à l'autre.
    var l = getPws(), cur = null;
    l.forEach(function (p) { if (p.pw === pw) cur = p; });
    if (!cur) cur = { pw: pw, vecs: [] };
    if (vec && cur.vecs.indexOf(vec) < 0) cur.vecs.push(vec);
    savePws([cur].concat(l.filter(function (p) { return p !== cur; })).slice(0, 10));
  }
  function tryPws(payload, l) {
    if (!l.length) return Promise.reject(new Error('none'));
    return decrypt(payload, l[0].pw).then(function (t) { return { text: t, pw: l[0].pw }; }, function (e) {
      if (e && e.message === 'nocrypto') throw e;
      return tryPws(payload, l.slice(1));
    });
  }
  function b64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function decrypt(payload, pw) {
    if (!window.crypto || !crypto.subtle) return Promise.reject(new Error('nocrypto'));
    var u = b64(payload.slice(7).trim()), salt = u.slice(0, 16), iv = u.slice(16, 28), ct = u.slice(28);
    return crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey'])
      .then(function (k) { return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: ITER, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['decrypt']); })
      .then(function (key) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct); })
      .then(function (raw) {
        var ds = new DecompressionStream('deflate-raw');
        return new Response(new Blob([raw]).stream().pipeThrough(ds)).text();
      });
  }
  function askPw(payload, err) {
    view.innerHTML = '<div class="hero"><div class="k">QR PROTÉGÉ</div><h2>🔒 Mot de passe</h2><span class="pill">DONNÉ PAR TON INSTRUCTEUR</span></div>' +
      (err ? '<div class="alert">' + err + '</div>' : '') +
      '<input id="pw" type="password" autocomplete="current-password" placeholder="Mot de passe du cours" style="width:100%;margin-top:12px;padding:14px;font-size:17px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--text)">' +
      '<label style="display:flex;gap:8px;align-items:center;margin-top:10px;color:var(--muted)"><input type="checkbox" id="rem" checked> Retenir sur ce téléphone</label>' +
      '<div class="row"><button class="btn ghost" id="cancel">Annuler</button><button class="btn primary" id="ok">Déverrouiller</button></div>';
    var inp = document.getElementById('pw'); inp.focus();
    document.getElementById('cancel').onclick = showHome;
    var go = function () {
      var v = inp.value.trim(); if (!v) return;
      decrypt(payload, v).then(function (t) {
        var card = parse(t);
        if (document.getElementById('rem').checked) rememberPw(v, card.vec);
        store(card);
      }).catch(function (e) {
        askPw(payload, e && e.message === 'nocrypto' ? 'Ouvre l\'appli depuis son adresse https (ou l\'icône installée).' : 'Mot de passe incorrect.');
      });
    };
    document.getElementById('ok').onclick = go;
    inp.onkeydown = function (e) { if (e.key === 'Enter') go(); };
  }
  function handle(text) {
    if (/^DELCO1:/.test(text)) {
      var pws = getPws();
      if (!pws.length) return askPw(text);
      toast('Déverrouillage…');
      tryPws(text, pws).then(function (r) { var card = parse(r.text); rememberPw(r.pw, card.vec); store(card); })
        .catch(function (e) {
          askPw(text, e && e.message === 'nocrypto' ? 'Ouvre l\'appli depuis son adresse https (ou l\'icône installée).'
            : 'Ce QR utilise un autre mot de passe que ceux retenus (nouveau vecteur ou mot de passe changé) : saisis-le.');
        });
      return;
    }
    store(parse(text));
  }

  /* ---------- Scan ---------- */
  var video = document.getElementById('video'), scanner = document.getElementById('scanner');
  var cv = document.getElementById('cv'), ctx = cv.getContext('2d', { willReadFrequently: true });
  var stream = null, running = false, detector = null;
  try { if ('BarcodeDetector' in window) detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { detector = null; }

  function decodeBytes(r) {
    try { if (r.binaryData && r.binaryData.length) return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(r.binaryData)); } catch (e) {}
    return r.data;
  }
  function jsqrFrom(source, w, h) {
    var scale = Math.min(1, 1000 / Math.max(w, h));
    cv.width = Math.round(w * scale); cv.height = Math.round(h * scale);
    ctx.drawImage(source, 0, 0, cv.width, cv.height);
    var img = ctx.getImageData(0, 0, cv.width, cv.height);
    var r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
    return r ? decodeBytes(r) : null;
  }
  function stop() {
    running = false; scanner.style.display = 'none';
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
  }
  function found(text) { stop(); if (navigator.vibrate) navigator.vibrate(80); handle(text); }
  function tick() {
    if (!running) return;
    if (video.readyState >= 2 && video.videoWidth) {
      if (detector) {
        detector.detect(video).then(function (codes) {
          if (codes.length && running) found(codes[0].rawValue); else requestAnimationFrame(tick);
        }).catch(function () { detector = null; requestAnimationFrame(tick); });
        return;
      }
      var t = jsqrFrom(video, video.videoWidth, video.videoHeight);
      if (t) return found(t);
    }
    requestAnimationFrame(tick);
  }
  document.getElementById('scanBtn').onclick = function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('Caméra indisponible : utilise « Lire depuis une photo ».'); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then(function (s) { stream = s; video.srcObject = s; scanner.style.display = 'flex'; running = true; return video.play(); })
      .then(function () { requestAnimationFrame(tick); })
      .catch(function () { stop(); toast('Accès caméra refusé : autorise-le dans les réglages, ou lis depuis une photo.'); });
  };
  document.getElementById('stopBtn').onclick = stop;
  document.getElementById('photo').onchange = function (e) {
    var f = e.target.files[0]; if (!f) return;
    var img = new Image();
    img.onload = function () {
      var t = jsqrFrom(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(img.src);
      if (t) handle(t); else toast('Aucun QR code trouvé sur la photo.');
    };
    img.src = URL.createObjectURL(f); e.target.value = '';
  };

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
  window.DELCO = { parse: parse, handle: handle };
  showHome();
})();
