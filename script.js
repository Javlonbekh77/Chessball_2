// ===================================================
// CHESSBALL - ULTIMATE MULTIPLAYER & PENALTY ENGINE
// ===================================================

import { Peer as BundledPeer } from 'peerjs'

function getPeerConstructor() {
	if (typeof window !== 'undefined' && window.Peer) {
		return window.Peer
	}
	return BundledPeer
}

const PEER_CONFIG = {
	host: '0.peerjs.com',
	port: 443,
	path: '/',
	secure: true,
	debug: 1,
	config: {
		iceServers: [
			{ urls: 'stun:stun.l.google.com:19302' },
			{ urls: 'stun:stun1.l.google.com:19302' },
			{ urls: 'stun:stun2.l.google.com:19302' },
			{ urls: 'stun:stun3.l.google.com:19302' },
			{ urls: 'stun:stun4.l.google.com:19302' },
			{ urls: 'stun:stun.cloudflare.com:3478' }
		]
	}
}

const matrixContent = document.querySelector('.main-matrix')
const squadsBoard = Array.from(matrixContent ? matrixContent.querySelectorAll('.squad') : [])
const topGoalSquads = Array.from(document.querySelectorAll('.goal-keeping-zone-1.top-goal .squad, .goal-keeping-zone-1:first-of-type .squad'))
const bottomGoalSquads = Array.from(document.querySelectorAll('.goal-keeping-zone-1.bottom-goal .squad, .goal-keeping-zone-1:last-of-type .squad'))
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

// MULTIPLAYER STATE (P2P via PeerJS)
let isMultiplayer = true
let myRole = 'white' // 'white' | 'black'
let isHost = false
let myTeamName = 'Barsa'
let oppTeamName = 'Real Madrid'
let currentRoomCode = null
let myIsReady = false
let oppIsReady = false

let peer = null
let netConn = null
let hostReadyState = { host: false, guest: false }

// P2P Net Event Emitter
function netEmit(event, data = {}) {
	if (netConn && netConn.open) {
		netConn.send({ event, data })
	}
}

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

	showToast("⚽ O'yin boshlandi! Oqlar birinchi yuradi.", 'success')
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
	matrix[1][4].innerHTML =
		'<img class="black-pieces black-rook black rook" src="/images/pieces/black/rook.png" alt="">'
	matrix[9][4].innerHTML =
		'<img class="white-pieces whitee rook" src="/images/pieces/white/rook.png" alt="">'

	Pieces.black.bishop.forEach(item => {
		let y = item[0], x = item[1]
		if (matrix[y] && matrix[y][x]) {
			matrix[y][x].innerHTML =
				'<img class="black-pieces piece black bishop" src="/images/pieces/black/bishop.png" alt="">'
		}
	})
	Pieces.white.bishop.forEach(item => {
		let y = item[0], x = item[1]
		if (matrix[y] && matrix[y][x]) {
			matrix[y][x].innerHTML =
				'<img class="white-pieces piece whitee bishop" src="/images/pieces/white/bishop.png" alt="">'
		}
	})

	if (Pieces.black.knight && Pieces.black.knight.length === 2) {
		let y = Pieces.black.knight[0], x = Pieces.black.knight[1]
		if (matrix[y] && matrix[y][x]) {
			matrix[y][x].innerHTML =
				'<img class="black-pieces piece black" src="/images/pieces/black/knight.png" alt="">'
		}
	}
	if (Pieces.white.knight && Pieces.white.knight.length === 2) {
		let y = Pieces.white.knight[0], x = Pieces.white.knight[1]
		if (matrix[y] && matrix[y][x]) {
			matrix[y][x].innerHTML =
				'<img class="white-pieces piece whitee" src="/images/pieces/white/knight.png" alt="">'
		}
	}

	if (matrix[5] && matrix[5][4]) {
		matrix[5][4].innerHTML = '<img src="/images/ball.jpg" alt="" class="ball">'
	}
}

