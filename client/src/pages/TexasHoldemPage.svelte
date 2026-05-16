<script lang="ts">
    import Card from '../components/Card.svelte';

    export let ws: WebSocket;
    export let sessionID: string;
    export let username: string;
    export let lobbyData: any[];
    export let playing: boolean;
    export let hand: string[];
    export let money: number;
    export let pot: number;
    export let currentTurnName: string;
    export let smallBlind: boolean;
    export let bigBlind: boolean;

    let overlapRate = 1;
    let betValue: number = 0;

    let opponentData: any[];
    $: {
        opponentData = lobbyData.filter(player => player.playing);
    }

    const fold = () => {

    }

    const check = () => {

    }

    const bet = (amount: number) => {
        console.log('bet');
        betValue = 0;
        ws.send(JSON.stringify({
            type: 'bet',
            amount: amount,
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
                            overlap={(opponentData.length-1)*overlapRate}
                        />
                    {/each}
                </div>
                <span class="opponentName">
                    {data.username} {data.smallBlind ? '(Small)' : (data.bigBlind ? '(Big)' : '')}
                </span>
                <span class="moneyDisplay">
                    {`$${data.money}`}
                </span>
            </div>
        {/each}
    </div>
    <div class="playArea">
        <span class="pot">
            {`Pot: $${pot}`}
        </span>
    </div>
    <div class="bottomContainer">
        {#if playing}
            <div class="handContainer">
                {#each hand as type}
                    <Card 
                        type={type} 
                    />
                {/each}
            </div>
            <span class="infoDisplay">
                {username} {smallBlind ? '(Small)' : (bigBlind ? '(Big)' : '')}<br />
                {#if currentTurnName === username}
                    It's your turn.
                {:else}
                    It's {currentTurnName}'s turn.
                {/if}
            </span>
            <div class="uiContainer">
                <button
                    class="uiButton"
                    on:click={fold}
                >
                    Fold
                </button>
                <button
                    class="uiButton"
                    on:click={check}
                    disabled={pot == 0}
                >
                    Check
                </button>
                <div class="betContainer">
                    <button 
                        class="uiButton"
                        on:click={() => bet(betValue)}
                     >
                        Bet
                    </button>
                    <span>$</span>
                    <input 
                        type="text" 
                        class="betInput"
                        bind:value={betValue}
                        on:keydown={(e: KeyboardEvent) => {
                            if(e.key === 'Enter')
                                bet(betValue);
                        }}
                    />
                </div>
            </div>
            <span class="moneyDisplay">
                {`$${money}`}
            </span>
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
        text-align: center;
        font-size: 16pt;
    }

    .playArea {
        display: flex;
        align-items: flex-start;
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
        padding-top: 0rem;
    }

    .handContainer {
        display: flex;
        position: relative;
        width: 100%;
        justify-content: center;
    }

    .uiContainer {
        display: flex;
        justify-content: center;
        padding: 0.5rem;
    }

    .uiButton {
        padding: 1rem;
        margin: 0.5rem;
    }

    .bottomContainer {
        text-align: center;
        padding-bottom: 2rem;
    }

    .moneyDisplay {
        font-size: 24pt;
    }

    .pot {
        font-size: 24pt;
        position: absolute;
        right: 15rem;
    }

    .betInput {
        width: 2rem;
        margin: 0 0.5rem;
    }

    .betContainer {
        display: flex;
        justify-content: center;
        align-items: center;
        background: #e9e9e9;
        z-index: 1;
        background-color: #ededed;
    }
</style>

