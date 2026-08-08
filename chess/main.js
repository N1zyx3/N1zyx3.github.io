/* =====================
   GAME STATE
===================== */
var game = new Chess();
var playerColor = null; // 'w' | 'b'
var connected = false;
var selected = null; // { square, to{}, captures{}, list[] }
var pendingPromotion = null; // { from, to }

var pc = null;
var dc = null;
var scanStream = null;
var scanTimer = null;

var GLYPHS = { k: '\u2654', q: '\u2655', r: '\u2656', b: '\u2657', n: '\u2658', p: '\u2659' };

/* =====================
   DOM HELPERS
===================== */
function $(id) {
  return document.getElementById(id);
}

function setStatus(text) {
  $('status').textContent = text;
}

function showStep(id) {
  var steps = ['step-offer', 'step-answer-input', 'step-scan-offer', 'step-answer', 'connected-hint'];
  for (var i = 0; i < steps.length; i++) $(steps[i]).classList.add('hidden');
  $(id).classList.remove('hidden');
}

function showSteps(ids) {
  var steps = ['step-offer', 'step-answer-input', 'step-scan-offer', 'step-answer', 'connected-hint'];
  for (var i = 0; i < steps.length; i++) $(steps[i]).classList.add('hidden');
  for (var j = 0; j < ids.length; j++) $(ids[j]).classList.remove('hidden');
}

function copyText(textarea) {
  textarea.select();
  if (navigator.clipboard) navigator.clipboard.writeText(textarea.value).catch(function () {});
  else document.execCommand('copy');
}

/* =====================
   SESSION CODES (BASE64URL)
===================== */
function b64uEncode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
function b64uDecode(str) {
  var b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(b64)));
}
function encodeSession(obj) {
  return b64uEncode(JSON.stringify(obj));
}
function decodeSession(code) {
  return JSON.parse(b64uDecode(code));
}

/* =====================
   QR DRAW
===================== */
function drawQR(canvas, text, px) {
  var q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  var n = q.getModuleCount();
  canvas.width = px;
  canvas.height = px;
  var ctx = canvas.getContext('2d');
  var cell = px / n;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = '#111827';
  for (var r = 0; r < n; r++) {
    for (var c = 0; c < n; c++) {
      if (q.isDark(r, c)) {
        ctx.fillRect(Math.floor(c * cell), Math.floor(r * cell), Math.ceil(cell), Math.ceil(cell));
      }
    }
  }
}

/* =====================
   QR SCANNING
===================== */
function stopScanning() {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
  }
  if (scanStream) {
    scanStream.getTracks().forEach(function (t) {
      t.stop();
    });
    scanStream = null;
  }
}

function startScan(onFound) {
  stopScanning();
  showStep('step-scan-offer');
  $('scan-status').textContent = 'Запуск камеры...';

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    $('scan-status').textContent = 'Камера недоступна — введите код вручную';
    return;
  }

  var video = document.createElement('video');
  video.playsInline = true;
  video.autoplay = true;

  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(function (stream) {
      scanStream = stream;
      $('scan-status').textContent = 'Наведи камеру на QR';
      video.srcObject = stream;
      video.play();

      scanTimer = setInterval(function () {
        var c = $('qr-preview');
        c.width = video.videoWidth || 320;
        c.height = video.videoHeight || 240;
        c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
        var frame = c.getContext('2d').getImageData(0, 0, c.width, c.height);
        var res = null;
        try {
          res = jsQR(frame.data, frame.width, frame.height);
        } catch (e) {
          res = null;
        }
        if (res && res.data) {
          stopScanning();
          $('scan-status').textContent = 'Код найден';
          onFound(res.data);
        }
      }, 150);
    })
    .catch(function () {
      $('scan-status').textContent = 'Камера недоступна — введите код вручную';
    });
}

