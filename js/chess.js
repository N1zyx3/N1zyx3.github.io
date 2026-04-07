const game = new Chess();
let conn = null;
let playerColor = 'w';

const peer = new Peer(undefined, {
    config: {
        'iceServers': [
            { url: 'stun:stun.l.google.com:19302' },
            { url: 'stun:global.stun.twilio.com:3478' }
        ]
    }
});

// Настройка доски
const boardConfig = {
    draggable: true,
    position: 'start',
    // ИСПРАВЛЕНИЕ ФИГУР: тянем напрямую из CDN
    pieceTheme: 'https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/img/chesspieces/wikipedia/{piece}.png',
    onDragStart: (src, piece) => {
        // Запрещаем ходить, если игра окончена или фигура не того цвета
        if (game.game_over() || piece.search(playerColor) === -1) return false;
    },
    onDrop: (src, tgt) => {
        const move = game.move({ from: src, to: tgt, promotion: 'q' });
        
        if (move === null) return 'snapback';
        
        if (conn && conn.open) {
            conn.send(move);
        }
        updateStatus();
    }
};

const board = Chessboard('myBoard', boardConfig);

// Сетевая логика PeerJS
peer.on('open', id => {
    document.getElementById('my-id').innerText = id;
});

// Когда кто-то подключается к нам (мы — белые)
peer.on('connection', c => {
    conn = c;
    playerColor = 'w';
    setupConnection();
});

// Когда мы подключаемся к кому-то (мы — черные)
document.getElementById('connect-btn').onclick = () => {
    const targetId = document.getElementById('peer-id').value;
    if (!targetId) return alert("Введите ID друга");
    
    conn = peer.connect(targetId);
    playerColor = 'b';
    board.orientation('black');
    setupConnection();
};

function setupConnection() {
    conn.on('open', () => {
        document.getElementById('status').innerText = "Соединение установлено!";
        
        conn.on('data', move => {
            game.move(move);
            board.position(game.fen());
            updateStatus();
        });
    });
}

function updateStatus() {
    let status = game.turn() === 'w' ? 'Ход белых' : 'Ход черных';
    if (game.in_checkmate()) status = 'Мат! Игра окончена.';
    if (game.in_draw()) status = 'Ничья!';
    document.getElementById('status').innerText = status;
}