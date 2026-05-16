import { WebSocket } from 'ws';

class Player {
    sessionID: string;
    username: string;
    hand: string[];
    money: number;
    ws: WebSocket;
    ready: boolean;
    playing: boolean;
    smallBlind: boolean;
    bigBlind: boolean;
    lobby: number | null;
    uuid: string;
    constructor(ws: WebSocket, username: string, uuid: string, sessionID: string) {
        this.sessionID = sessionID;
        this.uuid = uuid;
        this.username = username;
        this.hand = [];
        this.money = 0;
        this.ws = ws;
        this.ready = false;
        this.playing = false;
        this.smallBlind = false;
        this.bigBlind = false;
        this.lobby = null;
    }

    removeCard(card: string) {
        for(let i = 0; i < this.hand.length; i++) {
            if(this.hand[i] === card) {
                this.hand.splice(i, 1);
                break;
            }
        }
    }
}
export default Player;
