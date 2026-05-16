import express from "express";
import http from "http";
import Player from './Player.ts';
import { WebSocketServer, WebSocket } from "ws";
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import Lobby from './Lobby.ts';
import { redis } from '../lib/redis.ts';
import crypto from 'crypto';

const app = express();
const server = http.createServer(app);

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

const lobbyCount = 15;
const pokerBuyIn = 100;

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
            counts.push(lobby.playerSessions.length);
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
    return null;
}

const getPlayer = async (sessionID: string) => {
    const sessionRequest = await redis.get(`sess:${sessionID}`);
    if(sessionRequest) return JSON.parse(sessionRequest) as Player;
    return null;
}

const getPlayerLobby = async (sessionID: string) => {
    const sessionRequest = await redis.get(`sess:${sessionID}`);
    if(sessionRequest) {
        const player: Player = JSON.parse(sessionRequest);
        if(player.lobby) {
            const lobby = await getLobby(`lobby:${player.lobby}`);
            return lobby;
        }
    }
    return null;
}

const addCard = async (card: string, player: Player) => {
    const ws = websockets.get(player.sessionID);
    if(ws) {
        player.hand.push(card);
        await redis.set(`sess:${player.sessionID}`, JSON.stringify(player));

        ws.send(JSON.stringify({
            type: 'add_card',
            card: card
        }));
    }
}

const addMoney = async (amount: number, player: Player) => {
    const ws = websockets.get(player.sessionID);
    if(ws) {
        player.money += amount;
        await redis.set(`sess:${player.sessionID}`, JSON.stringify(player));

        ws.send(JSON.stringify({
            type: 'add_money',
            amount: amount
        }));
    }
}

const randomCardFromDeck = (deck: string[]) => {
    const index = Math.floor(Math.random() * deck.length);
    const card = deck[index];
    deck.splice(index, 1);
    return card;
}

const dealCard = async (sessionID: string) => {
    const player = await getPlayer(sessionID);
    const ws = websockets.get(sessionID);

    if(ws && player) {
        const lobby = await getLobby(`lobby:${player.lobby}`);
        if(lobby) {
            const card = randomCardFromDeck(lobby.deck);
            player.hand.push(card);

            if(lobby.game === 'crazy_eights' && lobby.deck.length < 1)
                lobby.deck = [...deck];

            await redis.set(`lobby:${lobby.number}`, JSON.stringify(lobby));
            await redis.set(`sess:${sessionID}`, JSON.stringify(player));

            ws.send(JSON.stringify({
                type: 'add_card',
                card: card
            }));
        }
    }
}

const dealHand = async (sessionID: string, handSize: number) => {
    for(let i = 0; i < handSize; i++)
        await dealCard(sessionID);
}

const clearHand = async (sessionID: string) => {
    const lobby = await getPlayerLobby(sessionID);
    const player = await getPlayer(sessionID);
    const ws = websockets.get(sessionID);
    if(lobby && player && ws) {
        for(const card of player.hand)
            await removeCard(card, player);
    }
}

const getLobbyPlayers = async (lobby: Lobby) => {
    const players: (Player | null)[] = [];
    for(const sessionID of lobby.playerSessions) {
        const player = await getPlayer(sessionID);
        players.push(player);
    }
    return players;
}

const dealHandToLobby = async (lobbyNumber: number, handSize: number) => {
    const lobby = await getLobby(`lobby:${lobbyNumber}`);
    if(lobby) {
        const players = await getLobbyPlayers(lobby);
        for(const player of players) {
            if(player)
                await dealHand(player.sessionID, handSize);
        }
    }
}

const removeCard = async (card: string, player: Player) => {
    const ws = websockets.get(player.sessionID);
    if(ws) {
        ws.send(JSON.stringify({
            type: 'remove_card',
            card: card
        }));
        player.hand = player.hand.filter(c => c !== card);
        await redis.set(`sess:${player.sessionID}`, JSON.stringify(player));
    }
}

const canPlayCard = async (card: string, player: Player, lobby: Lobby) => {
    const cardCount = player.hand.filter(c => c === card).length;
    const eightCount = player.hand.filter(c => c[0] === '8').length;
    const hasCard = cardCount > 0 || lobby.game === 'crazy_eights' && eightCount > 0;
    const theirTurn = player.sessionID === lobby.currentTurnID;
    const crazyEights = card[0] === lobby.topCard[0] || card[1] === lobby.topCard[1] || lobby.topCard === '';
    return hasCard && theirTurn && crazyEights;
}

