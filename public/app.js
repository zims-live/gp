const menu = new mdc.menu.MDCMenu(document.querySelector('.mdc-menu'));
const configuration = {
    iceServers: [
        {
            urls: [
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
            ],
        },
    ],
    iceCandidatePoolSize: 10,
};

let roomDialog = null;
let nameId = null;
let contentId = null;
let muteState = false;
let videoState = true;
var contentState = false;
let screenState = false;
let cameraStream = null;
let captureStream = null;
let contentExists = false;
let contentShown = false;
let swipeEventFunction;
var isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;


function isHandheld() {
  let check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
  return check;
};

function videoToggleEnable() {
    document.getElementById('videoButton').addEventListener('click', () => {
        if (videoState) {
            videoState = false;
            document.getElementById('localVideo').srcObject.getVideoTracks()[0].enabled = false;
            document.querySelector('#videoButton').innerText = "videocam_off";
            document.getElementById('videoButton').classList.add('toggle');
        } else {
            videoState = true;
            document.getElementById('localVideo').srcObject.getVideoTracks()[0].enabled = true;
            document.querySelector('#videoButton').innerText = "videocam";
            document.querySelector('#videoButton').classList.remove('toggle');
        }
    });
}

function toggleOnContent(roomRef) {
    document.getElementById('localVideo').srcObject = captureStream;
    document.getElementById('screenShareButton').innerText = "stop_screen_share";
    document.getElementById('screenShareButton').classList.add('toggle');
    signalContentShare(roomRef);
    screenState = true;
    captureStream.getVideoTracks()[0].onended = () => {
        contentToggleOff(roomRef);
    }
}


function signalContentShare(roomRef) {
    contentId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    doc = roomRef.collection('partyList').doc(contentId).set({
        "name" : contentId,
        "display" : "content"
    }); 
    requestConnectionToCurrentPeers(roomRef, contentId, true);
    acceptConnectionsFromJoiningPeers(roomRef, contentId, true);
}

async function contentToggleButton(roomRef) {
    if (!screenState) {
        const displayMediaOptions = {
            video: {
                cursor: "always"
            },
            audio: false
        };
        try {
            console.log('Toggling screen share');
            captureStream = await startCapture(displayMediaOptions);
            toggleOnContent(roomRef);
        } catch(error) {
            console.log(error.message);
        } 
    } else {
        contentToggleOff(roomRef);
    }
}

function contentToggleOff(roomRef) {
    roomRef.collection('partyList').doc(contentId).delete();
    stopCapture(captureStream); 
    document.getElementById('localVideo').srcObject = cameraStream;
    screenState = false;
    document.getElementById('screenShareButton').innerText = 'screen_share';
    document.getElementById('screenShareButton').classList.remove('toggle');
}

async function startCapture(displayMediaOptions) {
    let captureStream = null;
    captureStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    return captureStream;
}

function stopCapture(stream) {
    let tracks = stream.getTracks();

    tracks.forEach(track => track.stop());
    stream = null;
}

function muteToggleEnable() {
    document.querySelector('#muteButton').addEventListener('click', () => {
        if (!muteState) {
            console.log("Muting");
            muteState = true;
            cameraStream.getAudioTracks()[0].enabled = false;
            document.querySelector('#muteButton').innerText = "mic_off";
            document.getElementById('muteButton').classList.add('toggle');
        } else {
            console.log("Unmuting");
            muteState = false;
            cameraStream.getAudioTracks()[0].enabled = true;
            document.querySelector('#muteButton').innerText = "mic";
            document.getElementById('muteButton').classList.remove('toggle');
        }
    });
}

function switchStream(peerConnection, stream) {
    document.getElementById('localVideo').srcObject = stream;
    let videoTrack = stream.getVideoTracks()[0];
    var sender = peerConnection.getSenders().find(function(s) {
        return s.track.kind == videoTrack.kind;
    });
    console.log('found sender:', sender);
    sender.replaceTrack(videoTrack);
}

function changeCamera(deviceId) {
     navigator.mediaDevices.getUserMedia({
        video: {
            deviceId: deviceId
        },
        audio: true
     }).then(stream => {
         document.getElementById('localVideo').srcObject = stream;
         cameraStream = stream
     });
}

