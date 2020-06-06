mdc.ripple.MDCRipple.attachTo(document.querySelector('.mdc-icon-button'));
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
let muteState = false;
let numberOfDisplayedPeers = 1;

function muteToggleEnable() {
    document.querySelector('#muteButton').addEventListener('click', () => {
        if (!muteState) {
            console.log("Muting");
            muteState = true;
            document.getElementById("localVideo").srcObject.getAudioTracks()[0].enabled = false;
            document.querySelector('#muteButton').innerText = "volume_off";
        } else {
            console.log("Unmuting");
            muteState = false;
            document.getElementById("localVideo").srcObject.getAudioTracks()[0].enabled = true;
            document.querySelector('#muteButton').innerText = "volume_up";
        }
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

function signalICECandidates(peerConnection, roomRef, peerId) {
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

async function receiveICECandidates(peerConnection, roomRef, remoteEndpointID) {
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
    await roomRef.get().then(async snapshot => {
        if (!snapshot.exists) { 
            nameId = "peer1";
            await roomRef.set({
                names : [nameId]
            });
        } else {
            nameId = "peer" + (snapshot.data().names.length + 1);
            await roomRef.update({
                names: firebase.firestore.FieldValue.arrayUnion(nameId)
            });
        }
        console.log("NameId: " + nameId);
    });
}

async function receiveAnswer(peerConnection, roomRef, peerId) {
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
    //const peerNode = document.getElementsByClassName('video-box')[0].cloneNode();
    //peerNode.appendChild(document.getElementById('localVideo').cloneNode());

    //peerNode.id = remoteEndpointID + "Container";
    //peerNode.firstElementChild.id = remoteEndpointID;

    //document.getElementById("videos").appendChild(peerNode);

    //document.getElementById(remoteEndpointID).srcObject = new MediaStream();
    
    createPeerVideo(remoteEndpointID);

    peerConnection.addEventListener('track', event => {
        console.log('Got remote track:', event.streams[0]);
        document.querySelector("#" + remoteEndpointID).srcObject = event.streams[0];
    });

    document.querySelector("#" + remoteEndpointID).muted = false;
    enforceGridRules(++numberOfDisplayedPeers);
}


function sendStream(peerConnection) {
    document.querySelector('#localVideo').srcObject.getTracks().forEach(track => {
        peerConnection.addTrack(track, document.querySelector('#localVideo').srcObject);
    });
}

async function sendOffer(offer, roomRef, peerId) {
    const peerOffer = {
        'offer': {
            type: offer.type,
            sdp: offer.sdp,
        },
    };
    await roomRef.collection(peerId).doc('SDP').collection('offer').doc(nameId).set(peerOffer);
}

async function sendAnswer(answer, roomRef, peerId) {
    const peerAnswer = {
        'answer': {
            type: answer.type,
            sdp: answer.sdp,
        },
    };
    await roomRef.collection(peerId).doc('SDP').collection('answer').doc(nameId).set(peerAnswer);
}

async function receiveOffer(peerConnection1, roomRef, peerId) {
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

async function peerRequestConnection(peerId, roomRef) {
    console.log('Create PeerConnection with configuration: ', configuration);
    const peerConnection = new RTCPeerConnection(configuration);

    registerPeerConnectionListeners(peerConnection);
    sendStream(peerConnection)

    signalICECandidates(peerConnection, roomRef, peerId);
    const offer = await createOffer(peerConnection);

    await sendOffer(offer, roomRef, peerId);

    receiveStream(peerConnection, peerId);

    await receiveAnswer(peerConnection, roomRef, peerId); 

    await receiveICECandidates(peerConnection, roomRef, peerId);

    document.querySelector('#hangupBtn').addEventListener('click', () => peerConnection.close());

    closeConnection(peerConnection, roomRef, peerId);
    
    restartConnection(peerConnection, roomRef, peerId);
}

async function peerAcceptConnection(peerId, roomRef) {
    console.log('Create PeerConnection with configuration: ', configuration)
    const peerConnection = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners(peerConnection);
    sendStream(peerConnection);

    signalICECandidates(peerConnection, roomRef, peerId)

    receiveStream(peerConnection, peerId);

    await receiveOffer(peerConnection, roomRef, peerId);

    const answer = await createAnswer(peerConnection);

    await sendAnswer(answer, roomRef, peerId);

    await receiveICECandidates(peerConnection, roomRef, peerId);

    document.querySelector('#hangupBtn').addEventListener('click', () => peerConnection.close());

    closeConnection(peerConnection, roomRef, peerId);

    restartConnection(peerConnection, roomRef, peerId);
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

    await addUserToRoom(roomRef);

    roomRef.onSnapshot(async snapshot => {
        if (snapshot.exists) {
            const peers = snapshot.data().names
            if (peers.length != 1) {
                console.log('Sending request to: ' + peers[peers.length - 1]);
                await peerRequestConnection(peers[peers.length - 1], roomRef);
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

        await addUserToRoom(roomRef);

        console.log('Join room: ', roomId);

        roomRef.collection(nameId).doc('SDP').collection('offer').onSnapshot(async snapshot => {
            await snapshot.docChanges().forEach(async change => {
                if (change.type === 'added') {
                    console.log("Accepting Request from: " + change.doc.id);
                    await peerAcceptConnection(change.doc.id, roomRef);
                } else {
                    console.log("Mesh has been setup.");
                }
            })
        });

        roomRef.onSnapshot(async snapshot => {
            const peers = snapshot.data().names
            console.log("Current peers: " + peers);
            if (peers[peers.length - 1] != nameId) {
                console.log('Sending request to: ' + peers[peers.length - 1]);
                await peerRequestConnection(peers[peers.length - 1], roomRef);
            }
        });

        signalHangup(roomRef);
    } else {
        document.querySelector(
            '#currentRoom').innerText = `Room: ${roomId} - Doesn't exist!`;
    }
}

async function openUserMedia() {
    const stream = await navigator.mediaDevices.getUserMedia(
        {video: true, audio: true});
    document.querySelector('#localVideo').srcObject = stream;

    console.log('Stream:', document.querySelector('#localVideo').srcObject);
    document.querySelector('#joinBtn').classList.remove("hidden");
    document.querySelector('#createBtn').classList.remove("hidden");
}

function hangUp() {
    const tracks = document.querySelector('#localVideo').srcObject.getTracks();
    tracks.forEach(track => {
        track.stop();
    });

    document.querySelector('#joinBtn').classList.add("hidden");
    document.querySelector('#createBtn').classList.add("hidden");
    document.querySelector('#hangupBtn').classList.add("hidden");
    document.querySelector('#currentRoom').innerText = '';

    document.location.href = window.location.href.split('?')[0];
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
    var eventName = iOS ? 'onpagehide' : 'onbeforeunload';

    window.onunload = window[eventName] = () => {
        document.getElementById('hangupBtn').click();
    };
    muteToggleEnable();
}

init();
