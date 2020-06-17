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
let numberOfDisplayedPeers = 1;
let screenState = false;
let cameraStream = null;
let captureStream = null;
let localStream = null;

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


async function signalContentShare(roomRef) {
    await roomRef.get().then(async snapshot => {
        contentId = "peer" + (snapshot.data().names.length + 1);
        await roomRef.update({
            names: firebase.firestore.FieldValue.arrayUnion(contentId)
        });
    });

    console.log("Content id is" + contentId);

    roomRef.collection(contentId).doc('SDP').collection('offer').onSnapshot(async snapshot => {
        await snapshot.docChanges().forEach(async change => {
            if (change.type === 'added') {
                peerId = change.doc.id;
                const peerConnection = new RTCPeerConnection(configuration);
                sendStream(peerConnection, captureStream);
                signalICECandidates(peerConnection, roomRef, peerId, contentId)
                await receiveOffer(peerConnection, roomRef, peerId, contentId);
                const answer = await createAnswer(peerConnection);
                await sendAnswer(answer, roomRef, peerId, contentId);
                await receiveICECandidates(peerConnection, roomRef, peerId, contentId);
                document.querySelector('#hangupBtn').addEventListener('click', () => peerConnection.close());
                restartConnection(peerConnection, roomRef, peerId);
            } else {
                console.log("Content Sharing has been setup");
            }
        })
    });

    roomRef.onSnapshot(async snapshot => {
        const peers = snapshot.data().names
        console.log("Current peers: " + peers);
        if (peers[peers.length - 1] != contentId) {
            const peerConnection = new RTCPeerConnection(configuration);
            sendStream(peerConnection, captureStream)
            signalICECandidates(peerConnection, roomRef, peerId, nameId);
            const offer = await createOffer(peerConnection);
            await sendOffer(offer, roomRef, peerId, nameId);
            await receiveAnswer(peerConnection, roomRef, peerId, nameId); 
            await receiveICECandidates(peerConnection, roomRef, peerId, nameId);
            document.querySelector('#hangupBtn').addEventListener('click', () => peerConnection.close());
            restartConnection(peerConnection, roomRef, peerId);
        }
    });
}

async function contentToggleButton(roomRef, peerConnection) {
    if (!screenState) {
        screenState = true;
        const displayMediaOptions = {
            video: {
                cursor: "always"
            },
            audio: true
        };
        captureStream = await startCapture(displayMediaOptions);
        localStream = captureStream;
        document.getElementById('screenShareButton').innerText = "stop_screen_share";
        document.getElementById('screenShareButton').classList.add('toggle');
        captureStream.getVideoTracks()[0].onended = async function () {
            await contentToggleButton(roomRef, peerConnection);
        };
        await signalContentShare(roomRef);
    } else {
        stopCapture(captureStream); 
        localStream = cameraStream;
        await roomRef.collection('disconnected').doc().set({
            disconnected: contentId
        });
        screenState = false;
        document.getElementById('screenShareButton').innerText = 'screen_share';
        document.getElementById('screenShareButton').classList.remove('toggle');
        contentId = null;
    }
}

async function startCapture(displayMediaOptions) {
    let captureStream = null;

    try {
        captureStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    } catch(err) {
        console.error("Error: " + err);
    }
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
            document.getElementById("localVideo").srcObject.getAudioTracks()[0].enabled = false;
            document.querySelector('#muteButton').innerText = "mic_off";
            document.getElementById('muteButton').classList.add('toggle');
        } else {
            console.log("Unmuting");
            muteState = false;
            document.getElementById("localVideo").srcObject.getAudioTracks()[0].enabled = true;
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

        await roomRef.collection('disconnected').doc().set({
            disconnected: nameId
        });
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
    let Id;
    await roomRef.get().then(async snapshot => {
        if (!snapshot.exists) { 
            Id = "peer1";
            await roomRef.set({
                names : [Id]
            });
        } else {
            Id = "peer" + (snapshot.data().names.length + 1);
            await roomRef.update({
                names: firebase.firestore.FieldValue.arrayUnion(Id)
            });
        }
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

function receiveStream(peerConnection, remoteEndpointID) {
    createPeerVideo(remoteEndpointID);

    peerConnection.addEventListener('track', event => {
        console.log('Got remote track:', event.streams[0]);
        document.querySelector("#" + remoteEndpointID).srcObject = event.streams[0];
    });

    document.querySelector("#" + remoteEndpointID).muted = false;
    enforceGridRules(++numberOfDisplayedPeers);
}


function sendStream(peerConnection, stream) {
    stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, document.querySelector('#localVideo').srcObject);
    });
}

