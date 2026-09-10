// ===================================================
// CHESSBALL - ULTIMATE MULTIPLAYER & PENALTY ENGINE
// ===================================================

const matrixContent = document.querySelector('.main-matrix')
const squadsBoard = Array.from(matrixContent ? matrixContent.querySelectorAll('.squad') : [])
const topGoalSquads = Array.from(document.querySelectorAll('#top-goal .squad'))
const bottomGoalSquads = Array.from(document.querySelectorAll('#bottom-goal .squad'))
const squads = document.querySelectorAll('.squad')

let matrix = [[], [], [], [], [], [], [], [], [], [], []]
let selectedItems = []
let moveItems = []
let Dots = false
let yurish = false
let Order = false // false = White, true = Black
let isPenalty = false
let Gs = 0
let duration = 600
let Time = 10
let timerInterval = null
let oldClickHandlers = []
let currentClickHandlers = []

// SCOREKEEPING
let whiteScore = 0
let blackScore = 0

// 15-SECOND TURN TIMER STATE
let turnSeconds = 15
let turnTimerInterval = null

// MULTIPLAYER STATE (Realtime via standard HTTPS/SSE)
let isMultiplayer = false
let myRole = 'white' // 'white' | 'black'
let isHost = false
let myTeamName = 'Barsa'
let oppTeamName = 'Real Madrid'
let currentRoomCode = null
let myIsReady = false
let oppIsReady = false

let netSource = null
let seenMessageIds = new Set()
let lastOpponentHeartbeat = 0
let hostReadyState = { host: false, guest: false }

// Reliable Real-time Event Emitter (HTTPS POST)
function netEmit(event, data = {}) {
	if (!currentRoomCode) return
	const targetTopic = `cb_${currentRoomCode}_${isHost ? 'guest' : 'host'}`
	const payload = JSON.stringify({
		event,
		data,
		sender: isHost ? 'host' : 'guest',
		time: Date.now()
	})
	fetch(`https://ntfy.sh/${targetTopic}`, {
		method: 'POST',
		body: payload
	}).catch(e => {
		console.error('[NET] Xabar yuborishda xato:', e)
	})
}

// Real-time Event Listener (Native SSE over standard HTTPS port 443)
function startNetListener() {
	if (!currentRoomCode) return
	if (netSource) {
		try {
			netSource.close()
		} catch (e) {}
		netSource = null
	}
	const myTopic = `cb_${currentRoomCode}_${isHost ? 'host' : 'guest'}`
	console.log('[NET] Tinglovchi faollashtirildi:', myTopic)
	try {
		netSource = new EventSource(`https://ntfy.sh/${myTopic}/sse`)

		netSource.onmessage = event => {
			try {
				const raw = JSON.parse(event.data)
				if (raw.event === 'message' && raw.message) {
					if (raw.id) {
						if (seenMessageIds.has(raw.id)) return
						seenMessageIds.add(raw.id)
						if (seenMessageIds.size > 200) {
							const first = seenMessageIds.values().next().value
							seenMessageIds.delete(first)
						}
					}
					let packet = null
					if (typeof raw.message === 'string') {
						try {
							packet = JSON.parse(raw.message)
						} catch (e) {
							packet = raw.message
						}
					} else {
						packet = raw.message
					}
					if (packet && packet.event) {
						if (packet.event === 'heartbeat') {
							lastOpponentHeartbeat = Date.now()
							return
						}
						handleNetEvent(packet.event, packet.data)
					}
				}
			} catch (err) {
				console.error("[NET] Xabarni o'qishda xatolik:", err)
			}
		}

		netSource.onerror = () => {
			console.warn('[NET] Aloqada vaqtinchalik uzilish, avtomatik qayta tiklanmoqda...')
		}
	} catch (e) {
		console.error('[NET] EventSource xatosi:', e)
	}
}

// Disconnect & Heartbeat monitor
setInterval(() => {
	if (isMultiplayer && currentRoomCode) {
		netEmit('heartbeat', {})
		if (lastOpponentHeartbeat > 0 && Date.now() - lastOpponentHeartbeat > 25000) {
			console.warn("[NET] Raqibdan signal yo'qoldi (25s). Chiqib ketgan deb hisoblanadi.")
			lastOpponentHeartbeat = 0
			handleOpponentDisconnect()
		}
	}
}, 3000)

// Donalarning dastlabki ro'yxati
let Pieces = {
	white: {
		bishop: [],
		knight: [],
	},
	black: {
		bishop: [],
		knight: [],
	},
}

let mass = [
	[0, 0],
	[1, 1],
	[0, 1],
	[1, 0],
	[2, 0],
	[2, 1],
	[1, 2],
	[0, 2],
]

// ---------------------------------------------------
// TOAST NOTIFICATIONS
// ---------------------------------------------------
function showToast(message, type = 'info') {
	const toast = document.getElementById('mp-toast')
	if (!toast) return
	toast.textContent = message
	toast.className = `mp-toast show ${type}`
	setTimeout(() => {
		toast.className = 'mp-toast'
	}, 3500)
}

// ---------------------------------------------------
// HUD & SCOREBOARD UI UPDATE
// ---------------------------------------------------
function updateHud() {
	const whiteDisplay = document.getElementById('white-team-display')
	const blackDisplay = document.getElementById('black-team-display')
	const whiteBadge = document.getElementById('white-role-badge')
	const blackBadge = document.getElementById('black-role-badge')
	const hudRoom = document.getElementById('hud-room-code')

	if (isMultiplayer) {
		if (myRole === 'white') {
			if (whiteDisplay) whiteDisplay.textContent = myTeamName || 'Oqlar'
			if (blackDisplay) blackDisplay.textContent = oppTeamName || 'Qoralar'
			if (whiteBadge) whiteBadge.style.display = 'inline-block'
			if (blackBadge) blackBadge.style.display = 'none'
		} else {
			if (whiteDisplay) whiteDisplay.textContent = oppTeamName || 'Oqlar'
			if (blackDisplay) blackDisplay.textContent = myTeamName || 'Qoralar'
			if (whiteBadge) whiteBadge.style.display = 'none'
			if (blackBadge) blackBadge.style.display = 'inline-block'
		}
		if (hudRoom) hudRoom.textContent = currentRoomCode || '-----'
	} else {
		if (whiteDisplay) whiteDisplay.textContent = 'Oqlar'
		if (blackDisplay) blackDisplay.textContent = 'Qoralar'
		if (whiteBadge) whiteBadge.style.display = 'none'
		if (blackBadge) blackBadge.style.display = 'none'
		if (hudRoom) hudRoom.textContent = 'Lokal'
	}

	updateTurnUI()
}

// ---------------------------------------------------
// 15-SECOND TURN TIMER LOGIC
// ---------------------------------------------------
function startTurnTimer() {
	stopTurnTimer()
	turnSeconds = 15
	updateTurnTimerUI()

	turnTimerInterval = setInterval(() => {
		if (!yurish || isPenalty) {
			stopTurnTimer()
			return
		}

		turnSeconds--
		if (turnSeconds < 0) turnSeconds = 0
		updateTurnTimerUI()

		if (turnSeconds <= 0) {
			handleTurnTimeout(false)
		}
	}, 1000)
}

function stopTurnTimer() {
	if (turnTimerInterval) {
		clearInterval(turnTimerInterval)
		turnTimerInterval = null
	}
}

function resetTurnTimer() {
	if (yurish && !isPenalty) {
		startTurnTimer()
	}
}

function updateTurnTimerUI() {
	const badge = document.getElementById('turn-timer-badge')
	const digits = document.getElementById('turn-timer-display')
	const bar = document.getElementById('turn-progress-bar')

	if (!digits || !bar || !badge) return

	digits.textContent = `${turnSeconds}s`
	const percent = (turnSeconds / 15) * 100
	bar.style.width = `${percent}%`

	badge.classList.remove('warning', 'danger')
	if (turnSeconds > 7) {
		bar.style.background = '#16a34a'
	} else if (turnSeconds > 3) {
		bar.style.background = '#d97706'
		badge.classList.add('warning')
	} else {
		bar.style.background = '#dc2626'
		badge.classList.add('danger')
	}
}

function handleTurnTimeout(fromRemote = false) {
	stopTurnTimer()
	clearAllDots()
	selectedItems = []

	const isWhiteTurn = Order === false
	const timedOutTeam = isWhiteTurn ? 'Oqlar' : 'Qoralar'
	showToast(`⏱️ 15s vaqt tugadi! ${timedOutTeam} navbatni boy berdi.`, 'warning')

	const isMyTurn = (myRole === 'white' && isWhiteTurn) || (myRole === 'black' && !isWhiteTurn)
	if (!fromRemote && isMultiplayer && isMyTurn) {
		netEmit('turn_timeout', {})
	}

	changeOrder()
}