function cloneMatrix() {
	let row = 0
	for (let i = 1; i <= 5; i++) {
		matrix[i].forEach((item, index) => {
			if (
				item.childNodes[0] &&
				item.childNodes[0].classList.contains('black-pieces') &&
				item.childNodes[0].classList.contains('bishop')
			) {
				Pieces.black.bishop[row] = [i, index]
				row++
			} else if (
				item.childNodes[0] &&
				item.childNodes[0].classList.contains('black-pieces')
			) {
				Pieces.black.knight = [i, index]
			}
		})
	}
	row = 0
	for (let i = 5; i <= 9; i++) {
		matrix[i].forEach((item, index) => {
			if (
				item.childNodes[0] &&
				item.childNodes[0].classList.contains('white-pieces') &&
				item.childNodes[0].classList.contains('bishop')
			) {
				Pieces.white.bishop[row] = [i, index]
				row++
			} else if (
				item.childNodes[0] &&
				item.childNodes[0].classList.contains('white-pieces')
			) {
				Pieces.white.knight = [i, index]
			}
		})
	}
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
	let option
	if (Order) option = 'black'
	else option = 'whitee'
	Dots = true
	selectedItems = [x, y]
	let column = x - 1
	let row = y + 1

	// Gorizontal chapga
	while (
		column >= 0 &&
		(matrix[y][column].innerHTML == '' ||
			(matrix[y][column] &&
				matrix[y][column].childNodes[0].classList.contains(`${option}`)))
	) {
		if (matrix[y][column].innerHTML == '')
			matrix[y][column].innerHTML = "<div class='dot-action'></div>"
		column--
	}
	// Gorizontal o'ngga
	column = x + 1
	while (
		column <= 8 &&
		(matrix[y][column].innerHTML == '' ||
			(matrix[y][column] &&
				matrix[y][column].childNodes[0].classList.contains(`${option}`)))
	) {
		if (matrix[y][column].innerHTML == '')
			matrix[y][column].innerHTML = "<div class='dot-action'></div>"
		column++
	}

	// Pastga qarab to'p tepish (row 1 -> 9 -> 10)
	while (
		row <= 10 &&
		matrix[row] &&
		matrix[row][x] !== undefined &&
		(matrix[row][x] === 0 ||
			matrix[row][x].innerHTML == '' ||
			(matrix[row][x] &&
				matrix[row][x].childNodes[0] &&
				matrix[row][x].childNodes[0].classList.contains(`${option}`)))
	) {
		if (matrix[row][x] && matrix[row][x] !== 0 && matrix[row][x].innerHTML == '') {
			if (row == 10) {
				// 10-qator: PASTKI DARVOZA (Oqlarning darvozasi).
				// Bunga FAQAT QORALAR (Order === true) gol ura oladi!
				// Oqlar o'z darvozasiga to'p yo'naltira olmaydi!
				if (Order && y >= 5 && x >= 3 && x <= 5) {
					matrix[row][x].innerHTML =
						"<div style='background-color: white;' class='white-dot dot-action'></div>"
				}
			} else {
				matrix[row][x].innerHTML = "<div class='dot-action'></div>"
			}
		}
		row++
	}

	// Tepaga qarab to'p tepish (row 9 -> 1 -> 0)
	row = y - 1
	while (
		row >= 0 &&
		matrix[row] &&
		matrix[row][x] !== undefined &&
		(matrix[row][x] === 0 ||
			matrix[row][x].innerHTML == '' ||
			(matrix[row][x] &&
				matrix[row][x].childNodes[0] &&
				matrix[row][x].childNodes[0].classList.contains(`${option}`)))
	) {
		if (matrix[row][x] && matrix[row][x] !== 0 && matrix[row][x].innerHTML == '') {
			if (row == 0) {
				// 0-qator: YUQORIGI DARVOZA (Qoralarning darvozasi).
				// Bunga FAQAT OQLAR (!Order) gol ura oladi!
				// Qoralar o'z darvozasiga to'p yo'naltira olmaydi!
				if (!Order && y <= 5 && x >= 3 && x <= 5) {
					matrix[row][x].innerHTML =
						"<div style='background-color: white;' class='white-dot dot-action'></div>"
				}
			} else {
				matrix[row][x].innerHTML = "<div class='dot-action'></div>"
			}
		}
		row--
	}

	// Diagonal zarbalar (faqat raqib darvozasiga gol kiritish mumkin, o'z darvozasiga emas)
	for (let i = 0; i < 4; i++) {
		let items = mass[i]
		if (items[0] == 0) column = x - 1
		else column = x + 1
		if (items[1] == 0) row = y - 1
		else row = y + 1
		while (
			0 <= column &&
			column <= 8 &&
			1 <= row &&
			row <= 9 &&
			matrix[row] &&
			matrix[row][column] &&
			(matrix[row][column].innerHTML == '' ||
				matrix[row][column].childNodes[0].classList.contains(`${option}`))
		) {
			if (matrix[row][column].innerHTML == '') {
				// Pastdagi darvozaga diagonal zarba - FAQAT QORALAR uchun
				if (row == 9 && column >= 3 && column <= 5 && Order && y >= 5) {
					if (matrix[10] && matrix[10][column] && matrix[10][column] !== 0 && matrix[10][column].innerHTML == '') {
						matrix[10][column].innerHTML =
							"<div style='background-color: white;' class='white-dot dot-action'></div>"
					}
				}
				// Tepdagi darvozaga diagonal zarba - FAQAT OQLAR uchun
				if (row == 1 && column >= 3 && column <= 5 && !Order && y <= 5) {
					if (matrix[0] && matrix[0][column] && matrix[0][column] !== 0 && matrix[0][column].innerHTML == '') {
						matrix[0][column].innerHTML =
							"<div style='background-color: white;' class='white-dot dot-action'></div>"
					}
				}
				matrix[row][column].innerHTML = "<div class='dot-action'></div>"
			}
			if (items[0] == 0) column--
			else column++
			if (items[1] == 0) row--
			else row++
		}
	}
}

