<script lang="ts">
    import Card from '../components/Card.svelte';
    import GoFishAskButton from '../components/GoFishAskButton.svelte';

    export let ws: WebSocket;
    export let uuid: string;
    export let username: string;
    export let lobbyData: any[];
    export let playing: boolean;
    export let hand: string[];
    export let currentTurnName: string;
    export let topCard: string;
    export let books: string[];

    const suits = [ 'C', 'D', 'H', 'S' ];

    let overlapRate = 1;
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
            uuid: uuid
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
            uuid: uuid 
        }));
    }
</script>

<div class="gameContainer">
    <div class="opponents">
        {#each opponentData as data}
            <div class="opponentContainer">
                <div class="opponentHand">
                    {#each Array(data.hand.length)}
                        <Card 
                            type="2B" 
                            overlap={(opponentData.length-1)*overlapRate}
                        />
                    {/each}
                </div>
                <span class="opponentName">
                    {data.username}
                </span>
                <GoFishAskButton 
                    {uuid}
                    {ws}
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
                class="drawButton"
                on:click={drawCard}
            >
                Draw
            </button>
        </div>
        <Card type={topCard} />
    </div>
    <div class="bottomContainer">
        {#if playing}
            <div class="playerContainer">
                <div class="handContainer">
                    {#each hand as type}
                        <Card 
                            type={type} 
                            playable={isYourTurn}
                            selected={selectedRecord[type]}
                            onClick={() => selectCard(type)}
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
            <div class="bookContainer">
                {#each books as bookValue}
                    {#each suits as suit}
                        <Card type={`${bookValue}${suit}`} />
                    {/each}
                {/each}
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

    .infoDisplay {
        padding-bottom: 2rem;
        text-align: center;
        font-size: 16pt;
    }

    .drawContainer {
        position: absolute;
        display: flex;
        flex-direction: column;
        align-items: center;
        right: 100%;
    }

    .drawButton {
        width: 5rem;
    }

    .playArea {
        display: flex;
        align-items: flex-start;
        position: relative;
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
        position: relative;
        width: 100%;
        justify-content: center;
    }
</style>