function updateTurnUI() {
	const banner = document.getElementById('mp-turn-banner')
	const orderDisplay = document.querySelector('.move-color-black')

	if (Order) {
		if (orderDisplay) orderDisplay.innerHTML = 'Qora'
	} else {
		if (orderDisplay) orderDisplay.innerHTML = 'Oq'
	}

	if (!banner) return

	if (!yurish) {
		banner.textContent = 'Tayyorgarlik bosqichi'
		banner.className = 'mp-turn-banner'
		banner.style.background = '#475569'
		banner.style.color = '#ffffff'
		return
	}

	const isWhiteTurn = Order === false
	const isMyTurn = (myRole === 'white' && isWhiteTurn) || (myRole === 'black' && !isWhiteTurn)

	if (!isMultiplayer) {
		banner.textContent = isWhiteTurn ? 'Oqlar navbati' : 'Qoralar navbati'
		banner.className = 'mp-turn-banner mp-my-turn'
		return
	}

	if (isMyTurn) {
		banner.textContent = 'Sizning navbatingiz! ✨'
		banner.className = 'mp-turn-banner mp-my-turn'
	} else {
		banner.textContent = 'Raqib navbati... ⏳'
		banner.className = 'mp-turn-banner mp-opp-turn'
	}
}

// ---------------------------------------------------
// TIMER ADJUSTMENT CONTROLS (+ and -) WITH SYNC
// ---------------------------------------------------
const plusBtn = document.querySelectorAll('.pluss')[1]
const minusBtn = document.querySelectorAll('.pluss')[0]

if (plusBtn) {
	plusBtn.addEventListener('click', () => {
		if (!yurish) {
			Time++
			duration = Time * 60
			updateMatchTimerDisplay()
			if (isMultiplayer) {
				netEmit('timer_change', {
					time: Time,
					duration: duration,
				})
			}
		}
	})
}

if (minusBtn) {
	minusBtn.addEventListener('click', () => {
		if (!yurish && Time > 1) {
			Time--
			duration = Time * 60
			updateMatchTimerDisplay()
			if (isMultiplayer) {
				netEmit('timer_change', {
					time: Time,
					duration: duration,
				})
			}
		}
	})
}

function updateMatchTimerDisplay() {
	const timeElem = document.querySelector('.time')
	if (timeElem) {
		if (Time < 10) timeElem.innerHTML = `0${Time}:00`
		else timeElem.innerHTML = `${Time}:00`
	}
}

// ---------------------------------------------------
// START / READY BUTTON WITH 2-PLAYER CONFIRMATION
// ---------------------------------------------------
const startBtnElem = document.getElementById('btn-start-game')

if (startBtnElem) {
	startBtnElem.addEventListener('click', () => {
		if (yurish) return

		if (!isMultiplayer) {
			// Lokal rejimda darhol boshlash
			triggerStartGame()
			return
		}

		// Multiplayer rejimida: Ready tizimi!
		if (!myIsReady) {
			myIsReady = true
			startBtnElem.textContent = 'Tayyor ✅ (1/2)'
			startBtnElem.classList.add('is-ready')
			showToast("Siz tayyorsiz! Raqib tayyor bo'lishi kutilmoqda...", 'info')

			if (isHost) {
				hostReadyState.host = true
				if (hostReadyState.host && hostReadyState.guest) {
					netEmit('game_started', {})
					triggerStartGame()
				}
			} else {
				netEmit('player_ready', {})
			}
		}
	})
}

function triggerStartGame() {
	yurish = true
	Order = false // Oqlar har doim birinchi yuradi
	cloneMatrix()
	removeOldRules()
	currentRules()
	startTimer()
	updateTurnUI()
	resetTurnTimer()

	if (startBtnElem) {
		startBtnElem.textContent = "O'yin ketmoqda"
		startBtnElem.disabled = true
		startBtnElem.classList.remove('is-ready')
		startBtnElem.style.background = '#334155'
	}

	showToast("⚽ O'yin boshlandi! Birinchi yurish: Oqlar.", 'success')
}

// ---------------------------------------------------
// MATRIX SETUP & DONALAR
// ---------------------------------------------------
squadsBoard.forEach((item, index) => {
	if (index % 2 == 0) item.classList.add('white')
})

function initMatrix() {
	matrix = [[], [], [], [], [], [], [], [], [], [], []]

	// 0-qator: Yuqorigi darvoza (Qoralar darvozasi - x=3, 4, 5)
	for (let i = 0; i < 9; i++) {
		if (i >= 3 && i <= 5 && topGoalSquads[i - 3]) {
			matrix[0].push(topGoalSquads[i - 3])
		} else {
			matrix[0].push(0)
		}
	}

	// 1..9 qatorlar: Asosiy 9x9 shaxmat maydoni (81 ta katak)
	squadsBoard.forEach((item, idx) => {
		let j = Math.floor(idx / 9) + 1
		matrix[j].push(item)
	})

	// 10-qator: Pastki darvoza (Oqlar darvozasi - x=3, 4, 5)
	for (let i = 0; i < 9; i++) {
		if (i >= 3 && i <= 5 && bottomGoalSquads[i - 3]) {
			matrix[10].push(bottomGoalSquads[i - 3])
		} else {
			matrix[10].push(0)
		}
	}
}

initMatrix()

function startMatrix() {
	clearMatrix()

	// Darvozabonlar (Qoralar: 1-qator 4-ustun, Oqlar: 9-qator 4-ustun)
	if (matrix[1] && matrix[1][4]) {
		matrix[1][4].innerHTML =
			'<img class="black-pieces black-rook black rook" src="/images/pieces/black/rook.png" alt="">'
	}
	if (matrix[9] && matrix[9][4]) {
		matrix[9][4].innerHTML =
			'<img class="white-pieces whitee rook" src="/images/pieces/white/rook.png" alt="">'
	}

	// Oqlarning boshlang'ich donalari (6-qatorda 3 ta fil, 5-qator 3-ustunda ot)
	if (matrix[6] && matrix[6][0]) {
		matrix[6][0].innerHTML =
			'<img class="white-pieces piece whitee bishop" src="/images/pieces/white/bishop.png" alt="">'
	}
	if (matrix[6] && matrix[6][1]) {
		matrix[6][1].innerHTML =
			'<img class="white-pieces piece whitee bishop" src="/images/pieces/white/bishop.png" alt="">'
	}
	if (matrix[6] && matrix[6][2]) {
		matrix[6][2].innerHTML =
			'<img class="white-pieces piece bishop whitee" src="/images/pieces/white/bishop.png" alt="">'
	}
	if (matrix[5] && matrix[5][3]) {
		matrix[5][3].innerHTML =
			'<img class="white-pieces piece whitee" src="/images/pieces/white/knight.png" alt="">'
	}

	// Qoralarning boshlang'ich donalari (4-qatorda 3 ta fil, 5-qator 5-ustunda ot)
	if (matrix[4] && matrix[4][0]) {
		matrix[4][0].innerHTML =
			'<img class="black-pieces piece black bishop" src="/images/pieces/black/bishop.png" alt="">'
	}
	if (matrix[4] && matrix[4][1]) {
		matrix[4][1].innerHTML =
			'<img class="black-pieces piece black bishop" src="/images/pieces/black/bishop.png" alt="">'
	}
	if (matrix[4] && matrix[4][2]) {
		matrix[4][2].innerHTML =
			'<img class="black-pieces piece black bishop" src="/images/pieces/black/bishop.png" alt="">'
	}
	if (matrix[5] && matrix[5][5]) {
		matrix[5][5].innerHTML =
			'<img class="black-pieces piece black" src="/images/pieces/black/knight.png" alt="">'
	}

	// Maydon markazida to'p (5-qator 4-ustun)
	if (matrix[5] && matrix[5][4]) {
		matrix[5][4].innerHTML = '<img src="/images/ball.jpg" alt="" class="ball">'
	}
}

function clearMatrix() {
	for (let i = 1; i < 10; i++) {
		matrix[i].forEach(item => {
			item.innerHTML = ''
		})
	}
	if (matrix[0]) {
		matrix[0].forEach(item => {
			if (item && item.innerHTML) item.innerHTML = ''
		})
	}
	if (matrix[10]) {
		matrix[10].forEach(item => {
			if (item && item.innerHTML) item.innerHTML = ''
		})
	}
}

