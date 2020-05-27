mdc.ripple.MDCRipple.attachTo(document.querySelector('.mdc-button'));

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

let peerConnection1 = null;
let peerConnection2 = null;
let peerConnection3 = null;
let remoteStream2 = null;
let roomDialog = null;
let roomId = null;

function init() {
    document.querySelector('#cameraBtn').addEventListener('click', openUserMedia);
    document.querySelector('#hangupBtn').addEventListener('click', hangUp);
    document.querySelector('#createBtn').addEventListener('click', createRoom);
    document.querySelector('#joinBtn').addEventListener('click', joinRoom);
    roomDialog = new mdc.dialog.MDCDialog(document.querySelector('#room-dialog'));
}

async function createOffer(peerConnection) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log('Created offer:', offer);
    return offer;
}

async function answerOffer(peerConnection) {
    const answer = await peerConnection1.createAnswer();
    console.log('Created answer:', answer);
    await peerConnection1.setLocalDescription(answer);
    return answer
}


function signalICECandidates(peerConnection, roomRef, localEndpointID) {
    const callerCandidatesCollection = roomRef.collection(localEndpointID);
    peerConnection.addEventListener('icecandidate', event => {
        if (!event.candidate) {
            console.log('Got final candidate!');
            return;
        }
        console.log('Got candidate: ', event.candidate);
        callerCandidatesCollection.add(event.candidate.toJSON());
    });
}

async function receiveICECandidates(peerConnection, roomRef, remoteEndpointID) {
    roomRef.collection(remoteEndpointID).onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added') {
                let data = change.doc.data();
                console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
                await peerConnection.addIceCandidate(new RTCIceCandidate(data));
            }
        });
    });
}

async function receiveAnswer(peerConnection, roomRef) {
    roomRef.onSnapshot(async snapshot => {
        const data = snapshot.data();
        if (!peerConnection.currentRemoteDescription && data && data.answer) {
            console.log('Got remote description: ', data.answer);
            const rtcSessionDescription = new RTCSessionDescription(data.answer);
            await peerConnection.setRemoteDescription(rtcSessionDescription);
        }
    });
}

function receiveStream(peerConnection, remoteEndpointID) {
    peerConnection.addEventListener('track', event => {
        console.log('Got remote track:', event.streams[0]);
        event.streams[0].getTracks().forEach(track => {
            console.log('Add a track to the remoteStream:', track);
            document.querySelector("#" + remoteEndpointID).srcObject.addTrack(track);
        });
    });
}

function sendStream(peerConnection) {
    document.querySelector('#localVideo').srcObject.getTracks().forEach(track => {
        peerConnection1.addTrack(track, document.querySelector('#localVideo').srcObject);
    });
}

async function createRoom() {
    document.querySelector('#createBtn').disabled = true;
    document.querySelector('#joinBtn').disabled = true;
    const db = firebase.firestore();
    const roomRef = await db.collection('rooms').doc();

    console.log('Create PeerConnection with configuration: ', configuration);
    peerConnection1 = new RTCPeerConnection(configuration);

    registerPeerConnectionListeners();
    
    sendStream(peerConnection1)

    // Code for collecting ICE candidates below
    signalICECandidates(peerConnection1, roomRef, 'callerCandidates');
    // Code for collecting ICE candidates above

    // Code for creating a room below
    const offer = await createOffer(peerConnection1);

    const roomWithOffer = {
        'offer': {
            type: offer.type,
            sdp: offer.sdp,
        },
    };
    await roomRef.set(roomWithOffer);
    roomId = roomRef.id;
    console.log(`New room created with SDP offer. Room ID: ${roomRef.id}`);
    document.querySelector(
        '#currentRoom').innerText = `Current room is ${roomRef.id} - You are the caller!`;

    receiveStream(peerConnection1, "remoteVideo1");
    // Listening for remote session description below
    await receiveAnswer(peerConnection1, roomRef); 

    // Listen for remote ICE candidates below
    await receiveICECandidates(peerConnection1, roomRef, "calleeCandidates");
}

