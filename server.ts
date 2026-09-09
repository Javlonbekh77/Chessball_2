import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';

interface Player {
  socketId: string;
  teamName: string;
  role: 'white' | 'black';
}

interface Room {
  id: string;
  players: Player[];
  whiteScore: number;
  blackScore: number;
  time: number;
  duration: number;
  started: boolean;
  readyPlayers: Set<string>;
  penaltyState?: {
    shooterChoice?: number;
    keeperChoice?: number;
    round?: number;
  };
}

const rooms = new Map<string, Room>();

function generateRoomId(): string {
  let id = '';
  do {
    id = Math.floor(10000 + Math.random() * 90000).toString();
  } while (rooms.has(id));
  return id;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Socket.io Multiplayer Game Logic
  io.on('connection', (socket) => {
    console.log(`[Socket] Foydalanuvchi ulandi: ${socket.id}`);

    // Create Room (Host = White)
    socket.on('create_room', (data: { teamName?: string }) => {
      const teamName = (data?.teamName || '').trim() || 'Oqlar';
      const roomId = generateRoomId();

      const player: Player = {
        socketId: socket.id,
        teamName,
        role: 'white',
      };

      const room: Room = {
        id: roomId,
        players: [player],
        whiteScore: 0,
        blackScore: 0,
        time: 10,
        duration: 600,
        started: false,
        readyPlayers: new Set<string>(),
      };

      rooms.set(roomId, room);
      socket.join(roomId);

      socket.emit('room_created', {
        roomId,
        role: 'white',
        teamName,
      });

      console.log(`[Xona yaratildi] #${roomId} yaratuvchi: ${teamName} (${socket.id})`);
    });

    // Join Room by Code (Guest = Black)
    socket.on('join_room', (data: { roomId: string; teamName?: string }) => {
      const code = (data?.roomId || '').trim();
      const teamName = (data?.teamName || '').trim() || 'Qoralar';

      if (!rooms.has(code)) {
        socket.emit('room_error', {
          message: `"${code}" raqamli xona topilmadi. Kodni tekshirib qayta kiriting!`,
        });
        return;
      }

      const room = rooms.get(code)!;

      if (room.players.length >= 2) {
        socket.emit('room_error', {
          message: `"${code}" xonasi allaqachon to'lgan (2 ta o'yinchi bor)!`,
        });
        return;
      }

      if (room.started) {
        socket.emit('room_error', {
          message: `"${code}" xonasida o'yin allaqachon boshlangan!`,
        });
        return;
      }

      const player: Player = {
        socketId: socket.id,
        teamName,
        role: 'black',
      };

      room.players.push(player);
      socket.join(code);

      const hostPlayer = room.players[0];

      // Notify joining player
      socket.emit('room_joined', {
        roomId: code,
        role: 'black',
        teamName,
        opponent: hostPlayer,
        time: room.time,
        duration: room.duration,
      });

      // Notify host player
      socket.to(code).emit('opponent_joined', {
        opponent: player,
      });

      // Notify both players room is ready
      io.to(code).emit('room_ready', {
        roomId: code,
        players: room.players,
        time: room.time,
        duration: room.duration,
      });

      console.log(`[Xonaga ulandi] #${code} qo'shildi: ${teamName} (${socket.id})`);
    });

    // Pre-game move (Placement before Start)
    socket.on('prep_move', (data: { roomId: string; from: [number, number]; to: [number, number] }) => {
      if (data?.roomId) {
        socket.to(data.roomId).emit('prep_move', {
          from: data.from,
          to: data.to,
        });
      }
    });

    // Timer adjustment (Sync time changes to both players)
    socket.on('timer_change', (data: { roomId: string; time: number; duration: number }) => {
      if (data?.roomId) {
        const room = rooms.get(data.roomId);
        if (room) {
          room.time = data.time;
          room.duration = data.duration;
        }
        // Send to everyone in room including sender to ensure identical state
        io.to(data.roomId).emit('timer_change', {
          time: data.time,
          duration: data.duration,
        });
      }
    });

    // Player Ready toggle/confirm
    socket.on('player_ready', (data: { roomId: string }) => {
      if (!data?.roomId) return;
      const room = rooms.get(data.roomId);
      if (!room) return;

      room.readyPlayers.add(socket.id);
      const readyCount = room.readyPlayers.size;
      const totalCount = room.players.length;

      // Broadcast ready status to room
      io.to(data.roomId).emit('ready_status', {
        readyCount,
        totalCount,
        readyPlayerId: socket.id,
      });

      // If both players are ready (2/2), start the game!
      if (readyCount >= 2) {
        room.started = true;
        io.to(data.roomId).emit('game_started');
      }
    });

    // Game Move (during active match)
    socket.on('game_move', (data: { roomId: string; from: [number, number]; to: [number, number] }) => {
      if (data?.roomId) {
        socket.to(data.roomId).emit('game_move', {
          from: data.from,
          to: data.to,
        });
      }
    });

    // Turn Timeout (15s expired)
    socket.on('turn_timeout', (data: { roomId: string }) => {
      if (data?.roomId) {
        socket.to(data.roomId).emit('turn_timeout');
      }
    });

    // Goal Scored
    socket.on('goal_scored', (data: { roomId: string; scorer: 'white' | 'black'; whiteScore: number; blackScore: number }) => {
      if (data?.roomId) {
        const room = rooms.get(data.roomId);
        if (room) {
          room.whiteScore = data.whiteScore;
          room.blackScore = data.blackScore;
        }
        socket.to(data.roomId).emit('goal_scored', {
          scorer: data.scorer,
          whiteScore: data.whiteScore,
          blackScore: data.blackScore,
        });
      }
    });

    // ===============================================
    // PENALTY SHOOTOUT SOCKET EVENTS
    // ===============================================
    socket.on('start_penalty_mode', (data: { roomId: string }) => {
      if (!data?.roomId) return;
      const room = rooms.get(data.roomId);
      if (room) {
        room.penaltyState = {
          shooterChoice: undefined,
          keeperChoice: undefined,
          round: 1,
        };
        io.to(data.roomId).emit('penalty_mode_started');
      }
    });

    socket.on('penalty_submit_choice', (data: { roomId: string; choiceType: 'shooter' | 'keeper'; choice: number }) => {
      if (!data?.roomId) return;
      const room = rooms.get(data.roomId);
      if (!room) return;
      if (!room.penaltyState) {
        room.penaltyState = {};
      }

      if (data.choiceType === 'shooter') {
        room.penaltyState.shooterChoice = data.choice;
      } else {
        room.penaltyState.keeperChoice = data.choice;
      }

      // If both players have made their secret choice (1, 2, or 3)
      if (room.penaltyState.shooterChoice !== undefined && room.penaltyState.keeperChoice !== undefined) {
        const sChoice = room.penaltyState.shooterChoice;
        const kChoice = room.penaltyState.keeperChoice;
        // Identical choice = Goalkeeper saves it! Different = Goal!
        const isGoal = sChoice !== kChoice;

        io.to(data.roomId).emit('penalty_round_result', {
          shooterChoice: sChoice,
          keeperChoice: kChoice,
          isGoal,
        });

        // Reset for next shot
        room.penaltyState.shooterChoice = undefined;
        room.penaltyState.keeperChoice = undefined;
      } else {
        // Notify opponent that the other has locked their choice
        socket.to(data.roomId).emit('penalty_opponent_locked', {
          choiceType: data.choiceType,
        });
      }
    });

    // Rematch Request
    socket.on('rematch_request', (data: { roomId: string }) => {
      if (data?.roomId) {
        const room = rooms.get(data.roomId);
        if (room) {
          room.whiteScore = 0;
          room.blackScore = 0;
          room.started = false;
          room.readyPlayers.clear();
          room.penaltyState = undefined;
        }
        io.to(data.roomId).emit('rematch_started');
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`[Socket] Foydalanuvchi uzildi: ${socket.id}`);

      // Check all rooms
      for (const [roomId, room] of rooms.entries()) {
        const playerIndex = room.players.findIndex((p) => p.socketId === socket.id);
        if (playerIndex !== -1) {
          const departingPlayer = room.players[playerIndex];
          socket.to(roomId).emit('opponent_disconnected', {
            teamName: departingPlayer.teamName,
            role: departingPlayer.role,
          });
          rooms.delete(roomId);
          break;
        }
      }
    });
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', activeRooms: rooms.size });
  });

  // Vite middleware in dev, static files in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`ChessBall Multiplayer server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