const incrementLobbyTurnID = async (lobby: Lobby) => {
    const players = await getLobbyPlayers(lobby);
    let player: Player | null = null;
    for(const lobbyPlayer of players) {
        if(lobbyPlayer && lobbyPlayer.sessionID == lobby.currentTurnID) {
            player = lobbyPlayer;
            break;
        }
    }

    if(player) {
        let index = lobby.playerSessions.indexOf(player.sessionID);
        index = index == lobby.playerSessions.length-1 ? 0 : index+1;
        const newTurnPlayer = await getPlayer(lobby.playerSessions[index]);
        if(newTurnPlayer) {
            lobby.currentTurnID = newTurnPlayer.sessionID;
            await redis.set(`lobby:${lobby.number}`, JSON.stringify(lobby));
        }
    }
}

const playCrazyEight = async (card: string, suit: string, sessionID: string) => {
    const lobby = await getPlayerLobby(sessionID);
    const player = await getPlayer(sessionID);
    const ws = websockets.get(sessionID);
    if(lobby && player && ws) {
        const hasCard = player.hand.filter(c => c[0] === '8').length > 0;
        const theirTurn = player.sessionID === lobby.currentTurnID;
        const crazyEights = card[0] === lobby.topCard[0] || card[1] === lobby.topCard[1] || lobby.topCard === '';
        if(hasCard && theirTurn && crazyEights) {
            lobby.topCard = `8${suit}`;
            await incrementLobbyTurnID(lobby);
            await redis.set(`lobby:${lobby.number}`, JSON.stringify(lobby));

            await removeCard(card, player);

            await broadcastTopCard(lobby);
            await broadcastLobbyData(lobby);
            await broadcastNewTurn(lobby);

            if(player.hand.length < 1) {
                endGame(lobby, 'won', player.username);
            }
        }
    }
}

const playCard = async (card: string, sessionID: string) => {
    const lobby = await getPlayerLobby(sessionID);
    const player = await getPlayer(sessionID);
    const ws = websockets.get(sessionID);
    if(lobby && player && ws) {
        const canPlay = await canPlayCard(card, player, lobby);
        if(canPlay) {
            lobby.topCard = card;
            await incrementLobbyTurnID(lobby);
            await redis.set(`lobby:${lobby.number}`, JSON.stringify(lobby));

            await removeCard(card, player);

            await broadcastTopCard(lobby);
            await broadcastLobbyData(lobby);
            await broadcastNewTurn(lobby);

            if(player.hand.length < 1) {
                endGame(lobby, 'won', player.username);
            }
        }
    }
}

const broadcastLobbyData = async (lobby: Lobby) => {
    const players = await getLobbyPlayers(lobby);
    for(const player of players) {
        if(player) {
            const ws = websockets.get(player.sessionID);
            if(ws) {
                const data = [];
                for(const other of players) {
                    if(other && other !== player) {
                        data.push({
                            username: other.username,
                            handSize: other.hand.length,
                            ready: other.ready,
                            money: other.money,
                            playing: other.playing,
                            smallBlind: other.smallBlind,
                            bigBlind: other.bigBlind,
                        });
                    }
                }
                ws.send(JSON.stringify({
                    type: 'lobby_data',
                    data: data
                }));
            }
        }
    }
}

const broadcast = async (lobby: Lobby, message: string) => {
    const players = await getLobbyPlayers(lobby);
    for(const player of players) {
        if(player) {
            const ws = websockets.get(player.sessionID);
            if(ws)
                ws.send(message);
        }
    }
}

const broadcastPot = async (lobby: Lobby) => {
    broadcast(lobby, JSON.stringify({
        type: 'pot',
        amount: lobby.pot
    }));
}

const broadcastTopCard = async (lobby: Lobby) => {
    broadcast(lobby, JSON.stringify({
        type: 'top_card',
        card: lobby.topCard
    }));
}

const broadcastNewTurn = async (lobby: Lobby) => {
    const newTurnPlayer = await getPlayer(lobby.currentTurnID);
    if(newTurnPlayer) {
        broadcast(lobby, JSON.stringify({
            type: 'new_turn',
            username: newTurnPlayer.username
        }));
    }
}

