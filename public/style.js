let numberOfDisplayedPeers = 0;

function enforceGridRules(numberOfDisplayedPeers) {
    if (!contentExists) {
        if (numberOfDisplayedPeers == 1) {
            document.getElementById("videos").setAttribute("class", "");
            document.getElementById("videos").classList.add("single_cell");
            document.getElementById("localVideoContainer").classList.add("sideLocalVideo");
        } else if (numberOfDisplayedPeers == 2) {
            document.getElementById("videos").setAttribute("class", "");
            document.getElementById("videos").classList.add("two_cell");
            document.getElementById("localVideoContainer").classList.add("sideLocalVideo");
        } else if (numberOfDisplayedPeers > 2 && numberOfDisplayedPeers <= 4) {
            document.getElementById("videos").setAttribute("class", "");
            document.getElementById("videos").classList.add("four_cell");
            document.getElementById("localVideoContainer").classList.add("sideLocalVideo");
        } else if (numberOfDisplayedPeers > 4 && numberOfDisplayedPeers <= 9) {
            document.getElementById("videos").setAttribute("class", "");
            document.getElementById("videos").classList.add("nine_cell");
            document.getElementById("localVideoContainer").classList.add("sideLocalVideo");
        } else if (numberOfDisplayedPeers > 9) {
            document.getElementById("videos").setAttribute("class", "");
            document.getElementById("videos").classList.add("sixteen_cell");
            document.getElementById("localVideoContainer").classList.add("sideLocalVideo");
        } else {
            document.getElementById("videos").setAttribute("class", "");
            document.getElementById("videos").classList.add("single_cell");
            document.getElementById("localVideoContainer").classList.remove("sideLocalVideo");
        }
    } else {
        document.getElementById("videos").setAttribute("class", "");
        document.getElementById("videos").classList.add("sixteen_cell");
        document.getElementById("localVideoContainer").classList.remove("sideLocalVideo");
    }
}

function createPeerVideo(peerId, isPeerContent) {
    const peerNode = document.getElementsByClassName('video-box')[0].cloneNode();
    peerNode.appendChild(document.getElementById('localVideo').cloneNode());

    peerNode.id = 'video' + peerId + "Container";
    peerNode.firstElementChild.id = 'video' + peerId;

    peerNode.classList.remove('sideLocalVideo');
    peerNode.classList.remove('relaxedHidden');
    if (isPeerContent) {
        contentExists = true;
        peerNode.classList.add('contentContainer');
    }

    document.getElementById("videos").appendChild(peerNode);

    document.getElementById("video" + peerId).srcObject = new MediaStream();

    enforceGridRules(++numberOfDisplayedPeers);
}

function hideLocalVideo() {
    localVideoElem = document.getElementById('localVideoContainer');
    localVideoElem.classList.add('relaxedHidden');
    document.getElementById('localVideoShowButton').classList.remove('hidden'); 
}

function showLocalVideo() {
    localVideoElem = document.getElementById('localVideoContainer');
    localVideoElem.classList.remove('relaxedHidden');
    document.getElementById('localVideoShowButton').classList.add('hidden'); 
}