/* =====================
   BOARD RENDER
===================== */
function render() {
  var board = game.board();
  var files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  var flipped = playerColor === 'b';

  var history = game.history({ verbose: true });
  var last = history.length ? history[history.length - 1] : null;

  var container = $('board');
  container.innerHTML = '';

  for (var dispRow = 0; dispRow < 8; dispRow++) {
    var boardRow = flipped ? 7 - dispRow : dispRow;
    for (var dispCol = 0; dispCol < 8; dispCol++) {
      var boardCol = flipped ? 7 - dispCol : dispCol;
      var pieceCell = board[boardRow][boardCol];
      var square = files[boardCol] + (8 - boardRow);

      var cell = document.createElement('div');
      cell.className = 'cell ' + ((boardRow + dispCol) % 2 === 0 ? 'light' : 'dark');
      if (last && (square === last.from || square === last.to)) cell.classList.add('last-move');
      if (selected && selected.square === square) cell.classList.add('selected');
      if (selected && selected.to[square]) {
        cell.classList.add('target');
        if (selected.captures[square]) cell.classList.add('capture');
      }
      if (pieceCell) {
        var sym = document.createElement('div');
        sym.className = 'piece ' + pieceCell.color;
        sym.textContent = GLYPHS[pieceCell.type];
        cell.appendChild(sym);
      }
      cell.dataset.square = square;
      cell.addEventListener('click', (function (sq) {
        return function () {
          onSquareClick(sq);
        };
      })(square));
      container.appendChild(cell);
    }
  }
}

function onSquareClick(square) {
  if (!connected) return;
  if (game.game_over()) return;
  if (game.turn() !== playerColor) return;
  if (pendingPromotion) return;

  if (selected) {
    if (selected.square === square) {
      selected = null;
      render();
      return;
    }
    if (selected.to[square]) {
      var needsPromo = false;
      for (var i = 0; i < selected.list.length; i++) {
        if (selected.list[i].to === square && selected.list[i].promotion) {
          needsPromo = true;
          break;
        }
      }
      if (needsPromo) {
        pendingPromotion = { from: selected.square, to: square };
        $('promo-overlay').classList.remove('hidden');
        return;
      }
      doMove({ from: selected.square, to: square });
      return;
    }
  }

  var piece = game.get(square);
  if (piece && piece.color === playerColor) {
    var moves = game.moves({ square: square, verbose: true });
    var to = {};
    var captures = {};
    for (var j = 0; j < moves.length; j++) {
      to[moves[j].to] = true;
      if (moves[j].captured) captures[moves[j].to] = true;
    }
    selected = { square: square, to: to, captures: captures, list: moves };
    render();
  }
}

/* =====================
   PROMOTION
===================== */
function setupPromotion() {
  var btns = document.querySelectorAll('.promo-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener('click', function () {
      if (!pendingPromotion) return;
      var p = pendingPromotion;
      pendingPromotion = null;
      $('promo-overlay').classList.add('hidden');
      doMove({ from: p.from, to: p.to, promotion: this.dataset.piece });
    });
  }
}

/* =====================
   MOVES / SEND / RESET
===================== */
function doMove(move) {
  var m = game.move(move);
  if (!m) return;
  selected = null;
  if (dc && dc.readyState === 'open') {
    dc.send(JSON.stringify({ t: 'move', from: move.from, to: move.to, promotion: move.promotion || null }));
  }
  render();
  updateStatus();
}

function applyRemoteMove(msg) {
  game.move({ from: msg.from, to: msg.to, promotion: msg.promotion || null });
  render();
  updateStatus();
}

function resetGame(sendNext) {
  game.reset();
  selected = null;
  pendingPromotion = null;
  $('promo-overlay').classList.add('hidden');
  if (sendNext && dc && dc.readyState === 'open') {
    dc.send(JSON.stringify({ t: 'reset' }));
  }
  render();
  if (connected) updateStatus();
}

/* =====================
   STATUS
===================== */
function updateStatus() {
  if (!connected) return;
  var txt = 'Ход ' + (game.turn() === 'w' ? 'белых' : 'чёрных');
  if (game.in_check()) txt += ' — шах!';
  if (game.in_checkmate()) txt = 'Мат! Победили ' + (game.turn() === 'w' ? 'чёрные' : 'белые');
  else if (game.in_stalemate()) txt = 'Пат — ничья';
  else if (game.in_draw()) txt = 'Ничья';
  setStatus(txt);
}