async function sendOffer(offer, roomRef, peerId, nameId) {
    const peerOffer = {
        'offer': {
            type: offer.type,
            sdp: offer.sdp,
        },
    };
    await roomRef.collection(peerId).doc('SDP').collection('offer').doc(nameId).set(peerOffer);
}

async function sendAnswer(answer, roomRef, peerId, nameId) {
    const peerAnswer = {
        'answer': {
            type: answer.type,
            sdp: answer.sdp,
        },
    };
    await roomRef.collection(peerId).doc('SDP').collection('answer').doc(nameId).set(peerAnswer);
}

async function receiveOffer(peerConnection1, roomRef, peerId, nameId) {
    await roomRef.collection(nameId).doc('SDP').collection('offer').doc(peerId).get().then(async snapshot => {
        if (snapshot.exists) {
            const data = snapshot.data();
            console.log(data);
            const offer = data.offer;
            console.log('Got offer:', offer);
            await peerConnection1.setRemoteDescription(new RTCSessionDescription(offer));
        }
    });
}

function closeConnection(peerConnection, roomRef, peerId) {
    roomRef.collection('disconnected').where('disconnected', '==', peerId).onSnapshot(querySnapshot => {
        querySnapshot.forEach(snapshot => {
            if (snapshot.exists) {
                peerConnection.close();    
                document.getElementById(peerId + "Container").remove();
                enforceGridRules(--numberOfDisplayedPeers);
            }
        });
    });

    peerConnection.onconnectionstatechange = function() {
        if (peerConnection.connectionState == "failed") {
            peerConnection.close();    
            document.getElementById(peerId + "Container").remove();
            enforceGridRules(--numberOfDisplayedPeers);
        }
    }
}

async function peerRequestConnection(peerId, roomRef, nameId) {
    console.log('Create PeerConnection with configuration: ', configuration);
    const peerConnection = new RTCPeerConnection(configuration);

    registerPeerConnectionListeners(peerConnection);
    sendStream(peerConnection, cameraStream)

    signalICECandidates(peerConnection, roomRef, peerId, nameId);
    const offer = await createOffer(peerConnection);

    await sendOffer(offer, roomRef, peerId, nameId);

    receiveStream(peerConnection, peerId);

    await receiveAnswer(peerConnection, roomRef, peerId, nameId); 

    await receiveICECandidates(peerConnection, roomRef, peerId, nameId);

    document.querySelector('#hangupBtn').addEventListener('click', () => peerConnection.close());

    closeConnection(peerConnection, roomRef, peerId);

    restartConnection(peerConnection, roomRef, peerId);
    
    document.querySelector('#screenShareButton').addEventListener('click', async () => await contentToggleButton(roomRef, peerConnection));
    document.getElementById('localVideo').srcObject.getVideoTracks()[0].onended = async () => {
        await contentToggleButton(roomRef, peerConnection);
    };
    document.querySelector('#screenShareButton').classList.remove("hidden");
}

