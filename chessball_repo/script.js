const matrix = [[], [], [], [], [], [], [], [], [], [], []],
	matrixContent = document.querySelector('.main-matrix'),
	squadsBoard = matrixContent.querySelectorAll('.squad'),
	squads = document.querySelectorAll('.squad'),
	ball = document.querySelector('.ball'),
	blackPieces = document.querySelectorAll('.black-pieces'),
	whitePieces = document.querySelectorAll('.white-pieces'),
	Pieces = {
		black: {
			bishop: [
				[0, 0],
				[0, 0],
				[0, 0],
			],
			knight: [],
		},
		white: {
			bishop: [
				[0, 0],
				[0, 0],
				[0, 0],
			],
			knight: [],
		},
	}
let yurish = false
let duration = 600
let Time = 10
let Dots = false,
	Order = Math.random() < 0.5

const plus = document.querySelectorAll('.pluss')[1],
	minus = document.querySelectorAll('.pluss')[0]

plus.addEventListener('click', () => {
	if (!yurish) {
		Time++
		document.querySelector('.time').innerHTML = `${Time}:00`
		duration += 60
	}
})

minus.addEventListener('click', () => {
	if (!yurish && Time > 1) {
		Time--

		if (Time < 10) document.querySelector('.time').innerHTML = `0${Time}:00`
		else document.querySelector('.time').innerHTML = `${Time}:00`
		duration -= 60
	}
})

function Learn() {
	document.querySelector('.container').style.filter = 'blur(4px)'
	document.querySelector('.main-container').style.display = 'flex'
	document.querySelector('.Yes').addEventListener('click', () => {
		document.querySelector('.container').style.filter = 'blur(0px)'
		document.querySelector('.main-container').style.display = 'none'
	})
	document.querySelector('.No').addEventListener('click', () => {
		window.location.href = 'https://chessball.my.canva.site/'
	})
}

setTimeout(Learn, 3000)

// Matrix building
squadsBoard.forEach((item, index) => {
	if (index % 2 == 0) item.classList.add('white')
})

changeOrder()
changeOrder()

squadsBoard.forEach((item, idx) => {
	let j = Math.floor(idx / 9) + 1
	matrix[j].push(item)
})

function startMatrix() {
	for (let i = 0; i < 9; i++) {
		if (2 < i && i < 6) {
			matrix[0].push(squads[i - 2])
		} else matrix[0].push(0)
	}
	for (let i = 0; i < 9; i++) {
		if (2 < i && i < 6) {
			matrix[10].push(squads[87 - 5 + i])
		} else matrix[10].push(0)
	}
	matrix[1][4].innerHTML =
		'<img class="black-pieces black-rook black rook" src="./images/pieces/black/rook.png" alt="">'
	matrix[9][4].innerHTML =
		'<img class="white-pieces whitee rook" src="./images/pieces/white/rook.png" alt="">'

	matrix[6][1].innerHTML =
		'<img class="white-pieces piece whitee bishop" src="./images/pieces/white/bishop.png" alt="">'

	matrix[6][0].innerHTML =
		'<img class="white-pieces piece whitee bishop" src="./images/pieces/white/bishop.png" alt="">'
	matrix[6][2].innerHTML =
		'<img class="white-pieces piece bishop whitee" src="./images/pieces/white/bishop.png" alt="">'

	matrix[5][3].innerHTML =
		'<img class="white-pieces piece whitee" src="./images/pieces/white/knight.png" alt="">'

	matrix[5][5].innerHTML =
		'<img class="black-pieces piece black" src="./images/pieces/black/knight.png" alt="">'

	matrix[4][0].innerHTML =
		'<img class="black-pieces piece black bishop" src="./images/pieces/black/bishop.png" alt="">'
	matrix[4][1].innerHTML =
		'<img class="black-pieces piece black bishop" src="./images/pieces/black/bishop.png" alt="">'

	matrix[4][2].innerHTML =
		'<img class="black-pieces piece black bishop" src="./images/pieces/black/bishop.png" alt="">'
	matrix[5][4].innerHTML = '<img src="./images/ball.jpg" alt="" class="ball">'
	//
}

