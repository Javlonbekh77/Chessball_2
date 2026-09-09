// ===================================================
// CHESSBALL - ULTIMATE MULTIPLAYER & PENALTY ENGINE
// ===================================================

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

// MULTIPLAYER STATE
let isMultiplayer = true
let socket = null
let myRole = 'white' // 'white' | 'black'
let myTeamName = 'Oqlar'
let oppTeamName = 'Qoralar'
let currentRoomCode = null
let myIsReady = false
let oppIsReady = false

// PENALTY STATE (Best of 3 + Sudden Death)
let penaltyRound = 1
let penaltySubRound = 0 // 0 = White shoots, Black saves; 1 = Black shoots, White saves
let penaltyScores = { white: 0, black: 0 }
let penaltyHistory = { white: [], black: [] }
let penaltyTimerInterval = null
let penaltySeconds = 10
let myPenaltyChoice = null
let oppLockedChoice = false
let penaltyInProgress = false

// Initialize Socket.io connection safely
try {
	if (typeof io !== 'undefined') {
		socket = io()
	}
} catch (e) {
	console.warn('[Multiplayer] Socket.io yuklanmadi, lokal rejimda ishlaydi.', e)
	isMultiplayer = false
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
	if (!fromRemote && isMultiplayer && socket && currentRoomCode && isMyTurn) {
		socket.emit('turn_timeout', { roomId: currentRoomCode })
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
			if (isMultiplayer && socket && currentRoomCode) {
				socket.emit('timer_change', {
					roomId: currentRoomCode,
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
			if (isMultiplayer && socket && currentRoomCode) {
				socket.emit('timer_change', {
					roomId: currentRoomCode,
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

			if (socket && currentRoomCode) {
				socket.emit('player_ready', { roomId: currentRoomCode })
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
		if (2 < x - 1 && matrix[y][x - 1].innerHTML == '') {
			matrix[y][x - 1].innerHTML = "<div class='dot-action'></div>"
		}
		if (x + 1 < 6 && matrix[y][x + 1].innerHTML == '') {
			matrix[y][x + 1].innerHTML = "<div class='dot-action'></div>"
		}
	}
	if (name == 'bishop') {
		selectedItems = [x, y]
		let row, column
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
				matrix[row][column].innerHTML == ''
			) {
				matrix[row][column].innerHTML = "<div class='dot-action'></div>"
				if (items[0] == 0) column--
				else column++
				if (items[1] == 0) row--
				else row++
			}
		}
	}
	if (name == 'knight') {
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

	if (emitSocket && isMultiplayer && socket && currentRoomCode) {
		if (!yurish) {
			socket.emit('prep_move', {
				roomId: currentRoomCode,
				from: [x1, y1],
				to: [x2, y2],
			})
		} else {
			socket.emit('game_move', {
				roomId: currentRoomCode,
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
					item.childNodes[0].classList.contains('piece') &&
					Dots == false
				) {
					if (isMultiplayer) {
						const isWhite = item.childNodes[0].classList.contains('white-pieces')
						const isBlack = item.childNodes[0].classList.contains('black-pieces')
						if (myRole === 'white' && (!isWhite || Order !== false)) return
						if (myRole === 'black' && (!isBlack || Order !== true)) return
					} else {
						const isWhite = item.childNodes[0].classList.contains('white-pieces')
						const isBlack = item.childNodes[0].classList.contains('black-pieces')
						if (Order === false && !isWhite) return
						if (Order === true && !isBlack) return
					}

					let name
					if (item.childNodes[0].classList.contains('rook')) name = 'rook'
					else if (item.childNodes[0].classList.contains('bishop')) name = 'bishop'
					else name = 'knight'

					showDots(Math.floor(index / 9) + 1, index % 9, name)
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

	if (emit && isMultiplayer && socket && currentRoomCode) {
		socket.emit('goal_scored', {
			roomId: currentRoomCode,
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
				showFinalWinnerModal(false)
			}
		}

		timeLeft--
	}, 1000)
}

// ---------------------------------------------------
// PENALTY SHOOTOUT ENGINE (Best of 3 + Sudden Death)
// ---------------------------------------------------
const penaltyModal = document.getElementById('penalty-arena-modal')
const penaltyRoundDisplay = document.getElementById('penalty-round-num')
const penaltyScoreWhiteDisplay = document.getElementById('penalty-score-white')
const penaltyScoreBlackDisplay = document.getElementById('penalty-score-black')
const penaltyTimerCount = document.getElementById('penalty-timer-count')
const penaltyTimerPill = document.getElementById('penalty-timer-pill')
const penaltyTurnIndicator = document.getElementById('penalty-turn-indicator')
const penaltyActionStatus = document.getElementById('penalty-action-status')
const penaltyKeeperAnim = document.getElementById('penalty-keeper-anim')
const penaltyBallAnim = document.getElementById('penalty-ball-anim')

function startPenaltyShootout() {
	isPenalty = true
	penaltyInProgress = true
	penaltyRound = 1
	penaltySubRound = 0
	penaltyScores = { white: 0, black: 0 }
	penaltyHistory = { white: [], black: [] }

	if (penaltyModal) penaltyModal.style.display = 'flex'

	// Update team names in penalty header
	const pwName = document.getElementById('penalty-white-name')
	const pbName = document.getElementById('penalty-black-name')
	if (pwName) pwName.textContent = myRole === 'white' ? myTeamName : oppTeamName
	if (pbName) pbName.textContent = myRole === 'black' ? myTeamName : oppTeamName

	setupPenaltyRoundUI()
}

function setupPenaltyRoundUI() {
	myPenaltyChoice = null
	oppLockedChoice = false

	// Round va subround hisobi
	// penaltySubRound: 0 = Oqlar tepadi, Qoralar darvozabon; 1 = Qoralar tepadi, Oqlar darvozabon
	const currentTurnTeam = penaltySubRound % 2 === 0 ? 'Oqlar' : 'Qoralar'
	const isWhiteShooting = penaltySubRound % 2 === 0
	const currentRoundNum = Math.floor(penaltySubRound / 2) + 1

	if (penaltyRoundDisplay) {
		penaltyRoundDisplay.textContent = currentRoundNum <= 3 ? `${currentRoundNum}/3` : `Oltin ${currentRoundNum}`
	}

	// Update scores
	if (penaltyScoreWhiteDisplay) penaltyScoreWhiteDisplay.textContent = penaltyScores.white
	if (penaltyScoreBlackDisplay) penaltyScoreBlackDisplay.textContent = penaltyScores.black

	// Reset ball and goalkeeper animation positions
	if (penaltyKeeperAnim) {
		penaltyKeeperAnim.className = 'penalty-keeper-piece'
		penaltyKeeperAnim.src = isWhiteShooting
			? '/images/pieces/black/rook.png' // Qoralar darvozabon
			: '/images/pieces/white/rook.png' // Oqlar darvozabon
	}
	if (penaltyBallAnim) {
		penaltyBallAnim.className = 'penalty-ball-piece'
	}

	// Remove selected border from zones
	for (let i = 1; i <= 3; i++) {
		const zone = document.getElementById(`goal-zone-${i}`)
		if (zone) zone.classList.remove('selected')
	}

	// Aniq rol: Men tepuvchimanmi yoki darvozabonmanmi?
	let amIShooter = true
	if (isMultiplayer) {
		if (myRole === 'white') {
			amIShooter = isWhiteShooting
		} else {
			amIShooter = !isWhiteShooting
		}
	} else {
		// Lokal: har doim foydalanuvchi tepuvchi, darvozabon robot
		amIShooter = true
	}

	if (penaltyTurnIndicator) {
		if (amIShooter) {
			penaltyTurnIndicator.textContent = `Siz to'p tepuvchisiz! (${currentTurnTeam})`
			penaltyTurnIndicator.style.color = '#15803d'
		} else {
			penaltyTurnIndicator.textContent = 'Siz darvozabonsiz! Darvozani himoya qiling 🧤'
			penaltyTurnIndicator.style.color = '#b45309'
		}
	}

	if (penaltyActionStatus) {
		penaltyActionStatus.textContent = amIShooter
			? "Darvozaning 3 ta burchagidan birini (Chap, Markaz, O'ng) tanlang!"
			: "Darvozaning qaysi burchagiga sakrashni tanlang (Chap, Markaz, O'ng)!"
	}

	// 10 soniyalik Penalti taymerini boshlash
	startPenaltyTimer(amIShooter)
}

function startPenaltyTimer(amIShooter) {
	if (penaltyTimerInterval) clearInterval(penaltyTimerInterval)
	penaltySeconds = 10
	updatePenaltyTimerDisplay()

	penaltyTimerInterval = setInterval(() => {
		penaltySeconds--
		if (penaltySeconds < 0) penaltySeconds = 0
		updatePenaltyTimerDisplay()

		if (penaltySeconds <= 0) {
			clearInterval(penaltyTimerInterval)
			// Agar foydalanuvchi hali tanlamagan bo'lsa -> Markaz (2) avtomatik tanlanadi
			if (myPenaltyChoice === null) {
				makePenaltyChoice(2, amIShooter)
			}
		}
	}, 1000)
}

function updatePenaltyTimerDisplay() {
	if (penaltyTimerCount) penaltyTimerCount.textContent = `${penaltySeconds}s`
	if (penaltyTimerPill) {
		if (penaltySeconds <= 3) {
			penaltyTimerPill.classList.add('danger')
		} else {
			penaltyTimerPill.classList.remove('danger')
		}
	}
}

function makePenaltyChoice(zoneNum, amIShooter) {
	if (myPenaltyChoice !== null) return
	myPenaltyChoice = zoneNum

	// Highlight selected zone
	const zoneElem = document.getElementById(`goal-zone-${zoneNum}`)
	if (zoneElem) zoneElem.classList.add('selected')

	if (penaltyActionStatus) {
		penaltyActionStatus.textContent = `Siz tanladingiz: ${zoneNum == 1 ? 'Chap' : zoneNum == 2 ? 'Markaz' : "O'ng"}. Raqib kutilmoqda... 🔒`
	}

	if (isMultiplayer && socket && currentRoomCode) {
		socket.emit('penalty_submit_choice', {
			roomId: currentRoomCode,
			choiceType: amIShooter ? 'shooter' : 'keeper',
			choice: zoneNum,
		})
	} else {
		// Lokal rejim: darvozabon robot random tanlaydi (1, 2, 3)
		const robotChoice = Math.floor(Math.random() * 3) + 1
		const isGoal = zoneNum !== robotChoice

		setTimeout(() => {
			resolvePenaltyRound(zoneNum, robotChoice, isGoal)
		}, 800)
	}
}

function resolvePenaltyRound(shooterChoice, keeperChoice, isGoal) {
	if (penaltyTimerInterval) clearInterval(penaltyTimerInterval)

	// Animate goalkeeper dive
	if (penaltyKeeperAnim) {
		penaltyKeeperAnim.classList.add(`dive-${keeperChoice}`)
	}

	// Animate ball shoot
	if (penaltyBallAnim) {
		penaltyBallAnim.classList.add(`shoot-${shooterChoice}`)
	}

	const isWhiteShooting = penaltySubRound % 2 === 0
	const shootingTeam = isWhiteShooting ? 'Oqlar' : 'Qoralar'

	setTimeout(() => {
		if (isGoal) {
			showToast(`⚽ GOOOL! ${shootingTeam} darvozani aniq nishonga oldi!`, 'success')
			if (isWhiteShooting) penaltyScores.white++
			else penaltyScores.black++
			if (isWhiteShooting) penaltyHistory.white.push(true)
			else penaltyHistory.black.push(true)
			if (penaltyBallAnim) penaltyBallAnim.classList.add('ball-goal-white')
		} else {
			showToast(`🧤 SEYV! Darvozabon to'pni mahorat bilan qaytardi!`, 'warning')
			if (isWhiteShooting) penaltyHistory.white.push(false)
			else penaltyHistory.black.push(false)
		}

		// Update dots UI
		updatePenaltyDotsUI()

		if (penaltyScoreWhiteDisplay) penaltyScoreWhiteDisplay.textContent = penaltyScores.white
		if (penaltyScoreBlackDisplay) penaltyScoreBlackDisplay.textContent = penaltyScores.black

		// 2 soniyadan keyin g'alaba shartini tekshirish yoki keyingi zarbaga o'tish
		setTimeout(() => {
			checkPenaltyWinnerOrNext()
		}, 2200)
	}, 600)
}

function updatePenaltyDotsUI() {
	// White dots
	penaltyHistory.white.forEach((result, idx) => {
		const dot = document.getElementById(`pw-${idx + 1}`)
		if (dot) dot.textContent = result ? '🟢' : '🔴'
	})
	// Black dots
	penaltyHistory.black.forEach((result, idx) => {
		const dot = document.getElementById(`pb-${idx + 1}`)
		if (dot) dot.textContent = result ? '🟢' : '🔴'
	})
}

function checkPenaltyWinnerOrNext() {
	penaltySubRound++
	const totalShotsTaken = penaltySubRound
	const currentRoundNum = Math.floor(totalShotsTaken / 2)

	// Futbol qoidalari bo'yicha:
	// Har ikkala jamoa teng miqdorda tepgan holatlar (har tur oxiri):
	if (totalShotsTaken % 2 === 0) {
		// Dastlabki 3 ta tur tugagach (3 tadan tepildi):
		if (currentRoundNum >= 3) {
			if (penaltyScores.white !== penaltyScores.black) {
				// G'olib aniq!
				finishPenaltyShootout()
				return
			} else {
				// 3 tadan keyin ham durrang bo'lsa -> Sudden Death (Oltin penalti)!
				showToast('⚡ Oltin Penalti! Kimdir xato qilguncha davom etadi!', 'info')
			}
		}
	} else {
		// Agar 3-tur ichida matematik jihatdan yetib bo'lmaydigan bo'lsa:
		// Masalan: 1-jamoa 3 tadan 2 ta urgan, 2-jamoa 2 tadan 0 ta urgan bo'lsa
		const whiteShots = penaltyHistory.white.length
		const blackShots = penaltyHistory.black.length
		const whiteRemaining = Math.max(0, 3 - whiteShots)
		const blackRemaining = Math.max(0, 3 - blackShots)

		if (currentRoundNum < 3) {
			if (penaltyScores.white > penaltyScores.black + blackRemaining) {
				finishPenaltyShootout()
				return
			}
			if (penaltyScores.black > penaltyScores.white + whiteRemaining) {
				finishPenaltyShootout()
				return
			}
		}
	}

	// Keyingi zarbaga o'tish
	setupPenaltyRoundUI()
}

function finishPenaltyShootout() {
	if (penaltyModal) penaltyModal.style.display = 'none'
	showFinalWinnerModal(true)
}

function showFinalWinnerModal(isFromPenalty = false) {
	const modal = document.getElementById('disconnect-modal')
	const titleElem = document.getElementById('victory-title')
	const msgElem = document.getElementById('disconnect-message')
	const leftScoreElem = document.getElementById('winner-score-left')
	const rightScoreElem = document.getElementById('winner-score-right')
	const penaltyStatsElem = document.getElementById('penalty-final-stats')
	const penaltyStatDisplay = document.getElementById('penalty-stat-display')

	if (!modal) return

	let winnerName = ''
	if (isFromPenalty) {
		winnerName = penaltyScores.white > penaltyScores.black ? 'Oqlar' : 'Qoralar'
		if (titleElem) titleElem.textContent = `🏆 ${winnerName} G'alaba Qozondi!`
		if (msgElem) msgElem.textContent = `Penaltilar seriyasida ${winnerName} jamoasi zafar quchdi!`
		if (leftScoreElem) leftScoreElem.textContent = whiteScore
		if (rightScoreElem) rightScoreElem.textContent = blackScore

		if (penaltyStatsElem && penaltyStatDisplay) {
			penaltyStatsElem.style.display = 'block'
			penaltyStatDisplay.textContent = `${penaltyScores.white} : ${penaltyScores.black}`
		}
	} else {
		winnerName = whiteScore > blackScore ? 'Oqlar' : 'Qoralar'
		if (titleElem) titleElem.textContent = `🏆 ${winnerName} G'alaba Qozondi!`
		if (msgElem) msgElem.textContent = `Asosiy o'yin natijasiga ko'ra ${winnerName} jamoasi g'olib bo'ldi!`
		if (leftScoreElem) leftScoreElem.textContent = whiteScore
		if (rightScoreElem) rightScoreElem.textContent = blackScore
		if (penaltyStatsElem) penaltyStatsElem.style.display = 'none'
	}

	modal.style.display = 'flex'
}

// Attach penalty zone clicks
for (let i = 1; i <= 3; i++) {
	const zone = document.getElementById(`goal-zone-${i}`)
	if (zone) {
		zone.addEventListener('click', () => {
			if (!isPenalty || myPenaltyChoice !== null) return
			const isWhiteShooting = penaltySubRound % 2 === 0
			let amIShooter = true
			if (isMultiplayer) {
				amIShooter = myRole === 'white' ? isWhiteShooting : !isWhiteShooting
			}
			makePenaltyChoice(i, amIShooter)
		})
	}
}

if (penaltyBallAnim) {
	penaltyBallAnim.addEventListener('click', () => {
		if (!isPenalty || myPenaltyChoice !== null) return
		showToast("Darvozaning 3 ta burchagidan birini bosing (Chap, Markaz, O'ng)!", 'info')
	})
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

// Create Room Action
if (btnCreateRoom) {
	btnCreateRoom.addEventListener('click', () => {
		if (!socket) {
			showToast('Server bilan aloqa mavjud emas!', 'error')
			return
		}
		myTeamName = teamNameInput.value.trim() || 'Oqlar'
		socket.emit('create_room', { teamName: myTeamName })
		btnCreateRoom.style.display = 'none'
		if (createRoomInfo) createRoomInfo.style.display = 'flex'
	})
}

// Join Room Action
if (btnJoinRoom) {
	btnJoinRoom.addEventListener('click', () => {
		if (!socket) {
			showToast('Server bilan aloqa mavjud emas!', 'error')
			return
		}
		const code = joinCodeInput.value.trim()
		if (!code) {
			if (joinStatus) {
				joinStatus.textContent = 'Iltimos, xona kodini kiriting!'
				joinStatus.style.display = 'block'
			}
			return
		}
		myTeamName = teamNameInput.value.trim() || 'Qoralar'
		socket.emit('join_room', { roomId: code, teamName: myTeamName })
		if (joinStatus) {
			joinStatus.textContent = 'Xonaga ulanmoqda...'
			joinStatus.style.display = 'block'
		}
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
		if (isMultiplayer && socket && currentRoomCode) {
			socket.emit('rematch_request', { roomId: currentRoomCode })
		}
		location.reload()
	}
}

// ---------------------------------------------------
// SOCKET.IO EVENT LISTENERS
// ---------------------------------------------------
if (socket) {
	socket.on('connect', () => {
		console.log('[Socket] Ulangan ID:', socket.id)
	})

	// Room created (Host = White)
	socket.on('room_created', data => {
		currentRoomCode = data.roomId
		myRole = 'white'
		myTeamName = data.teamName || 'Oqlar'
		if (createdRoomCode) createdRoomCode.textContent = currentRoomCode
		showToast(`Xona yaratildi (#${currentRoomCode})! Kodni do'stingizga yuboring.`, 'success')
	})

	// Opponent joined
	socket.on('opponent_joined', data => {
		oppTeamName = data.opponent?.teamName || 'Qoralar'
		if (lobbyOverlay) lobbyOverlay.style.display = 'none'
		showToast(`Raqib (${oppTeamName}) qo'shildi! Donalaringizni joylashtiring.`, 'success')
		updateHud()
	})

	// Joined room (Guest = Black)
	socket.on('room_joined', data => {
		currentRoomCode = data.roomId
		myRole = 'black'
		myTeamName = data.teamName || 'Qoralar'
		oppTeamName = data.opponent?.teamName || 'Oqlar'
		if (data.time) {
			Time = data.time
			duration = data.duration
			updateMatchTimerDisplay()
		}
		if (lobbyOverlay) lobbyOverlay.style.display = 'none'
		showToast(`Xonaga ulandingiz! Raqib: ${oppTeamName} (Oqlar)`, 'success')
		updateHud()
	})

	// Room ready
	socket.on('room_ready', data => {
		currentRoomCode = data.roomId
		if (data.players && data.players.length === 2) {
			const whitePlayer = data.players.find(p => p.role === 'white')
			const blackPlayer = data.players.find(p => p.role === 'black')
			if (myRole === 'white') {
				oppTeamName = blackPlayer?.teamName || 'Qoralar'
			} else {
				oppTeamName = whitePlayer?.teamName || 'Oqlar'
			}
		}
		if (data.time) {
			Time = data.time
			duration = data.duration
			updateMatchTimerDisplay()
		}
		if (lobbyOverlay) lobbyOverlay.style.display = 'none'
		updateHud()
	})

	// Error handling
	socket.on('room_error', data => {
		if (joinStatus) {
			joinStatus.textContent = data.message
			joinStatus.style.display = 'block'
		}
		showToast(data.message, 'error')
	})

	// Preparation move sync (before Start)
	socket.on('prep_move', data => {
		const [x1, y1] = data.from
		const [x2, y2] = data.to
		if (matrix[y1] && matrix[y1][x1] && matrix[y2] && matrix[y2][x2]) {
			matrix[y2][x2].innerHTML = matrix[y1][x1].innerHTML
			matrix[y1][x1].innerHTML = ''
		}
		clearAllDots()
	})

	// Timer change sync (both players see identical time update)
	socket.on('timer_change', data => {
		Time = data.time
		duration = data.duration
		updateMatchTimerDisplay()
	})

	// Ready status notification from opponent
	socket.on('ready_status', data => {
		if (data.readyPlayerId !== socket.id) {
			oppIsReady = true
			showToast("⚡ Raqib tayyor bo'ldi! Donalaringizni joylashtirib bo'lgach, siz ham Boshlash tugmasini bosing.", 'info')
		}
	})

	// Game started sync (when both players are ready 2/2)
	socket.on('game_started', () => {
		if (!yurish) {
			triggerStartGame()
		}
	})

	// In-game move sync
	socket.on('game_move', data => {
		const [x1, y1] = data.from
		const [x2, y2] = data.to
		if (matrix[y1] && matrix[y1][x1] && matrix[y2] && matrix[y2][x2]) {
			matrix[y2][x2].innerHTML = matrix[y1][x1].innerHTML
			matrix[y1][x1].innerHTML = ''
		}
		clearAllDots()
		changeOrder()
	})

	// Turn timeout sync
	socket.on('turn_timeout', () => {
		handleTurnTimeout(true)
	})

	// Goal scored sync
	socket.on('goal_scored', data => {
		executeGoal(data.from, data.to, false)
	})

	// Penalty shootout events
	socket.on('penalty_mode_started', () => {
		if (!isPenalty) {
			startPenaltyShootout()
		}
	})

	socket.on('penalty_opponent_locked', () => {
		oppLockedChoice = true
		showToast('Raqib o\'z tanlovini qildi va qulfladi 🔒', 'info')
	})

	socket.on('penalty_round_result', data => {
		resolvePenaltyRound(data.shooterChoice, data.keeperChoice, data.isGoal)
	})

	// Rematch sync
	socket.on('rematch_started', () => {
		location.reload()
	})

	// Opponent disconnected -> Award 3:0 victory
	socket.on('opponent_disconnected', () => {
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
		showToast('🏆 Raqib chiqib ketdi, sizga 3 : 0 g\'alaba berildi!', 'success')
	})
}

// ---------------------------------------------------
// BOOTSTRAP INITIALIZATION
// ---------------------------------------------------
startMatrix()
oldRules()
updateHud()
