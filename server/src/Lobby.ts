import Player from './Player.ts';

const cardSuits = [ 'C', 'D', 'H', 'S' ];
const cardValues = [ 'A', '2', '3', '4', '5', '6', '7', '8', '9', 'T' ];

class Lobby {
    number: number;
    players: Player[]
    started: boolean;
    game: string;
    deck: string[];
    topCard: string;
    currentTurnID: string;
    constructor(number: number, game: string) {
        this.number = number;
        this.players = [];
        this.started = false;
        this.game = game;
        this.topCard = '';
        this.currentTurnID = '';
        this.deck = [];
        for(const suit of cardSuits)
            for(const value of cardValues)
                this.deck.push(`${value}${suit}`);
    }
}
export default Lobby;