function buildMatrix() {
	// Darvozabonlar (To'ra) har doim o'z darvoza chizig'ida
	matrix[1][4].innerHTML =
		'<img class="black-pieces black-rook black rook" src="/images/pieces/black/rook.png" alt="">'
	matrix[9][4].innerHTML =
		'<img class="white-pieces whitee rook" src="/images/pieces/white/rook.png" alt="">'

	// Qoralar fillari (aniq 3 ta)
	const blackBishops = (Pieces.black.bishop && Pieces.black.bishop.length === 3)
		? Pieces.black.bishop
		: [[4, 0], [4, 1], [4, 2]]
	blackBishops.forEach(item => {
		let y = item[0], x = item[1]
		if (matrix[y] && matrix[y][x]) {
			matrix[y][x].innerHTML =
				'<img class="black-pieces piece black bishop" src="/images/pieces/black/bishop.png" alt="">'
		}
	})

	// Oqlar fillari (aniq 3 ta)
	const whiteBishops = (Pieces.white.bishop && Pieces.white.bishop.length === 3)
		? Pieces.white.bishop
		: [[6, 0], [6, 1], [6, 2]]
	whiteBishops.forEach(item => {
		let y = item[0], x = item[1]
		if (matrix[y] && matrix[y][x]) {
			matrix[y][x].innerHTML =
				'<img class="white-pieces piece whitee bishop" src="/images/pieces/white/bishop.png" alt="">'
		}
	})

	// Qoralar oti (1 ta) - darvozabon joyida bo'lmasligi kerak
	let bKnight = Pieces.black.knight
	if (!bKnight || bKnight.length !== 2 || (bKnight[0] === 1 && bKnight[1] === 4)) {
		bKnight = [5, 5]
	}
	if (matrix[bKnight[0]] && matrix[bKnight[0]][bKnight[1]]) {
		matrix[bKnight[0]][bKnight[1]].innerHTML =
			'<img class="black-pieces piece black" src="/images/pieces/black/knight.png" alt="">'
	}

	// Oqlar oti (1 ta) - darvozabon joyida bo'lmasligi kerak
	let wKnight = Pieces.white.knight
	if (!wKnight || wKnight.length !== 2 || (wKnight[0] === 9 && wKnight[1] === 4)) {
		wKnight = [5, 3]
	}
	if (matrix[wKnight[0]] && matrix[wKnight[0]][wKnight[1]]) {
		matrix[wKnight[0]][wKnight[1]].innerHTML =
			'<img class="white-pieces piece whitee" src="/images/pieces/white/knight.png" alt="">'
	}

	// To'p markazda
	if (matrix[5] && matrix[5][4]) {
		matrix[5][4].innerHTML = '<img src="/images/ball.jpg" alt="" class="ball">'
	}
}

function cloneMatrix() {
	let bBishopList = []
	let wBishopList = []
	let bKnight = null
	let wKnight = null

	for (let i = 1; i <= 9; i++) {
		matrix[i].forEach((item, index) => {
			const child = item.childNodes[0]
			if (!child) return

			// Darvozabon (To'ra) o'yinchilar qatoriga kirmaydi!
			if (child.classList.contains('rook')) return

			if (child.classList.contains('black-pieces') || child.classList.contains('black')) {
				if (child.classList.contains('bishop')) {
					bBishopList.push([i, index])
				} else {
					bKnight = [i, index]
				}
			} else if (child.classList.contains('white-pieces') || child.classList.contains('whitee')) {
				if (child.classList.contains('bishop')) {
					wBishopList.push([i, index])
				} else {
					wKnight = [i, index]
				}
			}
		})
	}

	Pieces.black.bishop = bBishopList.length === 3 ? bBishopList : [[4, 0], [4, 1], [4, 2]]
	Pieces.white.bishop = wBishopList.length === 3 ? wBishopList : [[6, 0], [6, 1], [6, 2]]
	Pieces.black.knight = (bKnight && !(bKnight[0] === 1 && bKnight[1] === 4)) ? bKnight : [5, 5]
	Pieces.white.knight = (wKnight && !(wKnight[0] === 9 && wKnight[1] === 4)) ? wKnight : [5, 3]
}

// ---------------------------------------------------
// PREPARATION PHASE CLICK HANDLERS (Piece1)
// ---------------------------------------------------
function oldRules() {
	removeOldRules()
	squadsBoard.forEach((item, index) => {
		const handler = () => {
			if (item.childNodes[0]) {
				if (item.childNodes[0].classList.contains('dot-action')) {
					moveItems = [index % 9, Math.floor(index / 9) + 1]
					Replace(true)
				} else if (
					item.childNodes[0].classList.contains('piece') &&
					Dots == false
				) {
					if (isMultiplayer) {
						const isWhite = item.childNodes[0].classList.contains('white-pieces')
						const isBlack = item.childNodes[0].classList.contains('black-pieces')
						if (myRole === 'white' && !isWhite) {
							showToast("Siz faqat o'z (Oq) donalaringizni joylashtira olasiz!", 'warning')
							return
						}
						if (myRole === 'black' && !isBlack) {
							showToast("Siz faqat o'z (Qora) donalaringizni joylashtira olasiz!", 'warning')
							return
						}
					}
					Piece1(index % 9, Math.floor(index / 9) + 1)
				} else {
					clearAllDots()
				}
			} else {
				clearAllDots()
			}
		}

		item.addEventListener('click', handler)
		oldClickHandlers.push({ element: item, handler })
	})
}

function removeOldRules() {
	oldClickHandlers.forEach(({ element, handler }) => {
		element.removeEventListener('click', handler)
	})
	oldClickHandlers = []
}

function Piece1(x, y) {
	selectedItems = [x, y]
	Dots = true
	const cell = matrix[y] && matrix[y][x]
	if (!cell || !cell.childNodes[0]) return
	const isWhite =
		cell.childNodes[0].classList.contains('white-pieces') ||
		cell.childNodes[0].classList.contains('whitee')

	if (isWhite) {
		// Oq donalar FAQAT o'z zonasiga (5..9 qatorlar) harakatlanishi mumkin!
		// Qoralarning zonasiga (1..4 qatorlar) o'tish qat'iyan taqiqlangan!
		for (let i = 5; i < 10; i++) {
			matrix[i].forEach((item, index) => {
				if (item && item.innerHTML == '') {
					// Oqlarning darvozabon maydonchasi (8-9 qatorlar, 3-5 ustunlar)
					if ((i == 9 || i == 8) && index > 2 && index < 6) {
						// Darvozabon maydonchasi
					} else {
						item.innerHTML = "<div class='dot-action'></div>"
					}
				}
			})
		}
	} else {
		// Qora donalar FAQAT o'z zonasiga (1..5 qatorlar) harakatlanishi mumkin!
		// Oqlarning zonasiga (6..9 qatorlar) o'tish qat'iyan taqiqlangan!
		for (let i = 1; i < 6; i++) {
			matrix[i].forEach((item, index) => {
				if (item && item.innerHTML == '') {
					// Qoralarning darvozabon maydonchasi (1-2 qatorlar, 3-5 ustunlar)
					if ((i == 2 || i == 1) && index > 2 && index < 6) {
						// Darvozabon maydonchasi
					} else {
						item.innerHTML = "<div class='dot-action'></div>"
					}
				}
			})
		}
	}
}

// ---------------------------------------------------
// ACTIVE GAMEPLAY PIECE MOVEMENT (Bishop, Knight, Rook)
// ---------------------------------------------------
function showDots(y, x, name) {
	Dots = true
	if (name == 'rook') {
		// Darvozabon faqat darvoza chizig'ida chapga va o'ngga 1 katak harakatlanadi
		selectedItems = [x, y]
		if (2 < x - 1 && matrix[y][x - 1].innerHTML == '') {
			matrix[y][x - 1].innerHTML = "<div class='dot-action'></div>"
		}
		if (x + 1 < 6 && matrix[y][x + 1].innerHTML == '') {
			matrix[y][x + 1].innerHTML = "<div class='dot-action'></div>"
		}
	} else {
		// Darvozabondan tashqari hamma dona (fil, ot) FAQAT bitta katak yuradi!
		selectedItems = [x, y]
		Piece(x, y)
	}
}

