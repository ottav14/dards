<script lang="ts">
    export let sessionID: string;
    export let ws: WebSocket;

    let open = false;
    let betValue: number;

    const bet = (amount: number) => {
        ws.send(JSON.stringify({
            type: 'bet',
            amount: amount,
            sessionID: sessionID
        }));
    }

</script>

<div class="betContainer">
    <button 
        class="betButton"
        on:click={() => {
            open = !open;
        }}
     >
        Bet
    </button>
    {#if open}
        <div class="menu">
            <span>$</span>
            <input 
                type="text" 
                bind:value={betValue}
                on:submit={() => bet(betValue)}
            />
        </div>
    {/if}
</div>

<style>
    .betContainer {
        position: relative;
        display: flex;
        align-items: center;
    }

    .menu {
        display: flex;
        position: absolute;
        justify-content: center;
        align-items: center;
        left: 100%;
        background: #e9e9e9;
        z-index: 1;
        background-color: #ededed;
        padding: 1rem;
    }

    .betButton {
        margin: 0.5rem;
        padding:  1rem;
    }

    input {
        width: 2rem;
        margin-left: 0.5rem;
    }
</style>
