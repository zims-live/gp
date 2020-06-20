function enforceGridRules(numberOfDisplayedPeers) {
    if (numberOfDisplayedPeers == 2) {
        document.getElementById("videos").setAttribute("class", "");
        document.getElementById("videos").classList.add("two_cell");
        //document.getElementById("localVideoContainer").classList.add("sideLocalVideo");
    } else if (numberOfDisplayedPeers > 2 && numberOfDisplayedPeers <= 4) {
        document.getElementById("videos").setAttribute("class", "");
        document.getElementById("videos").classList.add("four_cell");
        //document.getElementById("localVideoContainer").classList.add("sideLocalVideo");
    } else if (numberOfDisplayedPeers > 4 && numberOfDisplayedPeers <= 9) {
        document.getElementById("videos").setAttribute("class", "");
        document.getElementById("videos").classList.add("nine_cell");
        //document.getElementById("localVideoContainer").classList.add("sideLocalVideo");
    } else if (numberOfDisplayedPeers > 9) {
        document.getElementById("videos").setAttribute("class", "");
        document.getElementById("videos").classList.add("sixteen_cell");
        //document.getElementById("localVideoContainer").classList.add("sideLocalVideo");
    } else {
        document.getElementById("videos").setAttribute("class", "");
        document.getElementById("videos").classList.add("single_cell");
        //document.getElementById("localVideoContainer").classList.remove("sideLocalVideo");
    }
}

function createPeerVideo(peerId) {
    const peerNode = document.getElementsByClassName('video-box')[0].cloneNode();
    peerNode.appendChild(document.getElementById('localVideo').cloneNode());

    peerNode.id = peerId + "Container";
    peerNode.firstElementChild.id = peerId;

    document.getElementById("videos").appendChild(peerNode);

    document.getElementById(peerId).srcObject = new MediaStream();
}
