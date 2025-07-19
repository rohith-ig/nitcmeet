"use client"
import React, { useState, useRef, useEffect } from 'react';
import { Video, VideoOff, Phone, PhoneOff, SkipForward, Send, Mic, MicOff } from 'lucide-react';
import { io } from "socket.io-client"

export default function VideoChat() {
    const socketRef = useRef(null);
    const pcRef = useRef(null);
    const [state,setState] = useState('Fresh');
    const peerId = useRef(null);
    const dataChannel = useRef(null);
    const [text,changeText] = useState("");
    const [sendText,changeSend] = useState("")
    const [useCam,cam] = useState(false);
    const remote = useRef(null)
    const videosend = useRef(null);
    const [hasRemote,setRem] = useState(false);
    const [wait,setWait] = useState(false);
    const cleanup = () => {
        if (peerId.current) peerId.current = null;
        if (dataChannel.current) dataChannel.current.close();
        dataChannel.current = null;
        if (pcRef.current) pcRef.current.close();
        pcRef.current = null;
        remote.current.srcObject = null;
        setRem(false);
        setIsConnected(false);
    }
    const initialisePc = () => {
      const servers = {
        iceServers: [
          {
            urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
          },
        ],
        iceCandidatePoolSize: 10,
      };
      pcRef.current = new RTCPeerConnection(servers);
      dataChannel.current = pcRef.current.createDataChannel("chat",{id:0,negotiated:true});
      pcRef.current.onicecandidate = (e) => {
        console.log(e.candidate)
        if (e.candidate && peerId.current) {
          socketRef.current.emit('candidate',{peerId : peerId.current, candidate : e.candidate});
        }
      };
      pcRef.current.onconnectionstatechange = () => {
        setState(pcRef.current.connectionState);
        console.log(pcRef.current.connectionState);
        if (pcRef.current.connectionState == "connected") {
            setWait(false);
            setIsConnected(true);
            setMessages((msg) => (
              [...msg,{id : (msg.length > 0?msg[msg.length-1].id + 1:1),text:"Connected succesfully",type:false,timestamp: new Date()}]
            ));
        };
        if (pcRef.current.connectionState == "disconnected") {
            cleanup();
            initialisePc();
            setMessages((msg) => (
              [...msg,{id : (msg.length > 0?msg[msg.length-1].id + 1:1),text:"Stranger Disconnected",type:false,timestamp: new Date()}]
            ));
            socketRef.current.emit("add-back");
        }
      };
      pcRef.current.ondatachannel = ((e) => { 
        console.log("got it",e.channel);
        dataChannel.current = e.channel;
      });
      dataChannel.current.onopen = () => console.log("Datachannel open");
      dataChannel.current.onmessage = (msg) => {
      setMessages((msgs) => [
          ...msgs,
          {
              type :true,
              id: msgs.length > 0 ? msgs[msgs.length - 1].id + 1 : 1,
              sender: "other",
              text: msg.data,
              timestamp: new Date(Date.now())
          }
      ]);
        };
     pcRef.current.ontrack = (e) => {
        console.log("🟢 ontrack fired!");
        console.log(e.track.onended)
        e.track.onended =() => {
            console.log("track end");
            setRem(false);
            if (remote.current.srcObject) remote.current.srcObject = null;
        }
        if (e.track.kind === "video") {
            setRem(true); 
            const stream = new MediaStream();
            stream.addTrack(e.track);
            remote.current.srcObject = stream;
            e.track.onended = () => {
            console.log("Remote video track ended");
            setRem(false); // Hide remote video
            remote.current.srcObject = null;
            };
        }
        };

      pcRef.current.onnegotiationneeded = async () => {
        console.log("harm")
        if (!peerId.current) return
        try {
            const offer = await pcRef.current.createOffer();
            await pcRef.current.setLocalDescription(offer);
            socketRef.current.emit('offer',{offer:pcRef.current.localDescription ,peerId:peerId.current});
          }
          catch (e) {
            console.log(e);
          }
      }
    }
    const [width,setWidth] = useState(null)
    useEffect(() => {
      socketRef.current = io("https://nitcmeet.onrender.com/");
      initialisePc();
      if (typeof window !== 'undefined') {
        setWidth(window.innerWidth);
      }
      const socket = socketRef.current;
      socket.on('connect', () => {
        console.log('Connected with ID:', socket.id)
      });
      socket.on('return',async (obj) => {
        if (obj != null) {
          try {
            peerId.current = obj.peerId;
            const offer = await pcRef.current.createOffer();
            await pcRef.current.setLocalDescription(offer);
            socket.emit('offer',{offer:pcRef.current.localDescription ,peerId:peerId.current});
          }
          catch (e) {
            console.log(e);
          }
        }
        else {
          console.log("waiting");
          setWait(true);
        }
      });
      socket.on('offer',async (payload) => {
        try {
          peerId.current = payload.sender;
          console.log(`You have an offer from ${payload.sender} and offer is ${payload.offer}`);
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.offer));
          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);
          socketRef.current.emit("answer",{peerId:peerId.current,answer:pcRef.current.localDescription});
          console.log("Emitted answer to ",peerId.current);
        }
        catch (e) {
          console.log(e);
        }
      });
      socket.on('answer',async (payload) => {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
          console.log("Answer set")
        }
        catch (e) {
          console.log(e);
        }
      })
      socket.on('candidate',async (payload) => {
        try {
          await pcRef.current.addIceCandidate(payload.candidate);
          console.log("candidate from",payload.sender);
        }
        catch (e) {
          console.log(e);
        }
      });
      socket.on('dc',() => {
        setMessages((msg) => (
              [...msg,{id : (msg.length > 0?msg[msg.length-1].id + 1:1),text:"Stranger Disconnected",type:false,timestamp: new Date()}]
        ));
        cleanup();
        initialisePc();
      }); 
    },[]);
    const roomId = useRef(null);
    const handleBut = () => {
      if (wait) {
        setWait(false);
        socketRef.current.emit("rm");
        return
      }
      if (isConnected) {
        socketRef.current.emit("dc",{target:peerId.current});
        setMessages((msg) => (
              [...msg,{id : (msg.length > 0?msg[msg.length-1].id + 1:1),text:"You Disconnected",type:false,timestamp: new Date()}]
        ));
        cleanup();
        initialisePc();
        return;
      }
      socketRef.current.emit('call');
    };
    const handleSend = () => {
      dataChannel.current.send(sendText);
      changeText((e) => e + '\nMe : '+  sendText)
      changeSend("");
    }
    const videRef = useRef(null);
    const handleCam = async () => {
      try {
        if (videRef.current?.srcObject) {
          console.log("Stopping cam")
          return stopCam()
        }
        videRef.current.srcObject = await navigator.mediaDevices.getUserMedia({video:true,audio:true});
        const stream = videRef.current.srcObject
        cam(true);
        setIsCameraOn(true);
        stream.getTracks().forEach(track => {
          console.log("adding",track)
          pcRef.current.addTrack(track,stream);
        })
      }
      catch(e) {
        alert(e)
      }
    };
    const stopCam = async () => {
      setIsCameraOn(false);
      const stream = videRef.current.srcObject
      stream.getTracks().forEach(track => track.stop());
      videRef.current.srcObject = null;
      cam(false);
    }
  const [isConnected, setIsConnected] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [messages, setMessages] = useState([
    { id: 3, text: 'Welcome to NITC Meet', timestamp: new Date(Date.now()), type:false }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSkip = () => {
    const skipMessage = {
      id: Date.now(),
      sender: 'system',
      text: 'Looking for next person...',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, skipMessage]);
    setIsConnected(false);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      const message = {
        id: Date.now(),
        sender: 'me',
        text: newMessage,
        timestamp: new Date(),
        type : true
      };
      setMessages(prev => [...prev, message]);
      if (dataChannel.current.readyState == "open") {
        dataChannel.current.send(newMessage);
      }
      setNewMessage('');
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-[72vh] md:h-[92.5vh] bg-gray-900 text-white">
      <div className="flex h-[72vh] md:h-[90vh] max-h-screen">
        <div className="flex-1 flex flex-col p-2 md:p-4 space-y-2 md:space-y-4 min-w-0">
          <div className="flex-1 relative bg-gray-800 rounded-2xl overflow-hidden shadow-2xl min-h-0">
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900">
              {isConnected ? (
                <>
                 <video
                    ref={remote}
                    autoPlay
                    playsInline
                    className={`h-full w-full object-cover z-10 transform scale-x-[-1] ${hasRemote ? '' : 'hidden'}`}
                    />
                <div className="text-center">
                 {!hasRemote &&
                  (<><div className={"w-20 h-20 md:w-32 md:h-32 bg-blue-600 rounded-full flex items-center justify-center mb-4 mx-auto"}>
                    <Video className={"text-white"}  />
                  </div>
                  <p className={"text-lg md:text-xl font-medium"}>Connected User</p>
                  <p className={"text-gray-300 text-sm md:text-base"}>Camera Off</p></>)}
                </div>
                </>
              ) : (
                <div className="text-center">
                    <video ref={remote} className='hidden h-screen w-screen'></video>
                  <div className="w-20 h-20 md:w-32 md:h-32 bg-gray-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <VideoOff size={width < 768 ? 32 : 48} className="text-gray-400"/>
                  </div>
                  <p className="text-lg md:text-xl font-medium text-gray-400">No Connection</p>
                  <p className="text-gray-500 text-sm md:text-base">Press connect to start</p>
                </div>
              )}
            </div>
            <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4 w-20 h-16 md:w-32 md:h-24 bg-gray-700 rounded-lg border-2 border-gray-600 overflow-hidden shadow-lg z-100">
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-800 to-blue-800">
                {isCameraOn ? (
                  <div className="text-center">
                    <video className='h-[100%] w-[100%] object-cover transform scale-x-[-1]' autoPlay muted ref={videRef}></video>
                  </div>
                ) : (
                  <div className="text-center">
                    <video className='hidden' ref={videRef} autoPlay></video>
                    <VideoOff size={width < 768 ? 12 : 20} className="text-gray-400 mx-auto mb-1" />
                    <p className="text-xs text-gray-400 hidden md:block">Off</p>
                  </div>
                )}
              </div>
            </div>
            {isConnected && (
              <div className="absolute top-2 left-2 md:top-4 md:left-4 bg-green-600 text-white px-2 py-1 md:px-3 md:py-1 rounded-full text-xs md:text-sm font-medium">
                Connected
              </div>
            )}
          </div>
          <div className="flex justify-center space-x-2 md:space-x-4 px-2">
            <button
              onClick={handleBut}
              className={`flex items-center space-x-1 md:space-x-2 px-3 py-2 md:px-6 md:py-3 rounded-full font-medium transition-all duration-200 text-sm md:text-base ${
                isConnected 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isConnected ? <PhoneOff size={16} /> : <Phone size={16} />}
              <span className="hidden sm:inline">{isConnected ? 'Disconnect' : (wait?"Waiting":'Connect')}</span>
            </button>
            <button
              onClick={handleCam}
              className={`flex items-center space-x-1 md:space-x-2 px-3 py-2 md:px-6 md:py-3 rounded-full font-medium transition-all duration-200 text-sm md:text-base ${
                isCameraOn 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-gray-600 hover:bg-gray-700 text-white'
              }`}
            >
              {isCameraOn ? <Video size={16} /> : <VideoOff size={16} />}
              <span className="hidden sm:inline">Camera</span>
            </button>
            <button
              onClick={handleSkip}
              className="flex items-center space-x-1 md:space-x-2 px-3 py-2 md:px-6 md:py-3 rounded-full font-medium bg-orange-600 hover:bg-orange-700 text-white transition-all duration-200 text-sm md:text-base"
            >
              <SkipForward size={16} />
              <span className="hidden sm:inline">Skip</span>
            </button>
          </div>
        </div>

        <div className="w-64 md:w-100 bg-gray-800 flex-col hidden md:flex">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold">Chat</h2>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((message) => (
              message.type?
              (<div
                key={message.id}
                className={`flex ${
                  message.sender === 'me' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg ${
                    message.sender === 'me'
                      ? 'bg-blue-600 text-white'
                      : message.sender === 'system'
                      ? 'bg-gray-600 text-gray-300 text-center'
                      : 'bg-gray-700 text-white'
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>)
              :<div key={message.id} className="w-full flex items-center justify-between text-gray-500 text-sm px-2 py-1 border-2 rounded-xl">
                <div className="tracking-wide text-gray-50">{message.text}</div>
                <div className="text-xs ">{formatTime(message.timestamp)}</div>
               </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-4 border-t border-gray-700">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(e)}
              />
              <button
                onClick={handleSendMessage}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Chat Overlay */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 max-h-60 flex flex-col">
        <div className="p-3 border-b border-gray-700">
          <h3 className="text-sm font-semibold">Chat</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.slice(-3).map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender === 'me' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-xs px-2 py-1 rounded-lg text-xs ${
                  message.sender === 'me'
                    ? 'bg-blue-600 text-white'
                    : message.sender === 'system'
                    ? 'bg-gray-600 text-gray-300 text-center'
                    : 'bg-gray-700 text-white'
                }`}
              >
                <p>{message.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile Message Input */}
        <div className="p-3 border-t border-gray-700">
          <div className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-2 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 text-sm"
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(e)}
            />
            <button
              onClick={handleSendMessage}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200 max-w-full"
            >
              <Send size={16}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}