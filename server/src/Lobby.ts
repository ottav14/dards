const cardSuits = [ 'C', 'D', 'H', 'S' ];
const cardValues = [ 'A', '2', '3', '4', '5', '6', '7', '8', '9', 'T' ];

class Lobby {
    number: number;
    playerSessions: string[];
    started: boolean;
    game: string;
    deck: string[];
    topCard: string;
    pot: number;
    currentTurnID: string;
    smallBlindID: string;
    bigBlindID: string;
    constructor(number: number, game: string) {
        this.number = number;
        this.playerSessions = [];
        this.started = false;
        this.game = game;
        this.topCard = '';
        this.pot = 0;
        this.currentTurnID = '';
        this.smallBlindID = '';
        this.bigBlindID = '';
        this.deck = [];
        for(const suit of cardSuits)
            for(const value of cardValues)
                this.deck.push(`${value}${suit}`);
    }
}
export default Lobby;
