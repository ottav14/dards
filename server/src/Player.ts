import { WebSocket } from 'ws';

class Player {
    uuid: string;
    username: string;
    hand: string[];
    ws: WebSocket;
    ready: boolean;
    playing: boolean;
    constructor(ws: WebSocket, username: string, uuid: string) {
        this.uuid = uuid;
        this.username = username;
        this.hand = [];
        this.ws = ws;
        this.ready = false;
        this.playing = false;
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