function Piece(x, y) {
	Dots = true
	selectedItems = [x, y]
	let row, column
	for (let i = 0; i < 8; i++) {
		let items = mass[i]
		if (items[0] == 0) column = x - 1
		else if (items[0] == 2) column = x
		else column = x + 1
		if (items[1] == 0) row = y - 1
		else if (items[1] == 2) row = y
		else row = y + 1
		if (
			0 <= column &&
			column <= 8 &&
			1 <= row &&
			row <= 9 &&
			matrix[row] &&
			matrix[row][column] &&
			matrix[row][column].innerHTML == ''
		) {
			matrix[row][column].innerHTML = "<div class='dot-action'></div>"
		}
	}
}

function checkAround(x, y) {
	let row, column, option
	if (Order) option = 'black'
	else option = 'whitee'
	for (let i = 0; i < 8; i++) {
		let items = mass[i]
		if (items[0] == 0) column = x - 1
		else if (items[0] == 2) column = x
		else column = x + 1
		if (items[1] == 0) row = y - 1
		else if (items[1] == 2) row = y
		else row = y + 1
		if (
			0 <= column &&
			column <= 8 &&
			1 <= row &&
			row <= 9 &&
			matrix[row] &&
			matrix[row][column] &&
			matrix[row][column].childNodes[0] &&
			matrix[row][column].childNodes[0].classList.contains(`${option}`)
		) {
			return true
		}
	}
	return false
}

// ---------------------------------------------------
// BALL MOVEMENT & GOAL RESTRICTIONS
// ---------------------------------------------------
function Ball(x, y) {
	let option = Order ? 'black' : 'whitee'
	Dots = true
	selectedItems = [x, y]

	// Gorizontal chapga
	let column = x - 1
	while (
		column >= 0 &&
		(matrix[y][column].innerHTML === '' ||
			(matrix[y][column].childNodes[0] &&
				matrix[y][column].childNodes[0].classList.contains(option)))
	) {
		if (matrix[y][column].innerHTML === '') {
			matrix[y][column].innerHTML = "<div class='dot-action'></div>"
		}
		column--
	}

	// Gorizontal o'ngga
	column = x + 1
	while (
		column <= 8 &&
		(matrix[y][column].innerHTML === '' ||
			(matrix[y][column].childNodes[0] &&
				matrix[y][column].childNodes[0].classList.contains(option)))
	) {
		if (matrix[y][column].innerHTML === '') {
			matrix[y][column].innerHTML = "<div class='dot-action'></div>"
		}
		column++
	}

	// Vertikal pastga qarab zarba (row y+1 -> 9 -> 10)
	let rDown = y + 1
	while (
		rDown <= 10 &&
		matrix[rDown] &&
		matrix[rDown][x] !== undefined &&
		(matrix[rDown][x] === 0 ||
			matrix[rDown][x].innerHTML === '' ||
			(matrix[rDown][x] &&
				matrix[rDown][x].childNodes[0] &&
				matrix[rDown][x].childNodes[0].classList.contains(option)))
	) {
		if (matrix[rDown][x] && matrix[rDown][x] !== 0 && matrix[rDown][x].innerHTML === '') {
			if (rDown === 10) {
				// 10-qator: PASTKI DARVOZA (Oqlarning darvozasi).
				// Bunga FAQAT QORALAR (Order === true) gol ura oladi!
				if (Order && x >= 3 && x <= 5) {
					matrix[rDown][x].innerHTML =
						"<div style='background-color: white;' class='white-dot dot-action'></div>"
				}
			} else {
				matrix[rDown][x].innerHTML = "<div class='dot-action'></div>"
			}
		}
		rDown++
	}

	// Vertikal tepaga qarab zarba (row y-1 -> 1 -> 0)
	let rUp = y - 1
	while (
		rUp >= 0 &&
		matrix[rUp] &&
		matrix[rUp][x] !== undefined &&
		(matrix[rUp][x] === 0 ||
			matrix[rUp][x].innerHTML === '' ||
			(matrix[rUp][x] &&
				matrix[rUp][x].childNodes[0] &&
				matrix[rUp][x].childNodes[0].classList.contains(option)))
	) {
		if (matrix[rUp][x] && matrix[rUp][x] !== 0 && matrix[rUp][x].innerHTML === '') {
			if (rUp === 0) {
				// 0-qator: YUQORIGI DARVOZA (Qoralarning darvozasi).
				// Bunga FAQAT OQLAR (!Order) gol ura oladi!
				if (!Order && x >= 3 && x <= 5) {
					matrix[rUp][x].innerHTML =
						"<div style='background-color: white;' class='white-dot dot-action'></div>"
				}
			} else {
				matrix[rUp][x].innerHTML = "<div class='dot-action'></div>"
			}
		}
		rUp--
	}

	// Diagonal zarbalar (4 ta yo'nalish)
	const directions = [
		[-1, -1], // yuqori-chap
		[1, -1],  // yuqori-o'ng
		[-1, 1],  // pastki-chap
		[1, 1]    // pastki-o'ng
	]

	directions.forEach(([dx, dy]) => {
		// Darvoza ostonasidan to'g'ridan-to'g'ri diagonal zarba
		const directRow = y + dy
		const directCol = x + dx
		if (!Order && directRow === 0 && directCol >= 3 && directCol <= 5) {
			if (matrix[0] && matrix[0][directCol] && matrix[0][directCol] !== 0 && matrix[0][directCol].innerHTML === '') {
				matrix[0][directCol].innerHTML =
					"<div style='background-color: white;' class='white-dot dot-action'></div>"
			}
		}
		if (Order && directRow === 10 && directCol >= 3 && directCol <= 5) {
			if (matrix[10] && matrix[10][directCol] && matrix[10][directCol] !== 0 && matrix[10][directCol].innerHTML === '') {
				matrix[10][directCol].innerHTML =
					"<div style='background-color: white;' class='white-dot dot-action'></div>"
			}
		}

		let curCol = x + dx
		let curRow = y + dy

		while (
			curCol >= 0 &&
			curCol <= 8 &&
			curRow >= 1 &&
			curRow <= 9 &&
			matrix[curRow] &&
			matrix[curRow][curCol]
		) {
			const cell = matrix[curRow][curCol]
			const hasChild = cell.childNodes && cell.childNodes.length > 0

			// Bo'sh katak
			if (cell.innerHTML === '') {
				cell.innerHTML = "<div class='dot-action'></div>"

				// Agar keyingi qadam darvoza ichiga kirsa
				const nextR = curRow + dy
				const nextC = curCol + dx

				// Oqlar yuqoridagi Qoralar darvozasiga (0-qator, 3..5 ustunlar)
				if (!Order && nextR === 0 && nextC >= 3 && nextC <= 5) {
					if (matrix[0] && matrix[0][nextC] && matrix[0][nextC] !== 0 && matrix[0][nextC].innerHTML === '') {
						matrix[0][nextC].innerHTML =
							"<div style='background-color: white;' class='white-dot dot-action'></div>"
					}
				}

				// Qoralar pastdagi Oqlar darvozasiga (10-qator, 3..5 ustunlar)
				if (Order && nextR === 10 && nextC >= 3 && nextC <= 5) {
					if (matrix[10] && matrix[10][nextC] && matrix[10][nextC] !== 0 && matrix[10][nextC].innerHTML === '') {
						matrix[10][nextC].innerHTML =
							"<div style='background-color: white;' class='white-dot dot-action'></div>"
					}
				}
			} else if (hasChild && cell.childNodes[0].classList && cell.childNodes[0].classList.contains(option)) {
				// Jamoadosh dona orqali to'p o'tadi
				const nextR = curRow + dy
				const nextC = curCol + dx
				if (!Order && nextR === 0 && nextC >= 3 && nextC <= 5) {
					if (matrix[0] && matrix[0][nextC] && matrix[0][nextC] !== 0 && matrix[0][nextC].innerHTML === '') {
						matrix[0][nextC].innerHTML =
							"<div style='background-color: white;' class='white-dot dot-action'></div>"
					}
				}
				if (Order && nextR === 10 && nextC >= 3 && nextC <= 5) {
					if (matrix[10] && matrix[10][nextC] && matrix[10][nextC] !== 0 && matrix[10][nextC].innerHTML === '') {
						matrix[10][nextC].innerHTML =
							"<div style='background-color: white;' class='white-dot dot-action'></div>"
					}
				}
			} else {
				// Raqib donasi yoki boshqa to'siq to'pni to'sadi
				break
			}

			curCol += dx
			curRow += dy
		}
	})
}

// ---------------------------------------------------
// REPLACE & MOVE SYNCHRONIZATION
// ---------------------------------------------------
function isCurrentPlayerTurn() {
	if (!yurish) return false
	if (!isMultiplayer) return true
	const isWhiteTurn = Order === false
	return (myRole === 'white' && isWhiteTurn) || (myRole === 'black' && !isWhiteTurn)
}