function addStream(peerConnection, stream) {
    stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
    });
}

async function createOffer(peerConnection) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log('Created offer:', offer);
    offer.sdp = preferCodec(offer.sdp, "h264");
    return offer;
}

async function createAnswer(peerConnection) {
    const answer = await peerConnection.createAnswer();
    console.log('Created answer:', answer);
    await peerConnection.setLocalDescription(answer);
    answer.sdp = preferCodec(answer.sdp, "h264");
    return answer
}

function signalHangup(roomRef) {
    document.querySelector('#hangupBtn').addEventListener('click', async () => {
        console.log("Disconnecting");
        roomRef.collection('partyList').doc(nameId).delete();
        if (screenState) {
            roomRef.collection('partyList').doc(contentId).delete();
        }
    });
}

function signalICECandidates(peerConnection, roomRef, peerId, nameId) {
    const callerCandidatesCollection = roomRef.collection(nameId);
    peerConnection.addEventListener('icecandidate', event => {
        if (!event.candidate) {
            console.log('Got final candidate!');
            return;
        }
        console.log('Got candidate: ', event.candidate);
        callerCandidatesCollection.add(event.candidate.toJSON()).then(docRef => {
            docRef.update({
                name: peerId
            })
        });
    });
}

async function receiveICECandidates(peerConnection, roomRef, remoteEndpointID, nameId) {
    roomRef.collection(remoteEndpointID).where("name", "==", nameId).onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added'&& change.doc.id != "SDP") {
                console.log(change);
                let data = change.doc.data();
                console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
                await peerConnection.addIceCandidate(new RTCIceCandidate(data));
            }
        });
    });
}

async function addUserToRoom(roomRef) {
    let Id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    roomRef.collection('partyList').doc(Id).set({
        'name': Id,
        'display' : 'user'
    });
    return Id;
}

async function receiveAnswer(peerConnection, roomRef, peerId, nameId) {
    roomRef.collection(nameId).doc('SDP').collection('answer').doc(peerId).onSnapshot(async snapshot => {
        if (snapshot.exists) {
            const data = snapshot.data();
            console.log('Got remote description: ', data.answer);
            const rtcSessionDescription = new RTCSessionDescription(data.answer);
            await peerConnection.setRemoteDescription(rtcSessionDescription);
        }
    });
}

function receiveStream(peerConnection, remoteEndpointID, isPeerContent) {
    peerConnection.addEventListener('track', event => {
        console.log('Got remote track:', event.streams[0]);
        if (document.querySelector("#video" + remoteEndpointID) == null) {
            createPeerVideo(remoteEndpointID, isPeerContent);
        }
        document.querySelector("#video" + remoteEndpointID).srcObject = event.streams[0];
        document.querySelector("#video" + remoteEndpointID).muted = false;
    });
}


function sendStream(peerConnection, stream) {
    stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
    });
}

async function sendOffer(offer, roomRef, peerId, nameId, isUserContent) {
    const peerOffer = {
        'offer': {
            type: offer.type,
            sdp: offer.sdp,
            display: 'user'
        },
    };

    if (isUserContent) {
        peerOffer.display = 'content'; 
    }

    await roomRef.collection(peerId).doc('SDP').collection('offer').doc(nameId).set(peerOffer);
}

async function sendAnswer(answer, roomRef, peerId, nameId, isUserContent) {
    const peerAnswer = {
        'answer': {
            type: answer.type,
            sdp: answer.sdp,
            display: 'user'
        },
    };
    if (isUserContent) {
        peerAnswer.display = 'content';
    }
    await roomRef.collection(peerId).doc('SDP').collection('answer').doc(nameId).set(peerAnswer);
}

async function receiveOffer(peerConnection, roomRef, peerId, nameId) {
    await roomRef.collection(nameId).doc('SDP').collection('offer').doc(peerId).get().then(async snapshot => {
        if (snapshot.exists) {
            const data = snapshot.data();
            const offer = data.offer;
            console.log('Got offer:', offer);
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        }
    });
}