function Piece1(x, y) {
	selectedItems = [x, y]
	Dots = true
	// console.log(x, y)
	if (y < 5) {
		for (let i = 1; i < 6; i++) {
			matrix[i].forEach((item, index) => {
				if (item.innerHTML == '') {
					if ((i == 2 || i == 1) && index > 2 && index < 6) console.log('adf')
					else item.innerHTML = "<div class='dot-action'></div>"
				}
			})
		}
	} else if (y > 5) {
		for (let i = 5; i < 10; i++) {
			matrix[i].forEach((item, index) => {
				if (item.innerHTML == '') {
					if ((i == 9 || i == 8) && index > 2 && index < 6) console.log('adf')
					else item.innerHTML = "<div class='dot-action'></div>"
				}
			})
		}
	} else if (y == 5) {
		if (matrix[y][x].childNodes[0].classList.contains('white-pieces')) {
			for (let i = 5; i < 10; i++) {
				matrix[i].forEach((item, index) => {
					if (item.innerHTML == '') {
						if ((i == 9 || i == 8) && index > 2 && index < 6) console.log('adf')
						else item.innerHTML = "<div class='dot-action'></div>"
					}
				})
			}
		} else {
			for (let i = 1; i < 6; i++) {
				matrix[i].forEach((item, index) => {
					if (item.innerHTML == '') {
						if ((i == 2 || i == 1) && index > 2 && index < 6) console.log('adf')
						else item.innerHTML = "<div class='dot-action'></div>"
					}
				})
			}
		}
	}
}

function buildMatrix() {
	matrix[1][4].innerHTML =
		'<img class=" black-rook black rook" src="./images/pieces/black/rook.png" alt="">'
	matrix[9][4].innerHTML =
		'<img class=" whitee rook" src="./images/pieces/white/rook.png" alt="">'

	Pieces.black.bishop.forEach(item => {
		let y = item[0]
		let x = item[1]
		matrix[y][x].innerHTML =
			'<img class="black-pieces piece black bishop" src="./images/pieces/black/bishop.png" alt="">'
	})
	Pieces.white.bishop.forEach(item => {
		let y = item[0]
		let x = item[1]
		matrix[y][x].innerHTML =
			'<img class="white-pieces piece whitee bishop" src="./images/pieces/white/bishop.png" alt="">'
	})
	let bkx, bky
	bkx = Pieces.black.knight[1]
	bky = Pieces.black.knight[0]
	let wkx, wky
	wkx = Pieces.white.knight[1]
	wky = Pieces.white.knight[0]
	matrix[bky][bkx].innerHTML =
		'<img class="black-pieces piece black" src="./images/pieces/black/knight.png" alt="">'

	matrix[wky][wkx].innerHTML =
		'<img class="white-pieces piece whitee" src="./images/pieces/white/knight.png" alt="">'
	matrix[5][4].innerHTML = '<img src="./images/ball.jpg" alt="" class="ball">'
}
let oldClickHandlers = []

function oldRules() {
	squadsBoard.forEach((item, index) => {
		const handler = () => {
			if (item.childNodes[0]) {
				if (item.childNodes[0].classList.contains('dot-action')) {
					moveItems = [index % 9, Math.floor(index / 9) + 1]
					Replace()
				} else if (
					item.childNodes[0].classList.contains('piece') &&
					Dots == false
				) {
					Piece1(index % 9, Math.floor(index / 9) + 1)
				} else {
					clearAllDots()
				}
			} else {
				clearAllDots()
			}
		}

		item.addEventListener('click', handler)
		oldClickHandlers.push({ element: item, handler }) // Saqlab qo‘yamiz
	})
}