function Replace(emitSocket = true) {
	let x1 = selectedItems[0],
		y1 = selectedItems[1],
		x2 = moveItems[0],
		y2 = moveItems[1]

	if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) {
		clearAllDots()
		return
	}

	if (matrix[y1] && matrix[y1][x1] && matrix[y2] && matrix[y2][x2]) {
		matrix[y2][x2].innerHTML = matrix[y1][x1].innerHTML
		matrix[y1][x1].innerHTML = ''
	}
	clearAllDots()

	if (emitSocket && isMultiplayer) {
		netEmit('game_move', {
			from: [x1, y1],
			to: [x2, y2],
			nextOrder: !Order,
		})
	}

	if (yurish) {
		changeOrder()
	}
}

function changeOrder() {
	Order = !Order
	const moveElem = document.querySelector('.move-color-black')
	if (Order) {
		if (moveElem) moveElem.innerHTML = 'Qora'
	} else {
		if (moveElem) moveElem.innerHTML = 'Oq'
	}
	updateTurnUI()
	if (yurish && !isPenalty) {
		resetTurnTimer()
	}
}

function clearAllDots() {
	for (let i = 0; i <= 10; i++) {
		if (matrix[i]) {
			matrix[i].forEach(cell => {
				if (cell && cell.childNodes[0] && cell.childNodes[0].classList && cell.childNodes[0].classList.contains('dot-action')) {
					cell.innerHTML = ''
				}
			})
		}
	}
	Dots = false
}

// ---------------------------------------------------
// ACTIVE MATCH CLICK RULES
// ---------------------------------------------------
function removeCurrentRules() {
	currentClickHandlers.forEach(({ element, handler }) => {
		element.removeEventListener('click', handler)
	})
	currentClickHandlers = []
}

function currentRules() {
	removeCurrentRules()
	squadsBoard.forEach((item, index) => {
		const handler = () => {
			if (!yurish) return

			if (item.childNodes[0]) {
				if (item.childNodes[0].classList.contains('dot-action')) {
					// STRICT TURN CHECK ON MOVING TO TARGET CELL
					if (!isCurrentPlayerTurn()) {
						clearAllDots()
						showToast("Hozir sizning navbatingiz emas! Raqib yurishini kuting.", 'warning')
						return
					}
					moveItems = [index % 9, Math.floor(index / 9) + 1]
					Replace(true)
				} else if (item.childNodes[0].classList.contains('ball')) {
					// STRICT TURN CHECK ON BALL INTERACTION
					if (!isCurrentPlayerTurn()) {
						showToast("Hozir raqibingiz navbati! To'pni faqat o'z navbatingizda tepa olasiz.", 'warning')
						return
					}
					if (!checkAround(index % 9, Math.floor(index / 9) + 1)) {
						showToast("To'pni tepish uchun uning yonida sizning donangiz bo'lishi kerak!", 'warning')
						return
					}
					clearAllDots()
					Ball(index % 9, Math.floor(index / 9) + 1)
				} else if (item.childNodes[0].classList.contains('rook')) {
					// STRICT TURN CHECK ON ROOK (KEEPER)
					if (!isCurrentPlayerTurn()) {
						showToast("Hozir raqibingiz navbati! Iltimos kuting.", 'warning')
						return
					}
					const isWhite = item.childNodes[0].classList.contains('white-pieces') || item.childNodes[0].classList.contains('whitee')
					const isBlack = item.childNodes[0].classList.contains('black-pieces') || item.childNodes[0].classList.contains('black')

					if (isMultiplayer) {
						if (myRole === 'white' && !isWhite) {
							showToast("Siz Oqlar jamoasisiz! Raqib darvozabonini yura olmaysiz.", 'warning')
							return
						}
						if (myRole === 'black' && !isBlack) {
							showToast("Siz Qoralar jamoasisiz! Raqib darvozabonini yura olmaysiz.", 'warning')
							return
						}
					} else {
						if (Order === false && !isWhite) {
							showToast("Hozir Oqlarning navbati!", 'warning')
							return
						}
						if (Order === true && !isBlack) {
							showToast("Hozir Qoralarning navbati!", 'warning')
							return
						}
					}

					clearAllDots()
					selectedItems = [index % 9, Math.floor(index / 9) + 1]
					showDots(Math.floor(index / 9) + 1, index % 9, 'rook')
				} else if (item.childNodes[0].classList.contains('piece')) {
					// STRICT TURN CHECK ON FIELD PIECE (BISHOP/KNIGHT)
					if (!isCurrentPlayerTurn()) {
						showToast("Hozir raqibingiz navbati! Iltimos kuting.", 'warning')
						return
					}
					const isWhite = item.childNodes[0].classList.contains('white-pieces') || item.childNodes[0].classList.contains('whitee')
					const isBlack = item.childNodes[0].classList.contains('black-pieces') || item.childNodes[0].classList.contains('black')

					if (isMultiplayer) {
						if (myRole === 'white' && !isWhite) {
							showToast("Siz Oqlar jamoasisiz! Raqib donasini yura olmaysiz.", 'warning')
							return
						}
						if (myRole === 'black' && !isBlack) {
							showToast("Siz Qoralar jamoasisiz! Raqib donasini yura olmaysiz.", 'warning')
							return
						}
					} else {
						if (Order === false && !isWhite) {
							showToast("Hozir Oqlarning navbati!", 'warning')
							return
						}
						if (Order === true && !isBlack) {
							showToast("Hozir Qoralarning navbati!", 'warning')
							return
						}
					}

					clearAllDots()
					// HAMMA DONALAR (FIL VA OT) BIR XIL: FAQAT 1 TA KATAK ATROFIDA YURADI!
					selectedItems = [index % 9, Math.floor(index / 9) + 1]
					Piece(index % 9, Math.floor(index / 9) + 1)
				} else {
					clearAllDots()
				}
			} else {
				clearAllDots()
			}
		}

		item.addEventListener('click', handler)
		currentClickHandlers.push({ element: item, handler })
	})
}

// ---------------------------------------------------
// GOAL SCORING & CELEBRATION
// ---------------------------------------------------
const scores = document.querySelectorAll('.score')

function resetToKickoff() {
	clearMatrix()
	Pieces.white.bishop = [[6, 0], [6, 1], [6, 2]]
	Pieces.white.knight = [5, 3]
	Pieces.black.bishop = [[4, 0], [4, 1], [4, 2]]
	Pieces.black.knight = [5, 5]
	buildMatrix()
}

function executeGoal(from, to, emit = true) {
	stopTurnTimer()
	const [x1, y1] = from
	const [x2, y2] = to

	if (matrix[y1] && matrix[y1][x1] && matrix[y2] && matrix[y2][x2]) {
		matrix[y2][x2].innerHTML = matrix[y1][x1].innerHTML
		matrix[y1][x1].innerHTML = ''
		const ballImg = matrix[y2][x2].querySelector('.ball')
		if (ballImg) {
			ballImg.classList.add('ball-goal-white')
		}
	}

	clearAllDots()
	selectedItems = []
	const goalBanner = document.querySelector('.goall')
	if (goalBanner) goalBanner.style.display = 'flex'

	if (emit && isMultiplayer) {
		netEmit('goal_scored', {
			from,
			to,
			scorer: Order ? 'black' : 'white',
			whiteScore: whiteScore + (Order ? 0 : 1),
			blackScore: blackScore + (Order ? 1 : 0),
		})
	}

	setTimeout(() => {
		if (goalBanner) goalBanner.style.display = 'none'
		if (Order) {
			blackScore++
			if (scores[1]) scores[1].textContent = blackScore
		} else {
			whiteScore++
			if (scores[0]) scores[0].textContent = whiteScore
		}
		if (!isPenalty) {
			resetToKickoff()
		}
		changeOrder()
	}, 2000)
}

// Goal white dot click handler
window.addEventListener('click', e => {
	if (
		Dots &&
		(e.target.classList.contains('white-dot') ||
			(e.target.childNodes[0] &&
				e.target.childNodes[0].classList.contains('white-dot')))
	) {
		if (isMultiplayer) {
			if (myRole === 'white' && Order !== false) return
			if (myRole === 'black' && Order !== true) return
		}

		let targetCell = e.target.classList.contains('white-dot')
			? e.target.parentElement
			: e.target

		let toY = -1, toX = -1
		for (let r = 0; r <= 10; r++) {
			for (let c = 0; c < 9; c++) {
				if (matrix[r][c] === targetCell) {
					toY = r
					toX = c
					break
				}
			}
			if (toY !== -1) break
		}

		if (toY !== -1 && toX !== -1) {
			executeGoal(selectedItems, [toX, toY], true)
		}
	}
})

