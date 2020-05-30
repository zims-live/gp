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

let remoteStream2 = null;
let roomDialog = null;
let roomId = null;
let nameId = null;

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

async function createAnswer(peerConnection) {
    const answer = await peerConnection.createAnswer();
    console.log('Created answer:', answer);
    await peerConnection.setLocalDescription(answer);
    return answer
}

async function signalDisconect(roomRef) {
    document.querySelector('#hangupBtn').addEventListener('click', () => {
        roomRef.update({
            disconnected: firebase.firestore.FieldValue.arrayUnion(nameId)
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
        const candidateDocRef = callerCandidatesCollection.add(event.candidate.toJSON()).then(docRef => {
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
                //roomRef.collection(remoteEndpointID).doc(change.doc.id).delete();
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
    roomRef.collection(nameId).doc('SDP').onSnapshot(async snapshot => {
        const data = snapshot.data();
        console.log("You are receiving an answer from: " + peerId);
        if (!peerConnection.currentRemoteDescription && data && (peerId in data) && ("answer" in data[peerId])) {
            console.log('Got remote description: ', data[peerId].answer);
            const rtcSessionDescription = new RTCSessionDescription(data[peerId].answer);
            await peerConnection.setRemoteDescription(rtcSessionDescription);
        }
    });
}

function receiveStream(peerConnection, remoteEndpointID) {
    let peerNode = document.getElementById("localVideo").cloneNode();
    peerNode.id = remoteEndpointID; 
    document.getElementById("videos").appendChild(peerNode);
    document.getElementById(remoteEndpointID).srcObject = new MediaStream();
    document.getElementById(remoteEndpointID).muted = false;

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
        peerConnection.addTrack(track, document.querySelector('#localVideo').srcObject);
    });
}

async function sendOffer(offer, roomRef, peerId) {
    const peerOffer = {
        [nameId]: {
            'offer': {
                type: offer.type,
                sdp: offer.sdp,
            }
        },
    };
    await roomRef.collection(peerId).doc('SDP').set(peerOffer);
}

async function sendAnswer(answer, roomRef, peerId) {
    const peerAnswer = {
        [nameId] : {
            'answer': {
                type: answer.type,
                sdp: answer.sdp,
            },
        }
    };
    await roomRef.collection(peerId).doc('SDP').set(peerAnswer);
}

async function receiveOffer(peerConnection1, roomRef, peerId) {
    await roomRef.collection(nameId).doc('SDP').get().then(async snapshot => {
        const data = snapshot.data();
        if (!peerConnection1.currentRemoteDescription && data && (peerId in data) && ("offer" in data[peerId])) {
            console.log(data);
            const offer = data[peerId].offer;
            console.log('Got offer:', offer);
            await peerConnection1.setRemoteDescription(new RTCSessionDescription(offer));
        }
    });
}

async function peerRequestConnection(peerId, roomRef) {
    console.log('Create PeerConnection with configuration: ', configuration);
    const peerConnection1 = new RTCPeerConnection(configuration);

    registerPeerConnectionListeners(peerConnection1);
    sendStream(peerConnection1)

    signalICECandidates(peerConnection1, roomRef, peerId);
    const offer = await createOffer(peerConnection1);

    await sendOffer(offer, roomRef, peerId);

    receiveStream(peerConnection1, peerId);

    await receiveAnswer(peerConnection1, roomRef, peerId); 

    await receiveICECandidates(peerConnection1, roomRef, peerId);
    
    signalDisconect(roomRef);

    roomRef.onSnapshot(snapshot => {
        if (snapshot.exists && snapshot.data().disconnected) {
            const disconnected = snapshot.data().disconnected;
            disconnected.forEach(peer => {
                if (peer == peerId) {
                    peerConnection1.close();    
                    document.getElementById(peerId).remove();
                }
            });
        }
    });

    //peerConnection1.onconnectionstatechange = function(event) {
        //if (peerConnection1.connectionState == "disconnected") {
            //peerConnection1.close();
            //document.getElementById(peerId).remove();
        //}
    //}

    //peerConnection1.oniceconnectionstatechange = function(event) {
        //if (peerConnection1.iceConnectionState === "failed" 
            //|| peerConnection1.iceConnectionState === "disconnected") {
            
            //if (peerConnection1.restartIce) {
                //peerConnection1.restartIce();
            //} else {
                //peerConnection1.createOffer({ iceRestart: true })
                    //.then(peerConnection1.setLocalDescription)
                    //.then(async offer => {
                        //await sendOffer(offer, roomRef, peerId);
                    //});
            //}
        //}
    //}
    await restartConnection(peerConnection1, roomRef, peerId);
}

async function restartConnection(peerConnection, roomRef, peerId) {
    peerConnection.oniceconnectionstatechange = async function(event) {
        if (peerConnection.iceConnectionState === "disconnected") {
            const snapshot = await roomRef.get();


            if (!(snapshot.exists && ("disconnected" in snapshot.data()) 
                && snapshot.data().disconnected.includes(peerId))) {
                console.log('Restarting connection');
                console.log(snapshot.data());
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
}

async function peerAcceptConnection(peerId, roomRef) {
    console.log('Create PeerConnection with configuration: ', configuration)
    const peerConnection1 = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners(peerConnection1);
    sendStream(peerConnection1);

    signalICECandidates(peerConnection1, roomRef, peerId)

    receiveStream(peerConnection1, peerId);

    await receiveOffer(peerConnection1, roomRef, peerId);

    const answer = await createAnswer(peerConnection1);

    await sendAnswer(answer, roomRef, peerId);

    await receiveICECandidates(peerConnection1, roomRef, peerId);

    signalDisconect(roomRef);

    roomRef.onSnapshot(snapshot => {
        if (snapshot.exists && snapshot.data().disconnected) {
            const disconnected = snapshot.data().disconnected;
            disconnected.forEach(peer => {
                if (peer == peerId) {
                    peerConnection1.close();    
                    document.getElementById(peerId).remove();
                }
            });
        }
    });

    //peerConnection1.onconnectionstatechange = function(event) {
    //if (peerConnection1.connectionState == "disconnected") {
    //peerConnection1.close();
    //document.getElementById(peerId).remove();
    //}
    //}
}

async function createRoom() {
    document.querySelector('#createBtn').disabled = true;
    document.querySelector('#joinBtn').disabled = true;
    const db = firebase.firestore();
    const roomRef = await db.collection('rooms').doc();

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

    console.log(`Room ID: ${roomRef.id}`);
    document.querySelector(
        '#currentRoom').innerText = `Current room is ${roomRef.id} - You are the caller!`;
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
        await addUserToRoom(roomRef);

        var removeOffer = function (peerId) {
            roomRef.collection(nameId).doc('SDP').update({
                [peerId] : firebase.firestore.FieldValue.delete()
            })
        }

        roomRef.collection(nameId).doc('SDP').onSnapshot(async snapshot => {
            if (snapshot.exists) {
                peers = Object.keys(snapshot.data());
                if (peers[0] && "offer" in snapshot.data()[peers[0]]) {
                    console.log("Accepting Request from: " + peers[0]);
                    peerAcceptConnection(peers[0], roomRef);
                    //console.log("Removed Offer from: " + peers[0]);
                    removeOffer(peers[0]);
                } else {
                    console.log("Mesh has been setup.");
                }
            }
        });

        roomRef.onSnapshot(async snapshot => {
            const peers = snapshot.data().names
            console.log("Current peers: " + peers);
            if (peers[peers.length - 1] != nameId) {
                console.log('Sending request to: ' + peers[peers.length - 1]);
                await peerRequestConnection(peers[peers.length - 1], roomRef);
            }
        });

    }
}

async function openUserMedia(e) {
    const stream = await navigator.mediaDevices.getUserMedia(
        {video: true, audio: true});
    document.querySelector('#localVideo').srcObject = stream;

    console.log('Stream:', document.querySelector('#localVideo').srcObject);
    document.querySelector('#cameraBtn').disabled = true;
    document.querySelector('#joinBtn').disabled = false;
    document.querySelector('#createBtn').disabled = false;
    document.querySelector('#hangupBtn').disabled = false;
}

function hangUp() {
    const tracks = document.querySelector('#localVideo').srcObject.getTracks();
    tracks.forEach(track => {
        track.stop();
    });

    while(document.getElementById("videos").lastChild.id != "localVideo") { 
        document.getElementById("videos").lastChild.remove(); 
    }

    document.querySelector('#localVideo').srcObject = null;
    document.querySelector('#cameraBtn').disabled = false;
    document.querySelector('#joinBtn').disabled = true;
    document.querySelector('#createBtn').disabled = true;
    document.querySelector('#hangupBtn').disabled = true;
    document.querySelector('#currentRoom').innerText = '';

    // Delete room on hangup
    //if (roomId) {
    //const db = firebase.firestore();
    //const roomRef = db.collection('rooms').doc(roomId);
    //const calleeCandidates = await roomRef.collection(nameId).get();
    //calleeCandidates.forEach(async candidate => {
    //await candidate.ref.delete();
    //});
    //const callerCandidates = await roomRef.collection(nameId).get();
    //callerCandidates.forEach(async candidate => {
    //await candidate.ref.delete();
    //});
    //await roomRef.delete();
    //}

    //document.location.reload(true);
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

init();
