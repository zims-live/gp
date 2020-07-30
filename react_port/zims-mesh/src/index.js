import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import { Icon, IconButton, Toolbar, AppBar } from '@material-ui/core';

function TopNavbar() {
    return (
        <AppBar position='static' id='top-app-bar'>
            <Toolbar>
                <IconButton color='inherit'><Icon>perm_media</Icon></IconButton>
                <IconButton color='inherit'><Icon>assignment</Icon></IconButton>
                <IconButton color='inherit'><Icon>today</Icon></IconButton>
                <IconButton color='inherit'><Icon>description</Icon></IconButton>
                <IconButton color='inherit'><Icon>settings</Icon></IconButton>
            </Toolbar>
        </AppBar>
    );
}

class BottomNavbar extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isMute: false
        };
    }

    toggleMuteOn() {
        alert('muted' );
    }

    toggleMuteOff() {
        alert('unmuted');
    }

    toggleVideoOn() {
        alert('video on');
    }

    toggleVideoOff() {
        alert('video off');
    }

    toggleScreenShareOn() {
        alert('screen sharing');
    }

    toggleScreenShareOff() {
        alert('screen sharing off');
    }

    createRoom() {
        alert('room has been created');
    }

    render() {
        return (
            <div>
                <AppBar position='static' id='bottom-app-bar'>
                    <Toolbar>
                        <IconButton color='inherit' onClick={this.createRoom}><Icon>create</Icon></IconButton>
                        <ToggleButton toggleOn={this.toggleMuteOn} toggleOff={this.toggleMuteOff} color='inherit' toggledIcon='mic_off' regularIcon='mic' />
                        <ToggleButton toggleOn={this.toggleVideoOff} toggleOff={this.toggleVideoOn} color='inherit' toggledIcon='videocam_off' regularIcon='videocam' />
                        <ToggleButton toggleOn={this.toggleScreenShareOn} toggleOff={this.toggleScreenShareOff} color='inherit' toggledIcon='screen_share' regularIcon='stop_screen_share' />
                    </Toolbar>
                </AppBar>
            </div>
        );
    };
}

class ToggleButton extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            toggled: false
        };
    }

    handleClick() {
        this.setState((state) => ({
            toggled: !state.toggled
        }));

        if (!this.state.toggled) {
            this.props.toggleOn();
        } else {
            this.props.toggleOff();
        }
    }

    render() {
        const show = this.state.toggled ? <Icon>{this.props.toggledIcon}</Icon> : <Icon>{this.props.regularIcon}</Icon>;
        return <IconButton color={this.props.color} onClick={() => this.handleClick()}>{show}</IconButton>;
    }
}

class VideoSection extends React.Component {
    constructor(props) {
        super(props);
        this.videoSrc = React.createRef();
    }

    componentDidMount() {
        navigator.mediaDevices.getUserMedia({video: true}).then(stream => {
            this.videoSrc.current.srcObject = stream;
        });
    }

    render() {
        return( 
            <div id="videoGrid">
                <video id='localVideo' ref={this.videoSrc} autoPlay />
            </div>
        );
    }
}

function Main() {
    return (
        <div>
            <TopNavbar />
            <VideoSection />
            <BottomNavbar/>
        </div>
    );
}

ReactDOM.render(
    <Main />,
    document.getElementById('root')
);