/* =====================
   WEBRTC (NON-TRICKLE)
===================== */
function settleIcing(p) {
  return new Promise(function (resolve) {
    if (p.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    p.addEventListener('icegatheringstatechange', function () {
      if (p.iceGatheringState === 'complete') resolve();
    });
  });
}

function wireChannel() {
  dc.onopen = function () {
    connected = true;
    selected = null;
    render();
    showStep('connected-hint');
    setStatus('Соперник найден. Вы — ' + (playerColor === 'w' ? 'белые' : 'чёрные') + '!');
    resetGame(false);
  };
  dc.onmessage = function (ev) {
    var msg;
    try {
      msg = JSON.parse(ev.data);
    } catch (e) {
      return;
    }
    if (msg.t === 'move') applyRemoteMove(msg);
    else if (msg.t === 'reset') resetGame(false);
  };
  dc.onclose = function () {
    connected = false;
    setStatus('Соперник отключился');
  };
}

async function genOffer() {
  pc = new RTCPeerConnection();
  dc = pc.createDataChannel('game');
  wireChannel();
  var offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await settleIcing(pc);
  return encodeSession({ t: 'offer', color: playerColor, sdp: pc.localDescription.sdp });
}

async function genAnswer(offerCode) {
  var sess = decodeSession(offerCode);
  if (sess.t !== 'offer') throw new Error('bad offer');
  playerColor = sess.color === 'w' ? 'b' : 'w';
  pc = new RTCPeerConnection();
  pc.addEventListener('datachannel', function (ev) {
    dc = ev.channel;
    wireChannel();
  });
  await pc.setRemoteDescription({ type: 'offer', sdp: sess.sdp });
  var answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await settleIcing(pc);
  return encodeSession({ t: 'answer', sdp: pc.localDescription.sdp });
}

async function finishJoin(answerCode) {
  var sess = decodeSession(answerCode);
  if (sess.t !== 'answer') throw new Error('bad answer');
  await pc.setRemoteDescription({ type: 'answer', sdp: sess.sdp });
}

async function onCreate() {
  stopScanning();
  playerColor = Math.random() < 0.5 ? 'w' : 'b';
  resetGame(false);
  var code;
  try {
    code = await genOffer();
  } catch (e) {
    setStatus('Не удалось создать партию');
    return;
  }
  $('code-offer').value = code;
  drawQR($('qr-offer'), code, 260);
  showSteps(['step-offer', 'step-answer-input']);
  setStatus('Покажи QR или отправь код. Ждём ответа...');
}

async function onJoin(code) {
  var next;
  try {
    next = await genAnswer(code);
  } catch (e) {
    setStatus('Не удалось прочитать код приглашения');
    return;
  }
  $('code-answer').value = next;
  drawQR($('qr-answer'), next, 260);
  showStep('step-answer');
  setStatus('Отправь этот ответ создателю партии');
}

async function onConnectAnswer() {
  var code = $('code-answer-input').value.trim();
  if (!code) return;
  try {
    await finishJoin(code);
    setStatus('Соединяемся...');
  } catch (e) {
    setStatus('Не удалось подключиться');
  }
}

/* =====================
   UI WIRING
===================== */
function initUI() {
  $('btn-create').addEventListener('click', onCreate);
  $('btn-scan').addEventListener('click', function () {
    // joiner: scan the offered QR
    startScan(function (code) {
      onJoin(code);
    });
  });
  $('btn-paste').addEventListener('click', function () {
    // joiner: paste the offer code
    var code = prompt('Вставьте код приглашения от соперника');
    if (code) onJoin(code);
  });
  $('btn-scan-answer').addEventListener('click', function () {
    // host: scan the joiner's answer QR
    startScan(function (code) {
      $('code-answer-input').value = code;
      onConnectAnswer();
    });
  });
  $('btn-connect').addEventListener('click', onConnectAnswer);
  $('btn-copy-offer').addEventListener('click', function () {
    copyText($('code-offer'));
  });
  $('btn-copy-answer').addEventListener('click', function () {
    copyText($('code-answer'));
  });
  $('btn-new').addEventListener('click', function () {
    resetGame(true);
  });
  setupPromotion();
}

document.addEventListener('DOMContentLoaded', function () {
  resetGame(false);
  initUI();
  setStatus('Создай игру или подключись к другу');
  render();
});