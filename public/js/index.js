var selectedId = -1

if (!isSupported()) {
	alert('Your browser does not support getUserMedia')
} else {

	var socket = io()
	initSocket(socket)

	initRecording()
	initAddFriend()
	refreshFriendRequests()
	refreshFriends()
}

function sendHttpReq(method, endpoint, responseType, data, callback) {
	var xhttp = new XMLHttpRequest();
	xhttp.open(method, endpoint);
	xhttp.onreadystatechange = () => { 
		if(xhttp.readyState === XMLHttpRequest.DONE) {
			if (xhttp.status === 400) {
				callback(xhttp.response, null)
			} else {
				callback(null, xhttp.response)
			}
		}
	}
	xhttp.responseType = responseType

	if (data) 
		xhttp.send(data);
	else
		xhttp.send()
}

function refreshFriends() {
	const friendsDiv = document.getElementById('friendsDiv')
	const friendList = document.getElementById('friendList')
	const friendHeader = document.getElementById('friendHeader')

	if (friendHeader) {
		friendsDiv.removeChild(friendHeader)
	}

	while (friendList.firstChild) {
		friendList.removeChild(friendList.lastChild);
	}

	sendHttpReq("GET", "/getFriends", 'json', null, (err, res) => {
		if (err) console.log('error: '+err)
		else {
			let names = res.names
			let id = res.id
			if (names.length) {
				let newFriendHeader = document.createElement('h2')
				newFriendHeader.textContent = 'Friends'
				newFriendHeader.id = 'friendHeader'
				friendsDiv.insertBefore(newFriendHeader, friendList)
			}
			for (let i=0;i<names.length;++i) {
				if (i === 0 && selectedId === -1) {
					selectedId = id[i]
				}

				let li = document.createElement('li')
				li.id = id[i]

				li.addEventListener('click', (event) => {
					let friend
					if (event.target.tagName === 'SPAN') friend = event.target.parentNode
					else friend = event.target

					selectedId = Number(friend.id)
					let friends = friend.parentNode.childNodes
					for (let i=0;i<friends.length;++i) {
						friends[i].classList.remove('selected')
					}
					friend.classList.add('selected')
				})

				let friendName = document.createElement('span')
				friendName.textContent = names[i]

				let deleteBtn = document.createElement('button')
				deleteBtn.textContent = '✘'
				deleteBtn.id = id[i]
				deleteBtn.addEventListener('click', (event) => {
					let data = new FormData();
					data.append('friendId', event.target.id)
					sendHttpReq('DELETE', '/removeFriend', 'text', data, () => {})
				})

				li.appendChild(deleteBtn)
				li.appendChild(friendName)
				friendList.appendChild(li)
			}
		}
	})
}

function refreshFriendRequests() {
	const friendReqDiv = document.getElementById('friendReqDiv')
	const friendReqList = document.getElementById('friendReqList')
	const friendReqHeader = document.getElementById('friendReqHeader')

	if (friendReqHeader) {
		friendReqDiv.removeChild(friendReqHeader)
	}

	while (friendReqList.firstChild) {
		friendReqList.removeChild(friendReqList.lastChild);
	}

	sendHttpReq("GET", "/getFriendRequests", 'json', null, (err, res) => {
		if (err) console.log('error: '+err)
		else {
			let names = res.names
			let id = res.id

			if (names.length) {
				const friendReqDiv = document.getElementById('friendReqDiv')
				let friendReqHeader = document.createElement('h2')
				friendReqHeader.textContent = 'Friend Requests'
				friendReqHeader.id = 'friendReqHeader'
				friendReqDiv.insertBefore(friendReqHeader, friendReqList)
			}

			for (let i=0;i<names.length;++i) {
				let li = document.createElement('li')
				li.textContent = names[i]

				let acceptBtn = document.createElement('button')
				acceptBtn.textContent = '✓'
				acceptBtn.id = id[i]
				acceptBtn.addEventListener('click', acceptFriendRequest)
				let rejectBtn = document.createElement('button')
				rejectBtn.textContent = '✘'
				rejectBtn.id = id[i]
				rejectBtn.addEventListener('click', rejectFriendRequest)

				li.appendChild(acceptBtn)
				li.appendChild(rejectBtn)
				friendReqList.appendChild(li)
			}
		}
	})
}

function acceptFriendRequest(event) {
	handleFriendRequest(event, 'accept')
}

function rejectFriendRequest(event) {
	handleFriendRequest(event, 'reject')
}

function handleFriendRequest(event, action) {
	let data = new FormData();
	data.append('action', action)
	data.append('friendName', event.target.id)
	sendHttpReq('POST', '/handleFriendRequest', 'text', data, (err, res)=>{})
}

function initAddFriend() {
	const friendBtn = document.getElementById('friendBtn')
	const friendInput = document.getElementById('friendInput')
	const errorDiv = document.getElementById('errorDiv')

	friendBtn.onclick = (e) => {
		e.preventDefault()

		let friendName = friendInput.value
		friendInput.value = ''
		if (!friendName) {
			return
		}

		let data = new FormData();
		data.append("friendName", friendName)

		sendHttpReq('POST', '/addFriend', 'text', data, (err, res) => {
			if (err) {
				errorDiv.textContent = err
			} else {
				errorDiv.textContent = ''
			}
		})
	}
}

async function initRecording() {
	const recordBtn = document.getElementById('record')
	const statusDiv = document.getElementById('status')

	const statusTxt = document.createTextNode('Recording ...')

	const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
	const mediaRecorder = new MediaRecorder(stream);

	recordBtn.onclick = () => {
		if (mediaRecorder.state == 'inactive') {
			mediaRecorder.start();
			statusDiv.appendChild(statusTxt)
			recordBtn.textContent = 'Stop'
		} else if (mediaRecorder.state == 'recording') {
			mediaRecorder.stop()
			statusDiv.removeChild(statusTxt);
			recordBtn.textContent = 'Record'
		}
	}

	let audioChunks = [];
	mediaRecorder.addEventListener("dataavailable", event => {
		audioChunks.push(event.data);
	});

	mediaRecorder.addEventListener("stop", () => {
		handleAudio(audioChunks)
		audioChunks = []
	});
}

function sendAudio(audioChunks) {
	socket.emit('voice message', audioChunks, selectedId)
}

function handleAudio(audioChunks) {
	sendAudio(audioChunks)
	showMessage(audioChunks, true)
}

function showMessage(audioChunks, mine) {
	const audioBlob = new Blob(audioChunks);
	const recordingList = document.getElementById('recordings')
	const audioUrl = URL.createObjectURL(audioBlob);

	let li = document.createElement('li')
	let audio = document.createElement('audio')
	audio.setAttribute('controls', '')
	audio.src = audioUrl
	if (mine) li.classList.add('right')
	else li.classList.add('left')

	li.appendChild(audio)
	recordingList.appendChild(li)
}

function initSocket(socket) {
	let username = document.getElementById('username').textContent
	socket.emit('init', username)

	socket.on('refreshFriends', () => refreshFriends())

	socket.on('refreshFriendRequests', () => refreshFriendRequests())

	socket.on('voice message', (audioChunks) => {
		showMessage(audioChunks, false)
	})
	
	socket.on('logOut', () => {
		window.location.replace(window.location.href+'login')
		//window.location.reload()
	})
}

function isSupported() {
	if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
		return true;
	} else {
		return false;
	}
}