function removeOldRules() {
	oldClickHandlers.forEach(({ element, handler }) => {
		element.removeEventListener('click', handler)
	})
	oldClickHandlers = [] // Tozalaymiz
}

function Rules() {
	squadsBoard.forEach((item, index) => {
		item.addEventListener('click', () => {
			if (item.childNodes[0]) {
				if (item.childNodes[0].classList.contains('rook') && Dots == false) {
					Rook(item.childNodes[0], index % 9, Math.floor(index / 9) + 1)
				} else if (item.childNodes[0].classList.contains('dot-action')) {
					moveItems = [index % 9, Math.floor(index / 9) + 1]
					Replace()
				} else if (
					item.childNodes[0].classList.contains('ball') &&
					Dots == false
				) {
					if (checkAround(index % 9, Math.floor(index / 9) + 1))
						Ball(index % 9, Math.floor(index / 9) + 1)
				} else if (
					item.childNodes[0].classList.contains('piece') &&
					Dots == false
				) {
					if (
						(item.childNodes[0].classList.contains('black') && Order) ||
						(item.childNodes[0].classList.contains('whitee') && Order == false)
					)
						Piece(index % 9, Math.floor(index / 9) + 1)
				} else {
					clearAllDots()
				}
			} else {
				clearAllDots()
			}
		})
	})
}

// Dastlab eski rulesni ishga tushuramiz
oldRules()

// Start tugmasi bosilganda eski rulesni o‘chirib, yangisini ishga tushuramiz
document.querySelector('.btn-start').addEventListener('click', () => {
	document.querySelector('.btn-start').style.display = 'none'
	document.querySelectorAll('.pluss').forEach(item => {
		item.style.display = 'none'
	})
	startTimer()
	cloneMatrix()
	yurish = true
	removeOldRules() // <-- Eski eventlarni o‘chirish
	Rules() // <-- Yangi eventlarni qo‘shish
})

