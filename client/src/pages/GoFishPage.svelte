<script lang="ts">
    import Card from '../components/Card.svelte';
    import GoFishAskButton from '../components/GoFishAskButton.svelte';

    export let ws: WebSocket;
    export let sessionID: string;
    export let username: string;
    export let lobbyData: any[];
    export let playing: boolean;
    export let hand: string[];
    export let currentTurnName: string;
    export let books: string[];
    export let gameDisplayText: string;
    export let canDraw: boolean;
    export let canAsk: boolean;

    const suits = [ 'C', 'D', 'H', 'S' ];

    let opponentOverlapRate = 1;
    let playerOverlapRate = 0.08;
    let opponentData: any[];
    let isYourTurn = false;

    let selectedRecord: Record<string, boolean> = {};

    $: {
        opponentData = lobbyData.filter(player => player.playing);
        isYourTurn = currentTurnName === username;
    }

    const isBook = () => {
        const selectedCards = Object.keys(selectedRecord);
        let count = 0;
        for(const selectedCard of selectedCards) {
            if(selectedRecord[selectedCard])
                count++;
        }
        return count > 3;
    }

    const sendBook = () => {
        const selectedCards = Object.keys(selectedRecord);
        const book = [];
        for(const selectedCard of selectedCards) {
            if(selectedRecord[selectedCard])
                book.push(selectedCard);
        }
        ws.send(JSON.stringify({
            type: 'book',
            book: book,
            sessionID: sessionID
        }));
    }

    const isSelectable = (card: string) => {
        const selectedCards = Object.keys(selectedRecord);
        for(const selectedCard of selectedCards) {
            if(selectedRecord[selectedCard] && selectedCard[0] !== card[0])
                return false;
        }
        return selectedCards.length < 4;
    }

    const selectCard = (card: string) => {
        if(isSelectable(card)) {
            if(selectedRecord[card] !== null)
                selectedRecord[card] = !selectedRecord[card];
            else
                selectedRecord[card] = true;

            if(isBook()) {
                sendBook();
                for(const selectedCard of Object.keys(selectedRecord))
                    selectedRecord[selectedCard] = false;
            }
        }
    }

    const drawCard = () => {
        ws.send(JSON.stringify({
            type: 'draw_card',
            sessionID: sessionID
        }));
    }
</script>

<div class="gameContainer">
    <div class="opponents">
        {#each opponentData as data}
            <div class="opponentContainer">
                <div class="opponentHand">
                    {#each Array(data.handSize)}
                        <Card 
                            type="2B" 
                            overlap={(opponentData.length-1)*opponentOverlapRate}
                        />
                    {/each}
                </div>
                <span class="opponentName">
                    {data.username}
                </span>
                <GoFishAskButton 
                    {sessionID}
                    {ws}
                    {canAsk}
                    {hand}
                    playerName={data.username}
                />
            </div>
        {/each}
    </div>
    <div class="playArea">
        <div class="drawContainer">
            <Card 
                 type="2B" 
             />
            <button 
                disabled={!canDraw}
                class="drawButton"
                on:click={drawCard}
            >
                Draw
            </button>
        </div>
        <div class="bookContainer">
            {#each books as bookValue}
                <div class="book">
                    {#each suits as suit}
                        <Card 
                             type={`${bookValue}${suit}`} 
                             overlap={3}
                         />
                    {/each}
                </div>
            {/each}
        </div>
    </div>
    <div class="bottomContainer">
        {#if playing}
            <div class="playerContainer">
                <span class="gameDisplayText">
                    {gameDisplayText}
                </span>
                <div class="handContainer">
                    {#each hand as type}
                        <Card 
                            type={type} 
                            playable={true}
                            selected={selectedRecord[type]}
                            onClick={() => selectCard(type)}
                            overlap={(hand.length-1)*playerOverlapRate}
                        />
                    {/each}
                </div>
                <p class="infoDisplay">
                    {username}<br />
                    {#if currentTurnName === username}
                        It's your turn.
                    {:else}
                        It's {currentTurnName}'s turn.
                    {/if}
                </p>
            </div>
        {:else}
            <p class="infoDisplay">
                Wait until the end of the current game to play. 
            </p>
        {/if}
    </div>
</div>

<style>
    .gameContainer {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        height: 100vh;
    }

    .playerContainer {
        display: flex;
        flex-direction: column;
        text-align: center;
    }

    .infoDisplay {
        padding-bottom: 2rem;
        text-align: center;
        font-size: 16pt;
    }

    .drawContainer {
        top: calc(50vh);
        left: calc(50vw);
        transform: translate(-50%, -50%);
        position: absolute;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .drawButton {
        width: 5rem;
    }

    .opponentContainer {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .opponents {
        display: flex;
        justify-content: space-around;
        width: 100vw;
        margin-top: 5rem;
    }

    .opponentHand {
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .opponentName {
        padding-top: 1rem;
    }

    .handContainer {
        display: flex;
        width: 100%;
        justify-content: center;
        padding-top: 2rem;
    }

    .bookContainer {
        position: absolute;
        top: calc(50vw - 50%);
        right: 10rem;
        display: flex;
    }

    .book {
        display: flex;
        flex-direction: column;
        margin-left: 5rem;
    }
</style>