// ---------------------------------------------------
// MATCH DURATION TIMER & WIN / PENALTY TRIGGER
// ---------------------------------------------------
function startTimer() {
	if (timerInterval) clearInterval(timerInterval)
	let timeLeft = duration

	timerInterval = setInterval(() => {
		const minutes = Math.floor(timeLeft / 60)
		const seconds = timeLeft % 60
		const timeElem = document.querySelector('.time')
		if (timeLeft >= 0 && timeElem) {
			timeElem.textContent = `${minutes
				.toString()
				.padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
		}

		if (timeLeft <= 0) {
			clearInterval(timerInterval)
			stopTurnTimer()

			// Match ended: check score
			if (blackScore === whiteScore) {
				// Durrang! Penaltilar seriyasiga o'tish
				showToast(`⏱️ Asosiy vaqt tugadi! Hisob durrang (${whiteScore}:${blackScore}). Penaltilar seriyasi boshlanadi!`, 'warning')
				setTimeout(() => {
					startPenaltyShootout()
				}, 1500)
			} else {
				// Kimdir yutdi
				Winning()
			}
		}

		timeLeft--
	}, 1000)
}

// ---------------------------------------------------
// PENALTY SHOOTOUT (Original pitch-based mechanism)
// ---------------------------------------------------
function startPenaltyShootout(emit = true) {
	isPenalty = true
	stopTurnTimer()
	if (timerInterval) clearInterval(timerInterval)

	const timeElem = document.querySelector('.time')
	if (timeElem) timeElem.textContent = 'PENALTI'

	if (emit && isMultiplayer) {
		netEmit('penalty_mode_started', {})
	}

	Penalty(emit)
}

function Penalty(emit = true) {
	Gs++
	isPenalty = true
	stopTurnTimer()
	clearMatrix()
	clearAllDots()

	let option
	// If Order === true (Black shoots), White keeper defends
	// If Order === false (White shoots), Black keeper defends
	if (Order) option = ['white', 'black']
	else option = ['black', 'white']

	// Goalkeeper zone above the top goal
	const keeperZone = document.getElementById('keeper-zone')
	if (keeperZone) {
		keeperZone.classList.add('show')
		keeperZone.style.display = 'flex'
	}

	const sq1 = keeperZone ? keeperZone.querySelector('.squad') : null
	if (sq1) {
		sq1.innerHTML = `<img class="${option[0]}-rook rook" src="/images/pieces/${option[0]}/rook.png" alt="Darvozabon">`
	}

	// Ball at (4, 2)
	if (matrix[2] && matrix[2][4]) {
		matrix[2][4].innerHTML = '<img src="/images/ball.jpg" alt="" class="ball">'
	}

	// Shooter knight at (3, 3)
	if (matrix[3] && matrix[3][3]) {
		matrix[3][3].innerHTML = `<img class="${option[1]}-rook piece" src="/images/pieces/${option[1]}/knight.png" alt="Zarba">`
	}

	selectedItems = [4, 2]

	const shootingTeamName = Order ? 'Qoralar' : 'Oqlar'
	const turnBanner = document.getElementById('mp-turn-banner')
	if (turnBanner) {
		turnBanner.textContent = `⚽ Penalti: ${shootingTeamName} zarba bermoqda (${Gs}-zarba)`
		turnBanner.className = 'mp-turn-banner mp-my-turn'
	}
	showToast(`⚽ Penaltilar seriyasi: ${shootingTeamName} to'p tepadi!`, 'info')

	setupPenaltyPitchRules()
}

function setupPenaltyPitchRules() {
	// Ball click handler
	const ballCell = matrix[2] && matrix[2][4] ? matrix[2][4] : null
	const ballElem = ballCell ? ballCell.querySelector('.ball') : null
	if (ballElem) {
		ballElem.onclick = (e) => {
			e.stopPropagation()
			if (isMultiplayer) {
				const isMyTurnToShoot = (myRole === 'white' && !Order) || (myRole === 'black' && Order)
				if (!isMyTurnToShoot) {
					showToast("Hozir raqibingizning zarba berish navbati!", 'info')
					return
				}
			}

			// Show target white dots in top goal (cells 3, 4, 5 of matrix[0])
			for (let i = 3; i < 6; i++) {
				if (matrix[0] && matrix[0][i] && matrix[0][i] !== 0) {
					matrix[0][i].innerHTML =
						"<div style='background-color: white;' class='white-dot dot-action'></div>"
				}
			}
			Dots = true
		}
	}

	// Top goal squad clicks for shooting
	const topGoal = document.getElementById('top-goal')
	if (topGoal) {
		const squads = topGoal.querySelectorAll('.squad')
		squads.forEach((sq, idx) => {
			const col = idx + 3 // columns 3, 4, 5
			sq.onclick = (e) => {
				if (!isPenalty || !Dots) return
				if (isMultiplayer) {
					const isMyTurnToShoot = (myRole === 'white' && !Order) || (myRole === 'black' && Order)
					if (!isMyTurnToShoot) {
						showToast("Hozir raqibingizning zarba berish navbati!", 'info')
						return
					}
				}

				// Goalkeeper dives to random spot among 3, 4, 5
				const randCol = [3, 4, 5][Math.floor(Math.random() * 3)]
				executePenaltyShot(col, randCol, true)
			}
		})
	}
}

function executePenaltyShot(targetCol, keeperCol, emit = true) {
	let option
	if (Order) option = ['white', 'black']
	else option = ['black', 'white']

	// Goalkeeper leaves keeper zone
	const keeperZone = document.getElementById('keeper-zone')
	const sqKeeper = keeperZone ? keeperZone.querySelector('.squad') : null
	if (sqKeeper) sqKeeper.innerHTML = ''

	clearAllDots()

	// Move ball to targetCol in goal
	if (matrix[2] && matrix[2][4]) {
		matrix[2][4].innerHTML = ''
	}
	if (matrix[0] && matrix[0][targetCol] && matrix[0][targetCol] !== 0) {
		matrix[0][targetCol].innerHTML = '<img src="/images/ball.jpg" alt="" class="ball">'
	}

	const isGoal = (keeperCol !== targetCol)

	if (isGoal) {
		// Goalkeeper dove to keeperCol
		if (matrix[0] && matrix[0][keeperCol] && matrix[0][keeperCol] !== 0) {
			matrix[0][keeperCol].innerHTML = `<img class="${option[0]}-rook rook" src="/images/pieces/${option[0]}/rook.png" alt="">`
		}

		// Goal banner display
		const goalBanner = document.querySelector('.goall')
		if (goalBanner) goalBanner.style.display = 'flex'

		if (Order) {
			blackScore++
			if (scores[1]) scores[1].textContent = blackScore
		} else {
			whiteScore++
			if (scores[0]) scores[0].textContent = whiteScore
		}

		showToast(`⚽ GOOOL! ${Order ? 'Qoralar' : 'Oqlar'} gol urdi!`, 'success')

		setTimeout(() => {
			if (goalBanner) goalBanner.style.display = 'none'
			checkPenaltyWinner()
		}, 3000)
	} else {
		// SEYV: Goalkeeper catches ball at targetCol
		if (matrix[0] && matrix[0][targetCol] && matrix[0][targetCol] !== 0) {
			matrix[0][targetCol].innerHTML = `<img class="${option[0]}-rook rook" src="/images/pieces/${option[0]}/rook.png" alt="">`
		}
		showToast(`🧤 SEYV! Darvozabon to'pni qaytardi!`, 'warning')

		setTimeout(() => {
			checkPenaltyWinner()
		}, 3000)
	}

	if (emit && isMultiplayer) {
		netEmit('penalty_pitch_shot', {
			targetCol,
			keeperCol
		})
	}
}

function checkPenaltyWinner() {
	if (Gs > 0 && Gs % 2 === 0 && blackScore !== whiteScore) {
		Winning()
	} else {
		changeOrder()
		Penalty(true)
	}
}

function Winning() {
	document.body.style.padding = '0px'
	stopTurnTimer()
	if (timerInterval) clearInterval(timerInterval)

	const container = document.querySelector('.container')
	if (container) container.style.display = 'none'

	const container1 = document.getElementById('game-over-screen') || document.querySelector('.container-1')
	if (container1) {
		container1.classList.add('show')
		container1.style.display = 'flex'
	}

	let winner = 'draw'
	if (whiteScore > blackScore) winner = 'white'
	else if (blackScore > whiteScore) winner = 'black'

	const trophyElem = document.getElementById('game-over-trophy')
	const titleElem = document.getElementById('game-over-title')
	const subtitleElem = document.getElementById('game-over-subtitle')

	if (trophyElem) {
		trophyElem.textContent = winner === 'draw' ? '🤝' : '🏆'
	}

	if (titleElem) {
		titleElem.textContent = winner === 'draw' ? "DURRANG!" : "G'ALABA!"
	}

	if (subtitleElem) {
		if (isMultiplayer) {
			if (winner === 'draw') {
				subtitleElem.textContent = "Jangovar durrang qayd etildi!"
			} else if (winner === myRole) {
				subtitleElem.textContent = "Tabriklaymiz! Siz g'olib bo'ldingiz! 🥇"
			} else {
				subtitleElem.textContent = "Afsus, bu safar raqibingiz g'olib bo'ldi."
			}
		} else {
			if (winner === 'draw') {
				subtitleElem.textContent = "Lokal o'yin durrang bilan yakunlandi!"
			} else if (winner === 'white') {
				subtitleElem.textContent = `${whiteTeamName || "Oqlar"} jamoasi g'alaba qozondi!`
			} else {
				subtitleElem.textContent = `${blackTeamName || "Qoralar"} jamoasi g'alaba qozondi!`
			}
		}
	}

	const whiteScoreElem = document.getElementById('game-over-white-score')
	const blackScoreElem = document.getElementById('game-over-black-score')
	const whiteNameElem = document.getElementById('game-over-white-name')
	const blackNameElem = document.getElementById('game-over-black-name')

	if (whiteScoreElem) whiteScoreElem.textContent = whiteScore
	if (blackScoreElem) blackScoreElem.textContent = blackScore
	if (whiteNameElem) whiteNameElem.textContent = whiteTeamName || "Oqlar"
	if (blackNameElem) blackNameElem.textContent = blackTeamName || "Qoralar"

	const s1 = document.querySelectorAll('.score1')
	if (s1 && s1.length >= 2) {
		s1[0].textContent = whiteScore
		s1[1].textContent = blackScore
	}

	const penaltyBadge = document.getElementById('game-over-extra-badge')
	const penaltyScore = document.getElementById('game-over-penalty-score')
	if (isPenalty && penaltyBadge && penaltyScore) {
		penaltyBadge.style.display = 'inline-block'
		penaltyScore.textContent = `${whiteScore} : ${blackScore}`
	} else if (penaltyBadge) {
		penaltyBadge.style.display = 'none'
	}

	const modeText = document.getElementById('game-over-mode-text')
	const totalGoals = document.getElementById('game-over-total-goals')
	if (modeText) modeText.textContent = isMultiplayer ? "Online 1v1" : "Lokal 2-o'yinchi"
	if (totalGoals) totalGoals.textContent = (whiteScore + blackScore).toString()

	const btnRes = document.getElementById('btn-rematch') || document.querySelector('.btn-res')
	if (btnRes) {
		btnRes.onclick = () => {
			if (isMultiplayer) {
				netEmit('rematch_request', {})
			}
			location.reload()
		}
	}

	const btnGOLobby = document.getElementById('btn-game-over-lobby')
	if (btnGOLobby) {
		btnGOLobby.onclick = () => {
			location.reload()
		}
	}
}

// ---------------------------------------------------
// MULTIPLAYER LOBBY UI LOGIC (Only Create and Join)
// ---------------------------------------------------
const lobbyOverlay = document.getElementById('lobby-overlay')
const teamNameInput = document.getElementById('team-name-input')
const btnCreateRoom = document.getElementById('btn-create-room')
const createRoomInfo = document.getElementById('create-room-info')
const createdRoomCode = document.getElementById('created-room-code')
const btnCopyCode = document.getElementById('btn-copy-code')
const copyBtnText = document.getElementById('copy-btn-text')
const btnJoinRoom = document.getElementById('btn-join-room')
const joinCodeInput = document.getElementById('join-code-input')
const joinStatus = document.getElementById('join-status')
const btnPlayOffline = document.getElementById('btn-play-offline')
const btnOpenRules = document.getElementById('btn-open-rules')
const btnReturnLobby = document.getElementById('btn-return-lobby')
const mpRoomBadge = document.getElementById('mp-room-badge')

// Tabs: Create and Join
const tabs = document.querySelectorAll('.lobby-tab')
tabs.forEach(tab => {
	tab.addEventListener('click', () => {
		tabs.forEach(t => t.classList.remove('active'))
		tab.classList.add('active')
		const targetTab = tab.getAttribute('data-tab')
		document.querySelectorAll('.lobby-tab-content').forEach(c => {
			c.classList.remove('active')
		})
		const activeContent = document.getElementById(`tab-${targetTab}`)
		if (activeContent) activeContent.classList.add('active')
	})
})

// Helper: generate 6-digit room code
function generateRoomCode() {
	return Math.floor(100000 + Math.random() * 900000).toString()
}

// Opponent disconnected handler
function handleOpponentDisconnect() {
	stopTurnTimer()
	if (timerInterval) clearInterval(timerInterval)

	if (myRole === 'white') {
		whiteScore = 3
		blackScore = 0
	} else {
		whiteScore = 0
		blackScore = 3
	}

	if (scores[0]) scores[0].textContent = whiteScore
	if (scores[1]) scores[1].textContent = blackScore

	const modal = document.getElementById('disconnect-modal')
	if (modal) {
		const msgElem = document.getElementById('disconnect-message')
		const titleElem = document.getElementById('victory-title')
		const leftScore = document.getElementById('winner-score-left')
		const rightScore = document.getElementById('winner-score-right')
		if (titleElem) titleElem.textContent = "🏆 Raqib chiqib ketdi!"
		if (msgElem) msgElem.textContent = "Raqib o'yindan chiqib ketgani sababli sizga texnik g'alaba (3 : 0) berildi!"
		if (leftScore) leftScore.textContent = whiteScore
		if (rightScore) rightScore.textContent = blackScore
		modal.style.display = 'flex'
	}
	showToast("🏆 Raqib chiqib ketdi, sizga 3 : 0 g'alaba berildi!", 'success')
}

// Centralized P2P Event Handler
function handleNetEvent(event, data) {
	switch (event) {
		case 'guest_join': {
			isMultiplayer = true
			lastOpponentHeartbeat = Date.now()
			oppTeamName = data.teamName || 'Qoralar'
			if (lobbyOverlay) lobbyOverlay.style.display = 'none'
			showToast(`Raqib (${oppTeamName}) ulandi! O'yin boshlandi. Oqlar birinchi yuradi.`, 'success')
			updateHud()
			netEmit('host_welcome', {
				teamName: myTeamName,
				time: Time,
				duration: duration,
			})
			triggerStartGame()
			break
		}
		case 'host_welcome': {
			isMultiplayer = true
			lastOpponentHeartbeat = Date.now()
			oppTeamName = data.teamName || 'Oqlar'
			if (data.time) {
				Time = data.time
				duration = data.duration
				updateMatchTimerDisplay()
			}
			if (lobbyOverlay) lobbyOverlay.style.display = 'none'
			showToast(`Xonaga ulandingiz! Raqib: ${oppTeamName} (Oqlar). O'yin boshlandi!`, 'success')
			updateHud()
			triggerStartGame()
			break
		}
		case 'prep_move': {
			const [x1, y1] = data.from
			const [x2, y2] = data.to
			if (matrix[y1] && matrix[y1][x1] && matrix[y2] && matrix[y2][x2]) {
				matrix[y2][x2].innerHTML = matrix[y1][x1].innerHTML
				matrix[y1][x1].innerHTML = ''
			}
			clearAllDots()
			break
		}
		case 'timer_change': {
			Time = data.time
			duration = data.duration
			updateMatchTimerDisplay()
			break
		}
		case 'player_ready': {
			oppIsReady = true
			showToast("⚡ Raqib tayyor bo'ldi!", 'info')
			if (isHost) {
				hostReadyState.guest = true
				if (hostReadyState.host && hostReadyState.guest) {
					netEmit('game_started', {})
					if (!yurish) triggerStartGame()
				}
			}
			break
		}
		case 'game_started': {
			if (!yurish) {
				triggerStartGame()
			}
			break
		}
		case 'game_move': {
			const [x1, y1] = data.from
			const [x2, y2] = data.to
			if (matrix[y1] && matrix[y1][x1] && matrix[y2] && matrix[y2][x2]) {
				matrix[y2][x2].innerHTML = matrix[y1][x1].innerHTML
				matrix[y1][x1].innerHTML = ''
			}
			clearAllDots()
			if (typeof data.nextOrder === 'boolean') {
				Order = data.nextOrder
				updateTurnUI()
				if (yurish && !isPenalty) {
					resetTurnTimer()
				}
			} else {
				changeOrder()
			}
			break
		}
		case 'turn_timeout': {
			handleTurnTimeout(true)
			break
		}
		case 'goal_scored': {
			executeGoal(data.from, data.to, false)
			break
		}
		case 'penalty_mode_started': {
			if (!isPenalty) {
				startPenaltyShootout(false)
			}
			break
		}
		case 'penalty_pitch_shot': {
			executePenaltyShot(data.targetCol, data.keeperCol, false)
			break
		}
		case 'rematch_request': {
			location.reload()
			break
		}
	}
}

// Create Room Action (Host - HTTPS/SSE)
function initHostRoom(forcedCode = null) {
	myTeamName = (teamNameInput ? teamNameInput.value.trim() : '') || 'Barsa'
	isHost = true
	myRole = 'white'
	isMultiplayer = false

	const code = forcedCode || generateRoomCode()
	currentRoomCode = code

	if (createdRoomCode) createdRoomCode.textContent = currentRoomCode
	if (createRoomInfo) createRoomInfo.style.display = 'flex'

	const hostStatusMsg = document.getElementById('host-status-msg')
	const hostSpinner = document.querySelector('#host-status .waiting-spinner')
	if (hostStatusMsg) {
		hostStatusMsg.textContent = `🟢 Xona faol (#${currentRoomCode})! Raqib (Qoralar) ulanishi kutilmoqda...`
		hostStatusMsg.style.color = '#15803d'
	}
	if (hostSpinner) hostSpinner.style.display = 'none'

	startNetListener()
	showToast(`Xona (#${currentRoomCode}) tayyor! Kodni do'stingizga yuboring.`, 'success')
}

if (btnCreateRoom) {
	btnCreateRoom.addEventListener('click', () => {
		initHostRoom()
	})
}

// Join Room Action (Guest - HTTPS/SSE)
if (btnJoinRoom) {
	btnJoinRoom.addEventListener('click', () => {
		const rawCode = joinCodeInput ? joinCodeInput.value.trim() : ''
		const code = rawCode.replace(/^cb-/, '')
		if (!code) {
			if (joinStatus) {
				joinStatus.textContent = 'Iltimos, xona kodini kiriting!'
				joinStatus.style.display = 'block'
				joinStatus.style.color = '#dc2626'
			}
			return
		}
		myTeamName = (teamNameInput ? teamNameInput.value.trim() : '') || 'Real Madrid'
		isHost = false
		myRole = 'black'
		currentRoomCode = code
		isMultiplayer = false

		if (joinStatus) {
			joinStatus.textContent = "Xonaga ulanilmoqda, xona egasi kutilmoqda..."
			joinStatus.style.display = 'block'
			joinStatus.style.color = '#2563eb'
		}
		btnJoinRoom.disabled = true

		startNetListener()

		let attempts = 0
		const sendJoinHandshake = () => {
			if (!isMultiplayer && attempts < 20) {
				attempts++
				netEmit('guest_join', { teamName: myTeamName })
				setTimeout(sendJoinHandshake, 1000)
			} else if (!isMultiplayer && attempts >= 20) {
				btnJoinRoom.disabled = false
				if (joinStatus) {
					joinStatus.textContent = "Xona egasidan javob kelmadi. Kod to'g'riligini tekshiring."
					joinStatus.style.color = '#dc2626'
				}
			}
		}
		sendJoinHandshake()
	})
}

if (joinCodeInput) {
	joinCodeInput.addEventListener('keydown', e => {
		if (e.key === 'Enter') {
			if (btnJoinRoom) btnJoinRoom.click()
		}
	})
}

if (teamNameInput) {
	teamNameInput.addEventListener('input', () => {
		myTeamName = teamNameInput.value.trim() || (isHost ? 'Barsa' : 'Real Madrid')
	})
}

// Copy Code
if (btnCopyCode) {
	btnCopyCode.addEventListener('click', () => {
		if (currentRoomCode) {
			navigator.clipboard.writeText(currentRoomCode).then(() => {
				if (copyBtnText) copyBtnText.textContent = 'Nusxa olindi! ✅'
				showToast('Xona kodi nusxalandi! 📋', 'success')
				setTimeout(() => {
					if (copyBtnText) copyBtnText.textContent = '📋 Koddan nusxa olish'
				}, 2000)
			})
		}
	})
}

// Copy Shareable Link (for direct invite)
const btnCopyLink = document.getElementById('btn-copy-link')
const copyLinkText = document.getElementById('copy-link-text')
if (btnCopyLink) {
	btnCopyLink.addEventListener('click', () => {
		if (currentRoomCode) {
			const shareUrl = `${window.location.origin}${window.location.pathname}?room=${currentRoomCode}`
			navigator.clipboard.writeText(shareUrl).then(() => {
				if (copyLinkText) copyLinkText.textContent = 'Havola nusxalandi! ✅'
				showToast("Do'stingiz uchun havola nusxalandi! 🔗", 'success')
				setTimeout(() => {
					if (copyLinkText) copyLinkText.textContent = "🔗 Do'stga havola nusxalash"
				}, 2000)
			})
		}
	})
}

if (mpRoomBadge) {
	mpRoomBadge.addEventListener('click', () => {
		if (currentRoomCode) {
			navigator.clipboard.writeText(currentRoomCode).then(() => {
				showToast(`Xona kodi (#${currentRoomCode}) nusxalandi! 📋`, 'success')
			})
		}
	})
}

// Local Offline Play
if (btnPlayOffline) {
	btnPlayOffline.addEventListener('click', () => {
		isMultiplayer = false
		if (lobbyOverlay) lobbyOverlay.style.display = 'none'
		showToast("🎮 Lokal rejim tanlandi. 2 kishi navbatma-navbat o'ynashingiz mumkin! Oqlar boshlaydi.", 'info')
		updateHud()
		triggerStartGame()
	})
}

if (btnOpenRules) {
	btnOpenRules.addEventListener('click', () => {
		const rulesModal = document.getElementById('rules-modal') || document.querySelector('.main-container')
		if (rulesModal) {
			rulesModal.style.display = 'flex'
		}
	})
}

const rulesBtnClose = document.getElementById('rules-btn-close')
const rulesBtnGotIt = document.getElementById('rules-btn-got-it')
const closeRulesModal = () => {
	const rulesModal = document.getElementById('rules-modal') || document.querySelector('.main-container')
	if (rulesModal) {
		rulesModal.style.display = 'none'
	}
}
if (rulesBtnClose) rulesBtnClose.addEventListener('click', closeRulesModal)
if (rulesBtnGotIt) rulesBtnGotIt.addEventListener('click', closeRulesModal)

if (btnReturnLobby) {
	btnReturnLobby.addEventListener('click', () => {
		location.reload()
	})
}

// Rematch button on Game Over
const rematchBtn = document.querySelector('.btn-res')
if (rematchBtn) {
	rematchBtn.onclick = () => {
		if (isMultiplayer) {
			netEmit('rematch_request', {})
		}
		location.reload()
	}
}

// Check URL query param for ?room=xxxxxx to auto-fill join input
let isInvitedGuest = false
try {
	const urlParams = new URLSearchParams(window.location.search)
	const roomFromUrl = urlParams.get('room')
	if (roomFromUrl) {
		isInvitedGuest = true
		const cleanCode = roomFromUrl.replace(/^cb-/, '')
		if (joinCodeInput) joinCodeInput.value = cleanCode
		const joinTab = document.querySelector('.lobby-tab[data-tab="join"]')
		if (joinTab) joinTab.click()
		showToast(`Xona #${cleanCode} havolasi aniqlandi! "Xonaga kirish" tugmasini bosing.`, 'info')
	}
} catch (e) {}

// Boshida xona kodi darhol yaratiladi va xona tayyorlanadi (agar taklif havolasi bilan kirmagan bo'lsa)
if (!isInvitedGuest) {
	initHostRoom()
}

// ---------------------------------------------------
// BOOTSTRAP INITIALIZATION
// ---------------------------------------------------
startMatrix()
oldRules()
updateHud()