function closeConnection(peerConnection, roomRef, peerId) {
    roomRef.collection('partyList').where('name', '==', peerId).onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type == 'removed') {
                if (change.doc.data().display == 'content') {
                    if (!isHandheld()) {
                        document.getElementById('screenShareButton').classList.remove('hidden');
                    }
                    contentExists = false;
                    contentShown = false;
                    document.removeEventListener('touchmove', swipeEventFunction);
                }
                peerConnection.close();    
                if (document.getElementById("video" + peerId + "Container") != null) {
                    document.getElementById("video" + peerId + "Container").remove();
                }
                enforceLayout(--numberOfDisplayedPeers);
            }
        });
    });

    peerConnection.onconnectionstatechange = function() {
        if (peerConnection.connectionState == 'disconnected' || peerConnection.connectionState == "failed") {
            //roomRef.collection('partyList').doc(peerId).delete();
            peerConnection.close();    
            if (document.getElementById("video" + peerId + "Container") != null) {
                document.getElementById("video" + peerId + "Container").remove();
            }
        }
    }
}

async function peerRequestConnection(peerId, roomRef, nameId, isUserContent, isPeerContent) {
    console.log('Create PeerConnection with configuration: ', configuration);
    const peerConnection = new RTCPeerConnection(configuration);

    registerPeerConnectionListeners(peerConnection);

    if (isUserContent) {
        sendStream(peerConnection, captureStream)
    } else {
        sendStream(peerConnection, cameraStream)
        document.getElementById('cameras').childNodes.forEach(camera => {
            camera.addEventListener('click', () => {
                switchStream(peerConnection, cameraStream);
            });
        });
    }

    signalICECandidates(peerConnection, roomRef, peerId, nameId);
    const offer = await createOffer(peerConnection);

    await sendOffer(offer, roomRef, peerId, nameId, isUserContent);

    if (!isUserContent) {
        receiveStream(peerConnection, peerId, isPeerContent);
    }

    await receiveAnswer(peerConnection, roomRef, peerId, nameId); 

    await receiveICECandidates(peerConnection, roomRef, peerId, nameId);

    document.querySelector('#hangupBtn').addEventListener('click', () => peerConnection.close());

    if (!isUserContent) {
        closeConnection(peerConnection, roomRef, peerId);
    }

    if (!isUserContent) {
        restartConnection(peerConnection, roomRef, peerId);
    }
}

async function peerAcceptConnection(peerId, roomRef, nameId, isPeerContent, isUserContent) {
    console.log('Create PeerConnection with configuration: ', configuration)
    const peerConnection = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners(peerConnection);

    if (!isPeerContent) {
        if (isUserContent) {
            sendStream(peerConnection, captureStream);
        } else {
            sendStream(peerConnection, cameraStream);
            document.getElementById('cameras').childNodes.forEach(camera => {
                camera.addEventListener('click', () => {
                    switchStream(peerConnection, cameraStream);
                });
            });
        }
    }

    signalICECandidates(peerConnection, roomRef, peerId, nameId)

    if (!isUserContent) {
        receiveStream(peerConnection, peerId, isPeerContent);
    }

    await receiveOffer(peerConnection, roomRef, peerId, nameId);

    const answer = await createAnswer(peerConnection);

    await sendAnswer(answer, roomRef, peerId, nameId, isUserContent);

    await receiveICECandidates(peerConnection, roomRef, peerId, nameId);

    document.querySelector('#hangupBtn').addEventListener('click', () => peerConnection.close());

    if (!isUserContent) {
        closeConnection(peerConnection, roomRef, peerId);
    }

    if (!isUserContent) {
        restartConnection(peerConnection, roomRef, peerId);
    }
}

function restartConnection(peerConnection, roomRef, peerId) {
    peerConnection.oniceconnectionstatechange = async function() {
        if (peerConnection.iceConnectionState === "failed") {
            console.log('Restarting connection with: ' + peerId);
            if (peerConnection.restartIce) {
                peerConnection.restartIce();
            } else {
                peerConnection.createOffer({ iceRestart: true })
                    .then(peerConnection.setLocalDescription)
                    .then(async offer => {
                        await sendOffer(offer, roomRef, peerId, false);
                    });
            }
        }
    }
}


