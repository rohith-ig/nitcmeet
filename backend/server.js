const { Server } = require("socket.io");
const { createServer } = require('node:http');
const express = require('express')
const app = express()
const cors = require('cors');
app.use(cors())
app.use(express.json())
const server = createServer(app);
const {Client} = require('pg')


app.get('/', (req, res) => {
    res.send('<h1>Hello world</h1>');
});

app.post('/users',(req,res) => {
    const {email,name,password} = req.body;
    if (!email || !name || !password) {
        console.log(req);
        return res.status(400).send({error:"Data missing"});
    }
    
})

server.listen(6900, () => {
    console.log('server running at http://localhost:6900');
});

const io = new Server(server,{
  cors: {
    origin: '*'
  }
})

const activeClients = new Set()
const matchedClients = new Set()

io.on('connection',(socket) => {
    console.log("connected",socket.id);
    socket.on("call",() => {
        activeClients.add(socket.id);
        console.log(activeClients);
        console.log(matchedClients);
        let candidates = Array.from(activeClients);
        candidates = candidates.filter(id => id != socket.id);
        if (candidates.length == 0) return io.to(socket.id).emit("return",null);
        const candidate = candidates[Math.floor(Math.random()*candidates.length)]
        if (candidate.id in matchedClients) return io.to(socket.id).emit("return",null);
        io.to(socket.id).emit("return",{peerId:candidate});
        matchedClients.add(candidate);
        matchedClients.add(socket.id);
        activeClients.delete(candidate);
        activeClients.delete(socket.id);
        console.log("Matched",activeClients)
    });
    socket.on('disconnect',() => {
        activeClients.delete(socket.id);
        matchedClients.delete(socket.id);
    });
    socket.on('offer',(payload) => {
        io.to(payload.peerId).emit('offer',{offer : payload.offer,sender : socket.id});
    });
    socket.on('candidate',(payload) => {
        io.to(payload.peerId).emit('candidate',{...payload,sender : socket.id});
    });
    socket.on('answer',(payload) => {
        io.to(payload.peerId).emit('answer',{...payload,sender : socket.id});
    });
    socket.on('dc',({target}) => {
        matchedClients.delete(socket.id);
        matchedClients.delete(target)
        io.to(target).emit("dc");
    });
    socket.on('rm',() => {
        activeClients.delete(socket.id);
    });
});

