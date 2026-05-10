import express from "express";
import http from "http";
import Player from './Player.ts';
import { WebSocketServer, WebSocket } from "ws";
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import Lobby from './Lobby.ts';
import { redis } from '../lib/redis.ts';

const app = express();
const server = http.createServer(app);

const handSize = 7;

const wss = new WebSocketServer({ server });
const pool = new Pool({
    connectionString: 'postgresql://dom:5467@localhost:5432/dards'
});

let connectionCount = 0;
const websockets: Map<string, WebSocket> = new Map<string, WebSocket>();

const cardSuits = [ 'C', 'D', 'H', 'S' ];
const cardValues = [ 'A', '2', '3', '4', '5', '6', '7', '8', '9', 'T' ];
const deck: string[] = [];
for(const suit of cardSuits)
    for(const value of cardValues)
        deck.push(`${value}${suit}`);

await redis.flushall();

const lobbyCount = 10;

app.get("/", (_, res) => {
    res.json({ message: "server running" });
});

const sendLobbyPlayerCounts = async(ws: WebSocket) => {

    const lobbyKeys = Array.from({ length: lobbyCount }, (_, i) => `lobby:${i+1}`);
    const lobbyRequests = await redis.mget(lobbyKeys);

    const counts = [];
    for(const lobbyRequest of lobbyRequests) {
        if(lobbyRequest) {
            const lobby = JSON.parse(lobbyRequest) as Lobby;
            counts.push(lobby.players.length);
        }
        else {
            counts.push(0);
        }
    }

    ws.send(JSON.stringify({
        type: 'lobby_player_counts',
        counts: counts
    }));
        
}

const getLobby = async (lobbyKey: string) => {
    const lobbyRequest = await redis.get(lobbyKey);
    if(lobbyRequest) return JSON.parse(lobbyRequest) as Lobby;
    else return null;
}

const getPlayerLobby = async (uuid: string) => {
    const playerLobbyRequest = await redis.get(`user:${uuid}:lobby`);
    if(playerLobbyRequest) {
        const lobby = await getLobby(playerLobbyRequest);
        return lobby;
    }
    else return null;
}

const addCard = async (card: string, uuid: string) => {
    const lobby = await getPlayerLobby(uuid); 
    const ws = websockets.get(uuid);

    if(lobby && ws) {
        const player = lobby.players.filter((p: Player) => p.uuid === uuid)[0];
        if(player) {
            player.hand.push(card);
            await redis.set(`lobby:${lobby.number}`, JSON.stringify(lobby));

            ws.send(JSON.stringify({
                type: 'add_card',
                card: card
            }));
        }
    }
}

const dealCard = async (uuid: string) => {
    const lobby = await getPlayerLobby(uuid); 
    const ws = websockets.get(uuid);

    if(lobby && ws) {
        const index = Math.floor(Math.random() * lobby.deck.length);
        const card = lobby.deck[index];
        const player = lobby.players.filter((p: Player) => p.uuid === uuid)[0];
        if(player) {
            player.hand.push(card);
            lobby.deck.splice(index, 1);

            if(lobby.game === 'crazy_eights' && lobby.deck.length < 1)
                lobby.deck = [...deck];

            await redis.set(`lobby:${lobby.number}`, JSON.stringify(lobby));

            ws.send(JSON.stringify({
                type: 'add_card',
                card: card
            }));
        }
    }
}

const dealHand = async (uuid: string, handSize: number) => {
    for(let i = 0; i < handSize; i++)
        await dealCard(uuid);
}

const clearHand = async (uuid: string) => {
    const lobby = await getPlayerLobby(uuid);
    if(lobby) {
        const player = lobby.players.filter((p: Player) => p.uuid === uuid)[0];
        if(player) {
            for(const card of player.hand) {
                removeCard(card, uuid);
            }
        }
    }
}

const dealHandToLobby = async (lobbyNumber: number, handSize: number) => {
    const lobby = await getLobby(`lobby:${lobbyNumber}`);
    if(lobby) {
        const players: Player[] = lobby.players;
        for(const player of players)
            await dealHand(player.uuid, handSize);
    }
}