function registerPeerConnectionListeners(peerConnection) {
    peerConnection.addEventListener('icegatheringstatechange', () => {
        console.log(
            `ICE gathering state changed: ${peerConnection.iceGatheringState}`);
    });

    peerConnection.addEventListener('connectionstatechange', () => {
        console.log(`Connection state change: ${peerConnection.connectionState}`);
    });

    peerConnection.addEventListener('signalingstatechange', () => {
        console.log(`Signaling state change: ${peerConnection.signalingState}`);
    });

    peerConnection.addEventListener('iceconnectionstatechange ', () => {
        console.log(
            `ICE connection state change: ${peerConnection.iceConnectionState}`);
    });
}

function requestConnectionToCurrentPeers(roomRef, Id, isContent) {
    roomRef.collection('partyList').get().then(snapshot => {
        snapshot.docs.forEach(async doc => {
            const peerId = doc.data().name
            const isPeerContent = doc.data().display == 'content';
            if (peerId != nameId && peerId != Id) {
                if (isPeerContent) {
                    console.log('Content Identified');
                    document.getElementById('screenShareButton').classList.add('hidden');
                }
                console.log('Sending request to: ' + peerId);
                await peerRequestConnection(peerId, roomRef, Id, isContent, isPeerContent);
            }
        })
    });
}

async function createRoom() {
    document.querySelector('#localVideo').addEventListener('click', hideLocalVideo);
    document.querySelector('#hangupBtn').classList.remove("hidden");
    document.querySelector('#createBtn').classList.add("hidden");
    document.querySelector('#shareButton').classList.remove("hidden");
    document.querySelector('#muteButton').classList.remove("hidden");
    document.querySelector('#joinBtn').classList.add("hidden");
    if (!isHandheld()) {
        document.querySelector('#screenShareButton').classList.remove("hidden");
    }
    const db = firebase.firestore();
    const roomRef = await db.collection('rooms').doc();

    document.querySelector('#shareButton').onclick = () => {
        window.open(
            `https://api.whatsapp.com/send?text=${window.location.href.split('?')[0]}?roomId=${roomRef.id}`,
            "_blank"
        )
    };

    nameId = await addUserToRoom(roomRef);

    roomRef.set({host: nameId});

    acceptConnectionsFromJoiningPeers(roomRef, nameId, false);

    signalHangup(roomRef);
    console.log(`Room ID: ${roomRef.id}`);

    document.querySelector('#screenShareButton').addEventListener('click', () => contentToggleButton(roomRef));
}

function joinRoom() {
    document.querySelector('#confirmJoinBtn').
        addEventListener('click', async () => {
            const roomId = document.querySelector('#room-id').value;
            await joinRoomById(roomId);
        }, {once: true});
    roomDialog.open();
}

function acceptConnectionsFromJoiningPeers(roomRef, nameId, isReceiverContent) {
    roomRef.collection(nameId).doc('SDP').collection('offer').onSnapshot(async snapshot => {
        await snapshot.docChanges().forEach(async change => {
            if (change.type === 'added') {
                console.log("Accepting Request from: " + change.doc.id);
                let isSenderContent = false;
                console.log("Display : ");
                console.log(change.doc.data());
                if (change.doc.data().display == 'content') {
                    console.log('Content Identified');
                    isSenderContent = true; 
                    document.getElementById('screenShareButton').classList.add('hidden');
                }
                console.log('Is sender content' + isSenderContent);
                await peerAcceptConnection(change.doc.id, roomRef, nameId, isSenderContent, isReceiverContent);
            } else {
                console.log("Mesh has been setup.");
            }
        })
    });
}