// ---------------------------------------------------
// REPLACE & MOVE SYNCHRONIZATION
// ---------------------------------------------------
function Replace(emitSocket = true) {
	let x1 = selectedItems[0],
		y1 = selectedItems[1],
		x2 = moveItems[0],
		y2 = moveItems[1]

	if (matrix[y1] && matrix[y1][x1] && matrix[y2] && matrix[y2][x2]) {
		matrix[y2][x2].innerHTML = matrix[y1][x1].innerHTML
		matrix[y1][x1].innerHTML = ''
	}
	clearAllDots()

	if (emitSocket && isMultiplayer) {
		if (!yurish) {
			netEmit('prep_move', {
				from: [x1, y1],
				to: [x2, y2],
			})
		} else {
			netEmit('game_move', {
				from: [x1, y1],
				to: [x2, y2],
			})
		}
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
			if (item.childNodes[0]) {
				if (item.childNodes[0].classList.contains('dot-action')) {
					moveItems = [index % 9, Math.floor(index / 9) + 1]
					Replace(true)
				} else if (
					item.childNodes[0].classList.contains('ball') &&
					checkAround(index % 9, Math.floor(index / 9) + 1)
				) {
					if (isMultiplayer) {
						if (myRole === 'white' && Order !== false) return
						if (myRole === 'black' && Order !== true) return
					}
					clearAllDots()
					Ball(index % 9, Math.floor(index / 9) + 1)
				} else if (
					item.childNodes[0].classList.contains('rook') &&
					Dots == false
				) {
					if (isMultiplayer) {
						const isWhite = item.childNodes[0].classList.contains('white-pieces') || item.childNodes[0].classList.contains('whitee')
						const isBlack = item.childNodes[0].classList.contains('black-pieces') || item.childNodes[0].classList.contains('black')
						if (myRole === 'white' && (!isWhite || Order !== false)) return
						if (myRole === 'black' && (!isBlack || Order !== true)) return
					} else {
						const isWhite = item.childNodes[0].classList.contains('white-pieces') || item.childNodes[0].classList.contains('whitee')
						const isBlack = item.childNodes[0].classList.contains('black-pieces') || item.childNodes[0].classList.contains('black')
						if (Order === false && !isWhite) return
						if (Order === true && !isBlack) return
					}

					selectedItems = [index % 9, Math.floor(index / 9) + 1]
					showDots(Math.floor(index / 9) + 1, index % 9, 'rook')
				} else if (
					item.childNodes[0].classList.contains('piece') &&
					Dots == false
				) {
					if (isMultiplayer) {
						const isWhite = item.childNodes[0].classList.contains('white-pieces') || item.childNodes[0].classList.contains('whitee')
						const isBlack = item.childNodes[0].classList.contains('black-pieces') || item.childNodes[0].classList.contains('black')
						if (myRole === 'white' && (!isWhite || Order !== false)) return
						if (myRole === 'black' && (!isBlack || Order !== true)) return
					} else {
						const isWhite = item.childNodes[0].classList.contains('white-pieces') || item.childNodes[0].classList.contains('whitee')
						const isBlack = item.childNodes[0].classList.contains('black-pieces') || item.childNodes[0].classList.contains('black')
						if (Order === false && !isWhite) return
						if (Order === true && !isBlack) return
					}

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
			clearMatrix()
			buildMatrix()
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
	const container = document.querySelector('.container')
	if (container) container.style.display = 'none'

	const container1 = document.querySelector('.container-1')
	if (container1) {
		container1.classList.add('show')
		container1.style.display = 'flex'
	}

	const s1 = document.querySelectorAll('.score1')
	if (s1 && s1.length >= 2) {
		s1[0].textContent = whiteScore
		s1[1].textContent = blackScore
	}

	const btnRes = document.querySelector('.btn-res')
	if (btnRes) {
		btnRes.onclick = () => {
			if (isMultiplayer) {
				netEmit('rematch_request', {})
			}
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

// Setup PeerJS connection lifecycle
function setupConnection(conn) {
	netConn = conn

	conn.on('open', () => {
		console.log('[P2P] Aloqa o\'rnatildi!')
		if (!isHost) {
			netEmit('guest_join', { teamName: myTeamName })
		}
	})

	conn.on('data', packet => {
		if (packet && packet.event) {
			handleNetEvent(packet.event, packet.data)
		}
	})

	conn.on('close', () => {
		console.warn('[P2P] Aloqa uzildi')
		handleOpponentDisconnect()
	})

	conn.on('error', err => {
		console.error('[P2P] Ulanish xatosi:', err)
		showToast('Tarmoq aloqasida xatolik yuz berdi', 'error')
	})
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
			oppTeamName = data.teamName || 'Qoralar'
			if (lobbyOverlay) lobbyOverlay.style.display = 'none'
			showToast(`Raqib (${oppTeamName}) qo'shildi! Donalaringizni joylashtiring.`, 'success')
			updateHud()
			netEmit('host_welcome', {
				teamName: myTeamName,
				time: Time,
				duration: duration,
			})
			break
		}
		case 'host_welcome': {
			oppTeamName = data.teamName || 'Oqlar'
			if (data.time) {
				Time = data.time
				duration = data.duration
				updateMatchTimerDisplay()
			}
			if (lobbyOverlay) lobbyOverlay.style.display = 'none'
			showToast(`Xonaga ulandingiz! Raqib: ${oppTeamName} (Oqlar)`, 'success')
			updateHud()
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
			showToast("⚡ Raqib tayyor bo'ldi! Donalaringizni joylashtirib bo'lgach, siz ham Boshlash tugmasini bosing.", 'info')
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
			changeOrder()
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

// Create Room Action (Host - PeerJS)
function initHostRoom(forcedCode = null) {
	myTeamName = (teamNameInput ? teamNameInput.value.trim() : '') || 'Barsa'
	isHost = true
	myRole = 'white'

	const code = forcedCode || generateRoomCode()
	currentRoomCode = code

	if (createdRoomCode) createdRoomCode.textContent = currentRoomCode
	if (createRoomInfo) createRoomInfo.style.display = 'flex'

	const hostStatusMsg = document.getElementById('host-status-msg')
	const hostSpinner = document.querySelector('#host-status .waiting-spinner')
	if (hostStatusMsg) {
		hostStatusMsg.textContent = 'Serverga ulanmoqda va xona tayyorlanmoqda...'
		hostStatusMsg.style.color = '#475569'
	}
	if (hostSpinner) hostSpinner.style.display = 'inline-block'

	if (peer) {
		try {
			peer.destroy()
		} catch (e) {}
		peer = null
	}

	const PeerClass = getPeerConstructor()
	const peerId = 'cb-' + code

	try {
		peer = new PeerClass(peerId, PEER_CONFIG)

		peer.on('open', id => {
			console.log('[P2P] Xona ochildi:', id)
			if (createdRoomCode) createdRoomCode.textContent = currentRoomCode
			if (hostStatusMsg) {
				hostStatusMsg.textContent = `🟢 Xona faol (#${currentRoomCode})! Raqib (Qoralar) ulanishi kutilmoqda...`
				hostStatusMsg.style.color = '#15803d'
			}
			showToast(`Xona (#${currentRoomCode}) tayyor! Kodni do'stingizga yuboring.`, 'success')
		})

		peer.on('connection', c => {
			setupConnection(c)
		})

		peer.on('error', err => {
			console.error('[P2P] Xona xatosi:', err)
			if (err.type === 'unavailable-id') {
				// ID allaqachon mavjud bo'lsa yangi kod bilan xona ochamiz
				initHostRoom()
			} else {
				if (hostStatusMsg) {
					hostStatusMsg.textContent = "Serverga ulanishda xato. 'Yangi kod yaratish' tugmasini bosing."
					hostStatusMsg.style.color = '#dc2626'
				}
				showToast('Ulanish xatosi: ' + (err.message || err.type), 'error')
			}
		})
	} catch (e) {
		console.error('[P2P] Peer yaratishda istisno:', e)
		if (hostStatusMsg) {
			hostStatusMsg.textContent = "Kodni nusxalab do'stingizga yuboring."
		}
	}
}

if (btnCreateRoom) {
	btnCreateRoom.addEventListener('click', () => {
		initHostRoom()
	})
}

// Join Room Action (Guest - PeerJS)
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

		if (joinStatus) {
			joinStatus.textContent = 'Xonaga ulanmoqda...'
			joinStatus.style.display = 'block'
			joinStatus.style.color = '#2563eb'
		}
		btnJoinRoom.disabled = true

		if (peer) {
			try {
				peer.destroy()
			} catch (e) {}
			peer = null
		}

		const PeerClass = getPeerConstructor()
		try {
			peer = new PeerClass(PEER_CONFIG)
			peer.on('open', () => {
				const targetPeerId = 'cb-' + code
				const conn = peer.connect(targetPeerId, { reliable: true })
				setupConnection(conn)
			})

			peer.on('error', err => {
				console.error('[P2P] Ulanish xatosi:', err)
				btnJoinRoom.disabled = false
				if (joinStatus) {
					joinStatus.textContent = "Xona topilmadi yoki kod noto'g'ri!"
					joinStatus.style.color = '#dc2626'
					joinStatus.style.display = 'block'
				}
				showToast("Xona topilmadi yoki kod noto'g'ri!", 'error')
			})
		} catch (e) {
			console.error('[P2P] Join xatosi:', e)
			btnJoinRoom.disabled = false
			if (joinStatus) {
				joinStatus.textContent = 'Ulanishda xatolik yuz berdi!'
				joinStatus.style.color = '#dc2626'
				joinStatus.style.display = 'block'
			}
			showToast("Ulanishda xato yuz berdi", 'error')
		}
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
		showToast("🎮 Lokal rejim tanlandi. Bitta qurilmada 2 kishi navbatma-navbat o'ynashingiz mumkin!", 'info')
		updateHud()
	})
}

if (btnOpenRules) {
	btnOpenRules.addEventListener('click', () => {
		document.querySelector('.container').style.filter = 'blur(4px)'
		document.querySelector('.main-container').style.display = 'flex'
		const yesBtn = document.querySelector('.Yes')
		const noBtn = document.querySelector('.No')
		if (yesBtn) {
			yesBtn.onclick = () => {
				document.querySelector('.container').style.filter = 'blur(0px)'
				document.querySelector('.main-container').style.display = 'none'
			}
		}
		if (noBtn) {
			noBtn.onclick = () => {
				window.open('https://chessball.my.canva.site/', '_blank')
				document.querySelector('.container').style.filter = 'blur(0px)'
				document.querySelector('.main-container').style.display = 'none'
			}
		}
	})
}

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