async function peerAcceptConnection(peerId, roomRef, nameId) {
    console.log('Create PeerConnection with configuration: ', configuration)
    const peerConnection = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners(peerConnection);
    sendStream(peerConnection, cameraStream);

    signalICECandidates(peerConnection, roomRef, peerId, nameId)

    receiveStream(peerConnection, peerId);

    await receiveOffer(peerConnection, roomRef, peerId, nameId);

    const answer = await createAnswer(peerConnection);

    await sendAnswer(answer, roomRef, peerId, nameId);

    await receiveICECandidates(peerConnection, roomRef, peerId, nameId);

    document.querySelector('#hangupBtn').addEventListener('click', () => peerConnection.close());

    closeConnection(peerConnection, roomRef, peerId);

    restartConnection(peerConnection, roomRef, peerId);

    document.querySelector('#screenShareButton').addEventListener('click', async () => await contentToggleButton(roomRef, peerConnection));
    document.getElementById('localVideo').srcObject.getVideoTracks()[0].onended = async function () {
        await contentToggleButton(roomRef, peerConnection);
    };

    document.querySelector('#screenShareButton').classList.remove("hidden");
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
                        await sendOffer(offer, roomRef, peerId);
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

async function createRoom() {
    document.querySelector('#hangupBtn').classList.remove("hidden");
    document.querySelector('#createBtn').classList.add("hidden");
    document.querySelector('#shareButton').classList.remove("hidden");
    document.querySelector('#muteButton').classList.remove("hidden");
    document.querySelector('#joinBtn').classList.add("hidden");
    const db = firebase.firestore();
    const roomRef = await db.collection('rooms').doc();

    document.querySelector('#shareButton').onclick = () => {
        window.open(
            `https://api.whatsapp.com/send?text=${window.location.href.split('?')[0]}?roomId=${roomRef.id}`,
            "_blank"
        )
    };

    nameId = await addUserToRoom(roomRef);

    roomRef.onSnapshot(async snapshot => {
        if (snapshot.exists) {
            const peers = snapshot.data().names
            if (peers.length != 1 && peers[peers.length - 1] != contentId) {
                console.log('Sending request to: ' + peers[peers.length - 1]);
                await peerRequestConnection(peers[peers.length - 1], roomRef, nameId);
            }
        }
    });

    signalHangup(roomRef);
    console.log(`Room ID: ${roomRef.id}`);
}

function joinRoom() {
    document.querySelector('#confirmJoinBtn').
        addEventListener('click', async () => {
            const roomId = document.querySelector('#room-id').value;
            await joinRoomById(roomId);
        }, {once: true});
    roomDialog.open();
}

async function joinRoomById(roomId) {
    const db = firebase.firestore();
    const roomRef = db.collection('rooms').doc(`${roomId}`);
    const roomSnapshot = await roomRef.get();
    console.log('Got room:', roomSnapshot.exists);

    if (roomSnapshot.exists) {
        document.querySelector('#hangupBtn').classList.remove("hidden");
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

        nameId = await addUserToRoom(roomRef);

        console.log('Join room: ', roomId);

        roomRef.collection(nameId).doc('SDP').collection('offer').onSnapshot(async snapshot => {
            await snapshot.docChanges().forEach(async change => {
                if (change.type === 'added') {
                    console.log("Accepting Request from: " + change.doc.id);
                    await peerAcceptConnection(change.doc.id, roomRef, nameId);
                } else {
                    console.log("Mesh has been setup.");
                }
            })
        });

        roomRef.onSnapshot(async snapshot => {
            const peers = snapshot.data().names
            console.log("Current peers: " + peers);
            if (peers[peers.length - 1] != nameId && peers[peers.length - 1] != contentId) {
                console.log(contentId);
                console.log('Sending request to: ' + peers[peers.length - 1]);
                await peerRequestConnection(peers[peers.length - 1], roomRef, nameId);
            }
        });

        signalHangup(roomRef);
    } else {
        document.querySelector(
            '#currentRoom').innerText = `Room: ${roomId} - Doesn't exist!`;
    }
}

async function openUserMedia() {
    cameraStream = await navigator.mediaDevices.getUserMedia(
        {video: true, audio: true});
    document.querySelector('#localVideo').srcObject = cameraStream;

    localStream = cameraStream;

    console.log('Stream:', document.querySelector('#localVideo').srcObject);
    document.querySelector('#joinBtn').classList.remove("hidden");
    document.querySelector('#createBtn').classList.remove("hidden");
}

function hangUp() {
    const tracks = document.querySelector('#localVideo').srcObject.getTracks();
    tracks.forEach(track => {
        track.stop();
    });

    //document.querySelector('#joinBtn').classList.add("hidden");
    //document.querySelector('#createBtn').classList.add("hidden");
    //document.querySelector('#hangupBtn').classList.add("hidden");
    //document.querySelector('#currentRoom').innerText = '';

    window.location = window.location.pathname;
}

function hideNavBarOnTap() {
    document.addEventListener("click", () => { 
        document.getElementById("buttons").classList.add("unhover");
    });
}

function init() {

    openUserMedia()

    params = new URLSearchParams(location.search);
    roomDialog = new mdc.dialog.MDCDialog(document.querySelector('#room-dialog'));

    if (params.get('roomId')) {
        console.log('Done');
        document.querySelector('#room-id').value = params.get('roomId');
        joinRoom();
    }

    document.querySelector('#hangupBtn').addEventListener('click', hangUp);
    document.querySelector('#createBtn').addEventListener('click', createRoom);
    document.querySelector('#joinBtn').addEventListener('click', joinRoom);
    hideNavBarOnTap();

    var iOS = ['iPad', 'iPhone', 'iPod'].indexOf(navigator.platform) >= 0;
    var eventName = iOS ? 'pagehide' : 'beforeunload';

    window.addEventListener(eventName, function() {
        document.getElementById('hangupBtn').click();
    });
    muteToggleEnable();
    videoToggleEnable();
}

init();
