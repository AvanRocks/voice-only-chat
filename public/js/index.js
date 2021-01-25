if (!isSupported()) {
	alert('Your browser does not support getUserMedia')
} else {

	var socket = io()
	initSocket(socket)

	initRecording()
	initAddFriend()
}

function initAddFriend() {
	const friendBtn = document.getElementById('friendBtn')
	const friendInput = document.getElementById('friendInput')
	const errorDiv = document.getElementById('errorDiv')

	friendBtn.onclick = (e) => {
		e.preventDefault()

		let friendName = friendInput.value
		if (!friendName) {
			return
		}

		let data = new FormData();
		data.append("friendName", friendName)

		var xhttp= new XMLHttpRequest();
		xhttp.open("POST", "/addFriend");
		xhttp.onreadystatechange = () => { 
			if(xhttp.readyState === XMLHttpRequest.DONE) {
				if (xhttp.status === 400) {
					errorDiv.textContent = xhttp.response
				} else {
					errorDiv.textContent = ''
				}
			}
		}
		xhttp.send(data);
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
	socket.emit('voice message', audioChunks)
}

function handleAudio(audioChunks) {
	sendAudio(audioChunks)
	showMessage(audioChunks)
}

function showMessage(audioChunks) {
	const audioBlob = new Blob(audioChunks);
	const recordingList = document.getElementById('recordings')
	const audioUrl = URL.createObjectURL(audioBlob);

	let li = document.createElement('li')
	let audio = document.createElement('audio')
	audio.setAttribute('controls', '')
	audio.src = audioUrl

	li.appendChild(audio)
	recordingList.appendChild(li)
}

function initSocket(socket) {
	socket.on('voice message', (audioBlob) => {
		showMessage(audioBlob)
	})
}

function isSupported() {
	if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
		return true;
	} else {
		return false;
	}
}