const broadcastBlinds = async (lobby: Lobby) => {
    broadcast(lobby, JSON.stringify({
        type: 'blinds',
        card: lobby.topCard
    }));
}

const startGame = async (lobbyNumber: number) => {
    const lobby = await getLobby(`lobby:${lobbyNumber}`);
    if(lobby) {
        lobby.started = true;

        let handSize = 7;

        if(lobby.game === 'crazy_eights') {
            lobby.topCard = randomCardFromDeck(lobby.deck);
        }
        else if(lobby.game === 'texas_holdem') {
            handSize = 2;    
            const smallBlind = await getPlayer(lobby.playerSessions[0]);
            const bigBlind = await getPlayer(lobby.playerSessions[1]);
            const smallWS = websockets.get(lobby.playerSessions[0]);
            const bigWS = websockets.get(lobby.playerSessions[1]);
            if(smallBlind && bigBlind && smallWS && bigWS) {
                lobby.smallBlindID = lobby.playerSessions[0];
                lobby.bigBlindID = lobby.playerSessions[1];
                smallBlind.smallBlind = true;
                bigBlind.bigBlind = true;
                await redis.set(`sess:${smallBlind.sessionID}`, JSON.stringify(smallBlind));
                await redis.set(`sess:${bigBlind.sessionID}`, JSON.stringify(bigBlind));

                smallWS.send(JSON.stringify({
                    type: 'small_blind'
                }));

                bigWS.send(JSON.stringify({
                    type: 'big_blind'
                }));
            }
        }

        const players = await getLobbyPlayers(lobby);
        if(players[0]) lobby.currentTurnID = players[0].sessionID;

        for(const player of players) {
            if(player) {
                const ws = websockets.get(player.sessionID);
                player.playing = true;
                if(ws) {
                    ws.send(JSON.stringify({
                        type: 'game_start',
                        game: lobby.game,
                        playing: true
                    }));

                    if(lobby.game === 'texas_holdem')
                        addMoney(pokerBuyIn, player);
                }
                await redis.set(`sess:${player.sessionID}`, JSON.stringify(player));
            }
        }
        await redis.set(`lobby:${lobbyNumber}`, JSON.stringify(lobby));

        await dealHandToLobby(lobbyNumber, handSize);
        await broadcastLobbyData(lobby);
        await broadcastNewTurn(lobby);
        await broadcastTopCard(lobby);
        await broadcastPot(lobby);
        await broadcastBlinds(lobby);
    }
}

const endGame = async (lobby: Lobby, reason: string, username: string) => {

    const players = await getLobbyPlayers(lobby);
    for(const player of players) {
        if(player) {
            await clearHand(player.sessionID);
            player.hand = [];
            player.ready = false;
            await redis.set(`sess:${player.sessionID}`, JSON.stringify(player));

            const ws = websockets.get(player.sessionID);
            if(ws) {
                ws.send(JSON.stringify({
                    type: 'game_end',
                    reason: reason,
                    username: username
                }));
            }
        }
    }

    lobby.topCard = '';
    lobby.started = false;
    lobby.currentTurnID = '';
    lobby.deck = [...deck];

    await redis.set(`lobby:${lobby.number}`, JSON.stringify(lobby));
    await broadcastLobbyData(lobby);
    await broadcastTopCard(lobby);
}

const checkIfLobbyReady = async (lobbyNumber: number) => {
    const lobby = await getLobby(`lobby:${lobbyNumber}`);
    if(lobby) {
        const players = await getLobbyPlayers(lobby);
        let allReady = true;
        for(const player of players) {
            if(player && !player.ready) {
                allReady = false;
                break;
            }
        }
        return allReady;
    }
    return false;
}

const handleReadyToggle = async (sessionID: string, value: boolean) => {
    const player = await getPlayer(sessionID);
    if(player) {
        const lobby = await getLobby(`lobby:${player.lobby}`);
        if(lobby) {
            player.ready = value;
            await redis.set(`sess:${sessionID}`, JSON.stringify(player));
            broadcastLobbyData(lobby);

            const allReady = await checkIfLobbyReady(lobby.number);
            if(allReady && lobby.playerSessions.length > 1) {
                startGame(lobby.number);
            }
        }
    }
}

