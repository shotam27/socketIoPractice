const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json()); 

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:8080', // Replace with the actual origin of your Vue.js app
    methods: ['GET', 'POST'],
    allowedHeaders: ['my-custom-header'],
    credentials: true,
  }
});

const port = 3000;

// Connect to SQLite database
const db = new sqlite3.Database('your_database_name.db');

// Define a route to retrieve data from the database
app.get('/players/:id', (req, res) => {
  const playerId = req.params.id
  db.all('SELECT * FROM players WHERE id = ?',[playerId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ players: rows });
  });
});

app.get('/units/:id', (req, res) => {
  const playerId = req.params.id
  db.all('SELECT * FROM units WHERE pid = ?',[playerId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ units: rows });
  });
});

function getRoomInfoAsync(rId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM rooms WHERE id = ?', [rId], (err, roomInfo) => {
      if (err) reject(err);
      else resolve(roomInfo);
    });
  });
}

app.put('/sendCommand', async (data) => {
  try {
    const { rId, myId, playing } = data;

    // Get room information from the database
    const roomInfo = await getRoomInfoAsync(rId);
    const isHost = roomInfo.hostPid === myId;
    const opId = isHost ? roomInfo.guestPid : roomInfo.hostPid;

    // Prepare database update promises
    const updates = [];
    const updateStatus = isHost ? 'hostStatus' : 'guestStatus';
    const updateTryingToPlay = isHost ? 'hostTryingToPlay' : 'guestTryingToPlay';

    updates.push(
      updateRoomStatusAndTryingToPlay(rId, updateStatus, updateTryingToPlay, playing)
    );

    // Emit 'isOpReady' event to the opponent
    io.to(opId).emit('isOpReady', { isOpReady: true });
    console.log(`${myId} sent isOpReady to ${opId}`);

    // Execute all database update promises
    await Promise.all(updates);

    // Send success response
    console.log('更新が正常に完了しました');
  } catch (err) {
    // Handle errors
    console.error(err.message);
    // Send error response
    console.log('内部サーバーエラー');
  }
});

app.put('/isReady', async (req, res) => {
  try {
    const rId = parseInt(req.body.rId, 10);
    // Get room information from the database
    const roomInfo = await getRoomInfo(rId);
    const myId = roomInfo.hostPid;
    const myPlaying = roomInfo.hostTryingToPlay;
    const opId = roomInfo.guestPid;
    const opPlaying = roomInfo.guestTryingToPlay;
    // Prepare database update promises
    const updates = [];

    updateRoomStatus(rId, 'selecting')

    await Promise.all(updates);

    // Send success response
    res.status(200).send('更新が正常に完了しました');
  } catch (err) {
    // Handle errors
    console.error(err.message);
    res.status(500).send('内部サーバーエラー');
  }
});


// Helper function to get room information from the database
async function getRoomInfo(rId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM rooms WHERE id = ?', [rId], (err, roomInfo) => {
      if (err) reject(err);
      else resolve(roomInfo);
    });
  });
}

// Helper function to get room information from the database
async function getUnitsInfoByPid(pId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM units WHERE pId = ?', [pId], (err, uInfo) => {
      if (err) reject(err);
      else resolve(uInfo);
    });
  });
}

// Helper function to get room information from the database
async function getPlayerInfo(pId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM units WHERE pId = ?', [pId], (err, pInfo) => {
      if (err) reject(err);
      else resolve(pInfo);
    });
  });
}

// Helper function to get room information from the database
async function getRoomInfo(rId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM rooms WHERE id = ?', [rId], (err, roomInfo) => {
      if (err) reject(err);
      else resolve(roomInfo);
    });
  });
}

// Helper function to update 'playing' for a player
async function switchingUnit(playerId, playingValue) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE players SET playing = ? WHERE id = ?', [playingValue, playerId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}


// Helper function to update room status
async function updateRoomStatus(rId, statusValue) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE rooms SET hostStatus = ?, guestStatus = ? WHERE id = ?', [statusValue, statusValue, rId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Helper function to update room status and 'TryingToPlay' for a player
async function updateRoomStatusAndTryingToPlay(rId, updateStatus, updateTryingToPlay, playingValue) {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE rooms SET ${updateStatus} = "selected", ${updateTryingToPlay} = ? WHERE id = ?`;
    db.run(sql, [playingValue, rId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  // Receive user ID when the client connects
  socket.on('joinAs', (pId) => {
    // Join a room named after the user ID
    socket.join(pId);
    console.log(`User${pId} joined`);

    // Send a welcome message to the connected user
    io.to(pId).emit('message',`hello User${pId}`);
  });

  // Handle disconnect event
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start the server
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});