const removeCard = async (card: string, uuid: string) => {
    const lobby = await getPlayerLobby(uuid);
    if(lobby) {
        const ws = websockets.get(uuid);
        const player = lobby.players.filter((p: Player) => p.uuid === uuid)[0];
        if(ws && player) {
            ws.send(JSON.stringify({
                type: 'remove_card',
                card: card
            }));
            player.hand = player.hand.filter(c => c !== card);
            await redis.set(`lobby:${lobby.number}`, JSON.stringify(lobby));
        }
    }
}

const canPlayCard = async (card: string, player: Player, lobby: Lobby) => {
    const hasCard = player.hand.filter(c => c === card).length > 0;
    const theirTurn = player.uuid === lobby.currentTurnID;
    const crazyEights = card[0] === lobby.topCard[0] || card[1] === lobby.topCard[1] || lobby.topCard === '';
    console.log(lobby.currentTurnID);
    return hasCard && theirTurn && crazyEights;
}

const incrementLobbyTurnID = async (lobby: Lobby) => {
    const player = lobby.players.filter((p: Player) => p.uuid === lobby.currentTurnID)[0];
    if(player) {
        let index = lobby.players.indexOf(player);
        index = index == lobby.players.length-1 ? 0 : index+1;
        lobby.currentTurnID = lobby.players[index].uuid;
        await redis.set(`lobby:${lobby.number}`, JSON.stringify(lobby));
    }
}

const playCard = async (card: string, uuid: string) => {
    const lobby = await getPlayerLobby(uuid);
    if(lobby) {
        const player = lobby.players.filter((p: Player) => p.uuid === uuid)[0];
        const canPlay = await canPlayCard(card, player, lobby);
        if(canPlay) {
            lobby.topCard = card;
            incrementLobbyTurnID(lobby);
            await redis.set(`lobby:${lobby.number}`, JSON.stringify(lobby));
            await broadcastTopCard(lobby.number);
            await broadcastLobbyData(lobby.number);
            await removeCard(card, uuid);
            await broadcastNewTurn(lobby.number);

            if(player.hand.length < 1) {
                endGame(lobby, 'won', player.username);
            }
        }
    }
}

const broadcastLobbyData = async (lobbyNumber: number) => {
    const lobby = await getLobby(`lobby:${lobbyNumber}`);
    if(lobby) {
        for(const player of lobby.players) {
            const ws = websockets.get(player.uuid);
            if(ws) {
                ws.send(JSON.stringify({
                    type: 'lobby_data',
                    data: lobby.players.filter(other => other !== player)
                }));
            }
        }
    }
}

const broadcastTopCard = async (lobbyNumber: number) => {
    const lobby = await getLobby(`lobby:${lobbyNumber}`);
    if(lobby) {
        for(const player of lobby.players) {
            const ws = websockets.get(player.uuid);
            if(ws) {
                ws.send(JSON.stringify({
                    type: 'top_card',
                    card: lobby.topCard
                }));
            }
        }
    }
}

const broadcastNewTurn = async (lobbyNumber: number) => {
    const lobby = await getLobby(`lobby:${lobbyNumber}`);
    if(lobby) {
        const player = lobby.players.filter((p: Player) => p.uuid === lobby.currentTurnID)[0];
        if(player) {
            for(const lobbyPlayer of lobby.players) {
                const ws = websockets.get(lobbyPlayer.uuid);
                if(ws) {
                    ws.send(JSON.stringify({
                        type: 'new_turn',
                        username: player.username
                    }));
                }
            }
        }
    }
}

const startGame = async (lobbyNumber: number) => {
    const lobby = await getLobby(`lobby:${lobbyNumber}`);
    if(lobby) {
        lobby.started = true;
        const players: Player[] = lobby.players;
        lobby.currentTurnID = players[0].uuid;
        for(const player of players) {
            const ws = websockets.get(player.uuid);
            player.playing = true;
            if(ws) {
                ws.send(JSON.stringify({
                    type: 'game_start',
                    game: lobby.game,
                    playing: true
                }));
            }
        }
        await redis.set(`lobby:${lobbyNumber}`, JSON.stringify(lobby));

        await dealHandToLobby(lobbyNumber, handSize);
        await broadcastLobbyData(lobbyNumber);
        await broadcastNewTurn(lobbyNumber);
    }
}