function joinRoom() {
    document.querySelector('#createBtn').disabled = true;
    document.querySelector('#joinBtn').disabled = true;

    document.querySelector('#confirmJoinBtn').
        addEventListener('click', async () => {
            roomId = document.querySelector('#room-id').value;
            console.log('Join room: ', roomId);
            document.querySelector(
                '#currentRoom').innerText = `Current room is ${roomId} - You are the callee!`;
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
        console.log('Create PeerConnection with configuration: ', configuration);
        peerConnection1 = new RTCPeerConnection(configuration);
        registerPeerConnectionListeners();
        sendStream(peerConnection1);

        // Code for collecting ICE candidates below
        const calleeCandidatesCollection = roomRef.collection('calleeCandidates');
        peerConnection1.addEventListener('icecandidate', event => {
            if (!event.candidate) {
                console.log('Got final candidate!');
                return;
            }
            console.log('Got candidate: ', event.candidate);
            calleeCandidatesCollection.add(event.candidate.toJSON());
        });
        // Code for collecting ICE candidates above

        peerConnection1.addEventListener('track', event => {
            console.log('Got remote track:', event.streams[0]);
            event.streams[0].getTracks().forEach(track => {
                console.log('Add a track to the remoteStream:', track);
                document.querySelector('#remoteVideo1').srcObject.addTrack(track);
            });
        });

        // Code for creating SDP answer below
        const offer = roomSnapshot.data().offer;
        console.log('Got offer:', offer);
        await peerConnection1.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection1.createAnswer();
        console.log('Created answer:', answer);
        await peerConnection1.setLocalDescription(answer);

        const roomWithAnswer = {
            answer: {
                type: answer.type,
                sdp: answer.sdp,
            },
        };
        await roomRef.update(roomWithAnswer);
        // Code for creating SDP answer above

        // Listening for remote ICE candidates below
        roomRef.collection('callerCandidates').onSnapshot(snapshot => {
            snapshot.docChanges().forEach(async change => {
                if (change.type === 'added') {
                    let data = change.doc.data();
                    console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
                    await peerConnection1.addIceCandidate(new RTCIceCandidate(data));
                }
            });
        });
        // Listening for remote ICE candidates above
    }
}

async function openUserMedia(e) {
    const stream = await navigator.mediaDevices.getUserMedia(
        {video: true, audio: true});
    document.querySelector('#localVideo').srcObject = stream;
    //localStream = stream;
    document.querySelector('#remoteVideo1').srcObject = new MediaStream();

    remoteStream2 = new MediaStream();
    document.querySelector('#remoteVideo2').srcObject = remoteStream2;

    console.log('Stream:', document.querySelector('#localVideo').srcObject);
    document.querySelector('#cameraBtn').disabled = true;
    document.querySelector('#joinBtn').disabled = false;
    document.querySelector('#createBtn').disabled = false;
    document.querySelector('#hangupBtn').disabled = false;
}

async function hangUp(e) {
    const tracks = document.querySelector('#localVideo').srcObject.getTracks();
    tracks.forEach(track => {
        track.stop();
    });

    if (document.querySelector('#remoteVideo1').srcObject) {
        document.querySelector('#remoteVideo1').srcObject.getTracks().forEach(track => track.stop());
    }

    if (remoteStream2) {
        remoteStream2.getTracks().forEach(track => track.stop());
    }

    if (peerConnection1) {
        peerConnection1.close();
    }

    document.querySelector('#localVideo').srcObject = null;
    document.querySelector('#remoteVideo1').srcObject = null;
    document.querySelector('#remoteVideo2').srcObject = null;
    document.querySelector('#cameraBtn').disabled = false;
    document.querySelector('#joinBtn').disabled = true;
    document.querySelector('#createBtn').disabled = true;
    document.querySelector('#hangupBtn').disabled = true;
    document.querySelector('#currentRoom').innerText = '';

    // Delete room on hangup
    if (roomId) {
        const db = firebase.firestore();
        const roomRef = db.collection('rooms').doc(roomId);
        const calleeCandidates = await roomRef.collection('calleeCandidates').get();
        calleeCandidates.forEach(async candidate => {
            await candidate.ref.delete();
        });
        const callerCandidates = await roomRef.collection('callerCandidates').get();
        callerCandidates.forEach(async candidate => {
            await candidate.ref.delete();
        });
        await roomRef.delete();
    }

    document.location.reload(true);
}

function registerPeerConnectionListeners() {
    peerConnection1.addEventListener('icegatheringstatechange', () => {
        console.log(
            `ICE gathering state changed: ${peerConnection1.iceGatheringState}`);
    });

    peerConnection1.addEventListener('connectionstatechange', () => {
        console.log(`Connection state change: ${peerConnection1.connectionState}`);
    });

    peerConnection1.addEventListener('signalingstatechange', () => {
        console.log(`Signaling state change: ${peerConnection1.signalingState}`);
    });

    peerConnection1.addEventListener('iceconnectionstatechange ', () => {
        console.log(
            `ICE connection state change: ${peerConnection1.iceConnectionState}`);
    });
}

init();