const generateSessionID = () => {
    return crypto.randomBytes(32).toString('hex');
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

    const sessionRequest = await redis.get(`user_sessions:${user.id}`);
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
    return result.rows[0].id;
}

const login = async (username: string, uuid: string, ws: WebSocket) => {
    const sessionID = generateSessionID();
    sendLoginNotice(ws, username, sessionID);
    websockets.set(sessionID, ws);
    const player = new Player(ws, username, uuid, sessionID);
    await redis.set(`sess:${sessionID}`, JSON.stringify(player));
    await redis.set(`user_sessions:${uuid}`, sessionID);
    return sessionID;
}

const sendLoginNotice = (ws: WebSocket, username: string, sessionID: string) => {
    ws.send(JSON.stringify({
        type: 'logged_in',
        sessionID: sessionID,
        username: username
    }));
}

const hasCardValue = (value: string, player: Player) => {
    for(const card of player.hand) {
        if(card[0] === value)
            return true;
    }
    return false;
}

const goFishAsk = async (val: string, lobby: Lobby, sessionID: string, askName: string) => {
    const player = await getPlayer(sessionID);
    const ws = websockets.get(sessionID);
    const lobbyPlayers = await getLobbyPlayers(lobby);
    const askPlayer = lobbyPlayers.filter((p) => p && p.username === askName)[0];
    if(askPlayer && player && ws) {
        if(hasCardValue(val, player)) {
            let cardsStolen = 0;
            for(const card of askPlayer.hand) {
                if(card[0] === val) {
                    await removeCard(card, askPlayer);
                    await addCard(card, player);
                    cardsStolen++;
                }
            }
            if(cardsStolen < 1) {
                console.log('not stolen');
                ws.send(JSON.stringify({
                    type: 'go_fish_fail',
                    username: askPlayer.username,
                    value: val
                }));
            }
            else {
                console.log('stolen');
                ws.send(JSON.stringify({
                    type: 'go_fish_success',
                    username: askPlayer.username,
                    value: val,
                    count: cardsStolen 
                }));
            }
        }
    }
}

const handleBook = async (sessionID: string, bookVal: string) => {
    const lobby = await getPlayerLobby(sessionID);
    const player = await getPlayer(sessionID);
    const ws = websockets.get(sessionID);
    const suits = [ 'C', 'D', 'H', 'S' ];
    if(ws && lobby && player) {
        for(const suit of suits) {
            await removeCard(`${bookVal}${suit}`, player);
        }
        ws.send(JSON.stringify({
            type: 'add_book',
            value: bookVal
        }));
    }
}

const joinLobby = async (lobbyNumber: number, ws: WebSocket, sessionID: string) => {
    const lobbyRequest = await redis.get(`lobby:${lobbyNumber}`);
    const sessionRequest = await redis.get(`sess:${sessionID}`);

    let player: Player;
    if(sessionRequest)
        player = JSON.parse(sessionRequest);
    else
        return;

    let lobby;
    if(lobbyRequest) {
        lobby = JSON.parse(lobbyRequest) as Lobby;
    }
    else {
        let game;
        if(lobbyNumber <= 5) game = 'crazy_eights';
        else if(lobbyNumber <= 10) game = 'go_fish';
        else game = 'texas_holdem';
        lobby = new Lobby(lobbyNumber, game);
    }

    lobby.playerSessions.push(sessionID);
    player.lobby = lobbyNumber;

    const lobbyKey = `lobby:${lobbyNumber}`;
    await redis.set(lobbyKey, JSON.stringify(lobby));

    await redis.set(`sess:${sessionID}`, JSON.stringify(player));

    ws.send(JSON.stringify({
        type: 'lobby_joined'
    }));
    broadcastLobbyData(lobby);
}

const canBet = (amount: number, player: Player, lobby: Lobby) => {
    return player.money >= amount && lobby.currentTurnID === player.sessionID;
}

const bet = async (amount: number, player: Player, ws: WebSocket, lobby: Lobby) => {
    lobby.pot += amount;
    player.money -= amount;
    await redis.set(`sess:${player.sessionID}`, JSON.stringify(player));
    await incrementLobbyTurnID(lobby);
    await broadcastNewTurn(lobby);
    await broadcastLobbyData(lobby);

    ws.send(JSON.stringify({
        type: 'remove_money',
        amount: amount
    }));
}