const endGame = async (lobby: Lobby, reason: string, username: string) => {

    for(const player of lobby.players) {
        await clearHand(player.uuid);
        player.hand = [];
        const ws = websockets.get(player.uuid);
        if(ws) {
            ws.send(JSON.stringify({
                type: 'game_end',
                reason: reason,
                username: username
            }));
        }
    }

    lobby.started = false;
    lobby.topCard = '';
    lobby.currentTurnID = '';

    lobby.deck = [];
    for(const suit of cardSuits)
        for(const value of cardValues)
            lobby.deck.push(`${value}${suit}`);

    await redis.set(`lobby:${lobby.number}`, JSON.stringify(lobby));
    broadcastLobbyData(lobby.number);
}

const checkIfLobbyReady = async (lobbyNumber: number) => {
    const lobby = await getLobby(`lobby:${lobbyNumber}`);
    if(lobby) {
        const players: Player[] = lobby.players;
        let allReady = true;
        for(const player of players) {
            if(!player.ready) {
                allReady = false;
                break;
            }
        }
        return allReady;
    }
    return false;
}

const handleReadyToggle = async (uuid: string, value: boolean) => {
    const lobbyKey = await redis.get(`user:${uuid}:lobby`);
    if(lobbyKey) {
        const lobby = await getLobby(lobbyKey);
        if(lobby) {
            const player = lobby.players.filter((val: Player) => val.uuid === uuid)[0] as Player;
            if(player) {
                player.ready = value;
                await redis.set(`lobby:${lobby.number}`, JSON.stringify(lobby));
                broadcastLobbyData(lobby.number);

                const allReady = await checkIfLobbyReady(lobby.number);
                if(allReady && lobby.players.length > 1) {
                    startGame(lobby.number);
                }
            }
        }
    }
}

