const express = require('express');
const path = require('path');
const socketio = require('socket.io');
const Filter = require('bad-words');
const { generateMessage, generateLocationMessage } = require('./utils/messages');
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const app = express();
const PORT = process.env.PORT || 3000;

// Define path for Express config
const publicDirPath = path.join(__dirname, '../public');
// Use express middlewar to serve public content
app.use(express.static(publicDirPath));


/**
 * Console which port server is listening to
 */
const server = app.listen(PORT, () => {
    console.log(`Server is up and running on port ${PORT}`);
});

// const server = http.createServer(app);
socketio.listen(server);

// Setup Socket.io with raw HTTP server
const io = socketio(server);


let count = 0;

// Set up some message when socket.io gets 'connectoion' event
io.on('connection', (socket) => {
    console.log('New websocket connection');

    socket.on('join', ({username, room}, callback) => {
        const { error, user } = addUser({ id: socket.id, username, room })

        if (error) {
            return callback(error)
        }

        socket.join(user.room);

        socket.emit('message', generateMessage('Admin', 'Welcome!'));
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined!`));
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
    });

    socket.on('sendMessage', (message, callback) => {

        const filter = new Filter();
        if (filter.isProfane(message)) {
            return callback('Profanity is not allowed!')
        }

        const user = getUser(socket.id);

        io.to(user.room).emit('message', generateMessage(user.username, message));
        callback();
    });

    socket.on('sendLocation', (coords, callback) => {

        const user = getUser(socket.id);

        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`));
        callback();
    });

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left!`));
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    });
});