wss.on("connection", async (ws) => {
    console.log('client connected:', connectionCount);
    connectionCount++;

    let sessionID = '';

    await sendLobbyPlayerCounts(ws);

    ws.on("close", async () => {
        connectionCount--;
        console.log("client disconnected:", connectionCount);

        if(sessionID) {
            const player = await getPlayer(sessionID);
            if(player) { 
                await redis.del(`user_sessions:${player.uuid}`);
            }
            const lobby = await getPlayerLobby(sessionID);
            if(player && lobby) {
                console.log(`client was playing in lobby ${lobby.number}`);
                lobby.playerSessions = lobby.playerSessions.filter(id => id !== player.sessionID);
                await redis.set(`lobby:${lobby.number}`, JSON.stringify(lobby));
                const players = await getLobbyPlayers(lobby);
                if(players.filter(p => p && p.playing).length < 2 && lobby.started) {
                    console.log(`ending game in lobby ${lobby.number}`);
                    endGame(lobby, 'too_few_players', player.username);
                }
                await broadcastLobbyData(lobby);
            }
            await redis.del(`sess:${sessionID}`);
        }
    });

    ws.on("message", async (msg) => {
        const data = JSON.parse(msg.toString());
        const lobby = await getPlayerLobby(data.sessionID);
        const player = await getPlayer(data.sessionID);
        let uuid = '';
        switch(data.type) {
            case 'register':
                uuid = await attemptRegister(data.username, data.password, ws);
                console.log(`registered: ${data.username}`);
                if(uuid)
                    sessionID = await login(data.username, uuid, ws);
                break;
            case 'login':
                uuid = await attemptLogin(data.username, data.password, ws);
                console.log(`logged in: ${data.username}`);
                if(uuid)
                    sessionID = await login(data.username, uuid, ws);
                break;
            case 'guest':
                const username = `Guest${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
                uuid = crypto.randomUUID();
                sessionID = await login(username, uuid, ws);
                console.log('logged in guest'); 
                break;
            case 'join_lobby':
                joinLobby(data.lobbyNumber, ws, data.sessionID);
                break;
            case 'leave_lobby':
                if(player && lobby) {
                    player.lobby = null;
                    lobby.playerSessions = lobby.playerSessions.filter(id => id !== player.sessionID);
                    await redis.set(`sess:${player.sessionID}`, JSON.stringify(player));
                    await redis.set(`lobby:${lobby.number}`, JSON.stringify(lobby));

                    ws.send(JSON.stringify({
                        type: 'lobby_left'
                    }));
                    await broadcastLobbyData(lobby);
                    await sendLobbyPlayerCounts(ws);
                }
                break;
            case 'ready_toggle':
                handleReadyToggle(data.sessionID, data.value);
                break;
            case 'play_card':
                if(lobby && lobby.game === 'crazy_eights' && data.crazy8)
                    playCrazyEight(data.card, data.crazy8, data.sessionID);
                else
                    playCard(data.card, data.sessionID);
                break;
            case 'draw_card':
                if(player && lobby) {
                    const valid = lobby.game == 'crazy_eights' || lobby.deck.length > 0;
                    const theirTurn = lobby.currentTurnID === player.sessionID;
                    if(valid && theirTurn) {
                        await incrementLobbyTurnID(lobby);
                        await dealCard(data.sessionID);
                        await broadcastNewTurn(lobby);
                        await broadcastLobbyData(lobby);
                    }
                }
                break;
            case 'go_fish_ask':
                if(lobby) {
                    await goFishAsk(data.val, lobby, data.sessionID, data.askName);
                    await broadcastLobbyData(lobby);
                }
                break;
            case 'book':
                let validBook = true;
                const bookVal = data.book[0][0];
                for(const card of data.book)
                    if(card[0] !== bookVal)
                        validBook = false;

                if(lobby && validBook) {
                    await handleBook(data.sessionID, bookVal);
                    await broadcastLobbyData(lobby);
                }
                break;
            case 'bet':
                if(player && lobby && canBet(data.amount, player, lobby))
                    bet(data.amount, player, ws, lobby);
                break;
        }
    });
});

server.listen(3000, () => {
    console.log("http + ws server running on :3000");
});