const attemptRegister = async (username: string, password: string, ws: WebSocket) => {
    const existing = await pool.query(
        "SELECT * FROM users WHERE username = $1",
        [username]
    );

    if(existing.rows.length > 0) {
        console.log('register failed: account already exists');
        ws.send(JSON.stringify({
            type: 'username_taken'
        }));
        return null;
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await pool.query(
        `
        INSERT INTO users (username, password_hash)
        VALUES ($1, $2)
        RETURNING *
        `,
        [username, hash]
    );
    return user.rows[0].id;
}

const attemptLogin = async (username: string, password: string, ws: WebSocket) => {
    const result = await pool.query(
        "SELECT * FROM users WHERE username = $1",
        [username]
    );

    const user = result.rows[0];

    if(!user) {
        console.log('login failed: user not found.');
        ws.send(JSON.stringify({
            type: 'account_dne'
        }));
        return null;
    }

    const sessionRequest = await redis.get(`user:${user.id}:session`);
    if(sessionRequest) {
        console.log('login failed: user already logged in.');
        ws.send(JSON.stringify({
            type: 'already_logged_in'
        }));
        return null;
    }

    const valid = await bcrypt.compare(password, user.password_hash);

    if(!valid) {
        console.log('login failed: password did not match.');
        ws.send(JSON.stringify({
            type: 'wrong_password'
        }));
        return null;
    }

    console.log('login succeeded.');
    return user.id;
}

const login = async (username: string, ws: WebSocket, uuid: string) => {
    sendLoginNotice(ws, username, uuid);
    websockets.set(uuid, ws);
    await redis.set(`user:${uuid}:session`, 1);
}

const sendLoginNotice = (ws: WebSocket, username: string, uuid: string) => {
    ws.send(JSON.stringify({
        type: 'logged_in',
        uuid: uuid,
        username: username
    }));
}

const goFishAsk = async (val: string, lobby: Lobby, uuid: string, askName: string) => {
    const player = lobby.players.filter((p: Player) => p.uuid === uuid)[0];
    const askPlayer = lobby.players.filter((p: Player) => p.username === askName)[0];
    if(askPlayer && player) {
        for(const card of askPlayer.hand) {
            if(card[0] === val) {
                await removeCard(card, askPlayer.uuid);
                await addCard(card, player.uuid);
            }
        }
    }
}

const handleBook = async (uuid: string, bookVal: string) => {
    const lobby = await getPlayerLobby(uuid);
    const ws = websockets.get(uuid);
    const suits = [ 'C', 'D', 'H', 'S' ];
    if(ws && lobby) {
        for(const suit of suits) {
            await removeCard(`${bookVal}${suit}`, uuid);
        }
        ws.send(JSON.stringify({
            type: 'add_book',
            value: bookVal
        }));
    }
}

const joinLobby = async (lobbyNumber: number, ws: WebSocket, player: Player) => {
    const lobbyRequest = await redis.get(`lobby:${lobbyNumber}`);

    let lobby;
    if(lobbyRequest) {
        lobby = JSON.parse(lobbyRequest) as Lobby;
    }
    else {
        const game = lobbyNumber < 6 ? 'crazy_eights' : 'go_fish';
        lobby = new Lobby(lobbyNumber, game);
    }

    lobby.players.push(player);

    const lobbyKey = `lobby:${lobbyNumber}`;
    await redis.set(
        lobbyKey,
        JSON.stringify(lobby)
    );

    await redis.set(
        `user:${player.uuid}:lobby`,
        lobbyKey
    );

    ws.send(JSON.stringify({
        type: 'lobby_joined'
    }));
    broadcastLobbyData(lobbyNumber);
    console.log(`${player.username} joined lobby ${lobbyNumber}`);
}

wss.on("connection", (ws) => {
    connectionCount++;
    console.log('client connected:', connectionCount);

    let uuid: string | null = null;

    sendLobbyPlayerCounts(ws);

    ws.on("close", async () => {
        connectionCount--;
        console.log("client disconnected:", connectionCount);

        if(uuid) {
            await redis.del(`user:${uuid}:session`);
            const lobby = await getPlayerLobby(uuid);
            if(lobby) {
                const player = lobby.players.filter((p: Player) => p.uuid === uuid)[0];
                if(player) {
                    console.log(`client was playing in lobby ${lobby.number}`);
                    lobby.players = lobby.players.filter((p: Player) => p.uuid !== uuid);
                    await redis.set(`lobby:${lobby.number}`, JSON.stringify(lobby));
                    await redis.del(`user:${uuid}:lobby`);
                    if(lobby.players.length < 2) {
                        console.log(`ending game in lobby ${lobby.number}`);
                        endGame(lobby, 'too_few_players', player.username);
                    }
                }
            }
        }
    });

    let player: Player;
    ws.on("message", async (msg) => {
        const data = JSON.parse(msg.toString());
        const lobby = await getPlayerLobby(data.uuid);
        switch(data.type) {
            case 'register':
                uuid = await attemptRegister(data.username, data.password, ws);
                if(uuid) {
                    console.log(`registered: ${data.username} ${uuid}`);
                    login(data.username, ws, uuid);
                    player = new Player(ws, data.username, uuid);
                }
                break;
            case 'login':
                uuid = await attemptLogin(data.username, data.password, ws);
                if(uuid) {
                    console.log(`logged in: ${data.username} ${uuid}`);
                    login(data.username, ws, uuid);
                    player = new Player(ws, data.username, uuid);
                }
                break;
            case 'join_lobby':
                if(player)
                    joinLobby(data.lobbyNumber, ws, player);
                break;
            case 'ready_toggle':
                handleReadyToggle(data.uuid, data.value);
                break;
            case 'play_card':
                playCard(data.card, data.uuid);
                break;
            case 'draw_card':
                if(lobby) {
                    const valid = lobby.game == 'crazy_eights' || lobby.deck.length > 0;
                    const theirTurn = lobby.currentTurnID === data.uuid;
                    if(valid && theirTurn) {
                        await incrementLobbyTurnID(lobby);
                        await dealCard(data.uuid);
                        await broadcastNewTurn(lobby.number);
                        await broadcastLobbyData(lobby.number);
                    }
                }
                break;
            case 'go_fish_ask':
                if(lobby) {
                    if(lobby.currentTurnID === data.uuid) {
                        await incrementLobbyTurnID(lobby);
                        await goFishAsk(data.val, lobby, data.uuid, data.askName);
                        await broadcastNewTurn(lobby.number);
                        await broadcastLobbyData(lobby.number);
                    }
                }
                break;
            case 'book':
                let validBook = true;
                const bookVal = data.book[0][0];
                for(const card of data.book)
                    if(card[0] !== bookVal)
                        validBook = false;

                if(validBook)
                    await handleBook(data.uuid, bookVal);
                break;
        }
    });
});

server.listen(3000, () => {
    console.log("http + ws server running on :3000");
});
