var name, connectedUser;
var connection = new WebSocket("ws://localhost:8888");

connection.onopen = function() {
  console.log("Connected");
};

//Handle all message through this Callback
connection.onmessage = function(message) {
  console.log("Got message: ", message.data);

  try {
    data = JSON.parse(message.data);
  } catch (e) {
    console.log("Error parsing JSON");
    data = {};
  }
  switch (data.type) {
    case "login":
      onLogin(data.success);
      break;
    case "offer":
      onOffer(data.offer, data.name);
      break;
    case "answer":
      onAnswer(data.answer);
      break;
    case "candidate":
      onCandidate(data.candidate);
      break;
    case "leave":
      onLeave();
      break;
    default:
      break;
  }
};

connection.onerror = function(err) {
  console.log("Got error ", err);
};

// Alias for sending messages in JSON format
function send(message) {
  if (connectedUser) {
    message.name = connectedUser;
  }

  connection.send(JSON.stringify(message));
}

// ---------------
var loginPage = document.querySelector("#login-page"),
  usernameInput = document.querySelector("#username"),
  loginButton = document.querySelector("#login"),
  callPage = document.querySelector("#call-page"),
  theirUsernameInput = document.querySelector("#their-username"),
  callButton = document.querySelector("#call"),
  hangUpButton = document.querySelector("#hang-up"),
  received = document.querySelector("#received"),
  sendButton = document.querySelector("#send"),
  messageInput = document.querySelector("#message");

callPage.style.display = "none";

// Login when the user click the button
loginButton.addEventListener("click", function(event) {
  name = usernameInput.value;

  if (name.length > 0) {
    send({
      type: "login",
      name: name
    });
  }
});

function onLogin(success) {
  if (success === false) {
    alert("Login unsuccessful, please try a different name.");
  } else {
    loginPage.style.display = "none";
    callPage.style.display = "block";

    //  Get the plumbingh ready for a call
    startConnection();
  }
}

// webrtc setup
var yourVideo = document.querySelector("#yours"),
  theirVideo = document.querySelector("#theirs"),
  yourConnection,
  stream;

function startConnection() {
  if (hasUserMedia()) {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then(function(myStream) {
        stream = myStream;
        try {
          yourVideo.srcObject = stream;
        } catch (error) {
          yourVideo.src = window.URL.createObjectURL(stream);
        }

        if (hasRTCPeerConnection()) {
          setupPeerConnection(stream);
        } else {
          alert("Sorry, your browser doesn't support WebRTC");
        }
      })
      .catch(function(err) {
        console.log("No devices found, ", err);
      });
  } else {
    alert("Sorry, your browser doesn't support WebRTC");
  }
}

function setupPeerConnection(stream) {
  var configuration = {
    iceServers: [{ urls: "stun:stun.1.google.com:19302" }]
  };
  yourConnection = new RTCPeerConnection(configuration);
  openDataChannel();

  // Setup stream listening
  yourConnection.addStream(stream);
  yourConnection.ontrack = function(e) {
    try {
      theirVideo.srcObject = e.streams[0];
    } catch (error) {
      theirVideo.src = window.URL.createObjectURL(e.stream);
    }
  };

  // Setup ice handling
  yourConnection.onicecandidate = function(event) {
    if (event.candidate) {
      send({
        type: "candidate",
        candidate: event.candidate
      });
    }
  };
}

function hasUserMedia() {
  return !!navigator.mediaDevices.getUserMedia;
}

function hasRTCPeerConnection() {
  window.RTCPeerConnection =
    window.RTCPeerConnection ||
    // window.webkitRTCPeerConnection ||
    window.mozRTCPeerConnection;

  window.RTCSessionDescription =
    window.RTCSessionDescription ||
    // window.webkitRTCSessionDescription ||
    window.mozRTCSessionDescription;

  window.RTCIceCandidate =
    window.RTCIceCandidate ||
    // window.webkitRTCIceCandidate ||
    window.mozRTCIceCandidate;

  return !!window.RTCPeerConnection;
}

// Initiating a call
callButton.addEventListener("click", function() {
  var theirUsername = theirUsernameInput.value;

  if (theirUsername.length > 0) {
    startPeerConnection(theirUsername);
  }
});

function startPeerConnection(user) {
  connectedUser = user;

  // Begin the offer
  yourConnection.createOffer(
    function(offer) {
      send({
        type: "offer",
        offer: offer
      });
      yourConnection.setLocalDescription(offer);
    },
    function(error) {
      alert("An error has occured, ", error);
    }
  );
}

function onOffer(offer, name) {
  connectedUser = name;
  yourConnection.setRemoteDescription(new RTCSessionDescription(offer));

  yourConnection.createAnswer(
    function(answer) {
      yourConnection.setLocalDescription(answer);
      send({
        type: "answer",
        answer: answer
      });
    },
    function(error) {
      alert("An error has occured, ", error);
    }
  );
}

function onAnswer(answer) {
  yourConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

function onCandidate(candidate) {
  yourConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

// Hanging up a call
hangUpButton.addEventListener("click", function() {
  send({
    type: "leave"
  });
  onLeave();
});

function onLeave() {
  connectedUser = null;
  theirVideo.src = null;
  yourConnection.close();
  yourConnection.onicecandidate = null;
  yourConnection.ontrack = null;
  setupPeerConnection(stream);
}

// DataChannel
function openDataChannel() {
  var dataChannelOptions = {
    reliable: true,
    optional: [{ RtpDataChannels: true }]
  };

  dataChannel = yourConnection.createDataChannel("myLabel");

  dataChannel.onerror = function(error) {
    console.log("Data channel Error: ", error);
  };
  dataChannel.onmessage = function(event) {
    console.log("Got Data Channel Message: ", event.data);

    received.innerHTML += "recv: " + event.data + "<br />";
    received.scrollTop = received.scrollHeight;
  };
  dataChannel.onopen = function() {
    dataChannel.send(name + " has connected.");
  };
  dataChannel.onClose = function() {
    console.log("The Data Channel is Closed");
  };
}

// Bind our text input and received area
sendButton.addEventListener("click", function(event) {
  var val = messageInput.value;
  received.innerHTML += "send: " + val + "<br />";
  received.scrollTop = received.scrollHeight;
  dataChannel.send(val);
});
