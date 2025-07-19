  "use client"
  import React from 'react'
  import { io } from "socket.io-client"
  import { useEffect,useState,useRef } from 'react'


  const Page = () => {
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
        console.log(pcRef.current.connectionState,"hhhh");
      };
      pcRef.current.ondatachannel = ((e) => { //for remote 
        console.log("got it",e.channel);
        dataChannel.current = e.channel;
      });
      dataChannel.current.onopen = () => console.log("Datachannel open");
      dataChannel.current.onmessage = (msg) => {
        console.log(msg);
        changeText((e) => (e + '\nStranger :' + msg.data));
      }
     pcRef.current.ontrack = (e) => {
  console.log("🟢 ontrack fired!");
  console.log("Track kind:", e.track.kind); // should be video
  console.log("Track readyState:", e.track.readyState); // should be live
  console.log("remote ref:", remote.current);
  
  const stream = new MediaStream();
  stream.addTrack(e.track);
  remote.current.srcObject = stream;
  console.log("Assigned srcObject:", remote.current.srcObject);
  console.log("Tracks in srcObject:", remote.current.srcObject.getTracks());
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
    useEffect(() => {
      socketRef.current = io("http://localhost:6900");
      initialisePc();
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
      })
    },[]);
    const roomId = useRef(null);
    const handleBut = () => {
      setState("Waiting");
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
        if (videRef.current.srcObject) {
          return stopCam()
        }
        videRef.current.srcObject = await navigator.mediaDevices.getUserMedia({video:true,audio:true});
        const stream = videRef.current.srcObject
        cam(true);
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
      const stream = videRef.current.srcObject
      stream.getTracks().forEach(track => track.stop());
      videRef.current.srcObject = null;
      cam(false);
    }
    return (
      <div className='h-[100vh] w-[100vw] flex justify-center items-center flex-col gap-10'>
        <div className='h-[35vh] w-[50vw] flex justify-around items-center'>
          <div className='border-2 w-[22vw] h-[30vh] rounded-xl p-0'>
            <video className={`h-full w-full -xl m-0 object-cover rounded-xl ${useCam?"":"hidden"}`} autoPlay muted playsInline ref={videRef}></video>
            <div className={`h-full w-full ${useCam?"hidden":""}`}>No video found</div>
          </div>
          <div className='border-2 w-[22vw] h-[30vh]'>
            <video className='h-full w-full object-cover'ref={remote} autoPlay></video>
          </div>
        </div>
        <div className='border-2 w-[30vw] flex justify-around h-[6vh] items-center'>
          <input value = {sendText} onChange={(msg) => changeSend(msg.target.value)} className='border-2 rounded border-red-500'></input>
          <button className='border-2 rounded-xl h-[5vh] w-[5vw] hover:bg-black hover:text-white transition duration-200' onClick={handleSend}>Send</button>
          <button className='border-2 rounded-xl h-[5vh] w-[5vw] hover:bg-black hover:text-white transition duration-200' onClick={handleBut} disabled={peerId.current}>Call</button>
          <button className='border-2 rounded-xl h-[5vh] w-[5vw]' onClick={handleCam}>Camera On</button>
        </div>
        <div className='border-2 border-black w-[50vw] h-[20vh]'><pre>{text}</pre></div>
        <div>{state}</div>
      </div>
    )
  }

  export default Page