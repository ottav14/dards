<script lang="ts">
    import Card from '../components/Card.svelte';

    export let ws: WebSocket;
    export let uuid: string;
    export let username: string;
    export let lobbyData: any[];
    export let playing: boolean;
    export let hand: string[];
    export let currentTurnName: string;
    export let topCard;

    let overlapRate = 1;

    let opponentData: any[];
    $: {
        opponentData = lobbyData.filter(player => player.playing);
    }

    const playCard = (cardType: string) => {
        ws.send(JSON.stringify({
            type: 'play_card',
            card: cardType,
            uuid: uuid
        }));
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
                <p class="opponentName">
                    {data.username}
                </p>
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
            <div class="handContainer">
                {#each hand as type}
                    <Card 
                        type={type} 
                        playable={true}
                        onClick={() => playCard(type)}
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
        padding-top: 3rem;
    }

    .handContainer {
        display: flex;
        position: relative;
        width: 100%;
        justify-content: center;
    }
</style>