async function joinRoomById(roomId) {
    const db = firebase.firestore();
    const roomRef = db.collection('rooms').doc(`${roomId}`);
    const roomSnapshot = await roomRef.get();
    console.log('Got room:', roomSnapshot.exists);

    if (roomSnapshot.exists) {
        document.querySelector('#hangupBtn').classList.remove("hidden");
        document.querySelector('#localVideo').addEventListener('click', hideLocalVideo);
        document.querySelector('#shareButton').onclick = () => {
            window.open(
                `https://api.whatsapp.com/send?text=${window.location.href.split('?')[0]}?roomId=${roomRef.id}`,
                "_blank"
            )
        };

        document.querySelector('#shareButton').classList.remove("hidden");
        document.querySelector('#createBtn').classList.add("hidden");
        document.querySelector('#joinBtn').classList.add("hidden");
        document.querySelector('#muteButton').classList.remove("hidden");
        if (!isHandheld()) {
            document.querySelector('#screenShareButton').classList.remove("hidden");
        }

        nameId = await addUserToRoom(roomRef);

        console.log('Join room: ', roomId);

        requestConnectionToCurrentPeers(roomRef, nameId, false);

        acceptConnectionsFromJoiningPeers(roomRef, nameId, false);

        signalHangup(roomRef);

        document.querySelector('#screenShareButton').addEventListener('click', () => contentToggleButton(roomRef));

    } else {
        document.querySelector(
            '#currentRoom').innerText = `Room: ${roomId} - Doesn't exist!`;
    }
}

async function openUserMedia() {
    navigator.mediaDevices.enumerateDevices().then(devices => {
        devices.forEach(device => {
            const deviceNode = document.createElement("li");
            deviceNode.innerText = device.label;
            deviceNode.classList.add("mdc-list-item");
            deviceNode.role = "menuitem";
            deviceNode.tabIndex = 0;

            if (device.kind == "audioinput") {
                document.getElementById("microphones").appendChild(deviceNode);
            } else if (device.kind == "videoinput") {
                deviceNode.addEventListener('click', () => changeCamera(device.deviceId))
                document.getElementById("cameras").appendChild(deviceNode);
            }
        });
    });

    cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: "user"
        }, 
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
        }
    });

    document.querySelector('#localVideo').srcObject = cameraStream;

    console.log('Stream:', document.querySelector('#localVideo').srcObject);
    document.querySelector('#joinBtn').classList.remove("hidden");
    document.querySelector('#createBtn').classList.remove("hidden");
}

function hangUp() {
    const tracks = document.querySelector('#localVideo').srcObject.getTracks();
    tracks.forEach(track => {
        track.stop();
    });

    window.location = window.location.pathname;
}

function hideNavBarOnTap() {
    document.addEventListener("click", () => { 
        document.getElementById("buttons").classList.add("unhover");
    });
}

function cameraDropdown() {
    menu.open = true;
}

function init() {
    params = new URLSearchParams(location.search);
    roomDialog = new mdc.dialog.MDCDialog(document.querySelector('#room-dialog'));

    openUserMedia()
    if (params.get('roomId')) {
        console.log('Done');
        document.querySelector('#room-id').value = params.get('roomId');
        joinRoom();
    }
    document.querySelector('#hangupBtn').addEventListener('click', hangUp);
    document.querySelector('#createBtn').addEventListener('click', createRoom);
    document.querySelector('#joinBtn').addEventListener('click', joinRoom);
    document.querySelector('#localVideoShowButton').addEventListener('click', showLocalVideo);
    document.querySelector('#cameraOptions').addEventListener('click', cameraDropdown);

    let isFullscreen = false;
    document.getElementById('appFullscreenButton').addEventListener('click', () => {
        if (!isFullscreen) {
            isFullscreen = true;
            openFullscreen(document.body);
            document.getElementById('appFullscreenButton').classList.add('toggle');
            document.getElementById('appFullscreenButton').innerText = 'fullscreen_exit';
        } else {
            isFullscreen = false;
            closeFullscreen();
            document.getElementById('appFullscreenButton').classList.remove('toggle');
            document.getElementById('appFullscreenButton').innerText = 'fullscreen';
        }
    })
    hideNavBarOnTap();

    muteToggleEnable();
    videoToggleEnable();

    var eventName = isiOS ? 'pagehide' : 'beforeunload';

    window.addEventListener(eventName, function() {
        document.getElementById('hangupBtn').click();
    });
}

init();