function cloneMatrix() {
	let row = 0
	for (let i = 2; i <= 5; i++) {
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
	for (let i = 5; i < 9; i++) {
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

	// console.log(Pieces)
}

startMatrix()

const pieces = document.querySelectorAll('img')
const canMovePieces = document.querySelectorAll('.piece')
const rook = document.querySelectorAll('.rook')

function showDots(y, x, name) {
	Dots = true
	if (name == 'rook') {
		// console.log(x)
		if (2 < x - 1 && matrix[y][x - 1].innerHTML == '') {
			matrix[y][x - 1].innerHTML = "<div class='dot-action'></div>"
		}
		if (x + 1 < 6 && matrix[y][x + 1].innerHTML == '') {
			matrix[y][x + 1].innerHTML = "<div class='dot-action'></div>"
		}
	}
}

function clearAllDots() {
	Dots = false
	selectedItems = []
	squads.forEach(item => {
		if (
			item.childNodes[0] &&
			item.childNodes[0].classList.contains('dot-action')
		)
			item.childNodes[0].remove()
	})
}

// item.style.cssText = 'background-color:#f5f682;'

let selectedItems = []
let moveItems = []

function Rook(rook, x, y) {
	if (Dots == false) {
		if (
			(rook.classList.contains('black') && Order) ||
			(rook.classList.contains('whitee') && Order == false)
		) {
			selectedItems = [x, y]
			showDots(y, x, 'rook')
		}
	} else clearAllDots()
}

// Ball
const mass = [
	[0, 0],
	[0, 1],
	[1, 0],
	[1, 1],
	[2, 1],
	[2, 0],
	[1, 2],
	[0, 2],
]
function Ball(x, y) {
	// console.log('This is a ball')
	let option
	if (Order) option = 'black'
	else option = 'whitee'
	Dots = true
	selectedItems = [x, y]
	let column = x - 1
	let row = y + 1
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

	while (
		row <= 10 &&
		(matrix[row][x].innerHTML == '' ||
			(matrix[row][x] &&
				matrix[row][x].childNodes[0].classList.contains(`${option}`)))
	) {
		if (matrix[row][x].innerHTML == '')
			if (row == 10 && y > 5 && Order) {
				matrix[row][x].innerHTML =
					"<div style='background-color: white;' class='white-dot dot-action'></div>"
				// console.log('Goll')
			} else matrix[row][x].innerHTML = "<div class='dot-action'></div>"

		row++
	}
	row = y - 1
	while (
		row >= 0 &&
		(matrix[row][x].innerHTML == '' ||
			(matrix[row][x] &&
				matrix[row][x].childNodes[0].classList.contains(`${option}`)))
	) {
		if (matrix[row][x].innerHTML == '')
			if (row == 0 && y < 5 && !Order)
				matrix[row][x].innerHTML =
					"<div style='background-color: white;' class='white-dot dot-action'></div>"
			else matrix[row][x].innerHTML = "<div class='dot-action'></div>"
		row--
	}

	for (let i = 0; i < 4; i++) {
		items = mass[i]
		if (items[0] == 0) column = x - 1
		else column = x + 1
		if (items[1] == 0) row = y - 1
		else row = y + 1
		while (
			0 <= column &&
			column <= 9 &&
			0 < row &&
			row < 10 &&
			matrix[row][column] &&
			(matrix[row][column].innerHTML == '' ||
				matrix[row][column].childNodes[0].classList.contains(`${option}`))
		) {
			if (matrix[row][column].innerHTML == '') {
				if (column == 5 && row == 9 && 10 > y && y > 5 && Order) {
					// console.log('Goall')
					matrix[row + 1][column].innerHTML =
						"<div style='background-color: white;' class='white-dot dot-action'></div>"
				}
				if (column == 4 && row == 9 && 10 > y && y > 5 && Order) {
					// console.log('Goall')
					matrix[row + 1][column].innerHTML =
						"<div style='background-color: white;' class='white-dot dot-action'></div>"
				}
				if (column == 3 && row == 9 && 10 > y && y > 5 && Order)
					matrix[row + 1][column].innerHTML =
						"<div style='background-color: white;' class='white-dot dot-action'></div>"
				if (column == 5 && row == 1 && 5 > y && y > 0 && !Order)
					matrix[row - 1][column].innerHTML =
						"<div style='background-color: white;' class='white-dot dot-action'></div>"
				if (column == 3 && row == 1 && 5 > y && y > 0 && !Order)
					matrix[row - 1][column].innerHTML =
						"<div style='background-color: white;' class='white-dot dot-action'></div>"
				matrix[row][column].innerHTML = "<div class='dot-action'></div>"
				if (column == 4 && row == 1 && 5 > y && y > 0 && !Order)
					matrix[row - 1][column].innerHTML =
						"<div style='background-color: white;' class='white-dot dot-action'></div>"
				matrix[row][column].innerHTML = "<div class='dot-action'></div>"
			}
			if (items[0] == 0) column--
			else column++
			if (items[1] == 0) row--
			else row++
		}
		// console.log(
		// 	checkAround(column, row),
		// 	matrix[row][column].childNodes[0].classList.contains(`${option}`)
		// )
	}
}

// Piece
function Piece(x, y) {
	Dots = true
	console.log('This is a piece')
	selectedItems = [x, y]
	let row, column
	for (let i = 0; i < 8; i++) {
		items = mass[i]
		if (items[0] == 0) column = x - 1
		else if (items[0] == 2) column = x
		else column = x + 1
		if (items[1] == 0) row = y - 1
		else if (items[1] == 2) row = y
		else row = y + 1
		if (
			0 <= column &&
			column <= 9 &&
			0 <= row &&
			row <= 10 &&
			matrix[row][column] &&
			matrix[row][column].innerHTML == ''
		)
			matrix[row][column].innerHTML = "<div class='dot-action'></div>"
	}
}

function checkAround(x, y) {
	let row, column, option
	if (Order) option = 'black'
	else option = 'whitee'
	let res = []
	for (let i = 0; i < 8; i++) {
		items = mass[i]
		if (items[0] == 0) column = x - 1
		else if (items[0] == 2) column = x
		else column = x + 1
		if (items[1] == 0) row = y - 1
		else if (items[1] == 2) row = y
		else row = y + 1
		if (
			!(
				0 <= column &&
				column <= 9 &&
				0 <= row &&
				row <= 10 &&
				matrix[row][column] &&
				matrix[row][column].innerHTML == ''
			)
		)
			if (
				0 <= column &&
				column <= 9 &&
				0 <= row &&
				row <= 10 &&
				matrix[row][column] &&
				matrix[row][column].childNodes[0].classList.contains(`${option}`)
			)
				return true
	}
	return false
}

let whiteScore = 0,
	blackScore = 0

function changeOrder() {
	Order = !Order
	if (Order) {
		document.querySelector('.move-color-black').innerHTML = 'Qora'
	} else document.querySelector('.move-color-black').innerHTML = 'Oq'
}

function Replace() {
	// console.log(selectedItems, moveItems)
	let x1 = selectedItems[0],
		y1 = selectedItems[1],
		x2 = moveItems[0],
		y2 = moveItems[1]
	// console.log(x1, y1, x2, y2)
	let alfa = matrix[y1][x1].childNodes[0]
	matrix[y2][x2].innerHTML = matrix[y1][x1].innerHTML
	matrix[y1][x1].innerHTML = ''
	clearAllDots()
	if (yurish) changeOrder()
}
const scores = document.querySelectorAll('.score')
function Goalll() {
	document.querySelector('.goall').computedStyleMap.display = 'flex'
}
let isPenalty = false

window.addEventListener('click', e => {
	if (
		Dots &&
		(e.target.classList.contains('white-dot') ||
			(e.target.childNodes[0] &&
				e.target.childNodes[0].classList.contains('white-dot')))
	) {
		if (e.target.classList.contains('white-dot')) console.log()
		if (e.target.classList.contains('white-dot')) {
			e.target.parentElement.innerHTML =
				matrix[selectedItems[1]][selectedItems[0]].innerHTML
		} else {
			e.target.innerHTML = matrix[selectedItems[1]][selectedItems[0]].innerHTML
		}
		matrix[selectedItems[1]][selectedItems[0]].innerHTML = ''
		clearAllDots()
		selectedItems = []
		// console.log('fdas')
		document.querySelector('.goall').style.display = 'flex'

		const setTime = setTimeout(() => {
			if (Order) {
				scores[1].textContent = blackScore + 1
				blackScore++
			} else {
				scores[0].textContent = whiteScore + 1
				whiteScore++
			}
			if (!isPenalty) {
				clearMatrix()
				buildMatrix()
			} else console.log('nima')
			changeOrder()
		}, 2000)
	}

	console.log(e.target, 'Goall')
})

function clearMatrix() {
	document.querySelector('.goall').style.display = 'none'
	squads.forEach(item => {
		item.innerHTML = ''
	})
}

function startTimer() {
	let timerInterval
	clearInterval(timerInterval) // oldingi timer bo‘lsa to‘xtat
	let timeLeft = duration

	timerInterval = setInterval(() => {
		const minutes = Math.floor(timeLeft / 60)
		const seconds = timeLeft % 60
		if (timeLeft >= 0)
			document.querySelector('.time').textContent = `${minutes
				.toString()
				.padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

		if (timeLeft < -3) {
			if (blackScore == whiteScore) {
				// console.log('Draw')
				isPenalty = true
				Penalty()
			} else {
				Winning()
			}
			clearInterval(timerInterval)
		}

		timeLeft--
	}, 1000)
}

function Winning() {
	document.querySelector('body').style.padding = '0px'
	document.querySelector('.container').style.display = 'none'
	document.querySelector('.container-1').style.display = 'flex'
	document.querySelectorAll('.score1')[1].textContent = blackScore
	document.querySelectorAll('.score1')[0].textContent = whiteScore
	document.querySelector('.btn-res').addEventListener('click', () => {
		// startTimer()
		// document.querySelector('.container').style.display = 'flex'
		// document.querySelector('.container-1').style.display = 'none'
		// blackScore = 0
		// whiteScore = 0
		// scores[0].textContent = whiteScore
		// scores[1].textContent = blackScore
		// clearMatrix()
		// startMatrix()
		location.reload()
	})
}

let Gs = 0

function newRules() {
	document.querySelector('.ball').addEventListener('click', () => {
		for (let i = 3; i < 6; i++) {
			matrix[0][i].innerHTML =
				"<div style='background-color: white;' class='white-dot dot-action'></div>"
		}
	})
	changeOrder()
	let option
	// console.log(Order)

	window.addEventListener('click', e => {
		selectedItems = [4, 2]
		if (
			e.target.classList.contains('white-dot') ||
			(e.target.childNodes[0] &&
				e.target.childNodes[0].classList.contains('white-dot'))
		) {
			// console.log('Gs', Gs)
			document.querySelector('.squad').innerHTML = ''
			const rand = [1, 2, 3][Math.floor(Math.random() * 3)]

			if (e.target.classList.contains('white-dot')) {
				e.target.parentElement.innerHTML = matrix[2][4].innerHTML
			} else {
				e.target.innerHTML = matrix[2][4].innerHTML
			}
			clearAllDots()
			if (matrix[0][rand + 2].innerHTML == '') {
				if (!Order) option = ['white', 'black']
				else option = ['black', 'white']
				matrix[0][
					rand + 2
				].innerHTML = `<img class=" ${option[1]}-rook rook" src="./images/pieces/${option[1]}/rook.png" alt="">`
				matrix[2][4].innerHTML = ''
				selectedItems = []
				document.querySelector('.goall').style.display = 'flex'
				matrix[2][4].innerHTML = ''
				const setTime = setTimeout(() => {
					if (Order) {
						scores[1].textContent = blackScore + 1
						blackScore++
					} else {
						scores[0].textContent = whiteScore + 1
						whiteScore++
					}

					if (Gs > 0 && Gs % 2 == 0 && blackScore != whiteScore) Winning()
					changeOrder()
					Penalty()
				}, 3000)
			} else {
				if (Order) option = ['white', 'black']
				else option = ['black', 'white']
				matrix[0][
					rand + 2
				].innerHTML = `<img class=" ${option[0]}-rook rook" src="./images/pieces/${option[0]}/rook.png" alt="">`
				// matrix[1][rand + 2].innerHTML = matrix[2][4].innerHTML

				// matrix[2][4].innerHTML = ''
				// console.log('No Goall')
				matrix[2][4].innerHTML = ''
				setTimeout(() => {
					if (Gs > 0 && Gs % 2 == 0 && blackScore != whiteScore) Winning()
					changeOrder()
					Penalty()
				}, 3000)
			}
		}
	})
}

function Penalty() {
	Gs++
	clearMatrix()
	let option
	// console.log(Order)
	if (Order) option = ['white', 'black']
	else option = ['black', 'white']
	document.querySelector('.keeper-zone').style.display = 'flex'
	// console.log('Penalty')
	const sq1 = document.querySelector('.squad')
	let i = 0
	matrix[2][4].innerHTML = '<img src="./images/ball.jpg" alt="" class="ball">'
	sq1.innerHTML = `<img class=" ${option[0]}-rook rook" src="./images/pieces/${option[0]}/rook.png" alt="">`
	matrix[3][3].innerHTML = `<img class=" ${option[1]}-rook $ piece" src="./images/pieces/${option[1]}/knight.png" alt="">`
	selectedItems = [4, 2]
	newRules()

	// console.log(whiteScore, blackScore)
	changeOrder()
}
