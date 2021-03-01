// Setup basic express server
const express = require('express');
const app = express();
const path = require('path');
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = process.env.PORT || 3000;
const fs = require('fs');

server.listen(port, () => {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));

// Chatroom

let numUsers = 0;
let time = 5.;

io.on('connection', (socket) => {
  let addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', (data) => {
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });

  // when the client emits 'new prompt', this listens and executes
  socket.on('new prompt', (data) => {
    // we tell the client to execute 'new prompt'
    console.log(`received new prompt ${data.message} from ${data.username}.`);
    socket.broadcast.emit('new prompt', {
      username: data.username,
      message: data.message
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', (username) => {
    if (addedUser) return;

    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', () => {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', () => {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the client emits 'user ready', we broadcast it to others
  socket.on('user ready', () => {
    socket.broadcast.emit('user ready', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'start timer', we broadcast it to others
  socket.on('start timer', (time) => {
    console.log('received start timer' + time);
    socket.broadcast.emit('start timer', /* data */{
      username: socket.username,
      time: time // min
    });
  });

  // when the client emits 'stop timer', we broadcast it to others
  socket.on('stop timer', () => {
    socket.broadcast.emit('stop timer', {
      username: socket.username
    });
  });

  // when the client emits 'start break timer', we broadcast it to others
  socket.on('start break timer', (time) => {
    console.log('received start break timer' + time);
    socket.broadcast.emit('start break timer', /* data */{
      username: socket.username,
      time: time // min
    });
  });

  // when the client emits 'stop break timer', we broadcast it to others
  socket.on('stop break timer', () => {
    console.log('break time stop');
    socket.broadcast.emit('stop break timer', {
      username: socket.username
    });
  });

  socket.on('enable timer button', () => {
    socket.broadcast.emit('enable timer button', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', () => {
    if (addedUser) {
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });

  //serving files
  socket.on('base64 file', function (msg) {
    console.log('received base64 file from' + socket.username);
    io.sockets.emit('base64 file',  /*include sender*/ {
      username: socket.username,
      file: msg.file,
      fileName: msg.fileName
    }
    );
  });
});
